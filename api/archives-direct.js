// Direct REST API implementation without SDK
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

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing Supabase credentials'
    });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // GET - 모든 아카이브된 기사 가져오기
    if (req.method === 'GET') {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/archived_articles?select=*&order=created_at.desc`,
        { headers }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase API error: ${error}`);
      }

      const data = await response.json();

      // Transform database format to app format
      const archives = (data || []).map(row => ({
        articleKey: row.article_key,
        category: row.category,
        company: row.company,
        title: row.title,
        description: row.description,
        url: row.url,
        urlToImage: row.url_to_image,
        publishedAt: row.published_at,
        source: { name: row.source_name }
      }));

      res.status(200).json({
        success: true,
        archives
      });
    }

    // POST - 새 기사 아카이브
    else if (req.method === 'POST') {
      const { articles } = req.body;

      if (!articles || !Array.isArray(articles)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request: articles array required'
        });
      }

      // Transform app format to database format
      const articlesToInsert = articles.map(article => ({
        article_key: article.articleKey,
        category: article.category,
        company: article.company,
        title: article.title,
        description: article.description,
        url: article.url,
        url_to_image: article.urlToImage,
        published_at: article.publishedAt,
        source_name: article.source?.name || 'Unknown'
      }));

      // Upsert with REST API
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/archived_articles`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Prefer': 'resolution=ignore-duplicates,return=representation'
          },
          body: JSON.stringify(articlesToInsert)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase API error: ${error}`);
      }

      const data = await response.json();

      // Get total count
      const countResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/archived_articles?select=count`,
        {
          headers: {
            ...headers,
            'Prefer': 'count=exact'
          }
        }
      );

      const countHeader = countResponse.headers.get('content-range');
      const total = countHeader ? parseInt(countHeader.split('/')[1]) : 0;

      res.status(200).json({
        success: true,
        added: data?.length || 0,
        total
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

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/archived_articles?article_key=eq.${encodeURIComponent(articleKey)}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase API error: ${error}`);
      }

      res.status(200).json({
        success: true,
        removed: 1
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
