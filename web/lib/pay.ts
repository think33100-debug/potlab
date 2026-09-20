/* 월급 확인 화면이 쓰는 계산. 화면이 안 끼어 있어서 따로 시험할 수 있습니다
   (node lib/pay.test.mjs)

   옛 앱(index.html tierOf · meCard, gas/wage.js getStats)에서 그대로 옮겼습니다.
   숫자를 만들어내지 않습니다 — 서버가 준 「나보다 적게 받는 사람 수」로만 셉니다. */

export const BANDS = ['1년차', '2-3년차', '4-6년차', '7-10년차', '11년차 이상'] as const;

/* 옛 yearsOf_ · bandOf_ 와 같습니다. DB 의 pay_band() 와도 같아야 합니다 */
export const yearsOf = (hired: number, thisYear: number) => thisYear - hired + 1;

export function bandOf(years: number): string {
  if (years <= 1) return '1년차';
  if (years <= 3) return '2-3년차';
  if (years <= 6) return '4-6년차';
  if (years <= 10) return '7-10년차';
  return '11년차 이상';
}

export type Tier = { key: string; label: string; note: string };

/* 상위 % → 등급과 한 줄 평 (옛 tierOf) */
export function tierOf(top: number): Tier {
  if (top <= 10) return { key: 't1', label: '최상위권', note: '같은 조건에서 손에 꼽히는 수준이에요' };
  if (top <= 25) return { key: 't2', label: '상위권', note: '또래보다 확실히 높은 편이에요' };
  if (top <= 50) return { key: 't3', label: '중위권', note: '딱 평균 언저리죠' };
  if (top <= 75) return { key: 't4', label: '중위권 아래', note: '조건을 한 번 따져볼 만해요' };
  return { key: 't5', label: '하위권', note: '당직·수당 조건을 다른 곳과 비교해 보시길 권해요' };
}

export type Rank = {
  n: number;          // 같은 조건 표본 수
  rank: number;       // 몇 등인지 (1등이 제일 많이 받음)
  top: number;        // 상위 몇 %
  mine: number;
  median: number;
  diff: number;       // 중위값과의 차이
};

/* 서버가 준 「나보다 적게 받는 사람 수」로 등수를 냅니다.
   표본이 적으면 아예 안 냅니다 — 「3명 중 3등」은 첫인상만 나쁩니다 */
export function rankOf(
  n: number, below: number, mine: number | null, median: number | null, minN: number,
): Rank | null {
  if (!mine || mine <= 0 || median == null || n < minN) return null;
  return {
    n,
    rank: n - below,
    top: Math.round((1 - below / n) * 100),
    mine, median,
    diff: Math.round((mine - median) * 10) / 10,
  };
}

/* 만원 단위를 억·만원으로 (옛 man10) */
export function man10(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(2).replace(/\.?0+$/, '') + '억원';
  return Math.round(v).toLocaleString('ko-KR') + '만원';
}

/* 표본이 늘수록 정확해진다는 안내 (옛 growCard).
   숫자를 부풀리지 않고 「지금은 참고 수준」이라고 밝히는 자리입니다 */
export function grow(n: number): { goal: number; pct: number; msg: string } {
  let goal: number, msg: string;
  if (n < 10) { goal = 10; msg = '지금은 참고 수준이에요. 10명만 넘어도 중위값이 눈에 띄게 안정돼요'; }
  else if (n < 30) { goal = 30; msg = '조금씩 모양이 잡히고 있어요. 30명이 되면 연차별로 나눠 볼 수 있어요'; }
  else if (n < 100) { goal = 100; msg = '쓸 만한 수준이에요. 100명이 넘으면 지역·병원유형별로 정확해져요'; }
  else { goal = Math.ceil((n + 1) / 100) * 100; msg = '이미 믿을 만한 표본이에요. 더 모이면 세부 조건까지 갈라볼 수 있어요'; }
  return { goal, pct: Math.min(Math.round((n / goal) * 100), 100), msg };
}

/* ── 연 총소득 계산 ──

   DB 의 salary_records.annual_total 과 같은 식이어야 합니다.
   화면에서 「연봉으로 치면 약 …」을 바로 보여주려고 여기에도 둡니다.
   식이 갈라지면 화면과 통계가 다른 말을 하게 되니 시험으로 묶어둡니다. */
export type PayInput = {
  base: number;            // 고정 월급 (세전, 만원)
  extra?: number;          // 추가 수당 월 평균 (만원)
  bonus?: number;          // 연간 상여 (만원)
  dutyCount?: number;      // 월 당직 횟수
  dutyHours?: number;      // 당직 1회 시간
  dutyPay?: number;        // 당직 1회 수당 (만원)
  weekendCount?: number;   // 월 주말근무 횟수
  weekendHours?: number;   // 주말근무 1회 시간
  weekendPay?: number;     // 주말근무 1회 수당 (만원)
};

const n0 = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);

/* 연 총소득 (만원) */
export function annualTotal(p: PayInput): number {
  return n0(p.base) * 12
    + n0(p.extra) * 12
    + n0(p.bonus)
    + n0(p.dutyPay) * n0(p.dutyCount) * 12
    + n0(p.weekendPay) * n0(p.weekendCount) * 12;
}

/* 한 달에 실제로 일하는 시간.
   174시간은 주 40시간 · 월 평균 4.345주 기준입니다 (옛 앱과 같은 값) */
export const BASE_HOURS = 174;

export function monthlyHours(p: PayInput): number {
  return BASE_HOURS
    + n0(p.dutyCount) * n0(p.dutyHours)
    + n0(p.weekendCount) * n0(p.weekendHours);
}

/* 시급 (원). 당직·주말까지 넣은 실제 노동시간으로 나눕니다 —
   월급은 상위인데 시급은 하위인 경우가 여기서 드러납니다 */
export function hourlyWage(p: PayInput): number {
  const h = monthlyHours(p);
  if (h <= 0) return 0;
  return Math.round((annualTotal(p) / 12) * 10_000 / h);
}
