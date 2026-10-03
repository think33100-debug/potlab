/* ═══════════════════════════════════════════════════════════════
 *  덧갈래 ㉮ 를 켜면 81건이 어디로 가는지 **재기만** 합니다
 *  2026-10-03. 아무것도 담거나 고치지 않습니다.
 * ═══════════════════════════════════════════════════════════════
 *
 *   node tools/덧갈래재기.mjs            제목만 보고 가립니다 (호출 0번)
 *   node tools/덧갈래재기.mjs --본문      본문까지 열어 가립니다
 *
 *  무엇을 재나 — 짝대조_옛것만.json 의 워크넷 줄(= 옛것만 읽은 것)을
 *  tools/덧갈래판정.mjs 에 넣어 보이기·보류함·버림 중 어디로 가는지 셉니다.
 *  판정은 새 앱 것을 그대로 씁니다 (gas-rules · 뽑을단어).
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { 덧갈래가리기 } from './덧갈래판정.mjs';

const 본문볼까 = process.argv.includes('--본문');
const 줄들 = JSON.parse(fs.readFileSync('짝대조_옛것만.json', 'utf8'))
  .filter((v) => v.짝 === 'WN→WN2');

console.log('워크넷 「옛 것만 읽음」 ' + 줄들.length + '건을 ㉮ 판정에 넣어 봅니다'
  + (본문볼까 ? ' (본문까지)' : ' (제목만 · 호출 0번)'));

const 통 = { 보이기: [], 보류함: [], 버림: [] };
for (const v of 줄들) {
  const r = 덧갈래가리기({ 제목: v.제목, 기관: v.기관 });
  통[r.갈래].push({ ...v, 왜: r.왜, 직군: r.직군 });
}

console.log('\n── 어디로 가나 ──');
for (const k of ['보이기', '보류함', '버림']) {
  console.log('  ' + k.padEnd(6) + String(통[k].length).padStart(4) + '건');
}

for (const k of ['보이기', '보류함']) {
  console.log('\n── ' + k + ' 제목 ' + Math.min(10, 통[k].length) + '개 ──');
  for (const v of 통[k].slice(0, 10)) {
    console.log('  · ' + String(v.기관).slice(0, 16).padEnd(18)
      + String(v.제목).slice(0, 40).padEnd(42)
      + (v.직군 || '') + (k === '보류함' ? '  ← ' + v.왜.slice(0, 40) : ''));
  }
}

/* ★ 세중님이 꼭 보라고 하신 것 — 시설 설명이 보이기로 가지 않나 */
console.log('\n★ 시설 설명으로 읽힐 만한 제목이 「보이기」에 있나');
const 시설말 = /(치료실|치료팀|치료센터|치료과|치료부)/;
const 걸림 = 통.보이기.filter((v) => 시설말.test(String(v.제목)));
if (!걸림.length) console.log('  없습니다');
else for (const v of 걸림) console.log('  ⚠ ' + String(v.제목).slice(0, 56));
