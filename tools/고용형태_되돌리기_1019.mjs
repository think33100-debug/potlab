/* 2026-10-19 — 제가 망가뜨린 `employ_type` 을 **칸기록의 옛값으로 되돌립니다**
 *
 *   node tools/고용형태_되돌리기_1019.mjs           무엇이 되돌아갈지만
 *   node tools/고용형태_되돌리기_1019.mjs --진짜    되돌립니다
 *
 * ── 무슨 일이 있었나 ────────────────────────────────────────────
 * 상세 API 를 정찰에 붙이면서 `고용형태판정()` 의 결과를 **글자로 알고**
 * 보냈습니다. 그 함수는 **객체** `{값, 왜}` 를 돌려줍니다. 그래서 회원이 보는
 * 고용형태 칸에 이런 글이 들어갔습니다 —
 *
 *   {"값": "", "왜": "여러 고용형태가 섞인 통합공고라 비웁니다 — …"}
 *   {"값": "계약직", "왜": "기간제"}
 *
 * `칸기록` 표에 `{job_id, 칸, 옛값, 새값, 누가, 바뀐때}` 가 남아 있어서
 * **무엇을 되돌릴지 정확히** 알 수 있습니다 (2026-10-18 에 만든 그 표입니다).
 * 되돌리는 것도 표를 직접 안 쓰고 `칸되메우기` 창구로 합니다 — 그 창구가
 * `edited_fields`·`admin_locked` 를 지키고 `updated_at` 을 안 바꿉니다.
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');
const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?')
      + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 20000) break;
  }
  return out;
}

/* 지난 두 시간 안에 **「첨부 되메우기」가 employ_type 을 JSON 덩어리로** 바꾼 것 */
const 기록 = await 전부('칸기록?select=job_id,옛값,새값,누가,바뀐때'
  + '&칸=eq.employ_type&누가=eq.' + encodeURIComponent('첨부 되메우기')
  + '&order=바뀐때.asc');
const 두시간전 = Date.now() - 2 * 3600e3;
const 망친것 = 기록.filter((x) => new Date(x.바뀐때).getTime() > 두시간전
  && /^\s*\{/.test(String(x.새값 || '')));
console.log('칸기록에서 찾은 **되돌릴 것** ' + 망친것.length + '건');

/* 같은 공고가 여러 번 바뀌었으면 **가장 처음의 옛값**이 진짜 옛값입니다 */
const 되돌릴것 = new Map();
for (const x of 망친것) if (!되돌릴것.has(x.job_id)) 되돌릴것.set(x.job_id, x.옛값);

const 빈옛값 = [...되돌릴것].filter(([, v]) => !v || !String(v).trim());
console.log('  공고 ' + 되돌릴것.size + '건 · 그중 옛값이 비어 있던 것 ' + 빈옛값.length + '건');
if (빈옛값.length) {
  /* 창구는 빈 값으로 안 덮습니다(짐작으로 지우지 않기). 그 칸은 **손으로** 비워야 합니다 */
  console.log('  ★ 옛값이 빈 것은 창구가 되돌릴 수 없습니다 — 따로 적습니다:');
  for (const [id] of 빈옛값.slice(0, 20)) console.log('     ' + id);
}

/* 지금 DB 에 정말 JSON 덩어리가 들어 있는지 **찍어서** 봅니다 (지침 2절) */
const 아이디 = [...되돌릴것.keys()];
const 지금 = [];
for (let i = 0; i < 아이디.length; i += 60) {
  지금.push(...await 전부('job_posts?select=id,org_name,employ_type&id=in.('
    + 아이디.slice(i, i + 60).map(encodeURIComponent).join(',') + ')'));
}
const 아직망친것 = 지금.filter((x) => /^\s*\{/.test(String(x.employ_type || '')));
console.log('\n지금 DB 에 JSON 덩어리가 든 공고 — ' + 아직망친것.length + '건');
for (const x of 아직망친것.slice(0, 6)) {
  console.log('  ' + x.id + ' ' + String(x.org_name).slice(0, 16));
  console.log('     지금 「' + String(x.employ_type).slice(0, 70) + '」');
  console.log('     되돌릴 값 「' + 되돌릴것.get(x.id) + '」');
}

const 줄 = 아직망친것
  .map((x) => ({ id: x.id, employ_type: 되돌릴것.get(x.id) }))
  .filter((x) => x.employ_type && String(x.employ_type).trim());
console.log('\n창구로 되돌릴 것 ' + 줄.length + '건');
if (!줄.length) { console.log('되돌릴 것이 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 되돌리려면 --진짜'); process.exit(0); }

let 함 = 0;
for (let i = 0; i < 줄.length; i += 50) {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 줄.slice(i, i + 50) }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 200)); process.exit(1); }
  함 += 줄.slice(i, i + 50).length;
  console.log('  ' + 함 + '/' + 줄.length + ' — ' + (JSON.parse(t).employ_type || '').slice(0, 60));
}

/* 끝나고 **정말 남은 것이 0인지** 다시 셉니다 (지침 15-2 ③ 전후 숫자) */
const 다시 = [];
for (let i = 0; i < 아이디.length; i += 60) {
  다시.push(...await 전부('job_posts?select=id,employ_type&id=in.('
    + 아이디.slice(i, i + 60).map(encodeURIComponent).join(',') + ')'));
}
const 남음 = 다시.filter((x) => /^\s*\{/.test(String(x.employ_type || '')));
console.log('\n되돌린 뒤 — JSON 덩어리가 남은 공고 ' + 남음.length + '건');
for (const x of 남음.slice(0, 10)) console.log('  ★ ' + x.id + ' 「' + String(x.employ_type).slice(0, 50) + '」');
