/* 능력시험 ① **표본 뽑기** (2026-10-19 밤 · 세중님 「실력부터 잽니다」)
 *
 *   node tools/능력시험/표본뽑기.mjs            표본을 골라 표본.json 에 적습니다
 *   node tools/능력시험/표본뽑기.mjs --몇개 60
 *
 * ── 세중님이 정하신 표본 ─────────────────────────────────────────
 *   · **최근 30일 1층 공고** — 회원 화면 + **숨김·보류 포함**
 *   · 50건 내외, **출처별 골고루** (HS3 · HS · GJ2 · AL2 · CE2 · ND2 · JF · WN2)
 *   · **첨부 있는 공고를 일부러 많이**
 *
 * ── 지키는 것 ────────────────────────────────────────────────────
 * ★ 읽기만 합니다. 아무것도 담지 않습니다.
 * ★ 1층 판정은 `일층병원_구멍()` 창구 이름으로만 합니다 (이름으로 짐작 금지 ·
 *   지침 10-3). `네숫자()` 와 **같은 꼴**입니다.
 * ★ 표본은 파일에 **id 와 주소까지** 적어 둡니다 — 뒤에 몇 번이고 같은 공고로
 *   다시 시험할 수 있게 (세중님 5번 「다시 돌릴 수 있게」).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 50) || 50;

const cfg = {};
for (const 이름 of ['../../.env', '../../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const DB = cfg.SUPABASE_DB_URL;
if (!DB) { console.error('✗ SUPABASE_DB_URL 이 있어야 합니다 (서버 .env)'); process.exit(1); }

/* ★ 1층 판정을 **DB 함수로** 합니다 — `견줄이름()`·`일층병원_구멍()` 을 그대로 씁니다.
   JS 로 흉내내면 판정이 두 벌이 되고 `네숫자()` 와 어긋납니다 (지침 6절).
   열쇠는 **셸에 안 흘립니다** — psql 에 환경변수로만 넘깁니다 (지침 8-11·8-12) */
function psql(파일) {
  /* 주소를 **명령줄에 두지 않습니다** — `ps` 에 열쇠가 그대로 보입니다.
     조각내어 환경변수로 넘깁니다 (PGPASSWORD 는 psql 이 읽습니다) */
  const u = new URL(DB);
  const env = {
    ...process.env,
    PGHOST: u.hostname, PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
    PGSSLMODE: u.searchParams.get('sslmode') || 'require',
  };
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 파일],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  if (r.status !== 0) {
    console.error('✗ psql ' + r.status + ' — ' + String(r.stderr || '').slice(0, 400));
    process.exit(1);
  }
  return String(r.stdout || '');
}

/* ── 표본 — **DB 가 고릅니다** (표본.sql · 한 줄에 공고 하나, JSON) ── */
const 줄들 = psql(path.join(여기, '표본.sql')).split('\n').map((l) => l.trim()).filter(Boolean);
const 뽑을것 = 줄들.map((l) => JSON.parse(l));
console.log('최근 30일 1층 공고 ' + 뽑을것.length + '건 (숨김·보류 포함)');

/* ── 출처별로 골고루 · 첨부 있는 것을 먼저 ── */
const 출처별 = new Map();
for (const x of 뽑을것) {
  const s = x.source || '?';
  if (!출처별.has(s)) 출처별.set(s, []);
  출처별.get(s).push(x);
}
console.log('\n── 1층 최근 30일 · 출처별 ──');
for (const [s, a] of [...출처별].sort((x, y) => y[1].length - x[1].length)) {
  console.log('  ' + s.padEnd(6) + String(a.length).padStart(4) + '건 · 첨부 있는 것 '
    + a.filter((x) => (x['첨부'] || []).length).length + '건');
}

/* 출처마다 **네 바구니**로 나눠 돌아가며 집습니다 —
 *   첨부+회원화면 · 첨부+숨김·보류 · 첨부없음+회원화면 · 첨부없음+숨김·보류
 * ★ 왜 — 그냥 「첨부 있는 것부터」로 집으면 **44/50 이 숨김·보류**가 됩니다
 *   (오래된 공고가 숨겨져 있으니까요). 그러면 「회원이 보는 공고를 제대로
 *   긁었나」를 못 잽니다. 보임·숨김을 **섞어** 집습니다 */
const 바구니 = (x) => ((x['첨부'] || []).length ? 0 : 2) + ((x['숨김'] || x['보류']) ? 1 : 0);
for (const a of 출처별.values()) {
  const 네개 = [[], [], [], []];
  for (const x of a) 네개[바구니(x)].push(x);
  for (const b of 네개) b.sort((p, q) => String(q.id).localeCompare(String(p.id)));
  /* 첨부 있는 바구니(0·1)를 **한 바퀴에 두 건씩** 집습니다 — 세중님
     「첨부 있는 공고를 일부러 많이」 */
  const 몫 = [2, 2, 1, 1];
  const 자리 = [0, 0, 0, 0];
  a.length = 0;
  while (네개.some((b, i) => 자리[i] < b.length)) {
    let 더 = false;
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 몫[i]; k++) {
        if (자리[i] < 네개[i].length) { a.push(네개[i][자리[i]++]); 더 = true; }
      }
    }
    if (!더) break;
  }
}
const 표본 = [];
const 돌림 = [...출처별.keys()];
for (let 바퀴 = 0; 표본.length < 몇개; 바퀴++) {
  let 더넣었나 = false;
  for (const s of 돌림) {
    const a = 출처별.get(s);
    if (바퀴 < a.length && 표본.length < 몇개) { 표본.push(a[바퀴]); 더넣었나 = true; }
  }
  if (!더넣었나) break;
}

const 낼곳 = path.join(여기, '표본.json');
fs.writeFileSync(낼곳, JSON.stringify({
  만든때: new Date().toISOString(),
  규칙: '최근 30일 · 1층 기관(견줄이름 ↔ 일층병원_구멍) · 숨김·보류 포함 · 출처별 골고루 · 첨부 있는 것 먼저',
  몇개,
  표본,
}, null, 1) + '\n', 'utf8');

console.log('\n── 고른 표본 ' + 표본.length + '건 ──');
const 셈 = new Map();
for (const x of 표본) 셈.set(x.source, (셈.get(x.source) || 0) + 1);
for (const [s, n] of [...셈].sort((a, b) => b[1] - a[1])) {
  const 그것 = 표본.filter((x) => x.source === s);
  console.log('  ' + s.padEnd(6) + n + '건 · 첨부 있는 것 ' + 그것.filter((x) => (x['첨부'] || []).length).length
    + ' · 숨김·보류 ' + 그것.filter((x) => x['숨김'] || x['보류']).length
    + ' · 본문 있는 것 ' + 그것.filter((x) => x['본문줄']).length);
}
console.log('  첨부가 있는 공고 ' + 표본.filter((x) => (x['첨부'] || []).length).length + '건 · 첨부 줄 합 '
  + 표본.reduce((a, x) => a + (x['첨부'] || []).length, 0));
console.log('\n' + 낼곳 + ' 에 적었습니다. 아무것도 바꾸지 않았습니다.');
