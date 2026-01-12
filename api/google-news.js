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
    const { query, language = 'en', count = 20, timeRange = 'day' } = req.query;

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

    // 날짜 범위 계산
    const now = new Date();
    const toDate = new Date(now);
    const fromDate = new Date(now);

    // UTC 시차 문제 해결: toDate를 내일로 설정
    toDate.setDate(toDate.getDate() + 1);

    if (timeRange === 'day') {
      fromDate.setDate(fromDate.getDate() - 2); // 최근 2일
    } else if (timeRange === 'week') {
      fromDate.setDate(fromDate.getDate() - 7); // 최근 7일
    } else {
      fromDate.setDate(fromDate.getDate() - 2); // 기본값 2일
    }

    // Google News RSS URL with date range (when:)
    // when:7d = 지난 7일, when:1d = 지난 1일
    const whenParam = timeRange === 'week' ? 'when:7d' : 'when:2d';
    const searchQuery = `${query} ${whenParam}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=${language}&gl=US&ceid=US:en`;

    console.log(`🔍 Google News RSS Query: ${searchQuery}, timeRange: ${timeRange}`);

    const feed = await parser.parseURL(url);

    console.log(`✅ Google News RSS: ${feed.items.length} articles fetched`);

    // 날짜 필터링 (추가 안전장치) - toDate를 사용하여 UTC 시차 문제 해결
    const filteredItems = feed.items.filter(item => {
      const pubDate = new Date(item.pubDate);
      return pubDate >= fromDate && pubDate <= toDate;
    });

    console.log(`📅 Filtered articles by date: ${filteredItems.length} (from ${feed.items.length})`);

    const articles = filteredItems.slice(0, parseInt(count)).map(item => ({
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
