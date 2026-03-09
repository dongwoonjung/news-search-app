import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Plus, Trash2, ArrowLeft, Zap, Lock, Eye, TrendingUp, CheckSquare, Square } from 'lucide-react';

export default function KeywordManager({ onBack }) {
  const [keywords, setKeywords] = useState([]);
  const [pendingKeywords, setPendingKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordKo, setNewKeywordKo] = useState('');
  const [newCategory, setNewCategory] = useState('geopolitics');
  const [selectedIds, setSelectedIds] = useState(new Set());

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

  useEffect(() => { loadKeywords(); }, []);

  const loadKeywords = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/trends?action=pending`),
        fetch(`${apiBaseUrl}/api/trends`),
      ]);
      const pendingData = await pendingRes.json();
      const allData = await allRes.json();
      if (pendingData.success) setPendingKeywords(pendingData.keywords || []);
      if (allData.success) setKeywords(allData.keywords || []);
    } catch (error) {
      console.error('Failed to load keywords:', error);
    } finally {
      setLoading(false);
    }
  };

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
      alert('키워드 추출에 실패했습니다.');
    } finally {
      setExtracting(false);
    }
  };

  const postAction = async (id, action) => {
    const res = await fetch(`${apiBaseUrl}/api/trends`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    return res.json();
  };

  const approveKeyword = async (id) => {
    const data = await postAction(id, 'approve');
    if (data.success) loadKeywords();
  };

  const rejectKeyword = async (id) => {
    const data = await postAction(id, 'reject');
    if (data.success) loadKeywords();
  };

  const deleteKeyword = async (id) => {
    if (!window.confirm('이 키워드를 삭제하시겠습니까?')) return;
    const data = await postAction(id, 'delete');
    if (data.success) loadKeywords();
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
          category: newCategory,
        }),
      });
      const data = await res.json();
      if (data.success) { setNewKeyword(''); setNewKeywordKo(''); loadKeywords(); }
    } catch (error) {
      console.error('Failed to add keyword:', error);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === pendingKeywords.length
        ? new Set()
        : new Set(pendingKeywords.map(k => k.id))
    );
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => postAction(id, 'approve')));
      setSelectedIds(new Set());
      loadKeywords();
    } catch { alert('일괄 승인 중 오류가 발생했습니다.'); }
    finally { setBulkProcessing(false); }
  };

  const bulkReject = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => postAction(id, 'reject')));
      setSelectedIds(new Set());
      loadKeywords();
    } catch { alert('일괄 거부 중 오류가 발생했습니다.'); }
    finally { setBulkProcessing(false); }
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name ?? id;

  const getTypeBadge = (type) => {
    const info = keywordTypes.find(t => t.id === type);
    if (!info) return null;
    const Icon = info.icon;
    const styles = {
      purple: { background: '#ede9fe', color: '#6d28d9' },
      green:  { background: '#dcfce7', color: '#15803d' },
      orange: { background: '#ffedd5', color: '#c2410c' },
    };
    return (
      <span style={{ ...styles[info.color], display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
        <Icon size={10} /> {info.name}
      </span>
    );
  };

  const getScoreBadge = (score) => {
    if (score == null) return null;
    const style =
      score >= 80 ? { background: '#dcfce7', color: '#15803d' } :
      score >= 60 ? { background: '#dbeafe', color: '#1d4ed8' } :
      score >= 40 ? { background: '#fef9c3', color: '#a16207' } :
                   { background: '#fee2e2', color: '#b91c1c' };
    return <span style={{ ...style, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{score}점</span>;
  };

  const getEntityTypeBadge = (entityType) => {
    if (!entityType) return null;
    const labels = { country: '국가', organization: '기관', company: '기업', person: '인물', concept: '개념', trigger: '이벤트' };
    return (
      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
        {labels[entityType] ?? entityType}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const map = {
      approved: { bg: '#dcfce7', color: '#15803d', label: '승인됨' },
      pending:  { bg: '#fef9c3', color: '#a16207', label: '대기중' },
      rejected: { bg: '#fee2e2', color: '#b91c1c', label: '거부됨' },
    };
    const s = map[status];
    return s ? <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{s.label}</span> : null;
  };

  const filterKeywords = (list) =>
    list
      .filter(k => activeCategory === 'all' || k.category === activeCategory)
      .filter(k => activeType === 'all' || k.keyword_type === activeType);

  const tabs = [
    { id: 'pending',  label: '승인 대기', count: pendingKeywords.length },
    { id: 'approved', label: '승인됨',    count: keywords.filter(k => k.status === 'approved').length },
    { id: 'all',      label: '전체',      count: keywords.length },
  ];

  return (
    <div className="app-shell">

      {/* ── 헤더 ── */}
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 8, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <span className="brand-emoji">🔑</span>
          <div>
            <h1 className="brand-title">검색 키워드 관리</h1>
            <p className="brand-sub">BRM 뉴스 인텔리전스</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={extractKeywords}
            disabled={extracting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: extracting ? 'not-allowed' : 'pointer', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, opacity: extracting ? 0.6 : 1 }}
          >
            <TrendingUp size={14} className={extracting ? 'animate-pulse' : ''} />
            기사 분석
          </button>
          <button
            onClick={loadKeywords}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            새로고침
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>

        {/* ── 키워드 추가 카드 ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>새 키워드 추가 (Anchor)</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="영문 키워드"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              style={{ flex: '1 1 140px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              placeholder="한국어 키워드 (선택)"
              value={newKeywordKo}
              onChange={e => setNewKeywordKo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              style={{ flex: '1 1 140px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', color: 'var(--text-primary)' }}
            />
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface)' }}
            >
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <button
              onClick={addKeyword}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={14} /> 추가
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>수동 추가된 키워드는 Anchor(고정) 타입으로 자동 삭제되지 않습니다.</p>
        </div>

        {/* ── 탭 ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.label}
              <span style={{ background: activeTab === tab.id ? '#dbeafe' : '#f1f5f9', color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)', padding: '1px 7px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── 컨텐츠 ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 14 }}>
            <RefreshCw size={24} style={{ margin: '0 auto 8px', display: 'block', animation: 'spin 1s linear infinite' }} />
            로딩 중...
          </div>
        ) : (
          <>
            {/* 승인 대기 탭 */}
            {activeTab === 'pending' && (
              pendingKeywords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 14, marginBottom: 6 }}>승인 대기 중인 키워드가 없습니다.</p>
                  <p style={{ fontSize: 12 }}>"기사 분석" 버튼을 눌러 새 키워드를 추출하세요.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* 일괄 작업 바 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                    <button onClick={toggleSelectAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {selectedIds.size === pendingKeywords.length
                        ? <CheckSquare size={16} style={{ color: 'var(--accent)' }} />
                        : <Square size={16} />}
                      전체 선택
                      {selectedIds.size > 0 && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{selectedIds.size}개 선택됨</span>}
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={bulkApprove}
                        disabled={selectedIds.size === 0 || bulkProcessing}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, opacity: selectedIds.size === 0 ? 0.4 : 1 }}
                      >
                        <Check size={13} /> 일괄 승인
                      </button>
                      <button
                        onClick={bulkReject}
                        disabled={selectedIds.size === 0 || bulkProcessing}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, opacity: selectedIds.size === 0 ? 0.4 : 1 }}
                      >
                        <X size={13} /> 일괄 거부
                      </button>
                    </div>
                  </div>

                  {pendingKeywords.map(kw => (
                    <div
                      key={kw.id}
                      onClick={() => toggleSelect(kw.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: selectedIds.has(kw.id) ? '#eff6ff' : 'var(--surface)',
                        border: `1px solid ${selectedIds.has(kw.id) ? '#93c5fd' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'border-color .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {selectedIds.has(kw.id)
                          ? <CheckSquare size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          : <Square size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{kw.keyword}</span>
                        {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>({kw.keyword_ko})</span>
                        )}
                        <span style={{ background: '#f1f5f9', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{getCategoryName(kw.category)}</span>
                        {getEntityTypeBadge(kw.entity_type)}
                        {getScoreBadge(kw.total_score)}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => approveKeyword(kw.id)} title="승인" style={{ padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center' }}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => rejectKeyword(kw.id)} title="거부" style={{ padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center' }}>
                          <X size={14} />
                        </button>
                        <button onClick={() => deleteKeyword(kw.id)} title="삭제" style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 승인됨 탭 */}
            {activeTab === 'approved' && (
              <>
                {/* 필터 */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12, boxShadow: 'var(--shadow-sm)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>카테고리</span>
                    {[{ id: 'all', name: '전체' }, ...categories].map(cat => (
                      <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                        style={{ padding: '4px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeCategory === cat.id ? 'var(--accent)' : '#f1f5f9', color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)' }}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>타입</span>
                    {[{ id: 'all', name: '전체' }, ...keywordTypes].map(t => (
                      <button key={t.id} onClick={() => setActiveType(t.id)}
                        style={{ padding: '4px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeType === t.id ? '#6d28d9' : '#f1f5f9', color: activeType === t.id ? '#fff' : 'var(--text-secondary)' }}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filterKeywords(keywords.filter(k => k.status === 'approved')).map(kw => (
                    <div key={kw.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{kw.keyword}</span>
                        {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>({kw.keyword_ko})</span>
                        )}
                        {activeCategory === 'all' && (
                          <span style={{ background: '#f1f5f9', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{getCategoryName(kw.category)}</span>
                        )}
                        {getTypeBadge(kw.keyword_type)}
                        {getScoreBadge(kw.total_score)}
                      </div>
                      <button onClick={() => deleteKeyword(kw.id)} title="삭제" style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #fecaca', cursor: 'pointer', background: '#fff', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {filterKeywords(keywords.filter(k => k.status === 'approved')).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 14 }}>승인된 키워드가 없습니다.</div>
                  )}
                </div>
              </>
            )}

            {/* 전체 탭 */}
            {activeTab === 'all' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keywords.map(kw => {
                  const borderColor = kw.status === 'approved' ? '#bbf7d0' : kw.status === 'pending' ? '#fde68a' : '#fecaca';
                  const bgColor    = kw.status === 'approved' ? '#f0fdf4'  : kw.status === 'pending' ? '#fefce8'  : '#fff1f2';
                  return (
                    <div key={kw.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{kw.keyword}</span>
                        {kw.keyword_ko && kw.keyword_ko !== kw.keyword && (
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>({kw.keyword_ko})</span>
                        )}
                        <span style={{ background: 'rgba(0,0,0,.06)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{getCategoryName(kw.category)}</span>
                        {getStatusBadge(kw.status)}
                        {getTypeBadge(kw.keyword_type)}
                        {getScoreBadge(kw.total_score)}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {kw.status === 'pending' && (
                          <>
                            <button onClick={() => approveKeyword(kw.id)} style={{ padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center' }}>
                              <Check size={14} />
                            </button>
                            <button onClick={() => rejectKeyword(kw.id)} style={{ padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center' }}>
                              <X size={14} />
                            </button>
                          </>
                        )}
                        <button onClick={() => deleteKeyword(kw.id)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #fecaca', cursor: 'pointer', background: '#fff', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── 범례 ── */}
        <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>키워드 타입</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { Icon: Lock,  color: '#6d28d9', label: 'Anchor(고정)',    desc: '수동 추가, 자동 삭제 안됨' },
              { Icon: Zap,   color: '#15803d', label: 'Active(활성)',    desc: '높은 점수, 현재 트렌딩' },
              { Icon: Eye,   color: '#c2410c', label: 'Watchlist(관찰)', desc: '낮은 점수, 모니터링 중' },
            ].map(({ Icon, color, label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Icon size={13} style={{ color }} />
                <strong style={{ color: 'var(--text-primary)' }}>{label}</strong>: {desc}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
