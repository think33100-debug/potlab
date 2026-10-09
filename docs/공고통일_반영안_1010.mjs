/* 공고 통일 반영안 — 2026-10-10 · **아직 안 돌렸습니다** (승인대기 ⑭)
 *
 *   node docs/공고통일_반영안_1010.mjs            마른 실행 (아무것도 안 바꿈)
 *   node docs/공고통일_반영안_1010.mjs --정말      정말로 넣습니다
 *   node docs/공고통일_반영안_1010.mjs --되돌리기   넣기 전 값으로 되돌립니다
 *
 * ── 무엇을 넣나 ─────────────────────────────────────────────
 *   docs/공고통일_반영안_1010.json 의 줄을 `job_posts.뽑은값` 에 넣습니다.
 *   **원문 `detail` 은 안 건드립니다.** 화면은 뽑은값을 먼저 보고 없으면 detail 을 봅니다.
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · `updated_at` 을 **안 바꿉니다** (작업지침 9절 — 알림·다리가 그 값을 봅니다).
 *     job_posts 에 updated_at 트리거가 없는 것을 확인했습니다 (2026-10-10).
 *   · `edited_fields` 가 걸린 칸은 **아예 안 넣습니다** (사람이 정한 값).
 *     `빈칸채우기()` 창구는 넣으면서 edited_fields 에 **잠금을 겁니다** —
 *     그건 「관리자가 손으로 고친 값」 전용이라 여기서는 안 씁니다.
 *     기계가 읽은 값은 다음 수집 때 더 나은 값으로 덮일 수 있어야 합니다.
 *   · `admin_locked` 공고는 통째로 건너뜁니다.
 *   · 넣기 **전 값을 파일로 남깁니다** — 되돌릴 수 있어야 합니다.
 *
 * ── 넣은 뒤에 화면이 바뀌려면 ───────────────────────────────
 *   지원자격 · 예상 연봉 — **바로 보입니다** (화면이 이미 뽑은값을 먼저 봅니다).
 *   모집 인원 — **한 줄을 고쳐야 합니다.** 지금 화면은 `headcount` 만 봅니다 —
 *     web/app/jobs/[id]/page.tsx
 *       {j.headcount != null && <Core … v={`${j.headcount}명`} />}
 *     → 뽑은값의 모집인원도 보게 (지원자격·연봉과 같은 꼴로) 고쳐야 합니다.
 *     그 한 줄이 **이 반영의 절반**입니다. 안 고치면 275건 중 모집인원이 안 보입니다.
 *   접수마감 · 근무지 — `apply_to`·`work_place` 를 보므로 뽑은값으로는 안 바뀝니다.
 *     이 둘은 **수집기가 채우는 칸**이라 반영안에서 뺐습니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 정말 = process.argv.includes('--정말');
const 되돌리기 = process.argv.includes('--되돌리기');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.'); process.exit(2); }
const 머리 = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const 되돌림파일 = path.join(뿌리, 'tmp', '반영_되돌림_1010.json');

/* ── 되돌리기 ───────────────────────────────────────────── */
if (되돌리기) {
  if (!fs.existsSync(되돌림파일)) { console.error('되돌림 파일이 없습니다 — ' + 되돌림파일); process.exit(1); }
  const 전 = JSON.parse(fs.readFileSync(되돌림파일, 'utf8'));
  let n = 0;
  for (const x of 전.줄) {
    const r = await fetch(`${URL_}/rest/v1/job_posts?id=eq.${encodeURIComponent(x.id)}`, {
      method: 'PATCH', headers: { ...머리, Prefer: 'return=minimal' },
      body: JSON.stringify({ 뽑은값: x.뽑은값, 뽑은법: x.뽑은법, 뽑은때: x.뽑은때 }),
    });
    if (r.ok) n++;
  }
  console.log(`되돌린 줄 ${n}/${전.줄.length}`);
  process.exit(0);
}

/* ── 넣기 ───────────────────────────────────────────────── */
const 반영 = JSON.parse(fs.readFileSync(path.join(여기, '공고통일_반영안_1010.json'), 'utf8'));
console.log(`반영안 ${반영.건수}건` + (정말 ? '' : ' · **마른 실행** (아무것도 안 바꿉니다)'));

/* 지금 값을 먼저 받아 둡니다 — 되돌리기용 + edited_fields 다시 확인 */
const 번호들 = 반영.줄.map((x) => x.id);
const 지금 = [];
for (let i = 0; i < 번호들.length; i += 50) {
  const 조각 = 번호들.slice(i, i + 50).map(encodeURIComponent).join(',');
  const r = await fetch(`${URL_}/rest/v1/job_posts`
    + `?select=id,뽑은값,뽑은법,뽑은때,edited_fields,admin_locked&id=in.(${조각})`, { headers: 머리 });
  지금.push(...await r.json());
}
const 지금집 = new Map(지금.map((x) => [x.id, x]));

const 할것 = [];
const 건너뜀 = [];
for (const x of 반영.줄) {
  const 옛 = 지금집.get(x.id);
  if (!옛) { 건너뜀.push({ id: x.id, 왜: '공고가 없어졌습니다' }); continue; }
  if (옛.admin_locked) { 건너뜀.push({ id: x.id, 왜: 'admin_locked' }); continue; }
  const 잠김 = new Set(옛.edited_fields ?? []);
  /* 접수마감 · 근무지는 수집기가 채우는 칸이라 뽑은값으로 안 넣습니다 */
  const 넣을칸 = Object.fromEntries(Object.entries(x.뽑은값)
    .filter(([k]) => ['모집인원', '지원자격', '예상연봉'].includes(k))
    .filter(([k]) => !잠김.has(k))
    .map(([k, v]) => [k, v]));
  if (!Object.keys(넣을칸).length) { 건너뜀.push({ id: x.id, 왜: '넣을 칸 없음(잠김·해당 없음)' }); continue; }
  할것.push({ id: x.id, 옛: { 뽑은값: 옛.뽑은값, 뽑은법: 옛.뽑은법, 뽑은때: 옛.뽑은때 },
    새: { ...(옛.뽑은값 ?? {}), ...넣을칸 }, 칸: Object.keys(넣을칸) });
}

const 칸셈 = {};
for (const x of 할것) for (const k of x.칸) 칸셈[k] = (칸셈[k] ?? 0) + 1;
console.log(`  넣을 공고 ${할것.length}건 · 건너뛸 것 ${건너뜀.length}건`);
console.log('  칸별 — ' + Object.entries(칸셈).map(([k, v]) => `${k} ${v}`).join(' · '));

if (!정말) {
  console.log('\n--정말 을 주면 넣습니다. 지금은 아무것도 안 바꿨습니다.');
  console.log('넣기 전 값은 --정말 때 tmp/반영_되돌림_1010.json 에 남깁니다.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(되돌림파일), { recursive: true });
fs.writeFileSync(되돌림파일, JSON.stringify({
  만든때: new Date().toISOString(),
  줄: 할것.map((x) => ({ id: x.id, ...x.옛 })),
}, null, 1) + '\n');
console.log('  되돌림 파일 → ' + path.relative(뿌리, 되돌림파일));

let 넣음 = 0; const 탈 = [];
for (const x of 할것) {
  const r = await fetch(`${URL_}/rest/v1/job_posts?id=eq.${encodeURIComponent(x.id)}`, {
    method: 'PATCH', headers: { ...머리, Prefer: 'return=minimal' },
    /* updated_at 을 **안 적습니다** — 건드리면 알림·다리가 움직입니다 */
    body: JSON.stringify({ 뽑은값: x.새, 뽑은법: '공고문', 뽑은때: new Date().toISOString() }),
  });
  if (r.ok) 넣음++; else 탈.push({ id: x.id, HTTP: r.status, 왜: (await r.text()).slice(0, 120) });
}
console.log(`\n넣은 줄 ${넣음}/${할것.length}` + (탈.length ? ` · 탈 ${탈.length}` : ''));
for (const t of 탈.slice(0, 5)) console.error('  ✗ ' + t.id + ' · ' + t.HTTP + ' ' + t.왜);
console.log('되돌리려면 — node docs/공고통일_반영안_1010.mjs --되돌리기');
