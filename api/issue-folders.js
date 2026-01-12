export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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

    // GET - 모든 폴더 조회
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('issue_folders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, folders: data });
    }

    // POST - 새 폴더 생성
    if (req.method === 'POST') {
      const { name, description, parentId } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Folder name is required' });
      }

      const insertData = { name, description: description || '' };
      if (parentId) {
        insertData.parent_id = parentId;
      }

      const { data, error } = await supabase
        .from('issue_folders')
        .insert([insertData])
        .select();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, folder: data[0] });
    }

    // PUT - 폴더 수정
    if (req.method === 'PUT') {
      const { id, name, description } = req.body;

      if (!id || !name) {
        return res.status(400).json({ success: false, error: 'Folder ID and name are required' });
      }

      const { data, error } = await supabase
        .from('issue_folders')
        .update({ name, description, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, folder: data[0] });
    }

    // DELETE - 폴더 삭제
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Folder ID is required' });
      }

      const { error } = await supabase
        .from('issue_folders')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in issue-folders API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
