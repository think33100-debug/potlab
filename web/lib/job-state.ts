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
