/* 가리는 규칙이 틀어졌는지 보는 검사 한 벌 (2026-09-25).

   왜 있나 — 2026-09-25 에 **회원에게 「가입하고 전부 보기」 가 떴습니다.**
   화면을 눌러서만 확인하면 「회원인데 설문 전」 같은 칸을 빠뜨립니다.
   여섯 칸을 전부 적어두고 한 번에 봅니다.

   돌리는 법 —  node tools/check-gate.mjs
   깨지면 0 이 아닌 값으로 끝나니 그대로 CI 에 걸어도 됩니다.

   ※ app/gate.tsx 의 gateOf 를 그대로 베낍니다. TypeScript 라 여기서 바로
     못 부릅니다. **둘이 어긋나지 않게, 아래에서 원문을 읽어 대조합니다.** */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* app/gate.tsx 의 gateOf 와 같은 규칙 */
const gateOf = (who, 설문) => ({
  모름: who === '모름' || 설문 === '모름',
  full: 설문 === '마침',
  회원: who === '회원',
  href: who === '회원' ? '/welcome' : '/login',
});

/* 벽에 무엇을 그리나. app/gate.tsx 의 JoinCta · components/job-veil.tsx 와 같은 규칙 */
const 벽 = (who, 설문) => {
  const g = gateOf(who, 설문);
  if (g.모름) return '자리 비움';
  if (g.full) return '전부 보임';
  return g.회원 ? '설문 권유 → /welcome' : '가입 권유 → /login';
};

/* ── 여섯 칸. 하나라도 빠지면 그게 사고 난 자리입니다 ────────── */
const 표 = [
  ['회원',   '마침',   '전부 보임'],
  ['회원',   '안마침', '설문 권유 → /welcome'],
  ['회원',   '모름',   '자리 비움'],        // profiles 를 못 읽음 — 2026-09-25 의 그 버그
  ['비회원', '안마침', '가입 권유 → /login'],
  ['비회원', '모름',   '자리 비움'],
  ['모름',   '모름',   '자리 비움'],        // 확인 중
];

let 틀림 = 0;
for (const [who, 설문, 바람] of 표) {
  const 실제 = 벽(who, 설문);
  const ok = 실제 === 바람;
  if (!ok) 틀림 += 1;
  console.log(`  ${ok ? '○' : '✗'}  ${who.padEnd(4)} · 설문 ${설문.padEnd(4)}  →  ${실제}`);
}

/* 베낀 규칙이 원문과 어긋나지 않았는지. 두 벌이 되는 순간 이 검사는 거짓말이 됩니다 */
const 원문 = readFileSync(new URL('../app/gate.tsx', import.meta.url), 'utf8');
for (const 줄 of [
  "모름: who === '모름' || 설문 === '모름',",
  "full: 설문 === '마침',",
  "회원: who === '회원',",
  "href: who === '회원' ? '/welcome' : '/login',",
]) {
  if (!원문.includes(줄)) {
    console.log(`  ✗  app/gate.tsx 의 gateOf 가 바뀌었습니다 — 이 검사도 같이 고치세요:\n       ${줄}`);
    틀림 += 1;
  }
}

/* 회원에게 가입 권유가 가는 길이 정말 없는지 한 번 더 */
assert.notEqual(벽('회원', '모름'), '가입 권유 → /login', '회원에게 가입 권유가 갑니다');
assert.notEqual(벽('회원', '안마침'), '가입 권유 → /login', '회원에게 가입 권유가 갑니다');

console.log(틀림 ? `\n  ${틀림}곳이 틀립니다` : '\n  여섯 칸 다 맞습니다');
process.exit(틀림 ? 1 : 0);
