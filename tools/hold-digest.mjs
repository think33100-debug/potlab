/* 하루 한 번 요약 — 사람이 봐야 할 것만 모아 보냅니다 (2026-09-28 · 세중님 결정).
 *
 *   node tools/hold-digest.mjs            만들어서 보냅니다
 *   node tools/hold-digest.mjs --보기      보내지 않고 화면에만 (내용 확인용)
 *   node tools/hold-digest.mjs --시간 48   48시간치로
 *
 * ── 왜 하루 한 번인가 ────────────────────────────────────────
 * 전에는 gas 가 보류함에 들어갈 때마다 메일을 보냈습니다.
 * 한 건마다 오면 쌓여서 아무도 안 봅니다. 세중님이 **하루 한 번 요약**으로 정하셨습니다.
 *
 * ── 보낼 것이 없으면 안 보냅니다 ──────────────────────────────
 * 새 보류 0건 · 회원 화면 멀쩡 · 수집기 다 제때 → **보내지 않습니다.**
 * 빈 메일이 매일 오면 그것도 안 보게 됩니다.
 *
 * ── 보내는 길 ────────────────────────────────────────────────
 * 아래 중 **있는 것 하나**를 씁니다. 없으면 화면에 찍고 끝냅니다
 * (cron 이 stdout 을 메일로 보내 주는 자리에서는 그것만으로도 됩니다).
 *
 *   RESEND_KEY + NOTIFY_EMAIL      https://resend.com 의 열쇠 (무료 한도 있음)
 *   (없으면)                        화면에만 찍습니다
 *
 * ⚠ service_role 열쇠는 쓰지 않습니다. anon 열쇠 + 경로 내부 열쇠로만 갑니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'HS3';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

async function rpc(cfg, fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  if (!k) throw new Error('SUPABASE_ANON_KEY 가 없습니다');
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/** 사람이 읽을 글로 */
function 글로(d, 관리자주소) {
  const 줄 = [];
  const 보류 = d['새 보류'] || [];
  const 샘 = d['회원 화면'] || {};
  const 늦음 = d['늦은 수집기'] || [];

  if (늦음.length) {
    줄.push('██ 수집기가 제때 안 돌았습니다 ██');
    늦음.forEach((x) => 줄.push('   ' + x.경로 + ' — ' + x.왜 + ' (' + x.몇시간째 + '시간째)'));
    줄.push('');
  }
  if (샘['샘']) {
    줄.push('██ 회원 화면에 있으면 안 될 공고가 있습니다 ██');
    줄.push('   마감 지남 ' + 샘['마감 지남'] + '건 (물리치료사 ' + 샘['마감 지남 · 물리치료사']
      + ' · 작업치료사 ' + 샘['마감 지남 · 작업치료사'] + ')');
    줄.push('   45일 넘음 ' + 샘['45일 넘음'] + '건 · 수시 180일 넘음 ' + 샘['수시 180일 넘음'] + '건');
    줄.push('');
  }
  줄.push('사람이 봐야 할 새 공고 ' + d['새 보류 건수'] + '건 (최근 ' + d['몇시간치'] + '시간)');
  줄.push('');
  보류.forEach((x, i) => {
    줄.push((i + 1) + '. [' + (x.기관 || '') + '] ' + (x.제목 || ''));
    if (x.까닭) 줄.push('   왜 보류 — ' + x.까닭);
    if (x.마감) 줄.push('   마감 ' + x.마감);
    줄.push('   ' + (x.주소 || ''));
    줄.push('');
  });
  줄.push('─────────────────────────────');
  줄.push('올릴지 말지는 관리자 화면에서 정합니다 — ' + 관리자주소);
  줄.push('회원 화면 ' + (샘['회원 화면 전체'] ?? '?') + '건 · 마감 지난 것 ' + (샘['마감 지남'] ?? '?') + '건');
  return 줄.join('\n');
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const 보기만 = argv.includes('--보기');
const 시간 = Number(argv.includes('--시간') ? argv[argv.indexOf('--시간') + 1] : 24) || 24;
const cfg = env();
if (!cfg.COLLECT_KEY_HS3) { console.error('COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }

const d = await rpc(cfg, 'hold_digest', {
  p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_hours: 시간,
});

if (!d['보낼것있나']) {
  console.log('보낼 것이 없습니다 — 새 보류 0건 · 회원 화면 멀쩡 · 수집기 다 제때');
  process.exit(0);
}

const 관리자 = cfg.ADMIN_URL || 'https://potjob-web.vercel.app/admin/jobs';
const 본문 = 글로(d, 관리자);
const 제목 = '[피오티잡] 확인할 공고 ' + d['새 보류 건수'] + '건'
  + ((d['늦은 수집기'] || []).length ? ' · ⚠ 수집기 멈춤' : '')
  + ((d['회원 화면'] || {})['샘'] ? ' · ⚠ 회원 화면에 샘' : '');

if (보기만) {
  console.log('제목: ' + 제목 + '\n');
  console.log(본문);
  process.exit(0);
}

/* Resend 가 있으면 보내고, 없으면 화면에 찍습니다.
   cron 이 stdout 을 메일로 넘겨 주는 자리에서는 찍는 것만으로도 됩니다 */
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
  console.log('보냈습니다 — ' + 제목);
} else {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n');
  console.log('제목: ' + 제목 + '\n');
  console.log(본문);
}
