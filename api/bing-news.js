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
    const { query, count = 10, freshness = 'Day' } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        articles: []
      });
    }

    const bingApiKey = process.env.BING_NEWS_API_KEY;

    if (!bingApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Bing News API key not configured',
        articles: []
      });
    }

    const url = `https://api.bing.microsoft.com/v7.0/news/search?q=${encodeURIComponent(query)}&count=${count}&freshness=${freshness}&mkt=en-US`;

    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': bingApiKey
      }
    });

    const data = await response.json();

    if (data.value) {
      const articles = data.value.map(item => ({
        title: item.name,
        summary: item.description || '',
        date: new Date(item.datePublished).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        source: item.provider?.[0]?.name || 'Bing News',
        url: item.url,
        publishedAt: item.datePublished
      }));

      res.status(200).json({
        success: true,
        articles: articles
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Bing news',
        articles: []
      });
    }
  } catch (error) {
    console.error('Error fetching Bing news:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
