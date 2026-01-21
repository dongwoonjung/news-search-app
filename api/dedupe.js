// 멀티링구얼 임베딩 기반 기사 중복 체크 API
// Hugging Face Inference API 사용 (무료)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { articles, category } = req.body;

    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({ error: 'articles array is required' });
    }

    // 1. 각 기사의 대표 텍스트 생성 및 정규화
    const processedArticles = articles.map(article => ({
      ...article,
      dedupeText: normalizeText(article.title, article.summary)
    }));

    // 2. 임베딩 생성 (Hugging Face API)
    const embeddings = await generateEmbeddings(
      processedArticles.map(a => a.dedupeText)
    );

    if (!embeddings || embeddings.length !== processedArticles.length) {
      // 임베딩 실패 시 기존 방식으로 fallback
      console.warn('Embedding generation failed, using fallback method');
      const deduped = fallbackDedupe(processedArticles);
      return res.status(200).json({
        success: true,
        articles: deduped,
        method: 'fallback'
      });
    }

    // 3. 코사인 유사도 기반 중복 제거
    const deduped = dedupeByEmbedding(processedArticles, embeddings);

    // 4. Supabase에 임베딩 저장 (선택적)
    if (process.env.SUPABASE_URL && category) {
      await saveEmbeddings(deduped.kept, embeddings, category);
    }

    return res.status(200).json({
      success: true,
      articles: deduped.kept,
      removed: deduped.removed.length,
      method: 'embedding'
    });

  } catch (error) {
    console.error('Error in dedupe API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 텍스트 정규화
function normalizeText(title, summary) {
  const text = `${title || ''} ${summary || ''}`;

  return text
    .toLowerCase()
    // HTML 태그 제거
    .replace(/<[^>]*>/g, '')
    // 특수문자 정규화
    .replace(/[^\w\s가-힣]/g, ' ')
    // 연속 공백 제거
    .replace(/\s+/g, ' ')
    .trim()
    // 최대 500자로 제한
    .slice(0, 500);
}

// Hugging Face Inference API로 임베딩 생성
async function generateEmbeddings(texts) {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;

  // 토큰 없으면 null 반환 (fallback으로)
  if (!HF_TOKEN) {
    console.warn('HUGGINGFACE_TOKEN not set');
    return null;
  }

  try {
    // sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
    // 한국어/영어 모두 지원하는 멀티링구얼 모델
    const response = await fetch(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: texts,
          options: { wait_for_model: true }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('HuggingFace API error:', error);
      return null;
    }

    const embeddings = await response.json();
    return embeddings;

  } catch (error) {
    console.error('Embedding generation error:', error);
    return null;
  }
}

// 코사인 유사도 계산
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 임베딩 기반 중복 제거
function dedupeByEmbedding(articles, embeddings) {
  const kept = [];
  const removed = [];
  const keptEmbeddings = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const embedding = embeddings[i];

    let isDuplicate = false;
    let maxSimilarity = 0;
    let duplicateOf = null;

    // 이미 추가된 기사들과 비교
    for (let j = 0; j < keptEmbeddings.length; j++) {
      const similarity = cosineSimilarity(embedding, keptEmbeddings[j]);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        duplicateOf = kept[j];
      }

      // 높은 유사도: 거의 확실한 중복
      if (similarity >= 0.92) {
        isDuplicate = true;
        break;
      }

      // 중간 유사도: 추가 검사
      if (similarity >= 0.82) {
        // 엔티티/키워드 일치도 검사
        const entityMatch = checkEntityMatch(article, kept[j]);
        const keywordMatch = checkKeywordMatch(article, kept[j]);

        if (entityMatch >= 0.7 || keywordMatch >= 0.6) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      kept.push(article);
      keptEmbeddings.push(embedding);
    } else {
      removed.push({
        ...article,
        duplicateOf: duplicateOf?.title,
        similarity: maxSimilarity
      });
    }
  }

  return { kept, removed };
}

// 엔티티 일치도 검사
function checkEntityMatch(article1, article2) {
  const entities1 = extractEntities(article1.title + ' ' + (article1.summary || ''));
  const entities2 = extractEntities(article2.title + ' ' + (article2.summary || ''));

  if (entities1.size === 0 || entities2.size === 0) return 0;

  const intersection = new Set([...entities1].filter(x => entities2.has(x)));
  const union = new Set([...entities1, ...entities2]);

  return intersection.size / union.size;
}

// 엔티티 추출 (간단한 패턴 매칭)
function extractEntities(text) {
  const entities = new Set();

  // 국가/지역
  const countries = text.match(/\b(China|Russia|Ukraine|Iran|Israel|Taiwan|US|USA|EU|Korea|Japan|Germany|France|UK|중국|러시아|우크라이나|이란|이스라엘|대만|미국|한국|일본|독일|프랑스|영국)\b/gi) || [];
  countries.forEach(c => entities.add(c.toLowerCase()));

  // 기업
  const companies = text.match(/\b(Tesla|Hyundai|Kia|Ford|GM|Toyota|BYD|Apple|Google|Microsoft|Nvidia|OpenAI|테슬라|현대|기아|토요타|애플|구글|마이크로소프트|엔비디아)\b/gi) || [];
  companies.forEach(c => entities.add(c.toLowerCase()));

  // 인물
  const people = text.match(/\b(Trump|Biden|Xi|Putin|Musk|트럼프|바이든|시진핑|푸틴|머스크)\b/gi) || [];
  people.forEach(p => entities.add(p.toLowerCase()));

  return entities;
}

// 키워드 일치도 검사 (트리거/사건성 단어)
function checkKeywordMatch(article1, article2) {
  const keywords1 = extractKeywords(article1.title + ' ' + (article1.summary || ''));
  const keywords2 = extractKeywords(article2.title + ' ' + (article2.summary || ''));

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

// 키워드 추출 (트리거/사건성 단어)
function extractKeywords(text) {
  const keywords = new Set();

  // 사건성 단어
  const triggers = text.match(/\b(ban|bans|banned|recall|recalls|recalled|tariff|tariffs|sanction|sanctions|rate cut|rate hike|investigate|investigation|announce|announces|announced|launch|launches|launched|deal|agreement|crash|surge|plunge|crisis|war|conflict|금지|리콜|관세|제재|금리|조사|발표|출시|합의|폭락|급등|위기|전쟁|분쟁)\b/gi) || [];
  triggers.forEach(t => keywords.add(t.toLowerCase()));

  // 숫자/수치 (금액, 퍼센트 등)
  const numbers = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:billion|million|trillion))?|\d+(?:\.\d+)?%/gi) || [];
  numbers.forEach(n => keywords.add(n.toLowerCase()));

  return keywords;
}

// Fallback: 기존 방식의 중복 제거
function fallbackDedupe(articles) {
  const kept = [];
  const seenTitles = new Set();

  for (const article of articles) {
    // 제목의 핵심 단어 추출
    const titleWords = article.title
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .sort()
      .join(' ');

    // 이미 유사한 제목이 있는지 확인
    let isDuplicate = false;
    for (const seen of seenTitles) {
      const similarity = jaccardSimilarity(titleWords.split(' '), seen.split(' '));
      if (similarity >= 0.6) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(article);
      seenTitles.add(titleWords);
    }
  }

  return kept;
}

// Jaccard 유사도
function jaccardSimilarity(set1, set2) {
  const s1 = new Set(set1);
  const s2 = new Set(set2);
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Supabase에 임베딩 저장
async function saveEmbeddings(articles, embeddings, category) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      // 이미 존재하는지 확인
      const { data: existing } = await supabase
        .from('article_embeddings')
        .select('id')
        .eq('article_url', article.url)
        .single();

      if (!existing) {
        await supabase
          .from('article_embeddings')
          .insert({
            article_url: article.url,
            article_title: article.title,
            article_summary: article.summary,
            category: category,
            source: article.source,
            published_at: article.publishedAt,
            embedding: `[${embeddings[i].join(',')}]`,
            entities: JSON.stringify([...extractEntities(article.title + ' ' + (article.summary || ''))]),
            keywords: JSON.stringify([...extractKeywords(article.title + ' ' + (article.summary || ''))])
          });
      }
    }
  } catch (error) {
    console.error('Error saving embeddings:', error);
  }
}
