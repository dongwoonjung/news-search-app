# 🌍 Global News Search

전 세계의 최신 뉴스를 검색하고 탐색할 수 있는 현대적인 뉴스 검색 웹 애플리케이션입니다.

## ✨ 주요 기능

- 🔍 **강력한 검색**: 키워드로 전 세계 뉴스 기사 검색
- 🎯 **다양한 필터**: 카테고리, 국가, 언어, 날짜 범위별 필터링
- 📊 **정렬 옵션**: 최신순, 관련도순, 인기순 정렬
- 🎨 **현대적인 UI**: 깔끔하고 직관적인 사용자 인터페이스
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 모든 기기 지원
- ⚡ **빠른 성능**: Vite 기반의 최적화된 빌드

## 🚀 시작하기

### 사전 요구사항

- Node.js 16.0 이상
- npm 또는 yarn

### 설치 방법

1. **프로젝트 디렉토리로 이동**
   ```bash
   cd news-search-app
   ```

2. **의존성 설치**

   npm 캐시 권한 문제가 있는 경우, 다음 명령어를 실행하세요:
   ```bash
   # macOS/Linux
   sudo chown -R $(whoami) ~/.npm

   # 또는 관리자 권한으로 npm 설치
   npm install
   ```

3. **NewsAPI.org API 키 발급**
   - [NewsAPI.org](https://newsapi.org/register)에 가입
   - 무료 API 키 발급 (개발용으로 충분)

4. **환경 변수 설정**
   ```bash
   # .env 파일의 API 키를 본인의 키로 변경
   VITE_NEWS_API_KEY=여기에_발급받은_API_키_입력
   ```

5. **개발 서버 실행**
   ```bash
   npm run dev
   ```

6. **브라우저에서 열기**
   - 브라우저에서 `http://localhost:5173` 열기

## 📦 프로젝트 구조

```
news-search-app/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── SearchBar.jsx    # 검색 입력 컴포넌트
│   │   ├── Filters.jsx      # 필터 컴포넌트
│   │   ├── NewsCard.jsx     # 뉴스 카드 컴포넌트
│   │   └── NewsList.jsx     # 뉴스 리스트 컴포넌트
│   ├── services/            # API 서비스
│   │   └── newsApi.js       # NewsAPI 통합
│   ├── App.jsx              # 메인 앱 컴포넌트
│   ├── App.css              # 앱 스타일
│   ├── index.css            # 글로벌 스타일
│   └── main.jsx             # 앱 엔트리 포인트
├── .env                     # 환경 변수 (API 키)
├── .env.example             # 환경 변수 예제
└── package.json             # 프로젝트 설정
```

## 🎯 사용 방법

### 기본 검색
1. 상단 검색바에 원하는 키워드 입력 (예: "technology", "bitcoin", "sports")
2. "검색" 버튼 클릭 또는 Enter 키 입력
3. 검색 결과가 카드 형태로 표시됩니다

### 필터 활용
- **카테고리**: Business, Entertainment, Health, Science, Sports, Technology 등
- **국가**: 전 세계 70개 이상의 국가에서 선택
- **언어**: 영어, 한국어, 중국어, 일본어 등 다양한 언어 지원
- **정렬**: 최신순, 관련도순, 인기순
- **날짜**: 시작 날짜와 종료 날짜로 기간 지정

### 뉴스 읽기
- 각 뉴스 카드를 클릭하거나 "Read more" 링크를 클릭하면 원본 기사로 이동합니다

## 🛠 기술 스택

- **Frontend Framework**: React 19
- **Build Tool**: Vite 7
- **Styling**: Pure CSS (CSS3, Flexbox, Grid)
- **API**: NewsAPI.org
- **State Management**: React Hooks (useState, useEffect)

## 📱 지원 기능

### 필터 옵션
- ✅ 카테고리별 필터링 (7개 카테고리)
- ✅ 국가별 필터링 (70개 이상 국가)
- ✅ 언어별 필터링 (14개 언어)
- ✅ 날짜 범위 필터링
- ✅ 정렬 옵션 (최신순/관련도순/인기순)

### UI/UX
- ✅ 반응형 디자인
- ✅ 로딩 스피너
- ✅ 에러 처리
- ✅ 빈 결과 처리
- ✅ 이미지 로드 실패 처리
- ✅ 부드러운 애니메이션

## 🔑 API 제한사항

NewsAPI.org 무료 티어 제한:
- 하루 100개 요청
- 개발 환경에서만 사용 가능 (localhost)
- 1개월 이전 기사는 검색 불가

프로덕션 배포시 유료 플랜을 고려하세요.

## 🚧 빌드 및 배포

### 프로덕션 빌드
```bash
npm run build
```

### 프리뷰
```bash
npm run preview
```

### 배포
빌드된 `dist` 폴더를 다음 플랫폼에 배포할 수 있습니다:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

## 🤝 기여하기

이슈와 풀 리퀘스트를 환영합니다!

## 📄 라이센스

MIT License

## 👨‍💻 개발자

이 프로젝트는 React + Vite + NewsAPI를 활용한 학습용 프로젝트입니다.

---

**Powered by [NewsAPI.org](https://newsapi.org)**
# News Search App - Deployed on Vercel
