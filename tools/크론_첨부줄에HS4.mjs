/* ㉧ 첨부줄 크론 줄에 **HS4 첨부 되메우기** 한 걸음을 더합니다 (2026-10-25 세중님 2번 승인)
 *
 *   node tools/크론_첨부줄에HS4.mjs            봅니다 (전후 줄을 찍기만)
 *   node tools/크론_첨부줄에HS4.mjs --진짜      크론을 바꿉니다 (백업 먼저)
 *   node tools/크론_첨부줄에HS4.mjs --되돌림     더한 걸음을 뺍니다
 *
 * ── 왜 이렇게 ───────────────────────────────────────────────
 * 크론 줄을 **통째로 갈아끼우지 않습니다** (지침 8-15) — 그 줄 안에서 `bash -c '…'` 의
 * 마지막 명령 뒤에 **한 걸음만** 붙입니다. 다른 글자·flock·timeout·환경값은 그대로입니다.
 * ★ 백업은 `~/크론백업_<날짜>.txt` 이고, 되돌림은 `--되돌림` 한 번입니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 되돌림 = argv.includes('--되돌림');

/** 더할 걸음 — 22:40 HS4 크론에서 쓰는 것과 **같은 값**입니다 */
export const 더할걸음 = "; POTJOB_PARSE_MAX=100000 POTJOB_BODY_WRITE=1 /usr/bin/node tools/첨부되메우기.mjs --진짜 --출처 HS4 --몇개 40";
export const 찾을글 = 'node tools/병원첨부채우기.mjs';

/** 크론 글에서 첨부줄 줄을 찾아 걸음을 더합니다 (한 줄만 · 한 번만) */
export function 더하기(크론글) {
  const 줄들 = 크론글.split('\n');
  let 몇 = 0;
  const 새줄들 = 줄들.map((l) => {
    if (!l.includes(찾을글) || l.trimStart().startsWith('#')) return l;
    if (l.includes('--출처 HS4')) return l;            /* 이미 있습니다 */
    /* `bash -c '…'` 의 **마지막 작은따옴표 앞**에 붙입니다 */
    const 끝 = l.lastIndexOf("'");
    if (끝 < 0) return l;
    몇++;
    return l.slice(0, 끝) + 더할걸음 + l.slice(끝);
  });
  return { 글: 새줄들.join('\n'), 몇 };
}
export function 빼기(크론글) {
  let 몇 = 0;
  const 글 = 크론글.split('\n').map((l) => {
    if (!l.includes(더할걸음)) return l;
    몇++;
    return l.split(더할걸음).join('');
  }).join('\n');
  return { 글, 몇 };
}

if (argv.includes('--자기점검')) {
  const 본 = `30 5,15 * * *   cd /x && flock -n /l timeout 2100 env A=1 bash -c 'node tools/알리오첨부채우기.mjs --진짜; node tools/병원첨부채우기.mjs --진짜 --몇개 40' >> /log 2>&1`;
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 더한것 = 더하기(본);
  보('한 줄만 고친다', 더한것.몇 === 1);
  보('마지막 따옴표 앞에 붙는다', 더한것.글.includes("--몇개 40" + 더할걸음 + "'"));
  보('두 번 더하지 않는다', 더하기(더한것.글).몇 === 0);
  보('되돌리면 본래 글', 빼기(더한것.글).글 === 본);
  보('주석 줄은 안 고친다', 더하기('# node tools/병원첨부채우기.mjs 어쩌고').몇 === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 지금 = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
if (지금.status) { console.error('✗ crontab -l 못 읽었습니다'); process.exit(1); }
const 글 = 지금.stdout;
const 전줄 = 글.split('\n').length;
const 결과 = 되돌림 ? 빼기(글) : 더하기(글);
console.log((되돌림 ? '뺄' : '더할') + ' 줄 — ' + 결과.몇 + '개');
const 본줄 = 글.split('\n').filter((l) => l.includes(찾을글) && !l.trimStart().startsWith('#'));
for (const l of 본줄) console.log('\n전 ──\n' + l);
const 새줄 = 결과.글.split('\n').filter((l) => l.includes(찾을글) && !l.trimStart().startsWith('#'));
for (const l of 새줄) console.log('\n후 ──\n' + l);
if (!진짜 && !되돌림) { console.log('\n[마른] 안 바꿨습니다 — --진짜 로 바꿉니다'); process.exit(0); }
if (!결과.몇) { console.log('\n바꿀 것이 없습니다'); process.exit(0); }

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 백업 = path.join(os.homedir(), '크론백업_' + 때 + '.txt');
fs.writeFileSync(백업, 글, 'utf8');
console.log('\n백업 — ' + 백업 + ' (' + 전줄 + '줄)');
const 넣기 = spawnSync('crontab', ['-'], { input: 결과.글, encoding: 'utf8' });
if (넣기.status) { console.error('✗ crontab - 실패\n' + (넣기.stderr || '')); process.exit(1); }
const 후 = spawnSync('crontab', ['-l'], { encoding: 'utf8' }).stdout;
console.log('○ 바꿨습니다 — 줄 수 전 ' + 전줄 + ' · 후 ' + 후.split('\n').length
  + ' (줄 수는 **그대로**여야 합니다 — 줄 안에만 붙였습니다)');
console.log('되돌리는 법 — node tools/크론_첨부줄에HS4.mjs --되돌림');
