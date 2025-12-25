import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // GET - 모든 아카이브된 기사 가져오기
    if (req.method === 'GET') {
      const archives = await kv.get('archived_articles') || [];
      res.status(200).json({
        success: true,
        archives
      });
    }

    // POST - 새 기사 아카이브 또는 전체 목록 업데이트
    else if (req.method === 'POST') {
      const { articles } = req.body;

      if (!articles || !Array.isArray(articles)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request: articles array required'
        });
      }

      // 현재 아카이브 가져오기
      const currentArchives = await kv.get('archived_articles') || [];

      // 새 기사들을 기존 아카이브에 추가 (중복 제거)
      const existingKeys = new Set(currentArchives.map(a => a.articleKey));
      const newArticles = articles.filter(a => !existingKeys.has(a.articleKey));
      const updatedArchives = [...currentArchives, ...newArticles];

      // KV에 저장
      await kv.set('archived_articles', updatedArchives);

      res.status(200).json({
        success: true,
        added: newArticles.length,
        total: updatedArchives.length
      });
    }

    // DELETE - 특정 기사 삭제
    else if (req.method === 'DELETE') {
      const { articleKey } = req.query;

      if (!articleKey) {
        return res.status(400).json({
          success: false,
          error: 'Article key required'
        });
      }

      const currentArchives = await kv.get('archived_articles') || [];
      const updatedArchives = currentArchives.filter(a => a.articleKey !== articleKey);

      await kv.set('archived_articles', updatedArchives);

      res.status(200).json({
        success: true,
        removed: currentArchives.length - updatedArchives.length
      });
    }

    else {
      res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Error in archives API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
