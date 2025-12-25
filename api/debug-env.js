export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const newsApiKey = process.env.NEWS_API_KEY;
  const viteNewsApiKey = process.env.VITE_NEWS_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  res.status(200).json({
    NEWS_API_KEY_exists: !!newsApiKey,
    NEWS_API_KEY_length: newsApiKey ? newsApiKey.length : 0,
    NEWS_API_KEY_preview: newsApiKey ? newsApiKey.substring(0, 8) + '...' : 'Not found',
    VITE_NEWS_API_KEY_exists: !!viteNewsApiKey,
    VITE_NEWS_API_KEY_length: viteNewsApiKey ? viteNewsApiKey.length : 0,
    VITE_NEWS_API_KEY_preview: viteNewsApiKey ? viteNewsApiKey.substring(0, 8) + '...' : 'Not found',
    SUPABASE_URL_exists: !!supabaseUrl,
    SUPABASE_URL_length: supabaseUrl ? supabaseUrl.length : 0,
    SUPABASE_URL_preview: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Not found',
    SUPABASE_ANON_KEY_exists: !!supabaseKey,
    SUPABASE_ANON_KEY_length: supabaseKey ? supabaseKey.length : 0,
    SUPABASE_ANON_KEY_preview: supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'Not found',
    env_keys: Object.keys(process.env).filter(key => key.includes('NEWS') || key.includes('API') || key.includes('SUPABASE'))
  });
}
