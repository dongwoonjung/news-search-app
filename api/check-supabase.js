export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  // Test 1: Check env vars
  const envCheck = {
    url_exists: !!SUPABASE_URL,
    key_exists: !!SUPABASE_KEY,
    url_preview: SUPABASE_URL?.substring(0, 30),
    key_length: SUPABASE_KEY?.length
  };

  // Test 2: Try basic REST API call
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const rootTest = {
      status: response.status,
      statusText: response.statusText,
      body: await response.text()
    };

    // Test 3: Try accessing the table
    const tableResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/archived_articles?select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const tableTest = {
      status: tableResponse.status,
      statusText: tableResponse.statusText,
      headers: Object.fromEntries(tableResponse.headers.entries()),
      body: await tableResponse.text()
    };

    res.status(200).json({
      envCheck,
      rootTest,
      tableTest
    });

  } catch (error) {
    res.status(500).json({
      envCheck,
      error: error.message,
      stack: error.stack
    });
  }
}
