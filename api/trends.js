// Google Trends를 활용한 트렌드 키워드 수집 API
// 참고: 공식 Google Trends API는 없어서 google-trends-api 패키지 또는 RSS 피드 사용

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // GET - 트렌드 키워드 수집 및 대기 중인 키워드 조회
    if (req.method === 'GET') {
      const { action } = req.query;

      // 대기 중인 키워드 조회
      if (action === 'pending') {
        const { data, error } = await supabase
          .from('search_keywords')
          .select('*')
          .eq('status', 'pending')
          .order('trend_score', { ascending: false });

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true, keywords: data });
      }

      // 승인된 키워드 조회 (카테고리별)
      if (action === 'approved') {
        const { category } = req.query;

        let query = supabase
          .from('search_keywords')
          .select('*')
          .eq('status', 'approved');

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query.order('keyword');

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true, keywords: data });
      }

      // 트렌드 키워드 수집 (Google Trends RSS 피드 활용)
      if (action === 'fetch') {
        const trendKeywords = await fetchGoogleTrends();

        // 카테고리 분류 및 DB 저장
        const categorizedKeywords = categorizeKeywords(trendKeywords);

        for (const kw of categorizedKeywords) {
          // 이미 존재하는 키워드인지 확인
          const { data: existing } = await supabase
            .from('search_keywords')
            .select('id')
            .eq('keyword', kw.keyword)
            .eq('category', kw.category)
            .single();

          if (!existing) {
            await supabase
              .from('search_keywords')
              .insert([{
                keyword: kw.keyword,
                keyword_ko: kw.keyword_ko,
                category: kw.category,
                status: 'pending',
                source: 'google_trends',
                trend_score: kw.trend_score
              }]);
          }
        }

        return res.status(200).json({
          success: true,
          message: `${categorizedKeywords.length} new keywords processed`,
          keywords: categorizedKeywords
        });
      }

      // 모든 키워드 조회 (관리용)
      const { data, error } = await supabase
        .from('search_keywords')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, keywords: data });
    }

    // POST - 키워드 승인/거부
    if (req.method === 'POST') {
      const { id, action, keyword, keyword_ko, category } = req.body;

      // 수동 키워드 추가
      if (action === 'add') {
        const { data, error } = await supabase
          .from('search_keywords')
          .insert([{
            keyword,
            keyword_ko,
            category,
            status: 'pending',
            source: 'manual'
          }])
          .select();

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true, keyword: data[0] });
      }

      // 키워드 승인
      if (action === 'approve') {
        const { data, error } = await supabase
          .from('search_keywords')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', id)
          .select();

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true, keyword: data[0] });
      }

      // 키워드 거부
      if (action === 'reject') {
        const { data, error } = await supabase
          .from('search_keywords')
          .update({ status: 'rejected' })
          .eq('id', id)
          .select();

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true, keyword: data[0] });
      }

      // 키워드 삭제
      if (action === 'delete') {
        const { error } = await supabase
          .from('search_keywords')
          .delete()
          .eq('id', id);

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(200).json({ success: true });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in trends API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Google Trends RSS 피드에서 트렌드 키워드 수집
async function fetchGoogleTrends() {
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser();

  const keywords = [];

  try {
    // Google Trends Daily Trends RSS (미국)
    const usUrl = 'https://trends.google.com/trending/rss?geo=US';
    const usFeed = await parser.parseURL(usUrl);

    usFeed.items.forEach((item, index) => {
      keywords.push({
        keyword: item.title,
        trend_score: 100 - index * 5, // 순위에 따른 점수
        region: 'US'
      });
    });
  } catch (e) {
    console.warn('Failed to fetch US trends:', e.message);
  }

  try {
    // Google Trends Daily Trends RSS (한국)
    const krUrl = 'https://trends.google.com/trending/rss?geo=KR';
    const krFeed = await parser.parseURL(krUrl);

    krFeed.items.forEach((item, index) => {
      keywords.push({
        keyword: item.title,
        keyword_ko: item.title,
        trend_score: 100 - index * 5,
        region: 'KR'
      });
    });
  } catch (e) {
    console.warn('Failed to fetch KR trends:', e.message);
  }

  return keywords;
}

// 키워드를 카테고리로 분류
function categorizeKeywords(keywords) {
  const categorized = [];

  // 카테고리별 키워드 패턴
  const patterns = {
    'geopolitics': [
      /china|chinese|russia|russian|ukraine|iran|israel|taiwan|trump|biden|nato|eu|europe|war|conflict|sanction|tariff|diplomacy|military|korea|japan|india|pakistan|syria|gaza|palestine|greenland|denmark/i
    ],
    'economy': [
      /fed|federal reserve|inflation|gdp|recession|unemployment|interest rate|stock|market|economy|finance|bank|treasury|bond|yield|jobs|employment|trade|debt|deficit/i
    ],
    'automotive': [
      /tesla|hyundai|kia|ford|gm|toyota|ev|electric vehicle|battery|byd|rivian|lucid|volkswagen|mercedes|bmw|audi|autonomous|self.driving|car|auto/i
    ],
    'ai-tech': [
      /ai|artificial intelligence|chatgpt|gpt|claude|gemini|openai|anthropic|google|microsoft|nvidia|robot|humanoid|autonomous|machine learning|deep learning|tech|semiconductor|chip/i
    ]
  };

  for (const kw of keywords) {
    for (const [category, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        if (regex.test(kw.keyword)) {
          categorized.push({
            ...kw,
            category
          });
          break;
        }
      }
    }
  }

  return categorized;
}
