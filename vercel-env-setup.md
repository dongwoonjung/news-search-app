# Vercel 환경 변수 설정 가이드

## CLI로 환경 변수 추가하기

```bash
# 네이버 API 키 설정
vercel env add NAVER_CLIENT_ID
# 입력 프롬프트에서 값 입력: your_actual_client_id

vercel env add NAVER_CLIENT_SECRET
# 입력 프롬프트에서 값 입력: your_actual_client_secret

# OpenAI API 키 설정
vercel env add OPENAI_API_KEY
# 입력 프롬프트에서 값 입력: your_actual_openai_key

# Tavily API 키 설정
vercel env add TAVILY_API_KEY
# 입력 프롬프트에서 값 입력: your_actual_tavily_key

# Bing News API 키 설정 (선택사항)
vercel env add BING_NEWS_API_KEY
# 입력 프롬프트에서 값 입력: your_actual_bing_key
```

## 웹 대시보드로 설정하기

1. https://vercel.com/dashboard 접속
2. 프로젝트 선택 (newsapp-sable-two)
3. Settings > Environment Variables 메뉴 이동
4. 다음 환경 변수들을 추가:

### 필수 환경 변수:
- `NAVER_CLIENT_ID`: 네이버 개발자 센터에서 발급받은 Client ID
- `NAVER_CLIENT_SECRET`: 네이버 개발자 센터에서 발급받은 Client Secret
- `OPENAI_API_KEY`: OpenAI API 키 (AI 요약 기능용)
- `TAVILY_API_KEY`: Tavily API 키 (웹 콘텐츠 추출용)

### 선택 환경 변수:
- `BING_NEWS_API_KEY`: Bing News API 키 (추가 뉴스 소스용)

### 기존 환경 변수 (이미 설정되어 있어야 함):
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase Anon Key
- `VITE_NEWS_API_KEY`: NewsAPI.org API 키

## 환경 선택
각 환경 변수를 추가할 때 다음 환경을 선택하세요:
- ✅ Production
- ✅ Preview
- ✅ Development

## 재배포
환경 변수를 추가한 후에는 반드시 재배포해야 적용됩니다:
```bash
git push
# 또는
vercel --prod
```

## API 키 발급 링크
- 네이버 API: https://developers.naver.com/
- OpenAI API: https://platform.openai.com/api-keys
- Tavily API: https://tavily.com/
- Bing News API: https://azure.microsoft.com/en-us/services/cognitive-services/bing-news-search-api/
