export default async function handler(req, res) {
  // CORS 헤더 설정
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

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Anthropic API key not configured',
        fallback: true
      });
    }

    // Claude API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: context
              ? `다음은 현재 표시된 뉴스 기사들입니다:\n\n${context}\n\n사용자 질문: ${message}\n\n위 뉴스 기사들을 참고하여 질문에 답변해주세요. 답변은 한국어로 해주세요.`
              : `뉴스 분석 전문가로서 다음 질문에 답변해주세요:\n\n${message}\n\n답변은 한국어로 해주세요.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({
        error: 'Failed to get response from Claude',
        details: errorData
      });
    }

    const data = await response.json();
    const answer = data.content[0].text;

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
