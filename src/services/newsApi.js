const API_KEY = import.meta.env.VITE_NEWS_API_KEY || 'f972b863bd5e4f3fb6e630ef76c20c02';
const BASE_URL = 'https://newsapi.org/v2';

// 지정된 뉴스 소스 (도메인)
const TRUSTED_SOURCES = [
  'nytimes.com',           // The New York Times
  'washingtonpost.com',    // The Washington Post
  'bloomberg.com',         // Bloomberg
  'economist.com',         // The Economist
  'autonews.com',         // Automotive News
  'reuters.com',          // Reuters
  'ft.com',               // Financial Times
  'bbc.com',              // BBC
  'bbc.co.uk',            // BBC UK
  'cnn.com'               // CNN
];

export const newsApi = {
  // 카테고리별 뉴스 검색 (NewsAPI + Google News 통합)
  searchByCategory: async (category, timeRange = 'day') => {
    try {
      // 개발 환경에서도 Vercel 배포된 API 사용 (NewsAPI는 localhost를 지원하지 않음)
      const isDev = import.meta.env.DEV;

      // 로컬 개발 시 배포된 Vercel URL 사용
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      const targetCount = timeRange === 'day' ? 10 : 10;

      // NewsAPI, Google News, Naver News, MSN News를 병렬로 호출
      const [newsApiResult, googleNewsResult, naverNewsResult, msnNewsResult] = await Promise.allSettled([
        // NewsAPI 호출
        fetch(`${apiBaseUrl}/api/news?category=${category}&timeRange=${timeRange}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
          .then(res => res.ok ? res.text() : Promise.reject(`NewsAPI Error: ${res.status}`))
          .then(text => {
            try {
              return JSON.parse(text);
            } catch {
              return { success: false, articles: [] };
            }
          })
          .catch(err => {
            console.warn('NewsAPI failed:', err);
            return { success: false, articles: [] };
          }),

        // Google News RSS 호출
        fetch(`${apiBaseUrl}/api/google-news?query=${encodeURIComponent(getCategoryQuery(category))}&language=en&timeRange=${timeRange}&count=${targetCount}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
          .then(res => res.ok ? res.json() : Promise.reject(`Google News Error: ${res.status}`))
          .catch(err => {
            console.warn('Google News failed:', err);
            return { success: false, articles: [] };
          }),

        // Naver News 호출 (한국어 뉴스)
        fetch(`${apiBaseUrl}/api/naver-news?query=${encodeURIComponent(getKoreanCategoryQuery(category))}&display=${targetCount}&timeRange=${timeRange}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
          .then(res => res.ok ? res.json() : Promise.reject(`Naver News Error: ${res.status}`))
          .catch(err => {
            console.warn('Naver News failed:', err);
            return { success: false, articles: [] };
          }),

        // MSN News (Bing News RSS) 호출 - 실시간 뉴스
        fetch(`${apiBaseUrl}/api/msn-news?category=${getMsnCategory(category)}&count=${targetCount}&timeRange=${timeRange}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
          .then(res => res.ok ? res.json() : Promise.reject(`MSN News Error: ${res.status}`))
          .catch(err => {
            console.warn('MSN News failed:', err);
            return { success: false, articles: [] };
          })
      ]);

      // 결과 수집
      const newsApiArticles = newsApiResult.status === 'fulfilled' && newsApiResult.value.success
        ? newsApiResult.value.articles.map(article => ({
            title: article.title,
            summary: article.description || article.content?.substring(0, 200) + '...',
            date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            source: article.source.name,
            importance: determineImportance(article),
            url: article.url,
            urlToImage: article.urlToImage,
            publishedAt: article.publishedAt
          }))
        : [];

      const googleArticles = googleNewsResult.status === 'fulfilled' && googleNewsResult.value.success
        ? googleNewsResult.value.articles.map(article => ({
            title: article.title,
            summary: article.summary,
            date: article.date,
            source: article.source,
            importance: 'medium',
            url: article.url,
            publishedAt: article.publishedAt
          }))
        : [];

      const naverArticles = naverNewsResult.status === 'fulfilled' && naverNewsResult.value.success
        ? naverNewsResult.value.articles.map(article => ({
            title: article.title,
            summary: article.summary,
            date: article.date,
            source: article.source,
            importance: 'medium',
            url: article.url,
            publishedAt: article.publishedAt
          }))
        : [];

      const msnArticles = msnNewsResult.status === 'fulfilled' && msnNewsResult.value.success
        ? msnNewsResult.value.articles.map(article => ({
            title: article.title,
            summary: article.summary,
            date: article.date,
            source: article.source || 'Bing News',
            importance: 'medium',
            url: article.url,
            publishedAt: article.publishedAt
          }))
        : [];

      console.log(`📰 NewsAPI: ${newsApiArticles.length}개, Google News: ${googleArticles.length}개, Naver News: ${naverArticles.length}개, Bing News: ${msnArticles.length}개 기사 수집`);

      // 네 소스의 기사 합치기 (중복 제거)
      const allArticles = [...newsApiArticles, ...googleArticles, ...naverArticles, ...msnArticles];

      // URL 기준으로 중복 제거
      const uniqueArticles = [];
      const seenUrls = new Set();

      for (const article of allArticles) {
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          uniqueArticles.push(article);
        }
      }

      // 날짜순 정렬 (최신순)
      uniqueArticles.sort((a, b) => {
        const dateA = new Date(a.publishedAt);
        const dateB = new Date(b.publishedAt);
        return dateB - dateA;
      });

      // 목표 개수만큼 선택
      const finalArticles = uniqueArticles.slice(0, targetCount);

      console.log(`✅ 총 ${finalArticles.length}개의 기사를 반환합니다 (중복 제거 후)`);

      return {
        success: true,
        articles: finalArticles
      };
    } catch (error) {
      console.error('Error fetching news:', error);
      return {
        success: false,
        error: error.message,
        articles: []
      };
    }
  }
};

// 카테고리별 검색 쿼리 생성 (Google News용)
function getCategoryQuery(category) {
  const categoryQueries = {
    'geopolitics': 'geopolitics China Russia Ukraine Middle East Iran Israel Taiwan Trump tariff sanctions trade war',
    'economy': 'economy market business Federal Reserve inflation finance banking GDP employment unemployment jobs interest rate Treasury bond yield recession growth',
    'automotive': 'electric vehicle EV Tesla Hyundai Kia BYD Toyota Ford GM battery auto industry',
    'ai-tech': 'artificial intelligence AI ChatGPT self-driving autonomous robotics humanoid robot'
  };
  return categoryQueries[category] || 'technology';
}

// 카테고리별 한국어 검색 쿼리 생성 (Naver News용)
function getKoreanCategoryQuery(category) {
  const koreanQueries = {
    'geopolitics': '국제 정치 중국 러시아 우크라이나 중동 이란 이스라엘 대만',
    'economy': '경제 시장 금융 연준 인플레이션 은행 GDP 고용 실업 금리 국채 채권 경기침체 성장',
    'automotive': '전기차 EV 테슬라 현대차 기아 자동차 배터리',
    'ai-tech': '인공지능 AI 챗GPT 자율주행 로봇 휴머노이드'
  };
  return koreanQueries[category] || '기술';
}

// 카테고리별 MSN News (Bing News RSS) 카테고리 매핑
function getMsnCategory(category) {
  const msnCategories = {
    'geopolitics': 'world',
    'economy': 'business',
    'automotive': 'automotive',
    'ai-tech': 'technology'
  };
  return msnCategories[category] || 'news';
}


// 기사 중요도 판단 (간단한 휴리스틱)
function determineImportance(article) {
  const title = article.title?.toLowerCase() || '';
  const description = article.description?.toLowerCase() || '';
  const text = title + ' ' + description;

  // 높은 중요도 키워드
  const highKeywords = ['breaking', 'major', 'crisis', 'announces', 'billion', 'record', 'historic'];
  // 중간 중요도 키워드
  const mediumKeywords = ['significant', 'important', 'report', 'study', 'analysis', 'growth'];

  if (highKeywords.some(keyword => text.includes(keyword))) {
    return 'high';
  } else if (mediumKeywords.some(keyword => text.includes(keyword))) {
    return 'medium';
  }

  return 'low';
}

// 한글 번역 (실제로는 번역 API를 사용해야 하지만, 여기서는 간단한 버전)
export async function translateToKorean(text) {
  // 실제 프로덕션에서는 Google Translate API나 Papago API 사용
  // 여기서는 시뮬레이션
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`[번역] ${text}`);
    }, 500);
  });
}

// 현대자동차 관점 상세 분석
export function analyzeForHyundai(article) {
  const text = (article.title + ' ' + article.summary).toLowerCase();

  const analysis = {
    opportunities: [],
    risks: [],
    summary: '',
    strategicImplications: [],
    marketImpact: '',
    actionItems: []
  };

  // ============ 기회 요인 상세 분석 ============

  // 1. 전기차 (EV) 관련
  if (text.includes('electric') || text.includes('ev') || text.includes('battery')) {
    const details = [];

    if (text.includes('battery')) {
      details.push('배터리 기술 혁신 트렌드 모니터링 필요');
    }
    if (text.includes('subsidy') || text.includes('incentive')) {
      details.push('정부 보조금 정책 활용 전략 수립');
    }
    if (text.includes('sales') || text.includes('demand')) {
      details.push('시장 수요 증가에 따른 생산 확대 검토');
    }

    analysis.opportunities.push({
      category: '전기차 시장',
      point: 'EV 시장 성장으로 아이오닉 및 제네시스 전기차 라인업 확대 기회',
      impact: 'high',
      details: details.length > 0 ? details : ['현대차 E-GMP 플랫폼 기반 신차 개발 가속화', '글로벌 EV 시장 점유율 확대 전략'],
      timeframe: '단기 (6개월-1년)',
      expectedBenefit: '연간 EV 판매 20-30% 증가 예상'
    });
  }

  // 2. 수소차 관련
  if (text.includes('hydrogen') || text.includes('fuel cell') || text.includes('h2')) {
    analysis.opportunities.push({
      category: '수소 에너지',
      point: '수소 연료전지 기술 선도 기업으로서 글로벌 수소 경제 주도',
      impact: 'high',
      details: [
        'NEXO 및 차세대 수소차 모델 시장 선점',
        '상용차 수소 트럭 시장 개척 (XCIENT Fuel Cell)',
        '수소 생산-저장-충전 밸류체인 참여 확대'
      ],
      timeframe: '중기 (1-3년)',
      expectedBenefit: '수소차 부문 글로벌 1위 지위 강화'
    });
  }

  // 3. 자율주행 관련
  if (text.includes('autonomous') || text.includes('self-driving') || text.includes('robotaxi') || text.includes('adas')) {
    const aiDetails = [];

    if (text.includes('level 3') || text.includes('level 4')) {
      aiDetails.push('고도 자율주행 레벨 3-4 기술 투자 확대');
    }
    if (text.includes('partnership') || text.includes('collaboration')) {
      aiDetails.push('글로벌 자율주행 기업과 협력 강화 (Motional, Aptiv)');
    }
    if (text.includes('regulation') || text.includes('law')) {
      aiDetails.push('자율주행 법규 변화 대응 전략 수립');
    }

    analysis.opportunities.push({
      category: '자율주행/AI',
      point: '자율주행 기술 개발 가속화 및 모빌리티 서비스 진출 기회',
      impact: 'high',
      details: aiDetails.length > 0 ? aiDetails : [
        'Motional 합작사 통한 로보택시 사업 확대',
        'ADAS 기술 고도화로 프리미엄 차량 경쟁력 강화',
        'Software-Defined Vehicle(SDV) 전환 가속화'
      ],
      timeframe: '중장기 (2-5년)',
      expectedBenefit: '자율주행 시장 선점 및 MaaS 사업 진출'
    });
  }

  // 4. 인프라 관련
  if (text.includes('infrastructure') || text.includes('charging') || text.includes('station')) {
    analysis.opportunities.push({
      category: '충전 인프라',
      point: '충전 인프라 확대로 EV 대중화 및 판매 증진',
      impact: 'high',
      details: [
        '초고속 충전 네트워크 확장 지원',
        'E-pit 충전 서비스 사업 확대',
        'V2G(Vehicle-to-Grid) 기술 생태계 구축'
      ],
      timeframe: '단기 (6개월-1년)',
      expectedBenefit: 'EV 구매 장벽 해소 및 고객 만족도 향상'
    });
  }

  // 5. 정책 및 규제 관련
  if (text.includes('regulation') || text.includes('emission') || text.includes('carbon') || text.includes('climate')) {
    analysis.opportunities.push({
      category: '환경 규제',
      point: '글로벌 탄소중립 정책 강화로 친환경차 수요 급증',
      impact: 'high',
      details: [
        'EU 탄소배출 규제 대응 전략 (2035년 내연기관 판매 금지)',
        '미국 IRA 법안 활용한 현지 생산 확대',
        '각국 환경 규제 충족하는 친환경 포트폴리오 강화'
      ],
      timeframe: '중장기 (2-5년)',
      expectedBenefit: '규제 대응 경쟁 우위 확보'
    });
  }

  // 6. 시장 확대 관련
  if (text.includes('india') || text.includes('southeast asia') || text.includes('emerging market')) {
    analysis.opportunities.push({
      category: '신흥시장',
      point: '인도 및 동남아시아 신흥시장 진출 확대',
      impact: 'medium',
      details: [
        '인도 현지 생산 확대 및 맞춤형 모델 개발',
        '동남아 시장 SUV 및 전기차 판매 강화',
        '현지화 전략 통한 시장 점유율 확대'
      ],
      timeframe: '중기 (1-3년)',
      expectedBenefit: '연간 신흥시장 판매 15-20% 성장'
    });
  }

  // ============ 리스크 요인 상세 분석 ============

  // 1. 경쟁 심화
  if (text.includes('tesla') || text.includes('competition') || text.includes('market share')) {
    const competitionDetails = [];

    if (text.includes('tesla')) {
      competitionDetails.push('Tesla의 가격 인하 공세 대응 전략 필요');
    }
    if (text.includes('byd') || text.includes('chinese')) {
      competitionDetails.push('중국 BYD 등 저가 전략에 대한 차별화 필요');
    }
    if (text.includes('price') || text.includes('discount')) {
      competitionDetails.push('가격 경쟁력 확보 및 마진 관리 강화');
    }

    analysis.risks.push({
      category: '시장 경쟁',
      point: '글로벌 자동차 업체 간 경쟁 심화로 시장 점유율 압박',
      severity: 'high',
      details: competitionDetails.length > 0 ? competitionDetails : [
        'Tesla, BYD 등 경쟁사 대비 기술 경쟁력 유지',
        '가격 경쟁 심화에 따른 수익성 악화 우려',
        '브랜드 차별화 전략 강화 필요'
      ],
      timeframe: '즉시 대응 필요',
      mitigationPlan: '프리미엄 브랜드 포지셔닝 강화, 고객 경험 개선, 기술 혁신 지속'
    });
  }

  // 2. 중국 시장 리스크
  if (text.includes('china') || text.includes('chinese') || text.includes('byd') || text.includes('geely')) {
    analysis.risks.push({
      category: '중국 리스크',
      point: '중국 로컬 업체의 급성장 및 중국 시장 점유율 하락 위험',
      severity: 'high',
      details: [
        'BYD, NIO, XPeng 등 중국 전기차 업체의 기술 추격',
        '중국 정부의 자국 기업 보호 정책',
        '중국 내 브랜드 경쟁력 약화 및 판매 부진',
        '사드 사태 이후 이미지 회복 전략 지속 필요'
      ],
      timeframe: '현재 진행형',
      mitigationPlan: '프리미엄 세그먼트 집중, 제네시스 브랜드 강화, 현지화 전략 고도화'
    });
  }

  // 3. 공급망 리스크
  if (text.includes('shortage') || text.includes('supply chain') || text.includes('chip') || text.includes('semiconductor')) {
    analysis.risks.push({
      category: '공급망 불안',
      point: '반도체 및 원자재 수급 불안정으로 생산 차질 및 비용 증가',
      severity: 'high',
      details: [
        '반도체 부족 사태 재발 가능성 대비',
        '리튬, 코발트 등 배터리 원자재 가격 급등',
        '글로벌 물류 대란 및 운송비 증가',
        '공급망 다변화 및 안정화 전략 필요'
      ],
      timeframe: '즉시 대응 필요',
      mitigationPlan: '공급망 다각화, 전략적 재고 확보, 장기 계약 체결, 수직계열화 검토'
    });
  }

  // 4. 무역 리스크
  if (text.includes('tariff') || text.includes('trade war') || text.includes('sanction') || text.includes('protectionism')) {
    analysis.risks.push({
      category: '무역 장벽',
      point: '보호무역주의 강화 및 관세 인상으로 수출 비용 증가',
      severity: 'medium',
      details: [
        '미중 무역분쟁 장기화 영향',
        '미국 IRA 법안의 양날의 검 (보조금 vs 현지 생산 요구)',
        'EU 탄소국경조정제도(CBAM) 대응',
        '각국의 자국 우선주의 정책 확대'
      ],
      timeframe: '중기 (1-3년)',
      mitigationPlan: '현지 생산 확대, FTA 활용, 정부 협력 강화, 공급망 재편'
    });
  }

  // 5. 기술 전환 리스크
  if (text.includes('software') || text.includes('digital') || text.includes('tech company')) {
    analysis.risks.push({
      category: '기술 전환',
      point: '소프트웨어 중심 자동차 산업으로 전환에 따른 기술 격차 우려',
      severity: 'medium',
      details: [
        'SDV(Software-Defined Vehicle) 전환 가속화',
        '테크 기업(Apple, Google)의 자동차 산업 진입',
        '소프트웨어 인재 확보 경쟁 심화',
        'OTA(Over-The-Air) 업데이트 등 신기술 개발 필요'
      ],
      timeframe: '중장기 (2-5년)',
      mitigationPlan: '소프트웨어 역량 강화, 테크 기업 협력, 인재 영입, R&D 투자 확대'
    });
  }

  // 6. 경기 침체 리스크
  if (text.includes('recession') || text.includes('inflation') || text.includes('interest rate') || text.includes('economy')) {
    analysis.risks.push({
      category: '거시경제',
      point: '글로벌 경기 침체 및 금리 인상으로 자동차 수요 감소',
      severity: 'medium',
      details: [
        '고금리 장기화로 소비자 구매력 감소',
        '인플레이션 지속에 따른 원가 상승',
        '경기 불확실성으로 대형 투자 결정 지연',
        '할부 금융 비용 증가로 판매 둔화'
      ],
      timeframe: '현재 진행형',
      mitigationPlan: '할부 프로그램 강화, 마케팅 비용 효율화, 재무 건전성 유지'
    });
  }

  // ============ 전략적 시사점 ============

  if (analysis.opportunities.length > 0 || analysis.risks.length > 0) {
    // 전략적 시사점 도출
    if (analysis.opportunities.length > analysis.risks.length) {
      analysis.strategicImplications.push('공격적 시장 확대 전략 추진 적기');
      analysis.strategicImplications.push('R&D 투자 확대 및 신기술 개발 가속화');
    } else if (analysis.risks.length > analysis.opportunities.length) {
      analysis.strategicImplications.push('리스크 관리 및 방어적 전략 필요');
      analysis.strategicImplications.push('비용 효율화 및 수익성 개선 집중');
    } else {
      analysis.strategicImplications.push('균형잡힌 성장 전략 유지');
      analysis.strategicImplications.push('기회 포착과 리스크 관리 병행');
    }

    // 시장 영향도 평가
    const highImpactOpportunities = analysis.opportunities.filter(o => o.impact === 'high').length;
    const highSeverityRisks = analysis.risks.filter(r => r.severity === 'high').length;

    if (highImpactOpportunities > highSeverityRisks) {
      analysis.marketImpact = '전반적으로 긍정적인 시장 환경. 적극적인 투자 및 시장 확대 전략 권장';
    } else if (highSeverityRisks > highImpactOpportunities) {
      analysis.marketImpact = '주의가 필요한 시장 환경. 리스크 헤징 및 선택과 집중 전략 필요';
    } else {
      analysis.marketImpact = '기회와 위협이 공존하는 시장 환경. 신중한 의사결정 필요';
    }

    // 실행 과제
    if (analysis.opportunities.length > 0) {
      analysis.actionItems.push('기회 영역에 대한 구체적인 실행 계획 수립');
      analysis.actionItems.push('관련 부서 간 협업 체계 구축');
    }
    if (analysis.risks.length > 0) {
      analysis.actionItems.push('주요 리스크에 대한 모니터링 체계 강화');
      analysis.actionItems.push('비상 대응 계획(Contingency Plan) 수립');
    }
  }

  // 기본값 설정
  if (analysis.opportunities.length === 0 && analysis.risks.length === 0) {
    analysis.opportunities.push({
      category: '일반 시장 동향',
      point: '산업 전반의 트렌드 변화 모니터링 기회',
      impact: 'medium',
      details: [
        '글로벌 자동차 시장 동향 파악',
        '경쟁사 전략 분석 및 벤치마킹',
        '소비자 선호도 변화 추적'
      ],
      timeframe: '지속적',
      expectedBenefit: '시장 인사이트 축적 및 전략 수립 기반 마련'
    });

    analysis.risks.push({
      category: '일반 시장 환경',
      point: '예측 불가능한 시장 변화에 대한 준비 필요',
      severity: 'low',
      details: [
        '시장 변동성 모니터링',
        '유연한 대응 체계 유지',
        '다양한 시나리오 대비 계획 수립'
      ],
      timeframe: '지속적',
      mitigationPlan: '정기적인 시장 분석 및 전략 리뷰'
    });

    analysis.marketImpact = '현재 기사는 현대차에 직접적인 영향이 제한적이나, 지속적인 시장 모니터링 필요';
  }

  // 종합 요약
  const oppCount = analysis.opportunities.length;
  const riskCount = analysis.risks.length;
  const highOppCount = analysis.opportunities.filter(o => o.impact === 'high').length;
  const highRiskCount = analysis.risks.filter(r => r.severity === 'high').length;

  analysis.summary = `총 ${oppCount}개 기회 요인(고영향 ${highOppCount}개)과 ${riskCount}개 리스크 요인(고위험 ${highRiskCount}개) 식별. ${analysis.marketImpact}`;

  return analysis;
}
