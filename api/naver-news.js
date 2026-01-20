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
    const { query, display = 10, timeRange = 'day', category } = req.query;

    // Supabase에서 승인된 키워드 가져오기
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    let searchQuery = query;

    // 카테고리가 있으면 DB에서 한국어 키워드 조회
    if (category && !query) {
      const { data: keywords } = await supabase
        .from('search_keywords')
        .select('keyword_ko')
        .eq('category', category)
        .eq('status', 'approved')
        .not('keyword_ko', 'is', null);

      if (keywords && keywords.length > 0) {
        searchQuery = keywords.map(k => k.keyword_ko).join(' ');
        console.log(`📚 Naver News using DB keywords for ${category}: ${keywords.length} keywords`);
      }
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Query or category parameter is required',
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

    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(searchQuery)}&display=${display}&sort=date`;

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': naverClientId,
        'X-Naver-Client-Secret': naverClientSecret
      }
    });

    const data = await response.json();

    if (data.items) {
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

      // 날짜 필터링
      const filteredItems = data.items.filter(item => {
        const pubDate = new Date(item.pubDate);
        return pubDate >= fromDate && pubDate <= toDate;
      });

      console.log(`📅 Naver News filtered: ${filteredItems.length} (from ${data.items.length}), timeRange: ${timeRange}`);

      const articles = filteredItems.map(item => ({
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
