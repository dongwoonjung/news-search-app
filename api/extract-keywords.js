// 기사 기반 키워드 추출 API
// 1. 기사 수집 → 2. 클러스터링 → 3. 엔티티/개념/트리거 추출 → 4. 점수화 → 5. DB 업데이트

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { action, category } = req.query;

    // 키워드 추출 실행
    if (action === 'extract') {
      const categories = category ? [category] : ['geopolitics', 'economy', 'automotive', 'ai-tech'];
      const results = {};

      for (const cat of categories) {
        // 1. 해당 카테고리의 최근 기사들 수집
        const articles = await fetchRecentArticles(cat);

        // 2. 기사에서 키워드 추출
        const extractedKeywords = extractKeywordsFromArticles(articles, cat);

        // 3. 점수 계산 및 DB 업데이트
        const updatedKeywords = await updateKeywordScores(supabase, extractedKeywords, cat);

        results[cat] = {
          articlesProcessed: articles.length,
          keywordsExtracted: extractedKeywords.length,
          keywordsUpdated: updatedKeywords.length
        };
      }

      return res.status(200).json({
        success: true,
        message: 'Keywords extracted and updated',
        results
      });
    }

    // 점수 기반 키워드 정리 (Decay)
    if (action === 'cleanup') {
      const result = await cleanupKeywords(supabase);
      return res.status(200).json({
        success: true,
        message: 'Keywords cleaned up',
        ...result
      });
    }

    // 키워드 통계 조회
    if (action === 'stats') {
      const { data: stats } = await supabase
        .from('search_keywords')
        .select('category, keyword_type, status')
        .order('total_score', { ascending: false });

      const summary = {
        byCategory: {},
        byType: { anchor: 0, active: 0, watchlist: 0 },
        byStatus: { approved: 0, pending: 0, rejected: 0 }
      };

      stats?.forEach(kw => {
        // 카테고리별
        if (!summary.byCategory[kw.category]) {
          summary.byCategory[kw.category] = 0;
        }
        summary.byCategory[kw.category]++;

        // 타입별
        if (kw.keyword_type && summary.byType[kw.keyword_type] !== undefined) {
          summary.byType[kw.keyword_type]++;
        }

        // 상태별
        if (kw.status && summary.byStatus[kw.status] !== undefined) {
          summary.byStatus[kw.status]++;
        }
      });

      return res.status(200).json({ success: true, stats: summary });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Error in extract-keywords API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 최근 기사 수집
async function fetchRecentArticles(category) {
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser();
  const articles = [];

  // 카테고리별 검색 쿼리
  const categoryQueries = {
    'geopolitics': 'China Russia Ukraine Iran Israel Taiwan Trump NATO EU tariff sanctions diplomacy',
    'economy': 'Federal Reserve inflation GDP interest rate stock market recession unemployment Treasury',
    'automotive': 'Tesla Hyundai Kia EV electric vehicle battery BYD Ford GM Toyota recall',
    'ai-tech': 'AI artificial intelligence ChatGPT OpenAI Nvidia semiconductor chip robot autonomous'
  };

  const query = categoryQueries[category] || 'news';

  try {
    // Google News RSS
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
    const googleFeed = await parser.parseURL(googleUrl);

    googleFeed.items.slice(0, 30).forEach(item => {
      articles.push({
        title: item.title,
        summary: item.contentSnippet || '',
        source: item.source?._ || 'Google News',
        date: new Date(item.pubDate)
      });
    });
  } catch (e) {
    console.warn('Failed to fetch Google News:', e.message);
  }

  try {
    // Bing News RSS
    const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=en-US`;
    const bingFeed = await parser.parseURL(bingUrl);

    bingFeed.items.slice(0, 30).forEach(item => {
      articles.push({
        title: item.title,
        summary: item.contentSnippet || item.description || '',
        source: 'Bing News',
        date: new Date(item.pubDate || item.isoDate)
      });
    });
  } catch (e) {
    console.warn('Failed to fetch Bing News:', e.message);
  }

  return articles;
}

// 기사에서 키워드 추출
function extractKeywordsFromArticles(articles, category) {
  const keywordCounts = new Map();
  const keywordSources = new Map();

  // 엔티티 패턴 (국가/기관/기업/인물)
  const entityPatterns = {
    country: /\b(China|Chinese|Russia|Russian|Ukraine|Ukrainian|Iran|Iranian|Israel|Israeli|Taiwan|Taiwanese|Japan|Japanese|Korea|Korean|India|Indian|Germany|German|France|French|UK|Britain|British|EU|Europe|European|US|USA|America|American|Canada|Canadian|Mexico|Mexican|Brazil|Brazilian|Saudi|Arabia|Turkey|Turkish|Poland|Polish|Denmark|Danish|Greenland)\b/gi,
    organization: /\b(NATO|UN|United Nations|IMF|World Bank|WTO|OPEC|Fed|Federal Reserve|ECB|BOJ|SEC|FTC|EPA|FDA|DOJ|Pentagon|White House|Congress|Senate|NHTSA|IEA)\b/gi,
    company: /\b(Tesla|Hyundai|Kia|Ford|GM|General Motors|Toyota|Honda|Volkswagen|VW|BMW|Mercedes|Benz|BYD|Rivian|Lucid|NIO|Xpeng|Apple|Google|Microsoft|Amazon|Meta|Facebook|Nvidia|Intel|AMD|TSMC|Samsung|SK|LG|Foxconn|OpenAI|Anthropic|DeepMind|Baidu|Alibaba|Tencent|Huawei|CATL|Panasonic|Boeing|Airbus|SpaceX|Lockheed|Raytheon)\b/gi,
    person: /\b(Trump|Biden|Xi|Jinping|Putin|Zelensky|Macron|Scholz|Musk|Bezos|Zuckerberg|Altman|Pichai|Nadella|Cook|Dimon|Powell|Yellen|Lagarde|Kim Jong|Netanyahu|Khamenei|MBS|Erdogan)\b/gi
  };

  // 개념 패턴 (관세/제재/금리 등)
  const conceptPatterns = {
    trade: /\b(tariff|tariffs|sanction|sanctions|trade war|trade deal|import|export|quota|embargo|customs|duty|duties)\b/gi,
    finance: /\b(interest rate|rate cut|rate hike|inflation|deflation|GDP|recession|unemployment|jobs report|employment|bond|yield|Treasury|debt|deficit|stimulus|QE|quantitative)\b/gi,
    automotive: /\b(EV|electric vehicle|battery|lithium|cobalt|charging|range|autonomous|self-driving|ADAS|recall|safety|emission|hybrid|plug-in|fuel cell|hydrogen)\b/gi,
    tech: /\b(AI|artificial intelligence|machine learning|deep learning|LLM|GPT|neural|chip|semiconductor|processor|GPU|CPU|5G|6G|quantum|cloud|data center|cybersecurity)\b/gi,
    regulation: /\b(regulation|regulatory|law|legislation|bill|act|policy|compliance|antitrust|monopoly|privacy|GDPR|ban|restriction|approval|investigation)\b/gi
  };

  // 트리거 패턴 (사건성 단어)
  const triggerPatterns = /\b(announce|announced|announces|ban|banned|bans|investigate|investigation|recall|recalled|rate cut|rate hike|launch|launches|acquire|acquired|merger|deal|agreement|partnership|breakthrough|crisis|collapse|surge|plunge|soar|crash|warning|threat|attack|conflict|war|peace|summit|meeting|talks|negotiate|sign|signed|approve|approved|reject|rejected|delay|delayed|cancel|cancelled)\b/gi;

  // 각 기사에서 키워드 추출
  articles.forEach(article => {
    const text = `${article.title} ${article.summary}`;
    const sourceTier = getSourceTier(article.source);

    // 엔티티 추출
    for (const [type, pattern] of Object.entries(entityPatterns)) {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        const normalized = normalizeKeyword(match);
        addKeyword(keywordCounts, keywordSources, normalized, type, sourceTier, category);
      });
    }

    // 개념 추출
    for (const [type, pattern] of Object.entries(conceptPatterns)) {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        const normalized = normalizeKeyword(match);
        addKeyword(keywordCounts, keywordSources, normalized, 'concept', sourceTier, category);
      });
    }

    // 트리거 추출
    const triggerMatches = text.match(triggerPatterns) || [];
    triggerMatches.forEach(match => {
      const normalized = normalizeKeyword(match);
      addKeyword(keywordCounts, keywordSources, normalized, 'trigger', sourceTier, category);
    });
  });

  // 결과 정리 및 점수 계산
  const keywords = [];
  keywordCounts.forEach((data, keyword) => {
    if (data.count >= 2) { // 최소 2회 이상 등장
      const frequencyScore = Math.min(data.count * 10, 100);
      const reliabilityScore = Math.round(data.reliabilitySum / data.count);
      const domainScore = calculateDomainScore(keyword, data.entityType, category);

      keywords.push({
        keyword,
        keyword_ko: getKoreanTranslation(keyword),
        category,
        entity_type: data.entityType,
        frequency_score: frequencyScore,
        reliability_score: reliabilityScore,
        domain_score: domainScore,
        total_score: Math.round((frequencyScore + reliabilityScore + domainScore) / 3),
        count: data.count
      });
    }
  });

  // 점수순 정렬
  keywords.sort((a, b) => b.total_score - a.total_score);

  return keywords.slice(0, 50); // 상위 50개만
}

function addKeyword(counts, sources, keyword, entityType, sourceTier, category) {
  if (!counts.has(keyword)) {
    counts.set(keyword, {
      count: 0,
      reliabilitySum: 0,
      entityType,
      category
    });
  }
  const data = counts.get(keyword);
  data.count++;
  data.reliabilitySum += sourceTier;
}

function normalizeKeyword(keyword) {
  // 대소문자 정규화 및 공통 변형 통일
  const normalized = keyword.trim();

  const normalizations = {
    'usa': 'US',
    'america': 'US',
    'american': 'US',
    'britain': 'UK',
    'british': 'UK',
    'chinese': 'China',
    'russian': 'Russia',
    'ukrainian': 'Ukraine',
    'iranian': 'Iran',
    'israeli': 'Israel',
    'taiwanese': 'Taiwan',
    'japanese': 'Japan',
    'korean': 'Korea',
    'german': 'Germany',
    'french': 'France',
    'european': 'Europe',
    'general motors': 'GM',
    'volkswagen': 'VW',
    'mercedes benz': 'Mercedes',
    'ev': 'EV',
    'ai': 'AI',
    'gdp': 'GDP'
  };

  const lower = normalized.toLowerCase();
  return normalizations[lower] || normalized;
}

function getSourceTier(source) {
  // 주요 매체는 높은 신뢰도 점수
  const tier1 = ['Reuters', 'AP', 'Bloomberg', 'WSJ', 'Wall Street Journal', 'Financial Times', 'NYT', 'New York Times', 'Washington Post'];
  const tier2 = ['BBC', 'CNN', 'CNBC', 'Forbes', 'The Guardian', 'Politico', 'The Economist'];

  if (tier1.some(t => source.includes(t))) return 100;
  if (tier2.some(t => source.includes(t))) return 80;
  return 50;
}

function calculateDomainScore(keyword, entityType, category) {
  // 카테고리별 도메인 적합성 점수
  const domainKeywords = {
    'geopolitics': ['China', 'Russia', 'Ukraine', 'Iran', 'Israel', 'Taiwan', 'US', 'EU', 'NATO', 'tariff', 'sanction', 'Trump', 'war', 'conflict', 'diplomacy'],
    'economy': ['Fed', 'inflation', 'GDP', 'recession', 'rate', 'Treasury', 'unemployment', 'stock', 'bond', 'yield', 'Powell', 'Yellen'],
    'automotive': ['Tesla', 'Hyundai', 'Kia', 'EV', 'battery', 'recall', 'autonomous', 'BYD', 'Ford', 'GM', 'Toyota', 'charging'],
    'ai-tech': ['AI', 'Nvidia', 'OpenAI', 'chip', 'semiconductor', 'GPT', 'robot', 'autonomous', 'Musk', 'Altman', 'Google', 'Microsoft']
  };

  const relevantKeywords = domainKeywords[category] || [];
  const keywordLower = keyword.toLowerCase();

  if (relevantKeywords.some(k => keywordLower.includes(k.toLowerCase()))) {
    return 100;
  }

  // 엔티티 타입에 따른 기본 점수
  if (entityType === 'trigger') return 70;
  if (entityType === 'concept') return 60;
  if (entityType === 'company' || entityType === 'organization') return 50;

  return 30;
}

function getKoreanTranslation(keyword) {
  const translations = {
    'China': '중국', 'Russia': '러시아', 'Ukraine': '우크라이나', 'Iran': '이란',
    'Israel': '이스라엘', 'Taiwan': '대만', 'Japan': '일본', 'Korea': '한국',
    'Germany': '독일', 'France': '프랑스', 'UK': '영국', 'US': '미국',
    'EU': 'EU', 'Europe': '유럽', 'NATO': '나토',
    'Trump': '트럼프', 'Biden': '바이든', 'Putin': '푸틴', 'Xi': '시진핑',
    'Musk': '머스크', 'Powell': '파월',
    'Tesla': '테슬라', 'Hyundai': '현대', 'Kia': '기아', 'Toyota': '토요타',
    'GM': 'GM', 'Ford': '포드', 'BYD': 'BYD', 'VW': '폭스바겐',
    'EV': '전기차', 'battery': '배터리', 'recall': '리콜', 'autonomous': '자율주행',
    'AI': 'AI', 'Nvidia': '엔비디아', 'semiconductor': '반도체', 'chip': '칩',
    'tariff': '관세', 'sanction': '제재', 'inflation': '인플레이션',
    'recession': '경기침체', 'GDP': 'GDP', 'interest rate': '금리',
    'Fed': '연준', 'Federal Reserve': '연준'
  };

  return translations[keyword] || null;
}

// 키워드 점수 업데이트
async function updateKeywordScores(supabase, extractedKeywords, category) {
  const updated = [];

  for (const kw of extractedKeywords) {
    // 기존 키워드 확인
    const { data: existing } = await supabase
      .from('search_keywords')
      .select('*')
      .eq('keyword', kw.keyword)
      .eq('category', kw.category)
      .single();

    if (existing) {
      // Anchor 타입은 점수만 업데이트
      if (existing.keyword_type === 'anchor') {
        await supabase
          .from('search_keywords')
          .update({
            frequency_score: kw.frequency_score,
            total_score: Math.max(existing.total_score, kw.total_score),
            last_seen_at: new Date().toISOString(),
            consecutive_low_days: 0
          })
          .eq('id', existing.id);
      } else {
        // Active/Watchlist는 점수 및 상태 업데이트
        const newTotalScore = Math.round((existing.total_score + kw.total_score) / 2);
        const newType = newTotalScore >= 70 ? 'active' : 'watchlist';

        await supabase
          .from('search_keywords')
          .update({
            frequency_score: kw.frequency_score,
            reliability_score: kw.reliability_score,
            domain_score: kw.domain_score,
            total_score: newTotalScore,
            keyword_type: newType,
            last_seen_at: new Date().toISOString(),
            consecutive_low_days: 0
          })
          .eq('id', existing.id);
      }
      updated.push(kw.keyword);
    } else {
      // 새 키워드 추가 (pending 상태로)
      const keywordType = kw.total_score >= 70 ? 'active' : 'watchlist';

      await supabase
        .from('search_keywords')
        .insert([{
          keyword: kw.keyword,
          keyword_ko: kw.keyword_ko,
          category: kw.category,
          status: 'pending',
          source: 'article_extraction',
          keyword_type: keywordType,
          entity_type: kw.entity_type,
          frequency_score: kw.frequency_score,
          reliability_score: kw.reliability_score,
          domain_score: kw.domain_score,
          total_score: kw.total_score,
          last_seen_at: new Date().toISOString()
        }]);
      updated.push(kw.keyword);
    }
  }

  return updated;
}

// 키워드 정리 (Decay)
async function cleanupKeywords(supabase) {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // 3일 이상 안 보인 active 키워드 → watchlist로 강등
  const { data: staleActive } = await supabase
    .from('search_keywords')
    .select('id')
    .eq('keyword_type', 'active')
    .neq('keyword_type', 'anchor')
    .lt('last_seen_at', threeDaysAgo.toISOString());

  if (staleActive?.length > 0) {
    await supabase
      .from('search_keywords')
      .update({
        keyword_type: 'watchlist',
        consecutive_low_days: supabase.raw('consecutive_low_days + 1')
      })
      .in('id', staleActive.map(k => k.id));
  }

  // 7일 이상 안 보인 watchlist 키워드 → 삭제 또는 rejected
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: veryStale } = await supabase
    .from('search_keywords')
    .select('id')
    .eq('keyword_type', 'watchlist')
    .lt('last_seen_at', sevenDaysAgo.toISOString());

  if (veryStale?.length > 0) {
    await supabase
      .from('search_keywords')
      .update({ status: 'rejected' })
      .in('id', veryStale.map(k => k.id));
  }

  return {
    demotedToWatchlist: staleActive?.length || 0,
    rejected: veryStale?.length || 0
  };
}
