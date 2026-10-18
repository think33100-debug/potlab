/* 경기도의료원 수원병원 공고의 **지워진 접수마감**을 되메웁니다
 *   (2026-10-19 세중님 ① 승인 · 칸기록이 잡은 첫 피해)
 *
 *   node tools/수원병원_마감일되메우기.mjs          무엇을 넣을지만 (기본)
 *   node tools/수원병원_마감일되메우기.mjs --진짜   넣습니다
 *
 * ── 근거 ────────────────────────────────────────────────────────
 * 원문 https://www.medical.or.kr/front/boardView.do?brd_mgrno=227&menu_no=731&brd_no=100725
 * 을 2026-10-19 에 열어 받은 글 그대로 —
 *
 *   ○ 채용분야 : 장애인 의료기관 이용편의지원사업 - 작업치료사
 *   ○ 채용인원 : 1명     ○ 근무부서 : 재활치료센터(물리치료실)
 *   ○ 모집기간 : 2026. 10. 12.(월) ~ **2026. 10. 22.(목) 12:00**
 *
 * 칸기록이 「2026-10-22 → (빈값) · 수집기 HS3」 으로 적어 둔 그 값과 같습니다.
 * **짐작이 아닙니다** (지침 3절 · 10-2).
 *
 * ★ 마감일·마감시각만 넣습니다. 모집인원(1명)·근무지도 원문에 있지만 이번 승인
 *   범위가 아닙니다 — 그것은 ③ 칸뽑기 연결로 한꺼번에 들어옵니다.
 * ★ 창구(`칸되메우기`)로만 넣습니다. 표를 직접 쓰지 않고 `updated_at` 도
 *   바뀌지 않습니다. 창구가 `apply_to is null` 일 때만 채우고
 *   `admin_locked`·`edited_fields` 를 지킵니다 — 봤습니다(prosrc 21~28행).
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');

const 줄 = [{
  id: 'HS877732990',
  apply_to: '2026-10-22',
  apply_to_time: '12:00',
  '뽑은값': {
    공고문_접수마감: '2026-10-22',
    공고문_접수시각: '12:00',
    근거: {
      접수마감: '원문 「○ 모집기간 : 2026. 10. 12.(월) ~ 2026. 10. 22.(목) 12:00」 (2026-10-19 사람이 열어 확인)',
      접수시각: '같은 줄의 12:00',
    },
    읽은법: '사람이 원문 확인 (칸기록이 잡은 피해 되메우기 · 세중님 2026-10-19 승인)',
  },
}];

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
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

/* 넣기 전에 **지금 값**을 봅니다 — 이미 차 있으면 창구가 안 건드리지만 보고에 적습니다 */
const 전 = await fetch(U + '/rest/v1/job_posts?id=eq.HS877732990'
  + '&select=id,org_name,title,apply_to,apply_to_time,hidden,hold,admin_locked,edited_fields', { headers: H });
const 전줄 = (await 전.json())[0];
if (!전줄) { console.error('✗ 그 공고가 없습니다'); process.exit(1); }
console.log('지금 — ' + 전줄.org_name + ' | ' + String(전줄.title).slice(0, 40));
console.log('  apply_to ' + (전줄.apply_to || '(빈칸)')
  + ' · apply_to_time ' + (전줄.apply_to_time || '(빈칸)')
  + ' · hidden ' + 전줄.hidden + ' · admin_locked ' + 전줄.admin_locked
  + ' · edited_fields ' + JSON.stringify(전줄.edited_fields));
console.log('\n넣을 것 — apply_to 2026-10-22 · apply_to_time 12:00');
console.log('근거 — 원문 「○ 모집기간 : 2026. 10. 12.(월) ~ 2026. 10. 22.(목) 12:00」');

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 넣으려면 --진짜'); process.exit(0); }

const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
  method: 'POST', headers: H, body: JSON.stringify({ p_rows: 줄 }),
});
const t = await r.text();
if (!r.ok) { console.error('\n✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
console.log('\n창구가 답한 것 — ' + t.slice(0, 200));

const 후 = await fetch(U + '/rest/v1/job_posts?id=eq.HS877732990'
  + '&select=apply_to,apply_to_time,updated_at', { headers: H });
const 후줄 = (await 후.json())[0];
console.log('뒤 — apply_to ' + (후줄.apply_to || '(빈칸)')
  + ' · apply_to_time ' + (후줄.apply_to_time || '(빈칸)'));
console.log('updated_at ' + 후줄.updated_at + ' (창구가 안 바꿉니다)');
