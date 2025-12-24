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
    const { query, display = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        articles: []
      });
    }

    const naverClientId = process.env.NAVER_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!naverClientId || !naverClientSecret) {
      return res.status(500).json({
        success: false,
        error: 'Naver API credentials not configured',
        articles: []
      });
    }

    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': naverClientId,
        'X-Naver-Client-Secret': naverClientSecret
      }
    });

    const data = await response.json();

    if (data.items) {
      const articles = data.items.map(item => ({
        title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        summary: item.description.replace(/<[^>]*>/g, ''),
        date: new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        source: '네이버 뉴스',
        url: item.link,
        publishedAt: item.pubDate
      }));

      res.status(200).json({
        success: true,
        articles: articles
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Naver news',
        articles: []
      });
    }
  } catch (error) {
    console.error('Error fetching Naver news:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
