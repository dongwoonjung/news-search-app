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
    const { source, title } = req.body;

    if (!source) {
      return res.status(400).json({ error: 'Source content is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    // URL인지 텍스트인지 판단
    const isUrl = source.trim().startsWith('http://') || source.trim().startsWith('https://');

    let contentToSummarize = source;

    console.log('[AI Summary] Is URL?', isUrl);
    console.log('[AI Summary] Source:', source.substring(0, 100));

    // URL인 경우 Tavily Extract API를 사용해서 웹 페이지 내용 가져오기
    if (isUrl) {
      console.log('[AI Summary] Attempting to fetch URL content...');

      // 리디렉션 추적
      let finalUrl = source.trim();

      console.log('[AI Summary] Original URL:', source.trim());

      // Google News URL인 경우 제목으로 Tavily 검색 사용
      if (finalUrl.includes('news.google.com')) {
        console.log('[AI Summary] Detected Google News URL');

        if (!TAVILY_API_KEY) {
          console.log('[AI Summary] Tavily API key not found, cannot search by title');
          return res.status(400).json({
            error: 'Google News URL은 Tavily API 키가 필요합니다. 또는 원문 기사 URL을 직접 입력해주세요.'
          });
        }

        if (!title || !title.trim()) {
          console.log('[AI Summary] No title provided for Google News URL');
          return res.status(400).json({
            error: 'Google News URL의 경우 기사 제목이 필요합니다.'
          });
        }

        console.log('[AI Summary] Using Tavily Search to find article by title:', title);

        try {
          // Tavily Search API로 제목 기반 검색
          const searchResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query: title,
              search_depth: 'basic',
              max_results: 3,
              include_raw_content: true
            })
          });

          console.log('[AI Summary] Tavily search response status:', searchResponse.status);

          if (!searchResponse.ok) {
            throw new Error('Tavily search failed');
          }

          const searchData = await searchResponse.json();
          console.log('[AI Summary] Tavily search results count:', searchData.results?.length || 0);

          if (searchData.results && searchData.results.length > 0) {
            // 첫 번째 검색 결과 사용
            const firstResult = searchData.results[0];
            finalUrl = firstResult.url;
            console.log('[AI Summary] Found article URL via Tavily search:', finalUrl);

            // raw_content가 있으면 바로 사용
            if (firstResult.raw_content) {
              contentToSummarize = firstResult.raw_content.substring(0, 100000);
              console.log('[AI Summary] Using raw_content from search result, length:', contentToSummarize.length);

              // 콘텐츠를 찾았으면 Tavily Extract 단계를 건너뛰고 바로 요약으로 이동
              console.log('[AI Summary] Skipping Tavily Extract, proceeding to summarization');
            }
          } else {
            console.log('[AI Summary] No search results found for title');
            return res.status(400).json({
              error: '해당 제목의 기사를 찾을 수 없습니다. 원문 기사 URL을 직접 입력해주세요.'
            });
          }
        } catch (searchError) {
          console.error('[AI Summary] Tavily search failed:', searchError);
          return res.status(400).json({
            error: 'Google News 기사 검색에 실패했습니다. 원문 기사 URL을 직접 입력해주세요.'
          });
        }
      }

      console.log('[AI Summary] Final URL to use:', finalUrl);

      // Google News에서 이미 콘텐츠를 가져왔으면 Extract 단계 건너뛰기
      if (contentToSummarize !== source) {
        console.log('[AI Summary] Content already extracted from search, skipping Tavily Extract');
      } else {
        try {
          if (!TAVILY_API_KEY) {
            console.log('[AI Summary] Tavily API key not found');
            throw new Error('Tavily API key not configured');
          }

          console.log('[AI Summary] Using Tavily Extract API with final URL...');

        // Tavily Extract API를 사용해서 웹페이지의 깨끗한 텍스트 추출
        const tavilyResponse = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            urls: [finalUrl]
          })
        });

        console.log('[AI Summary] Tavily response status:', tavilyResponse.status);

        if (!tavilyResponse.ok) {
          const errorText = await tavilyResponse.text();
          console.log('[AI Summary] Tavily error:', errorText);
          throw new Error('Tavily API request failed: ' + errorText);
        }

        const tavilyData = await tavilyResponse.json();
        console.log('[AI Summary] Tavily data structure:', Object.keys(tavilyData));

        if (tavilyData.results && tavilyData.results.length > 0) {
          // Tavily가 추출한 깨끗한 텍스트 사용 (전체 내용)
          const extractedContent = tavilyData.results[0].raw_content || tavilyData.results[0].content;
          console.log('[AI Summary] Extracted content length:', extractedContent?.length);

          // GPT-4o-mini의 컨텍스트 윈도우는 128k 토큰이므로, 충분히 긴 텍스트 허용
          // 약 100,000자까지 처리 가능 (한글 기준)
          contentToSummarize = extractedContent.substring(0, 100000);
          console.log('[AI Summary] Content to summarize length:', contentToSummarize.length);
        } else {
          console.log('[AI Summary] No results from Tavily');
          throw new Error('No content extracted from URL');
        }
        } catch (fetchError) {
          console.error('[AI Summary] Failed to fetch URL with Tavily:', fetchError);

        // Tavily 실패 시 기본 fetch로 대체
        console.log('[AI Summary] Trying fallback direct fetch with final URL...');
        try {
          const webResponse = await fetch(finalUrl, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          console.log('[AI Summary] Fallback fetch status:', webResponse.status);
          console.log('[AI Summary] Fallback final URL:', webResponse.url);
          const html = await webResponse.text();
          console.log('[AI Summary] HTML length:', html.length);

          // HTML에서 텍스트 추출
          const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          console.log('[AI Summary] Extracted text length:', textContent.length);
          contentToSummarize = textContent.substring(0, 50000); // 폴백도 더 긴 텍스트 허용
        } catch (fallbackError) {
          console.error('[AI Summary] Fallback fetch also failed:', fallbackError);
          return res.status(400).json({
            error: '링크에서 내용을 가져올 수 없습니다. URL이 올바른지 확인하거나 직접 텍스트를 입력해주세요.'
          });
        }
        }
      }
    }

    console.log('[AI Summary] Final content to summarize length:', contentToSummarize.length);
    console.log('[AI Summary] First 200 chars:', contentToSummarize.substring(0, 200));

    // GPT를 사용한 요약
    const messages = [
      {
        role: 'system',
        content: '당신은 전문 뉴스 분석가입니다. 주어진 기사의 **전체 내용**을 빠짐없이 분석하여 포괄적이고 상세하게 요약하세요.\n\n요약 시 반드시 다음을 포함하세요:\n1. 기사의 주요 내용과 핵심 사건 (처음부터 끝까지 모든 중요 내용)\n2. 중요한 인물, 기업, 조직, 구체적인 숫자, 날짜, 장소 등\n3. 배경 맥락, 원인, 결과, 향후 전망\n4. 기사에 언급된 세부 사항과 부가 정보\n5. 전문가 의견이나 인용문이 있다면 포함\n\n**중요**: 기사의 일부만 요약하지 말고, 전체 내용을 충실하게 반영하세요. 5-8개 문단으로 상세하게 구조화하여 작성하고, 한국어로 답변하세요.'
      },
      {
        role: 'user',
        content: `다음 뉴스 기사의 전체 내용을 상세하게 요약해주세요:\n\n${contentToSummarize}`
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
        max_tokens: 2500, // 더 상세한 요약을 위해 토큰 증가
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
