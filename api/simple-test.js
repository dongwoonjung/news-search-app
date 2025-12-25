export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    console.log('Testing with URL:', SUPABASE_URL);
    console.log('Key length:', SUPABASE_KEY?.length);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/archived_articles?select=*&limit=1`,
      {
        method: 'GET',
        headers
      }
    );

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', responseText);

    res.status(200).json({
      success: true,
      status: response.status,
      responseText: responseText.substring(0, 500),
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
