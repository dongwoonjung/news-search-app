#!/usr/bin/env node
// 리포트 포맷 테스트 — Vercel 없이 로컬에서 Claude 직접 호출

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';

const apiKey = execSync(
  '/usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:ANTHROPIC_API_KEY" ~/Library/LaunchAgents/com.hyundai.brm.briefing.plist 2>/dev/null'
).toString().trim();

const client = new Anthropic({ apiKey });

const today = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
});

// 샘플 뉴스 (포맷 검증용 — 실제 URL 포함)
const sampleNews = `
## [무역] (3개 기사)
1. [US imposes 25% tariffs on Canadian auto imports] (Reuters) — Canada retaliates with counter-tariffs on US goods worth $30B
   URL: https://reuters.com/sample1
2. [Trump signs executive order expanding Section 232 auto tariffs] (Bloomberg) — European automakers face new 20% tariff on EV imports
   URL: https://bloomberg.com/sample2
3. [WTO rules against US steel tariffs, Washington appeals] (FT) — Trade court finds Section 232 measures violate WTO rules
   URL: https://ft.com/sample3

## [지정학] (2개 기사)
1. [China restricts rare earth exports, targets US chip supply chain] (WSJ) — Gallium, germanium export licenses suspended for 60 days
   URL: https://wsj.com/sample4
2. [NATO allies disagree on Ukraine defense spending target] (Guardian) — Split emerges over 3% GDP commitment
   URL: https://guardian.com/sample5
`;

const systemPrompt = `당신은 현대자동차 비즈니스 리스크 관리팀 전담 글로벌 시장 인텔리전스 애널리스트입니다. 수집된 뉴스를 현대차·기아 비즈니스 관점에서 분석해 경영진이 즉시 활용할 수 있는 브리핑을 작성합니다.

[필수 형식 규칙 — 반드시 준수]
① 각 뉴스 항목의 구조는 다음 순서를 반드시 지킬 것:
   [기사 분석 3~4문장] (출처명) [원문링크](URL)
   (빈 줄)
   -> 현대차는 [시사점 1~2문장]
   ※ 출처와 원문링크는 기사 분석 바로 뒤, 현대차 시사점보다 반드시 먼저 표기
   ※ 현대차와 무관한 이슈는 시사점 줄 생략 가능
② 출처 표기: (출처명) 형식. 복수 출처는 (출처1 / 출처2)
③ 원문링크: URL이 제공된 경우 출처 바로 뒤에 [원문링크](URL) 형식으로 반드시 삽입. URL이 없으면 생략
④ 현대차 시사점: "-> 현대차는"으로 시작하는 완전한 문장 1~2개. 반드시 빈 줄로 기사 본문과 분리
⑤ 리스크 요약 표: 무역·지정학 섹션 말미에 필수
   - 형식: | 이슈 | 리스크 수준 | 영향 분야 |
   - 리스크 수준: 🔴 높음 / 🟠 중간 / 🟡 주시
⑥ OEM 뉴스 표: 3-2 섹션에서 회사별 마크다운 표 필수. 형식: | 이슈 | 내용 |
⑦ 항목 번호: ① ② ③ ④ ⑤ 형식 사용
⑧ 수치·날짜·기업명·인물명 반드시 포함
⑨ 단순 사실 나열 금지 — "왜 중요한가", "무엇을 의미하는가" 위주로 서술`;

const userPrompt = `오늘(${today}) 수집된 글로벌 뉴스를 분석해 현대자동차 비즈니스 리스크 관리팀용 데일리 브리핑을 작성해주세요.

━━━ 수집된 뉴스 기사 ━━━
${sampleNews}
━━━━━━━━━━━━━━━━━━━━━━

아래 형식을 정확히 따라 작성하세요 (무역 섹션과 지정학 섹션만 포맷 검증용으로 작성):

# 글로벌 주요뉴스 브리핑 ${today}

## 1. 무역 주요 뉴스
[수집된 무역 뉴스를 ① ② ③ 형식으로 작성]
[각 항목 형식 — 아래 구조를 반드시 준수:
  3~4문장 기사 분석. (출처명) [원문링크](URL)

  -> 현대차는 [시사점. 현대차와 무관하면 생략]
]

[섹션 말미 필수 표]
무역 리스크 요약
| 이슈 | 리스크 수준 | 영향 분야 |
|------|------------|---------|

## 2. 지정학 주요 뉴스
[수집된 지정학 뉴스를 ① ② ③ 형식으로 작성]
[각 항목 형식 — 위와 동일 구조]

지정학 리스크 요약
| 이슈 | 리스크 수준 | 영향 분야 |
|------|------------|---------|`;

console.log('🧪 포맷 테스트 시작...\n');

const msg = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1500,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(msg.content[0].text);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ 확인 포인트:');
console.log('  1. (출처명) [원문링크](URL) — 기사 분석 바로 뒤에 있는가?');
console.log('  2. 빈 줄이 있는가?');
console.log('  3. -> 현대차는 — 별도 줄에 분리되어 있는가?');
