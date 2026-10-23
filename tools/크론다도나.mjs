/* 크론 줄이 **다 돌고 있나** — 줄마다 「지난 예정 시각」과 로그 시각을 견줍니다
 *
 *   node tools/크론다도나.mjs            표 (서버에서 돌립니다)
 *   node tools/크론다도나.mjs --늦은것만   안 돈 것만
 *   node tools/크론다도나.mjs --자기점검   크론 때 셈만 (서버 없이)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 「크론 줄 다 도나」를 아침마다 한 줄 적는 것이 동결까지 할 일인데
 * (docs/동결까지_남은일_1023.md 2절) **도구가 없어 손으로** 봤습니다.
 * 손으로 보면 줄이 156줄이라 빠뜨립니다 — 2026-10-12 에 `~/수집크론.sh` 의
 * **실행 권한이 빠져** 한 번도 안 돌았는데 5시간 7분 몰랐던 일이 그 꼴입니다
 * (지침 8-15 — 「로그가 안 쌓이는 것이 유일한 신호인 때가 있습니다」).
 *
 * ── 어떻게 ───────────────────────────────────────────────────
 * 크론 꼴을 거꾸로 훑어 **지난 예정 시각**을 찾고, 그 줄이 쓰는 로그 파일의
 * `mtime` 과 견줍니다. 로그가 그보다 오래됐으면 **그 바퀴가 안 돈 것**입니다.
 *
 *   로그 시각 >= 지난 예정 시각        ○ 돌았습니다
 *   로그 시각 <  지난 예정 시각        ✗ 안 돌았습니다 (또는 로그를 안 씁니다)
 *   로그 줄이 없음 (`>>` 가 없음)      — 볼 수 없습니다 (표에 그대로 적습니다)
 *
 * ★ 로그를 **여러 줄이 함께 쓰면** 가장 자주 도는 줄이 시각을 올려 줍니다.
 *   그래서 같은 로그를 쓰는 줄이 둘 이상이면 표에 「함께 씀」으로 적고,
 *   「안 돌았다」로 단정하지 않습니다 (지침 10절 — 확인 없이 단정하지 않기).
 * ★ 주석(#)과 빈 줄, `환경변수=값` 줄은 셈에서 뺍니다.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 늦은것만 = argv.includes('--늦은것만');
const 자기점검만 = argv.includes('--자기점검');

/* ── 크론 한 칸 풀기 — 별표 · 별표나누기걸음 · `a,b` · `a-b` 섞인 꼴 ── */
export function 칸풀기(칸, 밑, 위) {
  const 값 = new Set();
  for (const 토막 of String(칸).split(',')) {
    const m = 토막.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/);
    if (!m) throw new Error('모르는 크론 칸 — ' + 칸);
    const 걸음 = m[2] ? Number(m[2]) : 1;
    if (걸음 < 1) throw new Error('걸음이 0 — ' + 칸);
    let a; let b;
    if (m[1] === '*') { a = 밑; b = 위; }
    else if (m[1].includes('-')) { [a, b] = m[1].split('-').map(Number); }
    else { a = Number(m[1]); b = m[2] ? 위 : a; }
    if (a < 밑 || b > 위 || a > b) throw new Error('칸이 범위를 벗어남 — ' + 칸);
    for (let v = a; v <= b; v += 걸음) 값.add(v);
  }
  return 값;
}

/** 크론 꼴 다섯 칸을 풀어 「이 때가 예정인가」를 묻는 함수로 ── */
export function 꼴풀기(꼴) {
  const 칸 = String(꼴).trim().split(/\s+/);
  if (칸.length !== 5) throw new Error('다섯 칸이 아닙니다 — ' + 꼴);
  const 분 = 칸풀기(칸[0], 0, 59);
  const 시 = 칸풀기(칸[1], 0, 23);
  const 일 = 칸풀기(칸[2], 1, 31);
  const 달 = 칸풀기(칸[3], 1, 12);
  /* 7 은 일요일입니다 — 0 으로 맞춥니다 */
  const 요일0 = 칸풀기(칸[4], 0, 7);
  const 요일 = new Set([...요일0].map((v) => (v === 7 ? 0 : v)));
  /* ★ 크론 규칙 — 일(day-of-month)과 요일이 **둘 다 `*` 가 아니면 OR** 입니다 */
  const 일별표 = 칸[2] !== '*';
  const 요일별표 = 칸[4] !== '*';
  return (d) => {
    if (!분.has(d.getMinutes()) || !시.has(d.getHours()) || !달.has(d.getMonth() + 1)) return false;
    const 일맞 = 일.has(d.getDate());
    const 요맞 = 요일.has(d.getDay());
    if (일별표 && 요일별표) return 일맞 || 요맞;
    if (일별표) return 일맞;
    if (요일별표) return 요맞;
    return true;
  };
}

/** 시각을 **지역 시각** 글자로 — 크론은 지역 시각으로 돕니다 (서버는 UTC).
    toISOString() 으로 적으면 제 윈도우(KST)에서 아홉 시간 어긋납니다 */
export const 때글 = (d) => (d
  ? [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')]
      .join('-') + ' ' + String(d.getHours()).padStart(2, '0') + ':'
      + String(d.getMinutes()).padStart(2, '0')
  : '(없음)');

/** 지난 예정 시각 (없으면 null) — 분 단위로 거꾸로 훑습니다 */
export function 지난예정(꼴, 이제 = new Date(), 며칠 = 400) {
  /* ★ 400일 — 해마다 한 번 도는 줄(`10 3 2 1 *` 공휴일 받기)이 있습니다.
     40일로 두면 그 줄이 null 로 나와 「볼 수 없음」이 됩니다.
     분마다 훑으니 400일이면 576,000번인데 한 줄에 100ms 안쪽입니다.
     거의 모든 줄은 하루 안에 찾고 바로 멈춥니다 */
  const 맞나 = 꼴풀기(꼴);
  const d = new Date(이제.getTime());
  d.setSeconds(0, 0);
  for (let i = 0; i <= 며칠 * 24 * 60; i++) {
    d.setMinutes(d.getMinutes() - 1);
    if (맞나(d)) return new Date(d.getTime());
  }
  return null;
}

/** 크론 한 줄에서 꼴·로그·하는 일 ── */
export function 줄풀기(줄) {
  const s = String(줄);
  if (!s.trim() || s.trim().startsWith('#')) return null;
  if (/^[A-Z_0-9]+=/.test(s.trim())) return null;            /* MAILTO= 같은 줄 */
  const m = s.match(/^\s*(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.*)$/);
  if (!m) return null;
  const 꼴 = m[1];
  const 명령 = m[2];
  if (/^@/.test(꼴)) return null;                            /* @reboot 등 — 안 봅니다 */
  let 맞나;
  try { 맞나 = 꼴풀기(꼴); } catch { return null; }
  if (!맞나) return null;
  const 로그 = (명령.match(/>>\s*(\S+\.log)/) || [])[1] || null;
  /* 무엇을 하는 줄인지 — 눈에 보이는 이름 하나 */
  const 이름 = (명령.match(/tools\/([^\s]+?\.mjs)/)
    || 명령.match(/tools\/([^\s]+?\.js)/)
    || 명령.match(/(\S+\.sh)(?:\s|$)/)
    || [])[1] || 명령.slice(0, 40);
  return { 꼴, 명령, 로그, 이름: String(이름).replace(/^.*\//, '') };
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 때 = (s) => new Date(s);
  const 꼴 = (s) => 때글(지난예정(s, 때('2026-10-23T10:20:00')));

  보('매일 04:00 — 10/23 10:20 의 지난 예정은 10/23 04:00', 꼴('0 4 * * *') === '2026-10-23 04:00');
  보('일요일 04:00 — 10/23(목) 이면 10/18(일)', 꼴('0 4 * * 0') === '2026-10-18 04:00');
  /* ★ 2026-10-23 은 **금요일**입니다 — 제가 처음에 목요일로 적었다가 이 점검이
     잡았습니다 (10/31 은 토 · 11/10 은 화). 목요일 줄은 **어제(10/22)** 돌았습니다 */
  보('목요일 04:30 — 10/23(금) 10:20 이면 어제 10/22(목) 04:30',
    꼴('30 4 * * 4') === '2026-10-22 04:30');
  보('하루 두 번 05:30/15:30 — 오늘 05:30', 꼴('30 5,15 * * *') === '2026-10-23 05:30');
  보('10분마다 — 10:10', 꼴('*/10 * * * *') === '2026-10-23 10:10');
  보('매시 15분 — 10:15', 꼴('15 * * * *') === '2026-10-23 10:15');
  보('5분마다 7-21시 — 10:15', 꼴('1-59/5 7-21 * * *') === '2026-10-23 10:16');
  보('수요일 03:15 — 10/21(수)', 꼴('15 3 * * 3') === '2026-10-21 03:15');
  보('1월 2일 03:10 — 2026-01-02', 꼴('10 3 2 1 *') === '2026-01-02 03:10');
  보('일 7 은 일요일', 꼴('0 4 * * 7') === '2026-10-18 04:00');
  /* 일·요일이 둘 다 있으면 OR */
  보('일과 요일이 둘 다면 OR (1일 또는 월요일)',
    때글(지난예정('0 0 1 * 1', 때('2026-10-23T10:20:00'))) === '2026-10-19 00:00');

  보('칸풀기 */15 → 0,15,30,45', [...칸풀기('*/15', 0, 59)].join(',') === '0,15,30,45');
  보('칸풀기 2,5-7 → 2,5,6,7', [...칸풀기('2,5-7', 0, 59)].sort((a, b) => a - b).join(',') === '2,5,6,7');
  보('칸풀기가 범위를 벗어나면 멈춘다',
    (() => { try { 칸풀기('70', 0, 59); return false; } catch { return true; } })());
  보('칸풀기가 모르는 꼴이면 멈춘다',
    (() => { try { 칸풀기('a-b', 0, 59); return false; } catch { return true; } })());
  보('다섯 칸이 아니면 멈춘다',
    (() => { try { 꼴풀기('0 4 * *'); return false; } catch { return true; } })());

  /* 줄풀기 */
  const r1 = 줄풀기('0 4 * * *   cd /home/ubuntu/potlab && node tools/첨부되메우기.mjs --진짜 >> /home/ubuntu/log/글없는것.log 2>&1');
  보('줄풀기 — 꼴', r1?.꼴 === '0 4 * * *');
  보('줄풀기 — 로그', r1?.로그 === '/home/ubuntu/log/글없는것.log');
  보('줄풀기 — 이름', r1?.이름 === '첨부되메우기.mjs');
  보('줄풀기 — 셸 스크립트 이름', 줄풀기('15 3 * * 3   /home/ubuntu/경쟁률크론.sh')?.이름 === '경쟁률크론.sh');
  보('줄풀기 — 주석은 건너뜀', 줄풀기('# 주석입니다') === null);
  보('줄풀기 — 빈 줄은 건너뜀', 줄풀기('   ') === null);
  보('줄풀기 — 환경변수 줄은 건너뜀', 줄풀기('MAILTO=a@b.c') === null);
  보('줄풀기 — 로그가 없으면 null', 줄풀기('0 4 * * *   /usr/bin/true')?.로그 === null);

  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) if (!ok || !늦은것만) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
}

if (자기점검만) { console.log('── 자기점검 ──'); 자기점검(); process.exit(0); }

/* ── 크론 읽기 ── */
let 크론;
try { 크론 = execFileSync('crontab', ['-l'], { encoding: 'utf8' }); } catch (e) {
  console.error('✗ crontab -l 을 못 읽었습니다 (서버에서 돌리십시오) — ' + String(e.message).slice(0, 80));
  process.exit(1);
}
const 줄들 = 크론.split(/\r?\n/);
const 일감 = [];
for (const l of 줄들) { const r = 줄풀기(l); if (r) 일감.push(r); }

/* 같은 로그를 쓰는 줄 세기 */
const 로그쓰는수 = new Map();
for (const x of 일감) if (x.로그) 로그쓰는수.set(x.로그, (로그쓰는수.get(x.로그) || 0) + 1);

const 이제 = new Date();
const 표 = [];
for (const x of 일감) {
  const 예정 = 지난예정(x.꼴, 이제);
  let 로그때 = null;
  if (x.로그 && fs.existsSync(x.로그)) {
    try { 로그때 = fs.statSync(x.로그).mtime; } catch { /* 못 읽으면 null */ }
  }
  const 함께 = x.로그 ? (로그쓰는수.get(x.로그) || 1) : 0;
  let 판정;
  if (!x.로그) 판정 = '—볼수없음';
  else if (!로그때) 판정 = '✗로그없음';
  else if (예정 && 로그때.getTime() >= 예정.getTime()) 판정 = '○돌았음';
  else 판정 = (함께 > 1 ? '?함께씀' : '✗안돌았음');
  표.push({ ...x, 예정, 로그때, 함께, 판정 });
}

const 늦은 = 표.filter((x) => x.판정.startsWith('✗'));
const 볼것 = 늦은것만 ? 늦은 : 표;

console.log('크론 ' + 줄들.length + '줄 가운데 **도는 줄 ' + 일감.length + '개**'
  + ' · 이제 ' + 때글(이제) + ' (서버 때)');
console.log('  ○ 돌았음 ' + 표.filter((x) => x.판정 === '○돌았음').length
  + ' · ✗ 안 돌았음 ' + 표.filter((x) => x.판정 === '✗안돌았음').length
  + ' · ✗ 로그 없음 ' + 표.filter((x) => x.판정 === '✗로그없음').length
  + ' · ? 로그를 함께 씀 ' + 표.filter((x) => x.판정 === '?함께씀').length
  + ' · — 볼 수 없음 ' + 표.filter((x) => x.판정 === '—볼수없음').length + '\n');

const 꼴맞 = (d) => 때글(d).slice(5);
for (const x of 볼것) {
  console.log(x.판정.padEnd(9) + ' ' + x.꼴.padEnd(16) + ' ' + String(x.이름).slice(0, 26).padEnd(27)
    + ' 예정 ' + 꼴맞(x.예정) + ' · 로그 ' + 꼴맞(x.로그때)
    + (x.함께 > 1 ? ' · 로그를 ' + x.함께 + '줄이 함께 씀' : ''));
}

if (늦은.length) {
  console.log('\n★ 안 돈 줄 ' + 늦은.length + '개 — 로그를 열어 까닭을 보십시오');
  for (const x of 늦은) console.log('  ' + x.이름 + '   ' + (x.로그 || '(로그 없음)'));
  process.exit(1);
}
console.log('\n○ 로그로 볼 수 있는 줄은 **다 돌았습니다**');
