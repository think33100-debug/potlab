/* ★★ 2026-10-21 밤 — **이 도구는 쓰지 않습니다.** 돌려 보니 채울 것 0건입니다.
 *   까닭 — 읽는 `tools/hosp/reports/jobflex.json` 은 **곳별 요약**(잰날·백필·곳별)이고
 *   공고 줄이 없습니다. 제가 파일 모양을 안 보고 짰습니다 (지침 2·5절).
 *   그리고 고칠 자리는 이미 둘 다 고쳐져 있습니다 —
 *     tools/hosp/jobflex.mjs:156   마감시각: 시각(x.endDateTime)
 *     tools/collect-jobflex.mjs:198 apply_to_time: x.마감시각
 *   그래서 **07:07·13:07·19:07 크론이 스스로 채웁니다.** 지울 후보입니다.
 */

/* JobFlex 마감시각 **되메우기** (2026-10-21 세중님 ⓑ)
 *
 *   node tools/JF마감시각되메우기.mjs           무엇이 채워질지만 (기본 · 마른)
 *   node tools/JF마감시각되메우기.mjs --진짜    담습니다
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * JobFlex 목록 API 의 `endDateTime` 은 `2026-02-09T17:00:59` 꼴인데
 * `jobflex.mjs` 의 `날()` 이 10자로 자르며 **시각을 버렸습니다.** 오늘 그 자리를
 * 고쳤지만(`마감시각`), **이미 담긴 공고는 안 고쳐집니다** (지침 9절).
 * 능력시험에서 회원 화면 JF 공고 5건이 마감시각 빈칸이었고 정답은 전부 17:00 입니다.
 *
 * ★ 담는 길은 `칸되메우기` 창구뿐입니다 — **비어 있는 칸만** 채우고
 *   `edited_fields`·`admin_locked` 를 건너뛰고 `updated_at` 을 안 바꿉니다.
 * ★ 되돌리는 법 — `칸기록` 에 옛값이 남습니다:
 *     select job_id, 칸, 옛값 from 칸기록 where 누가='첨부 되메우기' and 바뀐때 > now() - interval '1 hour';
 * ★ 그물은 `jobflex.mjs` 가 이미 쓸어 둔 `tools/hosp/reports/jobflex.json` 을 읽습니다 —
 *   **사이트를 새로 두드리지 않습니다.** 보고 파일이 없으면 멈춥니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');

/* ── .env 는 node 로 읽습니다 (지침 8-12 — 셸에 먹이지 않습니다) ── */
const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const f = path.join(여기, 이름);
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k] && process.env[k]) cfg[k] = process.env[k];
  if (!cfg[k]) { console.error('✗ ' + k + ' 가 없습니다'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* ── 쓸어 둔 JobFlex 보고에서 마감시각 ── */
const 보고 = path.join(여기, 'hosp/reports/jobflex.json');
if (!fs.existsSync(보고)) {
  console.error('✗ tools/hosp/reports/jobflex.json 이 없습니다 — 먼저 collect-jobflex.mjs --dry 를 돌리십시오');
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(보고, 'utf8'));
const 시각맵 = new Map();
for (const r of (j.결과 || [])) for (const x of (r.줄 || [])) {
  if (x.id && x.마감시각) 시각맵.set(x.id, x.마감시각);
}
console.log('쓸어 둔 JobFlex 공고 ' + 시각맵.size + '건에 마감시각이 있습니다 (' + (j.잰날 || '?') + ')');

/* ── 회원 화면 JF 공고 가운데 마감시각이 빈 것 (100줄씩 · 지침) ── */
const 빈것 = [];
for (let off = 0; ; off += 100) {
  const u = cfg.SUPABASE_URL + '/rest/v1/job_posts_pub'
    + '?select=id,title,org_name,apply_to,apply_to_time&id=like.JF*'
    + '&apply_to_time=is.null&order=id&limit=100&offset=' + off;
  const r = await fetch(u, { headers: H });
  if (!r.ok) { console.error('✗ HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 200)); process.exit(1); }
  const 줄 = await r.json();
  빈것.push(...줄);
  if (줄.length < 100) break;
}
console.log('회원 화면 JF 공고 가운데 마감시각이 빈 것 ' + 빈것.length + '건');

const 채울것 = 빈것.filter((x) => 시각맵.has(x.id))
  .map((x) => ({ ...x, 마감시각: 시각맵.get(x.id) }));
console.log('그 가운데 쓸어 둔 값이 있는 것 ' + 채울것.length + '건\n');
for (const x of 채울것) {
  console.log('  ' + x.id.padEnd(11) + '마감 ' + String(x.apply_to || '-').padEnd(11)
    + '→ 시각 ' + x.마감시각 + '   ' + String(x.title).slice(0, 36)
    + '  (' + String(x.org_name || '').slice(0, 14) + ')');
}

if (!채울것.length) { console.log('\n채울 것이 없습니다.'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 담습니다 — 담으려면 --진짜'); process.exit(0); }

/* ── 창구로만 담습니다 ── */
const 줄들 = 채울것.map((x) => ({
  id: x.id,
  apply_to_time: x.마감시각,
  뽑은값: { 공고문_접수시각: x.마감시각,
    근거: { 접수시각: 'JobFlex 목록 API endDateTime' }, 읽은법: 'API:JobFlex' },
}));
let 담음 = 0;
for (let i = 0; i < 줄들.length; i += 50) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_rows: 줄들.slice(i, i + 50) }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 창구가 막혔습니다 — HTTP ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
  console.log('  창구가 답한 것 — ' + t.slice(0, 220));
  try { 담음 += (JSON.parse(t) || {})['담음'] || 0; } catch { /* 모양이 다르면 그대로 */ }
}
console.log('\n담았습니다 — ' + 담음 + '건 (updated_at 은 안 바꿨습니다)');
console.log('되돌리는 법 — 칸기록에서 옛값을 꺼내 같은 창구로 다시 보냅니다:');
console.log("  select job_id, 칸, 옛값 from 칸기록 where 누가='첨부 되메우기' and 바뀐때 > now() - interval '1 hour';");
