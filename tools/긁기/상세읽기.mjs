/* 긁기 — **상세·첨부를 읽어 칸을 채웁니다** (2026-10-24 세중님 1번)
 *
 *   node tools/긁기/상세읽기.mjs              봅니다 (기본 · 마른)
 *   node tools/긁기/상세읽기.mjs --진짜        담습니다
 *   node tools/긁기/상세읽기.mjs --아이디 HS4-227-100725
 *
 * ── 기존 길을 그대로 씁니다 (새 규칙을 만들지 않습니다 · 세중님 1번) ──
 *   본문     `collect_body` 창구 (kind '상세') — collect-jobflex.mjs:301 과 같은 꼴
 *   첨부     `첨부담기.mjs` 의 `첨부모으기()` — 하루 상한·뚜껑도 그 자리 것
 *   칸 뽑기   `공고문읽기.mjs` 의 `칸뽑기()`·`본문직군()`·`고용형태고르기()`
 *   담기     `collect_put`(직군·마감·근무지) + `칸되메우기`(뽑은값) — **창구만** 씁니다
 *
 * ★ `hold` 는 **true 로 다시 보냅니다** — 10/31 까지 보류함만 (세중님 C1).
 * ★ 마감일이 **두 해 넘으면** 창구가 비웁니다 (collect_put 의 뚜껑). 우리는 안 고칩니다.
 * ★ 직군이 안 보이면 **비웁니다** — 짐작하지 않습니다 (지침 10-3).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기, 설정 } from './공통.mjs';
import { 칸뽑기, 본문직군, 고용형태고르기 } from '../공고문읽기.mjs';
import { 첨부모으기 } from '../첨부담기.mjs';
import { 본문자르기 } from '../hosp/본문자르기.mjs';
import { sortJob } from '../sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS4';
const 한건 = argv.includes('--아이디') ? argv[argv.indexOf('--아이디') + 1] : null;

const cfg = 설정();
const 열쇠 = cfg['COLLECT_KEY_' + 출처];
const 섬김 = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
if (!cfg.SUPABASE_URL || !섬김) { console.error('✗ SUPABASE_URL·열쇠가 없습니다'); process.exit(1); }
if (!열쇠 && 진짜) { console.error('✗ COLLECT_KEY_' + 출처 + ' 가 없습니다'); process.exit(1); }
const H = { apikey: 섬김, Authorization: 'Bearer ' + 섬김, 'Content-Type': 'application/json' };
const rpc = async (이름, 몸) => {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름),
    { method: 'POST', headers: H, body: JSON.stringify(몸) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
};

const 길 = 'job_posts?select=id,org_name,title,url,job_group,apply_to,work_place,hold'
  + '&source=eq.' + 출처 + (한건 ? '&id=eq.' + encodeURIComponent(한건) : '') + '&order=id&limit=100';
const r0 = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길, { headers: H });
if (!r0.ok) { console.error('✗ ' + r0.status + ' ' + (await r0.text()).slice(0, 200)); process.exit(1); }
const 공고 = await r0.json();
console.log(출처 + ' 공고 ' + 공고.length + '건 — 상세를 읽습니다 (같은 집 3.5초)');

const 첨부 = 첨부모으기(출처, { 마른: !진짜 });
const 본문들 = [];
const 칸줄 = [];
const 공고줄 = [];
let 열림 = 0; let 못열림 = 0;
const 셈 = { 직군: 0, 마감: 0, 근무지: 0, 첨부: 0 };

for (const x of 공고) {
  if (!x.url) { console.log('  · ' + x.id + ' 주소 없음'); continue; }
  const r = await 받기(x.url);
  if (!r.됨) { 못열림++; console.log('  ✗ ' + x.id + ' — ' + r.왜); continue; }
  열림++;
  /* ★ 2026-10-24 — **본문 영역만** 잘라냅니다. 안 자르면 쪽 **메뉴가 통째로**
     본문이 됩니다 — 미래로21병원 2,058자 가운데 거의 전부가 「진단검사의학과
     종합검진실 … 물리치료실 …」 메뉴였고, 그 때문에 직군·마감 채움률이 낮았습니다
     (기존 길 그대로 — tools/hosp/본문자르기.mjs · collect-hosp:562 가 쓰는 그것).
     선택자는 사이트마다 다르니 **흔한 것부터** 대 보고, 자른 글이 200자 미만이면
     **안 쓰고 쪽 전체**를 씁니다 (몰래 짧은 글을 넘기지 않습니다) */
  const 후보 = ['#bo_v_con', '.board_view', '.view_content', '.bbs_view', '.board-view',
    '#contents', '.contents', '#content', '.content', '.sub_content', 'article'];
  let 글 = r.글;
  let 자른자 = '(안 자름)';
  for (const sel of 후보) {
    const 잘린 = 본문자르기(r.html, sel);
    if (!잘린) continue;
    const t = String(잘린).replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length >= 200 && t.length < 글.length) { 글 = t; 자른자 = sel; break; }
  }
  if (글.length > 60) 본문들.push({ job_id: x.id, kind: '상세', ord: 0, url: x.url, body: 글 });

  /* 첨부 — 쪽에서 파일 링크를 모읍니다 (기존 첨부 길이 받아 읽습니다) */
  for (const m of r.html.matchAll(/href\s*=\s*["']([^"']+\.(?:pdf|hwp|hwpx|docx?|xlsx?|zip|jpe?g|png))["']/gi)) {
    let 주소 = m[1].replace(/&amp;/g, '&');
    try { 주소 = new URL(주소, x.url).toString(); } catch { continue; }
    const 이름 = decodeURIComponent(주소.split('/').pop().split('?')[0]).slice(0, 120);
    첨부.더하기({ job_id: x.id, kind: '공고문', name: 이름, url: 주소 });
    셈.첨부++;
  }

  /* 칸 — 기존 규칙 그대로 */
  const 뽑 = 칸뽑기(글, 글);
  const 직군 = 본문직군(글) || '';
  const 갈래 = sortJob(x.title, 직군, 글);
  const 고용 = 고용형태고르기(x.title || '', 글);
  const 줄 = { id: x.id, source: 출처, org_name: x.org_name, title: x.title, url: x.url,
    hold: true };
  if (직군 && 갈래.갈래 === '회원목록') { 줄.job_group = 직군; 셈.직군++; }
  if (뽑.접수마감 && !x.apply_to) { 줄.apply_to = 뽑.접수마감; 셈.마감++; }
  if (뽑.근무지 && !String(x.work_place || '').trim()) { 줄.work_place = 뽑.근무지; 셈.근무지++; }
  if (고용 && 고용.값) 줄.employ_type = 고용.값;
  공고줄.push(줄);

  const 뽑은값 = {};
  if (뽑.지원자격) 뽑은값.지원자격 = 뽑.지원자격;
  if (뽑.예상연봉) 뽑은값.예상연봉 = 뽑.예상연봉;
  if (뽑.모집인원글) [뽑은값.모집인원] = Object.values(뽑.모집인원글);
  const 인원들 = Object.values(뽑.모집인원 || {}).map(Number).filter(Number.isFinite);
  const 칸 = { id: x.id };
  if (인원들.length) 칸.headcount = 인원들.reduce((a, b) => a + b, 0);
  if (뽑.접수시각 && (뽑.접수마감 || x.apply_to)) 칸.apply_to_time = 뽑.접수시각;
  if (Object.keys(뽑은값).length) 칸.뽑은값 = 뽑은값;
  if (Object.keys(칸).length > 1) 칸줄.push(칸);

  console.log('  ○ ' + x.id.padEnd(18) + String(x.org_name).slice(0, 14).padEnd(15)
    + '글 ' + String(글.length).padStart(5) + '자(' + 자른자 + ')'
    + ' · 직군 ' + (직군 || '(안 보임)').padEnd(6)
    + ' · 갈래 ' + 갈래.갈래.padEnd(5)
    + ' · 마감 ' + (뽑.접수마감 || x.apply_to || '(없음)')
    + ' · 근무지 ' + String(뽑.근무지 || x.work_place || '(없음)').slice(0, 14));
}

console.log('\n열린 것 ' + 열림 + ' · 못 연 것 ' + 못열림
  + ' · 본문 ' + 본문들.length + '건 · 첨부 줄 ' + 셈.첨부
  + ' · 채울 것 — 직군 ' + 셈.직군 + ' · 마감 ' + 셈.마감 + ' · 근무지 ' + 셈.근무지);

if (!진짜) {
  console.log('\n[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다');
  process.exit(0);
}
let 글담음 = 0;
for (let i = 0; i < 본문들.length; i += 50) {
  const r = await rpc('collect_body', { p_secret: 열쇠, p_source: 출처, p_rows: 본문들.slice(i, i + 50) });
  글담음 += (r && r['담음']) || 0;
}
console.log('본문 담음 ' + 글담음 + '건 (job_body · 회원 화면에 안 나갑니다)');

await 첨부.끝내기(cfg);

if (공고줄.length) {
  const r = await rpc('collect_put', { p_secret: 열쇠, p_source: 출처, p_rows: 공고줄 });
  console.log('공고 칸 담음 — ' + JSON.stringify(r).slice(0, 200));
}
if (칸줄.length) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'),
    { method: 'POST', headers: H, body: JSON.stringify({ p_rows: 칸줄 }) });
  console.log('뽑은값 담음 — ' + (await r.text()).slice(0, 200));
}
