/* 보류함에 있는 공고를 지금 규칙으로 다시 판정합니다 (2026-09-28).
 *
 *   node tools/재판정.mjs           보기만 합니다 (아무것도 안 바꿉니다)
 *   node tools/재판정.mjs --옮김     실제로 옮깁니다
 *
 * ── 무엇을 하나 ────────────────────────────────────────────
 * 규칙을 바꾸면 **이미 쌓인 공고는 그대로**입니다. 이 프로젝트에서
 * 여러 번 겪은 일이라, 규칙을 고칠 때마다 이것도 같이 돌립니다.
 *
 *   회원목록 으로 → 보류를 풀어 회원 화면에 올립니다
 *   쓰레기통 으로 → **지우지 않습니다.** 감추기만 합니다 —
 *                  hidden_why 에 「재판정으로 버림 (날짜)」 를 남겨
 *                  관리자 화면에서 따로 모아 보고 되살릴 수 있게 합니다
 *   보류함 그대로  → 건드리지 않습니다
 *
 * ⚠ **공고는 지우지 않습니다.** 감추기만 합니다 (세중님 지침).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortJob } from './sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 옮김 = process.argv.includes('--옮김');

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
const cfg = env();
if (!cfg.COLLECT_KEY_HS3) { console.error('COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }

async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const 보류중 = await rpc('rejudge_hold_list', { p_secret: cfg.COLLECT_KEY_HS3 });
console.log('지금 보류함 ' + 보류중.length + '건' + (옮김 ? '' : '  (보기만 합니다 — 아무것도 안 바꿉니다)') + '\n');

const 갈것 = { 회원목록: [], 쓰레기통: [], 보류함: [] };
for (const x of 보류중) {
  const r = sortJob(String(x.title || ''), '', null);
  /* 「숨김보관」 도 화면에서 감추는 것이라 같이 다룹니다 */
  const 갈래 = r.갈래 === '숨김보관' ? '쓰레기통' : r.갈래;
  갈것[갈래].push({ ...x, 왜: r.왜 });
}
for (const [k, v] of Object.entries(갈것)) console.log('  ' + k.padEnd(7) + String(v.length).padStart(4) + '건');

for (const 갈 of ['회원목록', '쓰레기통']) {
  const v = 갈것[갈];
  if (!v.length) continue;
  console.log('\n══ ' + 갈 + ' 로 가는 ' + v.length + '건 ══');
  v.slice(0, 갈 === '회원목록' ? 99 : 12).forEach((x, i) =>
    console.log('  ' + (i + 1) + '. ' + String(x.org_name).slice(0, 16).padEnd(18) + String(x.title).slice(0, 50)));
  if (갈 === '쓰레기통' && v.length > 12) console.log('  … 그리고 ' + (v.length - 12) + '건 더');
}

if (!옮김) {
  console.log('\n--옮김 을 붙이면 실제로 옮깁니다. 공고는 지우지 않고 감추기만 합니다.');
  process.exit(0);
}

const 답 = await rpc('rejudge_hold_apply', {
  p_secret: cfg.COLLECT_KEY_HS3,
  p_show: 갈것.회원목록.map((x) => x.id),
  p_hide: 갈것.쓰레기통.map((x) => x.id),
  p_why: '재판정으로 버림 (' + 오늘.slice(5).replace('-', '/') + ')',
});
console.log('\n옮겼습니다 — ' + JSON.stringify(답));
console.log('※ 감춘 것은 지운 것이 아닙니다. 관리자 화면 → 공고 → 「재판정으로 버림」 에서 보고 되살릴 수 있습니다.');
