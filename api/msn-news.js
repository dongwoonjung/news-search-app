import Parser from 'rss-parser';

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
        item: ['media:content', 'media:thumbnail']
      }
    });

    // MSN News RSS 카테고리별 URL
    // MSN은 지역별로 RSS를 제공함 (en-us = 미국 영어)
    const categoryUrls = {
      'news': 'https://rss.msn.com/en-us/',
      'world': 'https://rss.msn.com/en-us/news/world',
      'us': 'https://rss.msn.com/en-us/news/us',
      'politics': 'https://rss.msn.com/en-us/news/politics',
      'technology': 'https://rss.msn.com/en-us/news/technology',
      'business': 'https://rss.msn.com/en-us/news/money',
      'automotive': 'https://rss.msn.com/en-us/autos',
      'science': 'https://rss.msn.com/en-us/news/science'
    };

    const url = categoryUrls[category] || categoryUrls['news'];

    console.log(`🔍 MSN News RSS: category=${category}, url=${url}`);

    const feed = await parser.parseURL(url);

    console.log(`✅ MSN News RSS: ${feed.items.length} articles fetched`);

    // 날짜 분포 확인
    if (feed.items.length > 0) {
      const dateDistribution = {};
      feed.items.forEach(item => {
        const pubDate = new Date(item.pubDate || item.isoDate);
        const dateStr = pubDate.toISOString().split('T')[0];
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      });
      console.log(`📊 MSN News date distribution:`, JSON.stringify(dateDistribution));
    }

    const articles = feed.items.slice(0, parseInt(count)).map(item => {
      const pubDate = new Date(item.pubDate || item.isoDate);

      return {
        title: item.title,
        summary: item.contentSnippet || item.content || '',
        date: pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        source: 'MSN News',
        url: item.link,
        publishedAt: pubDate.toISOString(),
        image: item['media:content']?.['$']?.url || item['media:thumbnail']?.['$']?.url || null
      };
    });

    res.status(200).json({
      success: true,
      articles: articles
    });
  } catch (error) {
    console.error('Error fetching MSN News:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
