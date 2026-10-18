/* 「마감 알림창」 꼴이 **다른 사이트에도 있나** 훑습니다 (2026-10-18 세중님 지시 2).
 *
 *   node tools/hosp/알림창훑기.mjs                    회원 화면 공고를 훑습니다 (읽기만)
 *   node tools/hosp/알림창훑기.mjs --출처 HS,HS3       출처를 좁혀서
 *   node tools/hosp/알림창훑기.mjs --몇개 20           앞 N건만
 *   node tools/hosp/알림창훑기.mjs --자기점검          사이트를 안 두드립니다
 *
 * ── 왜 ───────────────────────────────────────────────
 * 2026-10-17 에 고신대학교복음병원 공고 2건이 **마감인데 회원 화면에** 있었습니다.
 * 사이트가 HTTP 200 을 주고 `alert("이미 마감된 게시글 입니다.")` 로만 알립니다.
 * alert 은 <script> 안이라 태그를 걷으면 사라져서 정찰의 마감 규칙이 전부 비켜갔습니다.
 * 그 꼴이 **다른 사이트에도 있는지** 세어 봅니다.
 *
 * ── 두 가지를 따로 셉니다 ────────────────────────────────
 *   ① 알림상태() 가 닫힘으로 보는 것     → 지금 규칙이 잡습니다
 *   ② <script> 안에 마감말이 있는데 ①에 안 걸리는 것
 *        → **규칙을 넓힐 거리입니다.** 글귀를 그대로 찍습니다 (지침 2절 — 원문을 찍습니다)
 *
 * ★ 내리지 않습니다. 목록만 냅니다 (세중님 — 내리기는 승인 뒤).
 * ★ 같은 사이트는 **3.5초 이상** 띄웁니다. 403·429 가 이어지면 그 사이트를 멈춥니다.
 */
import fs from 'node:fs';
import { 알림상태 } from './hs_목록상태.mjs';

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = argv.indexOf(이름); return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본; };
const 출처들 = String(값('--출처', 'HS,HS3,GJ2,CE2,ND2,AL2')).split(',').map((s) => s.trim()).filter(Boolean);
const 뚜껑 = Number(값('--몇개', 500));
const 틈 = 3500;

/* <script> 안에서 마감처럼 들리는 말 — ①보다 **넓게** 봅니다 (②를 찾기 위해) */
const 넓은마감말 = /(마감|종료|만료|채용\s*완료|접수\s*완료|지난\s*게시|열람\s*가능\s*기간)/;

export function 스크립트속마감말(html) {
  const 모 = [];
  for (const m of String(html || '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const 안 = m[1];
    if (!넓은마감말.test(안)) continue;
    /* 그 말 둘레만 잘라 보여 줍니다 — 스크립트를 통째로 찍으면 못 읽습니다 */
    const i = 안.search(넓은마감말);
    모.push(안.slice(Math.max(0, i - 60), i + 80).replace(/\s+/g, ' ').trim());
  }
  return 모;
}

if (argv.includes('--자기점검')) {
  const 어겼나 = [];
  const 봐 = (이름, 참) => { if (!참) 어겼나.push(이름); };
  봐('스크립트 안 마감말을 집는다',
    스크립트속마감말('<script>alert("이미 마감된 게시글 입니다.")</script>').length === 1);
  봐('스크립트 밖 마감말은 안 집는다',
    스크립트속마감말('<div>접수기간 마감</div>').length === 0);
  봐('마감말 없는 스크립트는 안 집는다',
    스크립트속마감말('<script>var a=1;</script>').length === 0);
  봐('만료 글귀도 집는다',
    스크립트속마감말('<script>alert("열람 가능 기간이 만료된 게시물입니다")</script>').length === 1);
  봐('빈 값은 0개', 스크립트속마감말('').length === 0 && 스크립트속마감말(null).length === 0);
  /* 알림상태(①)와 넓은 말(②)이 **다른 것**을 봐야 합니다 */
  const 넓지만_닫힘아님 = '<script>alert("열람 가능 기간이 만료된 게시물입니다")</script>';
  봐('① 과 ② 는 다르다', 알림상태(넓지만_닫힘아님).결과 === '없음'
    && 스크립트속마감말(넓지만_닫힘아님).length === 1);
  if (어겼나.length) { console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과 — 스크립트 속 마감말 6가지 (사이트를 두드리지 않았습니다)');
  process.exit(0);
}

const cfg = {};
for (const 이름 of ['../../.env', '../../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL, K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

async function 다(q) {
  const 모 = []; let off = 0;
  for (;;) {
    const r = await fetch(`${U}/rest/v1/${q}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json(); 모.push(...a);
    if (!a.length) return 모;
    off += a.length; if (off > 100000) throw new Error('너무 많습니다');
  }
}

const 공 = (await 다(`job_posts_pub?select=id,source,org_name,title,url&source=in.(${출처들.join(',')})&url=not.is.null&order=id.asc`)).slice(0, 뚜껑);
console.log(`회원 화면 공고 ${공.length}건 · 출처 ${출처들.join('·')} · ${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ')} KST`);

const 끝때 = new Map();            /* host → 마지막 요청 시각 */
const 막힘 = new Map();            /* host → 이어진 막힘 수 */
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const 닫힘 = []; const 넓은것 = []; const 못받음 = [];

for (const [i, p] of 공.entries()) {
  let host;
  try { host = new URL(p.url).host; } catch { 못받음.push({ p, 왜: '주소 꼴이 아님' }); continue; }
  if ((막힘.get(host) || 0) >= 3) { 못받음.push({ p, 왜: '그 사이트 막힘 3번 — 멈췄습니다' }); continue; }
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 틈) await 자고(틈 - 지난);
  끝때.set(host, Date.now());

  let html, code;
  try {
    const r = await fetch(p.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' }, signal: AbortSignal.timeout(20000) });
    code = r.status;
    if (r.status === 403 || r.status === 429) { 막힘.set(host, (막힘.get(host) || 0) + 1); 못받음.push({ p, 왜: 'HTTP ' + r.status }); continue; }
    if (!r.ok) { 못받음.push({ p, 왜: 'HTTP ' + r.status }); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) { 막힘.set(host, (막힘.get(host) || 0) + 1); 못받음.push({ p, 왜: '빈 응답' }); continue; }
    막힘.set(host, 0);
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  } catch (e) { 못받음.push({ p, 왜: String(e && e.message || e).slice(0, 40) }); continue; }

  const A = 알림상태(html);
  const 넓 = 스크립트속마감말(html);
  if (A.결과 === 'closed') 닫힘.push({ p, 왜: A.왜, code });
  else if (넓.length) 넓은것.push({ p, 글: 넓, code });
  process.stderr.write(`\r  ${i + 1}/${공.length} 훑음 · 닫힘 ${닫힘.length} · 넓은말 ${넓은것.length} · 못받음 ${못받음.length}   `);
}
process.stderr.write('\n');

console.log(`\n── ① 알림창이 마감 — **회원 화면에 있는데 사이트는 마감** ${닫힘.length}건 ──`);
for (const x of 닫힘) console.log(`  ${x.p.id} [${x.p.source}] ${x.p.org_name}\n    ${x.왜}\n    ${String(x.p.title).slice(0, 44)}\n    ${x.p.url}`);
if (!닫힘.length) console.log('  (없습니다)');

console.log(`\n── ② 스크립트 안에 마감말은 있으나 ①에 안 걸림 ${넓은것.length}건 ──`);
console.log('   (규칙을 넓힐 거리입니다. 글귀를 그대로 찍습니다)');
for (const x of 넓은것.slice(0, 20)) {
  console.log(`  ${x.p.id} [${x.p.source}] ${x.p.org_name} | ${String(x.p.title).slice(0, 34)}`);
  for (const g of x.글.slice(0, 2)) console.log(`      「${g.slice(0, 110)}」`);
}
if (!넓은것.length) console.log('  (없습니다)');

console.log(`\n── 못 받음 ${못받음.length}건 ──`);
const 까닭 = {};
for (const x of 못받음) 까닭[x.왜] = (까닭[x.왜] || 0) + 1;
for (const [왜, n] of Object.entries(까닭).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}건  ${왜}`);
if (!못받음.length) console.log('  (없습니다)');
console.log('\n※ 아무것도 내리지 않았습니다 — 내리기는 승인 뒤입니다');
