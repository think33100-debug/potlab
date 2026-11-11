# RAPO 디자인 적용 — 진행 파일 (하나만 유지 · 세션이 다시 시작되면 이것부터)

지침: 디자이너 실행 지침(2026-11-11, 저장소 밖 금고) · 이번 범위 = 1절 「첫 실행」
(시작 점검 → 현행 토큰 전체 등록 → 홈에 필요한 공통 UI → U01 홈 한 장 → 보고).
목록·상세(지침 7절)는 **홈 디자인 확인 뒤**입니다.

## 지금 상태 (2026-11-11 저녁)

| 단계 | 상태 |
|---|---|
| 시작 점검 | 완료 |
| 현행 토큰 전체 등록 | 완료 — 변수 305 · 글자 스타일 45 · 그림자 3 · Figma 해시 6/6 일치 |
| 홈에 필요한 공통 UI | 구현·자동 검사 완료 · **디자인 확인 대기** |
| U01 홈 · 비회원 · 기본 | 구현·자동 검사 완료 · **디자인 확인 대기** · **실기기 미검증** |
| 실제 공고 잇기 | 안 함 — 질문 Q-D3 답 뒤 |
| 공고 목록·상세 | 안 함 — 홈 확인 뒤 |

11/13 클로즈드 베타 화면에는 들어가지 않습니다. 지금 홈(`/`)은 그대로이고,
새 홈은 개발 서버에서만 열리는 `/design-preview/home` 에 있습니다(배포 빌드에서는 404).

## 기준

| 무엇 | 값 |
|---|---|
| Figma 파일 | `qeGthNep5Axu8mLtBZfqev` (RAPO 디자인 프로젝트) · 읽기 전용 |
| 읽은 때 | 2026-11-11 오후(KST) · 연결된 Figma 도구(use_figma 읽기 · get_design_context · get_screenshot) |
| 홈 원본 | 「U01 · 홈 · 비회원 · 기본」 `701:1644` (414×2872) · 페이지 「06 · A 공고 탐색과 공유」 섹션 「01 홈」 |
| 기준 코드 | `origin/main` `7114642` (PR #34 병합) |
| 가지 | `ai/claude-1111-design-home` · 작업 폴더 `work/design-home` |

## 시작 점검 결과

- 저장소 `potlab/web` — Next.js **16.4.4**(Turbopack) · React 19.2.8 · Tailwind **v4**(설정은 `app/globals.css` 의 `@theme`) · 글꼴 Pretendard Variable(CDN · `font-display` 는 CDN css 가 정함).
- 홈 `/` = `app/page.tsx` · 데이터는 `lib/home.ts getHome()`(home_blocks·home_stats 등) · 위쪽 줄·아래 탭바·사업자 정보 footer 는 `app/layout.tsx` 가 **모든 화면**에 그립니다.
- 명령 — `npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit` (package.json).
- `.env*` 는 읽지도 만들지도 않았습니다. 개발 서버·빌드는 **셸에만** 가짜 값
  (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9`, 키 자리 `local-preview-placeholder`)을 주고 돌렸습니다 → DB 는 안 붙습니다.
- Figma — 파일 열람·도구 읽기 둘 다 성공. 컬렉션 10개 전부 값·별칭·code syntax 까지 읽힘. 자산 다운로드 성공.
- 브라우저 — 앱 내장 브라우저로 `localhost:3111` 열기·누르기·캡처 성공.

### 기존 상태(이번 변경 전, 같은 코드)

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | 실패 4줄 — `LayoutProps`·`PageProps` 를 못 찾음. Next 가 dev/build 때 만드는 형식이라 **새 작업 폴더라서** 난 것. dev 한 번 뒤 통과 |
| `npx eslint .` | **66 problems (48 errors, 18 warnings)** — 전부 기존 |
| `next dev` | 뜸. 경고: 「middleware 파일 이름은 이제 proxy」(기존) |

## 토큰

- 원본 글 `web/design-tokens/figma/` (Figma 에서 읽은 그대로) → `node tools/rapo-tokens.mjs` → `web/app/rapo-tokens.css`
- 대응표(ID·이름·컬렉션·타입·값/별칭·CSS 이름·끝값) **[docs/rapo-design/토큰대응표.md](rapo-design/토큰대응표.md)** (자동 생성)
- `node tools/rapo-tokens.mjs --check` — 원본 해시 6개(변수 3 · 글자 · 그림자 · code syntax)를 Figma 값과 대고, 저장된 CSS·대응표가 원본과 같은지 봅니다.
- 이름은 Figma 의 **WEB code syntax** 그대로(`--rapo-color-fg-neutral` 등). 브랜드 기준 14개만 code syntax 가 비어 `--rapo-brand-color-*`·`--rapo-brand-space-*` 로 지었습니다.
- 별칭은 `var()` 로 남겨 관계를 보존 · 순환 0 · 현행 밖을 가리키는 별칭 0.
- 단위 — 간격·크기·모서리·글자크기·행간 `px`, 굵기는 단위 없음, 투명도는 `rgb(… / a)` 로 보존.
- 모드 — 다섯 컬렉션 모두 모드 1개. 어두운 모드는 만들지 않음.
- **기존 화면 영향 없음** — 이름이 전부 `--rapo-` 이고 Tailwind `@theme` 밖(유틸리티 안 생김). `globals.css` 에는 `@import` 한 줄만 더했습니다.
- 글꼴 — Figma `"Pretendard"` · 웹은 `"Pretendard Variable"` 를 받음. 글자 스타일 클래스는 `var(--rapo-font-family), var(--font-sans)` 라 실제로는 Pretendard Variable 로 그려짐(브라우저에서 `document.fonts` 로 loaded 확인 · 400/500/700 은 가변 글꼴 한 벌).

### 빠진 컬렉션 의존 (홈 원본이 기대는 것 · 제품 토큰에는 안 넣음)

U01(701:1644) 안 458개 노드가 묶은 변수 49종 중 17종이 제외 대상 컬렉션입니다. 같은 값의 현행 토큰으로 옮겼고, 없는 둘만 값 그대로 둡니다.

| 제외 컬렉션 · 이름 | 값 | 코드에서 |
|---|---|---|
| Wireframe review · wf/paper | → color/bg/layer-default | `--rapo-color-bg-layer-default` |
| Wireframe review · wf/space/10 · 14 | 10 · 14 | `--rapo-dimension-x2_5` · `x3_5` |
| Archive/Dimensions · space/4·8·12·16·24 | 4·8·12·16·24 | `--rapo-dimension-x1·x2·x3·x4·x6` |
| Archive/Dimensions · radius/8 · 12 | 8 · 12 | `--rapo-radius-r2` · `r3` |
| Archive/Color roles · text/primary | #112231 (→ 브랜드 navy) | `--rapo-brand-color-navy` |
| Archive/Color roles · text/tertiary | #56636D (→ 브랜드 muted) | `--rapo-brand-color-muted` |
| Archive/Color roles · surface/default | #FFFFFF | `--rapo-color-bg-layer-default` |
| Archive/Color roles · surface/brand-subtle · selected/bg/default | #FFE9E6 (→ 브랜드 blush) | `--rapo-brand-color-blush` |
| Archive/Color roles · **text/secondary** | **#3F4C57** (Archive neutral/700) | 값 그대로 `text-[#3F4C57]` — 현행에 같은 값 없음 |
| Archive/Color roles · **selected/fg** | **#8E241E** (Archive coral/800) | 값 그대로 `text-[#8E241E]` — 현행에 같은 값 없음 |

→ 디자이너께: 이 둘을 현행 토큰으로 옮겨 주시면 코드도 이름으로 바꿉니다(Q-D6).

## 공통 UI (홈에 쓰는 것)

| 코드 | Figma 원본 | 상태 · 메모 |
|---|---|---|
| `components/rapo/rapo-header.tsx` | 헤더/비회원 954:961 · 로고 1415:48484 | 로그인 → 지금의 `/login` |
| `components/rapo/rapo-bottom-nav.tsx` | 하단 탐색 선택=홈 954:946 · 아이콘 1119:1085 외 | `aria-current`. 원본에 「홈 켜짐」 모양만 있음 → 다른 탭 켜짐 아이콘 필요(Q-D5) |
| `components/rapo/rapo-job-list.tsx` | 채용 공고 955:710 · 공고 행 749:2258 · Badge 453:3335 · 좋아요·조회 | 정렬 셋 `aria-pressed` · 빈 목록 문구 · 긴 이름 말줄임/제목 줄바꿈 |
| `components/job-save.tsx` (`look="rapo"`, `RapoSaveFace`) | Action/저장 353:442 | 기존 저장 단추에 모양만 더함(누르는 일·로그인 보내기·중복 방지 `busy` 그대로). 견본 줄은 잠김(disabled) |
| `components/rapo/home-u01.tsx` | U01 701:1644 | 배너(스크롤 스냅) · 시작하기 · 익명 Q&A · 조건 카드 · 채용 공고 · 더 둘러보기 |

자산 40개는 `get_design_context` 가 준 원본 파일 그대로 `web/public/rapo/home/` (SVG 32 · PNG 8). PNG 는 `next/image` 로 크기를 줄여 보냅니다.

## 검사 (실제로 돌린 것 · 같은 코드 상태)

| 검사 | 결과 |
|---|---|
| `node tools/rapo-tokens.mjs --check` | 같음 — 변수 305 · 글자 45 · 그림자 3 · 해시 6/6 |
| `npx tsc --noEmit` | 통과 (exit 0) |
| `npx eslint .` | 66 problems (48 errors, 18 warnings) — **기존과 줄까지 같음**. 바꾼 파일의 1건(`job-save.tsx:22` setState-in-effect)도 기존 |
| `next build` (가짜 env) | 통과 (exit 0) · 그 빌드를 `next start` 로 띄워 `/design-preview/home` → 「이 자리에 아무것도 없어요」(404 화면) 확인 · `/login` 은 위쪽 줄 56px·종이색 바탕·탭바 그대로 |
| 브라우저 414 | 원본과 섹션·문구·자산 일치 · 이미지 59개 전부 로드 · 가로 넘침 0 |
| 브라우저 360 | 가로 넘침 0. 배너1 사진이 제목을 덮어 **임시 규칙**으로 고침(아래) |
| 브라우저 1440 | 가운데 768 기둥 · 가로 넘침 0 |
| 키보드 | Tab 차례 24곳 논리 순서 · 포커스 테두리 3px 보임 · 배너 → 방향키로 넘어감 · 정렬 Space/Enter 로 켜짐·순서 바뀜 |
| 비활성 | 견본 저장 단추 4개 `disabled` — 눌러도 아무 일 없음 |
| 긴 문구 | 기관 이름 말줄임 · 제목 줄바꿈 · 태그 줄바꿈 · 넘침 0 (DOM 에 긴 글을 넣어 확인) |

캡처(저장소 밖 · 공개 저장소라 올리지 않음): `RAPO노트/디자인적용_캡처_1111/`
`figma_U01_701-1644_414.png` · `구현_U01_414_전체.jpg` · `구현_U01_360_전체.jpg` · `구현_U01_1440_전체.jpg`

**미검증** — 실기기(아이폰·안드로이드) · 실제 공고 데이터 · 로그인한 회원 상태 · 터치 에뮬레이션으로 스와이프 · 메뉴/시트/대화상자(홈에 없음) · 스크린리더 실제 낭독.

## 임시 시각 규칙 (되돌릴 수 있음 · 디자인 확인 때 같이 봄)

1. **미리보기에서 지금 앱의 위쪽 줄·아래 탭바를 가림** (`app/design-preview/home/preview.css`). U01 이 자기 헤더·탐색을 갖기 때문. 사업자 정보 footer 는 법정 표시라 **남김** — 원본에 없는 자리.
2. 최대 폭 = 지금 앱 규칙 `max-w-3xl`(768) 가운데. 원본 414 보다 넓으면 카드가 늘어남.
3. 아래 탐색은 PC 에서도 보임(지금 탭바는 휴대폰만). 원본에 PC 안이 없어서.
4. 배너1 치료사 사진 — 414보다 좁으면 왼쪽 221px 을 지키고 오른쪽이 잘림(글자 안 덮게).
5. 저장된 단추 모양 · 눌림 색 — 원본에 기본 상태만 있어 `bg-brand-weak`·`transparent-pressed` 토큰으로 임시.
6. 배너 그라데이션 `#FF4F40 → #FF3524`, 배너 글자 23px 등은 원본에 토큰이 없어 값 그대로.

## 질문 (대표 확인 자리 ★ · 그 밖은 디자이너)

- ★ Q-D1 익명 질문과 답변 칸은 원본 설명대로 **지어낸 글**(가온재활병원 등)입니다. 회원 화면에 그대로 둘까요, 실제 커뮤니티 글로 바꿀까요?
- ★ Q-D2 새 홈에는 지금 홈의 배너(DB)·카테고리·참여 현황·급여 이야기·FinalCta 가 없습니다. 지금 홈 내용을 빼도 될까요?
- ★ Q-D3 홈 「채용 공고」에 실제 공고를 이으면 비회원은 `공개공고()`(제목·기관·지역·마감만)만 받습니다. 원본의 **좋아요**는 공고에 없는 기능, **경력·근무일 태그**·**인기순 정렬**은 비회원에게 안 나가는 값입니다. 비회원 홈 공고에 무엇을 보일까요?
- ★ Q-D4 「급여 공개 공고」·「신입 지원 공고」 거르기가 지금 없습니다(새 기능). 만들까요, 둘 다 공고 목록으로만 보낼까요(지금은 이쪽)?
- Q-D5 하단 탐색 — 공고·커뮤니티·내 정보가 **켜진** 아이콘 원본이 필요합니다(홈 켜짐만 있음).
- Q-D6 Archive 의 text/secondary #3F4C57 · selected/fg #8E241E 를 현행 토큰으로 옮겨 주실 수 있나요?
- Q-D7 「공시 병원 급여」가 갈 곳 — 지금은 병원정보 `/orgs` 로 둠. 맞나요?

## 다음 할 일

1. 대표·디자이너 확인 → 질문 답 반영
2. `app/page.tsx` 가 `HomeU01` 을 부르게 바꾸고 실제 공고 잇기(Q-D3 답대로) · 전역 헤더/탭바 교체는 그때 `app/layout.tsx` 에서
3. 목록(A 페이지) → 상세(U03) — 지침 7절

## 다른 세션과 겹침

PR #36(`ai/claude-1111-beta-gate` · middleware·/beta·/join·/welcome·`lib/beta.ts`)·글 사진 경로 PR 의 파일은 **건드리지 않았습니다**.
겹칠 수 있는 곳: 둘 다 `app/layout.tsx` 를 나중에 고치면 부딪힘(이번엔 안 고침). 배너1 「회원가입하기」는 `/login` 으로 둠 — 베타 동안 가입이 `/join` 이면 그때 바꿈.

## 바꾼 파일

```
web/app/globals.css                         @import 한 줄
web/app/rapo-tokens.css                     (자동 생성)
web/tools/rapo-tokens.mjs                   토큰 만들기·검사
web/design-tokens/figma/*                   Figma 원본 글 6개
web/components/job-save.tsx                 look="rapo" · RapoSaveFace 추가
web/components/rapo/*.tsx|ts                헤더·아래 탐색·공고 목록·홈 U01·견본 공고
web/app/design-preview/home/page.tsx · preview.css   개발 전용 미리보기
web/public/rapo/home/*                      Figma 자산 40개
docs/rapo-design/토큰대응표.md                (자동 생성)
docs/rapo-design-implementation.md          이 파일
```
