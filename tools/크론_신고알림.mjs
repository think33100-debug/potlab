/* 신고 알림을 **5분마다** 돌리는 크론 줄 (2026-10-28 세중님 2번 「서버 도구로 5분 폴링이면 바로」)
 *
 *   node tools/크론_신고알림.mjs            봅니다 (더할 줄을 찍기만)
 *   node tools/크론_신고알림.mjs --진짜      크론에 더합니다 (백업 먼저)
 *   node tools/크론_신고알림.mjs --되돌림     그 줄을 뺍니다
 *
 * ── 왜 크론인가 ─────────────────────────────────────────────
 * 세중님이 **트리거·DB 함수는 승인 자리**, **서버 도구 5분 폴링은 바로**라고 정하셨습니다.
 * 폴링은 「돌려 주는 것」이 있어야 폴링입니다 — 그래서 크론 줄 **한 줄**을 더합니다.
 *
 * ── 울타리 ──────────────────────────────────────────────────
 *   flock    겹쳐 돌지 않게 (5분마다라 지난 바퀴가 남아 있을 수 있습니다)
 *   timeout  120초 — 메일 보내기까지 넉넉합니다
 *   로그     ~/log/신고알림.log
 * ★ 크론 줄을 **통째로 갈아끼우지 않습니다** — 줄 하나를 **맨 끝에 더합니다** (지침 8-15)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 되돌림모드 = argv.includes('--되돌림');

export const 더할주석 = [
  '# ── 커뮤니티 신고 즉시 알림 (2026-10-28 세중님 2번) ─────────────────────',
  '#   신고가 들어오면 **5분 안에** 메일 한 통 (글 제목·방·사유·관리자 화면 주소).',
  '#   트리거·DB 함수가 아니라 **서버 도구가 묻습니다** — DB 에 아무것도 안 씁니다.',
  '#   어디까지 봤나는 ~/potlab/log/신고알림_본것.json · 메일이 실패하면 다음 바퀴에 다시.',
  '#   끄는 법 — node tools/크론_신고알림.mjs --되돌림',
].join('\n');
export const 더할줄 = '*/5 * * * *   cd /home/ubuntu/potlab && set -a && . ./.env && set +a'
  + ' && flock -n /tmp/potjob_report_alert.lock timeout -k 30 120'
  + ' /usr/bin/node tools/신고알림.mjs >> /home/ubuntu/log/신고알림.log 2>&1';

export function 더하기(크론글) {
  if (크론글.includes('tools/신고알림.mjs')) return { 글: 크론글, 몇: 0 };
  return { 글: 크론글.replace(/\s*$/, '') + '\n' + 더할주석 + '\n' + 더할줄 + '\n', 몇: 1 };
}
export function 빼기(크론글) {
  const 줄들 = 크론글.split('\n');
  const 남길것 = [];
  let 몇 = 0;
  for (const l of 줄들) {
    if (l.includes('tools/신고알림.mjs')) { 몇++; continue; }
    if (더할주석.split('\n').includes(l)) continue;
    남길것.push(l);
  }
  return { 글: 남길것.join('\n'), 몇 };
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = '0 5 * * *   cd /x && node tools/작업나무점검.mjs\n';
  const 더한것 = 더하기(본);
  보('한 줄 더한다', 더한것.몇 === 1);
  보('옛 줄은 그대로', 더한것.글.includes('tools/작업나무점검.mjs'));
  보('5분마다', /^\*\/5 \* \* \* \*/m.test(더한것.글));
  보('flock 이 있다', 더한것.글.includes('flock -n /tmp/potjob_report_alert.lock'));
  보('두 번 더하지 않는다', 더하기(더한것.글).몇 === 0);
  보('되돌리면 본래 글', 빼기(더한것.글).글.replace(/\n+$/, '') === 본.replace(/\n+$/, ''));
  보('되돌림이 줄 수를 센다', 빼기(더한것.글).몇 === 1);
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
const 결과 = 되돌림모드 ? 빼기(글) : 더하기(글);
console.log((되돌림모드 ? '뺄' : '더할') + ' 줄 — ' + 결과.몇 + '개');
if (!되돌림모드) console.log('\n' + 더할주석 + '\n' + 더할줄);

if (!진짜 && !되돌림모드) { console.log('\n[마른] 안 바꿨습니다 — --진짜 로 더합니다'); process.exit(0); }
if (!결과.몇) { console.log('\n바꿀 것이 없습니다'); process.exit(0); }

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 백업 = path.join(os.homedir(), '크론백업_' + 때 + '.txt');
fs.writeFileSync(백업, 글, 'utf8');
console.log('\n백업 — ' + 백업 + ' (' + 전줄 + '줄)');
const 넣기 = spawnSync('crontab', ['-'], { input: 결과.글, encoding: 'utf8' });
if (넣기.status) { console.error('✗ crontab - 실패\n' + (넣기.stderr || '')); process.exit(1); }
const 후 = spawnSync('crontab', ['-l'], { encoding: 'utf8' }).stdout;
console.log('○ 바꿨습니다 — 줄 수 전 ' + 전줄 + ' · 후 ' + 후.split('\n').length);
console.log('도는 줄 — ' + 후.split('\n').filter((l) => l.trim() && !l.trimStart().startsWith('#')).length + '개');
console.log('되돌리는 법 — node tools/크론_신고알림.mjs --되돌림');
