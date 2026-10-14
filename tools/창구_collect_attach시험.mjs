/* `collect_attach` 창구가 멀쩡히 도는지 **쏴서** 확인합니다
 * (2026-10-14 · 지침 12절 — 된다/안 된다는 실제 코드로).
 *
 *   node tools/창구_collect_attach시험.mjs
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-10-14 에 `collect_attach` 에서 밤묶음 설정 표를 읽는 두 줄을 뺐습니다
 * (②-0). 그 표를 치우는 ② 를 올리기 전에, 이 창구가 **그 표 없이도 돈다**는
 * 것을 봐야 합니다.
 *
 * 그런데 크론으로는 확인이 안 됩니다 — `tools/첨부담기.mjs` 가
 * `POTJOB_ATTACH_WRITE === '1'` 일 때만 창구를 부르고, 그 변수가 서버
 * `.env` 와 크론에 **없습니다.** 그래서 지금 크론은 이 창구를 안 부릅니다.
 *
 * ── 어떻게 확인하나 (자료를 하나도 안 바꿉니다) ──────────────
 * `job_attachments` 에 **이미 있는 줄**을 그대로 한 번 더 보냅니다.
 * 창구의 `on conflict (job_id, url) do nothing` 때문에
 *   담음 0 · 겹침 1
 * 이 나와야 합니다. 함수가 돌았다는 증거이면서 **새 줄이 안 생깁니다**
 * (지침 8-9 — 시험은 되돌릴 필요가 없는 쪽으로 짭니다).
 *
 * 쓰는 열쇠 — 창구가 service_role 전용이라 SUPABASE_SERVICE_KEY 입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

function env() {
  const out = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(여기, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);   /* 이름 없는 줄은 버립니다 (지침 8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다 — 서버에서 돌리십시오'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* 이미 있는 첨부 한 줄을 고릅니다. 그 줄의 출처(job_posts.source)에 맞는
   열쇠로 쏴야 창구가 받아 줍니다 */
const 읽기 = async (q) => {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + q, { headers: H });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
};

const 줄 = await 읽기('job_attachments?select=job_id,kind,name,url,'
  + encodeURIComponent('수집묶음') + '&order=id.asc&limit=20');
if (!줄.length) { console.error('job_attachments 가 비어 있습니다 — 시험할 줄이 없습니다'); process.exit(1); }

/* 그 공고의 출처를 보고 열쇠를 고릅니다 */
const ids = [...new Set(줄.map((x) => x.job_id))];
const 공고 = await 읽기('job_posts?select=id,source&id=in.(' + ids.map(encodeURIComponent).join(',') + ')');
const 출처별 = {};
for (const j of 공고) (출처별[j.source] ||= []).push(j.id);

const 열쇠이름 = { AL2: 'COLLECT_KEY_AL2', CE2: 'COLLECT_KEY_CE2', GJ2: 'COLLECT_KEY_GJ2', ND2: 'COLLECT_KEY_ND2', HS3: 'COLLECT_KEY_HS3' };
let 고른출처 = null;
for (const s of Object.keys(출처별)) if (cfg[열쇠이름[s] || '']) { 고른출처 = s; break; }
if (!고른출처) {
  console.error('첨부가 달린 공고의 출처 ' + Object.keys(출처별).join('/') + ' 에 맞는 열쇠가 없습니다');
  process.exit(1);
}
const 그줄 = 줄.find((x) => 출처별[고른출처].includes(x.job_id));

console.log('고른 줄 — ' + 그줄.job_id + ' (' + 고른출처 + ')');
console.log('  kind ' + 그줄.kind + ' · name ' + String(그줄.name || '').slice(0, 40));
console.log('  url  ' + String(그줄.url).slice(0, 90));
console.log('  지금 묶음 칸 — ' + (그줄['수집묶음'] ?? 'null'));
console.log('');

const 전 = (await 읽기('job_attachments?select=id&limit=1&order=id.desc'))[0];
const 전체전 = await fetch(cfg.SUPABASE_URL + '/rest/v1/job_attachments?select=id',
  { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
const 전수 = Number((전체전.headers.get('content-range') || '/0').split('/')[1] || 0);

const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/collect_attach', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    p_secret: cfg[열쇠이름[고른출처]], p_source: 고른출처,
    p_rows: [{ job_id: 그줄.job_id, kind: 그줄.kind, name: 그줄.name, url: 그줄.url }],
  }),
});
const t = await r.text();
if (!r.ok) { console.error('✗ collect_attach ' + r.status + ' — ' + t.slice(0, 400)); process.exit(1); }
const 답 = JSON.parse(t);
console.log('창구가 돌았습니다 — ' + JSON.stringify(답));

const 전체후 = await fetch(cfg.SUPABASE_URL + '/rest/v1/job_attachments?select=id',
  { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
const 후수 = Number((전체후.headers.get('content-range') || '/0').split('/')[1] || 0);

const 봐 = [];
if ((답['담음'] ?? -1) !== 0) 봐.push('담음이 0이 아닙니다 (' + 답['담음'] + ') — 새 줄이 생겼습니다');
if ((답['겹침'] ?? -1) !== 1) 봐.push('겹침이 1이 아닙니다 (' + 답['겹침'] + ')');
if ((답['건너뜀'] ?? -1) !== 0) 봐.push('건너뜀이 0이 아닙니다 — 첫탈 ' + 답['첫탈']);
if (답['묶음'] !== null) 봐.push('묶음이 null 이 아닙니다 (' + 답['묶음'] + ')');
if (전수 !== 후수) 봐.push('표 줄 수가 바뀌었습니다 (' + 전수 + ' → ' + 후수 + ')');

console.log('');
console.log('표 줄 수 — 전 ' + 전수 + ' → 후 ' + 후수);
if (봐.length) { console.error('✗ ' + 봐.join(' · ')); process.exit(1); }
console.log('○ 창구가 그 설정 표 없이도 돕니다. 담음 0 · 겹침 1 · 묶음 null ·'
  + ' 표 줄 수 그대로 — **자료를 하나도 안 바꿨습니다**');
