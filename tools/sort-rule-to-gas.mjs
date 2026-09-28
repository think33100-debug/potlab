/* tools/sort-rule.mjs 의 갈래 규칙을 gas/wage.js 안에 **구워 넣습니다** (2026-09-28).
 *
 *   node tools/sort-rule-to-gas.mjs          구워 넣습니다
 *   node tools/sort-rule-to-gas.mjs --검사    같은지 보기만 합니다 (다르면 실패)
 *
 * ── 왜 이 방향인가 ───────────────────────────────────────────
 * 지금까지는 gas → node 한 방향이었습니다 (`tools/gas-rules.mjs` 가 gas 에서
 * 떼어 옵니다). 그런데 **갈래 규칙은 sort-rule 쪽이 조심스럽고 시험도 붙어
 * 있습니다.** 세중님이 「조심하는 쪽으로 통일」 하라고 정하셨습니다.
 * 그래서 갈래 규칙만 반대 방향으로 굽습니다.
 *
 *   직군 낱말 (matchJob_ · NOT_OURS · HS_OTHER_RE …)  gas → node   (gas-rules.mjs)
 *   갈래 규칙 (sortJob · 버림단어 · 보류보장단어 …)     node → gas   (이 파일)
 *
 * ── 왜 베끼지 않고 굽나 ──────────────────────────────────────
 * 940건 중 550건(58%)이 갈라져 있었습니다. 손으로 두 벌을 맞추면
 * 한쪽만 고치고 나머지를 빼먹습니다 — 이 저장소에서 여러 번 있었던 일입니다.
 * 구워 넣고, `node tools/sort-rule-to-gas.mjs --검사` 가 다르면 실패합니다.
 *
 * ── gas 에 들어가는 것 ───────────────────────────────────────
 * 표시 줄 사이만 바뀝니다. 그 밖은 건드리지 않습니다 —
 *   // ==== 여기부터 tools/sort-rule.mjs 에서 구워집니다 (손으로 고치지 마세요) ====
 *   …
 *   // ==== 여기까지 ====
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 확정단어, 보류보장단어, 받기예외, 버림단어 } from './sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const GAS = path.join(여기, '..', 'gas', 'wage.js');
const 시작 = '/* ==== 여기부터 tools/sort-rule.mjs 에서 구워집니다 (손으로 고치지 마세요) ==== */';
const 끝 = '/* ==== 여기까지 ==== */';

/** sort-rule.mjs 에서 함수 본문을 떼어 옵니다 — 베끼지 않습니다 */
function 떼기(이름) {
  const src = fs.readFileSync(path.join(여기, 'sort-rule.mjs'), 'utf8');
  const i = src.indexOf('export function ' + 이름 + '(');
  if (i < 0) throw new Error('sort-rule.mjs 에서 ' + 이름 + ' 을 못 찾았습니다');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1).replace(/^export /, '');
  }
  throw new Error(이름 + ' 의 끝을 못 찾았습니다');
}

/* ⚠ 자바스크립트의 `\b` 는 **한글 경계에서 안 먹습니다** (한글은 \w 가 아닙니다).
   처음엔 `/\b확정단어\b/g` 로 이름을 바꾸려 했는데 **하나도 안 바뀌었고**,
   구운 코드가 `붙이기 is not defined` 로 죽었습니다 (2026-09-28).
   그래서 낱말 경계 없이 통째로 바꾸고, 긴 이름을 먼저 바꿉니다
   (「확정단어」 를 먼저 바꿔야 「확정」 이 안 깨집니다). */
function 이름바꾸기(글, 짝들) {
  let t = 글;
  for (const [옛, 새] of [...짝들].sort((a, b) => b[0].length - a[0].length)) {
    t = t.split(옛).join(새);
  }
  return t;
}

export function 만들기() {
  const J = (v) => JSON.stringify(v, null, 0);
  /* 5단계(첨부)는 굽지 않습니다 — gas 는 첨부를 sortJob_ 으로 안 가립니다.
     굽는 것은 **제목으로 갈래를 정하는 부분**뿐입니다 */
  const 본문 = 떼기('sortJob').replace(/\n  \/\* ⓪-2[\s\S]*?if \(다섯\) return 다섯;\n/, '\n');
  return [
    시작,
    '/* 고치려면 tools/sort-rule.mjs 를 고치고 `node tools/sort-rule-to-gas.mjs` 를 돌리세요.',
    '   여기서 고치면 다음에 구울 때 날아갑니다. `node tools/check.js` 가 다르면 잡습니다. */',
    'const SR_확정단어 = ' + J(확정단어) + ';',
    'const SR_보류보장단어 = ' + J(보류보장단어) + ';',
    'const SR_받기예외 = ' + J(받기예외) + ';',
    'const SR_버림단어 = ' + J(버림단어) + ';',
    '',
    이름바꾸기(떼기('여럿나열'), [['function 여럿나열(', 'function SR_여럿나열(']]),
    '',
    이름바꾸기(본문, [
      ['function sortJob(', 'function SR_갈래('],
      ['확정단어', 'SR_확정단어'],
      ['보류보장단어', 'SR_보류보장단어'],
      ['받기예외', 'SR_받기예외'],
      ['버림단어', 'SR_버림단어'],
      ['여럿나열(', 'SR_여럿나열('],
      ['붙이기(', 'SR_붙이기('],
    ]),
    '',
    'function SR_붙이기(s) { return String(s || "").replace(/\\s+/g, ""); }',
    끝,
  ].join('\n');
}

/* ── 본체 ── */
const 검사만 = process.argv.includes('--검사');
const 새것 = 만들기();
let gas = fs.readFileSync(GAS, 'utf8');
const a = gas.indexOf(시작), b = gas.indexOf(끝);

if (a < 0 || b < 0) {
  if (검사만) { console.error('✗ gas 에 구운 자리가 없습니다 — node tools/sort-rule-to-gas.mjs 를 돌리세요'); process.exit(1); }
  /* 처음이면 hospVerdict_ 앞에 넣습니다 */
  const 자리 = gas.indexOf('function hospVerdict_(');
  if (자리 < 0) { console.error('✗ hospVerdict_ 를 못 찾았습니다'); process.exit(1); }
  gas = gas.slice(0, 자리) + 새것 + '\n\n' + gas.slice(자리);
  fs.writeFileSync(GAS, gas);
  console.log('처음으로 구워 넣었습니다 · ' + 새것.length + '자');
  process.exit(0);
}

const 옛것 = gas.slice(a, b + 끝.length);
if (옛것 === 새것) { console.log('○ gas 의 갈래 규칙이 sort-rule 과 같습니다 (' + 새것.length + '자)'); process.exit(0); }
if (검사만) {
  console.error('✗ gas 의 갈래 규칙이 sort-rule 과 다릅니다 ('
    + 옛것.length + '자 ↔ ' + 새것.length + '자)');
  console.error('   node tools/sort-rule-to-gas.mjs 를 돌려 다시 구우세요');
  process.exit(1);
}
fs.writeFileSync(GAS, gas.slice(0, a) + 새것 + gas.slice(b + 끝.length));
console.log('다시 구웠습니다 · ' + 옛것.length + '자 → ' + 새것.length + '자');
