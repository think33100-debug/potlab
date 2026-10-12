/* 수집기가 **2시간 넘게** 안 돌면 요약을 기다리지 않고 바로 메일 (2026-10-12).
 *
 *   node tools/수집기멈춤경보.mjs            30분마다 (크론)
 *   node tools/수집기멈춤경보.mjs --보기      보내지 않고 화면에만
 *   node tools/수집기멈춤경보.mjs --기준 0.1  기준을 낮춰 시험 (시간 단위)
 *   node tools/수집기멈춤경보.mjs --잊기      쉬는 기록을 비웁니다 (시험 뒤)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 요약 메일은 하루 두 번(08:00·15:00)입니다. 2026-10-12 에 알리오·클린아이가
 * **07:15 에 멈췄는데** 08:00 요약에는 45분째라 안 걸리고, **15:00 까지
 * 아무도 몰랐습니다** (제가 미리보기로 먼저 봤습니다 — 운이었습니다).
 * 그날 올라온 물리치료사 공고 1건을 5시간 늦게 담았습니다.
 *
 * 그래서 30분마다 묻습니다 — 「2시간 넘게 안 돈 수집기가 있나」.
 *
 * ── 시끄럽지 않게 ────────────────────────────────────────────
 * 같은 수집기는 **6시간에 한 번만** 보냅니다. 멈춘 수집기는 고칠 때까지
 * 계속 멈춰 있으니, 30분마다 메일이 오면 아무도 안 봅니다 (지침 15절의 결 —
 * 「날마다 경보가 뜨면 아무도 경보를 안 믿게 됩니다」).
 * 쉬는 기록은 서버의 `~/경보기록.json` 에 둡니다 — 저장소 밖입니다.
 *
 * ── 판정은 DB 가 합니다 ──────────────────────────────────────
 * 「늦었나」는 `hold_digest` 의 `늦은 수집기` 를 그대로 씁니다. 여기서 또
 * 재면 기준이 두 벌이 됩니다 (지침 6절 — 기준은 한 자리).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 기록파일 = process.env.POTJOB_ALARM_STATE || path.join(os.homedir(), '경보기록.json');

const argv = process.argv.slice(2);
const 보기만 = argv.includes('--보기');
const 잊기 = argv.includes('--잊기');
const 기준시간 = Number(argv.includes('--기준') ? argv[argv.indexOf('--기준') + 1] : 2) || 2;
const 쉬는시간 = Number(argv.includes('--쉬기') ? argv[argv.indexOf('--쉬기') + 1] : 6) || 6;

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);     /* 이름 없는 줄은 버립니다 (지침 8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();

if (잊기) {
  if (fs.existsSync(기록파일)) fs.rmSync(기록파일);
  console.log('쉬는 기록을 비웠습니다 — ' + 기록파일);
  process.exit(0);
}
if (!cfg.COLLECT_KEY_HS3) { console.error('COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }

async function rpc(fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

const d = await rpc('hold_digest', { p_secret: cfg.COLLECT_KEY_HS3, p_source: 'HS3', p_hours: 24 });
let 늦음 = (d['늦은 수집기'] || []).filter((x) => Number(x['몇시간째']) >= 기준시간);

/* `--시험` — **보내는 길이 정말 되는지** 보려고 가짜 한 줄을 넣습니다.
   기준을 낮추는 것만으로는 시험이 안 됩니다 — 수집기가 다 멀쩡하면
   「늦은 수집기 0곳」 이라 메일이 안 나가기 때문입니다 (2026-10-12 에 그랬습니다).
   제목에 「시험」 을 박아 두어 받는 쪽이 헷갈리지 않게 합니다.
   쓰고 나면 `--잊기` 로 쉬는 기록을 비우십시오. */
if (argv.includes('--시험')) {
  늦음 = [{ 경로: '시험(가짜)', 왜: '보내는 길이 되는지 보는 시험입니다 — 멈춘 수집기가 아닙니다',
    몇시간째: 99 }];
}

const 기록 = (() => {
  try { return JSON.parse(fs.readFileSync(기록파일, 'utf8')); } catch { return {}; }
})();
const 이제 = Date.now();
const 보낼것 = 늦음.filter((x) => {
  const 앞 = 기록[x.경로];
  return !앞 || (이제 - 앞) >= 쉬는시간 * 3600e3;
});

console.log('늦은 수집기 ' + (d['늦은 수집기'] || []).length + '곳 · 기준(' + 기준시간
  + '시간) 넘은 것 ' + 늦음.length + '곳 · 쉬는 시간을 지나 보낼 것 ' + 보낼것.length + '곳');
늦음.forEach((x) => console.log('   ' + x.경로 + ' — ' + x.왜 + ' (' + x.몇시간째 + '시간째)'
  + (보낼것.includes(x) ? '' : '  ← ' + 쉬는시간 + '시간 안에 이미 보냈습니다')));

if (!보낼것.length) { console.log('보낼 것이 없습니다.'); process.exit(0); }

const 제목 = (argv.includes('--시험') ? '[피오티잡 · 시험] ' : '[피오티잡] ')
  + '⚠ 수집기가 멈췄습니다 — '
  + 보낼것.map((x) => x.경로 + ' ' + x.몇시간째 + '시간째').join(' · ');
const 본문 = [
  '██ 수집기가 ' + 기준시간 + '시간 넘게 안 돌았습니다 ██',
  '',
  ...보낼것.map((x) => '   ' + x.경로 + ' — ' + x.왜 + ' (' + x.몇시간째 + '시간째)'),
  '',
  '먼저 볼 것 —',
  '   ls -la ~/lock/            그 수집기의 잠금 시각이 멈춰 있나',
  '   ls -l ~/수집크론.sh        실행 권한이 있나 (-rwx…)  ← 2026-10-12 에 이것이었습니다',
  '   ps -eo pid,etime,cmd | grep "[t]ools/"   멈춰 선 프로세스가 있나 (pid 로 죽입니다)',
  '   tail ~/log/<그 수집기>.log  끝줄이 이미 끝난 꼴이면 프로세스가 선 것입니다',
  '',
  '같은 수집기는 ' + 쉬는시간 + '시간에 한 번만 보냅니다. 요약 메일(08:00·15:00)에도 함께 뜹니다.',
].join('\n');

if (보기만) {
  console.log('\n제목: ' + 제목 + '\n');
  console.log(본문);
  process.exit(0);
}

if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
      to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문,
    }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('메일 못 보냄 · HTTP ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
  let id = '';
  try { id = (JSON.parse(t) || {}).id || ''; } catch { /* 모양이 바뀌어도 넘어갑니다 */ }
  console.log('보냈습니다 — ' + 제목);
  console.log('   Resend id ' + (id || '(응답에 id 가 없습니다: ' + t.slice(0, 120) + ')'));
} else {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n');
  console.log('제목: ' + 제목 + '\n' + 본문);
}

/* 보낸 것만 기록합니다 — 못 보냈으면 다음 번에 다시 시도합니다 */
보낼것.forEach((x) => { 기록[x.경로] = 이제; });
fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1) + '\n');
console.log('쉬는 기록을 적었습니다 — ' + 기록파일);
