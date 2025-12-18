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
  const [viewMode, setViewMode] = useState('general'); // 'general' or 'automotive'
  const [autoNewsData, setAutoNewsData] = useState({});

  const categories = [
    { id: 'geopolitics', name: '지정학', icon: Globe },
    { id: 'economy', name: '미국 경제', icon: TrendingUp },
    { id: 'automotive', name: '자동차', icon: Newspaper },
    { id: 'ai-tech', name: 'AI/자율주행', icon: TrendingUp },
  ];

  const autoCompanies = [
    { id: 'hyundai', name: '현대자동차', keywords: '("Hyundai Motor" OR "Hyundai Motors") AND (car OR vehicle OR automotive OR EV OR electric)' },
    { id: 'kia', name: '기아', keywords: '("Kia Motors" OR "Kia Corp" OR "Kia Corporation") AND (car OR vehicle OR automotive OR EV OR electric)' },
    { id: 'toyota', name: '도요타', keywords: '("Toyota Motor" OR Toyota) AND (car OR vehicle OR automotive OR EV OR electric OR hybrid)' },
    { id: 'tesla', name: '테슬라', keywords: 'Tesla AND (car OR vehicle OR automotive OR EV OR electric OR Musk OR Cybertruck)' },
    { id: 'ford', name: '포드', keywords: '("Ford Motor" OR "Ford Motors") AND (car OR vehicle OR automotive OR EV OR electric OR F-150)' },
    { id: 'gm', name: 'GM', keywords: '("General Motors" OR "GM Motors") AND (car OR vehicle OR automotive OR EV OR electric OR Cadillac OR Chevrolet)' },
    { id: 'bmw', name: 'BMW', keywords: 'BMW AND (car OR vehicle OR automotive OR EV OR electric OR "electric vehicle")' },
    { id: 'stellantis', name: '스텔란티스', keywords: 'Stellantis AND (car OR vehicle OR automotive OR EV OR electric OR Jeep OR Peugeot OR Fiat)' },
  ];

  useEffect(() => {
    // 초기 마운트 시 안전하게 로드
    const timer = setTimeout(() => {
      loadNews('geopolitics', 'day');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadAutomotiveNews = async () => {
    setLoading(true);
    setError(null);
    setAnalysis({});
    setTranslations({});
    setAnalyzingId(null);
    setOverallAnalysis(null);

    try {
      const companiesData = {};

      // 각 자동차 회사별로 뉴스 가져오기
      for (const company of autoCompanies) {
        const response = await fetch(`/api/news?category=automotive&company=${company.keywords}&timeRange=week`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.articles.length > 0) {
            companiesData[company.id] = data.articles.slice(0, 5).map(article => ({
              title: article.title,
              summary: article.description || article.content?.substring(0, 200) + '...',
              date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              source: article.source.name,
              importance: 'medium',
              url: article.url,
            }));
          }
        }
      }

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
    setOverallAnalysis(null);

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
    // 실제로는 번역 API 호출
    // 여기서는 간단한 시뮬레이션
    setTranslations(prev => ({
      ...prev,
      [idx]: {
        title: `[한글] ${item.title}`,
        summary: `[한글 번역] ${item.summary}`
      }
    }));
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
                onClick={loadAutomotiveNews}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
              >
                🚗 경쟁사 분석
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
                  원문 보기
                </a>
                <button
                  onClick={() => translations[idx] ? setTranslations(prev => { const n = {...prev}; delete n[idx]; return n; }) : translateNews(item, idx)}
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${translations[idx] ? 'bg-gray-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
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

        {/* 자동차 회사별 뉴스 뷰 */}
        {!loading && !error && viewMode === 'automotive' && Object.keys(autoNewsData).length > 0 && (
          <div className="space-y-6">
            {autoCompanies.map(company => {
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
                      return (
                        <div key={itemKey} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h3 className="text-lg font-bold text-gray-800 mb-2">
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
                            원문 보기
                          </a>

                          <button
                            onClick={() => translations[itemKey] ? setTranslations(prev => { const n = {...prev}; delete n[itemKey]; return n; }) : translateNews(item, itemKey)}
                            className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${translations[itemKey] ? 'bg-gray-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
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
