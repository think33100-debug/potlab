/* 보류함에서 **마감일이 이미 지난 공고**를 감춥니다 (2026-10-19 세중님 ⑥㉠ 승인)
 *
 *   node tools/보류함_마감지남정리.mjs          무엇을 감출지만 (기본)
 *   node tools/보류함_마감지남정리.mjs --진짜   감춥니다
 *
 * ── 왜 손실이 없나 ──────────────────────────────────────────────
 * 보류함은 「사람이 확인해서 **올릴** 것」입니다. 마감이 지난 공고는 올려도
 * 회원 화면에 안 보입니다 — `hide_stale_posts` 가 매시 다시 내립니다.
 * 그래서 보류함에 두면 **사람이 볼 것만 늘어납니다**(408건 중 162건).
 *
 * ── 창구를 새로 만들지 않았습니다 ──────────────────────────────
 * `rejudge_hold_apply(p_secret, p_show[], p_hide[], p_why)` 가 **이미**
 * 그 일을 합니다 — `hidden=true, hold=false, hidden_why=까닭, hidden_on` 을
 * 함께 적고 되살릴 수 있게 둡니다 (지침 6절 — 이미 있는 것을 먼저 찾습니다).
 *
 * ★ 마감 판정은 **DB 와 같은 꼴**로 합니다 — 날짜만 보지 않고 `apply_to_time`
 *   까지 봅니다 (2026-10-17 에 고친 그 규칙). 여기서 다르게 세면 「마감이
 *   지났다」가 두 자리가 됩니다.
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');
const 뚜껑 = Number(process.argv.includes('--뚜껑')
  ? process.argv[process.argv.indexOf('--뚜껑') + 1] : 400) || 400;

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !K || !SEC) {
  console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / COLLECT_KEY_HS3 가 있어야 합니다 (서버에서)');
  process.exit(1);
}
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

/* 보류함에서 마감 지난 것을 고릅니다.
   `apply_to_time` 이 없으면 23:59 로 봅니다 — DB 의 마감 판정과 같은 꼴입니다.
   100줄에서 끊기므로 **offset 으로 넘깁니다** (지침 — Range 는 안 통합니다) */
const 줄 = [];
for (let off = 0; ; off += 100) {
  const q = U + '/rest/v1/job_posts?select=id,source,org_name,title,apply_to,apply_to_time'
    + '&hold=is.true&hidden=is.false&apply_to=not.is.null'
    + '&order=apply_to.asc,id.asc&limit=100&offset=' + off;
  const r = await fetch(q, { headers: H });
  if (!r.ok) { console.error('✗ 목록 ' + r.status + ' · ' + (await r.text()).slice(0, 200)); process.exit(1); }
  const 한쪽 = await r.json();
  줄.push(...한쪽);
  if (한쪽.length < 100) break;
  if (off > 5000) break;
}
console.log('보류함에서 마감일이 적힌 공고 ' + 줄.length + '건을 받았습니다');

const 이제 = new Date(Date.now() + 9 * 3600e3);          /* KST */
const 지났나 = (x) => {
  const t = String(x.apply_to_time || '23:59').slice(0, 5);
  return new Date(x.apply_to + 'T' + t + ':00+09:00') < 이제;
};
const 감출것 = 줄.filter(지났나);

console.log('그중 **마감이 지난 것 ' + 감출것.length + '건**\n');
const 출처별 = {};
for (const x of 감출것) 출처별[x.source] = (출처별[x.source] || 0) + 1;
console.log('  출처별 — ' + Object.entries(출처별).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => k + ' ' + v).join(' · '));
console.log('  가장 오래된 마감 ' + (감출것[0] || {}).apply_to
  + ' · 가장 최근 ' + (감출것[감출것.length - 1] || {}).apply_to + '\n');
for (const x of 감출것.slice(0, 10)) {
  console.log('    ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16)
    + ' | ' + String(x.title).slice(0, 34) + '  마감 ' + x.apply_to
    + (x.apply_to_time ? ' ' + String(x.apply_to_time).slice(0, 5) : ''));
}
if (감출것.length > 10) console.log('    … 그밖 ' + (감출것.length - 10) + '건');

if (!감출것.length) { console.log('\n감출 것이 없습니다'); process.exit(0); }
if (감출것.length > 뚜껑) {
  console.error('\n★ ' + 감출것.length + '건은 뚜껑(' + 뚜껑 + ')을 넘습니다 — 멈춥니다.'
    + '\n  한꺼번에 이만큼 감추는 것은 판정이 잘못됐다는 신호일 수 있습니다.');
  process.exit(1);
}
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 감추려면 --진짜'); process.exit(0); }

/* 창구가 한 번에 받는 양을 모릅니다 — 200개씩 나눠 보냅니다 */
let 감춤 = 0;
for (let i = 0; i < 감출것.length; i += 200) {
  const 토막 = 감출것.slice(i, i + 200).map((x) => x.id);
  const r = await fetch(U + '/rest/v1/rpc/rejudge_hold_apply', {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_secret: SEC, p_show: [], p_hide: 토막, p_why: '마감 지남' }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ rejudge_hold_apply ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
  console.log('  ' + (i + 토막.length) + '/' + 감출것.length + ' — ' + t.slice(0, 160));
  감춤 += 토막.length;
}
console.log('\n감췄습니다 — ' + 감춤 + '건 (hidden_why = 「마감 지남」)');

const 후 = await fetch(U + '/rest/v1/job_posts?select=id&hold=is.true&hidden=is.false&limit=1',
  { headers: { ...H, Prefer: 'count=exact' } });
console.log('보류함 (뒤) — ' + (후.headers.get('content-range') || '?').split('/')[1] + '건');
