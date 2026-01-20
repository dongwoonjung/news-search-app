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
    const { category, timeRange, company } = req.query;

    // 회사별 검색어가 있으면 우선 사용
    let query;
    if (company) {
      query = company;
    } else {
      // 카테고리별 검색어 매핑
      const categoryQueries = {
        'geopolitics': '(China OR Russia OR Ukraine OR "Middle East" OR Iran OR Israel OR Taiwan OR "South China Sea" OR NATO OR "North Korea" OR Syria OR Yemen OR Venezuela OR "Latin America" OR Trump OR EU OR "European Union" OR Europe OR Greenland OR Denmark) AND (conflict OR war OR sanctions OR diplomacy OR tensions OR dispute OR crisis OR military OR geopolitical OR strategic OR tariff OR trade)',
        'economy': 'economy OR market OR business OR stock OR "Federal Reserve" OR inflation OR finance OR banking OR GDP OR employment OR unemployment OR jobs OR "interest rate" OR "rate cut" OR "rate hike" OR Treasury OR bond OR yield OR recession OR growth',
        'automotive': 'EV OR "electric vehicle" OR Tesla OR Hyundai OR Kia OR BYD OR Toyota OR Ford OR GM OR battery OR "auto industry" OR automaker OR "car sales" OR "autonomous driving" OR subsidy OR "carbon neutral"',
        'ai-tech': 'AI OR "artificial intelligence" OR GPT OR "ChatGPT" OR "Claude AI" OR Gemini OR "Google Gemini" OR "self-driving" OR autonomous OR robotics OR "humanoid robot" OR humanoid OR Tesla OR Waymo OR "machine learning" OR automation OR robot'
      };
      query = categoryQueries[category] || 'technology';
    }

    // 날짜 계산 (한국 시간 기준으로 처리)
    const now = new Date();
    const from = new Date(now);
    const to = new Date(now);

    // 참고: NewsAPI 무료 플랜은 기사 발행 후 24시간 딜레이가 있음
    // 그래서 오늘 발행된 기사는 내일부터 검색 가능
    if (timeRange === 'day') {
      // 하루 전: 2일 전 ~ 내일 (오늘 기사 포함을 위해 내일까지)
      from.setDate(from.getDate() - 2);
      to.setDate(to.getDate() + 1);
    } else {
      // 일주일 전: 8일 전 ~ 3일 전 (하루 전과 중복되지 않게)
      from.setDate(from.getDate() - 8);
      to.setDate(to.getDate() - 3);
    }

    console.log(`📅 API Request - timeRange: ${timeRange}, from: ${from.toISOString().split('T')[0]}, to: ${to.toISOString().split('T')[0]}`);

    // 지정된 뉴스 소스
    const TRUSTED_SOURCES = [
      'nytimes.com',
      'washingtonpost.com',
      'bloomberg.com',
      'economist.com',
      'reuters.com',
      'ft.com',
      'bbc.com',
      'bbc.co.uk',
      'cnn.com'
    ];

    // 자동차 전문 뉴스 소스
    const AUTO_SOURCES = [
      'autonews.com',
      'reuters.com',
      'bloomberg.com',
      'ft.com',
      'wsj.com',
      'nytimes.com',
      'economist.com'
    ];

    const fromDate = from.toISOString().split('T')[0];
    const toDate = to.toISOString().split('T')[0];

    const queryParams = new URLSearchParams({
      apiKey: process.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY,
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      from: fromDate,
      to: toDate,
      pageSize: 100
    });

    console.log(`🔍 NewsAPI Query: ${query.substring(0, 50)}...`);
    console.log(`📅 Date range: ${fromDate} to ${toDate}`);
    console.log(`🔑 API Key status: ${process.env.NEWS_API_KEY ? 'Found' : 'Not found'}`);

    // 도메인 제한 적용 (자동차/AI-자율주행/회사 검색이 아닐 때만)
    if (!company && category !== 'automotive' && category !== 'ai-tech') {
      const domains = TRUSTED_SOURCES.join(',');
      queryParams.set('domains', domains);
    }

    const response = await fetch(`https://newsapi.org/v2/everything?${queryParams}`);
    const data = await response.json();

    console.log(`✅ NewsAPI Response: ${data.status}, Total articles: ${data.totalResults || 0}, Returned: ${data.articles?.length || 0}`);

    if (data.status === 'ok') {
      const targetCount = timeRange === 'day' ? 10 : 20;

      // 첫 번째와 마지막 기사 날짜 출력
      if (data.articles.length > 0) {
        console.log(`📅 Article dates: First=${data.articles[0].publishedAt}, Last=${data.articles[data.articles.length - 1].publishedAt}`);

        // 날짜 분포 확인
        const dateDistribution = {};
        data.articles.forEach(article => {
          const date = article.publishedAt.split('T')[0];
          dateDistribution[date] = (dateDistribution[date] || 0) + 1;
        });
        console.log(`📊 Date distribution:`, JSON.stringify(dateDistribution));
      }

      // 디버깅: 가져온 기사들의 소스 출력
      if (company || category === 'automotive') {
        const sources = [...new Set(data.articles.map(a => a.source.name))];
        console.log(`📰 Fetched ${data.articles.length} articles from sources:`, sources.join(', '));
      }

      // 소스별로 그룹화
      const articlesBySource = {};
      data.articles.forEach(article => {
        const sourceName = article.source.name;
        if (!articlesBySource[sourceName]) {
          articlesBySource[sourceName] = [];
        }
        articlesBySource[sourceName].push(article);
      });

      // 중복 검사 함수: 제목의 유사도를 계산 (Jaccard similarity)
      const calculateSimilarity = (title1, title2) => {
        // 제목을 소문자로 변환하고 단어로 분리
        const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(word => word.length > 3));
        const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(word => word.length > 3));

        if (words1.size === 0 || words2.size === 0) return 0;

        // 교집합과 합집합 계산
        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
      };

      // 중복 기사인지 확인하는 함수 (제목 유사도 70% 이상이면 중복으로 간주)
      const isDuplicate = (article, selectedArticles) => {
        return selectedArticles.some(selected => {
          const similarity = calculateSimilarity(article.title, selected.title);
          if (similarity >= 0.7) {
            console.log(`🔄 Duplicate detected: "${article.title}" vs "${selected.title}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
            return true;
          }
          return false;
        });
      };

      // 각 소스에서 균등하게 가져오기 (중복 제거)
      const selectedArticles = [];
      const sources = Object.keys(articlesBySource);
      let sourceIndex = 0;

      while (selectedArticles.length < targetCount && sources.length > 0) {
        const source = sources[sourceIndex % sources.length];
        if (articlesBySource[source] && articlesBySource[source].length > 0) {
          const candidate = articlesBySource[source].shift();

          // 중복 검사: 이미 선정된 기사들과 비교
          if (!isDuplicate(candidate, selectedArticles)) {
            selectedArticles.push(candidate);
          } else {
            console.log(`⏭️ Skipping duplicate article from ${source}`);
          }
        } else {
          sources.splice(sourceIndex % sources.length, 1);
          continue;
        }
        sourceIndex++;
      }

      res.status(200).json({
        success: true,
        articles: selectedArticles
      });
    } else {
      res.status(500).json({
        success: false,
        error: data.message || 'Failed to fetch news',
        articles: []
      });
    }
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
