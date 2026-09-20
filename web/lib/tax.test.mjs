/* node web/lib/tax.test.mjs

   돈 계산이라 틀리면 바로 신뢰를 잃습니다.
   요율은 공식 자료에서 확인한 값이고(lib/tax.ts 머리말), 여기서는
   그 요율이 코드에 제대로 박혔는지와 계산이 스스로 맞는지를 봅니다. */
import assert from 'node:assert/strict';
import {
  netFromGross, grossFromNet, 만원,
  국민연금, 건강보험, 장기요양_대_건강보험, 고용보험, RATE_YEAR,
} from './tax.ts';

/* ① 요율이 확인한 값 그대로인지 — 여기가 바뀌면 모든 숫자가 바뀝니다 */
assert.equal(RATE_YEAR, 2026);
assert.equal(국민연금, 0.0475);                 // 9.5% 의 절반
assert.equal(건강보험, 0.03595);                // 7.19% 의 절반
assert.equal(장기요양_대_건강보험, 0.1314);
assert.equal(고용보험, 0.009);

/* ② 4대보험은 손으로 셀 수 있습니다. 월 세전 300만원 */
{
  const b = netFromGross(3_000_000);
  assert.equal(b.국민연금, 142_500);            // 300만 × 4.75%
  assert.equal(b.건강보험, 107_850);            // 300만 × 3.595%
  assert.equal(b.장기요양, 14_170);             // 107,850 × 13.14% · 10원 미만 버림
  assert.equal(b.고용보험, 27_000);             // 300만 × 0.9%
}

/* ③ 세후는 세전보다 작고, 공제 합계와 아귀가 맞아야 합니다 */
{
  const b = netFromGross(3_000_000);
  assert.ok(b.net < b.gross);
  assert.equal(b.gross - b.공제합계, b.net);
  /* 지방소득세는 소득세의 10% · 10원 미만 버림 */
  assert.equal(b.지방소득세, Math.floor(Math.round(b.소득세 * 0.1) / 10) * 10);
  /* 치료사 급여대에서 공제는 대략 10~15% 입니다. 이 밖으로 나가면 뭔가 틀린 것 */
  const 비율 = b.공제합계 / b.gross;
  assert.ok(비율 > 0.09 && 비율 < 0.16, `공제 비율이 이상해요: ${비율}`);
}

/* ④ 세전 → 세후 → 세전 이 제자리로 돌아와야 합니다 (핵심).
      보험료를 10원 단위로 버리니 세후가 계단 모양이라 1원까지는 안 붙습니다.
      화면은 만원 단위로 보여주므로 만원이 같으면 됩니다 */
for (const g of [2_000_000, 2_500_000, 3_000_000, 4_000_000, 6_000_000]) {
  const net = netFromGross(g).net;
  const back = grossFromNet(net);
  assert.equal(만원(back), 만원(g), `${g} → ${net} → ${back} 로 안 돌아와요`);
  assert.ok(Math.abs(back - g) <= 1000, `${g} → ${back} 차이가 커요`);
}

/* ⑤ 부양가족이 늘면 세금이 줄고 실수령이 늡니다 */
{
  const 혼자 = netFromGross(3_000_000, 1);
  const 넷 = netFromGross(3_000_000, 4);
  assert.ok(넷.소득세 < 혼자.소득세);
  assert.ok(넷.net > 혼자.net);
  /* 4대보험은 부양가족과 무관합니다 */
  assert.equal(넷.국민연금, 혼자.국민연금);
  assert.equal(넷.건강보험, 혼자.건강보험);
}

/* ⑥ 많이 벌수록 떼는 비율이 커집니다 (누진) */
{
  const 낮 = netFromGross(2_200_000);
  const 높 = netFromGross(6_000_000);
  assert.ok(높.공제합계 / 높.gross > 낮.공제합계 / 낮.gross);
}

/* ⑦ 0 과 음수를 넣어도 안 터집니다 */
assert.equal(netFromGross(0).net, 0);
assert.equal(grossFromNet(0), 0);
assert.equal(netFromGross(-5).net, 0);

/* ⑧ 만원 단위 반올림 */
assert.equal(만원(2_504_000), 250);
assert.equal(만원(2_505_000), 251);

/* ⑨ 실제로 쓰일 값 하나 — 세후 220만원이면 세전이 얼마쯤인지.
      정확한 정답이 아니라 「말이 되는 범위」인지를 봅니다 */
{
  const g = grossFromNet(2_200_000, 1);
  assert.ok(만원(g) >= 235 && 만원(g) <= 260, `세후 220 → 세전 ${만원(g)}만원은 이상해요`);
  assert.equal(만원(netFromGross(g).net), 220);   // 되돌리면 제자리
}

console.log('tax 통과 — 9가지');
