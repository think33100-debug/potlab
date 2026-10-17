// 열쇠가 git 기록에 한 번이라도 커밋됐는지 — 값은 절대 출력하지 않고 「있음/없음 · 커밋 해시」만.
// 사용: node tools/key_leak_check.js
const { execFileSync } = require('child_process');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../gas/wage.js', 'utf8');

/* 값을 코드에서 집어옵니다 — 화면에 안 찍습니다 */
function valueOf(name) {
  const m = src.match(new RegExp('^const ' + name + "\\s*=\\s*'([^']+)'", 'm'));
  return m ? m[1] : null;
}
function adminKey() {
  /* ADMIN_KEY 는 즉시실행 함수라 따로 — 안에 박힌 첫 문자열을 집습니다 */
  const i = src.indexOf('const ADMIN_KEY = (function ()');
  if (i < 0) return null;
  const m = src.slice(i, i + 400).match(/'([^']{3,})'/);
  return m ? m[1] : null;
}

const targets = [
  ['NEWKEY', valueOf('NEWKEY')],
  ['RKEY', valueOf('RKEY')],
  ['ADMIN_KEY', adminKey()],
  ['WEBAPP_URL', valueOf('WEBAPP_URL')],
];

function git(args) {
  try { return execFileSync('git', args, { cwd: __dirname + '/..', encoding: 'utf8' }).trim(); }
  catch (e) { return ''; }
}

console.log('=== gas/ 폴더가 커밋된 적 있나 ===');
const gasLog = git(['log', '--all', '--oneline', '--', 'gas/']);
console.log(gasLog ? gasLog.split('\n').slice(0, 20).join('\n') : '없음 — gas/ 는 한 번도 커밋된 적 없음');

console.log('\n=== 열쇠 값이 기록 어디엔가 들어갔나 (값 출력 안 함) ===');
for (const [name, val] of targets) {
  if (!val) { console.log(`${name}  — 코드에서 값을 못 찾음 (건너뜀)`); continue; }
  if (val.length < 4) { console.log(`${name}  — 값이 ${val.length}자라 검색이 무의미 (건너뜀 · 짧은 값은 오탐)`); continue; }
  const hits = git(['log', '--all', '--format=%h', '-S', val]);
  const list = hits ? hits.split('\n').filter(Boolean) : [];
  console.log(`${name}  길이 ${val.length}자  →  ${list.length ? '★ 있음 · 커밋 ' + list.join(' ') : '없음'}`);
}

console.log('\n=== 지금 작업 트리에 추적 중인 파일로 들어가 있나 ===');
for (const [name, val] of targets) {
  if (!val || val.length < 8) continue;
  const g = git(['grep', '-l', '-F', val]);
  console.log(`${name}  →  ${g ? '★ ' + g.split('\n').join(', ') : '없음'}`);
}
