/* 경력 칸의 「전부 쓰거나, 전부 안 쓰거나」 규칙 검사 (2026-09-25).

   돌리는 법 —  node tools/check-career.mjs

   왜 있나 — 전에는 화면과 저장이 **다른 규칙**을 썼습니다.
     화면   rows.some(완성)           한 줄만 다 채우면 통과
     저장   filter(hospital && region) 개월수는 안 봄
   그래서 반쯤 쓴 줄이 화면은 통과하고 저장에서 조용히 버려졌습니다.
   적어놓은 게 없어지는 것이 제일 나쁩니다. 두 쪽을 한 규칙으로 묶고,
   그 규칙을 여기서 지킵니다.

   ※ lib/signup-fields.ts 의 것을 그대로 베낍니다 (TypeScript 라 바로 못 부름).
     아래에서 원문과 대조해, 두 벌이 되면 알려줍니다. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rowStarted = (r) => !!(r.hospital || r.region || r.months);
const rowFull = (r) => !!(r.hospital && r.region && r.months);
const rowsHalf = (rows) => rows.filter((r) => rowStarted(r) && !rowFull(r));
/* fieldError 의 개월수 규칙: 1~600 정수 (lib/signup-fields.ts 의 RANGE.months) */
const 개월나쁨 = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return false;
  const n = Number(s);
  return !Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 600;
};
const rowsReady = (rows) =>
  rowsHalf(rows).length === 0 && !rows.some((r) => rowFull(r) && 개월나쁨(r.months));
const rowsToSave = (rows) => rows.filter(rowFull);

const 줄 = (h, g, m) => ({ hospital: h, region: g, months: m });
const 빈줄 = 줄('', '', '');
const 찬줄 = 줄('종합병원', '서울', '24');
const 반줄 = 줄('종합병원', '', '');

const 표 = [
  ['아무것도 안 씀 — 막 졸업한 분',     [],                  true,  0],
  ['빈 줄만 있음',                      [빈줄, 빈줄],        true,  0],
  ['한 줄 다 씀',                       [찬줄],              true,  1],
  ['다 쓴 줄 + 빈 줄',                  [찬줄, 빈줄],        true,  1],
  ['반쯤 쓴 줄 하나',                   [반줄],              false, 0],
  ['다 쓴 줄 + 반쯤 쓴 줄',             [찬줄, 반줄],        false, 1],
  ['개월수만 뺌',                       [줄('종합병원','서울','')], false, 0],
  ['개월수가 범위 밖 (0)',              [줄('종합병원','서울','0')], false, 1],
  ['개월수가 범위 밖 (601)',            [줄('종합병원','서울','601')], false, 1],
];

let 틀림 = 0;
for (const [이름, rows, 넘어감, 저장수] of 표) {
  const a = rowsReady(rows);
  const b = rowsToSave(rows).length;
  const ok = a === 넘어감 && b === 저장수;
  if (!ok) 틀림 += 1;
  console.log(`  ${ok ? '○' : '✗'}  ${이름.padEnd(26)} 넘어감 ${a ? '예' : '아니오'} · 저장 ${b}줄`);
}

/* 제일 중요한 것 — 화면이 통과시킨 줄은 저장에서 하나도 안 없어져야 합니다 */
for (const [이름, rows] of 표) {
  if (!rowsReady(rows)) continue;
  const 쓴줄 = rows.filter(rowStarted).length;
  assert.equal(rowsToSave(rows).length, 쓴줄,
    `「${이름}」 — 화면은 통과시켰는데 저장에서 줄이 없어집니다`);
}

/* 베낀 규칙이 원문과 어긋나지 않았는지 */
const 원문 = readFileSync(new URL('../lib/signup-fields.ts', import.meta.url), 'utf8');
for (const 줄글 of [
  'export const rowStarted = (r: WorkRow) => !!(r.hospital || r.region || r.months);',
  'export const rowFull    = (r: WorkRow) => !!(r.hospital && r.region && r.months);',
  "months:             { min: 1, max: 600, int: true, label: '개월' },",
]) {
  if (!원문.includes(줄글)) {
    console.log(`  ✗  lib/signup-fields.ts 가 바뀌었습니다 — 이 검사도 같이 고치세요:\n       ${줄글}`);
    틀림 += 1;
  }
}

/* 화면이 그 규칙을 정말 쓰는지 — 따로 판정하는 코드가 되살아나면 잡습니다 */
const 화면 = readFileSync(new URL('../components/signup-survey.tsx', import.meta.url), 'utf8');
for (const [무엇, 있어야] of [
  ['const rowsOk = rowsReady(rows);', true],
  ['rowsToSave(rows)', true],
  ["rows.some((r) => r.hospital && r.region && r.months)", false],   // 옛 규칙
]) {
  if (화면.includes(무엇) !== 있어야) {
    console.log(`  ✗  components/signup-survey.tsx — ${있어야 ? '있어야 할' : '없어야 할'} 줄: ${무엇}`);
    틀림 += 1;
  }
}

console.log(틀림 ? `\n  ${틀림}곳이 틀립니다` : '\n  아홉 칸 다 맞습니다');
process.exit(틀림 ? 1 : 0);
