import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Plus, Trash2, ArrowLeft, Zap, Lock, Eye, TrendingUp } from 'lucide-react';

export default function KeywordManager({ onBack }) {
  const [keywords, setKeywords] = useState([]);
  const [pendingKeywords, setPendingKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordKo, setNewKeywordKo] = useState('');
  const [newCategory, setNewCategory] = useState('geopolitics');

  const apiBaseUrl = import.meta.env.DEV ? 'https://newsapp-sable-two.vercel.app' : '';

  const categories = [
    { id: 'geopolitics', name: '지정학' },
    { id: 'economy', name: '경제' },
    { id: 'automotive', name: '자동차' },
    { id: 'ai-tech', name: 'AI/테크' },
    { id: 'trade', name: '무역' },
  ];

  const keywordTypes = [
    { id: 'anchor', name: '고정', icon: Lock, color: 'purple' },
    { id: 'active', name: '활성', icon: Zap, color: 'green' },
    { id: 'watchlist', name: '관찰', icon: Eye, color: 'orange' },
  ];

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    setLoading(true);
    try {
      const pendingRes = await fetch(`${apiBaseUrl}/api/trends?action=pending`);
      const pendingData = await pendingRes.json();
      if (pendingData.success) {
        setPendingKeywords(pendingData.keywords || []);
      }

      const allRes = await fetch(`${apiBaseUrl}/api/trends`);
      const allData = await allRes.json();
      if (allData.success) {
        setKeywords(allData.keywords || []);
      }
    } catch (error) {
      console.error('Failed to load keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  // 기사 기반 키워드 추출
  const extractKeywords = async () => {
    setExtracting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/extract-keywords?action=extract`);
      const data = await res.json();
      if (data.success) {
        const totalExtracted = Object.values(data.results).reduce((sum, r) => sum + r.keywordsExtracted, 0);
        alert(`기사에서 ${totalExtracted}개의 키워드를 추출했습니다.`);
        loadKeywords();
      } else {
        alert('키워드 추출 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to extract keywords:', error);
      alert('키워드 추출에 실패했습니다.');
    } finally {
      setExtracting(false);
    }
  };

  const approveKeyword = async (id) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' })
      });
      const data = await res.json();
      if (data.success) {
        loadKeywords();
      } else {
        alert('승인 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to approve keyword:', error);
      alert('승인 실패: ' + error.message);
    }
  };

  const rejectKeyword = async (id) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' })
      });
      const data = await res.json();
      if (data.success) {
        loadKeywords();
      } else {
        alert('거부 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to reject keyword:', error);
      alert('거부 실패: ' + error.message);
    }
  };

  const deleteKeyword = async (id) => {
    if (!window.confirm('이 키워드를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' })
      });
      const data = await res.json();
      if (data.success) {
        loadKeywords();
      } else {
        alert('삭제 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to delete keyword:', error);
      alert('삭제 실패: ' + error.message);
    }
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          keyword: newKeyword.trim(),
          keyword_ko: newKeywordKo.trim() || newKeyword.trim(),
          category: newCategory
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewKeyword('');
        setNewKeywordKo('');
        loadKeywords();
      }
    } catch (error) {
      console.error('Failed to add keyword:', error);
    }
  };

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : categoryId;
  };

  const getTypeBadge = (type) => {
    const typeInfo = keywordTypes.find(t => t.id === type);
    if (!typeInfo) return null;
    const Icon = typeInfo.icon;
    const colorClasses = {
      purple: 'bg-purple-100 text-purple-800',
      green: 'bg-green-100 text-green-800',
      orange: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${colorClasses[typeInfo.color]}`}>
        <Icon className="w-3 h-3" />
        {typeInfo.name}
      </span>
    );
  };

  const getScoreBadge = (score) => {
    if (!score && score !== 0) return null;
    let color = 'bg-gray-100 text-gray-600';
    if (score >= 80) color = 'bg-green-100 text-green-800';
    else if (score >= 60) color = 'bg-blue-100 text-blue-800';
    else if (score >= 40) color = 'bg-yellow-100 text-yellow-800';
    else color = 'bg-red-100 text-red-800';

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {score}점
      </span>
    );
  };

  const getEntityTypeBadge = (entityType) => {
    if (!entityType) return null;
    const labels = {
      country: '국가',
      organization: '기관',
      company: '기업',
      person: '인물',
      concept: '개념',
      trigger: '이벤트'
    };
    return (
      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
        {labels[entityType] || entityType}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">승인됨</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">대기중</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">거부됨</span>;
      default:
        return null;
    }
  };

  const filterKeywords = (list) => {
    return list
      .filter(k => activeCategory === 'all' || k.category === activeCategory)
      .filter(k => activeType === 'all' || k.keyword_type === activeType);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">검색 키워드 관리</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={extractKeywords}
            disabled={extracting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <TrendingUp className={`w-4 h-4 ${extracting ? 'animate-pulse' : ''}`} />
            기사 분석
          </button>
          <button
            onClick={loadKeywords}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 새 키워드 추가 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold mb-3">새 키워드 추가 (Anchor)</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="영문 키워드"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="px-3 py-2 border rounded-lg flex-1 min-w-[150px]"
          />
          <input
            type="text"
            placeholder="한국어 키워드 (선택)"
            value={newKeywordKo}
            onChange={(e) => setNewKeywordKo(e.target.value)}
            className="px-3 py-2 border rounded-lg flex-1 min-w-[150px]"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <button
            onClick={addKeyword}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          수동 추가된 키워드는 Anchor(고정) 타입으로 자동 삭제되지 않습니다.
        </p>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          승인 대기 ({pendingKeywords.length})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 font-medium ${activeTab === 'approved' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          승인됨 ({keywords.filter(k => k.status === 'approved').length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium ${activeTab === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          전체 ({keywords.length})
        </button>
      </div>

      {/* 키워드 목록 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        <div className="space-y-2">
          {/* 승인 대기 탭 */}
          {activeTab === 'pending' && (
            <>
              {pendingKeywords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  승인 대기 중인 키워드가 없습니다.
                  <br />
                  <span className="text-sm">"기사 분석" 버튼을 눌러 새 키워드를 추출하세요.</span>
                </div>
              ) : (
                pendingKeywords.map(kw => (
                  <div key={kw.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{kw.keyword}</span>
                      {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                        <span className="text-gray-500">({kw.keyword_ko})</span>
                      )}
                      <span className="px-2 py-1 bg-gray-200 rounded text-xs">{getCategoryName(kw.category)}</span>
                      {getEntityTypeBadge(kw.entity_type)}
                      {getScoreBadge(kw.total_score)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveKeyword(kw.id)}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        title="승인"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rejectKeyword(kw.id)}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        title="거부"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteKeyword(kw.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* 승인됨 탭 */}
          {activeTab === 'approved' && (
            <>
              {/* 필터 */}
              <div className="flex gap-4 mb-4 flex-wrap">
                {/* 카테고리 필터 */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm text-gray-500 py-1">카테고리:</span>
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-3 py-1 rounded-full text-sm ${activeCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    전체
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1 rounded-full text-sm ${activeCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* 타입 필터 */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm text-gray-500 py-1">타입:</span>
                  <button
                    onClick={() => setActiveType('all')}
                    className={`px-3 py-1 rounded-full text-sm ${activeType === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    전체
                  </button>
                  {keywordTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setActiveType(type.id)}
                      className={`px-3 py-1 rounded-full text-sm ${activeType === type.id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 키워드 목록 */}
              {filterKeywords(keywords.filter(k => k.status === 'approved')).map(kw => (
                <div key={kw.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{kw.keyword}</span>
                    {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                      <span className="text-gray-500">({kw.keyword_ko})</span>
                    )}
                    {activeCategory === 'all' && (
                      <span className="px-2 py-1 bg-gray-200 rounded text-xs">{getCategoryName(kw.category)}</span>
                    )}
                    {getTypeBadge(kw.keyword_type)}
                    {getScoreBadge(kw.total_score)}
                  </div>
                  <button
                    onClick={() => deleteKeyword(kw.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {filterKeywords(keywords.filter(k => k.status === 'approved')).length === 0 && (
                <div className="text-center py-8 text-gray-500">승인된 키워드가 없습니다.</div>
              )}
            </>
          )}

          {/* 전체 탭 */}
          {activeTab === 'all' && keywords.map(kw => (
            <div key={kw.id} className={`flex items-center justify-between p-3 rounded-lg border ${
              kw.status === 'approved' ? 'bg-green-50 border-green-200' :
              kw.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{kw.keyword}</span>
                {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                  <span className="text-gray-500">({kw.keyword_ko})</span>
                )}
                <span className="px-2 py-1 bg-gray-200 rounded text-xs">{getCategoryName(kw.category)}</span>
                {getStatusBadge(kw.status)}
                {getTypeBadge(kw.keyword_type)}
                {getScoreBadge(kw.total_score)}
              </div>
              <div className="flex gap-2">
                {kw.status === 'pending' && (
                  <>
                    <button
                      onClick={() => approveKeyword(kw.id)}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      title="승인"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => rejectKeyword(kw.id)}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      title="거부"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteKeyword(kw.id)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-700 mb-2">키워드 타입 설명</h4>
        <div className="flex gap-4 text-xs text-gray-600 flex-wrap">
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-purple-600" />
            <span><strong>Anchor(고정)</strong>: 수동 추가, 자동 삭제 안됨</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-green-600" />
            <span><strong>Active(활성)</strong>: 높은 점수, 현재 트렌딩</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-orange-600" />
            <span><strong>Watchlist(관찰)</strong>: 낮은 점수, 모니터링 중</span>
          </div>
        </div>
      </div>
    </div>
  );
}
