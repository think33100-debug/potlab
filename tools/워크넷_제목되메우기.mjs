/* 워크넷 **잘린 제목**을 상세 API 의 온전한 제목으로 바꿉니다
 *   (2026-10-19 세중님 1번 — 「마른 실행 → 승인 → 되메우기」)
 *
 *   node tools/워크넷_제목되메우기.mjs           무엇이 바뀔지만 (기본)
 *   node tools/워크넷_제목되메우기.mjs --진짜    바꿉니다
 *   node tools/워크넷_제목되메우기.mjs --몇개 20 몇 건만
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 워크넷 **목록** API 는 제목을 30자로 자르고 「...」 을 붙입니다. 회원이
 * 공고 상세에서 보는 「기관 원문 제목」 칸이 96건 그렇게 끝납니다.
 * **상세** API(`callTp=D`)의 `<wantedTitle>` 에는 온전한 제목이 있습니다 —
 * 2026-10-19 에 세 건으로 확인했습니다 (tools/워크넷_상세제목있나.mjs).
 *
 *     목록 30자 「화성시장애아동재활센터 물리치료사 채용공고(대체인력...」
 *     상세 31자 「화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)」
 *
 * ★ 제목이 온전해지면 **결과 발표 거르기도 제대로 돕니다** — 경찰병원처럼
 *   「합격자 발표」가 잘린 뒤에 있어 못 보던 일이 줄어듭니다.
 * ★ `id` 는 안 바꿉니다. 제목이 바뀌면 `제목채우기` 트리거가 `보여줄제목` 을
 *   다시 만듭니다 (그 자리는 이미 안 잘립니다).
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 200) || 200;

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
const WK = cfg.WORK_KEY;
if (!U || !K || !WK) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / WORK_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const WURL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';

async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?')
      + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 40) + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const 한쪽 = await r.json();
    out.push(...한쪽);
    if (한쪽.length < 100) break;
    if (off > 20000) break;
  }
  return out;
}

/* 회원 화면에 보이는 워크넷 공고 중 제목이 잘린 것 — 회원이 보는 자리가 먼저입니다 */
const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,source,org_name,title,url,edited_fields,admin_locked'
  + '&source=in.(WN,WN2)&order=db_insert_at.desc,id.asc');
const 볼것 = 다.filter((x) => /(\.\.\.|…)\s*$/.test(x.title || '') && 보임.has(x.id)).slice(0, 몇개);
console.log('워크넷 공고 ' + 다.length + '건 중 **회원 화면에 보이고 제목이 잘린 것** '
  + 볼것.length + '건\n');

const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const 바뀔것 = []; const 못함 = { 'authNo 없음': 0, 'API 탈': 0, '상세에도 없음': 0,
  '사람이 고친 칸': 0, '관리자가 손댐': 0, '이미 같음': 0 };

for (const [i, x] of 볼것.entries()) {
  if (x.admin_locked) { 못함['관리자가 손댐']++; continue; }
  if ((x.edited_fields || []).includes('title')) { 못함['사람이 고친 칸']++; continue; }
  const no = (String(x.url).match(/wantedAuthNo=([A-Z0-9]+)/) || [])[1];
  if (!no) { 못함['authNo 없음']++; continue; }
  const u = WURL + '?authKey=' + encodeURIComponent(WK) + '&returnType=XML&callTp=D'
    + '&wantedAuthNo=' + encodeURIComponent(no) + '&infoSvc=VALIDATION';
  let t;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    t = await r.text();
    if (r.status !== 200) { 못함['API 탈']++; await 자고(900); continue; }
  } catch { 못함['API 탈']++; await 자고(900); continue; }
  const m = t.match(/<wantedTitle>([^<]*)<\/wantedTitle>/);
  /* ★ 엔티티를 **두 번** 풉니다 — 상세 API 가 `&amp;amp;` 로 겹쳐 보냅니다.
     안 풀면 회원 화면에 「전주 삼남재활의학과병원에서 신입 &amp;amp; 경력」
     처럼 그대로 보입니다 (2026-10-19 마른 실행에서 봤습니다).
     XML 응답은 `&amp;`·`&#38;` 를 반드시 푼다 — 지침 5절 */
  const 풀기 = (s) => String(s)
    .replace(/&amp;/g, '&').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#38;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const 온전 = m ? 풀기(m[1]) : '';
  if (!온전) { 못함['상세에도 없음']++; await 자고(900); continue; }
  if (온전 === x.title) { 못함['이미 같음']++; await 자고(900); continue; }
  바뀔것.push({ ...x, 후: 온전 });
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + ' — 바뀔 것 ' + 바뀔것.length + '   ');
  await 자고(900);
}
process.stderr.write('\n');

console.log('\n바뀔 것 ' + 바뀔것.length + '건');
console.log('  못 한 것 — ' + Object.entries(못함).map(([k, v]) => k + ' ' + v).join(' · '));
/* 결과 발표 꼴이 **잘린 뒤에 숨어 있던** 공고를 따로 셉니다 — 이것이 이 일의 값입니다 */
const 결과말 = /합격자|최종\s*합격|서류\s*전형\s*(결과|합격)|면접\s*(결과|대상자)|결과\s*발표|채용\s*취소|시험\s*장소/;
const 숨어있던것 = 바뀔것.filter((x) => !결과말.test(x.title) && 결과말.test(x.후));
console.log('  ★ 잘린 뒤에 **결과 발표 글귀가 숨어 있던** 공고 — ' + 숨어있던것.length + '건');
for (const x of 숨어있던것) {
  console.log('     ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16));
  console.log('        전 「' + x.title + '」');
  console.log('        후 「' + x.후 + '」');
}

console.log('\n  견본 (앞 10건) —');
for (const x of 바뀔것.slice(0, 10)) {
  console.log('    ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16));
  console.log('        전 (' + x.title.length + '자) 「' + x.title + '」');
  console.log('        후 (' + x.후.length + '자) 「' + x.후 + '」');
}
if (바뀔것.length > 10) console.log('    … 그밖 ' + (바뀔것.length - 10) + '건');

if (!바뀔것.length) { console.log('\n바꿀 것이 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 바꾸려면 --진짜'); process.exit(0); }

/* 창구가 title 을 받는지 먼저 봅니다 — 안 받으면 멈춥니다 (표를 직접 안 씁니다) */
const 시험 = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
  method: 'POST', headers: H,
  body: JSON.stringify({ p_rows: [{ id: 바뀔것[0].id, title: 바뀔것[0].후 }] }),
});
const 시험글 = await 시험.text();
if (!시험.ok) { console.error('✗ 칸되메우기 ' + 시험.status + ' · ' + 시험글.slice(0, 250)); process.exit(1); }
console.log('\n창구 답 — ' + 시험글.slice(0, 240));
if (!/title/.test(시험글)) {
  console.error('★ 창구가 title 을 다룬다는 답이 없습니다 — 멈춥니다.');
  console.error('  `칸되메우기` 가 그 칸을 받게 고친 뒤에 다시 돌리십시오.');
  process.exit(1);
}
let 바꿈 = 1;
for (let i = 1; i < 바뀔것.length; i += 50) {
  const 토막 = 바뀔것.slice(i, i + 50).map((x) => ({ id: x.id, title: x.후 }));
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 토막 }),
  });
  if (!r.ok) { console.error('✗ ' + r.status + ' · ' + (await r.text()).slice(0, 200)); process.exit(1); }
  바꿈 += 토막.length;
  console.log('  ' + 바꿈 + '/' + 바뀔것.length);
}
console.log('\n바꿨습니다 — ' + 바꿈 + '건');
