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
      console.log('[AI Summary] Final URL to use:', finalUrl);

      try {
        if (!TAVILY_API_KEY) {
          console.log('[AI Summary] Tavily API key not found');
          throw new Error('Tavily API key not configured');
        }

        console.log('[AI Summary] Using Tavily Extract API with final URL...');

        // Google News URL인 경우 제목으로 검색해서 실제 기사 찾기
        if (finalUrl.includes('news.google.com')) {
          console.log('[AI Summary] Detected Google News URL, trying to find actual article...');

          // 클라이언트에서 전달된 제목 사용 (있는 경우)
          const articleTitle = title;

          if (articleTitle) {
            console.log('[AI Summary] Using provided article title:', articleTitle);

            try {
              // 제목으로 Tavily 검색
              const searchResponse = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  api_key: TAVILY_API_KEY,
                  query: articleTitle,
                  search_depth: 'basic',
                  max_results: 5,
                  include_domains: [], // 특정 도메인 제한 없음
                  exclude_domains: ['google.com', 'news.google.com'] // Google 제외
                })
              });

              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                console.log('[AI Summary] Tavily search found', searchData.results?.length || 0, 'results');

                if (searchData.results && searchData.results.length > 0) {
                  // 가장 관련성 높은 실제 뉴스 기사 찾기
                  for (const result of searchData.results) {
                    const url = result.url.toLowerCase();

                    // 유효한 뉴스 기사인지 확인
                    const isValidNewsUrl =
                      !url.includes('google.com') &&
                      !url.match(/\.(css|js|jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|pdf)(\?|$)/i) &&
                      !url.includes('youtube.com') &&
                      !url.includes('twitter.com') &&
                      !url.includes('facebook.com');

                    if (isValidNewsUrl) {
                      finalUrl = result.url;
                      console.log('[AI Summary] Found actual article URL:', finalUrl);
                      console.log('[AI Summary] Article score:', result.score);
                      break;
                    }
                  }
                }
              }
            } catch (searchError) {
              console.log('[AI Summary] Failed to search via title:', searchError.message);
            }
          } else {
            console.log('[AI Summary] No title provided, will try to extract from Google News page');
          }
        }

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
          // Tavily가 추출한 깨끗한 텍스트 사용
          const extractedContent = tavilyData.results[0].raw_content || tavilyData.results[0].content;
          console.log('[AI Summary] Extracted content length:', extractedContent?.length);
          contentToSummarize = extractedContent.substring(0, 12000); // 더 많은 내용 포함
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
          contentToSummarize = textContent.substring(0, 8000);
        } catch (fallbackError) {
          console.error('[AI Summary] Fallback fetch also failed:', fallbackError);
          return res.status(400).json({
            error: '링크에서 내용을 가져올 수 없습니다. URL이 올바른지 확인하거나 직접 텍스트를 입력해주세요.'
          });
        }
      }
    }

    console.log('[AI Summary] Final content to summarize length:', contentToSummarize.length);
    console.log('[AI Summary] First 200 chars:', contentToSummarize.substring(0, 200));

    // GPT를 사용한 요약
    const messages = [
      {
        role: 'system',
        content: '당신은 전문 뉴스 분석가입니다. 주어진 기사 내용을 분석하여 핵심 정보를 명확하고 체계적으로 요약하세요.\n\n요약 시 다음을 포함하세요:\n1. 기사의 주요 내용과 핵심 사건\n2. 중요한 인물, 기업, 숫자, 날짜 등 구체적인 정보\n3. 배경 맥락과 의미\n\n3-5개의 문단으로 구조화하여 작성하고, 한국어로 답변하세요.'
      },
      {
        role: 'user',
        content: `다음 뉴스 기사 또는 문서의 내용을 요약해주세요:\n\n${contentToSummarize}`
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
