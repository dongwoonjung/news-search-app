export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // GET - 글 조회 (폴더별 또는 전체)
    if (req.method === 'GET') {
      const { folderId } = req.query;

      let query = supabase
        .from('issue_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (folderId) {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, articles: data });
    }

    // POST - 새 글 작성
    if (req.method === 'POST') {
      const { folderId, title, source, summary, insight } = req.body;

      if (!folderId || !title || !source || !summary || !insight) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required (folderId, title, source, summary, insight)'
        });
      }

      const { data, error } = await supabase
        .from('issue_articles')
        .insert([{
          folder_id: folderId,
          title,
          source,
          summary,
          insight
        }])
        .select();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, article: data[0] });
    }

    // PUT - 글 수정
    if (req.method === 'PUT') {
      const { id, title, source, summary, insight } = req.body;

      if (!id || !title || !source || !summary || !insight) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required'
        });
      }

      const { data, error } = await supabase
        .from('issue_articles')
        .update({
          title,
          source,
          summary,
          insight,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, article: data[0] });
    }

    // PATCH - 글 폴더 이동
    if (req.method === 'PATCH') {
      const { id, folderId } = req.body;

      if (!id || !folderId) {
        return res.status(400).json({
          success: false,
          error: 'Article ID and folder ID are required'
        });
      }

      const { data, error } = await supabase
        .from('issue_articles')
        .update({
          folder_id: folderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, article: data[0] });
    }

    // DELETE - 글 삭제
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Article ID is required' });
      }

      const { error } = await supabase
        .from('issue_articles')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in issue-articles API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
