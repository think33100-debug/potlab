/* node web/lib/pay.test.mjs

   등수·상위%는 돈 이야기라 틀리면 바로 신뢰를 잃습니다.
   DB 에서 받은 숫자(시험4번 = 월 260 · 연 3120, 표본 7명)를 그대로 넣어 봅니다. */
import assert from 'node:assert/strict';
import { bandOf, yearsOf, tierOf, rankOf, man10, grow } from './pay.ts';

/* ① 연차 구간 — DB 의 pay_band() 와 같아야 합니다 */
assert.equal(yearsOf(2021, 2026), 6);
assert.equal(bandOf(1), '1년차');
assert.equal(bandOf(3), '2-3년차');
assert.equal(bandOf(6), '4-6년차');
assert.equal(bandOf(10), '7-10년차');
assert.equal(bandOf(11), '11년차 이상');
assert.equal(bandOf(yearsOf(2021, 2026)), '4-6년차');   // 시험 계정과 같은 값

/* ② 등수 — 7명 중 나보다 적게 받는 사람이 4명이면 3등, 상위 43% */
{
  const r = rankOf(7, 4, 260, 250, 3);
  assert.equal(r.rank, 3);
  assert.equal(r.top, 43);
  assert.equal(r.diff, 10);
  assert.equal(tierOf(r.top).label, '중위권');
}

/* ③ 연 환산 기준 — 같은 사람이 연으로 보면 5등, 상위 71% 로 내려갑니다.
      상여를 받는 사람이 위로 올라가기 때문입니다 */
{
  const r = rankOf(7, 2, 3120, 3360, 3);
  assert.equal(r.rank, 5);
  assert.equal(r.top, 71);
  assert.equal(r.diff, -240);
  assert.equal(tierOf(r.top).label, '중위권 아래');
}

/* ④ 표본이 적으면 등수를 아예 안 냅니다 — 「3명 중 3등」은 첫인상만 나쁩니다 */
assert.equal(rankOf(2, 0, 260, 250, 3), null);
assert.equal(rankOf(7, 4, null, 250, 3), null);      // 내가 안 적었으면
assert.equal(rankOf(7, 4, 260, null, 3), null);      // 중위값이 안 나왔으면

/* ⑤ 등급 경계 */
assert.equal(tierOf(10).label, '최상위권');
assert.equal(tierOf(11).label, '상위권');
assert.equal(tierOf(50).label, '중위권');
assert.equal(tierOf(76).label, '하위권');

/* ⑥ 억·만원 표기 */
assert.equal(man10(3120), '3,120만원');
assert.equal(man10(10000), '1억원');
assert.equal(man10(12500), '1.25억원');

/* ⑦ 표본 안내 — 숫자를 부풀리지 않습니다 */
assert.equal(grow(7).goal, 10);
assert.equal(grow(7).pct, 70);
assert.equal(grow(30).goal, 100);
assert.equal(grow(120).goal, 200);

console.log('pay 통과 — 7가지');
