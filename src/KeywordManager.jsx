import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function KeywordManager({ onBack }) {
  const [keywords, setKeywords] = useState([]);
  const [pendingKeywords, setPendingKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordKo, setNewKeywordKo] = useState('');
  const [newCategory, setNewCategory] = useState('geopolitics');

  const apiBaseUrl = import.meta.env.DEV ? 'https://newsapp-sable-two.vercel.app' : '';

  const categories = [
    { id: 'geopolitics', name: '지정학' },
    { id: 'economy', name: '경제' },
    { id: 'automotive', name: '자동차' },
    { id: 'ai-tech', name: 'AI/테크' },
  ];

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    setLoading(true);
    try {
      // 대기 중인 키워드
      const pendingRes = await fetch(`${apiBaseUrl}/api/trends?action=pending`);
      const pendingData = await pendingRes.json();
      if (pendingData.success) {
        setPendingKeywords(pendingData.keywords || []);
      }

      // 모든 키워드
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

  const fetchTrends = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends?action=fetch`);
      const data = await res.json();
      if (data.success) {
        alert(`${data.keywords?.length || 0}개의 새 키워드가 수집되었습니다.`);
        loadKeywords();
      }
    } catch (error) {
      console.error('Failed to fetch trends:', error);
      alert('트렌드 수집에 실패했습니다.');
    } finally {
      setFetching(false);
    }
  };

  const approveKeyword = async (id) => {
    console.log('Approving keyword:', id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' })
      });
      const data = await res.json();
      console.log('Approve response:', data);
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
    console.log('Rejecting keyword:', id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' })
      });
      const data = await res.json();
      console.log('Reject response:', data);
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
    console.log('Deleting keyword:', id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' })
      });
      const data = await res.json();
      console.log('Delete response:', data);
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
          <h2 className="text-2xl font-bold">🔑 검색 키워드 관리</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTrends}
            disabled={fetching}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            트렌드 수집
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
        <h3 className="font-semibold mb-3">새 키워드 추가</h3>
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
      </div>

      {/* 탭 */}
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
          {activeTab === 'pending' && pendingKeywords.length === 0 && (
            <div className="text-center py-8 text-gray-500">승인 대기 중인 키워드가 없습니다.</div>
          )}

          {activeTab === 'pending' && pendingKeywords.map(kw => (
            <div key={kw.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-3">
                <span className="font-medium">{kw.keyword}</span>
                {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                  <span className="text-gray-500">({kw.keyword_ko})</span>
                )}
                <span className="px-2 py-1 bg-gray-200 rounded text-xs">{getCategoryName(kw.category)}</span>
                {kw.trend_score > 0 && (
                  <span className="text-orange-600 text-sm">🔥 {kw.trend_score}</span>
                )}
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
          ))}

          {activeTab === 'approved' && keywords.filter(k => k.status === 'approved').map(kw => (
            <div key={kw.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <span className="font-medium">{kw.keyword}</span>
                {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                  <span className="text-gray-500">({kw.keyword_ko})</span>
                )}
                <span className="px-2 py-1 bg-gray-200 rounded text-xs">{getCategoryName(kw.category)}</span>
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

          {activeTab === 'all' && keywords.map(kw => (
            <div key={kw.id} className={`flex items-center justify-between p-3 rounded-lg border ${
              kw.status === 'approved' ? 'bg-green-50 border-green-200' :
              kw.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <span className="font-medium">{kw.keyword}</span>
                {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                  <span className="text-gray-500">({kw.keyword_ko})</span>
                )}
                <span className="px-2 py-1 bg-gray-200 rounded text-xs">{getCategoryName(kw.category)}</span>
                {getStatusBadge(kw.status)}
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
    </div>
  );
}
