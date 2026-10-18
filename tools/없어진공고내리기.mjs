/* **두 번 다 없어짐**으로 판정된 공고를 내립니다 (2026-10-18 세중님 1번)
 *
 *   node tools/없어진공고내리기.mjs --마른      무엇을 내릴지만 보여줍니다 (기본)
 *   node tools/없어진공고내리기.mjs --진짜      내립니다
 *
 * ── 세중님 조건 ──────────────────────────────────────
 *   · **두 번(최소 1시간 간격) 다 「없어짐」** 인 것만 — `없어진공고찾기.mjs --견주기` 가
 *     만든 `~/log/없어짐_내릴목록.json` 을 씁니다. 이 파일을 직접 만들지 않습니다
 *   · `hidden_why = '원문이 없어짐'` (세중님 지정)
 *   · 사이트 오류였던 것은 그 목록에 애초에 안 들어 있습니다
 *
 * ── 안 건드리는 것 ──────────────────────────────────
 *   · `admin_locked` 공고는 **건너뜁니다** — 사람이 손댄 것입니다
 *   · `updated_at` 은 **안 바꿉니다** (지침 9절)
 *   · 이미 숨은 공고는 건너뜁니다
 *
 * ★ 까닭 글귀가 두 벌이 됩니다 — `alive_mark` 의 `gone` 갈래는 같은 일을
 *   **「병원이 내림」** 으로 적습니다. 세중님이 '원문이 없어짐' 을 지정하셔서 그대로
 *   쓰지만, 둘을 하나로 모을지는 세중님이 정할 일입니다 (지침 6절).
 *
 * ★ 21시 뒤에는 돌리지 않습니다 (세중님 — 「21시 뒤엔 기존 공고 바꾸기 없음」).
 *   그 시각이면 `--진짜` 를 거부합니다.
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 목록파일 = '/home/ubuntu/log/없어짐_내릴목록.json';

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
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

const 이제 = new Date(Date.now() + 9 * 3600e3);
const 지금시 = 이제.getUTCHours();
const 오늘 = 이제.toISOString().slice(0, 10);

if (!fs.existsSync(목록파일)) {
  console.error('✗ ' + 목록파일 + ' 이 없습니다 — 먼저 `없어진공고찾기.mjs --견주기` 를 돌리십시오');
  process.exit(1);
}
const 목록 = JSON.parse(fs.readFileSync(목록파일, 'utf8'));
const 것들 = 목록.내릴것 || [];
console.log('내릴 목록 ' + 것들.length + '건 (만든 때 ' + 목록.잰때 + ')');
if (!것들.length) { console.log('내릴 것이 없습니다'); process.exit(0); }

/* 지금 상태를 확인합니다 — 이미 숨었거나 잠긴 것은 뺍니다 */
const ids = 것들.map((x) => x.id);
const 지금 = {};
for (let i = 0; i < ids.length; i += 60) {
  const 조각 = ids.slice(i, i + 60).map(encodeURIComponent).join(',');
  const r = await fetch(U + '/rest/v1/job_posts?select=id,source,org_name,title,hidden,hidden_why,hold,admin_locked,updated_at&id=in.(' + 조각 + ')', { headers: H });
  if (!r.ok) { console.error('✗ ' + r.status + ' ' + (await r.text()).slice(0, 160)); process.exit(1); }
  for (const x of await r.json()) 지금[x.id] = x;
}
const 내릴것 = [];
const 건너뜀 = [];
for (const x of 것들) {
  const n = 지금[x.id];
  if (!n) { 건너뜀.push({ ...x, 왜: '그 공고가 없습니다' }); continue; }
  if (n.admin_locked) { 건너뜀.push({ ...x, 왜: '관리자가 잠갔습니다' }); continue; }
  if (n.hidden) { 건너뜀.push({ ...x, 왜: '이미 숨었습니다 (' + (n.hidden_why ?? 'null') + ')' }); continue; }
  내릴것.push({ ...x, 지금: n });
}
const 출처별 = {};
for (const x of 내릴것) 출처별[x.source] = (출처별[x.source] || 0) + 1;
console.log('\n── 내릴 것 ' + 내릴것.length + '건 ──');
console.log('  출처별: ' + (Object.entries(출처별).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · ') || '(없음)'));
for (const x of 내릴것.slice(0, 20)) {
  console.log('     ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16) + ' | ' + String(x.title).slice(0, 26));
  console.log('        ' + x.왜);
}
if (내릴것.length > 20) console.log('     … 그밖 ' + (내릴것.length - 20) + '건');
if (건너뜀.length) {
  console.log('\n── 건너뜀 ' + 건너뜀.length + '건 ──');
  const 왜별 = {};
  for (const x of 건너뜀) 왜별[x.왜] = (왜별[x.왜] || 0) + 1;
  for (const [w, n] of Object.entries(왜별)) console.log('     ' + String(n).padStart(3) + '건  ' + w);
}

const 셈 = async (때) => {
  const r = await fetch(U + '/rest/v1/job_posts_pub?select=id', { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const n = (r.headers.get('content-range') || '').split('/')[1];
  console.log('  회원 화면 (' + 때 + ') ' + n + '건');
  return n;
};

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿉니다 — 내리려면 --진짜');
  await 셈('지금');
  process.exit(0);
}
if (지금시 >= 21) {
  console.error('\n✗ 지금 ' + 지금시 + '시입니다 — **21시 뒤에는 기존 공고를 바꾸지 않습니다** (세중님).');
  console.error('  내일 아침에 돌리십시오.');
  process.exit(1);
}

const 전 = await 셈('전');
let 바뀜 = 0;
for (let i = 0; i < 내릴것.length; i += 50) {
  const 조각 = 내릴것.slice(i, i + 50).map((x) => encodeURIComponent(x.id)).join(',');
  const r = await fetch(U + '/rest/v1/job_posts?id=in.(' + 조각 + ')&hidden=is.false&admin_locked=is.false', {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ hidden: true, hold: false, hidden_why: '원문이 없어짐', hidden_on: 오늘 }),
  });
  if (!r.ok) { console.error('✗ ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
  바뀜 += (await r.json()).length;
}
console.log('\n내렸습니다 — ' + 바뀜 + '건 (hidden_why = 「원문이 없어짐」 · updated_at 은 안 바꿨습니다)');
const 후 = await 셈('후');
console.log('\n되돌리기 — 그 ' + 바뀜 + '건에 hidden=false, hidden_why=null, hidden_on=null');
console.log('  목록은 ' + 목록파일 + ' 에 남아 있습니다');
console.log('회원 화면 ' + 전 + ' → ' + 후);
