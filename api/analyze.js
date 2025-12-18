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
    const { title, summary, source, date } = req.body;

    if (!title || !summary) {
      res.status(400).json({ error: 'Title and summary are required' });
      return;
    }

    // API 키 확인
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set!');
      res.status(500).json({
        error: 'ANTHROPIC_API_KEY environment variable is not configured in Vercel'
      });
      return;
    }

    console.log('API Key present:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');

    const prompt = `당신은 현대자동차 그룹의 전략 분석 전문가입니다. 다음 뉴스 기사를 현대자동차의 관점에서 심층 분석해주세요.

**기사 정보:**
제목: ${title}
요약: ${summary}
출처: ${source || 'N/A'}
날짜: ${date || 'N/A'}

**분석 요구사항:**
현대자동차 그룹의 입장에서 이 뉴스가 가지는 의미를 다음 관점에서 전문적이고 구체적으로 분석해주세요:

1. **전략적 기회 (Opportunities)**:
   - 이 뉴스에서 현대차가 활용할 수 있는 구체적인 기회 식별
   - 각 기회에 대해: 카테고리, 핵심 내용, 영향도(high/medium/low), 세부사항(배열), 타임프레임, 기대효과

2. **주요 리스크 (Risks)**:
   - 현대차에 미칠 수 있는 잠재적 위험 요소
   - 각 리스크에 대해: 카테고리, 핵심 내용, 심각도(high/medium/low), 세부사항(배열), 대응방안, 대응시점

3. **시장 영향 평가**: 이 뉴스가 자동차 시장과 현대차에 미치는 전반적 영향

4. **전략적 시사점**: 경영진이 고려해야 할 핵심 전략적 포인트

5. **실행 과제**: 구체적인 액션 아이템

**응답 형식 (JSON):**
{
  "opportunities": [
    {
      "category": "카테고리명 (예: 전기차 시장, 수소 에너지, 자율주행/AI 등)",
      "point": "핵심 기회 내용 (1-2문장)",
      "impact": "high/medium/low",
      "details": ["세부사항1", "세부사항2", "세부사항3"],
      "timeframe": "단기(6개월-1년) / 중기(1-3년) / 장기(3-5년)",
      "expectedBenefit": "구체적인 기대 효과"
    }
  ],
  "risks": [
    {
      "category": "카테고리명 (예: 시장 경쟁, 중국 리스크, 공급망 불안 등)",
      "point": "핵심 리스크 내용 (1-2문장)",
      "severity": "high/medium/low",
      "details": ["세부사항1", "세부사항2", "세부사항3"],
      "mitigationPlan": "구체적인 대응 방안",
      "timeframe": "즉시 / 단기 / 중기 / 장기"
    }
  ],
  "marketImpact": "시장 영향 평가 (2-3문장)",
  "strategicImplications": ["시사점1", "시사점2", "시사점3"],
  "actionItems": ["액션1", "액션2", "액션3"],
  "summary": "종합 요약 (1-2문장)"
}

**중요:**
- 반드시 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.
- 기사 내용과 현대차의 실제 사업 영역을 고려하여 실질적이고 통찰력 있는 분석을 제공하세요.
- 모든 필드를 빠짐없이 채워주세요.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
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
      console.error('Response status:', response.status);
      console.error('API Key used:', process.env.ANTHROPIC_API_KEY ? 'Present' : 'Missing');
      throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const analysisText = data.content[0].text;

    // JSON 파싱 (```json ``` 마크다운 제거)
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(analysisText);
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', analysisText);
      throw new Error('Failed to parse Claude response as JSON');
    }

    res.status(200).json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
