import React, { useState, useEffect } from 'react';
import { FolderPlus, FileText, Edit, Trash2, ArrowLeft, Save, X, Sparkles, ChevronDown, ChevronRight, ExternalLink, MoveRight, Plus } from 'lucide-react';

const S = {
  // 공통 인풋/텍스트에어리어
  input: {
    width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)',
    background: 'var(--surface)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
    fontFamily: 'inherit', lineHeight: 1.6,
  },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' },
  btn: (bg, color='#fff') => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: bg, color,
  }),
  iconBtn: () => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 6, borderRadius: 7, border: '1px solid var(--border)',
    background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)',
  }),
};

export default function IssueAnalysis({ onBack, initialArticleData }) {
  const [folders, setFolders] = useState([]);
  const [, setArticles] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderArticles, setFolderArticles] = useState({});
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);

  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');

  const [articleTitle, setArticleTitle] = useState('');
  const [articleSource, setArticleSource] = useState('');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleInsight, setArticleInsight] = useState('');
  const [articleInsightGPT, setArticleInsightGPT] = useState('');
  const [articleInsightClaude, setArticleInsightClaude] = useState('');
  const [articleFolderId, setArticleFolderId] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingInsightGPT, setIsGeneratingInsightGPT] = useState(false);
  const [isGeneratingInsightClaude, setIsGeneratingInsightClaude] = useState(false);
  const [showExternalAIMenu, setShowExternalAIMenu] = useState(false);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [articleToMove, setArticleToMove] = useState(null);
  const [targetFolderId, setTargetFolderId] = useState('');
  const [parentFolderForNew, setParentFolderForNew] = useState(null);
  const [draggedArticle, setDraggedArticle] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  const isDev = import.meta.env.DEV;
  const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => { if (selectedFolder) loadArticles(selectedFolder.id); }, [selectedFolder]);

  useEffect(() => {
    if (initialArticleData) {
      setShowArticleForm(true);
      setArticleTitle(initialArticleData.title || '');
      setArticleSource(initialArticleData.url || '');
      window.scrollTo(0, 0);
      setTimeout(() => window.scrollTo(0, 0), 200);
    }
  }, [initialArticleData]);

  useEffect(() => {
    if (showArticleForm) { window.scrollTo(0, 0); setTimeout(() => window.scrollTo(0, 0), 100); }
  }, [showArticleForm]);

  useEffect(() => {
    const handler = (e) => { if (showExternalAIMenu && !e.target.closest('.relative')) setShowExternalAIMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExternalAIMenu]);

  const loadFolders = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=folders`);
      const data = await res.json();
      if (data.success) setFolders(data.folders);
    } catch (e) { console.error(e); }
  };

  const loadArticles = async (folderId) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=articles&folderId=${folderId}`);
      const data = await res.json();
      if (data.success) setArticles(data.articles);
    } catch (e) { console.error(e); }
  };

  const loadFolderArticles = async (folderId) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=articles&folderId=${folderId}`);
      const data = await res.json();
      if (data.success) setFolderArticles(prev => ({ ...prev, [folderId]: data.articles }));
    } catch (e) { console.error(e); }
  };

  const toggleFolder = async (folder) => {
    const next = new Set(expandedFolders);
    if (next.has(folder.id)) {
      next.delete(folder.id);
    } else {
      next.add(folder.id);
      if (!folderArticles[folder.id]) await loadFolderArticles(folder.id);
    }
    setExpandedFolders(next);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return alert('폴더 이름을 입력해주세요.');
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=folders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, description: folderDescription }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolders();
        setShowFolderForm(false); setFolderName(''); setFolderDescription('');
        if (data.folder?.id) setArticleFolderId(data.folder.id);
        setShowArticleForm(true);
        alert('폴더가 생성되었습니다.');
      }
    } catch (e) { alert('폴더 생성에 실패했습니다.'); }
  };

  const handleUpdateFolder = async () => {
    if (!folderName.trim()) return alert('폴더 이름을 입력해주세요.');
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=folders`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingFolder.id, name: folderName, description: folderDescription }),
      });
      const data = await res.json();
      if (data.success) { loadFolders(); setEditingFolder(null); setFolderName(''); setFolderDescription(''); alert('폴더가 수정되었습니다.'); }
    } catch (e) { alert('폴더 수정에 실패했습니다.'); }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!confirm('이 폴더와 모든 글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=folders&id=${folderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadFolders();
        if (selectedFolder?.id === folderId) { setSelectedFolder(null); setArticles([]); }
        alert('폴더가 삭제되었습니다.');
      }
    } catch (e) { alert('폴더 삭제에 실패했습니다.'); }
  };

  const handleCreateArticle = async () => {
    if (!articleTitle.trim() || !articleSource.trim() || !articleSummary.trim() || !articleInsight.trim() || !articleFolderId)
      return alert('모든 필드를 입력해주세요.');
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=articles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: parseInt(articleFolderId), title: articleTitle, source: articleSource, summary: articleSummary, insight: articleInsight }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolderArticles(articleFolderId);
        if (selectedFolder?.id === parseInt(articleFolderId)) loadArticles(articleFolderId);
        setShowArticleForm(false); resetArticleForm(); alert('글이 등록되었습니다.');
      }
    } catch (e) { alert('글 등록에 실패했습니다.'); }
  };

  const handleDeleteArticle = async (articleId) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=articles&id=${articleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedArticle?.folder_id) await loadFolderArticles(selectedArticle.folder_id);
        if (selectedFolder?.id) loadArticles(selectedFolder.id);
        alert('글이 삭제되었습니다.');
      }
    } catch (e) { alert('글 삭제에 실패했습니다.'); }
  };

  const resetArticleForm = () => {
    setArticleTitle(''); setArticleSource(''); setArticleSummary('');
    setArticleInsight(''); setArticleFolderId('');
    setArticleInsightGPT(''); setArticleInsightClaude('');
  };

  const handleMoveArticle = async () => {
    if (!articleToMove || !targetFolderId) return alert('이동할 폴더를 선택해주세요.');
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=articles`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: articleToMove.id, folderId: parseInt(targetFolderId) }),
      });
      const data = await res.json();
      if (data.success) {
        if (articleToMove.folder_id) await loadFolderArticles(articleToMove.folder_id);
        await loadFolderArticles(parseInt(targetFolderId));
        setShowMoveModal(false); setArticleToMove(null); setTargetFolderId(''); setSelectedArticle(null);
        alert('글이 이동되었습니다.');
      }
    } catch (e) { alert('글 이동에 실패했습니다.'); }
  };

  const handleCreateSubfolder = async () => {
    if (!folderName.trim()) return alert('폴더 이름을 입력해주세요.');
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=folders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, description: folderDescription, parentId: parentFolderForNew?.id || null }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolders(); setShowFolderForm(false); setFolderName(''); setFolderDescription(''); setParentFolderForNew(null);
        alert('폴더가 생성되었습니다.');
      }
    } catch (e) { alert('폴더 생성에 실패했습니다.'); }
  };

  const buildFolderTree = (folders) => {
    const rootFolders = folders.filter(f => !f.parent_id);
    const addChildren = (folder, level = 0) => ({
      ...folder, level,
      children: folders.filter(f => f.parent_id === folder.id).map(c => addChildren(c, level + 1))
    });
    return rootFolders.map(f => addChildren(f, 0));
  };

  const flattenFolderTree = (tree, result = []) => {
    tree.forEach(f => { result.push(f); if (f.children?.length) flattenFolderTree(f.children, result); });
    return result;
  };

  const folderTree = buildFolderTree(folders);
  const flatFolders = flattenFolderTree(folderTree);

  const handleDragStart = (e, article) => {
    setDraggedArticle(article); e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', article.id); e.target.style.opacity = '0.5';
  };
  const handleDragEnd = (e) => { setDraggedArticle(null); setDragOverFolderId(null); e.target.style.opacity = '1'; };
  const handleDragOver = (e, folderId) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (draggedArticle && draggedArticle.folder_id !== folderId) setDragOverFolderId(folderId);
  };
  const handleDragLeave = (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setDragOverFolderId(null); };
  const handleDrop = async (e, tFolderId) => {
    e.preventDefault(); setDragOverFolderId(null);
    if (!draggedArticle || draggedArticle.folder_id === tFolderId) { setDraggedArticle(null); return; }
    try {
      const res = await fetch(`${apiBaseUrl}/api/issues?type=articles`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggedArticle.id, folderId: tFolderId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolderArticles(draggedArticle.folder_id); await loadFolderArticles(tFolderId);
        if (selectedArticle?.id === draggedArticle.id) setSelectedArticle(null);
      }
    } catch (e) { alert('글 이동에 실패했습니다.'); }
    setDraggedArticle(null);
  };

  const handleGenerateAISummary = async () => {
    if (!articleSource.trim()) return alert('정보 소스를 먼저 입력해주세요.');
    setIsGeneratingSummary(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/utils?action=ai-summary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: articleSource, title: articleTitle }),
      });
      const data = await res.json();
      if (data.success) setArticleSummary(data.summary);
      else alert('요약 생성에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
    } catch (e) { alert('요약 생성 중 오류가 발생했습니다.'); }
    finally { setIsGeneratingSummary(false); }
  };

  const handleGenerateAIInsight = async (model) => {
    if (!articleTitle.trim() || !articleSummary.trim()) return alert('제목과 내용 요약을 먼저 입력해주세요.');
    const setLoading = model === 'gpt' ? setIsGeneratingInsightGPT : setIsGeneratingInsightClaude;
    const setInsight = model === 'gpt' ? setArticleInsightGPT : setArticleInsightClaude;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/ai-insight`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: articleTitle, summary: articleSummary, model }),
      });
      const data = await res.json();
      if (data.success) setInsight(data.insight);
      else alert(`${model.toUpperCase()} 인사이트 생성에 실패했습니다: ` + (data.error || ''));
    } catch (e) { alert(`${model.toUpperCase()} 인사이트 생성 중 오류가 발생했습니다.`); }
    finally { setLoading(false); }
  };

  const handleOpenExternalAI = (aiType) => {
    if (!articleTitle.trim() || !articleSummary.trim()) return alert('제목과 내용 요약을 먼저 입력해주세요.');
    const prompt = `다음 뉴스 기사를 현대차 관점에서 분석하여 전략적 인사이트를 도출해주세요:\n\n제목: ${articleTitle}\n\n요약:\n${articleSummary}`;
    navigator.clipboard.writeText(prompt).then(() => {
      window.open(aiType === 'chatgpt' ? 'https://chat.openai.com/' : 'https://gemini.google.com/', '_blank');
      alert('프롬프트가 클립보드에 복사되었습니다. 붙여넣기 하세요.');
    });
    setShowExternalAIMenu(false);
  };

  const openEditFolder = (folder) => { setEditingFolder(folder); setFolderName(folder.name); setFolderDescription(folder.description || ''); };

  // ── 모달 공통 레이아웃 ──
  const Modal = ({ title, onClose, children, maxWidth = 480 }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: '0 20px 60px rgba(0,0,0,.15)', width: '100%', maxWidth, padding: '1.5rem', margin: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ ...S.iconBtn(), border: 'none', background: 'none' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div className="app-shell">

      {/* ── 헤더 ── */}
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <span className="brand-emoji">📂</span>
          <div>
            <h1 className="brand-title">이슈별 분석 정리</h1>
            <p className="brand-sub">BRM 뉴스 인텔리전스</p>
          </div>
        </div>
        <button
          onClick={() => { setShowArticleForm(true); resetArticleForm(); }}
          style={S.btn('var(--accent)')}
        >
          <FileText size={14} /> 글 작성하기
        </button>
      </header>

      {/* ── 메인 레이아웃 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem', width: '100%', boxSizing: 'border-box' }}>

        {/* ── 폴더 패널 ── */}
        <div style={{ ...S.card, padding: '1.25rem', height: 'calc(100vh - 140px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>폴더 목록</span>
            <button
              onClick={() => { setShowFolderForm(true); setEditingFolder(null); setFolderName(''); setFolderDescription(''); setParentFolderForNew(null); }}
              style={{ ...S.btn('#6d28d9'), padding: '5px 10px', fontSize: 12 }}
            >
              <FolderPlus size={13} /> 새 폴더
            </button>
          </div>

          <div style={{ flex: 1 }}>
            {folders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: 13 }}>
                <FolderPlus size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                폴더가 없습니다.<br />새 폴더를 만들어주세요.
              </div>
            ) : (
              flatFolders.map(folder => {
                const isExpanded = expandedFolders.has(folder.id);
                const fArticles = folderArticles[folder.id] || [];
                const indent = (folder.level || 0) * 14;
                return (
                  <div key={folder.id} style={{ marginLeft: indent }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px', borderRadius: 8, marginBottom: 2, background: dragOverFolderId === folder.id ? '#dcfce7' : 'transparent', border: dragOverFolderId === folder.id ? '1.5px dashed #16a34a' : '1.5px solid transparent', cursor: 'default' }}
                      onDragOver={(e) => handleDragOver(e, folder.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folder.id)}
                    >
                      <button onClick={() => toggleFolder(folder)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</p>
                        {folder.description && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{folder.description}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); setParentFolderForNew(folder); setShowFolderForm(true); setEditingFolder(null); setFolderName(''); setFolderDescription(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, color: '#16a34a' }} title="하위 폴더">
                          <Plus size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEditFolder(folder); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, color: '#6d28d9' }} title="수정">
                          <Edit size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, color: '#dc2626' }} title="삭제">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginLeft: 22, marginBottom: 4 }}>
                        {fArticles.length === 0
                          ? <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>글이 없습니다</p>
                          : fArticles.map(article => (
                            <div
                              key={article.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, article)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedArticle(article)}
                              style={{ padding: '7px 10px', borderRadius: 7, marginBottom: 2, cursor: 'grab', background: selectedArticle?.id === article.id ? '#eff6ff' : 'transparent', border: `1px solid ${selectedArticle?.id === article.id ? '#93c5fd' : 'transparent'}`, opacity: draggedArticle?.id === article.id ? 0.4 : 1, position: 'relative' }}
                              className="group"
                            >
                              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(article.created_at).toLocaleDateString('ko-KR')}</p>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 글 상세 패널 ── */}
        <div style={{ ...S.card, padding: '1.5rem', height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {selectedArticle ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 6 }}>{selectedArticle.title}</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(selectedArticle.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setArticleToMove(selectedArticle); setTargetFolderId(''); setShowMoveModal(true); }} style={S.iconBtn()} title="폴더 이동">
                    <MoveRight size={15} style={{ color: '#16a34a' }} />
                  </button>
                  <button onClick={() => { setEditingArticle(selectedArticle); setArticleTitle(selectedArticle.title); setArticleSource(selectedArticle.source); setArticleSummary(selectedArticle.summary); setArticleInsight(selectedArticle.insight); setArticleFolderId(selectedArticle.folder_id); setShowArticleForm(true); }} style={S.iconBtn()} title="수정">
                    <Edit size={15} style={{ color: 'var(--accent)' }} />
                  </button>
                  <button onClick={() => { if (confirm('이 글을 삭제하시겠습니까?')) { handleDeleteArticle(selectedArticle.id); setSelectedArticle(null); } }} style={S.iconBtn()} title="삭제">
                    <Trash2 size={15} style={{ color: '#dc2626' }} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[
                  { label: '📎 정보 소스', content: selectedArticle.source, accent: '#6d28d9', bg: '#f5f3ff' },
                  { label: '📝 내용 요약', content: selectedArticle.summary, accent: 'var(--accent)', bg: '#eff6ff' },
                  { label: '💡 인사이트 (현대차 관점)', content: selectedArticle.insight, accent: '#15803d', bg: '#f0fdf4' },
                ].map(({ label, content, accent, bg }) => (
                  <div key={label}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent, marginBottom: 8 }}>{label}</p>
                    <div style={{ background: bg, borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, wordBreak: 'break-all' }}>{content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>왼쪽 폴더에서 글을 선택해주세요</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>폴더를 클릭하면 글 목록이 펼쳐집니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 글 이동 모달 ── */}
      {showMoveModal && articleToMove && (
        <Modal title="글 이동" onClose={() => { setShowMoveModal(false); setArticleToMove(null); setTargetFolderId(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>이동할 글</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{articleToMove.title}</p>
            </div>
            <div>
              <label style={S.label}>이동할 폴더 선택</label>
              <select value={targetFolderId} onChange={e => setTargetFolderId(e.target.value)} style={S.input}>
                <option value="">폴더를 선택하세요</option>
                {flatFolders.filter(f => f.id !== articleToMove.folder_id).map(f => (
                  <option key={f.id} value={f.id}>{'　'.repeat(f.level || 0)}{f.name}</option>
                ))}
              </select>
            </div>
            <button onClick={handleMoveArticle} disabled={!targetFolderId} style={{ ...S.btn('#16a34a'), justifyContent: 'center', opacity: !targetFolderId ? 0.4 : 1, cursor: !targetFolderId ? 'not-allowed' : 'pointer' }}>
              <MoveRight size={15} /> 이동하기
            </button>
          </div>
        </Modal>
      )}

      {/* ── 폴더 생성/수정 모달 ── */}
      {(showFolderForm || editingFolder) && (
        <Modal
          title={editingFolder ? '폴더 수정' : parentFolderForNew ? `하위 폴더 만들기` : '새 폴더 만들기'}
          onClose={() => { setShowFolderForm(false); setEditingFolder(null); setFolderName(''); setFolderDescription(''); setParentFolderForNew(null); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {parentFolderForNew && !editingFolder && (
              <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '8px 12px', border: '1px solid #ddd6fe' }}>
                <p style={{ fontSize: 11, color: '#6d28d9', marginBottom: 2 }}>상위 폴더</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#4c1d95' }}>{parentFolderForNew.name}</p>
              </div>
            )}
            <div>
              <label style={S.label}>폴더 이름 *</label>
              <input type="text" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="예: 미중 무역 분쟁" style={S.input} />
            </div>
            <div>
              <label style={S.label}>설명 (선택)</label>
              <textarea value={folderDescription} onChange={e => setFolderDescription(e.target.value)} placeholder="폴더에 대한 간단한 설명" rows={3} style={S.textarea} />
            </div>
            <button onClick={editingFolder ? handleUpdateFolder : (parentFolderForNew ? handleCreateSubfolder : handleCreateFolder)} style={{ ...S.btn('#6d28d9'), justifyContent: 'center' }}>
              <Save size={14} /> {editingFolder ? '수정하기' : '생성하기'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── 글 작성 모달 ── */}
      {showArticleForm && (
        <Modal title={editingArticle ? '글 수정하기' : '새 글 작성하기'} onClose={() => { setShowArticleForm(false); resetArticleForm(); setEditingArticle(null); }} maxWidth={680}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 폴더 선택 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>폴더 선택 *</label>
                <button type="button" onClick={() => { setShowArticleForm(false); setShowFolderForm(true); }} style={{ ...S.btn('#16a34a'), padding: '4px 10px', fontSize: 12 }}>
                  <FolderPlus size={12} /> 새 폴더
                </button>
              </div>
              <select value={articleFolderId} onChange={e => setArticleFolderId(e.target.value)} style={S.input}>
                <option value="">폴더를 선택하세요</option>
                {flatFolders.map(f => <option key={f.id} value={f.id}>{'　'.repeat(f.level || 0)}{f.name}</option>)}
              </select>
              {folders.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>생성된 폴더가 없습니다. "새 폴더" 버튼으로 먼저 만들어주세요.</p>}
            </div>

            {/* 제목 */}
            <div>
              <label style={S.label}>제목 *</label>
              <input type="text" value={articleTitle} onChange={e => setArticleTitle(e.target.value)} placeholder="글 제목을 입력하세요" style={S.input} />
            </div>

            {/* 정보 소스 */}
            <div>
              <label style={{ ...S.label, color: '#6d28d9' }}>📎 정보 소스 *</label>
              <textarea value={articleSource} onChange={e => setArticleSource(e.target.value)} placeholder="참고한 정보의 출처 (뉴스 링크, 보고서 등)" rows={3} style={S.textarea} />
            </div>

            {/* 내용 요약 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...S.label, color: 'var(--accent)', marginBottom: 0 }}>📝 내용 요약 *</label>
                <button type="button" onClick={handleGenerateAISummary} disabled={isGeneratingSummary || !articleSource.trim()}
                  style={{ ...S.btn('linear-gradient(135deg,#3b82f6,#6d28d9)'), padding: '5px 12px', fontSize: 12, opacity: (isGeneratingSummary || !articleSource.trim()) ? 0.5 : 1, cursor: (isGeneratingSummary || !articleSource.trim()) ? 'not-allowed' : 'pointer' }}>
                  <Sparkles size={12} style={isGeneratingSummary ? { animation: 'spin 1s linear infinite' } : {}} />
                  {isGeneratingSummary ? 'AI 요약 중...' : 'AI 요약'}
                </button>
              </div>
              <textarea value={articleSummary} onChange={e => setArticleSummary(e.target.value)} placeholder="핵심 내용 요약 (또는 AI 요약 버튼 사용)" rows={5} style={S.textarea} />
            </div>

            {/* 인사이트 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...S.label, color: '#15803d', marginBottom: 0 }}>💡 인사이트 (현대차 관점) *</label>
                <div style={{ position: 'relative' }} className="relative">
                  <button type="button" onClick={() => setShowExternalAIMenu(!showExternalAIMenu)} disabled={!articleTitle.trim() || !articleSummary.trim()}
                    style={{ ...S.btn('linear-gradient(135deg,#f97316,#dc2626)'), padding: '5px 12px', fontSize: 12, opacity: (!articleTitle.trim() || !articleSummary.trim()) ? 0.5 : 1 }}>
                    <ExternalLink size={12} /> 다른 AI 사용하기
                  </button>
                  {showExternalAIMenu && (
                    <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: 160, overflow: 'hidden' }}>
                      {[{ id: 'chatgpt', label: 'ChatGPT', color: '#16a34a' }, { id: 'gemini', label: 'Google Gemini', color: '#1d4ed8' }].map(ai => (
                        <button key={ai.id} type="button" onClick={() => handleOpenExternalAI(ai.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}>
                          <ExternalLink size={13} style={{ color: ai.color }} /> {ai.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <textarea value={articleInsight} onChange={e => setArticleInsight(e.target.value)} placeholder="현대차 관점에서의 전략적 인사이트 입력" rows={5} style={S.textarea} />
            </div>

            {/* AI 인사이트 비교 */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <p style={{ ...S.label, marginBottom: 12 }}>🤖 AI 인사이트 비교 (참고용)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { model: 'gpt', label: 'GPT-4o-mini', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', loading: isGeneratingInsightGPT, value: articleInsightGPT, setter: setArticleInsightGPT },
                  { model: 'claude', label: 'Claude Sonnet 4', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', loading: isGeneratingInsightClaude, value: articleInsightClaude, setter: setArticleInsightClaude },
                ].map(({ model, label, color, bg, border, loading, value, setter }) => (
                  <div key={model}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
                      <button type="button" onClick={() => handleGenerateAIInsight(model)} disabled={loading || !articleTitle.trim() || !articleSummary.trim()}
                        style={{ ...S.btn(color), padding: '4px 10px', fontSize: 11, opacity: (loading || !articleTitle.trim() || !articleSummary.trim()) ? 0.5 : 1 }}>
                        <Sparkles size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                        {loading ? '분석 중...' : `${model.toUpperCase()} 분석`}
                      </button>
                    </div>
                    <textarea value={value} onChange={e => setter(e.target.value)} placeholder={`${label} 분석 결과`} rows={8}
                      style={{ ...S.textarea, background: bg, border: `1px solid ${border}`, fontSize: 12 }} readOnly />
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleCreateArticle} style={{ ...S.btn('var(--accent)'), justifyContent: 'center', padding: '12px' }}>
              <Save size={15} /> 등록하기
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
