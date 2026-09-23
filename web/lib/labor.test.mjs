/* node web/lib/labor.test.mjs

   퇴직금과 연차는 **돈과 휴가가 걸린 숫자**입니다.
   틀리면 그걸 믿고 계산한 사람이 손해를 봅니다.
   그래서 손으로 계산한 값과 하나씩 맞춰 봅니다. */
import assert from 'node:assert/strict';
import { daysBetween, monthsBetween, severance, leave } from './labor.ts';

const d = (s) => new Date(s + 'T00:00:00');

/* ① 날짜 세기 */
assert.equal(daysBetween(d('2026-01-01'), d('2026-01-02')), 1);
assert.equal(daysBetween(d('2025-01-01'), d('2026-01-01')), 365);
assert.equal(daysBetween(d('2024-01-01'), d('2025-01-01')), 366);   // 2024 윤년
/* 날짜가 안 찼으면 한 달 빼고 셉니다 */
assert.equal(monthsBetween(d('2026-02-01'), d('2026-03-31')), 1);
assert.equal(monthsBetween(d('2026-02-01'), d('2026-04-01')), 2);

/* ② 퇴직금 — 1년을 못 채우면 없습니다 */
{
  const r = severance({ joined: d('2026-01-01'), left: d('2026-10-01'), monthlyWage: 3_000_000 });
  assert.equal(r.eligible, false);
  assert.equal(r.workedDays, 273);
  assert.equal(r.shortDays, 92);        // 365 - 273
}

/* ③ 퇴직금 — 손으로 계산한 값과 맞춥니다.

      입사 2025-01-01 · 퇴사 2026-01-01 → 재직 365일
      월 300만원 · 상여 없음 · 연차수당 없음
      퇴직 전 3개월 = 2025-10-01 ~ 2026-01-01 = 31+30+31 = 92일
      3개월 임금 = 3,000,000 × 3 = 9,000,000
      1일 평균임금 = 9,000,000 ÷ 92 = 97,826.086…
      퇴직금 = 97,826.086… × 30 × 365 ÷ 365 = 2,934,782.6… → 2,934,783 */
{
  const r = severance({ joined: d('2025-01-01'), left: d('2026-01-01'), monthlyWage: 3_000_000 });
  assert.equal(r.eligible, true);
  assert.equal(r.workedDays, 365);
  assert.equal(r.months3Days, 92);
  assert.equal(r.wage3, 9_000_000);
  assert.equal(r.dailyAvg, 97_826);
  assert.equal(r.amount, 2_934_783);
  assert.equal(r.years, 1);
  assert.equal(r.restDays, 0);
}

/* ④ 퇴직금 — 상여와 연차수당은 1년치의 3/12 만 들어갑니다.

      위와 같은 조건에 상여 400만원 · 연차수당 80만원
      3개월 임금 = 9,000,000 + 4,000,000×0.25 + 800,000×0.25 = 10,200,000
      1일 평균임금 = 10,200,000 ÷ 92 = 110,869.56… → 110,870
      퇴직금 = 110,869.565… × 30 × 365 ÷ 365 = 3,326,086.9… → 3,326,087 */
{
  const r = severance({
    joined: d('2025-01-01'), left: d('2026-01-01'),
    monthlyWage: 3_000_000, bonusYear: 4_000_000, leavePayYear: 800_000,
  });
  assert.equal(r.wage3, 10_200_000);
  assert.equal(r.dailyAvg, 110_870);
  assert.equal(r.amount, 3_326_087);
}

/* ⑤ 퇴직금 — 3년 반 다닌 사람. 재직일수가 그대로 곱해집니다.

      입사 2022-03-02 · 퇴사 2025-09-01 → 1279일
      월 320만원 · 3개월 = 2025-06-01~2025-09-01 = 30+31+31 = 92일
      1일 평균임금 = 9,600,000 ÷ 92 = 104,347.826…
      퇴직금 = 104,347.826… × 30 × 1279 ÷ 365 = 10,969,386.5… → 10,969,387 */
{
  const r = severance({ joined: d('2022-03-02'), left: d('2025-09-01'), monthlyWage: 3_200_000 });
  assert.equal(r.workedDays, 1279);
  assert.equal(r.months3Days, 92);
  assert.equal(r.dailyAvg, 104_348);
  assert.equal(r.amount, 10_969_387);
  assert.equal(r.years, 3);
  assert.equal(r.restDays, 184);
}

/* ⑥ 연차 — 1년 미만은 한 달에 하루, 11일까지 */
{
  assert.equal(leave(d('2026-01-01'), d('2026-01-15')).days, 0);   // 한 달을 못 채움
  assert.equal(leave(d('2026-01-01'), d('2026-04-01')).days, 3);
  assert.equal(leave(d('2026-01-01'), d('2026-12-01')).days, 11);  // 11개월
  assert.equal(leave(d('2026-01-01'), d('2026-12-31')).days, 11);  // 한도에서 멈춤
}

/* ⑦ 연차 — 1년 이상 15일, 3년째부터 2년마다 하루씩 */
{
  assert.equal(leave(d('2025-01-01'), d('2026-01-01')).days, 15);   // 만 1년
  assert.equal(leave(d('2024-01-01'), d('2026-01-01')).days, 15);   // 만 2년
  assert.equal(leave(d('2023-01-01'), d('2026-01-01')).days, 16);   // 만 3년
  assert.equal(leave(d('2022-01-01'), d('2026-01-01')).days, 16);   // 만 4년
  assert.equal(leave(d('2021-01-01'), d('2026-01-01')).days, 17);   // 만 5년
  assert.equal(leave(d('2005-01-01'), d('2026-01-01')).days, 25);   // 만 21년 — 한도
  assert.equal(leave(d('1995-01-01'), d('2026-01-01')).days, 25);   // 더 다녀도 25
}

/* ⑧ 연차 — 다음에 늘어나는 시점 */
{
  assert.deepEqual(leave(d('2026-01-01'), d('2026-06-01')).next, { when: '입사 1년째', days: 15 });
  assert.deepEqual(leave(d('2025-01-01'), d('2026-01-01')).next, { when: '입사 3년째', days: 16 });
  assert.deepEqual(leave(d('2023-01-01'), d('2026-01-01')).next, { when: '입사 5년째', days: 17 });
  /* 한도에 닿으면 더 안 늘어난다고 말합니다 */
  assert.equal(leave(d('2005-01-01'), d('2026-01-01')).next, null);
}

/* ⑨ 연차 — 언제까지 쓰나 (생긴 날부터 1년) */
{
  assert.equal(leave(d('2026-03-02'), d('2026-06-01')).useBy, '2027-03-02');
  assert.equal(leave(d('2024-03-02'), d('2026-06-01')).useBy, '2027-03-02');
}

console.log('퇴직금 · 연차 통과 — 9가지');
