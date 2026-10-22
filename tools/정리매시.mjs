/* 마감 지난 공고를 **매시** 내립니다 (2026-10-17 세중님 승인 ②).
 *
 *   node tools/정리매시.mjs          hide_stale_posts 를 부릅니다
 *   node tools/정리매시.mjs --마른    부르지 않고 **무엇이 움직일지만** 셉니다
 *   node tools/정리매시.mjs --자기점검  「마감이 지났나」 규칙만 시험합니다
 *
 * ── 왜 ───────────────────────────────────────────────
 * 지금은 **밤정리(23:00 KST)** 가 하루 한 번만 내립니다. 그래서 09:00 에 마감된
 * 공고가 **14시간** 회원 화면에 남습니다. 2026-10-17 에 실제로 그랬습니다.
 * 세중님 기준은 「한 건이라도 회원에게 마감 공고가 보이면 안 됩니다」 입니다.
 *
 * ── 밤정리와 무엇이 다른가 ──────────────────────────────
 * 밤정리는 ① job_events 3개월 지난 것 **지우기** + ② hide_stale_posts 입니다.
 * 이 스크립트는 **②만** 부릅니다 — 지우는 일을 매시 돌리지 않습니다.
 *
 * ★ 그래도 hide_stale_posts 는 **갈래가 다섯**이라 전부 매시 돕니다 —
 *   ① 마감 지남 · ② 날수 지남(30일) · ②-2 날수 뚜껑(90일) ·
 *   ③ 마감 늘어남 되살리기 · ④ 정찰 살아있음 되살리기
 *   그래서 ②·②-2 가 **밤이 아니라 그날 아침에** 걸립니다 (31일째 밤 → 31일째 아침).
 *   2026-10-17 09:45 KST 마른 실행에서 다섯 갈래 모두 0건이라 지금 움직이는 줄은
 *   없지만, **「숨기기만 매시」가 아니라 「hide_stale_posts 전체가 매시」** 입니다.
 *   세중님께 이 점을 알리고 올립니다.
 *
 * ── 인수 ───────────────────────────────────────────
 * `(30, 180)` — 밤정리(sql/2026-10-09_밤정리_대화보관.sql:113)와 **같은 값**입니다.
 * 기준을 두 벌로 만들지 않습니다 (지침 6절). p_rolling_days 는 함수가 안 씁니다.
 *
 * .env 는 셸로 source 하지 않고 node 로 읽습니다 (지침 8-12).
 */
import { 차례붙이기 } from './쪽나눠받기.mjs';
import fs from 'node:fs';

const 마른 = process.argv.includes('--마른');
const 점검 = process.argv.includes('--자기점검');

/* 「마감이 지났나」는 **tools/마감지남.mjs 한 자리**입니다 (2026-10-22).
   여기 있던 것을 떼어 냈습니다 — 보류함 정리 도구가 **아홉 시간 틀린 사본**을
   쓰고 있었고, 그 사본 때문에 보류함 공고가 회원 화면으로 샜습니다.
   `--자기점검` 은 그대로 돕니다(10가지). */
import { 지났나 } from './마감지남.mjs';
export { 지났나 };

if (점검) {
  /* 규칙이 옮겨 갔습니다 — 같은 시험을 그 파일에서 돕니다 */
  const 어겼나 = [];
  const 봐 = (이름, 참) => { if (!참) 어겼나.push(이름); };
  const 이제 = new Date('2026-10-17T09:45:00+09:00');
  봐('어제 마감은 지났다', 지났나('2026-10-16', null, 이제));
  봐('오늘 09:00 마감은 지났다', 지났나('2026-10-17', '09:00:00', 이제));
  봐('오늘 17:30 마감은 안 지났다', !지났나('2026-10-17', '17:30:00', 이제));
  봐('오늘 시각없음은 안 지났다', !지났나('2026-10-17', null, 이제));
  봐('내일 마감은 안 지났다', !지났나('2026-10-18', '09:00:00', 이제));
  봐('마감일 없으면 안 지났다', !지났나(null, '09:00:00', 이제));
  봐('날짜 꼴이 아니면 안 지났다', !지났나('수시', null, 이제));
  봐('어제 23:59 는 지났다', 지났나('2026-10-16', '23:59:00', 이제));
  if (어겼나.length) { console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과 — 마감 지남 규칙 8가지 (화면 isClosed 와 같은 규칙)');
  process.exit(0);
}

const cfg = {};
/* 한글 경로가 섞여도 되게 file: URL 로 집습니다 — pathname 을 쓰면 %EB… 로 깨집니다 */
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);            /* 이름 없는 줄은 버립니다 */
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL, K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const 머리 = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const 가리고 = (s) => String(s).split(K).join('‹열쇠›');          /* 지침 8-11 */

const 이제 = new Date();
const 때 = new Date(이제.getTime() + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');

/* 쪽을 넘겨 다 받습니다 — 서버가 한 번에 주는 줄 수를 믿지 않습니다 */
async function 다(path_) {
  path_ = 차례붙이기(path_);   /* 차례가 고유해야 줄이 안 샙니다 — 이것은 **매시 크론**입니다 (2026-10-19) */
  const 모 = []; let off = 0;
  for (;;) {
    const r = await fetch(`${U}/rest/v1/${path_}&limit=1000&offset=${off}`, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + 가리고((await r.text()).slice(0, 200)));
    const a = await r.json();
    모.push(...a);
    if (!a.length) return 모;
    off += a.length;
    if (off > 200000) throw new Error('너무 많습니다 — 멈춥니다');
  }
}

if (마른) {
  const 보이는 = await 다('job_posts?select=id,org_name,title,apply_to,apply_to_time,admin_locked&hidden=is.false&hold=is.false&apply_to=not.is.null');
  const 내려갈 = 보이는.filter((p) => 지났나(p.apply_to, p.apply_to_time, 이제));
  console.log(`${때} KST · --마른 (아무것도 안 바꿉니다)`);
  console.log(`  보이는 공고(마감일 있음) ${보이는.length}건 중 **마감 지난 것 ${내려갈.length}건**`
    + ` (그중 잠김 ${내려갈.filter((p) => p.admin_locked).length})`);
  for (const p of 내려갈.slice(0, 20))
    console.log(`    · ${p.id} ${p.org_name} / ${String(p.title).slice(0, 30)} / ${p.apply_to} ${p.apply_to_time || '(시각없음)'} 잠김=${p.admin_locked}`);
  console.log('  ※ 날수·뚜껑·되살리기 갈래는 DB 안에서만 셉니다 — 여기서는 안 셉니다');
  process.exit(0);
}

const r = await fetch(`${U}/rest/v1/rpc/hide_stale_posts`, {
  method: 'POST', headers: 머리,
  body: JSON.stringify({ p_days: 30, p_rolling_days: 180 }),   /* 밤정리와 같은 값 */
});
const 글 = 가리고(await r.text());
if (!r.ok) { console.error(`${때} KST · ✗ ${r.status} ${글.slice(0, 300)}`); process.exit(1); }
console.log(`${때} KST · ${글}`);
