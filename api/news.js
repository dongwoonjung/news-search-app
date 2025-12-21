export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { category, timeRange, company } = req.query;

    // 회사별 검색어가 있으면 우선 사용
    let query;
    if (company) {
      query = company;
    } else {
      // 카테고리별 검색어 매핑
      const categoryQueries = {
        'geopolitics': '(China OR Russia OR Ukraine OR "Middle East" OR Iran OR Israel OR Taiwan OR "South China Sea" OR NATO OR "North Korea" OR Syria OR Yemen OR Venezuela OR "Latin America") AND (conflict OR war OR sanctions OR diplomacy OR tensions OR dispute OR crisis OR military OR geopolitical OR strategic)',
        'economy': 'economy OR market OR business OR stock OR Federal Reserve OR inflation OR finance OR banking',
        'automotive': 'Toyota OR Honda OR Ford OR GM OR Tesla OR Volkswagen OR Hyundai OR Kia OR BMW OR Mercedes OR Nissan OR "electric vehicle" OR EV OR "car sales" OR automotive OR automaker OR vehicle',
        'ai-tech': 'AI OR "artificial intelligence" OR GPT OR "ChatGPT" OR "Claude AI" OR Gemini OR "Google Gemini" OR "self-driving" OR autonomous OR robotics OR "humanoid robot" OR humanoid OR Tesla OR Waymo OR "machine learning" OR automation OR robot'
      };
      query = categoryQueries[category] || 'technology';
    }

    // 날짜 계산
    const now = new Date();
    const from = new Date(now);
    if (timeRange === 'day') {
      from.setDate(from.getDate() - 1); // 당일과 하루 전 (총 2일)
    } else {
      from.setDate(from.getDate() - 7); // 일주일 전
    }

    // 지정된 뉴스 소스
    const TRUSTED_SOURCES = [
      'nytimes.com',
      'washingtonpost.com',
      'bloomberg.com',
      'economist.com',
      'reuters.com',
      'ft.com',
      'bbc.com',
      'bbc.co.uk',
      'cnn.com'
    ];

    // 자동차 전문 뉴스 소스
    const AUTO_SOURCES = [
      'autonews.com',
      'reuters.com',
      'bloomberg.com',
      'ft.com',
      'wsj.com',
      'nytimes.com',
      'economist.com'
    ];

    const queryParams = new URLSearchParams({
      apiKey: process.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY,
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
      pageSize: 100
    });

    // 도메인 제한 적용 (자동차/AI-자율주행/회사 검색이 아닐 때만)
    if (!company && category !== 'automotive' && category !== 'ai-tech') {
      const domains = TRUSTED_SOURCES.join(',');
      queryParams.set('domains', domains);
    }

    const response = await fetch(`https://newsapi.org/v2/everything?${queryParams}`);
    const data = await response.json();

    if (data.status === 'ok') {
      const targetCount = timeRange === 'day' ? 10 : 20;

      // 디버깅: 가져온 기사들의 소스 출력
      if (company || category === 'automotive') {
        const sources = [...new Set(data.articles.map(a => a.source.name))];
        console.log(`📰 Fetched ${data.articles.length} articles from sources:`, sources.join(', '));
      }

      // 소스별로 그룹화
      const articlesBySource = {};
      data.articles.forEach(article => {
        const sourceName = article.source.name;
        if (!articlesBySource[sourceName]) {
          articlesBySource[sourceName] = [];
        }
        articlesBySource[sourceName].push(article);
      });

      // 각 소스에서 균등하게 가져오기
      const selectedArticles = [];
      const sources = Object.keys(articlesBySource);
      let sourceIndex = 0;

      while (selectedArticles.length < targetCount && sources.length > 0) {
        const source = sources[sourceIndex % sources.length];
        if (articlesBySource[source] && articlesBySource[source].length > 0) {
          selectedArticles.push(articlesBySource[source].shift());
        } else {
          sources.splice(sourceIndex % sources.length, 1);
          continue;
        }
        sourceIndex++;
      }

      res.status(200).json({
        success: true,
        articles: selectedArticles
      });
    } else {
      res.status(500).json({
        success: false,
        error: data.message || 'Failed to fetch news',
        articles: []
      });
    }
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
