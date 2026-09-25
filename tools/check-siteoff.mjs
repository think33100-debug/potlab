/* 끄고 켜는 규칙을 시험합니다 — node tools/check-siteoff.mjs
 *
 * ── 왜 gas/wage.js 를 읽어 오나 ───────────────────────────────
 * 규칙을 여기 한 벌 더 베껴 두면, gas 쪽을 고쳤을 때 이 시험은 옛 규칙을
 * 통과시킵니다. 그래서 **원본에서 함수를 떼어 와** 돌립니다.
 * 규칙이 한 벌이라 어긋날 수가 없습니다.
 *
 * gas/wage.js 는 저장소 밖(.gitignore)이라 없을 수 있습니다 — 그러면 건너뜁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'gas', 'wage.js');
if (!fs.existsSync(SRC)) {
  console.log('gas/wage.js 가 없어 건너뜁니다 (저장소 밖 파일입니다)');
  process.exit(0);
}
const 원본 = fs.readFileSync(SRC, 'utf8');

/* 함수 하나를 중괄호 짝으로 떼어 옵니다 */
function 떼기(이름) {
  const i = 원본.indexOf('function ' + 이름 + '(');
  if (i < 0) { console.error('✗ ' + 이름 + ' 을 gas/wage.js 에서 못 찾았습니다'); process.exit(1); }
  let 깊이 = 0;
  for (let k = 원본.indexOf('{', i); k < 원본.length; k++) {
    if (원본[k] === '{') 깊이++;
    else if (원본[k] === '}' && --깊이 === 0) return 원본.slice(i, k + 1);
  }
  console.error('✗ ' + 이름 + ' 의 끝을 못 찾았습니다'); process.exit(1);
}
const 상수 = (원본.match(/^const SITE_OFF_AFTER = \d+;/m) || [])[0];
if (!상수) { console.error('✗ SITE_OFF_AFTER 를 못 찾았습니다'); process.exit(1); }

const { siteOffWhy_, siteFail_, siteOk_, SITE_OFF_AFTER } = new Function(
  상수 + '\n' + ['siteOffWhy_', 'siteFail_', 'siteOk_'].map(떼기).join('\n')
  + '\nreturn { siteOffWhy_, siteFail_, siteOk_, SITE_OFF_AFTER };')();

let 틀림 = 0;
const 맞나 = (이름, 본것, 바란것) => {
  const ok = String(본것) === String(바란것);
  if (!ok) { 틀림++; console.log(`  ✗ ${이름}\n      본 것  「${본것}」\n      바란 것「${바란것}」`); }
  else console.log(`  ○ ${이름}`);
};
const 새상태 = () => ({});
const 병원 = { name: '어느병원', url: 'https://x.kr/jobs' };

console.log(`끄고 켜는 규칙 — SITE_OFF_AFTER = ${SITE_OFF_AFTER}\n`);

console.log('━━ 한 번 못 받았다고 끄지 않습니다');
{
  const m = 새상태();
  siteFail_(m, 병원, '타임아웃', '2026-09-25');
  맞나('1번 실패 — 아직 켜져 있음', siteOffWhy_(병원, m[병원.name]), '');
  맞나('1번 실패 — 연속 셈 1', m[병원.name].fail, 1);
  siteFail_(m, 병원, '타임아웃', '2026-09-26');
  맞나('2번 실패 — 아직 켜져 있음', siteOffWhy_(병원, m[병원.name]), '');
  siteFail_(m, 병원, '타임아웃', '2026-09-27');
  맞나('3번 실패 — 꺼짐', siteOffWhy_(병원, m[병원.name]) !== '', true);
  맞나('3번 실패 — 끈 날이 남음', m[병원.name].offDay, '2026-09-27');
  맞나('3번 실패 — 끈 이유가 남음', /타임아웃/.test(m[병원.name].offWhy), true);
}

console.log('\n━━ 사이에 한 번이라도 받아지면 셈이 0 으로');
{
  const m = 새상태();
  siteFail_(m, 병원, 'HTTP 503', '2026-09-25');
  siteFail_(m, 병원, 'HTTP 503', '2026-09-26');
  siteOk_(m, 병원, '2026-09-27');
  맞나('두 번 실패 뒤 성공 — 셈 0', m[병원.name].fail, 0);
  siteFail_(m, 병원, 'HTTP 503', '2026-09-28');
  맞나('그 뒤 한 번 더 실패해도 켜져 있음', siteOffWhy_(병원, m[병원.name]), '');
}

console.log('\n━━ 다시 열리면 켭니다');
{
  const m = 새상태();
  for (let i = 0; i < SITE_OFF_AFTER; i++) siteFail_(m, 병원, '못 엶', '2026-09-25');
  맞나('꺼진 상태', m[병원.name].auto, 'N');
  siteOk_(m, 병원, '2026-10-02');
  맞나('다시 받아짐 — 켜짐', siteOffWhy_(병원, m[병원.name]), '');
  맞나('켠 날이 남음', m[병원.name].onDay, '2026-10-02');
  맞나('자동 칸이 Y', m[병원.name].auto, 'Y');
}

console.log('\n━━ HOSP_SITES 의 off 와 상태표가 만나는 자리');
{
  const 꺼둔곳 = { name: '손으로꺼둔병원', url: 'https://y.kr', off: '구글 서버에서 못 엶 2026-09-17' };
  맞나('상태표에 아무 말 없으면 off 를 따름',
    siteOffWhy_(꺼둔곳, undefined), '구글 서버에서 못 엶 2026-09-17');
  맞나('상태표가 Y 면 off 가 적혀 있어도 켜짐',
    siteOffWhy_(꺼둔곳, { auto: 'Y' }), '');
  맞나('상태표가 N 이면 상태표의 이유를 보여줌',
    siteOffWhy_({ name: 'z', url: '' }, { auto: 'N', offWhy: '3번 연속 못 받음 · 타임아웃' }),
    '3번 연속 못 받음 · 타임아웃');
}

console.log('\n━━ 이미 꺼진 곳은 또 끄지 않습니다');
{
  const m = 새상태();
  for (let i = 0; i < SITE_OFF_AFTER; i++) siteFail_(m, 병원, '못 엶', '2026-09-25');
  const 끈날 = m[병원.name].offDay;
  siteFail_(m, 병원, '또 못 엶', '2026-10-09');
  맞나('끈 날이 안 바뀜', m[병원.name].offDay, 끈날);
}

console.log('');
if (틀림) { console.log(`✗ ${틀림}칸이 틀렸습니다`); process.exit(1); }
console.log('○ 전부 맞습니다');
