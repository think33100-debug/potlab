/* ★ 긁기(HS4)가 **HS3 와 같은 공고를 두 벌** 담은 것을 치웁니다 (2026-10-24 밤)
 *
 *   node tools/긁기/겹침치우기.mjs            봅니다 (마른)
 *   node tools/긁기/겹침치우기.mjs --진짜      숨깁니다
 *
 * ── 무슨 일이 있었나 (제 잘못입니다) ───────────────────────
 * 139곳을 「긁기 후보」로 보고 HS4 로 긁었는데, **136곳이 이미 HS3 분모**이고
 * HS3·HS 공고도 있는 곳이었습니다 (2026-10-24 밤에 대 봤습니다).
 * 그래서 HS4 29건 가운데 **19건이 HS3 공고와 같은 공고**입니다.
 *
 * 회원 화면은 0건이라 회원에게 보인 것은 없지만, **보류함에 두 벌**이 쌓였습니다 —
 * 세중님이 한 건씩 보는 자리입니다. 그래서 치웁니다.
 *
 * ── 치우는 길 ───────────────────────────────────────────────
 * 창구를 새로 만들지 않습니다 — `rejudge_hold_apply(p_secret, p_show, p_hide, p_why)`
 * 가 이미 그 일을 합니다 (`보류함_마감지남정리.mjs` 가 쓰는 그것). 지우지 않고
 * **숨깁니다** — 까닭이 남고 되살릴 수 있습니다.
 *
 * ★ 겹침 기준: **같은 기관(이름키) + 제목 글자(한글·숫자·영문만)** 가 같은 HS3·HS 공고.
 *   좁게 잡습니다 — 애매하면 안 치웁니다.
 */
import { 설정, 글자만, 이름글자, 겹치나, 겹침표 } from './공통.mjs';

const 진짜 = process.argv.includes('--진짜');

/* 자기점검 — 겹침 자가 맞나 (DB 를 안 봅니다) */
if (process.argv.includes('--자기점검')) {
  const 셋 = new Set(['포항세명기독병원|작업치료사채용공고', 'N:ORG1|물리치료사채용']);
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('같은 기관+같은 제목은 겹침',
    겹치나(셋, { org_name: '포항세명기독병원', title: '[작업치료사] 채용 공고' }));
  보('법인말이 붙어도 겹침',
    겹치나(셋, { org_name: '의료법인 포항세명기독병원', title: '작업치료사 채용공고' }));
  보('기관번호로도 겹침', 겹치나(셋, { org_name: '다른이름', title: '물리치료사 채용', 기관번호: 'ORG1' }));
  보('제목이 다르면 안 겹침',
    !겹치나(셋, { org_name: '포항세명기독병원', title: '작업치료사 2차 채용공고' }));
  보('기관이 다르면 안 겹침',
    !겹치나(셋, { org_name: '성남시의료원', title: '작업치료사 채용공고' }));
  보('제목이 비면 안 겹침', !겹치나(셋, { org_name: '포항세명기독병원', title: '' }));
  보('이름글자가 법인말을 뗀다', 이름글자('의료법인 구병원') === 글자만('구병원'));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}
const cfg = 설정();
const 열쇠 = cfg.COLLECT_KEY_HS4;
const 섬김 = cfg.SUPABASE_SERVICE_KEY;
if (!cfg.SUPABASE_URL || !섬김 || !열쇠) { console.error('✗ 열쇠가 모자랍니다'); process.exit(1); }
const H = { apikey: 섬김, Authorization: 'Bearer ' + 섬김, 'Content-Type': 'application/json' };
const 다받아 = async (길) => {
  const out = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길 + '&order=id.asc&limit=100&offset=' + off,
      { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 150));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 20000) break;
  }
  return out;
};
/* 겹침 자는 **담는 자리와 같은 것**을 씁니다 — `공통.mjs` 한 자리 (지침 6-3) */
const 셋 = await 겹침표(cfg);
const HS4 = await 다받아('job_posts?select=id,org_name,title,hold,hidden,기관번호&source=eq.HS4');
console.log('HS3·HS 열쇠 ' + 셋.size + '개 · HS4 공고 ' + HS4.length + '건');

/* 짝 아이디는 보여 주기용으로 한 번 더 받습니다 (까닭을 눈으로 보게) */
const 짝표 = new Map();
for (const x of await 다받아('job_posts?select=id,org_name,title&source=in.(HS3,HS)')) {
  짝표.set(이름글자(x.org_name) + '|' + 글자만(x.title), x.id);
}
const 겹친것 = HS4.filter((x) => 겹치나(셋, x))
  .map((x) => ({ ...x, 짝: 짝표.get(이름글자(x.org_name) + '|' + 글자만(x.title)) || '(번호로 겹침)' }));
console.log('\n겹친 것 **' + 겹친것.length + '건** (같은 기관 + 같은 제목 글자)');
for (const x of 겹친것) {
  console.log('  ' + x.id.padEnd(22) + '← ' + x.짝.padEnd(16)
    + String(x.org_name).slice(0, 14).padEnd(15) + String(x.title).slice(0, 36)
    + (x.hidden ? ' · 이미 숨김' : x.hold ? ' · 보류함' : ' · ★ 회원 화면'));
}
const 숨길것 = 겹친것.filter((x) => !x.hidden);
console.log('\n숨길 것 ' + 숨길것.length + '건 (이미 숨김 ' + (겹친것.length - 숨길것.length) + '건)');
if (!숨길것.length) process.exit(0);
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 숨깁니다'); process.exit(0); }

const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/rejudge_hold_apply', {
  method: 'POST', headers: H,
  body: JSON.stringify({ p_secret: 열쇠, p_show: [], p_hide: 숨길것.map((x) => x.id),
    p_why: 'HS3 와 같은 공고 (긁기 두 벌 · 2026-10-24)' }),
});
const t = await r.text();
console.log(r.ok ? '○ 숨겼습니다 — ' + t.slice(0, 200) : '✗ ' + r.status + ' ' + t.slice(0, 250));
