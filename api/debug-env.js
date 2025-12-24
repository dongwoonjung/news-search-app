export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const newsApiKey = process.env.NEWS_API_KEY;
  const viteNewsApiKey = process.env.VITE_NEWS_API_KEY;

  res.status(200).json({
    NEWS_API_KEY_exists: !!newsApiKey,
    NEWS_API_KEY_length: newsApiKey ? newsApiKey.length : 0,
    NEWS_API_KEY_preview: newsApiKey ? newsApiKey.substring(0, 8) + '...' : 'Not found',
    VITE_NEWS_API_KEY_exists: !!viteNewsApiKey,
    VITE_NEWS_API_KEY_length: viteNewsApiKey ? viteNewsApiKey.length : 0,
    VITE_NEWS_API_KEY_preview: viteNewsApiKey ? viteNewsApiKey.substring(0, 8) + '...' : 'Not found',
    env_keys: Object.keys(process.env).filter(key => key.includes('NEWS') || key.includes('API'))
  });
}
