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
    const { query, language = 'en', count = 20, timeRange = 'day', category } = req.query;

    // Supabase에서 승인된 키워드 가져오기
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    let searchQuery = query;

    // 카테고리가 있으면 DB에서 키워드 조회
    if (category && !query) {
      const { data: keywords } = await supabase
        .from('search_keywords')
        .select('keyword')
        .eq('category', category)
        .eq('status', 'approved');

      if (keywords && keywords.length > 0) {
        searchQuery = keywords.map(k => k.keyword).join(' OR ');
        console.log(`📚 Google News using DB keywords for ${category}: ${keywords.length} keywords`);
      } else {
        // DB에 키워드가 없으면 기본 키워드 사용
        const fallbackQueries = {
          'geopolitics': 'China Russia Ukraine Middle East Iran Israel Taiwan Trump EU Europe tariff sanctions',
          'economy': 'economy market Federal Reserve inflation GDP employment interest rate Treasury bond recession',
          'automotive': 'electric vehicle EV Tesla Hyundai Kia BYD Toyota Ford GM battery auto industry',
          'ai-tech': 'artificial intelligence AI ChatGPT self-driving autonomous robotics humanoid robot',
          'trade': 'FTA tariff trade agreement subsidy incentive export regulation import regulation trade policy WTO free trade protectionism anti-dumping'
        };
        searchQuery = fallbackQueries[category];
        console.log(`⚠️ Google News using fallback keywords for ${category}`);
      }
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Query or category parameter is required',
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

    if (timeRange === 'day') {
      // 하루 전: 2일 전 ~ 내일 (오늘 기사 포함을 위해 내일까지)
      fromDate.setDate(fromDate.getDate() - 2);
      toDate.setDate(toDate.getDate() + 1);
    } else if (timeRange === 'week') {
      // 일주일 전: 8일 전 ~ 3일 전 (하루 전과 중복되지 않게)
      fromDate.setDate(fromDate.getDate() - 8);
      toDate.setDate(toDate.getDate() - 3);
    } else {
      fromDate.setDate(fromDate.getDate() - 2); // 기본값 2일
      toDate.setDate(toDate.getDate() + 1);
    }

    // Google News RSS URL with date range (when:)
    // when:7d = 지난 7일, when:3d = 지난 3일 (UTC 시차 문제 대비 여유있게)
    const whenParam = timeRange === 'week' ? 'when:7d' : 'when:3d';
    const finalQuery = `${searchQuery} ${whenParam}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(finalQuery)}&hl=${language}&gl=US&ceid=US:en`;

    console.log(`🔍 Google News RSS Query: ${finalQuery}, timeRange: ${timeRange}`);

    const feed = await parser.parseURL(url);

    console.log(`✅ Google News RSS: ${feed.items.length} articles fetched`);

    // 디버깅: 모든 기사의 날짜 출력
    if (feed.items.length > 0) {
      const dateDistribution = {};
      feed.items.forEach(item => {
        const pubDate = new Date(item.pubDate);
        const dateStr = pubDate.toISOString().split('T')[0];
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      });
      console.log(`📊 Google News date distribution:`, JSON.stringify(dateDistribution));
      console.log(`📅 fromDate: ${fromDate.toISOString()}, toDate: ${toDate.toISOString()}`);
    }

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
