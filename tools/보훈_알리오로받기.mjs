/* 보훈병원 공고의 첨부를 **알리오로** 받아 봅니다 (2026-10-19 세중님 지시)
 *
 *   node tools/보훈_알리오로받기.mjs
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * `bohun.or.kr` 의 첨부는 맨손 `fetch` 로 못 받습니다 — 세 길을 두드려
 * 0바이트·0바이트·「유효하지 않은 요청입니다」였습니다
 * (docs/중앙보훈_첨부_못받음_1019.md).
 *
 * 그런데 한국보훈복지의료공단은 **공공기관**이라 **알리오에 같은 공고가
 * 올라옵니다.** 2026-10-19 에 DB 에서 확인했습니다 —
 *
 *   304482 AL   [중앙보훈병원] 기간제 직원 채용 공고(9월)   ← 보류함의 그 공고
 *   305712 AL2  [중앙보훈병원] 기간제 직원 채용 공고(10월)
 *   303604 AL   [대전보훈병원] 계약직(보건직(물리치료사))
 *   304289 AL   [대구보훈요양원] 계약직 물리치료사
 *   306122 AL2  [광주보훈병원] 계약직 보건직(작업치료사)
 *
 * 알리오 `/detail` 응답에는 `files` 가 실려 옵니다 (CLAUDE.md 4절 — 「채용첨부파일
 * 메타정보」). 그러면 **보훈 사이트를 안 두드리고** 첨부를 받을 수 있습니다.
 *
 * 이 도구는 **아무것도 바꾸지 않습니다** — 받아지는지만 보고 앞 글자를 찍습니다.
 */
import fs from 'node:fs';

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
const 공공열쇠 = cfg.ALIO_DETAIL_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없어야 합니다'); process.exit(1); }
if (!공공열쇠) {
  console.error('✗ 공공데이터 열쇠가 없습니다 — .env 의 이름을 확인해야 합니다');
  console.error('  ALIO_DETAIL_KEY 가 있어야 합니다 (알리오 상세 열쇠)');
  console.error('  있는 이름 — ' + Object.keys(cfg).filter((k) => /KEY/.test(k)).join(' · '));
  process.exit(1);
}
const H = { apikey: K, Authorization: 'Bearer ' + K };
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';

/* ★ 첨부를 받으려면 **포털 세션 쿠키**가 있어야 합니다. 없으면 파일 대신
   포털 첫 화면(8,333자 HTML)이 옵니다 — 지침 5절에 적힌 그 증상이고
   2026-10-19 에 여기서 다시 봤습니다(첫 건만 PDF, 나머지 전부 8,333바이트).
   규칙은 `collect-alio.mjs` 의 포털쿠키() 와 같습니다 */
const 담기 = (jar) => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
let _쿠키 = null;
async function 포털쿠키() {
  if (_쿠키 !== null) return _쿠키;
  const jar = {};
  let u = 'https://opendata.alio.go.kr/new/';
  for (let hop = 0; hop < 4 && u; hop++) {
    const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': UA, Cookie: 담기(jar) } });
    (r.headers.getSetCookie?.() || []).forEach((x) => {
      const kv = String(x).split(';')[0], i = kv.indexOf('=');
      if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    });
    const loc = r.headers.get('location');
    u = (r.status >= 300 && r.status < 400 && loc)
      ? (/^https?:/.test(loc) ? loc : 'https://opendata.alio.go.kr' + loc) : '';
  }
  _쿠키 = 담기(jar);
  return _쿠키;
}

/* 보훈 공고 — 알리오 쪽만 */
const r0 = await fetch(U + '/rest/v1/job_posts?select=id,source,org_name,title,url,hold'
  + '&source=in.(AL,AL2)&org_name=like.*보훈*&order=id.asc&limit=100', { headers: H });
const 공고 = await r0.json();
console.log('알리오 쪽 보훈 공고 ' + 공고.length + '건\n');

const 앞글자 = (buf) => {
  const b = Buffer.from(buf);
  const s = b.subarray(0, 5).toString('latin1');
  if (s.startsWith('%PDF-')) return 'PDF';
  if (s.startsWith('PK\u0003\u0004')) return 'zip/hwpx/docx';
  if (b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return '옛 hwp/ole';
  if (/^\s*<(!doctype|html)/i.test(b.subarray(0, 40).toString('utf8'))) return '**HTML (받은 게 아닙니다)**';
  return '모름 「' + s.replace(/[^\x20-\x7e]/g, '.') + '」';
};

let 첨부있음 = 0; let 받음 = 0; const 탈 = [];
for (const x of 공고) {
  const sn = String(x.id).replace(/[^0-9]/g, '');
  if (!sn) continue;
  const u = 상세URL + '?serviceKey=' + encodeURIComponent(공공열쇠)
    + '&sn=' + sn;
  let j;
  try {
    const r = await fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    if (r.status !== 200) { 탈.push(x.id + ' HTTP ' + r.status); continue; }
    try { j = JSON.parse(t); } catch { 탈.push(x.id + ' JSON 아님 — ' + t.replace(/\s+/g, ' ').slice(0, 90)); continue; }
  } catch (e) { 탈.push(x.id + ' ' + String(e.message).slice(0, 40)); continue; }

  const box = Array.isArray(j && j.result) ? j.result[0] : ((j && j.result) || j);
  const files = box.files || box.file || [];
  console.log('── ' + x.id + ' [' + x.source + '] ' + String(x.title).slice(0, 44)
    + (x.hold ? '  (보류함)' : ''));
  if (!Array.isArray(files) || !files.length) {
    console.log('   첨부 없음 — 응답 열쇠 ' + Object.keys(box).slice(0, 14).join(' · '));
    continue;
  }
  첨부있음++;
  for (const f of files.slice(0, 3)) {
    const 주소 = f.url || f.fileUrl || f.atchFileUrl || '';
    const 이름 = f.fileNm || f.atchFileNm || f.name || '(이름 없음)';
    console.log('   첨부 「' + String(이름).slice(0, 56) + '」');
    if (!주소) { console.log('      주소가 없습니다 — 열쇠 ' + Object.keys(f).join(' · ')); continue; }
    try {
      const rr = await fetch(주소, {
        headers: { 'User-Agent': UA, Cookie: await 포털쿠키(), Referer: 'https://opendata.alio.go.kr/new/' },
        signal: AbortSignal.timeout(25000),
      });
      const b = await rr.arrayBuffer();
      const 꼴 = 앞글자(b);
      console.log('      HTTP ' + rr.status + ' · ' + b.byteLength + '바이트 · ' + 꼴);
      if (/PDF|hwp|zip/.test(꼴)) 받음++;
    } catch (e) { console.log('      ✗ ' + String(e.message).slice(0, 50)); }
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log('\n── 셈 ──');
console.log('  공고 ' + 공고.length + '건 · 첨부가 있는 것 ' + 첨부있음 + '건 · **정말 받아진 것 ' + 받음 + '개**');
if (탈.length) console.log('  못 한 것 ' + 탈.length + '건 — ' + 탈.slice(0, 4).join(' · '));
console.log('\n아무것도 바꾸지 않았습니다.');
