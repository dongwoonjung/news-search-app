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
    const { title, summary } = req.body;

    if (!title || !summary) {
      return res.status(400).json({ error: 'Title and summary are required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    console.log('[AI Insight] Generating Hyundai-perspective insight...');
    console.log('[AI Insight] Title:', title);
    console.log('[AI Insight] Summary length:', summary.length);

    // GPT를 사용한 현대차 관점 인사이트 생성
    const messages = [
      {
        role: 'system',
        content: `당신은 현대자동차 그룹의 전략 분석가입니다. 주어진 뉴스 기사를 현대차 관점에서 분석하여 인사이트를 도출하세요.

분석 시 다음을 포함하세요:
1. **현대차에 미치는 영향**: 이 뉴스가 현대차에 긍정적/부정적으로 미치는 영향
2. **기회 요인**: 현대차가 활용할 수 있는 기회나 시장 트렌드
3. **위험 요인**: 현대차가 주의해야 할 위험이나 도전과제
4. **전략적 시사점**: 현대차가 취해야 할 전략적 행동이나 대응 방향
5. **경쟁사 동향**: 경쟁사(테슬라, 도요타, BYD 등) 대비 현대차의 위치

**중요**: 현대차의 전기차 전환, 배터리 기술, 글로벌 시장 확대, 자율주행, 수소차 등 핵심 사업 영역과 연결하여 분석하세요.

답변은 4-6개 문단으로 구조화하여 한국어로 작성하세요.`
      },
      {
        role: 'user',
        content: `다음 뉴스 기사를 현대차 관점에서 분석하여 전략적 인사이트를 도출해주세요:

제목: ${title}

요약:
${summary}`
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
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({
        error: 'Failed to generate insight',
        details: errorData
      });
    }

    const data = await response.json();
    const insight = data.choices[0].message.content;

    console.log('[AI Insight] Successfully generated insight, length:', insight.length);

    res.status(200).json({
      success: true,
      insight
    });

  } catch (error) {
    console.error('Error in AI insight API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
