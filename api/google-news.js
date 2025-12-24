import Parser from 'rss-parser';

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
    const { query, language = 'en', count = 20 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        articles: []
      });
    }

    const parser = new Parser({
      customFields: {
        item: ['source']
      }
    });

    // Google News RSS URL
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${language}&gl=US&ceid=US:en`;

    console.log(`🔍 Google News RSS Query: ${query}`);

    const feed = await parser.parseURL(url);

    console.log(`✅ Google News RSS: ${feed.items.length} articles fetched`);

    const articles = feed.items.slice(0, parseInt(count)).map(item => ({
      title: item.title,
      summary: item.contentSnippet || item.content || '',
      date: new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      source: item.source?._text || 'Google News',
      url: item.link,
      publishedAt: item.pubDate
    }));

    res.status(200).json({
      success: true,
      articles: articles
    });
  } catch (error) {
    console.error('Error fetching Google News:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
