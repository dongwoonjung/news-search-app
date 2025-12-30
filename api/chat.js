export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    // GPT-4o API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 뉴스 분석 전문가입니다. 사용자의 질문에 대해 제공된 뉴스 기사와 최신 정보를 바탕으로 정확하고 유용한 답변을 제공하세요. 답변은 항상 한국어로 해주세요.'
          },
          {
            role: 'user',
            content: context
              ? `다음은 현재 표시된 뉴스 기사들입니다:\n\n${context}\n\n사용자 질문: ${message}\n\n위 뉴스 기사들을 참고하고, 필요하면 최신 정보도 검색하여 질문에 답변해주세요.`
              : `다음 질문에 대해 최신 정보를 검색하여 답변해주세요:\n\n${message}`
          }
        ],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({
        error: 'Failed to get response from GPT',
        details: errorData
      });
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    res.status(200).json({
      success: true,
      answer
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
