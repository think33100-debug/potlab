/* 목록 줄이 「마감」인데 회원에게 보이는 공고를 **한 번 따라잡아** 내립니다
 * (2026-10-12).
 *
 *   node tools/목록마감_내리기.mjs            마른 실행 — 목록과 근거만 보여줍니다
 *   node tools/목록마감_내리기.mjs --진짜      정말로 내립니다
 *   node tools/목록마감_내리기.mjs --앞글자 GJ  다른 출처로
 *
 * ── 왜 따로 도구가 필요한가 ──────────────────────────────────
 * 규칙은 `alive.mjs` 의 ⑥ 으로 들어갔습니다. 그런데 정찰은
 * `alive_targets` 가 고르는 것만 봅니다 —
 *
 *     and (seen_on is null or seen_on < 오늘 - 6)
 *
 * 즉 **최근 6일 안에 본 공고는 건너뜁니다.** 지금 「목록 줄이 마감」인 8건은
 * 전부 10-07 이나 오늘 정찰이 이미 봤습니다(그때는 ⑥ 이 없었습니다).
 * 그래서 고침만으로는 **최대 6일 더** 회원에게 보입니다.
 *
 * 이 도구가 그 한 번을 메웁니다. 그 뒤로는 정찰이 알아서 합니다.
 *
 * ── 새로 만드는 것이 없습니다 ────────────────────────────────
 *   판정   `hosp/hs_목록상태.mjs` 의 `목록상태()`  ← alive.mjs ⑥ 과 같은 함수
 *   쓰기   DB 의 `alive_mark()` 창구              ← 정찰이 쓰는 그 창구
 * 표에 직접 쓰지 않고, 새 SQL 도 만들지 않습니다 (지침 6절).
 *
 * 까닭 글귀는 **같이 보냅니다** — 「목록 줄에 마감」. `alive_mark` 가 그대로
 * 적습니다 (2026-10-12 마이그레이션 `alive_mark_까닭과뚜껑보호`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 목록상태, 목록상태셈 } from './hosp/hs_목록상태.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인수 = process.argv.slice(2);
const 진짜 = 인수.includes('--진짜');
const 앞글자 = 인수.includes('--앞글자') ? 인수[인수.indexOf('--앞글자') + 1] : 'HS';

function env() {
  const out = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(여기, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);     /* 이름 없는 줄은 버립니다 (지침 8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
/* ALIVE_KEY 는 **쓸 때만** 필요합니다 — 마른 실행은 집에서도 돕니다
   (그 열쇠는 서버 .env 에만 있습니다) */
if (진짜 && !cfg.ALIVE_KEY) { console.error('ALIVE_KEY 가 없습니다 — 서버에서 돌리십시오'); process.exit(1); }
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

async function 전부(길) {
  const 모두 = [];
  let 참값 = null;
  for (let 처음 = 0; ; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items', Prefer: 'count=exact' } });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const cr = r.headers.get('content-range');
    if (cr && cr.includes('/')) 참값 = Number(cr.split('/')[1]);
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) break;
  }
  if (!/order=id\.(asc|desc)/.test(길)) throw new Error('쪽을 넘길 때는 id 로 정렬해야 합니다');
  if (참값 !== null && 모두.length !== 참값) {
    throw new Error('줄 수가 안 맞습니다 — 받은 ' + 모두.length + ' · 실제 ' + 참값);
  }
  return 모두;
}
async function rpc(fn, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* ── 전 숫자 ── */
const 전체 = await 전부('job_posts_pub?select=id,org_name,title,원문제목,apply_to&order=id.asc');
const 볼것 = 전체.filter((v) => String(v.id).startsWith(앞글자) && v.apply_to === null);
console.log('회원 화면 ' + 전체.length + '건 · 그중 ' + 앞글자 + ' 이고 마감일 없는 것 ' + 볼것.length + '건');
console.log(진짜 ? '**정말로 내립니다**' : '마른 실행입니다 — 내리지 않습니다');
console.log('');

const 내릴것 = [];
for (const v of 볼것) {
  const r = await 목록상태(v.org_name, v.원문제목 || v.title);
  if (r.결과 === 'closed') 내릴것.push({ ...v, ...r });
  await new Promise((y) => setTimeout(y, 250));
}

const 목셈 = 목록상태셈();
console.log('── 목록 줄이 「마감」 인 공고 ' + 내릴것.length + '건 ──');
console.log('');
내릴것.forEach((x, i) => {
  console.log((i + 1) + '. [' + x.org_name + '] ' + (x.원문제목 || x.title));
  console.log('    id ' + x.id + ' · 마감일 ' + (x.apply_to || '없음'));
  console.log('    근거 — ' + x.왜);
  console.log('    목록 줄 원문 — ' + String(x.줄글 || '').slice(0, 110));
  console.log('');
});
console.log('목록 — 받은 기관 ' + 목셈.받은곳 + ' · 못 받은 기관 ' + 목셈.못받은곳
  + ' · 판정 ' + Object.entries(목셈.판정).map(([k, v]) => k + ' ' + v).join(' · '));
console.log('');

if (!진짜) {
  console.log('내리려면 --진짜 를 붙이십시오. 지우지 않고 **감추기만** 합니다');
  console.log('(alive_mark 창구가 hidden = true · 까닭을 적습니다. 되살리기는 정찰이 합니다)');
  process.exit(0);
}
if (!내릴것.length) { console.log('내릴 것이 없습니다'); process.exit(0); }

/* 창구는 정찰이 쓰는 그것입니다 — 표에 직접 쓰지 않습니다 */
const 답 = await rpc('alive_mark', {
  p_secret: cfg.ALIVE_KEY,
  p_rows: 내릴것.map((x) => ({ id: x.id, 결과: 'closed', 까닭: '목록 줄에 마감' })),
});
console.log('기록 — ' + Object.entries(답 || {}).map(([k, v]) => k + ' ' + v).join(' · '));

/* ── 후 숫자 ── */
const 후전체 = await 전부('job_posts_pub?select=id&order=id.asc');
console.log('');
console.log('회원 화면  전 ' + 전체.length + '건 → 후 ' + 후전체.length + '건'
  + '  (' + (전체.length - 후전체.length) + '건 내려갔습니다)');
const 남은id = new Set(후전체.map((y) => y.id));
const 아직 = 내릴것.filter((x) => 남은id.has(x.id));
if (아직.length) {
  console.log('⚠ 아직 보이는 것 ' + 아직.length + '건 — ' + 아직.map((x) => x.id).join(' · '));
  console.log('  (admin_locked 이거나 job_edit_now 에서 되살려 둔 줄일 수 있습니다)');
} else {
  console.log('○ 내리려 한 ' + 내릴것.length + '건이 모두 회원 화면에서 빠졌습니다');
}
