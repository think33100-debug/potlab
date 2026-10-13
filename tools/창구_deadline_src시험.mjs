/* `collect_put` 이 `deadline_src` 를 정말 담는지 **쏴서** 확인합니다
 * (2026-10-13 · 지침 12절 — 실제 코드로 확인).
 *
 *   node tools/창구_deadline_src시험.mjs            마른 실행 (아무것도 안 바꿉니다)
 *   node tools/창구_deadline_src시험.mjs --진짜      두 갈래를 쏘고 **되돌립니다**
 *
 * ── 왜 시험이 따로 필요한가 ──────────────────────────────────
 * 수집기를 넷 돌려 봤지만 증명이 안 됐습니다 —
 *   · 워크넷 235건은 **다 기존 줄**이고 마감일이 안 바뀌어서, 규칙대로
 *     `deadline_src` 를 안 건드렸습니다 (apply_to 가 바뀔 때만 바꿉니다)
 *   · 병원 수집기가 넣은 새 줄은 **마감일이 없는 공고**였습니다 → null 이 맞습니다
 * 그래서 「담기는가」를 못 봤습니다. 「돌려 봤는데 0이다」로 끝내면 안 됩니다.
 *
 * ── 어떻게 증명하나 ──────────────────────────────────────────
 * **감춰진 줄 하나**를 골라 창구로 두 번 쏩니다. 회원 화면에 안 보이는 줄이라
 * 그 사이에도 회원에게 보이는 것이 없습니다.
 *
 *   ① 마감일을 **하루 옮기고** deadline_src 를 함께 보냅니다
 *      → apply_to 가 바뀌었으니 deadline_src 가 **차야** 합니다
 *   ② 마감일을 **원래대로** 되돌리고 deadline_src 는 null 로 보냅니다
 *      → apply_to 가 또 바뀌었으니 deadline_src 가 **비워져야** 합니다
 *   ③ 같은 줄을 **마감일 그대로** 한 번 더 쏩니다 (deadline_src 를 넣어서)
 *      → apply_to 가 안 바뀌었으니 deadline_src 가 **안 차야** 합니다
 *         (세중님이 정한 「마감일과 출처가 늘 짝이 맞게」 가 그것입니다)
 *
 * 셋이 다 맞아야 통과입니다. 끝에 원래 값으로 돌아왔는지 다시 읽어 확인합니다.
 *
 * **고르는 줄** — `hidden = true` · `source = 'HS3'` · `apply_to` 가 있고
 * `admin_locked` 아니고 `edited_fields` 에 apply_to 가 없는 줄.
 * 회원에게 안 보이고, 관리자가 손댄 줄도 아닙니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 진짜 = process.argv.includes('--진짜');

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
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'COLLECT_KEY_HS3']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다 — 서버에서 돌리십시오'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

const 읽기 = async (q) => {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + q, { headers: H });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
};
const 쏘기 = async (줄) => {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/collect_put', {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: cfg.COLLECT_KEY_HS3, p_source: 'HS3', p_rows: [줄] }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('collect_put ' + r.status + ' ' + t.slice(0, 300));
  return JSON.parse(t);
};

/* ── 시험할 줄 고르기 ── */
const 고른것 = await 읽기('job_posts?select=id,org_name,title,url,apply_to,apply_from,deadline_src,'
  + 'source,hidden,hold,admin_locked,edited_fields,job_group,tab,org_kind'
  + '&source=eq.HS3&hidden=is.true&admin_locked=is.false&apply_to=not.is.null'
  + '&order=id.asc&limit=1');
if (!고른것.length) { console.error('시험할 줄을 못 찾았습니다'); process.exit(1); }
const j = 고른것[0];
if ((j.edited_fields || []).includes('apply_to')) {
  console.error('고른 줄에 apply_to 가 손으로 고쳐져 있습니다 — 다른 줄을 고르십시오');
  process.exit(1);
}

const 원래마감 = j.apply_to;
const 원래출처 = j.deadline_src;
const 하루뒤 = new Date(new Date(원래마감 + 'T00:00:00Z').getTime() + 86400e3)
  .toISOString().slice(0, 10);

console.log('시험할 줄 — ' + j.id + ' · ' + String(j.org_name).slice(0, 20));
console.log('  제목 ' + String(j.title).slice(0, 44));
console.log('  hidden ' + j.hidden + ' · hold ' + j.hold + ' (회원 화면에 안 보입니다)');
console.log('  원래 apply_to ' + 원래마감 + ' · deadline_src ' + (원래출처 ?? 'null'));
console.log('');
if (!진짜) {
  console.log('마른 실행입니다. --진짜 를 붙이면 아래 셋을 쏘고 **되돌립니다** —');
  console.log('  ① 비어 있음 + 마감일 ' + 하루뒤 + ' + 출처 「시험」    → 차야 합니다');
  console.log('  ③ 차 있음  + 마감일 ' + 하루뒤 + ' (그대로) + 「시험2」 → 안 바뀌어야 합니다');
  console.log('  ② 마감일 ' + 원래마감 + ' 로 되돌리고 출처 없음        → 비워져야 합니다');
  console.log('  ④ 비어 있음 + 마감일 ' + 원래마감 + ' (같음) + 「시험4」  → 차야 합니다 (새 규칙)');
  process.exit(0);
}

/* 창구에 보낼 줄 — 지금 값을 그대로 싣고 마감일·출처만 바꿉니다.
   다른 칸을 비우면 창구가 그 칸을 null 로 덮습니다 */
const 틀 = (마감, 출처) => ({
  id: j.id, org_name: j.org_name, title: j.title, url: j.url,
  apply_from: j.apply_from, apply_to: 마감,
  job_group: j.job_group, tab: j.tab, org_kind: j.org_kind,
  hidden: j.hidden, hold: j.hold,
  ...(출처 ? { deadline_src: 출처 } : {}),
});
const 지금 = async () => (await 읽기('job_posts?select=apply_to,deadline_src,updated_at&id=eq.'
  + encodeURIComponent(j.id)))[0];

const 결과 = [];
결과.push(['① 비어 있을 때 마감일이 바뀌며 출처를 보내면 찬다', await 쏘기(틀(하루뒤, '시험')), await 지금()]);
/* ★ ③ 을 먼저 봅니다 — 지금 출처가 **차 있는** 상태입니다.
   차 있을 때 마감일이 그대로면 안 바뀌어야 합니다 */
결과.push(['③ 차 있고 마감일이 그대로면 출처를 보내도 안 바뀐다', await 쏘기(틀(하루뒤, '시험2')), await 지금()]);
결과.push(['② 마감일을 되돌리고 출처를 안 보내면 비워진다', await 쏘기(틀(원래마감, null)), await 지금()]);
/* ★ 2026-10-13 세중님이 규칙을 고치셔서 더한 갈래 —
   비어 있으면 **같은 날짜라도** 출처를 받아 채웁니다 */
결과.push(['④ 비어 있고 마감일이 같아도 출처를 보내면 찬다', await 쏘기(틀(원래마감, '시험4')), await 지금()]);
/* 되돌리기 — 출처를 원래대로. 지금 차 있고 마감일이 그대로라 창구로는 못 지웁니다.
   (그게 ③ 규칙입니다) 그래서 원래 값이 null 이면 **손으로** 비웁니다 */

console.log('── 쏘고 읽은 것 ──');
for (const [이름, 답, 뒤] of 결과) {
  console.log('  ' + 이름);
  console.log('     창구 — ' + JSON.stringify(답));
  console.log('     지금 — apply_to ' + 뒤.apply_to + ' · deadline_src ' + (뒤.deadline_src ?? 'null'));
}

/* 원래 출처로 되돌립니다. 지금은 '시험4' 가 차 있고 마감일이 그대로라
   창구로는 못 지웁니다(③ 규칙) — 그래서 표를 직접 고칩니다.
   **시험이 남긴 것을 같은 작업 안에서 치웁니다** (지침 8-9) */
await fetch(cfg.SUPABASE_URL + '/rest/v1/job_posts?id=eq.' + encodeURIComponent(j.id), {
  method: 'PATCH',
  headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ deadline_src: 원래출처 }),
});

const 끝 = await 지금();
const 봐 = [];
if (결과[0][2].deadline_src !== '시험') 봐.push('① 출처가 안 찼습니다');
if (결과[1][2].deadline_src !== '시험') 봐.push('③ 차 있는데 출처가 바뀌었습니다 (' + 결과[1][2].deadline_src + ')');
if (결과[2][2].deadline_src !== null) 봐.push('② 출처가 안 비워졌습니다');
if (결과[3][2].deadline_src !== '시험4') 봐.push('④ 비어 있고 같은 날짜인데 출처가 안 찼습니다');
if (끝.apply_to !== 원래마감) 봐.push('★ 마감일이 원래대로 안 돌아왔습니다 (' + 끝.apply_to + ')');
if ((끝.deadline_src ?? null) !== (원래출처 ?? null)) {
  봐.push('★ 출처가 원래대로 안 돌아왔습니다 (' + (끝.deadline_src ?? 'null') + ')');
}

console.log('');
if (봐.length) { console.error('✗ ' + 봐.join(' · ')); process.exit(1); }
console.log('○ 넷 다 맞습니다. 마감일은 원래대로(' + 끝.apply_to + ') · 출처는 '
  + (끝.deadline_src ?? 'null') + ' 입니다');
console.log('   (원래 출처가 ' + (원래출처 ?? 'null') + ' 였으니 그대로입니다)');
