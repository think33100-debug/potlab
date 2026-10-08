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
