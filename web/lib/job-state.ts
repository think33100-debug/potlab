/* 공고가 마감됐는지 한 곳에서 판단합니다 (node lib/job-state.test.mjs).

   마감일이 비어 있으면 마감으로 안 칩니다.
   인수인계 원칙이 「마감일이 비어 있으면 잘못 읽은 것」입니다 —
   자료를 못 받아온 것뿐인데 멀쩡한 공고를 막으면 안 됩니다.

   날짜는 한국 시간 기준입니다. UTC 로 재면 한국에서 자정 넘긴 뒤 아홉 시간 동안
   어제 날짜로 판단합니다. 마감일 당일은 아직 열린 것으로 봅니다. */

/* 한국은 1988년 뒤로 서머타임이 없습니다. 그래서 +9시간이 언제나 정확합니다.
   Intl 로 시간대를 다루지 않는 이유 — 미리보기 그림을 그리는 edge 런타임은
   ICU 가 잘려 있는 곳이 있어 timeZone 을 못 믿습니다 */
export const KST_OFFSET_MIN = 9 * 60;

/* 오늘 (한국) — 'YYYY-MM-DD' */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/* 지금 (한국) — 'HH:MM:SS' */
export function nowTimeKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MIN * 60_000).toISOString().slice(11, 19);
}

/* ★ 2026-10-08 — 마감 **시각**까지 봅니다.
   DB 의 마감지났나(apply_to, apply_to_time) 와 **글자 하나 다르지 않게** 유지하십시오.
   한쪽만 고치면 화면과 목록이 어긋납니다.

     마감일이 없으면            마감 아님
     마감일 < 오늘              마감
     마감일 > 오늘              마감 아님
     마감일 = 오늘 · 시각 없음    마감 아님 (그날 종일)
     마감일 = 오늘 · 시각 있음    지금 시각 > 그 시각 이면 마감

   왜 — 중앙보훈병원은 10.16(금) **09:00** 마감인데, 전에는 그날 저녁에도
   「오늘 마감 · D-0」 으로 떠 있었습니다. 회원이 저녁에 보고 들어가면 닫혀 있습니다 */
export function isClosed(
  applyTo: string | null | undefined,
  today = todayKst(),
  applyToTime?: string | null,
  nowTime = nowTimeKst(),
): boolean {
  if (!applyTo) return false;
  const d = applyTo.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (d < today) return true;
  if (d > today) return false;
  if (!applyToTime) return false;            // 그날 종일
  return nowTime > applyToTime.slice(0, 8);
}

/* 마감 배지에 쓸 말과 색 (2026-10-09).

   ★ 전에는 같은 이름의 dday() 가 **목록과 상세에 따로** 있었습니다.
     2026-10-08 에 마감 시각을 넣으면서 목록만 고쳐서, 시각이 지난 그날
     상세에는 빨간 「오늘 마감」 이 그대로 남았습니다 (근로복지공단안산병원
     17:30 마감 공고로 확인). 그래서 한 벌로 모읍니다 —
     **마감 배지를 그리는 곳은 이 함수만 부릅니다.**

     마감일 없음        마감표시() 가 정한 말 (「마감일 공고문 확인」 등) · 회색
     마감 (시각 포함)    「마감」 · 회색 · over
     오늘 마감          「오늘 마감」 또는 「오늘 오후 5시 30분 마감」 · 빨강
     그 밖              「D-n」 · 사흘 이하면 빨강

   urgent 는 빨강으로 칠할지, over 는 흐리게 둘지입니다. 둘은 같이 못 켜집니다. */
export type 마감배지모양 = { text: string; urgent: boolean; over: boolean };

export function 마감배지(
  to: string | null | undefined,
  표시?: string | null,
  시각?: string | null,
  now: Date = new Date(),
): 마감배지모양 {
  if (!to) {
    return { text: 표시 || '마감일 공고문 확인', urgent: false, over: false };
  }
  if (isClosed(to, todayKst(now), 시각, nowTimeKst(now))) {
    return { text: '마감', urgent: false, over: true };
  }
  /* ★ 2026-10-22 세중님 2번 — 포털 **상세** 칸에 기관이 적은 말이 있으면
     (「채용시까지」) 날수 대신 그 말을 씁니다. 마감표시() 가 날짜가 있어도 그 말을
     내도록 바뀌었습니다 (supabase/migrations/2026_10_22_마감표시_접수마감글.sql).
     ⚠ 날수(D-n)가 그 공고에서는 안 보입니다 — 그 날짜는 **게시 만료일**이고
       기관이 사람을 뽑으면 그날 닫습니다. 「D-12」는 없는 여유를 알려 주는 말입니다.
       숨김·정렬은 그대로 apply_to 를 봅니다 */
  if (표시) return { text: 표시, urgent: false, over: false };
  /* 날수는 **날짜끼리** 셉니다 (오늘 0시 ↔ 마감일 0시).
     지금 시각에서 재면 같은 날 낮에도 하루가 남은 것으로 올라갑니다 —
     목록의 옛 dday() 가 그렇게 세서, 마감 당일에 「D-1」, 내일 마감에
     「D-2」 를 찍고 있었습니다. 상세 쪽 셈이 맞았으므로 그것을 가져옵니다 */
  const left = Math.ceil(
    (new Date(to + 'T23:59:59+09:00').getTime()
     - new Date(todayKst(now) + 'T00:00:00+09:00').getTime()) / 86400000,
  ) - 1;
  if (left <= 0) {
    const t = 시각말(시각);
    return { text: t ? `오늘 ${t} 마감` : '오늘 마감', urgent: true, over: false };
  }
  return { text: 'D-' + left, urgent: left <= 3, over: false };
}

/* 「09:00:00」 → 「오전 9시」 · 「17:30:00」 → 「오후 5시 30분」 · 「23:59:59」 → 「밤 12시」 */
export function 시각말(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h >= 23 && mi >= 59) return '밤 12시';
  const 낮밤 = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return 낮밤 + ' ' + h12 + '시' + (mi ? ' ' + mi + '분' : '');
}

/* ★ 2026-10-14 세중님 확정 — 「예상 연봉」 표시를 한 자리에서 정합니다.

     공고에 금액이 있으면          공고의 금액 그대로 (지금처럼)
     금액이 없으면                 「내규에 따름」
                                   — 빈칸 · 「내규에 따름」 · 「보수규정에 따름」 ·
                                     「협의」 같은 글귀만 있는 것 전부

   **칸을 숨기지 않습니다.** 전에는 비면 칸을 아예 안 그려서, 회원이
   「우리가 못 받아온 것」인지 「공고에 없는 것」인지 알 수 없었습니다.
   **숫자를 만들지 않습니다** (작업지침 15절).
   「미공시」라는 말은 쓰지 않습니다 — 2026-10-14 에 그 결정을 바꿨습니다.

   금액을 가리는 자리는 여기 하나입니다. DB 쪽 짝은 네숫자() 의 ③ 예상연봉이고
   같은 꼴을 씁니다 — `[0-9][0-9,.[:space:]]*(만|천|억)?[[:space:]]*원` */
/* ★ 2026-10-22 — 「40백만원」 꼴을 더했습니다 (= 4,000만원). 공고문이 그렇게 적습니다
   (경기도의료원 수원병원 「年 40백만원 내외」). 짝은 tools/공고문읽기.mjs 의
   `금액꼴` 이고 **함께** 고쳤습니다 (지침 6절) */
const 금액꼴 = /[0-9][0-9,.\s]*(백만|십만|만|천|억)?\s*원/;

/* 금액이 적혀 있나 — 숫자 뒤에 「원」이 붙은 것만 금액으로 봅니다.
   「2년」 「9급」 「2026. 11월」 은 금액이 아닙니다 (공고문을 읽어 담은 값에
   보수 안내 문단이 통째로 들어온 것이 있습니다) */
export function 금액있나(연봉: string | null | undefined): boolean {
  return !!연봉 && 금액꼴.test(연봉);
}

export const 내규말 = '내규에 따름';

/* 화면에 찍을 말. 언제나 글자를 돌려줍니다 — 칸을 숨기지 않습니다 */
export function 연봉말(연봉: string | null | undefined): string {
  return 금액있나(연봉) ? String(연봉).trim() : 내규말;
}

/* ★ 2026-10-14 세중님 확정 — 「조교·연구」 배지에 **찍을 말 한 자리**.
 *
 * 무엇이 조교·연구인지 **가르는 일은 DB 의 조교연구갈래() 가 합니다.**
 * 여기는 그 값(`'조교'` · `'연구'` · null)을 **화면 글자로 바꾸는 것만** 합니다.
 * 화면 코드가 제목 글자를 보고 스스로 정하면 두 벌이 됩니다 (지침 6절).
 *
 * 왜 배지인가 — 물리치료·작업치료 **전공자를 받는 자리이지만 치료사 자리가
 * 아닌** 공고입니다. 안 보여주면 회원이 기회를 놓치고, 「○○치료사 채용공고」로
 * 적으면 거짓입니다. 그래서 **원문 제목 그대로 + 배지**입니다.
 *
 * ★ 2026-10-14 세중님 — **「조교」·「연구」 한 낱말만** 찍습니다.
 *   「치료사 채용이 아닙니다」 같은 말을 덧붙이지 않습니다. 제목이 원문
 *   그대로라 제목이 이미 그 말을 합니다.
 */
export function 조교연구말(갈래: string | null | undefined): string | null {
  if (갈래 === '조교') return '조교';
  if (갈래 === '연구') return '연구';
  return null;                       /* 모르는 값은 안 찍습니다 — 지어내지 않습니다 */
}

/* ★ 2026-10-24 세중님 ㉡ — 「지원 방법」 한 줄 **한 자리**.
 *
 * 워크넷 상세 `rcptMthd` 를 `detail.접수방법` 에 담습니다 (2026-10-23 부터).
 * 전수 258건을 보고 세중님이 정한 원칙 (`docs/지원방법_갈래원칙_1023.md`) —
 *
 *   · 원문 그대로 **나열**합니다. 하나로 단정하지 않습니다
 *   · **아는 낱말만** 적습니다 — 고용24 · 이메일 · 방문 · 팩스 · 우편 · 기타 ·
 *     자사채용사이트. 그 밖의 글자는 **안 적습니다**
 *   · 「기타(…)」 괄호 속은 담는 쪽에서 이미 떼어 냈습니다 (메일·전화가 들어옵니다)
 *
 * ★ **아는 낱말만** 이라는 울타리가 꼭 필요합니다 — `detail.접수방법` 에
 *   「채용시까지 (마감 전이라도 사람이 정해지면 닫힘)」이라는 **마감 안내 문장**이
 *   들어 있는 줄이 140건 있습니다 (옛 길이 2026-10-11 까지 넣은 값 · 회원 화면 0건).
 *   그대로 적으면 「지원 방법: 채용시까지 …」가 됩니다.
 */
export const 아는접수낱말 = ['고용24', '이메일', '방문', '팩스', '우편', '기타', '자사채용사이트'];

/** 열어서 **200 + 채용 쪽**인 것만 링크로 씁니다 (2026-10-24 · 3곳 가운데 1곳).
 *  명지춘혜는 기관 첫 화면이고, 거창적십자는 404 였습니다 — 주소를 짐작하지 않습니다 */
export const 확인된채용페이지 = [
  'https://www.mitawon.kr/bbs/board.php?bo_table=6_1_1_1&wr_id=218',
];

export type 지원방법꼴 = { 낱말: string[]; 채용페이지: string | null };

export function 지원방법말(접수방법: string | null | undefined): 지원방법꼴 {
  const t = String(접수방법 || '');
  if (!t) return { 낱말: [], 채용페이지: null };
  /* 괄호 안의 쉼표로는 가르지 않습니다 — 「자사채용사이트(…?a=1,2)」 가 있습니다 */
  const 조각: string[] = [];
  let 이번 = '';
  let 깊이 = 0;
  for (const c of t) {
    if (c === '(' || c === '（') 깊이 += 1;
    else if (c === ')' || c === '）') 깊이 = Math.max(0, 깊이 - 1);
    if (c === ',' && 깊이 === 0) { 조각.push(이번.trim()); 이번 = ''; continue; }
    이번 += c;
  }
  if (이번.trim()) 조각.push(이번.trim());

  const 낱말: string[] = [];
  let 채용페이지: string | null = null;
  for (const s of 조각) {
    const 아는것 = 아는접수낱말.find((w) => s === w || s.startsWith(w));
    if (!아는것) continue;                       /* 모르는 글자는 안 적습니다 */
    if (아는것 === '자사채용사이트') {
      const m = s.match(/[(（]\s*([^)）]+)\s*[)）]/);
      const 주소 = m ? m[1].trim() : '';
      if (확인된채용페이지.includes(주소)) 채용페이지 = 주소;
      if (!낱말.includes('자사 채용 사이트')) 낱말.push('자사 채용 사이트');
      continue;
    }
    if (!낱말.includes(아는것)) 낱말.push(아는것);
  }
  return { 낱말, 채용페이지 };
}
