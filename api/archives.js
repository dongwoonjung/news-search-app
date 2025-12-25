export default async function handler(req, res) {
  // Supabase 클라이언트를 함수 내부에서 생성 (환경 변수가 런타임에 주입됨)
  console.log('🔧 Initializing Supabase client...');
  console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials!');
    return res.status(500).json({
      success: false,
      error: 'Missing Supabase credentials'
    });
  }

  // Dynamic import for Supabase
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  console.log('✅ Supabase client created successfully');
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
      const { data, error } = await supabase
        .from('archived_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        category: article.category || 'general',
        company: article.company || '',
        title: article.title,
        description: article.description || '',
        url: article.url,
        url_to_image: article.urlToImage || '',
        published_at: article.publishedAt,
        source_name: article.source?.name || 'Unknown'
      }));

      // Insert with upsert (ignore duplicates)
      const { data, error } = await supabase
        .from('archived_articles')
        .upsert(articlesToInsert, {
          onConflict: 'article_key',
          ignoreDuplicates: true
        })
        .select();

      if (error) throw error;

      // Count total articles
      const { count } = await supabase
        .from('archived_articles')
        .select('*', { count: 'exact', head: true });

      res.status(200).json({
        success: true,
        added: data?.length || 0,
        total: count || 0
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

      const { error } = await supabase
        .from('archived_articles')
        .delete()
        .eq('article_key', articleKey);

      if (error) throw error;

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
