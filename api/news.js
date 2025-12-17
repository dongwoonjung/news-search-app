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
    const { category, timeRange } = req.query;

    // 카테고리별 검색어 매핑
    const categoryQueries = {
      'geopolitics': 'politics OR trade OR diplomacy OR international OR war OR sanctions OR security',
      'economy': 'economy OR market OR business OR stock OR Federal Reserve OR inflation OR finance OR banking',
      'automotive': 'car OR vehicle OR automotive OR electric OR Tesla OR GM OR Ford OR Toyota OR Hyundai',
      'ai-tech': 'AI OR artificial intelligence OR autonomous OR self-driving OR technology OR innovation OR chip OR semiconductor'
    };

    const query = categoryQueries[category] || 'technology';

    // 날짜 계산
    const now = new Date();
    const from = new Date(now);
    if (timeRange === 'day') {
      from.setDate(from.getDate() - 3);
    } else {
      from.setDate(from.getDate() - 14);
    }

    // 지정된 뉴스 소스
    const TRUSTED_SOURCES = [
      'nytimes.com',
      'washingtonpost.com',
      'bloomberg.com',
      'economist.com',
      'autonews.com',
      'reuters.com',
      'ft.com',
      'bbc.com',
      'bbc.co.uk',
      'cnn.com'
    ];

    const domains = TRUSTED_SOURCES.join(',');

    const queryParams = new URLSearchParams({
      apiKey: process.env.VITE_NEWS_API_KEY,
      q: query,
      domains: domains,
      language: 'en',
      sortBy: 'publishedAt',
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
      pageSize: 100
    });

    const response = await fetch(`https://newsapi.org/v2/everything?${queryParams}`);
    const data = await response.json();

    if (data.status === 'ok') {
      const targetCount = timeRange === 'day' ? 10 : 20;

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
