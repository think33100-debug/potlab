/* 같은 공고가 회원 화면에 둘 이상 보이면 한 줄만 남깁니다 (2026-10-18 세중님 2번 승인)
 *
 *   node tools/중복숨기기.mjs            마른 실행 — 무엇을 숨길지만 보여 줍니다
 *   node tools/중복숨기기.mjs --진짜     숨깁니다
 *   node tools/중복숨기기.mjs --자기점검 사이트·DB 를 안 건드리고 셈만 봅니다
 *
 * 세중님 조건
 *   · 수집 바퀴 **뒤** 매시
 *   · hidden_why = '중복'
 *   · 숨긴 수 로그 + 아침 메일 한 줄
 *   · **하루 10건이 넘으면 멈추고 메일** — 뭔가 잘못된 신호입니다
 *
 * ── 왜 뚜껑이 필요한가 ──────────────────────────────────────────
 * 2026-10-11 에 트리거 하나가 공고 278건을 보류함으로 보내 회원 화면이
 * 358 → 80 이 됐습니다 (지침 8-14). 이 도구는 **공고를 감춥니다** —
 * 열쇠 규칙이 너무 넓어지면 멀쩡한 공고가 사라집니다. 하루 10건이 넘으면
 * 그것은 「중복이 많다」가 아니라 **「규칙이 잘못됐다」** 는 뜻이므로 멈춥니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 뚜껑 = Number(argv.includes('--뚜껑') ? argv[argv.indexOf('--뚜껑') + 1] : 10) || 10;
const 기록파일 = process.env.POTJOB_중복기록 || path.join(os.homedir(), '중복숨긴기록.json');

/* ── 하루 셈 ────────────────────────────────────────────────────
 * 날짜가 바뀌면 0 에서 다시 셉니다. 「하루 10건」은 **그날 숨긴 수의 합**입니다 —
 * 한 바퀴에 10건이 아니라 하루에 10건입니다 (매시 9건씩 숨기면 뚜껑이 뜻을
 * 잃습니다). */
export function 하루셈(기록, 오늘, 더할것) {
  const 그날 = (기록 && 기록.날 === 오늘) ? Number(기록.숨긴수) || 0 : 0;
  return { 날: 오늘, 숨긴수: 그날 + (Number(더할것) || 0) };
}
export function 넘었나(그날까지, 이번에, 뚜껑값) {
  return (Number(그날까지) || 0) + (Number(이번에) || 0) > (Number(뚜껑값) || 0);
}

if (argv.includes('--자기점검')) {
  const 어긴것 = [];
  const 봐 = (n, c) => { if (!c) 어긴것.push(n); };
  봐('날이 바뀌면 0 부터', 하루셈({ 날: '2026-10-17', 숨긴수: 9 }, '2026-10-18', 2).숨긴수 === 2);
  봐('같은 날이면 더함', 하루셈({ 날: '2026-10-18', 숨긴수: 9 }, '2026-10-18', 2).숨긴수 === 11);
  봐('기록이 없으면 0 부터', 하루셈(null, '2026-10-18', 3).숨긴수 === 3);
  봐('뚜껑 꼭 맞으면 안 넘음', 넘었나(8, 2, 10) === false);
  봐('뚜껑을 하나 넘으면 넘음', 넘었나(8, 3, 10) === true);
  봐('그날 이미 찼으면 한 건도 넘음', 넘었나(10, 1, 10) === true);
  봐('0 건이면 안 넘음', 넘었나(10, 0, 10) === false);
  if (어긴것.length) { console.error('✗ 자기 점검 실패 — ' + 어긴것.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과 — 하루 셈·뚜껑 7가지 (DB 를 안 건드렸습니다)');
  process.exit(0);
}

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);   /* 이름 없는 줄은 버립니다 (8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
const K = cfg.SUPABASE_SERVICE_KEY;
if (!cfg.SUPABASE_URL || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }

async function rpc(fn, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' ' + r.status + ' ' + t.slice(0, 300));
  return JSON.parse(t);
}

async function 메일(제목, 글) {
  if (!cfg.RESEND_KEY || !cfg.NOTIFY_EMAIL) { console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
      to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 글,
    }),
  });
  console.log(r.ok ? '메일 보냈습니다' : '✗ 메일 ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
let 기록 = null;
try { if (fs.existsSync(기록파일)) 기록 = JSON.parse(fs.readFileSync(기록파일, 'utf8')); } catch { /* 깨졌으면 새로 */ }
const 그날까지 = (기록 && 기록.날 === 오늘) ? Number(기록.숨긴수) || 0 : 0;

/* 늘 마른 실행을 먼저 합니다 — 뚜껑을 넘는지 보고 나서 숨깁니다 */
const 마른 = await rpc('중복숨기기', { p_마른: true });
const 숨길수 = Number(마른.숨길수) || 0;
console.log('중복 숨기기 — 숨길 것 ' + 숨길수 + '건 (오늘 이미 숨긴 것 ' + 그날까지 + '건 · 뚜껑 ' + 뚜껑 + ')');
for (const x of (마른.목록 || []).slice(0, 12)) {
  console.log('   ' + x.id + ' [' + x.source + '] ' + String(x.기관).slice(0, 16)
    + ' | ' + String(x.제목).slice(0, 30) + '  → 남는 것 ' + x.남는것);
}
if ((마른.목록 || []).length > 12) console.log('   … 그밖 ' + ((마른.목록 || []).length - 12) + '건');

if (숨길수 === 0) { console.log('숨길 것이 없습니다'); process.exit(0); }

if (넘었나(그날까지, 숨길수, 뚜껑)) {
  const 글 = '중복 숨기기를 **멈췄습니다** — 하루 뚜껑 ' + 뚜껑 + '건을 넘습니다.\n\n'
    + '오늘 이미 숨긴 것 ' + 그날까지 + '건 · 이번에 숨길 것 ' + 숨길수 + '건\n\n'
    + '「중복이 많다」가 아니라 **공고열쇠() 규칙이 너무 넓어졌다**는 신호일 수 있습니다.\n'
    + '아무것도 숨기지 않았습니다. 목록을 보고 규칙을 보십시오 —\n\n'
    + (마른.목록 || []).slice(0, 20).map((x) => '  ' + x.id + ' [' + x.source + '] '
        + String(x.기관).slice(0, 16) + ' | ' + String(x.제목).slice(0, 40)
        + '\n    남는 것 ' + x.남는것 + '\n    열쇠 ' + String(x.열쇠).slice(0, 80)).join('\n');
  console.log('\n★ 뚜껑을 넘었습니다 — 멈추고 메일을 보냅니다. 아무것도 숨기지 않았습니다');
  await 메일('[피오티잡] 중복 숨기기 멈춤 — 하루 ' + 뚜껑 + '건 넘음 (숨길 것 ' + 숨길수 + '건)', 글);
  process.exit(0);
}

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 숨기려면 --진짜'); process.exit(0); }

const 한것 = await rpc('중복숨기기', { p_마른: false });
const 숨김 = Number(한것.숨김) || 0;
fs.writeFileSync(기록파일, JSON.stringify(하루셈(기록, 오늘, 숨김), null, 1));
console.log('\n숨겼습니다 — ' + 숨김 + '건 (hidden_why = 「중복」 · updated_at 은 안 바꿨습니다)');
console.log('오늘 누적 ' + (그날까지 + 숨김) + '건 / 뚜껑 ' + 뚜껑);
