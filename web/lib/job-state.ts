/* 공고가 마감됐는지 한 곳에서 판단합니다 (node lib/job-state.test.mjs).

   마감일이 비어 있으면 마감으로 안 칩니다.
   인수인계 원칙이 「마감일이 비어 있으면 잘못 읽은 것」입니다 —
   자료를 못 받아온 것뿐인데 멀쩡한 공고를 막으면 안 됩니다.

   날짜는 한국 시간 기준입니다. UTC 로 재면 한국에서 자정 넘긴 뒤 아홉 시간 동안
   어제 날짜로 판단합니다. 마감일 당일은 아직 열린 것으로 봅니다. */

export const KST = 'Asia/Seoul';

/* 오늘 (한국) — 'YYYY-MM-DD' */
export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/* apply_to 가 오늘보다 앞이면 마감입니다.
   비었거나 날짜 모양이 아니면 마감이 아닙니다 */
export function isClosed(applyTo: string | null | undefined, today = todayKst()): boolean {
  if (!applyTo) return false;
  const d = applyTo.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d < today;
}
