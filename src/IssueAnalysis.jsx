import React, { useState, useEffect } from 'react';
import { FolderPlus, FileText, Edit, Trash2, ArrowLeft, Save, X, Sparkles } from 'lucide-react';

export default function IssueAnalysis({ onBack }) {
  const [folders, setFolders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
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
  const [articleFolderId, setArticleFolderId] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

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
        loadFolders();
        setShowFolderForm(false);
        setFolderName('');
        setFolderDescription('');
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
    if (!confirm('이 글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/issue-articles?id=${articleId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        loadArticles(selectedFolder.id);
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

    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: articleSource
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
          {/* 폴더 목록 */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">폴더 목록</h2>
            <div className="space-y-2">
              {folders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">폴더가 없습니다.<br/>새 폴더를 만들어주세요.</p>
              ) : (
                folders.map(folder => (
                  <div
                    key={folder.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedFolder?.id === folder.id
                        ? 'bg-purple-50 border-purple-500'
                        : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                    }`}
                    onClick={() => setSelectedFolder(folder)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{folder.name}</h3>
                        {folder.description && (
                          <p className="text-sm text-gray-600 mt-1">{folder.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditFolder(folder);
                          }}
                          className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4 text-purple-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                          }}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 글 목록 */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            {selectedFolder ? (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  {selectedFolder.name} - 글 목록
                </h2>
                <div className="space-y-4">
                  {articles.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">글이 없습니다.<br/>새 글을 작성해주세요.</p>
                  ) : (
                    articles.map(article => (
                      <div key={article.id} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-200">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-800 flex-1">{article.title}</h3>
                          <button
                            onClick={() => handleDeleteArticle(article.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors ml-2"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-bold text-purple-700 mb-1">📚 정보 소스</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{article.source}</p>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-blue-700 mb-1">📝 내용 요약</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{article.summary}</p>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-green-700 mb-1">💡 인사이트</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{article.insight}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <p className="text-xs text-gray-500">
                            작성일: {new Date(article.created_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center">
                  왼쪽에서 폴더를 선택하거나<br/>새 폴더를 만들어주세요.
                </p>
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
                  <label className="block text-sm font-bold text-gray-700 mb-2">폴더 선택 *</label>
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
                  <label className="block text-sm font-bold text-green-700 mb-2">💡 인사이트 *</label>
                  <textarea
                    value={articleInsight}
                    onChange={(e) => setArticleInsight(e.target.value)}
                    placeholder="분석 및 개인적인 인사이트를 입력하세요"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
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
