/* 제목대조에서 「어디에도 없음」 으로 남은 것들을 **수집기와 같은 규칙**으로
 * 갈라, 「우리 직군인데 놓친 것」 만 뽑습니다 (2026-10-12 · 조사만 · 읽기만).
 *
 *   node tools/빠진것_직군가리기.mjs
 *   → 화면 · docs/시험_playwright_1012/C_빠진것판정.json
 *
 * 직군 판정은 **제 정규식을 만들지 않습니다** (지침 6절 · 기준은 한 자리) —
 *   tools/gas-rules.mjs  matchJob · notOurs      직군 낱말
 *   tools/sort-rule.mjs  sortJob                 회원목록 · 보류함 · 쓰레기통
 * 수집기(`collect-hosp.mjs`)가 쓰는 것과 같은 함수입니다.
 *
 * 그래서 「빠진 것」 이 셋으로 갈립니다 —
 *   쓰레기통 될 것   우리 직군이 아니라 **일부러** 안 담는 것. 놓친 게 아닙니다
 *   보류함 될 것     제목만으론 못 가려 관리자가 볼 것. 담겨야 하는데 안 담겼습니다
 *   회원목록 될 것   **진짜 놓친 공고입니다**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchJob, notOurs } from './gas-rules.mjs';
import { sortJob } from './sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');
const J = JSON.parse(fs.readFileSync(path.join(폴더, 'C_제목대조.json'), 'utf8'));

const 갈래셈 = {};
const 진짜놓침 = [];
const 보류될것 = [];
for (const r of J.곳) {
  for (const t of (r.빠진것 || [])) {
    const 직군 = (matchJob(t) && !notOurs(t)) ? matchJob(t) : '';
    const g = sortJob(t, 직군, null);
    갈래셈[g.갈래] = (갈래셈[g.갈래] ?? 0) + 1;
    const 줄 = { 곳: r.곳, 제목: t, 직군: 직군 || null, 왜: g.왜, 상태칸: r.상태칸 };
    if (g.갈래 === '회원목록') 진짜놓침.push(줄);
    else if (g.갈래 === '보류함') 보류될것.push(줄);
  }
}

fs.writeFileSync(path.join(폴더, 'C_빠진것판정.json'),
  JSON.stringify({ 센날: new Date().toISOString(), 갈래셈, 진짜놓침, 보류될것 }, null, 1));

const 합 = Object.values(갈래셈).reduce((a, b) => a + b, 0);
console.log('「사이트에 있는데 우리 DB 어디에도 없는」 제목 ' + 합 + '건을');
console.log('수집기와 같은 규칙(gas-rules · sort-rule)으로 갈랐습니다.');
console.log('');
for (const [k, n] of Object.entries(갈래셈).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(4) + '건  ' + k
    + (k === '쓰레기통' ? '   ← 우리 직군이 아니라 **일부러** 안 담는 것' : '')
    + (k === '보류함' ? '   ← 담겨야 하는데 안 담겼습니다' : '')
    + (k === '회원목록' ? '   ← **진짜 놓친 공고**' : ''));
}
console.log('');
console.log('── 회원목록이 될 것 (진짜 놓침) ' + 진짜놓침.length + '건 ──');
for (const x of 진짜놓침) {
  console.log('   ' + String(x.곳).slice(0, 22).padEnd(24) + (x.직군 || '-').padEnd(7)
    + String(x.제목).slice(0, 56));
  console.log('        왜 — ' + String(x.왜).slice(0, 90));
}
console.log('');
console.log('── 보류함이 될 것 ' + 보류될것.length + '건 ── 앞 25');
for (const x of 보류될것.slice(0, 25)) {
  console.log('   ' + String(x.곳).slice(0, 22).padEnd(24) + String(x.제목).slice(0, 56));
}
if (보류될것.length > 25) console.log('   … 그밖 ' + (보류될것.length - 25) + '건');
console.log('');
console.log('→ docs/시험_playwright_1012/C_빠진것판정.json');
