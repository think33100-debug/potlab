/* node web/lib/school-period.test.mjs — 졸업 시점과 무료 열람 끝날 (피그마 07 B 예시 그대로) */
import assert from 'node:assert/strict';
import { 졸업연월, 무료끝날, 연월읽기, 미래인가 } from './school-period.ts';

/* ① 피그마 예시 — 4년제 · 2023년 03월 입학 → 졸업 예정 2027년 02월 · 2028년 2월 29일까지 (윤년) */
assert.deepEqual(졸업연월('4년제 대학', { y: 2023, m: 3 }), { y: 2027, m: 2 });
assert.equal(무료끝날({ y: 2027, m: 2 }), '2028-02-29');

/* ② 피그마 예시 — 2022년 03월 입학 → 졸업 2026년 02월 · 2027년 2월 28일까지 */
assert.deepEqual(졸업연월('4년제 대학', { y: 2022, m: 3 }), { y: 2026, m: 2 });
assert.equal(무료끝날({ y: 2026, m: 2 }), '2027-02-28');

/* ③ 전문대학 3년 · 석사 2년 · 해 넘김 */
assert.deepEqual(졸업연월('전문대학', { y: 2024, m: 3 }), { y: 2027, m: 2 });
assert.deepEqual(졸업연월('석사', { y: 2025, m: 9 }), { y: 2027, m: 8 });
assert.equal(무료끝날({ y: 2027, m: 8 }), '2028-08-31');

/* ④ 학교 경험 없음 · 입학 연월 없음 → 계산 안 함 */
assert.equal(졸업연월('학교 경험 없음', { y: 2023, m: 3 }), null);
assert.equal(졸업연월('4년제 대학', null), null);
assert.equal(무료끝날(null), null);

/* ⑤ 읽기 · 미래 */
assert.deepEqual(연월읽기('2023-03-01'), { y: 2023, m: 3 });
assert.equal(연월읽기('2023-13'), null);
const 오늘 = new Date(Date.UTC(2026, 10, 15));   // 2026-11
assert.equal(미래인가({ y: 2026, m: 11 }, 오늘), false);
assert.equal(미래인가({ y: 2026, m: 12 }, 오늘), true);

console.log('school-period 시험 통과');
