/* 회원 화면 공고의 **「원문 보기」 링크**가 쓸 만한가 점검합니다 (2026-10-18 세중님).
 *
 *   node tools/원문링크점검.mjs                   워크넷은 표본, 나머지는 전수
 *   node tools/원문링크점검.mjs --워크넷 전수      워크넷도 전수 (오래 걸립니다)
 *   node tools/원문링크점검.mjs --워크넷표본 50
 *   node tools/원문링크점검.mjs --자기점검
 *
 * ── 왜 ───────────────────────────────────────────────
 * 2026-10-18 세중님 결정 — f 섹션·「자세히 보기」는 하지 않습니다. 일곱 칸만 그리고
 * **상세 내용은 원문(원래 공고)으로 가서 봅니다.**
 * 그러면 **원문 링크가 정확해야 합니다.** 안동병원은 공고 9건이 한 주소를
 * 가리킵니다 — 누르면 엉뚱한 공고로 갑니다.
 *
 * ── 무엇을 보나 ──────────────────────────────────────
 *   ① 열리나                HTTP 200 인가
 *   ② **그 공고 쪽인가**     쪽에 그 공고 **제목 토막**이 있나 (정찰이 쓰는 방법)
 *   ③ 없어졌나·막혔나        없어짐말 · 403/404 · 알림창 마감
 *
 * 제목이 없으면 **목록 쪽이나 메뉴 쪽**일 수 있습니다. 거기까지만 말하고
 * 「목록이다」고 단정하지 않습니다 — 쪽마다 꼴이 달라서입니다.
 *
 * ★ 같은 사이트는 3.5초 이상 띄웁니다. 403·429·빈 응답이 이어서 3번이면 멈춥니다.
 * ★ 아무것도 바꾸지 않습니다. 목록만 냅니다.
 * ★ 워크넷(work24.go.kr)이 306/342 건이라 **표본**으로 봅니다 — 한 호스트에
 *   306번 줄줄이 때리는 것은 예의가 아니고, 주소 꼴이 모두 같습니다.
 *   표본에서 틀린 것이 나오면 `--워크넷 전수` 로 넓힙니다.
 */
import fs from 'node:fs';
import { 알림상태, 없어짐말 } from './hosp/hs_목록상태.mjs';

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 워크넷전수 = 값('--워크넷', '') === '전수';
const 워크넷표본 = Number(값('--워크넷표본', 30));
const 뚜껑 = Number(값('--몇개', 1000));
const 틈 = 3500;

/* 없어짐말은 `hosp/hs_목록상태.mjs` **한 자리**에서 가져옵니다 (지침 6절).
   ★ 처음에 제가 여기 베껴 두 벌로 만들었고, 워크넷의 「구인정보를 확인할 수
   없습니다」 를 한쪽에만 넣을 뻔했습니다 (2026-10-18). */

/* 제목 토막 — **글자만** 남겨 견줍니다. 띄어쓰기·기호가 사이트마다 다릅니다 */
export function 토막(제목) {
  const s = String(제목 || '').replace(/[^0-9A-Za-z가-힣]/g, '');
  return s.length >= 8 ? s.slice(0, 14) : s;
}
/** 그 쪽에 이 공고 제목이 있나 · 판단 못 하면 null */
export function 쪽에있나(html, 제목) {
  const t = 토막(제목);
  if (t.length < 6) return null;
  const 글 = String(html).replace(/<[^>]+>/g, ' ').replace(/[^0-9A-Za-z가-힣]/g, '');
  return 글.includes(t);
}

if (argv.includes('--자기점검')) {
  const 어겼나 = [];
  const 봐 = (n, c) => { if (!c) 어겼나.push(n); };
  봐('토막은 글자만 남기고 14자로 자른다',
    토막('[공고 제2026-27호] 2026년 하반기') === '공고제202627호2026');
  봐('짧은 제목은 판단 못 함', 쪽에있나('<p>아무것</p>', '가나') === null);
  봐('제목이 있으면 찾는다',
    쪽에있나('<div>물리 치료사 모집 공고 입니다</div>', '물리치료사 모집공고') === true);
  봐('제목이 없으면 못 찾는다',
    쪽에있나('<div>전혀 다른 글입니다 여기에는</div>', '물리치료사 모집공고') === false);
  봐('태그 사이로 끊긴 제목도 찾는다',
    쪽에있나('<b>물리</b><i>치료사</i> 모집공고', '물리치료사 모집공고') === true);
  봐('없어짐말 — 만료를 잡는다', 없어짐말.test('열람 가능 기간이 만료된 게시물입니다'));
  봐('없어짐말 — 멀쩡한 글은 안 걸린다', !없어짐말.test('물리치료사 채용 공고입니다'));
  if (어겼나.length) { console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과 — 제목 토막·없어짐말 7가지 (사이트를 두드리지 않았습니다)');
  process.exit(0);
}

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
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

async function 다(q) {
  const 모 = [];
  let off = 0;
  for (;;) {
    const r = await fetch(U + '/rest/v1/' + q + '&limit=1000&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    모.push(...a);
    if (!a.length) return 모;
    off += a.length;
    if (off > 100000) throw new Error('너무 많습니다');
  }
}

/* 회원 화면 번호를 먼저 받고 출처·제목·주소는 job_posts 에서 붙입니다 —
   job_posts_pub 에는 source 칸이 없습니다 (2026-10-18 에 400 을 받고 알았습니다) */
const 보이는 = (await 다('job_posts_pub?select=id&order=id.asc')).map((x) => x.id);
const 공 = [];
for (let i = 0; i < 보이는.length; i += 60) {
  const 조각 = 보이는.slice(i, i + 60).map(encodeURIComponent).join(',');
  공.push(...await 다('job_posts?select=id,source,org_name,title,url&id=in.(' + 조각 + ')&url=not.is.null'));
}
const 집 = (u) => { try { return new URL(u).host; } catch { return ''; } };
const 워크넷 = 공.filter((x) => /work24\.go\.kr/.test(x.url));
const 그밖 = 공.filter((x) => !/work24\.go\.kr/.test(x.url));
const 볼것 = (워크넷전수 ? 워크넷 : 워크넷.slice(0, 워크넷표본)).concat(그밖).slice(0, 뚜껑);
console.log('회원 화면 주소 있는 공고 ' + 공.length + '건 — 워크넷 ' + 워크넷.length + '건('
  + (워크넷전수 ? '전수' : '표본 ' + Math.min(워크넷표본, 워크넷.length) + '건')
  + ') · 그밖 ' + 그밖.length + '건(전수)');
console.log('볼 것 ' + 볼것.length + '건 · '
  + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' KST\n');

const 끝때 = new Map();
const 막힘 = new Map();
const 멈춘 = new Map();
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const 결과 = [];

for (const [i, x] of 볼것.entries()) {
  const host = 집(x.url);
  if (!host) { 결과.push({ x, 판정: '주소 꼴이 아님' }); continue; }
  if ((막힘.get(host) || 0) >= 3) { 결과.push({ x, 판정: '그 사이트 막힘 3번 — 멈췄습니다' }); continue; }
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 틈) await 자고(틈 - 지난);
  끝때.set(host, Date.now());

  let html;
  let code;
  try {
    const r = await fetch(x.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    code = r.status;
    if (r.status === 403 || r.status === 429) {
      const n = (막힘.get(host) || 0) + 1;
      막힘.set(host, n);
      if (n >= 3) 멈춘.set(host, 'HTTP ' + r.status + ' 3번');
      결과.push({ x, 판정: 'HTTP ' + r.status + ' (막힘)' });
      continue;
    }
    if (r.status === 404 || r.status === 410) { 결과.push({ x, 판정: 'HTTP ' + r.status + ' (없어짐)' }); continue; }
    if (!r.ok) { 결과.push({ x, 판정: 'HTTP ' + r.status }); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) {
      막힘.set(host, (막힘.get(host) || 0) + 1);
      결과.push({ x, 판정: '빈 응답' });
      continue;
    }
    막힘.set(host, 0);
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1]
      || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  } catch (e) {
    결과.push({ x, 판정: '못 받음 · ' + String(e && e.message || e).slice(0, 34) });
    continue;
  }

  if (알림상태(html).결과 === 'closed') { 결과.push({ x, 판정: '알림창이 마감', code }); continue; }
  if (없어짐말.test(html)) {
    결과.push({ x, 판정: '없어짐말 — 「' + (html.match(없어짐말) || [''])[0] + '」', code });
    continue;
  }
  const 있나 = 쪽에있나(html, x.title);
  if (있나 === null) { 결과.push({ x, 판정: '제목이 짧아 판단 못 함', code }); continue; }
  결과.push({
    x,
    판정: 있나 ? '○ 그 공고 쪽' : '★ 쪽에 제목이 없습니다 (목록·메뉴 쪽일 수 있음)',
    code,
  });
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + '   ');
}
process.stderr.write('\n');

const 셈 = {};
for (const r of 결과) 셈[r.판정.startsWith('○') ? '○ 그 공고 쪽' : r.판정] = (셈[r.판정.startsWith('○') ? '○ 그 공고 쪽' : r.판정] || 0) + 1;
console.log('── 판정별 ──');
for (const [k, v] of Object.entries(셈).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(v).padStart(3) + '건  ' + k);
}

const 틀린것 = 결과.filter((r) => !r.판정.startsWith('○'));
console.log('\n── 쓸 수 없는 링크 ' + 틀린것.length + '건 — 출처별 ──');
const 출처별 = {};
for (const r of 틀린것) (출처별[r.x.source] ??= []).push(r);
for (const [s, xs] of Object.entries(출처별).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + s + ' ' + xs.length + '건');
  for (const r of xs.slice(0, 10)) {
    console.log('     ' + r.x.id + ' ' + String(r.x.org_name).slice(0, 16) + ' | ' + String(r.x.title).slice(0, 28));
    console.log('        ' + r.판정);
    console.log('        ' + String(r.x.url).slice(0, 92));
  }
}
if (멈춘.size) {
  console.log('\n★ 멈춘 사이트 ' + 멈춘.size + '곳 — ' + [...멈춘].map(([h, w]) => h + '(' + w + ')').join(' · '));
}
console.log('\n※ 아무것도 바꾸지 않았습니다');
