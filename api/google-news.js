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

    // 카테고리별 서브토픽 쿼리 (토픽 다양성 확보)
    // 하나의 큰 쿼리 대신 여러 서브토픽을 병렬 검색하여 특정 이슈 독점 방지
    const subTopicQueries = {
      'geopolitics': [
        'Iran Israel Middle East war strike military',
        'China Taiwan semiconductor trade tensions',
        'Russia Ukraine NATO Europe war',
        'Europe EU Germany France politics economy',
        'Trump tariffs sanctions trade policy'
      ],
      'economy': [
        'Federal Reserve interest rate inflation monetary policy',
        'US economy GDP recession jobs employment',
        'Stock market Wall Street financial markets',
        'Banking credit debt Treasury bond yield'
      ],
      'automotive': [
        'electric vehicle EV battery technology',
        'Tesla Hyundai Kia BYD auto sales',
        'auto industry manufacturing supply chain',
        'autonomous driving self-driving technology'
      ],
      'ai-tech': [
        'artificial intelligence AI OpenAI Google model',
        'self-driving autonomous vehicle robotics',
        'semiconductor chip Nvidia technology industry',
        'humanoid robot AI startup innovation'
      ],
      'trade': [
        'tariff import duty trade war protectionism',
        'FTA trade agreement WTO subsidy',
        'export control semiconductor technology restriction',
        'supply chain reshoring manufacturing trade policy'
      ]
    };

    const whenParam = timeRange === 'week' ? 'when:7d' : 'when:1d';

    // 날짜 범위 계산
    const now = new Date();
    const toDate = new Date(now);
    const fromDate = new Date(now);

    if (timeRange === 'day') {
      fromDate.setHours(fromDate.getHours() - 24);
    } else if (timeRange === 'week') {
      fromDate.setDate(fromDate.getDate() - 8);
      toDate.setDate(toDate.getDate() - 2);
    } else {
      fromDate.setHours(fromDate.getHours() - 24);
    }

    const parser = new Parser({
      customFields: {
        item: ['source']
      }
    });

    // RSS 피드 파싱 헬퍼
    const fetchFeed = async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' ' + whenParam)}&hl=${language}&gl=US&ceid=US:en`;
      const feed = await parser.parseURL(url);
      return feed.items.filter(item => {
        const pubDate = new Date(item.pubDate);
        return pubDate >= fromDate && pubDate <= toDate;
      });
    };

    let allItems = [];

    // 카테고리 서브토픽 검색 (병렬)
    if (category && !query && subTopicQueries[category]) {
      const queries = subTopicQueries[category];
      const perQuery = Math.ceil(parseInt(count) / queries.length) + 1;

      console.log(`🔍 Google News multi-query for ${category}: ${queries.length} sub-topics`);

      const results = await Promise.allSettled(queries.map(q => fetchFeed(q)));

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const items = result.value.slice(0, perQuery);
          allItems.push(...items);
          console.log(`  ✅ Sub-topic ${i + 1}: ${items.length} articles`);
        }
      });

    } else {
      // 단일 쿼리 (직접 query 파라미터 or DB 키워드)
      let searchQuery = query;

      if (category && !query) {
        const { data: keywords } = await supabase
          .from('search_keywords')
          .select('keyword')
          .eq('category', category)
          .eq('status', 'approved');

        if (keywords && keywords.length > 0) {
          searchQuery = keywords.map(k => k.keyword).join(' OR ');
          console.log(`📚 Google News using DB keywords for ${category}: ${keywords.length} keywords`);
        }
      }

      if (!searchQuery) {
        return res.status(400).json({ success: false, error: 'Query or category parameter is required', articles: [] });
      }

      console.log(`🔍 Google News single query: ${searchQuery}`);
      allItems = await fetchFeed(searchQuery);
    }

    // URL 기준 중복 제거
    const seenUrls = new Set();
    const deduped = allItems.filter(item => {
      if (seenUrls.has(item.link)) return false;
      seenUrls.add(item.link);
      return true;
    });

    // 최신순 정렬
    deduped.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    console.log(`✅ Google News: ${allItems.length} raw → ${deduped.length} after dedup`);

    const filteredItems = deduped.slice(0, parseInt(count) * 2); // dedupe API에서 추가 필터링하므로 여유분 전달

    const articles = filteredItems.map(item => {
      // rss-parser는 <source url="...">Name</source>를 다양한 구조로 파싱
      // 1순위: item.source._ (속성+텍스트 구조)
      // 2순위: item.source._text (대안 구조)
      // 3순위: string 직접값
      // 4순위: 제목에서 " - SourceName" 패턴 추출
      let sourceName =
        item.source?._ ||
        item.source?._text ||
        (typeof item.source === 'string' ? item.source : null);

      // 제목 끝의 " - SourceName" 패턴에서 출처 추출
      let cleanTitle = item.title || '';
      if (!sourceName) {
        const titleMatch = cleanTitle.match(/\s+-\s+([^-]{2,50})$/);
        if (titleMatch) sourceName = titleMatch[1].trim();
      }
      // 제목에서 출처 suffix 제거 (출처를 추출했다면)
      if (sourceName && cleanTitle.endsWith(` - ${sourceName}`)) {
        cleanTitle = cleanTitle.slice(0, -(` - ${sourceName}`).length).trim();
      }

      return {
        title: cleanTitle,
        summary: item.contentSnippet || item.content || '',
        date: new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        source: sourceName || 'Google News',
        url: item.link,
        publishedAt: item.pubDate
      };
    });

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
