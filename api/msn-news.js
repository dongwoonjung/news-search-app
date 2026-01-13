import Parser from 'rss-parser';

// Bing News RSS API - 실시간 뉴스 제공
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { category = 'news', count = 20 } = req.query;

    const parser = new Parser({
      customFields: {
        item: [
          ['News:Source', 'newsSource'],
          ['News:Image', 'newsImage']
        ]
      }
    });

    // 카테고리별 Bing News 검색어 매핑
    const categoryQueries = {
      'news': 'breaking news today',
      'world': 'world news international',
      'us': 'US news America',
      'politics': 'politics government',
      'technology': 'technology AI tech',
      'business': 'business finance economy',
      'automotive': 'electric vehicle EV Tesla Hyundai automotive',
      'science': 'science research discovery'
    };

    const query = categoryQueries[category] || categoryQueries['news'];

    // Bing News RSS URL (영어 뉴스)
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=en-US`;

    console.log(`🔍 Bing News RSS: category=${category}, query=${query}`);

    const feed = await parser.parseURL(url);

    console.log(`✅ Bing News RSS: ${feed.items.length} articles fetched`);

    // 날짜 분포 확인
    if (feed.items.length > 0) {
      const dateDistribution = {};
      feed.items.forEach(item => {
        const pubDate = new Date(item.pubDate || item.isoDate);
        const dateStr = pubDate.toISOString().split('T')[0];
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      });
      console.log(`📊 Bing News date distribution:`, JSON.stringify(dateDistribution));
    }

    const articles = feed.items.slice(0, parseInt(count)).map(item => {
      const pubDate = new Date(item.pubDate || item.isoDate);

      return {
        title: item.title,
        summary: item.contentSnippet || item.content || item.description || '',
        date: pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        source: item.newsSource || 'Bing News',
        url: item.link,
        publishedAt: pubDate.toISOString(),
        image: item.newsImage || null
      };
    });

    res.status(200).json({
      success: true,
      articles: articles
    });
  } catch (error) {
    console.error('Error fetching Bing News:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
