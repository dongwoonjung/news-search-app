// 통합 유틸리티 API (chat + translate)
// action 파라미터로 구분: ?action=chat 또는 ?action=translate

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

  const { action } = req.query;

  if (action === 'chat') {
    return handleChat(req, res);
  } else if (action === 'translate') {
    return handleTranslate(req, res);
  } else {
    return res.status(400).json({ error: 'Invalid action. Use ?action=chat or ?action=translate' });
  }
}

// ==================== CHAT ====================
async function handleChat(req, res) {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    // Tavily 검색 함수
    async function searchWeb(query) {
      if (!TAVILY_API_KEY) {
        return { error: 'Tavily API key not configured' };
      }

      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: query,
            search_depth: 'basic',
            max_results: 5
          })
        });

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Tavily search error:', error);
        return { error: error.message };
      }
    }

    // 첫 번째 GPT 호출 (도구 사용 가능)
    const messages = [
      {
        role: 'system',
        content: '당신은 뉴스 분석 전문가입니다. 사용자의 질문에 대해 제공된 뉴스 기사와 최신 정보를 바탕으로 정확하고 유용한 답변을 제공하세요. 최신 정보가 필요하면 웹 검색을 활용하세요. 답변은 항상 한국어로 해주세요.'
      },
      {
        role: 'user',
        content: context
          ? `다음은 현재 표시된 뉴스 기사들입니다:\n\n${context}\n\n사용자 질문: ${message}\n\n위 뉴스 기사들을 참고하고, 필요하면 최신 정보도 검색하여 질문에 답변해주세요.`
          : `다음 질문에 대해 최신 정보를 검색하여 답변해주세요:\n\n${message}`
      }
    ];

    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: '최신 정보를 웹에서 검색합니다. 뉴스, 사건, 통계, 최신 동향 등을 찾을 때 사용하세요.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '검색할 키워드 또는 질문 (영어로 작성)'
              }
            },
            required: ['query']
          }
        }
      }
    ];

    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
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

    let data = await response.json();
    let assistantMessage = data.choices[0].message;

    // 도구 호출이 있는 경우 처리
    if (assistantMessage.tool_calls) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.function.name === 'search_web') {
          const args = JSON.parse(toolCall.function.arguments);
          const searchResults = await searchWeb(args.query);

          let searchResultText = '';
          if (searchResults.results) {
            searchResultText = searchResults.results
              .map(r => `제목: ${r.title}\n내용: ${r.content}\n출처: ${r.url}`)
              .join('\n\n');
          } else {
            searchResultText = '검색 결과를 가져올 수 없습니다.';
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: searchResultText
          });
        }
      }

      // 두 번째 GPT 호출 (검색 결과 포함)
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          max_tokens: 2048,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error (second call):', errorData);
        return res.status(response.status).json({
          error: 'Failed to get response from GPT',
          details: errorData
        });
      }

      data = await response.json();
      assistantMessage = data.choices[0].message;
    }

    const answer = assistantMessage.content;

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

// ==================== TRANSLATE ====================
async function handleTranslate(req, res) {
  try {
    const { title, summary } = req.body;

    if (!title || !summary) {
      res.status(400).json({ error: 'Title and summary are required' });
      return;
    }

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

    let response;
    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
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

        if (response.ok) {
          break;
        }

        if (response.status === 529 || response.status >= 500) {
          console.log(`[Translate] Attempt ${attempt}/${maxRetries} failed with status ${response.status}, retrying...`);
          lastError = new Error(`Claude API error: ${response.status}`);

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
          continue;
        }

        const errorData = await response.json();
        console.error('Claude API Error:', errorData);
        throw new Error(`Claude API error: ${response.status}`);

      } catch (err) {
        lastError = err;
        if (attempt === maxRetries) {
          throw err;
        }
        console.log(`[Translate] Attempt ${attempt}/${maxRetries} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('Failed to translate after retries');
    }

    const data = await response.json();
    const translationText = data.content[0].text;

    console.log('Claude translation response:', translationText);

    let translation;
    try {
      let cleanText = translationText.trim();
      cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translation = JSON.parse(jsonMatch[0]);
      } else {
        translation = JSON.parse(cleanText);
      }

      if (!translation.title || !translation.summary) {
        throw new Error('Missing required fields in translation');
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', translationText);

      try {
        const titleMatch = translationText.match(/"title"\s*:\s*"([^"]*)"/);
        const summaryMatch = translationText.match(/"summary"\s*:\s*"([^"]*)"/);

        if (titleMatch && summaryMatch) {
          translation = {
            title: titleMatch[1],
            summary: summaryMatch[1]
          };
          console.log('Fallback extraction succeeded');
        } else {
          throw new Error('Failed to extract translation from response');
        }
      } catch (fallbackError) {
        console.error('Fallback extraction failed:', fallbackError);
        throw new Error('Failed to parse Claude response as JSON');
      }
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
