/* 퇴직금과 연차. 계산만 있고 화면이 안 끼어 있어 따로 시험할 수 있습니다
   (node lib/labor.test.mjs).

   숫자는 전부 lib/rates.ts 에서 가져옵니다 — 해마다 볼 값은 거기 한 곳입니다.
   여기 있는 것은 법 조문을 그대로 옮긴 셈법뿐입니다.

   ※ 우리가 내는 것은 **법이 정한 최소**입니다. 회사 규정이 법보다 좋으면
     그쪽을 따릅니다. 화면에 그렇게 밝혀야 합니다. */

import { 연차 as 연차기준, 퇴직금 as 퇴직금기준 } from './rates.ts';

/* ── 날짜 ─────────────────────────────────────────── */

/** 두 날짜 사이의 일수. 시각·시간대에 안 흔들리게 날짜만 셉니다 */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** 그 자리의 날짜를 YYYY-MM-DD 로. 시간대로 하루가 밀리지 않게 직접 씁니다 */
export function ymd(x: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
}

/** 만 N개월. 날짜가 안 찼으면 한 달 빼고 셉니다 (2/1 → 3/31 은 1개월) */
export function monthsBetween(from: Date, to: Date): number {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1;
  return m;
}

/* ── 퇴직금 (근로자퇴직급여보장법 제8조) ─────────────

   퇴직금 = 1일 평균임금 × 30 × 재직일수 ÷ 365
   1일 평균임금 = (퇴직 전 3개월 임금 + 상여 × 3/12 + 연차수당 × 3/12) ÷ 3개월 일수

   3개월을 「90일」로 고정하지 않습니다. 실제 달력 일수로 나눠야 맞습니다 —
   2월이 끼면 89일, 여름이면 92일입니다. 이 차이가 몇 만원씩 납니다. */

export type Severance = {
  /** 못 받는 경우. 이유와 며칠 모자라는지 */
  eligible: boolean;
  workedDays: number;
  shortDays: number;
  /** 아래는 eligible 일 때만 뜻이 있습니다 */
  months3Days: number;   // 퇴직 전 3개월의 실제 일수
  wage3: number;         // 그 3개월 임금 총액 (상여·연차수당 몫 포함)
  dailyAvg: number;      // 1일 평균임금
  amount: number;        // 퇴직금
  years: number;         // 재직 N년
  restDays: number;      // 그리고 며칠
};

export function severance(input: {
  /** 입사일 · 퇴사일 (마지막 근무일 다음 날이 아니라 마지막 근무일) */
  joined: Date;
  left: Date;
  /** 월 평균 임금 (원). 퇴직 전 3개월 평균입니다 */
  monthlyWage: number;
  /** 1년치 상여 (원). 없으면 0 */
  bonusYear?: number;
  /** 1년치 연차수당 (원). 없으면 0 */
  leavePayYear?: number;
}): Severance {
  const worked = daysBetween(input.joined, input.left);

  if (worked < 퇴직금기준.최소_재직일) {
    return {
      eligible: false, workedDays: Math.max(0, worked),
      shortDays: 퇴직금기준.최소_재직일 - Math.max(0, worked),
      months3Days: 0, wage3: 0, dailyAvg: 0, amount: 0, years: 0, restDays: 0,
    };
  }

  /* 퇴직 전 3개월의 실제 달력 일수 */
  const from3 = new Date(input.left);
  from3.setMonth(from3.getMonth() - 퇴직금기준.평균임금_개월);
  const months3Days = daysBetween(from3, input.left);

  const bonus = input.bonusYear ?? 0;
  const leave = input.leavePayYear ?? 0;
  /* 상여와 연차수당은 1년치를 3/12 만큼만 넣습니다 (고용노동부 산정 지침) */
  const wage3 = input.monthlyWage * 퇴직금기준.평균임금_개월
    + bonus * 퇴직금기준.평균임금_개월 / 12
    + leave * 퇴직금기준.평균임금_개월 / 12;

  const dailyAvg = wage3 / months3Days;
  const amount = dailyAvg * 퇴직금기준.일수 * worked / 365;

  return {
    eligible: true,
    workedDays: worked,
    shortDays: 0,
    months3Days,
    wage3: Math.round(wage3),
    dailyAvg: Math.round(dailyAvg),
    amount: Math.round(amount),
    years: Math.floor(worked / 365),
    restDays: worked % 365,
  };
}

/* ── 연차 (근로기준법 제60조) ───────────────────────

   1년 미만    한 달 개근마다 하루. 최대 11일
   1년 이상    15일
   3년째부터   2년마다 하루씩. 25일이 한도

   법이 정한 최소입니다. 회사 규정이 더 좋으면 그쪽을 따릅니다. */

export type Leave = {
  /** 기준일에 쓸 수 있는 일수 */
  days: number;
  /** 근속 N년 M개월 */
  years: number;
  months: number;
  /** 어떻게 나온 숫자인지 한 줄 */
  how: string;
  /** 다음에 늘어나는 시점. 더 안 늘면 null */
  next: { when: string; days: number } | null;
  /** 이 연차를 언제까지 쓰나 */
  useBy: string;
};

export function leave(joined: Date, at: Date = new Date()): Leave {
  const months = Math.max(0, monthsBetween(joined, at));
  const years = Math.floor(months / 12);

  let days: number;
  let how: string;
  let next: Leave['next'] = null;

  if (years < 1) {
    days = Math.min(months, 연차기준.미만_한도);
    how = `1년 미만은 한 달 개근할 때마다 하루씩 생깁니다. ${연차기준.미만_한도}일까지 생겨요`;
    next = { when: '입사 1년째', days: 연차기준.기본 };
  } else if (years < 3) {
    days = 연차기준.기본;
    how = `1년 이상이면 ${연차기준.기본}일입니다`;
    next = { when: '입사 3년째', days: 연차기준.기본 + 1 };
  } else {
    const step = Math.floor((years - 1) / 연차기준.가산_주기_년);
    days = Math.min(연차기준.기본 + step, 연차기준.한도);
    how = `3년째부터 ${연차기준.가산_주기_년}년마다 하루씩 늘어납니다. ${연차기준.한도}일이 한도입니다`;
    if (days < 연차기준.한도) {
      const when = 1 + (step + 1) * 연차기준.가산_주기_년;
      next = { when: `입사 ${when}년째`, days: Math.min(연차기준.기본 + step + 1, 연차기준.한도) };
    }
  }

  /* 연차는 생긴 날부터 1년 안에 써야 합니다 (제60조 ⑦).
     1년 미만이면 입사 1년째까지, 그 뒤로는 다음 입사기념일까지입니다.

     toISOString 을 쓰면 안 됩니다 — 한국은 UTC+9 라 03-02 자정이
     UTC 로는 03-01 15시입니다. 하루 앞으로 밀려 「어제까지」가 됩니다 */
  const by = new Date(joined);
  by.setFullYear(joined.getFullYear() + Math.max(1, years + 1));
  const useBy = ymd(by);

  return { days, years, months: months % 12, how, next, useBy };
}
