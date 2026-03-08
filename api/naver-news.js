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
      } else {
        // DB에 키워드가 없으면 기본 한국어 키워드 사용
        const fallbackQueries = {
          'geopolitics': '트럼프 국제 정치 중국 러시아 우크라이나 중동 이란 이스라엘 EU 유럽',
          'economy': '경제 시장 금융 연준 인플레이션 은행 GDP 고용 실업 금리 국채 채권',
          'automotive': '전기차 EV 테슬라 현대차 기아 자동차 배터리',
          'ai-tech': '인공지능 AI 챗GPT 자율주행 로봇 휴머노이드',
          'trade': 'FTA 관세 무역협정 보조금 인센티브 수출규제 수입규제 무역정책 자유무역 보호무역 반덤핑'
        };
        searchQuery = fallbackQueries[category];
        console.log(`⚠️ Naver News using fallback keywords for ${category}`);
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

      if (timeRange === 'week') {
        // 일주일 전: 8일 전 ~ 2일 전 (하루 전과 중복되지 않게)
        fromDate.setDate(fromDate.getDate() - 8);
        toDate.setDate(toDate.getDate() - 2);
      } else if (timeRange === '3day') {
        // 72시간 (월요일 주말 커버리지용)
        fromDate.setHours(fromDate.getHours() - 72);
      } else {
        // day 또는 기본값: 24시간
        fromDate.setHours(fromDate.getHours() - 24);
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
