import React, { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, MessageCircle, Send, X } from 'lucide-react';
import { newsApi, analyzeForHyundai } from './services/newsApi';
import IssueAnalysis from './IssueAnalysis';
import KeywordManager from './KeywordManager';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

export default function GlobalNewsApp() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [category, setCategory] = useState('geopolitics');
  const [timeRange, setTimeRange] = useState('day');
  const [summaries, setSummaries] = useState({});
  const [analysis, setAnalysis] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [viewMode, setViewMode] = useState('home'); // 'home', 'general', 'automotive', 'archive', 'issue', 'keywords', 'reports', 'custom-reports'
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generateStatus, setGenerateStatus] = useState('');
  const [customReports, setCustomReports] = useState([]);
  const [customReportsLoading, setCustomReportsLoading] = useState(false);
  const [expandedCustomReport, setExpandedCustomReport] = useState(null);
  const [generatingCustomReport, setGeneratingCustomReport] = useState(false);
  const [customGenerateStatus, setCustomGenerateStatus] = useState('');
  const [autoNewsData, setAutoNewsData] = useState({});
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [selectedArticlesData, setSelectedArticlesData] = useState({}); // 아카이브용 선택 기사
  const [reportSelectedArticles, setReportSelectedArticles] = useState(new Set());
  const [reportSelectedArticlesData, setReportSelectedArticlesData] = useState({}); // 리포트용 선택 기사
  const [archivedArticles, setArchivedArticles] = useState([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all'); // 아카이브 카테고리 탭
  const [activeCompanyTab, setActiveCompanyTab] = useState('all');
  const [activeGroupTab, setActiveGroupTab] = useState(null); // 'us' | 'europe' | 'china'
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [issueArticleData, setIssueArticleData] = useState(null); // 이슈 분석에 전달할 기사 데이터
  const [translations, setTranslations] = useState({}); // 한국어 번역 캐시 { idx: { title, summary } }

  const categories = [
    { id: 'geopolitics', name: '지정학', emoji: '🌍' },
    { id: 'economy', name: '미국경제', emoji: '📈' },
    { id: 'automotive-general', name: '자동차', emoji: '🚗' },
    { id: 'ai-tech', name: 'AI/자율주행', emoji: '🤖' },
    { id: 'trade', name: '무역', emoji: '🔄' },
    { id: 'competitor', name: '경쟁사', emoji: '🏁' },
  ];

  const handleCategoryClick = (cat) => {
    if (cat.id === 'competitor') {
      setViewMode('automotive');
      setAutoNewsData({});
      setActiveGroupTab(null);
      setActiveCompanyTab('all');
    } else {
      const apiCatId = cat.id === 'automotive-general' ? 'automotive' : cat.id;
      setCategory(apiCatId);
      setViewMode('general');
      loadNews(apiCatId, timeRange);
    }
  };

  const handleTimeRange = (range) => {
    setTimeRange(range);
    if (viewMode === 'general') loadNews(category, range);
    else if (viewMode === 'automotive' && activeGroupTab) loadAutomotiveNews(activeGroupTab, range);
  };

  const autoCompanyGroups = [
    { id: 'us',     label: '🇺🇸 미국' },
    { id: 'europe', label: '🇪🇺 유럽/일본' },
    { id: 'china',  label: '🇨🇳 중국 OEM' },
  ];

  const autoCompanies = [
    { id: 'tesla',    group: 'us',     name: '테슬라',    keywords: 'Tesla OR "Elon Musk" OR Cybertruck OR "Tesla Model"', koreanKeywords: '테슬라 일론머스크 사이버트럭' },
    { id: 'ford',     group: 'us',     name: '포드',      keywords: '"Ford Motor" OR "Ford F-150" OR "Ford EV" OR "Ford electric"', koreanKeywords: '포드 전기차 F-150' },
    { id: 'gm',       group: 'us',     name: 'GM',        keywords: '"General Motors" OR "GM" OR Cadillac OR "Chevrolet electric"', koreanKeywords: 'GM 제너럴모터스 캐딜락 전기차' },
    { id: 'toyota',   group: 'europe', name: '도요타',    keywords: '"Toyota Motor" OR "Toyota" OR "Toyota EV" OR "Toyota hybrid"', koreanKeywords: '도요타 전기차 하이브리드' },
    { id: 'bmw',      group: 'europe', name: 'BMW',       keywords: 'BMW OR "BMW electric" OR "BMW EV" OR "BMW iX"', koreanKeywords: 'BMW 전기차 iX' },
    { id: 'mercedes', group: 'europe', name: '벤츠',      keywords: '"Mercedes-Benz" OR Mercedes OR "Mercedes EQ" OR "Mercedes electric"', koreanKeywords: '벤츠 메르세데스 전기차 EQ' },
    { id: 'vw',       group: 'europe', name: '폭스바겐',  keywords: 'Volkswagen OR "VW" OR "ID.4" OR "ID.3" OR "VW electric"', koreanKeywords: '폭스바겐 VW 전기차 ID4' },
    { id: 'byd',      group: 'china',  name: 'BYD',       keywords: 'BYD OR "BYD Han" OR "BYD Seal" OR "BYD Atto" OR "BYD electric"', koreanKeywords: 'BYD 비야디 전기차' },
    { id: 'nio',      group: 'china',  name: 'NIO',       keywords: 'NIO OR "NIO electric" OR "NIO ET" OR "NIO ES"', koreanKeywords: 'NIO 니오 전기차' },
    { id: 'xpeng',    group: 'china',  name: '샤오펑',    keywords: 'XPeng OR XPEV OR "Xpeng G9" OR "Xpeng P7" OR "Xpeng Mona"', koreanKeywords: '샤오펑 전기차 XPEV' },
    { id: 'geely',    group: 'china',  name: '지리',      keywords: 'Geely OR "Geely Auto" OR Zeekr OR "Geely electric"', koreanKeywords: '지리자동차 Geely 지커 전기차' },
  ];

  // 초기 마운트 시 아카이브 로드 (뉴스는 카테고리 클릭 시 로드)
  useEffect(() => {
    loadArchivedArticles();
  }, []);

  // Supabase에서 아카이브된 기사 로드
  const loadArchivedArticles = async () => {
    try {
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

      const response = await fetch(`${apiBaseUrl}/api/archives`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setArchivedArticles(data.archives);
          console.log('✅ Loaded archived articles from Supabase:', data.archives.length);

          // 아카이브 기사 자동 번역 + 요약
          const apiBase = 'https://newsapp-sable-two.vercel.app';
          data.archives.forEach(article => {
            const key = `archive-${article.articleKey}`;
            const titleText = article.title || '';
            const bodyText = article.summary || article.description || '';
            if (!titleText) return;
            fetch(`${apiBase}/api/utils?action=translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: titleText, summary: bodyText }),
            })
              .then(r => r.json())
              .then(d => {
                if (d.success && d.translation) setTranslations(prev => ({ ...prev, [key]: d.translation }));
              })
              .catch(() => {});
            summarizeNews(article, key);
          });

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

  // 리포트 자동 생성 (fetch → generate fire-and-forget)
  // generate는 Claude 호출로 45~55초 소요 → Vercel 10초 HTTP 제한 초과
  // fetch만 await하고, generate는 응답 없이 쏘고 70초 후 목록 자동 갱신
  const generateReport = async () => {
    setGeneratingReport(true);
    const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';
    try {
      setGenerateStatus('뉴스 수집 중...');
      const fetchRes = await fetch(`${apiBaseUrl}/api/daily-report?action=fetch`);
      const fetchData = await fetchRes.json();
      if (!fetchData.success) throw new Error(fetchData.error || '뉴스 수집 실패');

      setGenerateStatus(`AI 리포트 작성 중... (${fetchData.articlesCollected}개 기사 · 약 60초 소요)`);

      // generate는 fire-and-forget (타임아웃 무시)
      fetch(`${apiBaseUrl}/api/daily-report?action=generate`).catch(() => {});

      // 20초마다 새 리포트 생겼는지 폴링 (최대 3회 = 60초)
      let attempts = 0;
      const prevCount = reports.length;
      const poll = setInterval(async () => {
        attempts++;
        await loadReports();
        setReports(prev => {
          if (prev.length > prevCount) {
            clearInterval(poll);
            setGenerateStatus('✅ 리포트 생성 완료!');
            setGeneratingReport(false);
            setTimeout(() => setGenerateStatus(''), 4000);
          } else if (attempts >= 4) {
            clearInterval(poll);
            setGenerateStatus('생성 완료 후 새로고침 버튼을 눌러주세요.');
            setGeneratingReport(false);
          }
          return prev;
        });
      }, 20000);

    } catch (error) {
      setGenerateStatus(`오류: ${error.message}`);
      setGeneratingReport(false);
      setTimeout(() => setGenerateStatus(''), 15000);
    }
  };

  // Supabase에서 리포트 로드
  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

      const response = await fetch(`${apiBaseUrl}/api/reports?category=daily`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReports(data.reports || []);
          console.log('✅ Loaded reports:', data.reports?.length || 0);
        }
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setReportsLoading(false);
    }
  };

  // 종합요약 리포트 목록 로드
  const loadCustomReports = async () => {
    setCustomReportsLoading(true);
    try {
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';
      const response = await fetch(`${apiBaseUrl}/api/reports?category=custom`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomReports(data.reports || []);
        }
      }
    } catch (error) {
      console.error('Failed to load custom reports:', error);
    } finally {
      setCustomReportsLoading(false);
    }
  };

  // 선택 기사로 종합요약 리포트 생성
  const generateCustomReport = async () => {
    if (reportSelectedArticles.size === 0) return;
    setGeneratingCustomReport(true);
    setCustomGenerateStatus(`기사 ${reportSelectedArticles.size}개 분석 중...`);
    try {
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';
      const articles = Object.values(reportSelectedArticlesData).map(d => ({
        title: d.article.title || '',
        url: d.article.url || '',
        source: d.article.source?.name || d.article.source || '',
        description: d.article.description || d.article.summary || '',
        category: d.category || d.categoryOrCompany || '',
      }));

      const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\. /g, '-').replace('.', '');
      const title = `${today} 선택 기사 종합요약 (${articles.length}건)`;

      const response = await fetch(`${apiBaseUrl}/api/reports?action=generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles, title }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || '리포트 생성 실패');

      setCustomGenerateStatus('✅ 생성 완료!');
      setReportSelectedArticles(new Set());
      setReportSelectedArticlesData({});
      await loadCustomReports();
      setExpandedCustomReport(data.report.id);
      setTimeout(() => setCustomGenerateStatus(''), 3000);
    } catch (error) {
      setCustomGenerateStatus(`오류: ${error.message}`);
      setTimeout(() => setCustomGenerateStatus(''), 8000);
    } finally {
      setGeneratingCustomReport(false);
    }
  };

  // 리포트 삭제
  const deleteReport = async (reportId) => {
    if (!window.confirm('이 리포트를 삭제하시겠습니까?')) return;

    try {
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

      const response = await fetch(`${apiBaseUrl}/api/reports?id=${reportId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadReports();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 자동차 카테고리 기사의 companyId 자동 매핑 실행
  const autoMapCompanyIds = async () => {
    try {
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

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

  const loadAutomotiveNews = async (group, range = timeRange) => {
    const groupCompanies = autoCompanies.filter(c => c.group === group);
    setLoading(true);
    setError(null);
    setAutoNewsData({});
    setAnalysis({});
    setSummaries(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('archive-'))));
    setTranslations(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('archive-'))));
    setAnalyzingId(null);
    setActiveCompanyTab('all');

    try {
      const companiesData = {};
      const allCompanyArticles = {};

      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

      // 그룹 내 회사별 뉴스 수집
      for (const company of groupCompanies) {
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

      // 2. 회사 간 중복 제거 후 회사별 저장 (URL + 제목 앞 30자 기준)
      const globalSeenUrls = new Set();
      const globalSeenTitles = new Set();

      Object.keys(allCompanyArticles).forEach(companyId => {
        const uniqueArticles = [];
        allCompanyArticles[companyId].forEach(article => {
          const titleKey = article.title?.trim().slice(0, 30).toLowerCase() || '';
          if (!globalSeenUrls.has(article.url) && !globalSeenTitles.has(titleKey)) {
            globalSeenUrls.add(article.url);
            if (titleKey) globalSeenTitles.add(titleKey);
            uniqueArticles.push(article);
          }
        });
        if (uniqueArticles.length > 0) {
          companiesData[companyId] = uniqueArticles.slice(0, 4);
        }
      });

      setAutoNewsData(companiesData);
      setViewMode('automotive');
      setLastUpdated(new Date());
      setLoading(false);

      // 번역 + 요약 자동 실행 (3개씩 배치 처리 - 레이트 리밋 방지)
      setTranslations({});
      const allAutoItems = [];
      Object.entries(companiesData).forEach(([companyId, articles]) => {
        articles.forEach((item, idx) => {
          allAutoItems.push({ item, itemKey: `${companyId}-${idx}` });
        });
      });

      const BATCH_SIZE = 2;
      const processBatch = async (startIdx) => {
        if (startIdx >= allAutoItems.length) return;
        const batch = allAutoItems.slice(startIdx, startIdx + BATCH_SIZE);
        batch.forEach(({ item, itemKey }) => {
          const summaryText = item.summary || '';
          if (item.title && summaryText) {
            fetch(`${apiBaseUrl}/api/utils?action=translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: item.title, summary: summaryText }),
            })
              .then(r => r.json())
              .then(data => {
                if (data.success && data.translation) {
                  setTranslations(prev => ({ ...prev, [itemKey]: data.translation }));
                }
              })
              .catch(() => {});
          }
        });
        await Promise.all(batch.map(({ item, itemKey }) => summarizeNews(item, itemKey)));
        processBatch(startIdx + BATCH_SIZE);
      };
      processBatch(0);
    } catch (error) {
      console.error('Error loading automotive news:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const translateArticles = (articles) => {
    const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';
    setTranslations({});
    articles.forEach((item, idx) => {
      const titleText  = item.title || '';
      const bodyText   = item.summary || item.description || '';
      if (!titleText) return;
      fetch(`${apiBaseUrl}/api/utils?action=translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleText, summary: bodyText }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.translation) {
            setTranslations(prev => ({ ...prev, [idx]: data.translation }));
          }
        })
        .catch(() => {}); // 실패 시 영어 원문 표시
    });
  };

  const loadNews = async (cat, range) => {
    setLoading(true);
    setError(null);
    setViewMode('general');
    setAnalysis({});
    setSummaries(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('archive-'))));
    setTranslations(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('archive-'))));
    setAnalyzingId(null);

    try {
      const result = await newsApi.searchByCategory(cat, range);

      if (result.success) {
        setNews(result.articles);
        setLastUpdated(new Date());
        translateArticles(result.articles);
        const processGeneralBatch = async (startIdx) => {
          if (startIdx >= result.articles.length) return;
          await Promise.all(
            result.articles.slice(startIdx, startIdx + 2)
              .map((item, idx) => summarizeNews(item, startIdx + idx))
          );
          processGeneralBatch(startIdx + 2);
        };
        processGeneralBatch(0);
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

      // 미리 생성된 상세 요약 우선 사용, 없으면 원문 description/summary
      const summaryText = summaries[idx] || item.summary || item.description || '';

      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';
      const response = await fetch(`${apiBaseUrl}/api/utils?action=analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          summary: summaryText,
          source: typeof item.source === 'string' ? item.source : item.source?.name || '',
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

  const summarizeNews = async (item, idx) => {
    const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';
    const summaryText = item.summary || item.description || '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${apiBaseUrl}/api/utils?action=summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.title, summary: summaryText })
        });

        if (!response.ok) {
          if ((response.status === 529 || response.status === 429 || response.status >= 500) && attempt < 3) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          setSummaries(prev => ({ ...prev, [idx]: '요약에 실패했습니다.' }));
          return;
        }

        const data = await response.json();
        if (data.success && data.summary) {
          setSummaries(prev => ({ ...prev, [idx]: data.summary }));
        } else {
          setSummaries(prev => ({ ...prev, [idx]: '요약에 실패했습니다.' }));
        }
        return;
      } catch (error) {
        if (attempt === 3) {
          console.error('Error summarizing news:', error);
          setSummaries(prev => ({ ...prev, [idx]: '요약 중 오류가 발생했습니다.' }));
        } else {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
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

  // 리포트용 기사 선택 토글 (아카이브와 독립)
  const toggleReportSelection = (articleKey, articleData, categoryOrCompany) => {
    const isCurrentlySelected = reportSelectedArticles.has(articleKey);

    setReportSelectedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleKey)) {
        newSet.delete(articleKey);
      } else {
        newSet.add(articleKey);
      }
      return newSet;
    });

    setReportSelectedArticlesData(prev => {
      const newData = { ...prev };
      if (isCurrentlySelected) {
        delete newData[articleKey];
      } else {
        newData[articleKey] = {
          article: articleData,
          categoryOrCompany: categoryOrCompany,
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
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

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
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

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
      const apiBaseUrl = 'https://newsapp-sable-two.vercel.app';

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

      const response = await fetch(`${apiBaseUrl}/api/utils?action=chat`, {
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

  const categoryNames = {
    'geopolitics': '지정학',
    'economy': '미국 경제',
    'automotive': '자동차',
    'ai-tech': 'AI/자율주행',
    'trade': '무역',
    'daily': '데일리',
    'custom': '종합요약',
  };

  // 사이드바 활성 섹션 결정
  const sidebarSection =
    ['home', 'general', 'automotive'].includes(viewMode) ? 'news' :
    viewMode === 'archive'                                ? 'archive' :
    viewMode === 'issue'                                  ? 'issue' :
    viewMode === 'keywords'                               ? 'keywords' :
    ['reports', 'custom-reports'].includes(viewMode)     ? 'reports' : 'news';

  const sidebarItems = [
    { id: 'news',     label: '뉴스수집',   emoji: '📰', onClick: () => setViewMode('home') },
    { id: 'archive',  label: '아카이버',   emoji: '🗂', badge: archivedArticles.length, onClick: viewArchive },
    { id: 'issue',    label: '이슈분석',   emoji: '🔍', onClick: () => { setIssueArticleData(null); setViewMode('issue'); } },
    { id: 'keywords', label: '키워드관리', emoji: '🔑', onClick: () => setViewMode('keywords') },
    { id: 'reports',  label: '리포트',     emoji: '📄', onClick: () => { setViewMode('reports'); loadReports(); } },
  ];

  return (
    <div className="app-shell">

      {/* ── 헤더 ── */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-emoji">📊</span>
          <div>
            <h1 className="brand-title">BRM 뉴스 인텔리전스</h1>
            <p className="brand-sub">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </div>
        {lastUpdated && (
          <span className="header-updated">업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}</span>
        )}
      </header>

      {/* ── 바디 (사이드바 + 메인) ── */}
      <div className="app-body">

        {/* ── 왼쪽 사이드바 ── */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-item${sidebarSection === item.id ? ' active' : ''}`}
                onClick={item.onClick}
              >
                <span className="sidebar-item-emoji">{item.emoji}</span>
                <span className="sidebar-item-label">{item.label}</span>
                {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <div className="main-content">

          {/* 뉴스수집 섹션 상단 네비 */}
          {sidebarSection === 'news' && (
            <>
              <nav className="dashboard-nav">
                <div className="nav-group">
                  <span className="nav-group-label">카테고리</span>
                  <div className="nav-group-buttons">
                    {categories.map(cat => {
                      const isActive =
                        (viewMode === 'general' && category === (cat.id === 'automotive-general' ? 'automotive' : cat.id)) ||
                        (viewMode === 'automotive' && cat.id === 'competitor');
                      return (
                        <button
                          key={cat.id}
                          className={`nav-btn cat-btn cat-${cat.id}${isActive ? ' active' : ''}`}
                          onClick={() => handleCategoryClick(cat)}
                        >
                          <span className="cat-emoji">{cat.emoji}</span>
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </nav>

              {/* 시간 필터 */}
              {(viewMode === 'general' || viewMode === 'automotive') && (
                <div className="time-filter-bar">
                  <span className="time-filter-label">수집 기간</span>
                  <button className={`time-btn${timeRange === 'day' ? ' active' : ''}`} onClick={() => handleTimeRange('day')}>하루 전</button>
                  <button className={`time-btn${timeRange === 'week' ? ' active' : ''}`} onClick={() => handleTimeRange('week')}>일주일 전</button>
                  <button onClick={() => viewMode === 'general' ? loadNews(category, timeRange) : loadAutomotiveNews(timeRange)} disabled={loading} className="refresh-btn">
                    <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} />
                    새로고침
                  </button>
                </div>
              )}
            </>
          )}

          {/* 뉴스수집 섹션: 선택 아카이브 버튼 (기사 선택 시 표시) */}
          {sidebarSection === 'news' && selectedArticles.size > 0 && (
            <div className="time-filter-bar">
              <button className="nav-btn archive-save-btn" onClick={archiveSelectedArticles}>
                📚 선택 아카이브
                <span className="nav-badge">{selectedArticles.size}</span>
              </button>
            </div>
          )}

          {/* 리포트 섹션: 데일리/종합요약 탭 */}
          {sidebarSection === 'reports' && (
            <div className="time-filter-bar">
              <button
                className={`time-btn${viewMode === 'reports' ? ' active' : ''}`}
                onClick={() => { setViewMode('reports'); loadReports(); }}
              >
                📄 데일리 리포트
              </button>
              <button
                className={`time-btn${viewMode === 'custom-reports' ? ' active' : ''}`}
                onClick={() => { setViewMode('custom-reports'); loadCustomReports(); }}
              >
                📋 종합요약리포트
                {reportSelectedArticles.size > 0 && (
                  <span className="nav-badge">{reportSelectedArticles.size}</span>
                )}
              </button>
            </div>
          )}

      {/* ── 컨텐츠 영역 ── */}
      <div className="content-area">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">오류: {error}</p>
            <p className="text-red-600 text-sm mt-1">API 키를 확인하거나 잠시 후 다시 시도해주세요.</p>
          </div>
        )}

        {viewMode === 'home' && !loading && (
          <div className="home-placeholder">
            <span className="home-placeholder-icon">📰</span>
            <p>위 카테고리를 선택하면 뉴스가 표시됩니다</p>
          </div>
        )}

        {loading && (
          <div className="loading-box">
            <div className="loading-spinner">⏳</div>
            <p>뉴스를 불러오는 중...</p>
          </div>
        )}

        {!loading && !error && news.length > 0 && viewMode === 'general' && (
          <div className="news-grid">
            {news.map((item, idx) => {
              const tr = translations[idx];
              const displayTitle = tr?.title || item.title || '';
              const detailedSummary = summaries[idx];
              return (
                <div key={`news-${idx}`} className={`news-card${selectedArticles.has(`${category}-${idx}`) ? ' news-card-selected' : ''}${reportSelectedArticles.has(`${category}-${idx}`) ? ' news-card-report-selected' : ''}`}>
                  <label className="news-card-check" title="리포트용 선택">
                    <input
                      type="checkbox"
                      checked={reportSelectedArticles.has(`${category}-${idx}`)}
                      onChange={() => toggleReportSelection(`${category}-${idx}`, item, category)}
                    />
                  </label>
                  <h3 className="news-card-title">
                    {displayTitle}
                    {!tr && <span className="translating-badge">번역중</span>}
                  </h3>
                  {detailedSummary
                    ? <p className="news-card-summary">{detailedSummary}</p>
                    : <p className="news-card-summary translating-text">요약 생성 중...</p>
                  }
                  <div className="news-card-footer">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-card-source"
                    >
                      {item.source || 'Source'} <ExternalLink className="w-3 h-3 inline" />
                    </a>
                    <span className="news-card-date">{item.date}</span>
                  </div>
                  <button
                    className={`news-card-archive-btn${selectedArticles.has(`${category}-${idx}`) ? ' selected' : ''}`}
                    onClick={() => toggleGeneralArticleSelection(idx, item)}
                  >
                    {selectedArticles.has(`${category}-${idx}`) ? '✓ 선택됨' : '+ 아카이브'}
                  </button>
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
          <div className="view-section">
            <div className="view-panel">
              <h2 className="section-title">
                <span>📂</span>
                아카이브된 기사
                <span className="section-count">총 {archivedArticles.length}개</span>
              </h2>

              {/* 카테고리별 탭 */}
              <div className="tab-bar">
                <button onClick={() => setActiveCategoryTab('all')} className={`tab-btn${activeCategoryTab === 'all' ? ' active' : ''}`}>
                  전체 ({archivedArticles.length})
                </button>
                <button onClick={() => setActiveCategoryTab('geopolitics')} className={`tab-btn${activeCategoryTab === 'geopolitics' ? ' active' : ''}`}>
                  🌍 지정학 ({archivedArticles.filter(a => a.category === 'geopolitics').length})
                </button>
                <button onClick={() => setActiveCategoryTab('economy')} className={`tab-btn${activeCategoryTab === 'economy' ? ' active' : ''}`}>
                  💰 미국경제 ({archivedArticles.filter(a => a.category === 'economy').length})
                </button>
                <button onClick={() => setActiveCategoryTab('automotive')} className={`tab-btn${activeCategoryTab === 'automotive' ? ' active' : ''}`}>
                  🚗 자동차 ({archivedArticles.filter(a => a.category === 'automotive').length})
                </button>
                <button onClick={() => setActiveCategoryTab('ai-tech')} className={`tab-btn${activeCategoryTab === 'ai-tech' ? ' active' : ''}`}>
                  🤖 AI/자율주행 ({archivedArticles.filter(a => a.category === 'ai-tech').length})
                </button>
                <button onClick={() => setActiveCategoryTab('trade')} className={`tab-btn${activeCategoryTab === 'trade' ? ' active' : ''}`}>
                  📦 무역 ({archivedArticles.filter(a => a.category === 'trade').length})
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
                      <h3 className="category-header">
                        <span>🌍</span>
                        지정학
                        <span className="section-count">({archivedArticles.filter(a => a.category === 'geopolitics').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'geopolitics');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`geopolitics-${date}`} className="mb-4">
                            <h4 className="date-header">
                              <span>📅</span>{date}
                              <span className="section-count">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="news-card">
                                    <div className="news-card-title">
                                      {translations[archiveItemKey]?.title || article.title}
                                    </div>
                                    <p className="news-card-summary">
                                      {summaries[archiveItemKey] || '요약 생성 중...'}
                                    </p>
                                    <div className="news-card-footer">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-card-source">
                                        {article.source?.name || article.source}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                      <span className="news-card-date">
                                        {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="archive-actions">
                                      <button onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="archive-action-btn">
                                        {analyzingId === archiveItemKey ? '분석 중...' : '현대차 관점 분석'}
                                      </button>
                                      <button onClick={() => { setIssueArticleData({ url: article.url, title: article.title }); setViewMode('issue'); }} className="archive-action-btn">
                                        분석정리
                                      </button>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="archive-action-delete" title="삭제">×</button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="analysis-box">
                                        {analysis[archiveItemKey].시사점 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">📌 시사점</p>
                                            <p className="analysis-text">{analysis[archiveItemKey].시사점}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].리스크요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">⚠️ 리스크 요인</p>
                                            {analysis[archiveItemKey].리스크요인.map((r, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge risk-${r.심각도}`}>{r.심각도}</span>
                                                <strong>{r.제목}</strong>
                                                <p>{r.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].기회요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">✅ 기회 요인</p>
                                            {analysis[archiveItemKey].기회요인.map((o, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge opp-${o.중요도}`}>{o.중요도}</span>
                                                <strong>{o.제목}</strong>
                                                <p>{o.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].전략제언?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">💡 전략 제언</p>
                                            {analysis[archiveItemKey].전략제언.map((s, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className="analysis-badge">{s.우선순위}</span>
                                                <strong>{s.제목}</strong>
                                                <p>{s.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].종합평가 && (
                                          <div className="analysis-summary">
                                            <strong>종합평가:</strong> {analysis[archiveItemKey].종합평가}
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
                      <h3 className="category-header">
                        <span>💰</span>
                        미국경제
                        <span className="section-count">({archivedArticles.filter(a => a.category === 'economy').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'economy');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`economy-${date}`} className="mb-4">
                            <h4 className="date-header">
                              <span>📅</span>{date}
                              <span className="section-count">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="news-card">
                                    <div className="news-card-title">
                                      {translations[archiveItemKey]?.title || article.title}
                                    </div>
                                    <p className="news-card-summary">
                                      {summaries[archiveItemKey] || '요약 생성 중...'}
                                    </p>
                                    <div className="news-card-footer">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-card-source">
                                        {article.source?.name || article.source}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                      <span className="news-card-date">
                                        {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="archive-actions">
                                      <button onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="archive-action-btn">
                                        {analyzingId === archiveItemKey ? '분석 중...' : '현대차 관점 분석'}
                                      </button>
                                      <button onClick={() => { setIssueArticleData({ url: article.url, title: article.title }); setViewMode('issue'); }} className="archive-action-btn">
                                        분석정리
                                      </button>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="archive-action-delete" title="삭제">×</button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="analysis-box">
                                        {analysis[archiveItemKey].시사점 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">📌 시사점</p>
                                            <p className="analysis-text">{analysis[archiveItemKey].시사점}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].리스크요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">⚠️ 리스크 요인</p>
                                            {analysis[archiveItemKey].리스크요인.map((r, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge risk-${r.심각도}`}>{r.심각도}</span>
                                                <strong>{r.제목}</strong>
                                                <p>{r.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].기회요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">✅ 기회 요인</p>
                                            {analysis[archiveItemKey].기회요인.map((o, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge opp-${o.중요도}`}>{o.중요도}</span>
                                                <strong>{o.제목}</strong>
                                                <p>{o.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].전략제언?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">💡 전략 제언</p>
                                            {analysis[archiveItemKey].전략제언.map((s, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className="analysis-badge">{s.우선순위}</span>
                                                <strong>{s.제목}</strong>
                                                <p>{s.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].종합평가 && (
                                          <div className="analysis-summary">
                                            <strong>종합평가:</strong> {analysis[archiveItemKey].종합평가}
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
                      <h3 className="category-header">
                        <span>🤖</span>
                        AI/자율주행
                        <span className="section-count">({archivedArticles.filter(a => a.category === 'ai-tech').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'ai-tech');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`ai-tech-${date}`} className="mb-4">
                            <h4 className="date-header">
                              <span>📅</span>{date}
                              <span className="section-count">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="news-card">
                                    <div className="news-card-title">
                                      {translations[archiveItemKey]?.title || article.title}
                                    </div>
                                    <p className="news-card-summary">
                                      {summaries[archiveItemKey] || '요약 생성 중...'}
                                    </p>
                                    <div className="news-card-footer">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-card-source">
                                        {article.source?.name || article.source}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                      <span className="news-card-date">
                                        {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="archive-actions">
                                      <button onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="archive-action-btn">
                                        {analyzingId === archiveItemKey ? '분석 중...' : '현대차 관점 분석'}
                                      </button>
                                      <button onClick={() => { setIssueArticleData({ url: article.url, title: article.title }); setViewMode('issue'); }} className="archive-action-btn">
                                        분석정리
                                      </button>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="archive-action-delete" title="삭제">×</button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="analysis-box">
                                        {analysis[archiveItemKey].시사점 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">📌 시사점</p>
                                            <p className="analysis-text">{analysis[archiveItemKey].시사점}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].리스크요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">⚠️ 리스크 요인</p>
                                            {analysis[archiveItemKey].리스크요인.map((r, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge risk-${r.심각도}`}>{r.심각도}</span>
                                                <strong>{r.제목}</strong>
                                                <p>{r.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].기회요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">✅ 기회 요인</p>
                                            {analysis[archiveItemKey].기회요인.map((o, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge opp-${o.중요도}`}>{o.중요도}</span>
                                                <strong>{o.제목}</strong>
                                                <p>{o.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].전략제언?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">💡 전략 제언</p>
                                            {analysis[archiveItemKey].전략제언.map((s, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className="analysis-badge">{s.우선순위}</span>
                                                <strong>{s.제목}</strong>
                                                <p>{s.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].종합평가 && (
                                          <div className="analysis-summary">
                                            <strong>종합평가:</strong> {analysis[archiveItemKey].종합평가}
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

                  {/* 무역 카테고리 */}
                  {(activeCategoryTab === 'all' || activeCategoryTab === 'trade') && archivedArticles.filter(a => a.category === 'trade').length > 0 && (
                    <div className="mb-8">
                      <h3 className="category-header">
                        <span>📦</span>
                        무역
                        <span className="section-count">({archivedArticles.filter(a => a.category === 'trade').length}개 기사)</span>
                      </h3>
                      {(() => {
                        const categoryArticles = archivedArticles.filter(a => a.category === 'trade');
                        const articlesByDate = {};
                        categoryArticles.forEach(article => {
                          if (!articlesByDate[article.date]) articlesByDate[article.date] = [];
                          articlesByDate[article.date].push(article);
                        });
                        return Object.keys(articlesByDate).sort().reverse().map(date => (
                          <div key={`trade-${date}`} className="mb-4">
                            <h4 className="date-header">
                              <span>📅</span>{date}
                              <span className="section-count">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="news-card">
                                    <div className="news-card-title">
                                      {translations[archiveItemKey]?.title || article.title}
                                    </div>
                                    <p className="news-card-summary">
                                      {summaries[archiveItemKey] || '요약 생성 중...'}
                                    </p>
                                    <div className="news-card-footer">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-card-source">
                                        {article.source?.name || article.source}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                      <span className="news-card-date">
                                        {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="archive-actions">
                                      <button onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="archive-action-btn">
                                        {analyzingId === archiveItemKey ? '분석 중...' : '현대차 관점 분석'}
                                      </button>
                                      <button onClick={() => { setIssueArticleData({ url: article.url, title: article.title }); setViewMode('issue'); }} className="archive-action-btn">
                                        분석정리
                                      </button>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="archive-action-delete" title="삭제">×</button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="analysis-box">
                                        {analysis[archiveItemKey].시사점 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">📌 시사점</p>
                                            <p className="analysis-text">{analysis[archiveItemKey].시사점}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].리스크요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">⚠️ 리스크 요인</p>
                                            {analysis[archiveItemKey].리스크요인.map((r, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge risk-${r.심각도}`}>{r.심각도}</span>
                                                <strong>{r.제목}</strong>
                                                <p>{r.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].기회요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">✅ 기회 요인</p>
                                            {analysis[archiveItemKey].기회요인.map((o, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge opp-${o.중요도}`}>{o.중요도}</span>
                                                <strong>{o.제목}</strong>
                                                <p>{o.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].전략제언?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">💡 전략 제언</p>
                                            {analysis[archiveItemKey].전략제언.map((s, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className="analysis-badge">{s.우선순위}</span>
                                                <strong>{s.제목}</strong>
                                                <p>{s.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].종합평가 && (
                                          <div className="analysis-summary">
                                            <strong>종합평가:</strong> {analysis[archiveItemKey].종합평가}
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
                      <h3 className="category-header">
                        <span>🚗</span>
                        자동차
                        <span className="section-count">({archivedArticles.filter(a => a.category === 'automotive').length}개 기사)</span>
                      </h3>

                      {/* 회사별 하위 탭 (자동차 탭에서만) */}
                      {activeCategoryTab === 'automotive' && (
                        <div className="mb-4 space-y-3">
                          <div className="tab-bar" style={{marginBottom: 0}}>
                            <button onClick={() => setActiveCompanyTab('all')} className={`tab-btn${activeCompanyTab === 'all' ? ' active' : ''}`}>
                              전체
                            </button>
                            {autoCompanies.map(company => {
                              const count = archivedArticles.filter(a => a.category === 'automotive' && a.companyId === company.id).length;
                              if (count === 0) return null;
                              return (
                                <button key={company.id} onClick={() => setActiveCompanyTab(company.id)} className={`tab-btn${activeCompanyTab === company.id ? ' active' : ''}`}>
                                  {company.name} ({count})
                                </button>
                              );
                            })}
                            {archivedArticles.filter(a => a.category === 'automotive' && a.companyId === 'industry').length > 0 && (
                              <button onClick={() => setActiveCompanyTab('industry')} className={`tab-btn${activeCompanyTab === 'industry' ? ' active' : ''}`}>
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
                          <div key={`automotive-${date}`} className="mb-4">
                            <h4 className="date-header">
                              <span>📅</span>{date}
                              <span className="section-count">({articlesByDate[date].length}개)</span>
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2">
                              {articlesByDate[date].map((article, idx) => {
                                const archiveItemKey = `archive-${article.articleKey}`;
                                return (
                                  <div key={`${article.articleKey}-${idx}`} className="news-card">
                                    <div className="news-card-title">
                                      {translations[archiveItemKey]?.title || article.title}
                                    </div>
                                    <p className="news-card-summary">
                                      {summaries[archiveItemKey] || '요약 생성 중...'}
                                    </p>
                                    <div className="news-card-footer">
                                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-card-source">
                                        {article.source?.name || article.source}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                      <span className="news-card-date">
                                        {article.date || new Date(article.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="archive-actions">
                                      <button onClick={() => analyzeNews(article, archiveItemKey)} disabled={analyzingId === archiveItemKey} className="archive-action-btn">
                                        {analyzingId === archiveItemKey ? '분석 중...' : '현대차 관점 분석'}
                                      </button>
                                      <button onClick={() => { setIssueArticleData({ url: article.url, title: article.title }); setViewMode('issue'); }} className="archive-action-btn">
                                        분석정리
                                      </button>
                                      <button onClick={() => removeFromArchive(article.articleKey)} className="archive-action-delete" title="삭제">×</button>
                                    </div>
                                    {analysis[archiveItemKey] && (
                                      <div className="analysis-box">
                                        {analysis[archiveItemKey].시사점 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">📌 시사점</p>
                                            <p className="analysis-text">{analysis[archiveItemKey].시사점}</p>
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].리스크요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">⚠️ 리스크 요인</p>
                                            {analysis[archiveItemKey].리스크요인.map((r, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge risk-${r.심각도}`}>{r.심각도}</span>
                                                <strong>{r.제목}</strong>
                                                <p>{r.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].기회요인?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">✅ 기회 요인</p>
                                            {analysis[archiveItemKey].기회요인.map((o, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className={`analysis-badge opp-${o.중요도}`}>{o.중요도}</span>
                                                <strong>{o.제목}</strong>
                                                <p>{o.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].전략제언?.length > 0 && (
                                          <div className="analysis-section">
                                            <p className="analysis-label">💡 전략 제언</p>
                                            {analysis[archiveItemKey].전략제언.map((s, i) => (
                                              <div key={i} className="analysis-item">
                                                <span className="analysis-badge">{s.우선순위}</span>
                                                <strong>{s.제목}</strong>
                                                <p>{s.내용}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {analysis[archiveItemKey].종합평가 && (
                                          <div className="analysis-summary">
                                            <strong>종합평가:</strong> {analysis[archiveItemKey].종합평가}
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
        {!loading && !error && viewMode === 'automotive' && (
          <div className="view-section">
            <div className="view-panel">
              <h2 className="section-title">
                <span>🏁</span>
                경쟁사 분석
              </h2>

              {/* 그룹 탭 */}
              <div className="tab-bar">
                {autoCompanyGroups.map(group => (
                  <button
                    key={group.id}
                    className={`tab-btn${activeGroupTab === group.id ? ' active' : ''}`}
                    onClick={() => { setActiveGroupTab(group.id); loadAutomotiveNews(group.id, timeRange); }}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {/* 그룹 미선택 안내 */}
              {!activeGroupTab && (
                <p style={{ color: 'var(--text-muted)', padding: '0.75rem 0', fontSize: '0.9rem' }}>
                  위 그룹을 선택하면 해당 회사들의 뉴스를 불러옵니다.
                </p>
              )}

              {/* 회사별 탭 (데이터 로드 후) */}
              {activeGroupTab && Object.keys(autoNewsData).length > 0 && (
                <div className="tab-bar" style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => setActiveCompanyTab('all')} className={`tab-btn${activeCompanyTab === 'all' ? ' active' : ''}`}>
                    전체
                  </button>
                  {autoCompanies.filter(c => c.group === activeGroupTab).map(company => {
                    const count = (autoNewsData[company.id] || []).length;
                    if (count === 0) return null;
                    return (
                      <button key={company.id} onClick={() => setActiveCompanyTab(company.id)} className={`tab-btn${activeCompanyTab === company.id ? ' active' : ''}`}>
                        {company.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {autoCompanies.filter(company =>
              company.group === activeGroupTab &&
              (activeCompanyTab === 'all' || activeCompanyTab === company.id)
            ).map(company => {
              const companyNews = autoNewsData[company.id] || [];
              if (companyNews.length === 0) return null;

              return (
                <div key={company.id} className="view-panel">
                  <h2 className="section-title">
                    <span>🚗</span>
                    {company.name} 뉴스
                  </h2>

                  <div className="news-grid">
                    {companyNews.map((item, idx) => {
                      const itemKey = `${company.id}-${idx}`;
                      const isSelected = selectedArticles.has(itemKey);
                      const tr = translations[itemKey];
                      return (
                        <div key={itemKey} className={`news-card${isSelected ? ' news-card-selected' : ''}${reportSelectedArticles.has(itemKey) ? ' news-card-report-selected' : ''}`}>
                          <label className="news-card-check" title="리포트용 선택">
                            <input
                              type="checkbox"
                              checked={reportSelectedArticles.has(itemKey)}
                              onChange={() => toggleReportSelection(itemKey, item, company.id)}
                            />
                          </label>
                          <div className="news-card-title">
                            {tr?.title || item.title}
                            {!tr && <span className="translating-badge">번역중</span>}
                          </div>
                          <p className={`news-card-summary${summaries[itemKey] ? '' : ' translating-text'}`}>
                            {summaries[itemKey] || '요약 생성 중...'}
                          </p>
                          <div className="news-card-footer">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-card-source">
                              {item.source} <ExternalLink className="w-3 h-3" />
                            </a>
                            <span className="news-card-date">{item.date}</span>
                          </div>
                          <div className="archive-actions">
                            <button
                              className={`news-card-archive-btn${isSelected ? ' selected' : ''}`}
                              onClick={(e) => { e.stopPropagation(); toggleArticleSelection(itemKey, item, company.id); }}
                            >
                              {isSelected ? '✓ 선택됨' : '+ 아카이브'}
                            </button>
                            <button onClick={() => analyzeNews(item, itemKey)} disabled={analyzingId === itemKey} className="archive-action-btn">
                              {analyzingId === itemKey ? '분석 중...' : '현대차 관점 분석'}
                            </button>
                          </div>
                          {analysis[itemKey] && (
                            <div className="analysis-box">
                              {analysis[itemKey].시사점 && (
                                <div className="analysis-section">
                                  <p className="analysis-label">📌 시사점</p>
                                  <p className="analysis-text">{analysis[itemKey].시사점}</p>
                                </div>
                              )}
                              {analysis[itemKey].리스크요인?.length > 0 && (
                                <div className="analysis-section">
                                  <p className="analysis-label">⚠️ 리스크 요인</p>
                                  {analysis[itemKey].리스크요인.map((r, i) => (
                                    <div key={i} className="analysis-item">
                                      <span className={`analysis-badge risk-${r.심각도}`}>{r.심각도}</span>
                                      <strong>{r.제목}</strong>
                                      <p>{r.내용}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {analysis[itemKey].기회요인?.length > 0 && (
                                <div className="analysis-section">
                                  <p className="analysis-label">✅ 기회 요인</p>
                                  {analysis[itemKey].기회요인.map((o, i) => (
                                    <div key={i} className="analysis-item">
                                      <span className={`analysis-badge opp-${o.중요도}`}>{o.중요도}</span>
                                      <strong>{o.제목}</strong>
                                      <p>{o.내용}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {analysis[itemKey].전략제언?.length > 0 && (
                                <div className="analysis-section">
                                  <p className="analysis-label">💡 전략 제언</p>
                                  {analysis[itemKey].전략제언.map((s, i) => (
                                    <div key={i} className="analysis-item">
                                      <span className="analysis-badge">{s.우선순위}</span>
                                      <strong>{s.제목}</strong>
                                      <p>{s.내용}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {analysis[itemKey].종합평가 && (
                                <div className="analysis-summary">
                                  <strong>종합평가:</strong> {analysis[itemKey].종합평가}
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

        {/* 리포트 뷰 */}
        {viewMode === 'reports' && (
          <div className="view-section">
            <div className="view-panel">
              <div className="reports-header">
                <h2 className="section-title">
                  <span>📄</span>
                  데일리 리포트
                  <span className="section-count">총 {reports.length}개</span>
                </h2>
                <div className="reports-actions">
                  <button
                    onClick={generateReport}
                    disabled={generatingReport || reportsLoading}
                    className="tab-btn active"
                  >
                    <RefreshCw className={`w-4 h-4${generatingReport ? ' animate-spin' : ''}`} />
                    리포트 생성
                  </button>
                  <button
                    onClick={loadReports}
                    disabled={reportsLoading || generatingReport}
                    className="tab-btn"
                  >
                    <RefreshCw className={`w-4 h-4${reportsLoading ? ' animate-spin' : ''}`} />
                    새로고침
                  </button>
                  {generateStatus && (
                    <span className="reports-status">{generateStatus}</span>
                  )}
                </div>
              </div>
            </div>

            {reportsLoading ? (
              <div className="view-panel" style={{textAlign: 'center', padding: '3rem'}}>
                <RefreshCw className="w-8 h-8 animate-spin" style={{margin: '0 auto 1rem', color: 'var(--accent)'}} />
                <p style={{color: 'var(--text-secondary)'}}>리포트를 불러오는 중...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="view-panel" style={{textAlign: 'center', padding: '3rem'}}>
                <p style={{color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem'}}>저장된 리포트가 없습니다.</p>
                <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>리포트 생성 버튼을 눌러 오늘의 뉴스를 요약하세요.</p>
              </div>
            ) : (
              reports.map((report) => {
                const isExpanded = expandedReport === report.id;
                return (
                  <div key={report.id} className="report-card">
                    <div className="report-card-header">
                      <div className="report-card-info">
                        <div className="report-card-title">{report.title}</div>
                        <div className="report-card-meta">
                          {report.category && (
                            <span className="report-cat-badge">
                              {categoryNames[report.category] || report.category}
                            </span>
                          )}
                          <span>
                            {new Date(report.createdAt).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="report-card-actions">
                        <button
                          onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                          className="tab-btn"
                        >
                          {isExpanded ? '접기' : '전체 보기'}
                        </button>
                        <a
                          href={`https://newsapp-sable-two.vercel.app/api/reports?action=download&id=${report.id}`}
                          download
                          className="tab-btn active"
                          style={{textDecoration: 'none'}}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Word
                        </a>
                        <button
                          onClick={() => deleteReport(report.id)}
                          className="tab-btn"
                          style={{color: '#ef4444', borderColor: '#fca5a5'}}
                          title="삭제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {!isExpanded && report.content && (
                      <p className="report-preview">{report.content}</p>
                    )}
                    {isExpanded && report.content && (
                      <div className="report-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({href, children}) => (
                              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                            ),
                            p: ({children}) => {
                              const text = React.Children.toArray(children)
                                .map(c => typeof c === 'string' ? c : '')
                                .join('');
                              if (text.startsWith('->')) {
                                return <p className="hyundai-insight">{children}</p>;
                              }
                              return <p>{children}</p>;
                            }
                          }}
                        >
                          {report.content
                            // 이모지+레벨 뒤 내용을 분리 (단, | 바로 앞은 테이블 셀이므로 제외)
                            .replace(/(🟠|🔴|🟡|🟢)\s+(\S+)\s+(?!\|)/g, '$1 $2\n\n')
                            // 🔗 URL → 클릭 가능한 링크로 변환
                            .replace(/🔗\s*(https?:\/\/\S+)/g, '\n\n[🔗 기사 원문]($1)')
                            // -> 앞에 빈 줄 보장 (이전 줄과 붙어있을 경우)
                            .replace(/([^\n])\n(->)/g, '$1\n\n$2')
                          }
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 종합요약리포트 뷰 */}
        {viewMode === 'custom-reports' && (
          <div className="view-section">
            <div className="view-panel">
              <div className="reports-header">
                <h2 className="section-title">
                  <span>📋</span>
                  종합요약리포트
                  <span className="section-count">총 {customReports.length}개</span>
                </h2>
                <div className="reports-actions">
                  <button
                    onClick={generateCustomReport}
                    disabled={generatingCustomReport || reportSelectedArticles.size === 0}
                    className="tab-btn active"
                    style={reportSelectedArticles.size === 0 ? {opacity: 0.45} : {}}
                  >
                    <RefreshCw className={`w-4 h-4${generatingCustomReport ? ' animate-spin' : ''}`} />
                    {reportSelectedArticles.size > 0
                      ? `선택 기사 ${reportSelectedArticles.size}개로 리포트 생성`
                      : '기사를 선택해주세요'}
                  </button>
                  <button
                    onClick={loadCustomReports}
                    disabled={customReportsLoading || generatingCustomReport}
                    className="tab-btn"
                  >
                    <RefreshCw className={`w-4 h-4${customReportsLoading ? ' animate-spin' : ''}`} />
                    새로고침
                  </button>
                  {customGenerateStatus && (
                    <span className="reports-status">{customGenerateStatus}</span>
                  )}
                </div>
              </div>
            </div>

            {customReportsLoading ? (
              <div className="view-panel" style={{textAlign: 'center', padding: '3rem'}}>
                <RefreshCw className="w-8 h-8 animate-spin" style={{margin: '0 auto 1rem', color: 'var(--accent)'}} />
                <p style={{color: 'var(--text-secondary)'}}>리포트를 불러오는 중...</p>
              </div>
            ) : customReports.length === 0 ? (
              <div className="view-panel" style={{textAlign: 'center', padding: '3rem'}}>
                <p style={{color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem'}}>생성된 종합요약리포트가 없습니다.</p>
                <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>뉴스 카드를 선택한 뒤 위 버튼을 눌러 리포트를 생성하세요.</p>
              </div>
            ) : (
              customReports.map((report) => {
                const isExpanded = expandedCustomReport === report.id;
                return (
                  <div key={report.id} className="report-card">
                    <div className="report-card-header">
                      <div className="report-card-info">
                        <div className="report-card-title">{report.title}</div>
                        <div className="report-card-meta">
                          <span className="report-cat-badge" style={{background: '#ede9fe', color: '#6d28d9'}}>종합요약</span>
                          <span>
                            {new Date(report.createdAt).toLocaleDateString('ko-KR', {
                              year: 'numeric', month: 'long', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="report-card-actions">
                        <button
                          onClick={() => setExpandedCustomReport(isExpanded ? null : report.id)}
                          className="tab-btn"
                        >
                          {isExpanded ? '접기' : '전체 보기'}
                        </button>
                        <a
                          href={`https://newsapp-sable-two.vercel.app/api/reports?action=download&id=${report.id}`}
                          download
                          className="tab-btn active"
                          style={{textDecoration: 'none'}}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Word
                        </a>
                        <button
                          onClick={() => deleteReport(report.id)}
                          className="tab-btn"
                          style={{color: '#ef4444', borderColor: '#fca5a5'}}
                          title="삭제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {!isExpanded && report.content && (
                      <p className="report-preview">{report.content}</p>
                    )}
                    {isExpanded && report.content && (
                      <div className="report-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({href, children}) => (
                              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                            ),
                            p: ({children}) => {
                              const text = React.Children.toArray(children)
                                .map(c => typeof c === 'string' ? c : '')
                                .join('');
                              if (text.startsWith('->')) {
                                return <p className="hyundai-insight">{children}</p>;
                              }
                              return <p>{children}</p>;
                            }
                          }}
                        >
                          {report.content
                            .replace(/(🟠|🔴|🟡|🟢)\s+(\S+)\s+(?!\|)/g, '$1 $2\n\n')
                            .replace(/🔗\s*(https?:\/\/\S+)/g, '\n\n[🔗 기사 원문]($1)')
                            .replace(/([^\n])\n(->)/g, '$1\n\n$2')
                          }
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        {/* 이슈분석 */}
        {viewMode === 'issue' && (
          <IssueAnalysis
            onBack={() => { setViewMode('home'); setIssueArticleData(null); }}
            initialArticleData={issueArticleData}
          />
        )}

        {/* 키워드관리 */}
        {viewMode === 'keywords' && (
          <div style={{ padding: '1.5rem' }}>
            <KeywordManager onBack={() => setViewMode('home')} />
          </div>
        )}

      </div>{/* /content-area */}
        </div>{/* /main-content */}
      </div>{/* /app-body */}

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
