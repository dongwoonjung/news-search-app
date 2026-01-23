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
    const { category = 'news', count = 20, timeRange = 'day' } = req.query;

    // Supabase에서 승인된 키워드 가져오기
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const parser = new Parser({
      customFields: {
        item: [
          ['News:Source', 'newsSource'],
          ['News:Image', 'newsImage']
        ]
      }
    });

    // MSN 카테고리를 앱 카테고리로 매핑
    const msnToAppCategory = {
      'world': 'geopolitics',
      'business': 'economy',
      'automotive': 'automotive',
      'technology': 'ai-tech',
      'trade': 'trade'
    };

    const appCategory = msnToAppCategory[category];
    let query;

    // DB에서 키워드 조회 시도
    if (appCategory) {
      const { data: keywords } = await supabase
        .from('search_keywords')
        .select('keyword')
        .eq('category', appCategory)
        .eq('status', 'approved');

      if (keywords && keywords.length > 0) {
        query = keywords.map(k => k.keyword).join(' ');
        console.log(`📚 MSN News using DB keywords for ${appCategory}: ${keywords.length} keywords`);
      }
    }

    // DB에 없으면 기본 키워드 사용
    if (!query) {
      const categoryQueries = {
        'news': 'breaking news today',
        'world': 'world international China Russia Ukraine Iran Israel EU Europe Greenland Denmark tariff sanctions Trump diplomacy conflict crisis',
        'us': 'US news America Trump policy',
        'politics': 'politics government Trump Biden policy tariff sanctions',
        'technology': 'technology AI tech artificial intelligence',
        'business': 'business finance economy market stock tariff trade GDP employment unemployment jobs interest rate Treasury bond yield recession growth',
        'automotive': 'electric vehicle EV Tesla Hyundai automotive',
        'science': 'science research discovery',
        'trade': 'FTA tariff trade agreement subsidy incentive export regulation import regulation trade policy WTO free trade protectionism anti-dumping trade war trade barrier'
      };
      query = categoryQueries[category] || categoryQueries['news'];
    }

    // Bing News RSS URL (영어 뉴스)
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=en-US`;

    console.log(`🔍 Bing News RSS: category=${category}, query=${query}`);

    const feed = await parser.parseURL(url);

    console.log(`✅ Bing News RSS: ${feed.items.length} articles fetched`);

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
      fromDate.setDate(fromDate.getDate() - 2);
      toDate.setDate(toDate.getDate() + 1);
    }

    // 날짜 분포 확인
    if (feed.items.length > 0) {
      const dateDistribution = {};
      feed.items.forEach(item => {
        const pubDate = new Date(item.pubDate || item.isoDate);
        const dateStr = pubDate.toISOString().split('T')[0];
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      });
      console.log(`📊 Bing News date distribution:`, JSON.stringify(dateDistribution));
      console.log(`📅 fromDate: ${fromDate.toISOString()}, toDate: ${toDate.toISOString()}`);
    }

    // 날짜 필터링
    const filteredItems = feed.items.filter(item => {
      const pubDate = new Date(item.pubDate || item.isoDate);
      return pubDate >= fromDate && pubDate <= toDate;
    });

    console.log(`📅 Filtered articles by date: ${filteredItems.length} (from ${feed.items.length})`);

    const articles = filteredItems.slice(0, parseInt(count)).map(item => {
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
