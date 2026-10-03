/* 두 판정이 어디서 다른가 · 상세를 몇 건 열어야 하나 — 재기만 합니다 (2026-10-03) */
import fs from 'node:fs';
import { matchJob, notOurs, titleOtherOnly } from './gas-rules.mjs';
import { 확정, 가능성 } from './뽑을단어.mjs';

const 붙 = (s) => String(s || '').replace(/\s+/g, '');
const 줄들 = JSON.parse(fs.readFileSync('짝대조_옛것만.json', 'utf8'))
  .filter((v) => v.짝 === 'WN→WN2');

console.log('워크넷 「옛 것만 읽음」 ' + 줄들.length + '건 · 호출 0번\n');

console.log('── 두 판정이 다른 곳 ──');
console.log('  matchJob (gas-rules · 구운 규칙)  ↔  확정찾기 (뽑을단어)');
const 다른것 = [];
for (const v of 줄들) {
  const m = matchJob(v.제목);
  const c = 확정.filter((w) => 붙(v.제목).includes(붙(w)));
  if (!!m !== (c.length > 0)) 다른것.push({ v, m, c });
}
console.log('  다른 줄 ' + 다른것.length + '건 / ' + 줄들.length + '건');
for (const { v, m, c } of 다른것.slice(0, 8)) {
  console.log('   · ' + String(v.제목).slice(0, 46).padEnd(48)
    + 'matchJob=' + (m || '없음').padEnd(8) + '확정=' + (c.join('·') || '없음'));
}

console.log('\n── 상세(본문)를 열어야 하는 줄 ──');
let 제목으로끝 = 0; let 본문필요 = 0;
for (const v of 줄들) {
  if (titleOtherOnly(v.제목)) { 제목으로끝++; continue; }          // 버림
  if (matchJob(v.제목) && !notOurs(v.제목)) { 제목으로끝++; continue; } // 보이기·보류
  본문필요++;
}
console.log('  제목만으로 끝나는 줄   ' + 제목으로끝 + '건  (상세 안 엽니다)');
console.log('  본문을 봐야 하는 줄   ' + 본문필요 + '건  ← 상세 호출 수');

console.log('\n── 호출 수 셈 ──');
console.log('  첫 바퀴    목록 15 + 상세 ' + 본문필요 + ' = ' + (15 + 본문필요) + '번');
console.log('  평소 바퀴  목록 15 + 상세 (새 공고 몫만) ≈ 15~20번');
console.log('             순찰 기억(수집판정)이 이미 판정한 번호를 빼기 때문입니다');
console.log('  하루       3회 × 평소 ≈ 45~60번');
