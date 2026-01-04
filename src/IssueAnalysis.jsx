import React, { useState, useEffect } from 'react';
import { FolderPlus, FileText, Edit, Trash2, ArrowLeft, Save, X, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

export default function IssueAnalysis({ onBack, initialArticleData }) {
  const [folders, setFolders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderArticles, setFolderArticles] = useState({}); // 폴더별 글 목록 저장
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);

  // 폴더 폼 상태
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');

  // 글 작성 폼 상태
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

  const isDev = import.meta.env.DEV;
  const apiBaseUrl = isDev ? 'https://newsapp-sable-two.vercel.app' : '';

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadArticles(selectedFolder.id);
    }
  }, [selectedFolder]);

  // 초기 기사 데이터가 있으면 자동으로 폼 열고 채우기
  useEffect(() => {
    if (initialArticleData) {
      console.log('📝 [IssueAnalysis] Initializing form with article data:');
      console.log('  Title:', initialArticleData.title);
      console.log('  URL:', initialArticleData.url);
      setShowArticleForm(true);
      setArticleTitle(initialArticleData.title || '');
      setArticleSource(initialArticleData.url || '');
    }
  }, [initialArticleData]);

  const loadFolders = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-folders`);
      const data = await response.json();
      if (data.success) {
        setFolders(data.folders);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const loadArticles = async (folderId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-articles?folderId=${folderId}`);
      const data = await response.json();
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (error) {
      console.error('Failed to load articles:', error);
    }
  };

  // 폴더별 글 목록 로드
  const loadFolderArticles = async (folderId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-articles?folderId=${folderId}`);
      const data = await response.json();
      if (data.success) {
        setFolderArticles(prev => ({
          ...prev,
          [folderId]: data.articles
        }));
      }
    } catch (error) {
      console.error('Failed to load folder articles:', error);
    }
  };

  // 폴더 클릭 시 확장/축소 및 글 목록 로드
  const toggleFolder = async (folder) => {
    const newExpanded = new Set(expandedFolders);

    if (newExpanded.has(folder.id)) {
      // 축소
      newExpanded.delete(folder.id);
    } else {
      // 확장 및 글 목록 로드
      newExpanded.add(folder.id);
      if (!folderArticles[folder.id]) {
        await loadFolderArticles(folder.id);
      }
    }

    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      alert('폴더 이름을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, description: folderDescription })
      });

      const data = await response.json();
      if (data.success) {
        await loadFolders(); // 폴더 목록 새로고침
        setShowFolderForm(false);
        setFolderName('');
        setFolderDescription('');

        // 새로 생성된 폴더를 자동 선택
        if (data.folder && data.folder.id) {
          setArticleFolderId(data.folder.id);
        }

        // 글 작성 폼으로 다시 돌아가기
        setShowArticleForm(true);
        alert('폴더가 생성되었습니다.');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('폴더 생성에 실패했습니다.');
    }
  };

  const handleUpdateFolder = async () => {
    if (!folderName.trim()) {
      alert('폴더 이름을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-folders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingFolder.id, name: folderName, description: folderDescription })
      });

      const data = await response.json();
      if (data.success) {
        loadFolders();
        setEditingFolder(null);
        setFolderName('');
        setFolderDescription('');
        alert('폴더가 수정되었습니다.');
      }
    } catch (error) {
      console.error('Failed to update folder:', error);
      alert('폴더 수정에 실패했습니다.');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!confirm('이 폴더와 모든 글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-folders?id=${folderId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        loadFolders();
        if (selectedFolder?.id === folderId) {
          setSelectedFolder(null);
          setArticles([]);
        }
        alert('폴더가 삭제되었습니다.');
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert('폴더 삭제에 실패했습니다.');
    }
  };

  const handleCreateArticle = async () => {
    if (!articleTitle.trim() || !articleSource.trim() || !articleSummary.trim() || !articleInsight.trim() || !articleFolderId) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: parseInt(articleFolderId),
          title: articleTitle,
          source: articleSource,
          summary: articleSummary,
          insight: articleInsight
        })
      });

      const data = await response.json();
      if (data.success) {
        // 해당 폴더의 글 목록 새로고침
        await loadFolderArticles(articleFolderId);
        if (selectedFolder?.id === parseInt(articleFolderId)) {
          loadArticles(articleFolderId);
        }
        setShowArticleForm(false);
        resetArticleForm();
        alert('글이 등록되었습니다.');
      }
    } catch (error) {
      console.error('Failed to create article:', error);
      alert('글 등록에 실패했습니다.');
    }
  };

  const handleDeleteArticle = async (articleId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-articles?id=${articleId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        // 해당 글이 속한 폴더의 글 목록 새로고침
        if (selectedArticle?.folder_id) {
          await loadFolderArticles(selectedArticle.folder_id);
        }
        if (selectedFolder?.id) {
          loadArticles(selectedFolder.id);
        }
        alert('글이 삭제되었습니다.');
      }
    } catch (error) {
      console.error('Failed to delete article:', error);
      alert('글 삭제에 실패했습니다.');
    }
  };

  const resetArticleForm = () => {
    setArticleTitle('');
    setArticleSource('');
    setArticleSummary('');
    setArticleInsight('');
    setArticleFolderId('');
  };

  const handleGenerateAISummary = async () => {
    if (!articleSource.trim()) {
      alert('정보 소스를 먼저 입력해주세요.');
      return;
    }

    console.log('🔍 [AI Summary Request]');
    console.log('  Title:', articleTitle);
    console.log('  Source:', articleSource);

    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: articleSource,
          title: articleTitle // 제목도 함께 전달
        })
      });

      const data = await response.json();

      if (data.success) {
        setArticleSummary(data.summary);
      } else {
        alert('요약 생성에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      alert('요약 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateAIInsight = async (model) => {
    if (!articleTitle.trim() || !articleSummary.trim()) {
      alert('제목과 내용 요약을 먼저 입력해주세요.');
      return;
    }

    console.log(`💡 [AI Insight Request - ${model.toUpperCase()}]`);
    console.log('  Title:', articleTitle);
    console.log('  Summary length:', articleSummary.length);

    const setLoading = model === 'gpt' ? setIsGeneratingInsightGPT : setIsGeneratingInsightClaude;
    const setInsight = model === 'gpt' ? setArticleInsightGPT : setArticleInsightClaude;

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai-insight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          model: model
        })
      });

      const data = await response.json();

      if (data.success) {
        setInsight(data.insight);
      } else {
        alert(`${model.toUpperCase()} 인사이트 생성에 실패했습니다: ` + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error(`Failed to generate ${model.toUpperCase()} insight:`, error);
      alert(`${model.toUpperCase()} 인사이트 생성 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };

  const openEditFolder = (folder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description || '');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800">이슈별 분석 정리</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowFolderForm(true);
                  setEditingFolder(null);
                  setFolderName('');
                  setFolderDescription('');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FolderPlus className="w-5 h-5" />
                폴더 생성
              </button>
              <button
                onClick={() => {
                  setShowArticleForm(true);
                  resetArticleForm();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FileText className="w-5 h-5" />
                글 작성하기
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 폴더 및 글 트리 목록 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">폴더 목록</h2>
            <div className="space-y-1">
              {folders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">폴더가 없습니다.<br/>새 폴더를 만들어주세요.</p>
              ) : (
                folders.map(folder => {
                  const isExpanded = expandedFolders.has(folder.id);
                  const articles = folderArticles[folder.id] || [];

                  return (
                    <div key={folder.id} className="border-b border-gray-200 last:border-b-0">
                      {/* 폴더 헤더 */}
                      <div className="flex items-center gap-2 p-3 hover:bg-gray-50 rounded-lg">
                        <button
                          onClick={() => toggleFolder(folder)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">{folder.name}</h3>
                          {folder.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{folder.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditFolder(folder);
                            }}
                            className="p-1.5 hover:bg-purple-100 rounded transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5 text-purple-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.id);
                            }}
                            className="p-1.5 hover:bg-red-100 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      </div>

                      {/* 폴더 내 글 목록 */}
                      {isExpanded && (
                        <div className="ml-8 space-y-1 mb-2">
                          {articles.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2 px-3">글이 없습니다</p>
                          ) : (
                            articles.map(article => (
                              <div
                                key={article.id}
                                onClick={() => setSelectedArticle(article)}
                                className={`p-2 rounded cursor-pointer transition-colors ${
                                  selectedArticle?.id === article.id
                                    ? 'bg-indigo-100 border border-indigo-300'
                                    : 'hover:bg-gray-100'
                                }`}
                              >
                                <p className="text-sm font-medium text-gray-700 line-clamp-2">
                                  {article.title}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(article.created_at).toLocaleDateString('ko-KR')}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 글 상세 보기 */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {selectedArticle ? (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedArticle.title}</h2>
                    <p className="text-sm text-gray-500">
                      작성일: {new Date(selectedArticle.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingArticle(selectedArticle);
                        setArticleTitle(selectedArticle.title);
                        setArticleSource(selectedArticle.source);
                        setArticleSummary(selectedArticle.summary);
                        setArticleInsight(selectedArticle.insight);
                        setArticleFolderId(selectedArticle.folder_id);
                        setShowArticleForm(true);
                      }}
                      className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      <Edit className="w-5 h-5 text-indigo-600" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('이 글을 삭제하시겠습니까?')) {
                          handleDeleteArticle(selectedArticle.id);
                          setSelectedArticle(null);
                        }
                      }}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* 정보 소스 */}
                  <div>
                    <h3 className="text-sm font-bold text-purple-700 mb-2">📎 정보 소스</h3>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 break-all">{selectedArticle.source}</p>
                    </div>
                  </div>

                  {/* 내용 요약 */}
                  <div>
                    <h3 className="text-sm font-bold text-blue-700 mb-2">📝 내용 요약</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedArticle.summary}
                      </p>
                    </div>
                  </div>

                  {/* 인사이트 */}
                  <div>
                    <h3 className="text-sm font-bold text-green-700 mb-2">💡 인사이트</h3>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedArticle.insight}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">왼쪽 폴더에서 글을 선택해주세요</p>
                <p className="text-gray-400 text-sm mt-2">폴더를 클릭하여 글 목록을 확인할 수 있습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 폴더 생성/수정 모달 */}
        {(showFolderForm || editingFolder) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingFolder ? '폴더 수정' : '새 폴더 만들기'}
                </h3>
                <button
                  onClick={() => {
                    setShowFolderForm(false);
                    setEditingFolder(null);
                    setFolderName('');
                    setFolderDescription('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">폴더 이름 *</label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="예: 미중 무역 분쟁"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">설명 (선택)</label>
                  <textarea
                    value={folderDescription}
                    onChange={(e) => setFolderDescription(e.target.value)}
                    placeholder="폴더에 대한 간단한 설명을 입력하세요"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <button
                  onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  {editingFolder ? '수정하기' : '생성하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 글 작성 모달 */}
        {showArticleForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full my-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">새 글 작성하기</h3>
                <button
                  onClick={() => {
                    setShowArticleForm(false);
                    resetArticleForm();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">폴더 선택 *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowArticleForm(false);
                        setShowFolderForm(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                      새 폴더
                    </button>
                  </div>
                  <select
                    value={articleFolderId}
                    onChange={(e) => setArticleFolderId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">폴더를 선택하세요</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                  {folders.length === 0 && (
                    <p className="mt-2 text-sm text-gray-500">
                      생성된 폴더가 없습니다. "새 폴더" 버튼을 눌러 폴더를 먼저 만들어주세요.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                  <input
                    type="text"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="글 제목을 입력하세요"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-purple-700 mb-2">📚 정보 소스 *</label>
                  <textarea
                    value={articleSource}
                    onChange={(e) => setArticleSource(e.target.value)}
                    placeholder="참고한 정보의 출처를 입력하세요 (예: 뉴스 링크, 보고서 등)"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-blue-700">📝 내용 요약 *</label>
                    <button
                      type="button"
                      onClick={handleGenerateAISummary}
                      disabled={isGeneratingSummary || !articleSource.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      <Sparkles className={`w-4 h-4 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                      {isGeneratingSummary ? 'AI 요약 중...' : 'AI 요약'}
                    </button>
                  </div>
                  <textarea
                    value={articleSummary}
                    onChange={(e) => setArticleSummary(e.target.value)}
                    placeholder="핵심 내용을 요약해서 입력하세요 (또는 AI 요약 버튼을 사용하세요)"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-green-700">💡 인사이트 (현대차 관점) *</label>
                  </div>
                  <textarea
                    value={articleInsight}
                    onChange={(e) => setArticleInsight(e.target.value)}
                    placeholder="현대차 관점에서의 전략적 인사이트를 입력하세요 (또는 아래 AI 분석 버튼을 사용하세요)"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* AI 인사이트 비교 섹션 */}
                <div className="border-t-2 border-gray-200 pt-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">🤖 AI 인사이트 비교 (참고용)</h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* GPT 분석 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-blue-600">GPT-4o-mini</label>
                        <button
                          type="button"
                          onClick={() => handleGenerateAIInsight('gpt')}
                          disabled={isGeneratingInsightGPT || !articleTitle.trim() || !articleSummary.trim()}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isGeneratingInsightGPT ? 'animate-spin' : ''}`} />
                          {isGeneratingInsightGPT ? '분석 중...' : 'GPT 분석'}
                        </button>
                      </div>
                      <textarea
                        value={articleInsightGPT}
                        onChange={(e) => setArticleInsightGPT(e.target.value)}
                        placeholder="GPT 분석 결과가 여기에 표시됩니다"
                        rows={8}
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-blue-50"
                        readOnly
                      />
                    </div>

                    {/* Claude 분석 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-purple-600">Claude Sonnet 4</label>
                        <button
                          type="button"
                          onClick={() => handleGenerateAIInsight('claude')}
                          disabled={isGeneratingInsightClaude || !articleTitle.trim() || !articleSummary.trim()}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isGeneratingInsightClaude ? 'animate-spin' : ''}`} />
                          {isGeneratingInsightClaude ? '분석 중...' : 'Claude 분석'}
                        </button>
                      </div>
                      <textarea
                        value={articleInsightClaude}
                        onChange={(e) => setArticleInsightClaude(e.target.value)}
                        placeholder="Claude 분석 결과가 여기에 표시됩니다"
                        rows={8}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-purple-50"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateArticle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  등록하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
