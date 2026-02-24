export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Supabase 클라이언트 초기화
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing Supabase credentials'
    });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // GET - 리포트 목록 조회
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reports = (data || []).map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        content: row.content,
        filename: row.filename,
        fileUrl: row.file_url,
        createdAt: row.created_at,
      }));

      return res.status(200).json({ success: true, reports });
    }

    // POST - 리포트 저장
    if (req.method === 'POST') {
      const { title, content, category, filename, fileData } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: 'Title and content are required'
        });
      }

      let fileUrl = null;

      // 파일 데이터가 있으면 Storage에 업로드
      if (fileData) {
        const buffer = Buffer.from(fileData, 'base64');
        const storagePath = `reports/${Date.now()}_${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(storagePath, buffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('reports')
            .getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;
        }
      }

      // 메타데이터 저장
      const { data, error } = await supabase
        .from('reports')
        .insert([{
          title,
          content,
          category: category || null,
          filename: filename || null,
          file_url: fileUrl,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        report: {
          id: data.id,
          title: data.title,
          fileUrl: data.file_url,
        }
      });
    }

    // DELETE - 리포트 삭제
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Report ID is required'
        });
      }

      // 먼저 리포트 정보 조회
      const { data: report } = await supabase
        .from('reports')
        .select('filename, file_url')
        .eq('id', id)
        .single();

      // Storage에서 파일 삭제
      if (report?.file_url) {
        const pathMatch = report.file_url.match(/reports\/(.+)$/);
        if (pathMatch) {
          await supabase.storage
            .from('reports')
            .remove([`reports/${pathMatch[1]}`]);
        }
      }

      // 메타데이터 삭제
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('Reports API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
