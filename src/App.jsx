import React, { useState, useEffect } from 'react';
import { Newspaper, Globe, TrendingUp, RefreshCw, Calendar, ExternalLink, Clock, MessageCircle, Send, X, BookOpen, Key } from 'lucide-react';
import { newsApi, analyzeForHyundai } from './services/newsApi';
import IssueAnalysis from './IssueAnalysis';
import KeywordManager from './KeywordManager';
import './App.css';

export default function GlobalNewsApp() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [category, setCategory] = useState('geopolitics');
  const [timeRange, setTimeRange] = useState('day');
  const [translations, setTranslations] = useState({});
  const [analysis, setAnalysis] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [viewMode, setViewMode] = useState('general'); // 'general', 'automotive', 'archive', 'issue', or 'keywords'
  const [autoNewsData, setAutoNewsData] = useState({});
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [selectedArticlesData, setSelectedArticlesData] = useState({}); // 선택된 기사의 전체 데이터 저장
  const [archivedArticles, setArchivedArticles] = useState([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all'); // 아카이브 카테고리 탭
  const [activeCompanyTab, setActiveCompanyTab] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [issueArticleData, setIssueArticleData] = useState(null); // 이슈 분석에 전달할 기사 데이터

  const categories = [
    { id: 'geopolitics', name: '지정학', icon: Globe },
    { id: 'economy', name: '미국 경제', icon: TrendingUp },
    { id: 'automotive', name: '자동차', icon: Newspaper },
    { id: 'ai-tech', name: 'AI/자율주행', icon: TrendingUp },
  ];

  const autoCompanies = [
    { id: 'hyundai', name: '현대자동차', keywords: '"Hyundai Motor" OR "Hyundai Motors" OR "Hyundai EV"', koreanKeywords: '현대자동차 전기차 아이오닉' },
    { id: 'kia', name: '기아', keywords: '"Kia Motors" OR "Kia Corp" OR "Kia Corporation" OR "Kia EV"', koreanKeywords: '기아 전기차 EV6' },
    { id: 'toyota', name: '도요타', keywords: '"Toyota Motor" OR "Toyota" OR "Toyota EV" OR "Toyota hybrid"', koreanKeywords: '도요타 전기차 하이브리드' },
    { id: 'tesla', name: '테슬라', keywords: 'Tesla OR "Elon Musk" OR Cybertruck OR "Tesla Model"', koreanKeywords: '테슬라 일론머스크 사이버트럭' },
    { id: 'ford', name: '포드', keywords: '"Ford Motor" OR "Ford F-150" OR "Ford EV" OR "Ford electric"', koreanKeywords: '포드 전기차 F-150' },
    { id: 'gm', name: 'GM', keywords: '"General Motors" OR "GM" OR Cadillac OR "Chevrolet electric"', koreanKeywords: 'GM 제너럴모터스 캐딜락 전기차' },
    { id: 'bmw', name: 'BMW', keywords: 'BMW OR "BMW electric" OR "BMW EV" OR "BMW iX"', koreanKeywords: 'BMW 전기차 iX' },
    { id: 'mercedes', name: '벤츠', keywords: '"Mercedes-Benz" OR Mercedes OR "Mercedes EQ" OR "Mercedes electric"', koreanKeywords: '벤츠 메르세데스 전기차 EQ' },
    { id: 'stellantis', name: '스텔란티스', keywords: 'Stellantis OR Jeep OR Peugeot OR Fiat OR Chrysler', koreanKeywords: '스텔란티스 지프 피아트 크라이슬러' },
    { id: 'chinese-oem', name: '중국 OEM', keywords: 'BYD OR NIO OR XPeng OR "Li Auto" OR Geely OR Chery OR "Chinese EV" OR "China electric vehicle"', koreanKeywords: 'BYD 니오 샤오펑 리오토 지리 체리 중국전기차' },
  ];

  // 초기 마운트 시 뉴스 및 아카이브 로드
  useEffect(() => {
    const timer = setTimeout(() => {
      loadNews('geopolitics', 'day');
      loadArchivedArticles(); // Vercel KV에서 아카이브된 기사 로드
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Supabase에서 아카이브된 기사 로드
  const loadArchivedArticles = async () => {
    try {
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      const response = await fetch(`${apiBaseUrl}/api/archives`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setArchivedArticles(data.archives);
          console.log('✅ Loaded archived articles from Supabase:', data.archives.length);

          // 자동차 카테고리 기사의 companyId 확인
          const automotiveArticles = data.archives.filter(a => a.category === 'automotive');
          console.log('🚗 Automotive articles:', automotiveArticles.length);
          automotiveArticles.forEach((article, idx) => {
            console.log(`  Article ${idx + 1}: companyId="${article.companyId}", company="${article.company}", title="${article.title?.substring(0, 50)}..."`);
          });
        }
      }
    } catch (error) {
      console.error('Failed to load archived articles from Supabase:', error);
    }
  };

  // 자동차 카테고리 기사의 companyId 자동 매핑 실행
  const autoMapCompanyIds = async () => {
    try {
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      console.log('🔄 Starting auto-mapping of company IDs...');

      const response = await fetch(`${apiBaseUrl}/api/archives`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Auto-mapping complete: ${data.updated}/${data.total} articles updated`);

          // 아카이브 새로고침
          await loadArchivedArticles();

          alert(`자동 매핑 완료!\n\n업데이트된 기사: ${data.updated}개\n전체 기사: ${data.total}개`);
        }
      } else {
        console.error('Failed to auto-map company IDs');
        alert('자동 매핑에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to auto-map company IDs:', error);
      alert('자동 매핑 중 오류가 발생했습니다.');
    }
  };

  const loadAutomotiveNews = async (range = timeRange) => {
    console.log(`🔍 loadAutomotiveNews called with range: ${range}`);
    setLoading(true);
    setError(null);
    setAnalysis({});
    setTranslations({});
    setAnalyzingId(null);

    try {
      const companiesData = {};
      const allCompanyArticles = {};

      // 개발 환경에서도 배포된 Vercel URL 사용
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      // 1. 각 자동차 회사별로 뉴스 가져오기 (NewsAPI + Google News 통합)
      for (const company of autoCompanies) {
        try {
          console.log(`📡 Fetching ${company.name} from NewsAPI, Google News & Naver News`);

          // NewsAPI, Google News, Naver News를 병렬로 호출
          const companyQuery = company.keywords.replace(/"/g, '').replace(/ OR /g, ' ');
          const koreanQuery = company.koreanKeywords || companyQuery; // 한국어 키워드 사용

          const [newsApiResult, googleNewsResult, naverNewsResult] = await Promise.allSettled([
            // NewsAPI 호출
            fetch(`${apiBaseUrl}/api/news?category=automotive&company=${encodeURIComponent(company.keywords)}&timeRange=${range}`, {
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            })
              .then(res => res.ok ? res.json() : Promise.reject())
              .catch(() => ({ success: false, articles: [] })),

            // Google News 호출
            fetch(`${apiBaseUrl}/api/google-news?query=${encodeURIComponent(companyQuery)}&count=10&timeRange=${range}`, {
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            })
              .then(res => res.ok ? res.json() : Promise.reject())
              .catch(() => ({ success: false, articles: [] })),

            // Naver News 호출 (한국어)
            fetch(`${apiBaseUrl}/api/naver-news?query=${encodeURIComponent(koreanQuery)}&display=10`, {
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            })
              .then(res => res.ok ? res.json() : Promise.reject())
              .catch(() => ({ success: false, articles: [] }))
          ]);

          // NewsAPI 결과 처리
          const newsApiArticles = newsApiResult.status === 'fulfilled' && newsApiResult.value.success
            ? newsApiResult.value.articles.slice(0, 10).map(article => ({
                title: article.title,
                summary: article.description || article.content?.substring(0, 200) + '...',
                date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                source: article.source.name,
                importance: 'medium',
                url: article.url,
                publishedAt: article.publishedAt
              }))
            : [];

          // Google News 결과 처리
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

          // Naver News 결과 처리
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

          // 세 소스 합치기 (중복 제거)
          const allArticles = [...newsApiArticles, ...googleArticles, ...naverArticles];
          const uniqueArticles = [];
          const seenUrls = new Set();

          for (const article of allArticles) {
            if (!seenUrls.has(article.url)) {
              seenUrls.add(article.url);
              uniqueArticles.push(article);
            }
          }

          // 최신순 정렬
          uniqueArticles.sort((a, b) => {
            const dateA = new Date(a.publishedAt);
            const dateB = new Date(b.publishedAt);
            return dateB - dateA;
          });

          if (uniqueArticles.length > 0) {
            console.log(`✅ ${company.name}: ${uniqueArticles.length} articles (NewsAPI: ${newsApiArticles.length}, Google: ${googleArticles.length}, Naver: ${naverArticles.length})`);
            allCompanyArticles[company.id] = uniqueArticles.slice(0, 10);
          }
        } catch (companyError) {
          console.error(`Failed to fetch news for ${company.name}:`, companyError);
          // 개별 회사 실패는 무시하고 계속 진행
        }
      }

      // 2. 중복 기사 찾기 및 공통 뉴스 분류
      const urlCount = {};
      const titleCount = {};
      const commonArticles = new Set();

      // URL과 제목으로 중복 카운트
      Object.values(allCompanyArticles).forEach(articles => {
        articles.forEach(article => {
          urlCount[article.url] = (urlCount[article.url] || 0) + 1;
          const normalizedTitle = article.title.toLowerCase().trim();
          titleCount[normalizedTitle] = (titleCount[normalizedTitle] || 0) + 1;
        });
      });

      // 2개 이상의 회사에 나타나는 기사는 공통 뉴스로 분류
      Object.values(allCompanyArticles).forEach(articles => {
        articles.forEach(article => {
          const normalizedTitle = article.title.toLowerCase().trim();
          if (urlCount[article.url] >= 2 || titleCount[normalizedTitle] >= 2) {
            commonArticles.add(article.url);
          }
        });
      });

      // 3. 공통 뉴스 섹션 생성 (임베딩 기반 유사도 체크로 중복 제거)
      const candidateIndustryArticles = [];
      const seenUrls = new Set();

      // 공통 뉴스 후보 수집 (URL 기준 중복 제거)
      Object.values(allCompanyArticles).forEach(articles => {
        articles.forEach(article => {
          if (commonArticles.has(article.url) && !seenUrls.has(article.url)) {
            candidateIndustryArticles.push(article);
            seenUrls.add(article.url);
          }
        });
      });

      // 임베딩 기반 중복 제거 API 호출
      let industryArticles = candidateIndustryArticles;
      if (candidateIndustryArticles.length > 0) {
        try {
          const dedupeResponse = await fetch(`${apiBaseUrl}/api/dedupe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              articles: candidateIndustryArticles,
              category: 'automotive'
            })
          });

          if (dedupeResponse.ok) {
            const dedupeResult = await dedupeResponse.json();
            if (dedupeResult.success) {
              industryArticles = dedupeResult.articles;
              console.log(`🧠 Industry 뉴스 임베딩 기반 중복 제거: ${dedupeResult.removed || 0}개 제거, ${industryArticles.length}개 유지`);
            }
          }
        } catch (dedupeError) {
          console.warn('Industry 뉴스 dedupe 실패, 원본 사용:', dedupeError);
        }
      }

      companiesData['industry'] = industryArticles.slice(0, 15);

      // 4. 각 회사별 고유 뉴스만 필터링 (중복 제거)
      Object.keys(allCompanyArticles).forEach(companyId => {
        const uniqueArticles = [];
        const companySeenUrls = new Set();

        allCompanyArticles[companyId].forEach(article => {
          // 공통 뉴스가 아니고, 해당 회사에서 처음 보는 URL인 경우만 추가
          if (!commonArticles.has(article.url) && !companySeenUrls.has(article.url)) {
            uniqueArticles.push(article);
            companySeenUrls.add(article.url);
          }
        });

        if (uniqueArticles.length > 0) {
          companiesData[companyId] = uniqueArticles.slice(0, 5);
        }
      });

      setAutoNewsData(companiesData);
      setViewMode('automotive');
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error loading automotive news:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const loadNews = async (cat, range) => {
    setLoading(true);
    setError(null);
    setViewMode('general');
    // 새 뉴스 로드 시 기존 분석/번역 초기화
    setAnalysis({});
    setTranslations({});
    setAnalyzingId(null);

    try {
      const result = await newsApi.searchByCategory(cat, range);

      if (result.success) {
        setNews(result.articles);
        setLastUpdated(new Date());
      } else {
        setError(result.error || '뉴스를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (imp) => {
    if (imp === 'high') return 'bg-red-100 text-red-800';
    if (imp === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const analyzeNews = async (item, idx) => {
    // 이미 분석 결과가 있으면 토글 (숨기기)
    if (analysis[idx]) {
      setAnalysis(prev => {
        const newAnalysis = { ...prev };
        delete newAnalysis[idx];
        return newAnalysis;
      });
      return;
    }

    // 이미 분석 중이면 무시
    if (analyzingId !== null) return;

    setAnalyzingId(idx);

    try {
      console.log('🔍 Calling Claude API for analysis...');

      // 아카이브된 기사는 description, 일반 기사는 summary 사용
      const summaryText = item.summary || item.description || '';

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          summary: summaryText,
          source: item.source,
          date: item.date
        })
      });

      console.log('📡 API Response status:', response.status);
      const data = await response.json();
      console.log('📦 API Response data:', data);

      let analysisResult;
      if (data.success && data.analysis) {
        console.log('✅ Claude AI analysis received!');
        analysisResult = data.analysis;
      } else {
        console.warn('⚠️ Analysis failed, using fallback. Error:', data.error);
        analysisResult = analyzeForHyundai(item);
      }

      // 분석 결과 먼저 업데이트
      setAnalysis(prev => ({ ...prev, [idx]: analysisResult }));
      // 그 다음 로딩 상태 해제 (분리된 업데이트)
      setAnalyzingId(null);
    } catch (error) {
      console.error('❌ Error analyzing news:', error);
      const analysisResult = analyzeForHyundai(item);

      // 분석 결과 먼저 업데이트
      setAnalysis(prev => ({ ...prev, [idx]: analysisResult }));
      // 그 다음 로딩 상태 해제 (분리된 업데이트)
      setAnalyzingId(null);
    }
  };

  const translateNews = async (item, idx) => {
    try {
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      // 아카이브된 기사는 description, 일반 기사는 summary 사용
      const summaryText = item.summary || item.description || '';

      const response = await fetch(`${apiBaseUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          summary: summaryText
        })
      });

      const data = await response.json();

      if (data.success && data.translation) {
        setTranslations(prev => ({
          ...prev,
          [idx]: {
            title: data.translation.title,
            summary: data.translation.summary
          }
        }));
      } else {
        console.error('Translation failed:', data.error);
        // 실패 시 폴백
        setTranslations(prev => ({
          ...prev,
          [idx]: {
            title: `[번역 실패] ${item.title}`,
            summary: `[번역 실패] ${summaryText}`
          }
        }));
      }
    } catch (error) {
      console.error('Error translating news:', error);
      // 에러 시 폴백
      setTranslations(prev => ({
        ...prev,
        [idx]: {
          title: `[오류] ${item.title}`,
          summary: `[오류] ${summaryText}`
        }
      }));
    }
  };

  const toggleArticleSelection = (articleKey, articleData, categoryOrCompany) => {
    console.log('🔍 toggleArticleSelection called with:', {
      articleKey,
      articleData,
      categoryOrCompany,
      hasTitle: !!articleData?.title,
      articleDataKeys: articleData ? Object.keys(articleData) : 'null'
    });

    // 현재 선택 상태 확인 (현재 상태 기준)
    const isCurrentlySelected = selectedArticles.has(articleKey);

    setSelectedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleKey)) {
        newSet.delete(articleKey);
      } else {
        newSet.add(articleKey);
      }
      return newSet;
    });

    // 선택된 기사 데이터도 함께 저장 (현재 상태 기준으로 토글)
    setSelectedArticlesData(prev => {
      const newData = { ...prev };
      if (isCurrentlySelected) {
        // 현재 선택되어 있으면 제거
        delete newData[articleKey];
      } else {
        // 현재 선택 안되어 있으면 추가
        newData[articleKey] = {
          article: articleData,
          categoryOrCompany: categoryOrCompany,
          viewMode: 'automotive'
        };
        console.log('✅ Stored article data:', newData[articleKey]);
      }
      return newData;
    });
  };

  const toggleGeneralArticleSelection = (idx, article) => {
    const articleKey = `${category}-${idx}`;

    // 현재 선택 상태 확인 (현재 상태 기준)
    const isCurrentlySelected = selectedArticles.has(articleKey);

    setSelectedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleKey)) {
        newSet.delete(articleKey);
      } else {
        newSet.add(articleKey);
      }
      return newSet;
    });

    // 선택된 기사 데이터도 함께 저장 (현재 상태 기준으로 토글)
    setSelectedArticlesData(prev => {
      const newData = { ...prev };
      if (isCurrentlySelected) {
        // 현재 선택되어 있으면 제거
        delete newData[articleKey];
      } else {
        // 현재 선택 안되어 있으면 추가
        newData[articleKey] = {
          article: article,
          category: category,
          viewMode: 'general'
        };
      }
      return newData;
    });
  };

  const archiveSelectedArticles = () => {
    const articlesToArchive = [];

    console.log('🔍 Archive Debug - selectedArticles:', Array.from(selectedArticles));
    console.log('🔍 Archive Debug - selectedArticlesData:', selectedArticlesData);

    // 저장된 선택 데이터를 기반으로 아카이브
    selectedArticles.forEach(articleKey => {
      const data = selectedArticlesData[articleKey];
      if (!data) {
        console.warn(`⚠️ No data found for article key: ${articleKey}`);
        return;
      }

      console.log(`🔍 Processing article: ${articleKey}`, data.article);

      // URL 기반 고유 키 생성 (같은 URL이면 항상 같은 키 = 중복 방지)
      // 전체 URL을 base64 인코딩하고 특수문자 제거 (길이 제한 없음)
      const uniqueArticleKey = data.article.url
        ? btoa(encodeURIComponent(data.article.url)).replace(/[^a-zA-Z0-9]/g, '')
        : articleKey;

      if (data.viewMode === 'automotive') {
        // 자동차 뉴스
        const companyId = data.categoryOrCompany;
        const archivedArticle = {
          ...data.article,
          source: data.article.source || 'News Source', // source가 비어있으면 기본값 제공
          category: 'automotive',
          categoryName: '자동차',
          company: companyId === 'industry' ? '산업 공통' : autoCompanies.find(c => c.id === companyId)?.name || companyId,
          companyId: companyId,
          archivedDate: new Date().toISOString(),
          articleKey: uniqueArticleKey
        };
        console.log(`✅ Archived article object:`, archivedArticle);
        articlesToArchive.push(archivedArticle);
      } else if (data.viewMode === 'general') {
        // 일반 뉴스 (지정학, 미국경제, AI/자율주행)
        const categoryInfo = categories.find(c => c.id === data.category);
        articlesToArchive.push({
          ...data.article,
          source: data.article.source || 'News Source', // source가 비어있으면 기본값 제공
          category: data.category,
          categoryName: categoryInfo?.name || data.category,
          archivedDate: new Date().toISOString(),
          articleKey: uniqueArticleKey
        });
      }
    });

    console.log('📦 Articles to archive COUNT:', articlesToArchive.length);
    console.log('📦 Full articlesToArchive array:', JSON.stringify(articlesToArchive, null, 2));

    // 각 아카이브 객체의 구조 확인
    console.log('📦 Starting article structure check...');
    articlesToArchive.forEach((a, idx) => {
      console.log(`📦 Article ${idx} structure:`, {
        articleKey: a.articleKey,
        hasTitle: !!a.title,
        titleValue: a.title,
        allKeys: Object.keys(a),
        fullObject: a
      });
    });
    console.log('📦 Finished article structure check');

    if (articlesToArchive.length > 0) {
      // Vercel KV API에 저장
      saveToArchive(articlesToArchive);

      setSelectedArticles(new Set()); // 선택 초기화
      setSelectedArticlesData({}); // 선택된 기사 데이터도 초기화

      alert(`${articlesToArchive.length}개 기사가 아카이브되었습니다.`);
    } else {
      alert('선택된 기사가 없습니다.');
    }
  };

  // Supabase API에 아카이브 저장
  const saveToArchive = async (articlesToArchive) => {
    try {
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      const response = await fetch(`${apiBaseUrl}/api/archives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ articles: articlesToArchive })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Saved to Supabase: ${data.added} new articles, ${data.total} total`);
          // 저장 후 아카이브 목록 다시 로드
          await loadArchivedArticles();
        }
      } else {
        console.error('Failed to save to Supabase:', await response.text());
        alert('아카이브 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      alert('아카이브 저장 중 오류가 발생했습니다.');
    }
  };

  const viewArchive = () => {
    setViewMode('archive');
  };

  const removeFromArchive = async (articleKey) => {
    try {
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      const response = await fetch(`${apiBaseUrl}/api/archives?articleKey=${encodeURIComponent(articleKey)}`, {
        method: 'DELETE',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Removed from Supabase: ${data.removed} article(s)`);
          // 삭제 후 아카이브 목록 다시 로드
          await loadArchivedArticles();
        }
      } else {
        console.error('Failed to remove from Supabase:', await response.text());
        alert('아카이브 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error removing from Supabase:', error);
      alert('아카이브 삭제 중 오류가 발생했습니다.');
    }
  };

  // AI 채팅 기능
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // 사용자 메시지 추가
    const newUserMessage = { role: 'user', content: userMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatLoading(true);

    try {
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      // 현재 표시된 뉴스 기사들을 컨텍스트로 전달
      let context = '';
      if (viewMode === 'general' && news.length > 0) {
        context = news.slice(0, 5).map((article, idx) =>
          `[${idx + 1}] ${article.title}\n${article.description || ''}`
        ).join('\n\n');
      } else if (viewMode === 'automotive' && Object.keys(autoNewsData).length > 0) {
        const allArticles = Object.values(autoNewsData).flat();
        context = allArticles.slice(0, 5).map((article, idx) =>
          `[${idx + 1}] ${article.title}\n${article.description || ''}`
        ).join('\n\n');
      } else if (viewMode === 'archive' && archivedArticles.length > 0) {
        context = archivedArticles.slice(0, 5).map((article, idx) =>
          `[${idx + 1}] ${article.title}\n${article.description || ''}`
        ).join('\n\n');
      }

      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          context: context
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const aiMessage = { role: 'assistant', content: data.answer };
          setChatMessages(prev => [...prev, aiMessage]);
        } else {
          throw new Error(data.error || 'Failed to get response');
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.\n\n오류: ${error.message || '알 수 없는 오류'}\n\n나중에 다시 시도해주세요.`
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // Issue Analysis page
  if (viewMode === 'issue') {
    return <IssueAnalysis
      onBack={() => {
        setViewMode('general');
        setIssueArticleData(null); // 뒤로 갈 때 데이터 초기화
      }}
      initialArticleData={issueArticleData}
    />;
  }

  // Keyword Manager page
  if (viewMode === 'keywords') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <KeywordManager onBack={() => setViewMode('general')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-3 rounded-xl">
                <Newspaper className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">글로벌 뉴스</h1>
                <p className="text-gray-500 text-sm">실시간 NewsAPI 연동</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => loadNews(category, timeRange)}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
              <button
                onClick={() => loadAutomotiveNews(timeRange)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center font-semibold shadow-md"
              >
                🚗 경쟁사 분석
              </button>
              <button
                onClick={() => setViewMode('issue')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center font-semibold shadow-md"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                이슈별 분석정리
              </button>
              {(viewMode === 'general' || viewMode === 'automotive') && (
                <>
                  <button
                    onClick={viewArchive}
                    className="px-4 py-2 bg-violet-700 text-white rounded-lg hover:bg-violet-800 flex items-center font-semibold shadow-md"
                  >
                    📂 아카이브 보기 ({archivedArticles.length})
                  </button>
                  <button
                    onClick={archiveSelectedArticles}
                    disabled={selectedArticles.size === 0}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center font-semibold shadow-md"
                  >
                    📚 선택 아카이브 ({selectedArticles.size})
                  </button>
                </>
              )}
              {viewMode === 'archive' && (
                <>
                  <button
                    onClick={() => setViewMode('general')}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center font-semibold shadow-md"
                  >
                    ← 뉴스로 돌아가기
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('모든 아카이브를 삭제하시겠습니까?')) {
                        setArchivedArticles([]);
                        alert('모든 아카이브가 삭제되었습니다.');
                      }
                    }}
                    disabled={archivedArticles.length === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center font-semibold shadow-md"
                  >
                    🗑️ 전체 삭제
                  </button>
                </>
              )}
              <button
                onClick={() => setViewMode('keywords')}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center font-semibold shadow-md"
              >
                <Key className="w-5 h-5 mr-2" />
                키워드 관리
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 font-medium">수집 기간:</span>
            <button
              onClick={() => { setTimeRange('day'); loadNews(category, 'day'); }}
              className={`px-3 py-1.5 rounded-lg text-sm ${timeRange === 'day' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
            >
              하루 전 (5개)
            </button>
            <button
              onClick={() => { setTimeRange('week'); loadNews(category, 'week'); }}
              className={`px-3 py-1.5 rounded-lg text-sm ${timeRange === 'week' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
            >
              일주일 전 (10개)
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategory(cat.id); loadNews(cat.id, timeRange); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${category === cat.id ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
              <Calendar className="w-4 h-4" />
              업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">오류: {error}</p>
            <p className="text-red-600 text-sm mt-1">API 키를 확인하거나 잠시 후 다시 시도해주세요.</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-12 bg-white rounded-xl shadow-lg">
            <div className="text-6xl mb-4 animate-pulse">⏳</div>
            <p className="text-gray-600">뉴스를 불러오는 중...</p>
          </div>
        )}

        {!loading && !error && news.length > 0 && viewMode === 'general' && (
          <div className="grid gap-4 md:grid-cols-2">
            {news.map((item, idx) => {
              const articleKey = `${category}-${idx}`;
              const isSelected = selectedArticles.has(articleKey);
              return (
                <div key={`news-${idx}`} className={`bg-white rounded-xl shadow-lg p-6 transition-all ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGeneralArticleSelection(idx, item)}
                        className="w-5 h-5 mt-1 cursor-pointer accent-purple-600"
                      />
                      <h3 className="text-lg font-bold text-gray-800 flex-1">
                        {translations[idx] ? translations[idx].title : item.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${getColor(item.importance)}`}>
                      {item.importance === 'high' ? '긴급' : item.importance === 'medium' ? '중요' : '일반'}
                    </span>
                  </div>
                <p className="text-gray-600 mb-3 text-sm">
                  {translations[idx] ? translations[idx].summary : item.summary}
                </p>
                <div className="flex items-center justify-between text-xs mb-3 text-gray-500">
                  <span>{item.source}</span>
                  <span>{item.date}</span>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-full px-3 py-2 bg-gray-100 text-center rounded-lg hover:bg-gray-200 mb-2 text-sm">
                  <ExternalLink className="w-4 h-4 inline mr-1" />
                  기사보기
                </a>
                <button
                  onClick={() => translations[idx] ? setTranslations(prev => { const n = {...prev}; delete n[idx]; return n; }) : translateNews(item, idx)}
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 font-medium ${translations[idx] ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                >
                  {translations[idx] ? '📄 원문 보기' : '🌐 한글로 번역'}
                </button>

                <button
                  onClick={() => analyzeNews(item, idx)}
                  disabled={analyzingId === idx}
                  className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                >
                  {analyzingId === idx ? '⏳ 분석 중...' : analysis[idx] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                </button>

                {analysis[idx] && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-green-600">🚗</span>
                      현대자동차 전략 분석 리포트
                    </h4>

                    {analysis[idx].summary && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                        <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                        <p className="text-gray-700">{analysis[idx].summary}</p>
                      </div>
                    )}

                    {analysis[idx].marketImpact && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                        <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                        <p className="text-gray-700">{analysis[idx].marketImpact}</p>
                      </div>
                    )}

                    {analysis[idx].opportunities && analysis[idx].opportunities.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                          📈 전략적 기회 요인
                        </h5>
                        <div className="space-y-2">
                          {analysis[idx].opportunities.map((opp, i) => (
                            <div key={`analysis-${idx}-opp-${i}`} className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1">
                                  <span className="inline-block px-2 py-0.5 bg-green-600 text-white rounded text-xs font-semibold mb-1">
                                    {opp.category}
                                  </span>
                                  <p className="font-semibold text-gray-800">{opp.point}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                                  opp.impact === 'high' ? 'bg-green-200 text-green-800' :
                                  opp.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                  'bg-blue-200 text-blue-800'
                                }`}>
                                  영향도: {opp.impact === 'high' ? '높음' : opp.impact === 'medium' ? '중간' : '낮음'}
                                </span>
                              </div>
                              {opp.details && opp.details.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs font-semibold text-gray-600 mb-1">세부 내용:</p>
                                  <ul className="text-xs text-gray-700 space-y-0.5 ml-3">
                                    {opp.details.map((detail, j) => (
                                      <li key={j} className="list-disc">{detail}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-green-200">
                                <span>⏱️ {opp.timeframe}</span>
                                <span className="text-green-700 font-medium">💡 {opp.expectedBenefit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis[idx].risks && analysis[idx].risks.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                          ⚠️ 주요 리스크 요인
                        </h5>
                        <div className="space-y-2">
                          {analysis[idx].risks.map((risk, i) => (
                            <div key={`analysis-${idx}-risk-${i}`} className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1">
                                  <span className="inline-block px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold mb-1">
                                    {risk.category}
                                  </span>
                                  <p className="font-semibold text-gray-800">{risk.point}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                                  risk.severity === 'high' ? 'bg-red-200 text-red-800' :
                                  risk.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                                  'bg-yellow-200 text-yellow-800'
                                }`}>
                                  심각도: {risk.severity === 'high' ? '높음' : risk.severity === 'medium' ? '중간' : '낮음'}
                                </span>
                              </div>
                              {risk.details && risk.details.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs font-semibold text-gray-600 mb-1">세부 내용:</p>
                                  <ul className="text-xs text-gray-700 space-y-0.5 ml-3">
                                    {risk.details.map((detail, j) => (
                                      <li key={j} className="list-disc">{detail}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="bg-red-100 rounded p-2 mt-2">
                                <p className="text-xs font-semibold text-red-800 mb-1">🛡️ 대응 방안:</p>
                                <p className="text-xs text-gray-700">{risk.mitigationPlan}</p>
                              </div>
                              <div className="text-xs text-gray-600 mt-2">
                                <span>⏱️ 대응 시점: {risk.timeframe}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis[idx].strategicImplications && analysis[idx].strategicImplications.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 text-sm">
                        <p className="font-semibold text-purple-800 mb-2 flex items-center gap-1">
                          🎯 전략적 시사점
                        </p>
                        <ul className="space-y-1 ml-3">
                          {analysis[idx].strategicImplications.map((impl, i) => (
                            <li key={i} className="text-gray-700 text-xs list-disc">{impl}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis[idx].actionItems && analysis[idx].actionItems.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-amber-800 mb-2 flex items-center gap-1">
                          ✅ 실행 과제
                        </p>
                        <ul className="space-y-1 ml-3">
                          {analysis[idx].actionItems.map((action, i) => (
                            <li key={i} className="text-gray-700 text-xs list-disc">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {!loading && !error && news.length === 0 && viewMode === 'general' && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600 text-lg">뉴스를 찾을 수 없습니다.</p>
            <p className="text-gray-500 text-sm mt-2">다른 카테고리를 선택하거나 새로고침해보세요.</p>
          </div>
        )}

        {/* 아카이브 뷰 */}
        {viewMode === 'archive' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-4xl">📂</span>
                아카이브된 기사
                <span className="text-lg font-normal text-gray-500">총 {archivedArticles.length}개</span>
              </h2>

              {/* 카테고리별 탭 */}
              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                <button
                  onClick={() => setActiveCategoryTab('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeCategoryTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체 ({archivedArticles.length})
                </button>
                <button
                  onClick={() => setActiveCategoryTab('geopolitics')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeCategoryTab === 'geopolitics'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🌍 지정학 ({archivedArticles.filter(a => a.category === 'geopolitics').length})
                </button>
                <button
                  onClick={() => setActiveCategoryTab('economy')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeCategoryTab === 'economy'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  💰 미국경제 ({archivedArticles.filter(a => a.category === 'economy').length})
                </button>
                <button
                  onClick={() => setActiveCategoryTab('automotive')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeCategoryTab === 'automotive'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🚗 자동차 ({archivedArticles.filter(a => a.category === 'automotive').length})
                </button>
                <button
                  onClick={() => setActiveCategoryTab('ai-tech')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeCategoryTab === 'ai-tech'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🤖 AI/자율주행 ({archivedArticles.filter(a => a.category === 'ai-tech').length})
                </button>
              </div>

              {archivedArticles.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">아카이브된 기사가 없습니다.</p>
                  <p className="text-gray-400 text-sm mt-2">뉴스 기사를 선택하고 아카이브하세요.</p>
                </div>
              ) : (
                <>
                  {/* 지정학 카테고리 */}
                  {(activeCategoryTab === 'all' || activeCategoryTab === 'geopolitics') && archivedArticles.filter(a => a.category === 'geopolitics').length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b-2 border-blue-200 pb-2">
                        <span>🌍</span>
                        지정학
                        <span className="text-sm font-normal text-gray-500">({archivedArticles.filter(a => a.category === 'geopolitics').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'geopolitics');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`geopolitics-${date}`} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span>📅</span>{date}
                              <span className="text-sm font-normal text-gray-500">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border-2 border-blue-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-md font-bold text-gray-800 flex-1">
                                        {translations[archiveItemKey] ? translations[archiveItemKey].title : article.title}
                                      </h5>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="ml-2 text-red-500 hover:text-red-700 text-xl" title="삭제">×</button>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-3">{translations[archiveItemKey] ? translations[archiveItemKey].summary : (article.summary || article.description || '요약 없음')}</p>
                                    <div className="flex items-center justify-between text-xs mb-3">
                                      <span className="text-gray-600">📰 {article.source?.name || article.source}</span>
                                      <span className="text-indigo-600 font-semibold">📅 {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    <div className="space-y-2">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block w-full px-4 py-3 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
                                        <ExternalLink className="w-4 h-4 inline mr-1" />기사 원문 보기
                                      </a>
                                      <button type="button" onClick={() => translations[archiveItemKey] ? setTranslations(prev => { const n = {...prev}; delete n[archiveItemKey]; return n; }) : translateNews(article, archiveItemKey)} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                                        {translations[archiveItemKey] ? '📄 원문 보기' : '🌐 한글로 번역'}
                                      </button>
                                      <button type="button" onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium transition-colors">
                                        {analyzingId === archiveItemKey ? '⏳ 분석 중...' : analysis[archiveItemKey] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          console.log('🔄 [분석정리] Navigating to Issue Analysis with article:');
                                          console.log('  Title:', article.title);
                                          console.log('  URL:', article.url);
                                          setIssueArticleData({ url: article.url, title: article.title });
                                          setViewMode('issue');
                                        }}
                                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                                      >
                                        <BookOpen className="w-4 h-4 inline mr-1" />
                                        분석정리
                                      </button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="mt-4 border-t pt-4">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="text-green-600">🚗</span>현대자동차 전략 분석 리포트</h4>
                                        {analysis[archiveItemKey].summary && (
                                          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                                            <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].summary}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].marketImpact && (
                                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                                            <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].marketImpact}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* 미국경제 카테고리 */}
                  {(activeCategoryTab === 'all' || activeCategoryTab === 'economy') && archivedArticles.filter(a => a.category === 'economy').length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b-2 border-green-200 pb-2">
                        <span>💰</span>
                        미국경제
                        <span className="text-sm font-normal text-gray-500">({archivedArticles.filter(a => a.category === 'economy').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'economy');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`economy-${date}`} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span>📅</span>{date}
                              <span className="text-sm font-normal text-gray-500">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-md font-bold text-gray-800 flex-1">
                                        {translations[archiveItemKey] ? translations[archiveItemKey].title : article.title}
                                      </h5>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="ml-2 text-red-500 hover:text-red-700 text-xl" title="삭제">×</button>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-3">{translations[archiveItemKey] ? translations[archiveItemKey].summary : (article.summary || article.description || '요약 없음')}</p>
                                    <div className="flex items-center justify-between text-xs mb-3">
                                      <span className="text-gray-600">📰 {article.source?.name || article.source}</span>
                                      <span className="text-indigo-600 font-semibold">📅 {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    <div className="space-y-2">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block w-full px-4 py-3 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
                                        <ExternalLink className="w-4 h-4 inline mr-1" />기사 원문 보기
                                      </a>
                                      <button type="button" onClick={() => translations[archiveItemKey] ? setTranslations(prev => { const n = {...prev}; delete n[archiveItemKey]; return n; }) : translateNews(article, archiveItemKey)} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                                        {translations[archiveItemKey] ? '📄 원문 보기' : '🌐 한글로 번역'}
                                      </button>
                                      <button type="button" onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium transition-colors">
                                        {analyzingId === archiveItemKey ? '⏳ 분석 중...' : analysis[archiveItemKey] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          console.log('🔄 [분석정리] Navigating to Issue Analysis with article:');
                                          console.log('  Title:', article.title);
                                          console.log('  URL:', article.url);
                                          setIssueArticleData({ url: article.url, title: article.title });
                                          setViewMode('issue');
                                        }}
                                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                                      >
                                        <BookOpen className="w-4 h-4 inline mr-1" />
                                        분석정리
                                      </button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="mt-4 border-t pt-4">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="text-green-600">🚗</span>현대자동차 전략 분석 리포트</h4>
                                        {analysis[archiveItemKey].summary && (
                                          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                                            <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].summary}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].marketImpact && (
                                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                                            <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].marketImpact}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* AI/자율주행 카테고리 */}
                  {(activeCategoryTab === 'all' || activeCategoryTab === 'ai-tech') && archivedArticles.filter(a => a.category === 'ai-tech').length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b-2 border-purple-200 pb-2">
                        <span>🤖</span>
                        AI/자율주행
                        <span className="text-sm font-normal text-gray-500">({archivedArticles.filter(a => a.category === 'ai-tech').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'ai-tech');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`ai-tech-${date}`} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span>📅</span>{date}
                              <span className="text-sm font-normal text-gray-500">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-md font-bold text-gray-800 flex-1">
                                        {translations[archiveItemKey] ? translations[archiveItemKey].title : article.title}
                                      </h5>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="ml-2 text-red-500 hover:text-red-700 text-xl" title="삭제">×</button>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-3">{translations[archiveItemKey] ? translations[archiveItemKey].summary : (article.summary || article.description || '요약 없음')}</p>
                                    <div className="flex items-center justify-between text-xs mb-3">
                                      <span className="text-gray-600">📰 {article.source?.name || article.source}</span>
                                      <span className="text-indigo-600 font-semibold">📅 {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    <div className="space-y-2">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block w-full px-4 py-3 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
                                        <ExternalLink className="w-4 h-4 inline mr-1" />기사 원문 보기
                                      </a>
                                      <button type="button" onClick={() => translations[archiveItemKey] ? setTranslations(prev => { const n = {...prev}; delete n[archiveItemKey]; return n; }) : translateNews(article, archiveItemKey)} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                                        {translations[archiveItemKey] ? '📄 원문 보기' : '🌐 한글로 번역'}
                                      </button>
                                      <button type="button" onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium transition-colors">
                                        {analyzingId === archiveItemKey ? '⏳ 분석 중...' : analysis[archiveItemKey] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          console.log('🔄 [분석정리] Navigating to Issue Analysis with article:');
                                          console.log('  Title:', article.title);
                                          console.log('  URL:', article.url);
                                          setIssueArticleData({ url: article.url, title: article.title });
                                          setViewMode('issue');
                                        }}
                                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                                      >
                                        <BookOpen className="w-4 h-4 inline mr-1" />
                                        분석정리
                                      </button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="mt-4 border-t pt-4">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="text-green-600">🚗</span>현대자동차 전략 분석 리포트</h4>
                                        {analysis[archiveItemKey].summary && (
                                          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                                            <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].summary}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].marketImpact && (
                                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                                            <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].marketImpact}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* 자동차 카테고리 - 회사별 하위 탭 */}
                  {(activeCategoryTab === 'all' || activeCategoryTab === 'automotive') && archivedArticles.filter(a => a.category === 'automotive').length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b-2 border-orange-200 pb-2">
                        <span>🚗</span>
                        자동차
                        <span className="text-sm font-normal text-gray-500">({archivedArticles.filter(a => a.category === 'automotive').length}개 기사)</span>
                      </h3>

                      {/* 회사별 하위 탭 (자동차 탭에서만) */}
                      {activeCategoryTab === 'automotive' && (
                        <div className="mb-6 pb-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setActiveCompanyTab('all')}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                activeCompanyTab === 'all'
                                  ? 'bg-orange-500 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              전체
                            </button>
                            {autoCompanies.map(company => {
                              const count = archivedArticles.filter(a => a.category === 'automotive' && a.companyId === company.id).length;
                              if (count === 0) return null;
                              return (
                                <button
                                  key={company.id}
                                  onClick={() => setActiveCompanyTab(company.id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                    activeCompanyTab === company.id
                                      ? 'bg-orange-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {company.name} ({count})
                                </button>
                              );
                            })}
                            {archivedArticles.filter(a => a.category === 'automotive' && a.companyId === 'industry').length > 0 && (
                              <button
                                onClick={() => setActiveCompanyTab('industry')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                  activeCompanyTab === 'industry'
                                    ? 'bg-orange-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                산업 공통 ({archivedArticles.filter(a => a.category === 'automotive' && a.companyId === 'industry').length})
                              </button>
                            )}
                          </div>
                          {/* 자동 매핑 버튼 */}
                          <div className="flex justify-end">
                            <button
                              onClick={autoMapCompanyIds}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              🔄 회사별 자동 분류 실행
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 자동차 기사 표시 */}
                      {(() => {
                        let filteredArticles = archivedArticles.filter(a => a.category === 'automotive');

                        // 자동차 탭에서 회사별 필터링 적용
                        if (activeCategoryTab === 'automotive' && activeCompanyTab !== 'all') {
                          filteredArticles = filteredArticles.filter(a => a.companyId === activeCompanyTab);
                        }

                        if (filteredArticles.length === 0) return null;

                        // 날짜별로 그룹화
                        const articlesByDate = {};
                        filteredArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });

                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`automotive-${date}`} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span>📅</span>{date}
                              <span className="text-sm font-normal text-gray-500">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-md font-bold text-gray-800 flex-1">
                                        {translations[archiveItemKey] ? translations[archiveItemKey].title : article.title}
                                      </h5>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="ml-2 text-red-500 hover:text-red-700 text-xl" title="삭제">×</button>
                                    </div>
                                    {article.company && (
                                      <div className="mb-2">
                                        <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                                          {article.company}
                                        </span>
                                      </div>
                                    )}
                                    <p className="text-gray-600 text-sm mb-3">{translations[archiveItemKey] ? translations[archiveItemKey].summary : (article.summary || article.description || '요약 없음')}</p>
                                    <div className="flex items-center justify-between text-xs mb-3">
                                      <span className="text-gray-600">📰 {article.source?.name || article.source}</span>
                                      <span className="text-indigo-600 font-semibold">📅 {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                                    </div>

                                    <div className="space-y-2">
                                      <a
                                        href={article.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full px-4 py-3 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                                      >
                                        <ExternalLink className="w-4 h-4 inline mr-1" />
                                        기사 원문 보기
                                      </a>

                                      <button
                                        type="button"
                                        onClick={() => translations[archiveItemKey] ? setTranslations(prev => { const n = {...prev}; delete n[archiveItemKey]; return n; }) : translateNews(article, archiveItemKey)}
                                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                                      >
                                        {translations[archiveItemKey] ? '📄 원문 보기' : '🌐 한글로 번역'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => analyzeNews(article, archiveItemKey)}
                                        disabled={analyzingId === archiveItemKey}
                                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
                                      >
                                        {analyzingId === archiveItemKey ? '⏳ 분석 중...' : analysis[archiveItemKey] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                                      </button>
                                    </div>

                                    {analysis[archiveItemKey] && (
                                      <div className="mt-4 border-t pt-4">
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                          <span className="text-green-600">🚗</span>
                                          현대자동차 전략 분석 리포트
                                        </h4>

                                        {analysis[archiveItemKey].summary && (
                                          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                                            <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].summary}</p>
                                          </div>
                                        )}

                                        {analysis[archiveItemKey].marketImpact && (
                                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                                            <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                                            <p className="text-gray-700">{analysis[archiveItemKey].marketImpact}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 자동차 회사별 뉴스 뷰 */}
        {!loading && !error && viewMode === 'automotive' && Object.keys(autoNewsData).length > 0 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-4xl">🚗</span>
                경쟁사 분석
              </h2>

              {/* 회사별 탭 */}
              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                <button
                  onClick={() => setActiveCompanyTab('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeCompanyTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {autoCompanies.map(company => {
                  const count = (autoNewsData[company.id] || []).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={company.id}
                      onClick={() => setActiveCompanyTab(company.id)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        activeCompanyTab === company.id
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {company.name} ({count})
                    </button>
                  );
                })}
                {autoNewsData['industry'] && autoNewsData['industry'].length > 0 && (
                  <button
                    onClick={() => setActiveCompanyTab('industry')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      activeCompanyTab === 'industry'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    산업 공통 ({autoNewsData['industry'].length})
                  </button>
                )}
              </div>

              {/* 수집 기간 선택 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600 font-medium">수집 기간:</span>
                <button
                  onClick={() => { setTimeRange('day'); loadAutomotiveNews('day'); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    timeRange === 'day'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  최근 2일
                </button>
                <button
                  onClick={() => { setTimeRange('week'); loadAutomotiveNews('week'); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    timeRange === 'week'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  일주일 전
                </button>
              </div>
            </div>

            {/* 자동차 산업 공통 뉴스 섹션 */}
            {(activeCompanyTab === 'all' || activeCompanyTab === 'industry') && autoNewsData['industry'] && autoNewsData['industry'].length > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl shadow-xl p-6 border-2 border-indigo-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">🏭</span>
                  자동차 산업 주요 뉴스
                  <span className="text-sm font-normal text-gray-500 ml-2">(업계 공통)</span>
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                  {autoNewsData['industry'].map((item, idx) => {
                    const itemKey = `industry-${idx}`;
                    const isSelected = selectedArticles.has(itemKey);
                    return (
                      <div key={itemKey} className="bg-white rounded-xl p-4 border border-indigo-200 shadow-sm relative">
                        <div className="absolute top-2 right-2 z-[100]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleArticleSelection(itemKey, item, 'industry');
                            }}
                            className={`w-8 h-8 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all shadow-lg hover:scale-125 ${
                              isSelected
                                ? 'bg-white border-red-500'
                                : 'bg-white border-gray-400 hover:border-red-400'
                            }`}
                          >
                            {isSelected ? (
                              <svg className="w-6 h-6 text-red-600 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-4 h-4 bg-gray-200 rounded-sm"></div>
                            )}
                          </button>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2 pr-12">
                          {translations[itemKey] ? translations[itemKey].title : item.title}
                        </h3>
                        <p className="text-gray-600 mb-3 text-sm">
                          {translations[itemKey] ? translations[itemKey].summary : item.summary}
                        </p>
                        <div className="flex items-center justify-between text-xs mb-3 text-gray-500">
                          <span>{item.source}</span>
                          <span>{item.date}</span>
                        </div>

                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-full px-3 py-2 bg-gray-100 text-center rounded-lg hover:bg-gray-200 mb-2 text-sm">
                          <ExternalLink className="w-4 h-4 inline mr-1" />
                          기사보기
                        </a>

                        <button
                          onClick={() => translations[itemKey] ? setTranslations(prev => { const n = {...prev}; delete n[itemKey]; return n; }) : translateNews(item, itemKey)}
                          className={`w-full px-3 py-2 rounded-lg text-sm mb-2 font-medium ${translations[itemKey] ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                        >
                          {translations[itemKey] ? '📄 원문 보기' : '🌐 한글로 번역'}
                        </button>

                        <button
                          onClick={() => analyzeNews(item, itemKey)}
                          disabled={analyzingId === itemKey}
                          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                        >
                          {analyzingId === itemKey ? '⏳ 분석 중...' : analysis[itemKey] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                        </button>

                        {analysis[itemKey] && (
                          <div className="mt-4 border-t pt-4">
                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                              <span className="text-green-600">🚗</span>
                              현대자동차 전략 분석 리포트
                            </h4>

                            {analysis[itemKey].summary && (
                              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                                <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                                <p className="text-gray-700">{analysis[itemKey].summary}</p>
                              </div>
                            )}

                            {analysis[itemKey].marketImpact && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                                <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                                <p className="text-gray-700">{analysis[itemKey].marketImpact}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {autoCompanies.filter(company =>
              activeCompanyTab === 'all' || activeCompanyTab === company.id
            ).map(company => {
              const companyNews = autoNewsData[company.id] || [];
              if (companyNews.length === 0) return null;

              return (
                <div key={company.id} className="bg-white rounded-2xl shadow-xl p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-3xl">🚗</span>
                    {company.name} 뉴스
                  </h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    {companyNews.map((item, idx) => {
                      const itemKey = `${company.id}-${idx}`;
                      const isSelected = selectedArticles.has(itemKey);
                      return (
                        <div key={itemKey} className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative">
                          <div className="absolute top-2 right-2 z-[100]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleArticleSelection(itemKey, item, company.id);
                              }}
                              className={`w-8 h-8 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all shadow-lg hover:scale-125 ${
                                isSelected
                                  ? 'bg-white border-red-500'
                                  : 'bg-white border-gray-400 hover:border-red-400'
                              }`}
                            >
                              {isSelected ? (
                                <svg className="w-6 h-6 text-red-600 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <div className="w-4 h-4 bg-gray-200 rounded-sm"></div>
                              )}
                            </button>
                          </div>
                          <h3 className="text-lg font-bold text-gray-800 mb-2 pr-12">
                            {translations[itemKey] ? translations[itemKey].title : item.title}
                          </h3>
                          <p className="text-gray-600 mb-3 text-sm">
                            {translations[itemKey] ? translations[itemKey].summary : item.summary}
                          </p>
                          <div className="flex items-center justify-between text-xs mb-3 text-gray-500">
                            <span>{item.source}</span>
                            <span>{item.date}</span>
                          </div>

                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-full px-3 py-2 bg-gray-100 text-center rounded-lg hover:bg-gray-200 mb-2 text-sm">
                            <ExternalLink className="w-4 h-4 inline mr-1" />
                            기사보기
                          </a>

                          <button
                            onClick={() => translations[itemKey] ? setTranslations(prev => { const n = {...prev}; delete n[itemKey]; return n; }) : translateNews(item, itemKey)}
                            className={`w-full px-3 py-2 rounded-lg text-sm mb-2 font-medium ${translations[itemKey] ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                          >
                            {translations[itemKey] ? '📄 원문 보기' : '🌐 한글로 번역'}
                          </button>

                          <button
                            onClick={() => analyzeNews(item, itemKey)}
                            disabled={analyzingId === itemKey}
                            className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                          >
                            {analyzingId === itemKey ? '⏳ 분석 중...' : analysis[itemKey] ? '👁️ 분석 숨기기' : '📊 현대차 관점 분석'}
                          </button>

                          {analysis[itemKey] && (
                            <div className="mt-4 border-t pt-4">
                              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <span className="text-green-600">🚗</span>
                                현대자동차 전략 분석 리포트
                              </h4>

                              {analysis[itemKey].summary && (
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 text-sm">
                                  <p className="font-semibold text-blue-800 mb-1">📊 종합 요약</p>
                                  <p className="text-gray-700">{analysis[itemKey].summary}</p>
                                </div>
                              )}

                              {analysis[itemKey].marketImpact && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3 text-sm">
                                  <p className="font-semibold text-indigo-800 mb-1">🎯 시장 영향 평가</p>
                                  <p className="text-gray-700">{analysis[itemKey].marketImpact}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI 채팅 플로팅 버튼 */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all z-50 flex items-center gap-2"
        title="AI 뉴스 분석 채팅"
      >
        <MessageCircle className="w-6 h-6" />
        {!chatOpen && <span className="text-sm font-semibold pr-1">AI 분석</span>}
      </button>

      {/* AI 채팅 모달 */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border-2 border-indigo-200">
          {/* 헤더 */}
          <div className="bg-indigo-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <h3 className="font-bold">AI 뉴스 분석</h3>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="hover:bg-indigo-700 p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 채팅 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">현재 페이지의 뉴스에 대해</p>
                <p className="text-sm">무엇이든 물어보세요!</p>
                <div className="mt-4 space-y-2 text-xs text-left bg-gray-50 p-3 rounded-lg">
                  <p className="font-semibold text-gray-700">예시 질문:</p>
                  <p className="text-gray-600">• 주요 뉴스 3가지 요약해줘</p>
                  <p className="text-gray-600">• 이 뉴스들의 공통점은?</p>
                  <p className="text-gray-600">• 한국에 미치는 영향은?</p>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={chatLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
