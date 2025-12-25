export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/archived_articles?select=count`,
      {
        method: 'HEAD',
        headers
      }
    );

    res.status(200).json({
      success: true,
      status: response.status,
      message: 'Basic fetch works'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
