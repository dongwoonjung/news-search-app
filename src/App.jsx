import React, { useState, useEffect } from 'react';
import { Newspaper, Globe, TrendingUp, RefreshCw, Calendar, ExternalLink, Clock } from 'lucide-react';
import { newsApi, analyzeForHyundai } from './services/newsApi';
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
  const [overallAnalysis, setOverallAnalysis] = useState(null);
  const [analyzingOverall, setAnalyzingOverall] = useState(false);
  const [viewMode, setViewMode] = useState('general'); // 'general', 'automotive', or 'archive'
  const [autoNewsData, setAutoNewsData] = useState({});
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [archivedArticles, setArchivedArticles] = useState(() => {
    // localStorage에서 아카이브된 기사 불러오기
    try {
      const saved = localStorage.getItem('archivedArticles');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load archived articles:', error);
      return [];
    }
  });
  const [activeArchiveTab, setActiveArchiveTab] = useState('all');
  const [activeCompanyTab, setActiveCompanyTab] = useState('all');
  const [newsSource, setNewsSource] = useState('google'); // 'newsapi', 'naver', 'google', 'bing', 'all'

  const categories = [
    { id: 'geopolitics', name: '지정학', icon: Globe },
    { id: 'economy', name: '미국 경제', icon: TrendingUp },
    { id: 'automotive', name: '자동차', icon: Newspaper },
    { id: 'ai-tech', name: 'AI/자율주행', icon: TrendingUp },
  ];

  const autoCompanies = [
    { id: 'hyundai', name: '현대자동차', keywords: '"Hyundai Motor" OR "Hyundai Motors" OR "Hyundai EV"' },
    { id: 'kia', name: '기아', keywords: '"Kia Motors" OR "Kia Corp" OR "Kia Corporation" OR "Kia EV"' },
    { id: 'toyota', name: '도요타', keywords: '"Toyota Motor" OR "Toyota" OR "Toyota EV" OR "Toyota hybrid"' },
    { id: 'tesla', name: '테슬라', keywords: 'Tesla OR "Elon Musk" OR Cybertruck OR "Tesla Model"' },
    { id: 'ford', name: '포드', keywords: '"Ford Motor" OR "Ford F-150" OR "Ford EV" OR "Ford electric"' },
    { id: 'gm', name: 'GM', keywords: '"General Motors" OR "GM" OR Cadillac OR "Chevrolet electric"' },
    { id: 'bmw', name: 'BMW', keywords: 'BMW OR "BMW electric" OR "BMW EV" OR "BMW iX"' },
    { id: 'mercedes', name: '벤츠', keywords: '"Mercedes-Benz" OR Mercedes OR "Mercedes EQ" OR "Mercedes electric"' },
    { id: 'stellantis', name: '스텔란티스', keywords: 'Stellantis OR Jeep OR Peugeot OR Fiat OR Chrysler' },
  ];

  useEffect(() => {
    // 초기 마운트 시 안전하게 로드
    const timer = setTimeout(() => {
      loadNews('geopolitics', 'day');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // 아카이브된 기사가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem('archivedArticles', JSON.stringify(archivedArticles));
    } catch (error) {
      console.error('Failed to save archived articles:', error);
    }
  }, [archivedArticles]);

  const loadAutomotiveNews = async (range = timeRange, source = newsSource) => {
    console.log(`🔍 loadAutomotiveNews called with range: ${range}, source: ${source}`);
    setLoading(true);
    setError(null);
    setAnalysis({});
    setTranslations({});
    setAnalyzingId(null);
    setOverallAnalysis(null);

    try {
      const companiesData = {};
      const allCompanyArticles = {};

      // 개발 환경에서도 배포된 Vercel URL 사용
      const isDev = import.meta.env.DEV;
      const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

      // 1. 각 자동차 회사별로 뉴스 가져오기
      for (const company of autoCompanies) {
        try {
          let url, response, data;

          if (source === 'google') {
            // Google News RSS 사용
            const companyQuery = company.keywords.replace(/"/g, '').replace(/ OR /g, ' ');
            url = `${apiBaseUrl}/api/google-news?query=${encodeURIComponent(companyQuery)}&count=10`;
            console.log(`📡 Fetching ${company.name} from Google News`);

            response = await fetch(url, {
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });

            if (response.ok) {
              data = await response.json();
              if (data.success && data.articles.length > 0) {
                console.log(`✅ ${company.name}: ${data.articles.length} articles received from Google News`);
                allCompanyArticles[company.id] = data.articles.map(article => ({
                  title: article.title,
                  summary: article.summary,
                  date: article.date,
                  source: article.source,
                  importance: 'medium',
                  url: article.url,
                  publishedAt: article.publishedAt
                }));
              }
            }
          } else {
            // NewsAPI 사용 (기존 코드)
            url = `${apiBaseUrl}/api/news?category=automotive&company=${encodeURIComponent(company.keywords)}&timeRange=${range}`;
            console.log(`📡 Fetching ${company.name} from NewsAPI with timeRange=${range}`);

            response = await fetch(url, {
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });

            if (response.ok) {
              data = await response.json();
              if (data.success && data.articles.length > 0) {
                console.log(`✅ ${company.name}: ${data.articles.length} articles received from NewsAPI`);
                if (data.articles.length > 0) {
                  console.log(`   📅 First: ${data.articles[0].publishedAt}, Last: ${data.articles[data.articles.length - 1].publishedAt}`);
                }
                allCompanyArticles[company.id] = data.articles.slice(0, 10).map(article => ({
                  title: article.title,
                  summary: article.description || article.content?.substring(0, 200) + '...',
                  date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  source: article.source.name,
                  importance: 'medium',
                  url: article.url,
                  publishedAt: article.publishedAt
                }));
              }
            }
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

      // 3. 공통 뉴스 섹션 생성 (내용 유사도 체크로 중복 제거)
      const industryArticles = [];
      const seenUrls = new Set();

      // 내용 유사도 체크 함수 (제목과 요약 비교)
      const isSimilarContent = (article1, article2) => {
        // URL이 같으면 동일한 기사
        if (article1.url === article2.url) return true;

        // 제목 유사도 체크 (단어 기반)
        const title1Words = article1.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
        const title2Words = article2.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);

        const commonTitleWords = title1Words.filter(w => title2Words.includes(w));
        const titleSimilarity = commonTitleWords.length / Math.max(title1Words.length, title2Words.length);

        // 제목이 70% 이상 유사하면 중복으로 간주
        if (titleSimilarity >= 0.7) return true;

        // 요약 유사도 체크
        if (article1.summary && article2.summary) {
          const summary1Words = article1.summary.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
          const summary2Words = article2.summary.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);

          const commonSummaryWords = summary1Words.filter(w => summary2Words.includes(w));
          const summarySimilarity = commonSummaryWords.length / Math.max(summary1Words.length, summary2Words.length);

          // 요약이 60% 이상 유사하면 중복으로 간주
          if (summarySimilarity >= 0.6) return true;
        }

        return false;
      };

      Object.values(allCompanyArticles).forEach(articles => {
        articles.forEach(article => {
          if (commonArticles.has(article.url) && !seenUrls.has(article.url)) {
            // 이미 추가된 기사들과 내용 유사도 체크
            const isDuplicate = industryArticles.some(existingArticle =>
              isSimilarContent(article, existingArticle)
            );

            if (!isDuplicate) {
              industryArticles.push(article);
              seenUrls.add(article.url);
            }
          }
        });
      });

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

  const loadNews = async (cat, range, source = newsSource) => {
    setLoading(true);
    setError(null);
    setViewMode('general');
    // 새 뉴스 로드 시 기존 분석/번역 초기화
    setAnalysis({});
    setTranslations({});
    setAnalyzingId(null);
    setOverallAnalysis(null);

    try {
      const result = await newsApi.searchByCategory(cat, range, source);

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
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          summary: item.summary,
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

      const response = await fetch(`${apiBaseUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          summary: item.summary
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
            summary: `[번역 실패] ${item.summary}`
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
          summary: `[오류] ${item.summary}`
        }
      }));
    }
  };

  const analyzeOverallNews = () => {
    setAnalyzingOverall(true);
    setTimeout(() => {
      const allOpportunities = [];
      const allRisks = [];

      news.forEach(item => {
        const itemAnalysis = analyzeForHyundai(item);
        if (itemAnalysis.opportunities) {
          itemAnalysis.opportunities.forEach(opp => {
            allOpportunities.push({ ...opp, source: item.title });
          });
        }
        if (itemAnalysis.risks) {
          itemAnalysis.risks.forEach(risk => {
            allRisks.push({ ...risk, source: item.title });
          });
        }
      });

      allOpportunities.sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return (order[b.impact] || 0) - (order[a.impact] || 0);
      });

      allRisks.sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return (order[b.severity] || 0) - (order[a.severity] || 0);
      });

      setOverallAnalysis({
        opportunities: allOpportunities,
        risks: allRisks,
        summary: `현재 ${news.length}개 뉴스 분석 결과: ${allOpportunities.length}개 기회, ${allRisks.length}개 리스크 도출`
      });
      setAnalyzingOverall(false);
    }, 1500);
  };

  const toggleArticleSelection = (articleKey, articleData, companyId) => {
    setSelectedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleKey)) {
        newSet.delete(articleKey);
      } else {
        newSet.add(articleKey);
      }
      return newSet;
    });
  };

  const archiveSelectedArticles = () => {
    const articlesToArchive = [];

    // 선택된 기사들을 수집
    Object.keys(autoNewsData).forEach(companyId => {
      const companyNews = autoNewsData[companyId] || [];
      companyNews.forEach((article, idx) => {
        const articleKey = `${companyId}-${idx}`;
        if (selectedArticles.has(articleKey)) {
          articlesToArchive.push({
            ...article,
            company: companyId === 'industry' ? '산업 공통' : autoCompanies.find(c => c.id === companyId)?.name || companyId,
            companyId: companyId,
            archivedDate: new Date().toISOString(),
            articleKey: articleKey
          });
        }
      });
    });

    if (articlesToArchive.length > 0) {
      setArchivedArticles(prev => [...prev, ...articlesToArchive]);
      setSelectedArticles(new Set()); // 선택 초기화
      alert(`${articlesToArchive.length}개 기사가 아카이브되었습니다.`);
    } else {
      alert('선택된 기사가 없습니다.');
    }
  };

  const viewArchive = () => {
    setViewMode('archive');
  };

  const removeFromArchive = (articleKey) => {
    setArchivedArticles(prev => prev.filter(article => article.articleKey !== articleKey));
  };

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
                onClick={analyzeOverallNews}
                disabled={analyzingOverall || news.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {analyzingOverall ? '⏳ 분석 중...' : '📊 전체 뉴스 종합 분석'}
              </button>
              <button
                onClick={() => loadAutomotiveNews(timeRange, newsSource)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center font-semibold shadow-md"
              >
                🚗 경쟁사 분석
              </button>
              {(viewMode === 'general' || viewMode === 'automotive') && (
                <button
                  onClick={viewArchive}
                  className="px-4 py-2 bg-violet-700 text-white rounded-lg hover:bg-violet-800 flex items-center font-semibold shadow-md"
                >
                  📂 아카이브 보기 ({archivedArticles.length})
                </button>
              )}
              {viewMode === 'automotive' && (
                <button
                  onClick={archiveSelectedArticles}
                  disabled={selectedArticles.size === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center font-semibold shadow-md"
                >
                  📚 선택 아카이브 ({selectedArticles.size})
                </button>
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
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Newspaper className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 font-medium">뉴스 소스:</span>
            <button
              onClick={() => { setNewsSource('newsapi'); loadNews(category, timeRange, 'newsapi'); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${newsSource === 'newsapi' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              NewsAPI
            </button>
            <button
              onClick={() => { setNewsSource('google'); loadNews(category, timeRange, 'google'); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${newsSource === 'google' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Google News
            </button>
            <span className="text-xs text-gray-400 ml-2">(네이버, Bing은 API 키 필요)</span>
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

        {overallAnalysis && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="bg-green-600 p-3 rounded-xl text-2xl">
                📊
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-800">현대자동차 전체 뉴스 종합 분석</h2>
                <p className="text-gray-500">{overallAnalysis.summary}</p>
              </div>
              <button
                onClick={() => setOverallAnalysis(null)}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
              >
                닫기
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
                  <span className="bg-green-100 p-2 rounded-lg">📈</span>
                  종합 기회 요인
                </h3>
                <div className="space-y-3">
                  {overallAnalysis.opportunities && overallAnalysis.opportunities.length > 0 ? (
                    overallAnalysis.opportunities.map((opp, oppIdx) => (
                      <div key={`overall-opp-${oppIdx}`} className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <p className="font-medium text-gray-800 flex-1">{opp.point}</p>
                          <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                            opp.impact === 'high' ? 'bg-green-200 text-green-800' :
                            opp.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-blue-200 text-blue-800'
                          }`}>
                            {opp.impact === 'high' ? '높음' : opp.impact === 'medium' ? '중간' : '낮음'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate" title={opp.source}>출처: {opp.source}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">분석된 기회 요인이 없습니다.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
                  <span className="bg-red-100 p-2 rounded-lg">⚠️</span>
                  종합 리스크 요인
                </h3>
                <div className="space-y-3">
                  {overallAnalysis.risks && overallAnalysis.risks.length > 0 ? (
                    overallAnalysis.risks.map((risk, riskIdx) => (
                      <div key={`overall-risk-${riskIdx}`} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <p className="font-medium text-gray-800 flex-1">{risk.point}</p>
                          <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                            risk.severity === 'high' ? 'bg-red-200 text-red-800' :
                            risk.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                            'bg-yellow-200 text-yellow-800'
                          }`}>
                            {risk.severity === 'high' ? '높음' : risk.severity === 'medium' ? '중간' : '낮음'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate" title={risk.source}>출처: {risk.source}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">분석된 리스크 요인이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && news.length > 0 && viewMode === 'general' && (
          <div className="grid gap-4 md:grid-cols-2">
            {news.map((item, idx) => (
              <div key={`news-${idx}`} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="text-lg font-bold text-gray-800 flex-1">
                    {translations[idx] ? translations[idx].title : item.title}
                  </h3>
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
            ))}
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

              {/* 회사별 탭 */}
              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                <button
                  onClick={() => setActiveArchiveTab('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeArchiveTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체 ({archivedArticles.length})
                </button>
                {autoCompanies.map(company => {
                  const count = archivedArticles.filter(a => a.companyId === company.id).length;
                  return (
                    <button
                      key={company.id}
                      onClick={() => setActiveArchiveTab(company.id)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        activeArchiveTab === company.id
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {company.name} ({count})
                    </button>
                  );
                })}
                <button
                  onClick={() => setActiveArchiveTab('industry')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeArchiveTab === 'industry'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  산업 공통 ({archivedArticles.filter(a => a.companyId === 'industry').length})
                </button>
              </div>

              {archivedArticles.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">아카이브된 기사가 없습니다.</p>
                  <p className="text-gray-400 text-sm mt-2">경쟁사 분석에서 기사를 선택하고 아카이브하세요.</p>
                </div>
              ) : (
                <>
                  {/* 자동차 회사별로 그룹화 */}
                  {autoCompanies.filter(company =>
                    activeArchiveTab === 'all' || activeArchiveTab === company.id
                  ).map(company => {
                    const companyArticles = archivedArticles.filter(article => article.companyId === company.id);
                    if (companyArticles.length === 0) return null;

                    // 날짜별로 그룹화
                    const articlesByDate = {};
                    companyArticles.forEach(article => {
                      if (!articlesByDate[article.date]) {
                        articlesByDate[article.date] = [];
                      }
                      articlesByDate[article.date].push(article);
                    });

                    return (
                      <div key={`archive-${company.id}`} className="mb-8">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b-2 border-gray-200 pb-2">
                          <span>🚗</span>
                          {company.name}
                          <span className="text-sm font-normal text-gray-500">({companyArticles.length}개 기사)</span>
                        </h3>

                        {Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`${company.id}-${date}`} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span>📅</span>
                              {date}
                              <span className="text-sm font-normal text-gray-500">({articlesByDate[date].length}개)</span>
                            </h4>

                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-md font-bold text-gray-800 flex-1">
                                        {translations[archiveItemKey] ? translations[archiveItemKey].title : article.title}
                                      </h5>
                                      <button
                                        onClick={() => removeFromArchive(article.articleKey)}
                                        className="ml-2 text-red-500 hover:text-red-700 text-xl"
                                        title="삭제"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-3">
                                      {translations[archiveItemKey] ? translations[archiveItemKey].summary : article.summary}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                      <span>📰 {article.source}</span>
                                      <span>🕒 {article.date}</span>
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
                        ))}
                      </div>
                    );
                  })}

                  {/* 산업 공통 뉴스 아카이브 */}
                  {(activeArchiveTab === 'all' || activeArchiveTab === 'industry') && archivedArticles.filter(article => article.companyId === 'industry').length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
                        <span>🏭</span>
                        자동차 산업 공통
                        <span className="text-sm font-normal text-gray-500">
                          ({archivedArticles.filter(article => article.companyId === 'industry').length}개 기사)
                        </span>
                      </h3>

                      {(() => {
                        const industryArticles = archivedArticles.filter(article => article.companyId === 'industry');
                        const articlesByDate = {};
                        industryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) {
                            articlesByDate[article.date] = [];
                          }
                          articlesByDate[article.date].push(article);
                        });

                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`industry-${date}`} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span>📅</span>
                              {date}
                              <span className="text-sm font-normal text-gray-500">({articlesByDate[date].length}개)</span>
                            </h4>

                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-indigo-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-md font-bold text-gray-800 flex-1">
                                        {translations[archiveItemKey] ? translations[archiveItemKey].title : article.title}
                                      </h5>
                                      <button
                                        onClick={() => removeFromArchive(article.articleKey)}
                                        className="ml-2 text-red-500 hover:text-red-700 text-xl"
                                        title="삭제"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-3">
                                      {translations[archiveItemKey] ? translations[archiveItemKey].summary : article.summary}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                      <span>📰 {article.source}</span>
                                      <span>🕒 {article.date}</span>
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
                  onClick={() => { setTimeRange('day'); loadAutomotiveNews('day', newsSource); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    timeRange === 'day'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  최근 2일
                </button>
                <button
                  onClick={() => { setTimeRange('week'); loadAutomotiveNews('week', newsSource); }}
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
                              toggleArticleSelection(itemKey);
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
                                toggleArticleSelection(itemKey);
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
    </div>
  );
}
