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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PATCH,OPTIONS');
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
        companyId: row.company_id,
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
        company_id: article.companyId || '',
        title: article.title,
        description: article.description || article.summary || '',
        url: article.url,
        url_to_image: article.urlToImage || '',
        published_at: article.publishedAt,
        source_name: typeof article.source === 'string'
          ? article.source
          : (article.source?.name || 'Unknown')
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

    // PATCH - 자동차 카테고리 기사의 companyId 자동 매핑
    else if (req.method === 'PATCH') {
      console.log('🔄 Starting auto-mapping of company IDs...');

      // 회사명 -> companyId 매핑 테이블
      const companyNameToId = {
        '현대자동차': 'hyundai',
        '현대': 'hyundai',
        'Hyundai': 'hyundai',
        '테슬라': 'tesla',
        'Tesla': 'tesla',
        '도요타': 'toyota',
        'Toyota': 'toyota',
        'GM': 'gm',
        '벤츠': 'mercedes',
        'Mercedes': 'mercedes',
        'Mercedes-Benz': 'mercedes',
        '포드': 'ford',
        'Ford': 'ford',
        '산업 공통': 'industry',
        '산업공통': 'industry'
      };

      // 자동차 카테고리이면서 company_id가 비어있는 기사들 찾기
      const { data: articlesToUpdate, error: fetchError } = await supabase
        .from('archived_articles')
        .select('*')
        .eq('category', 'automotive')
        .or('company_id.is.null,company_id.eq.');

      if (fetchError) throw fetchError;

      console.log(`📊 Found ${articlesToUpdate?.length || 0} automotive articles with empty companyId`);

      let updatedCount = 0;
      const updates = [];

      // 각 기사의 company 필드를 보고 companyId 추론
      for (const article of articlesToUpdate || []) {
        const companyName = article.company?.trim();

        if (!companyName) {
          console.log(`⚠️ Skipping article "${article.title?.substring(0, 50)}" - no company name`);
          continue;
        }

        // 매핑 테이블에서 companyId 찾기
        let inferredCompanyId = null;

        for (const [name, id] of Object.entries(companyNameToId)) {
          if (companyName.includes(name)) {
            inferredCompanyId = id;
            break;
          }
        }

        if (inferredCompanyId) {
          console.log(`✅ Mapping: "${companyName}" → "${inferredCompanyId}"`);
          updates.push({
            article_key: article.article_key,
            company_id: inferredCompanyId
          });
        } else {
          console.log(`⚠️ No mapping found for: "${companyName}"`);
        }
      }

      // 일괄 업데이트
      if (updates.length > 0) {
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('archived_articles')
            .update({ company_id: update.company_id })
            .eq('article_key', update.article_key);

          if (!updateError) {
            updatedCount++;
          } else {
            console.error(`❌ Failed to update ${update.article_key}:`, updateError);
          }
        }
      }

      console.log(`🎉 Auto-mapping complete: ${updatedCount} articles updated`);

      res.status(200).json({
        success: true,
        message: 'Company IDs auto-mapped successfully',
        updated: updatedCount,
        total: articlesToUpdate?.length || 0
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
