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
    const { source } = req.body;

    if (!source) {
      return res.status(400).json({ error: 'Source content is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    // URL인지 텍스트인지 판단
    const isUrl = source.trim().startsWith('http://') || source.trim().startsWith('https://');
    
    let contentToSummarize = source;
    
    // URL인 경우 웹 페이지 내용 가져오기
    if (isUrl) {
      try {
        const webResponse = await fetch(source.trim());
        const html = await webResponse.text();
        
        // HTML에서 텍스트 추출 (간단한 방법)
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        contentToSummarize = textContent.substring(0, 8000); // 토큰 제한 고려
      } catch (fetchError) {
        console.error('Failed to fetch URL:', fetchError);
        return res.status(400).json({
          error: '링크에서 내용을 가져올 수 없습니다. 직접 텍스트를 입력해주세요.'
        });
      }
    }

    // GPT를 사용한 요약
    const messages = [
      {
        role: 'system',
        content: '당신은 전문 요약 작성자입니다. 주어진 내용을 명확하고 간결하게 요약하세요. 핵심 내용과 중요한 정보를 빠짐없이 포함하되, 3-5개의 문단으로 정리해주세요. 한국어로 답변하세요.'
      },
      {
        role: 'user',
        content: `다음 내용을 요약해주세요:\n\n${contentToSummarize}`
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({
        error: 'Failed to generate summary',
        details: errorData
      });
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    res.status(200).json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Error in AI summary API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
