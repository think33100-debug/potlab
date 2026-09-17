/* propSaveMap_ 이 9KB 한도를 지키는지 확인합니다.
 *
 *   node tools/prop_test.js
 *
 * gas/wage.js 에서 함수만 떼어 내 흉내 낸 PropertiesService 로 돌립니다.
 * 진짜 Apps Script 가 아니므로 「이 조건에서는 통과했다」 까지만 말합니다.
 * gas/ 는 저장소에 없으니(.gitignore) 없으면 그냥 건너뜁니다.
 *
 * 2026-09-18 — job3_done 이 11,160자까지 불어나 저장이 안 되고 있었는데
 * try/catch 가 조용히 삼켜서 몰랐습니다. 그 재발을 막는 시험입니다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const W = path.join(__dirname, '..', 'gas', 'wage.js');
if (!fs.existsSync(W)) { console.log('gas/wage.js 가 없어 건너뜁니다.'); process.exit(0); }

const src = fs.readFileSync(W, 'utf8');
const body = src.slice(src.indexOf('const PROP_MAX'), src.indexOf('/* 지금 job3_done 을 한 번 잘라둡니다'));
if (!body) { console.error('propSaveMap_ 을 못 찾았습니다'); process.exit(1); }

const LIMIT = 9216;
let stored = null, logs = [], mails = 0;
const fakeProps = {
  getScriptProperties: () => ({
    setProperty: (k, v) => {
      if (v.length > LIMIT) throw new Error('Argument too large: value');   // 구글이 던지는 모양
      stored = v;
    }
  })
};
const save = new Function('PropertiesService', 'Logger', 'MailApp', 'NOTIFY_EMAIL',
  body + '; return propSaveMap_;')(
  fakeProps, { log: (m) => logs.push(String(m)) }, { sendEmail: () => { mails++; } }, 'x');

let bad = 0;
function check(label, got, want) {
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (ok ? '' : '  (' + got + ' · 바라던 것 ' + want + ')'));
}
function run(label, map, keepMax) {
  stored = null; logs = []; mails = 0;
  const r = save('t', map, keepMax);
  console.log(label + ' — ' + r.before + '칸 → ' + r.kept + '칸 · ' + r.size + '자');
  return r;
}

/* ① 자르는 칸: 한도 안에 들어가고, 번호가 큰 것(최신)이 남아야 합니다 */
const many = {};
for (let i = 0; i < 1000; i++) many[String(1200000 + i * 3)] = 1;
let r = run('① job3_done 1,000칸', many, 600);
check('한도 안', r.size <= LIMIT, true);
check('저장됨', r.saved, true);
check('600칸만 남음', r.kept, 600);
const nums = Object.keys(JSON.parse(stored)).map(Number);
check('가장 최신 번호가 남음', Math.max.apply(null, nums), 1202997);
check('오래된 번호는 버려짐', Math.min.apply(null, nums) > 1200000, true);

/* ② 열쇠가 길어지면 600칸을 못 담습니다 — 조용히 넘어가지 말고 알려야 합니다 */
const longk = {};
for (let i = 0; i < 1000; i++) longk[String(1200000000000 + i * 3)] = 1;
r = run('② 열쇠가 13자리', longk, 600);
check('한도 안', r.size <= LIMIT, true);
check('600칸을 못 담았다고 알림', logs.some((l) => l.indexOf('달라던 600칸') > -1), true);

/* ③ 안 자르는 칸(hs_cnt)은 몰래 줄어들면 안 됩니다 */
const c288 = {};
for (let i = 0; i < 288; i++) c288[String(-2000000000 + i * 137)] = 38;
r = run('③ hs_cnt 288곳', c288, 0);
check('한 칸도 안 줄어듦', r.kept, 288);
check('저장됨', r.saved, true);
check('조용함', logs.length, 0);

/* ④ 안 자르는 칸이 한도를 넘으면 — 몰래 버리지 말고 실패를 크게 알려야 합니다 */
const c700 = {};
for (let i = 0; i < 700; i++) c700[String(-2000000000 + i * 137)] = 38;
r = run('④ hs_cnt 700곳', c700, 0);
check('한 칸도 안 버림', r.kept, 700);
check('저장 실패로 알림', r.saved, false);
check('로그에 크게 찍힘', logs.some((l) => l.indexOf('속성 저장 실패') > -1), true);
check('메일로도 알림', mails, 1);

console.log(bad ? '\n어긋난 것 ' + bad + '개' : '\n다 통과했습니다.');
process.exit(bad ? 1 : 0);
