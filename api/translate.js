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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { title, summary } = req.body;

    if (!title || !summary) {
      res.status(400).json({ error: 'Title and summary are required' });
      return;
    }

    // API 키 확인
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set!');
      res.status(500).json({
        error: 'ANTHROPIC_API_KEY environment variable is not configured'
      });
      return;
    }

    const prompt = `다음 영어 뉴스 기사의 제목과 요약을 자연스러운 한국어로 번역해주세요. 뉴스 기사의 어조와 전문성을 유지하면서 번역하되, 한국 독자가 이해하기 쉽도록 해주세요.

**원문:**
제목: ${title}
요약: ${summary}

**응답 형식 (JSON):**
{
  "title": "번역된 제목",
  "summary": "번역된 요약"
}

**중요:** 반드시 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API Error:', errorData);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const translationText = data.content[0].text;

    // JSON 파싱 (```json ``` 마크다운 제거)
    let translation;
    try {
      const jsonMatch = translationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translation = JSON.parse(jsonMatch[0]);
      } else {
        translation = JSON.parse(translationText);
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', translationText);
      throw new Error('Failed to parse Claude response as JSON');
    }

    res.status(200).json({
      success: true,
      translation
    });

  } catch (error) {
    console.error('Error in translate endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
