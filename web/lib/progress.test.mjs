/* node web/lib/progress.test.mjs */
import assert from 'node:assert/strict';
import { progress, SECONDS_PER_STEP } from './progress.ts';

/* ① 9장짜리 — 처음·절반·끝 */
{
  assert.equal(progress(0, 9).msg, '이제 시작이에요');
  assert.equal(progress(4, 9).msg, '절반 왔어요!');      // 4/8 = 0.5
  assert.equal(progress(7, 9).msg, '조금만 더 하면 돼요'); // 남은 1장
  assert.equal(progress(8, 9).msg, '마지막이에요!');
}

/* ② 학생 6장에서도 절반에서 절반이라고 해야 합니다 */
{
  assert.equal(progress(0, 6).msg, '이제 시작이에요');
  assert.equal(progress(5, 6).msg, '마지막이에요!');
  /* 6장이면 0..5, 절반은 2.5 — 2는 0.4 라 아직 절반 전 */
  assert.equal(progress(2, 6).msg, '잘 하고 계세요');
  assert.equal(progress(3, 6).msg, '조금만 더 하면 돼요');  // 0.6 · 남은 2장
}

/* ③ 남은 시간 — 남은 화면 × 20초 */
{
  assert.equal(progress(0, 9).left, `${Math.round(8 * SECONDS_PER_STEP / 60)}분쯤 남았어요`);
  assert.equal(progress(0, 9).left, '3분쯤 남았어요');
  assert.equal(progress(6, 9).left, '1분쯤 남았어요');    // 2장 = 40초
  assert.equal(progress(7, 9).left, '곧 끝나요');         // 1장 = 20초
}

/* ④ 마지막 화면에서는 남은 시간을 안 적습니다 */
assert.equal(progress(8, 9).left, null);

/* ⑤ 범위를 벗어난 값을 넣어도 안 터집니다 */
assert.equal(progress(-3, 9).msg, '이제 시작이에요');
assert.equal(progress(99, 9).msg, '마지막이에요!');
assert.equal(progress(0, 1).msg, '마지막이에요!');
assert.equal(progress(0, 1).left, null);

console.log('progress 통과 — 5가지');
