const BASE_URL = 'https://newsapp-sable-two.vercel.app';

const CATEGORIES = ['geopolitics', 'economy', 'trade', 'automotive', 'ai-tech'];
const CATEGORY_NAMES = {
  geopolitics: '글로벌 지정학',
  economy: '글로벌 경제',
  trade: '무역',
  automotive: '자동차 산업',
  'ai-tech': 'AI/기술',
};

const AUTO_COMPANIES = [
  { id: 'hyundai', name: '현대자동차', keywords: 'Hyundai Motor' },
  { id: 'kia', name: '기아', keywords: 'Kia Motors' },
  { id: 'tesla', name: '테슬라', keywords: 'Tesla' },
  { id: 'toyota', name: '도요타', keywords: 'Toyota Motor' },
  { id: 'byd', name: 'BYD', keywords: 'BYD electric vehicle' },
  { id: 'gm', name: 'GM', keywords: 'General Motors' },
];

function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal })
    .then(r => { clearTimeout(id); return r.ok ? r.json() : null; })
    .catch(() => { clearTimeout(id); return null; });
}

async function fetchCategoryNews(category) {
  try {
    const [newsApi, googleNews, naverNews, msnNews] = await Promise.allSettled([
      fetchWithTimeout(`${BASE_URL}/api/news?category=${category}&timeRange=day`),
      fetchWithTimeout(`${BASE_URL}/api/google-news?category=${category}&language=en&timeRange=day&count=15`),
      fetchWithTimeout(`${BASE_URL}/api/naver-news?category=${category}&display=15&timeRange=day`),
      fetchWithTimeout(`${BASE_URL}/api/msn-news?category=${category}&count=10&timeRange=day`),
    ]);

    const articles = [];
    const seen = new Set();
    for (const result of [newsApi, googleNews, naverNews, msnNews]) {
      if (result.status === 'fulfilled' && result.value?.articles) {
        for (const a of result.value.articles) {
          const key = a.title?.slice(0, 40);
          if (key && !seen.has(key)) {
            seen.add(key);
            articles.push(a);
          }
        }
      }
    }
    return articles;
  } catch {
    return [];
  }
}

async function fetchCompanyNews(company) {
  try {
    const data = await fetchWithTimeout(
      `${BASE_URL}/api/google-news?query=${encodeURIComponent(company.keywords)}&language=en&timeRange=day&count=10`
    );
    return data?.articles || [];
  } catch {
    return [];
  }
}

function formatArticles(articles, limit = 6) {
  return articles.slice(0, limit).map((a, i) => {
    const source = a.source?.name || a.sourceName || '';
    const desc = (a.description || a.summary || '').slice(0, 80);
    const url = a.url || '';
    return `${i + 1}. [${a.title}]${source ? ` (${source})` : ''}${desc ? ` — ${desc}` : ''}${url ? `\n   URL: ${url}` : ''}`;
  }).join('\n');
}

function buildPrompt(today, newsContext, companyContext) {
  return `오늘(${today}) 수집된 글로벌 뉴스를 분석해 현대자동차 비즈니스 리스크 관리팀용 데일리 브리핑을 아래 형식에 맞게 작성해주세요.

━━━ 수집된 뉴스 기사 ━━━
${newsContext}
${companyContext}
━━━━━━━━━━━━━━━━━━━━━━

아래 형식을 정확히 따라 작성하세요:

# 글로벌 주요뉴스 브리핑 ${today}
현대자동차 비즈니스 리스크 관리팀
무역 · 지정학 · 자동차 산업 동향

## 1. 무역 주요 뉴스
[수집된 무역 뉴스 중 중요한 것 5~7개를 ① ② ③ 형식으로 작성]
[각 항목 형식 — 아래 구조를 반드시 준수:
  3~4문장 기사 분석. (출처명) [원문링크](URL)

  -> 현대차는 [시사점. 현대차와 무관하면 생략]
]

[섹션 말미 필수 표]
무역 리스크 요약
| 이슈 | 리스크 수준 | 영향 분야 |
|------|------------|---------|
[이슈별 한 줄씩]

## 2. 지정학 주요 뉴스
[수집된 지정학 뉴스 중 중요한 것 5~7개를 ① ② ③ 형식으로 작성]
[각 항목 형식 — 아래 구조를 반드시 준수:
  3~4문장 기사 분석. (출처명) [원문링크](URL)

  -> 현대차는 [시사점. 현대차와 무관하면 생략]
]

[섹션 말미 필수 표]
지정학 리스크 요약
| 이슈 | 리스크 수준 | 영향 분야 |
|------|------------|---------|
[이슈별 한 줄씩]

## 3. 자동차 산업 주요 뉴스

### 3-1. 산업 전반 트렌드
[전기차, 하이브리드, 배터리, 정책, 가격 경쟁 등 업계 트렌드 4~5개를 ① ② ③ 형식으로 작성]
[각 항목: 3~4문장 분석. (출처명) [원문링크](URL)]

### 3-2. OEM별 핵심 뉴스
[수집된 회사별 뉴스를 아래 형식의 마크다운 표로 정리. 뉴스가 있는 회사만 포함]

🔵 현대자동차
| 이슈 | 내용 |
|------|------|
[이슈별 한 줄씩, 내용 칸에 핵심 사실 + 출처]

🔵 기아
| 이슈 | 내용 |
|------|------|

🔴 테슬라
| 이슈 | 내용 |
|------|------|

🟢 도요타
| 이슈 | 내용 |
|------|------|

🔷 BYD
| 이슈 | 내용 |
|------|------|

🔶 GM
| 이슈 | 내용 |
|------|------|

## 4. 현대차 그룹 핵심 시사점
[즉각적 대응 필요 / 경쟁 기회 / 중장기 전략 / 리스크 시나리오 순으로 자연스럽게 연결해 서술]
[각 시사점은 구체적 수치·근거와 함께 2~3문장으로]

— END OF REPORT —`;
}

// Phase 1: 뉴스 수집 → Supabase 캐시 저장 (5~10초)
async function handleFetch(res) {
  try {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });

    console.log('📰 뉴스 수집 중 (카테고리 + OEM 병렬)...');
    const [categoryResults, companyResults] = await Promise.all([
      Promise.all(CATEGORIES.map(cat => fetchCategoryNews(cat))),
      Promise.all(AUTO_COMPANIES.map(company => fetchCompanyNews(company))),
    ]);

    const newsData = {};
    CATEGORIES.forEach((cat, i) => { newsData[cat] = categoryResults[i]; });
    const companyNews = {};
    AUTO_COMPANIES.forEach((company, i) => { companyNews[company.id] = companyResults[i]; });

    const totalArticles = Object.values(newsData).reduce((s, a) => s + a.length, 0)
      + Object.values(companyNews).reduce((s, a) => s + a.length, 0);

    if (totalArticles === 0) {
      return res.status(500).json({ success: false, error: '수집된 뉴스가 없습니다.' });
    }

    let newsContext = '';
    for (const cat of CATEGORIES) {
      const articles = newsData[cat];
      if (articles.length === 0) continue;
      newsContext += `\n\n## [${CATEGORY_NAMES[cat]}] (${articles.length}개 기사)\n`;
      newsContext += formatArticles(articles, 6);
    }

    let companyContext = '\n\n## [자동차 OEM 회사별 동향]\n';
    for (const company of AUTO_COMPANIES) {
      const articles = companyNews[company.id];
      if (articles.length === 0) continue;
      companyContext += `\n### ${company.name}\n`;
      companyContext += formatArticles(articles, 3);
    }

    console.log('💾 뉴스 캐시 저장 중...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    await supabase.from('reports').delete().eq('category', 'news_cache');

    const { error } = await supabase.from('reports').insert([{
      title: `${today} 뉴스 캐시`,
      content: JSON.stringify({ newsContext, companyContext, today }),
      category: 'news_cache',
      filename: null,
      file_url: null,
      created_at: new Date().toISOString(),
    }]);

    if (error) throw error;

    console.log(`✅ 뉴스 수집 완료 (${totalArticles}개 기사 캐시됨)`);
    return res.status(200).json({ success: true, articlesCollected: totalArticles });
  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Phase 2: 캐시 읽기 → Claude 호출 → 리포트 저장 (45~55초)
async function handleGenerate(res) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const { data: cache, error: cacheError } = await supabase
      .from('reports')
      .select('content')
      .eq('category', 'news_cache')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cacheError || !cache) {
      return res.status(400).json({ success: false, error: '캐시된 뉴스가 없습니다. 먼저 ?action=fetch를 실행하세요.' });
    }

    const { newsContext, companyContext, today } = JSON.parse(cache.content);

    console.log('✍️ Claude Sonnet으로 리포트 작성 중...');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4500,
      system: `당신은 현대자동차 비즈니스 리스크 관리팀 전담 글로벌 시장 인텔리전스 애널리스트입니다. 수집된 뉴스를 현대차·기아 비즈니스 관점에서 분석해 경영진이 즉시 활용할 수 있는 브리핑을 작성합니다.

[필수 형식 규칙 — 반드시 준수]
① 각 뉴스 항목의 구조는 다음 순서를 반드시 지킬 것:
   [기사 분석 3~4문장] (출처명) [원문링크](URL)
   (빈 줄)
   -> 현대차는 [시사점 1~2문장]
   ※ 출처와 원문링크는 기사 분석 바로 뒤, 현대차 시사점보다 반드시 먼저 표기
   ※ 현대차와 무관한 이슈는 시사점 줄 생략 가능
② 출처 표기: (출처명) 형식. 복수 출처는 (출처1 / 출처2)
③ 원문링크: URL이 제공된 경우 출처 바로 뒤에 [원문링크](URL) 형식으로 반드시 삽입. URL이 없으면 생략
④ 현대차 시사점: "-> 현대차는"으로 시작하는 완전한 문장 1~2개. 반드시 빈 줄로 기사 본문과 분리
⑤ 리스크 요약 표: 무역·지정학 섹션 말미에 필수
   - 형식: | 이슈 | 리스크 수준 | 영향 분야 |
   - 리스크 수준: 🔴 높음 / 🟠 중간 / 🟡 주시
⑥ OEM 뉴스 표: 3-2 섹션에서 회사별 마크다운 표 필수. 형식: | 이슈 | 내용 |
⑦ 항목 번호: ① ② ③ ④ ⑤ 형식 사용
⑧ 수치·날짜·기업명·인물명 반드시 포함
⑨ 단순 사실 나열 금지 — "왜 중요한가", "무엇을 의미하는가" 위주로 서술`,
      messages: [{
        role: 'user',
        content: buildPrompt(today, newsContext, companyContext),
      }],
    });

    const reportContent = message.content[0].text;
    const title = `${today} 글로벌 뉴스 데일리 브리핑`;

    const { data, error } = await supabase
      .from('reports')
      .insert([{
        title,
        content: reportContent,
        category: 'daily',
        filename: null,
        file_url: null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    await supabase.from('reports').delete().eq('category', 'news_cache');

    console.log(`✅ 데일리 리포트 저장 완료 (ID: ${data.id})`);
    return res.status(200).json({
      success: true,
      message: '데일리 리포트가 생성되어 저장되었습니다.',
      reportId: data.id,
      title,
    });
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  if (action === 'fetch') {
    return handleFetch(res);
  }

  return handleGenerate(res);
}
