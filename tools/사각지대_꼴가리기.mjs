/* ① 사각지대 기관의 **채용 게시판 꼴**을 가립니다 (2026-10-19 세중님 2번)
 *
 *   node tools/사각지대_꼴가리기.mjs                대학·종합·상급종합 (기본)
 *   node tools/사각지대_꼴가리기.mjs --몇개 20      몇 곳만
 *   node tools/사각지대_꼴가리기.mjs --갈래 종합병원
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * ① 459 가 세 번째 보고째 그대로입니다. 세중님 — 「같은 꼴(그누보드·JobFlex·
 * recruiter 등) 묶음부터 새 기관 설정 추가」.
 *
 * 그래서 **먼저 꼴을 셉니다.** 한 곳씩 손으로 보면 쉰 곳에 쉰 번이지만,
 * 같은 꼴이 열 곳이면 설정 하나를 열 번 복사하면 됩니다.
 *
 * ★ 주소를 **짐작하지 않습니다** (지침 3절). `hira_org.hosp_url` 과 우리
 *   `기관주소` 표에 있는 것만 씁니다. 없으면 「주소 없음」으로 적고 넘깁니다.
 * ★ 아무것도 바꾸지 않습니다 — 찍기만 합니다.
 */
import fs from 'node:fs';
import { 차례붙이기 } from './쪽나눠받기.mjs';

const argv = process.argv.slice(2);
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 200) || 200;
const 갈래고름 = argv.includes('--갈래') ? argv[argv.indexOf('--갈래') + 1] : null;

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
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';

async function 전부(길) {
  const out = [];
  const 길2 = 차례붙이기(길);
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길2 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 90000) break;
  }
  return out;
}

/* 사각지대 목록 — 창구를 거칩니다 */
const r0 = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('일층병원_구멍'), {
  method: 'POST', headers: H, body: '{}',
});
if (!r0.ok) { console.error('✗ 일층병원_구멍 ' + r0.status + ' · ' + (await r0.text()).slice(0, 200)); process.exit(1); }
const 구멍 = await r0.json();
const 볼갈래 = 갈래고름 ? [갈래고름] : ['대학병원', '상급종합', '종합병원'];
const 사각 = 구멍.filter((x) => 볼갈래.includes(x['갈래']) && x['상태'] === '사각지대');
console.log('사각지대 — ' + 볼갈래.join('·') + ' ' + 사각.length + '곳'
  + (사각.length > 몇개 ? ' (앞 ' + 몇개 + '곳만 봅니다)' : ''));

/* 주소 — `기관주소`(우리 표)가 먼저, 없으면 `hira_org.hosp_url` */
const 우리주소 = new Map();
try {
  const r1 = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('기관주소보기'), {
    method: 'POST', headers: H, body: '{}',
  });
  if (r1.ok) for (const x of await r1.json()) 우리주소.set(String(x['이름'] || x['기관'] || ''), x['주소'] || x['url']);
} catch { /* 없으면 넘어갑니다 */ }

const 히라 = new Map();
for (const x of await 전부('hira_org?select=yadm_nm,hosp_url&hosp_url=not.is.null')) {
  if (x.hosp_url) 히라.set(String(x.yadm_nm), String(x.hosp_url));
}
console.log('주소를 아는 곳 — 우리 표 ' + 우리주소.size + ' · hira_org ' + 히라.size + '\n');

/* ── 꼴 가리기 — **쪽에서 본 글자**로만 (짐작 금지) ──────────────── */
const 꼴들 = [
  ['그누보드', /bbs\/board\.php|gnuboard|bo_table=/i],
  ['JobFlex', /jobflex|job_flex/i],
  ['인크루트 recruiter', /recruit\.incruit\.com|incruit/i],
  ['잡코리아', /jobkorea\.co\.kr/i],
  ['사람인', /saramin\.co\.kr/i],
  ['워크넷 링크', /work24\.go\.kr|work\.go\.kr/i],
  ['Vaadin', /vaadinBootstrap|VAADIN/],
  ['XpressEngine', /xe\/|\/xe\b|rhymix/i],
  ['WordPress', /wp-content|wp-json/i],
  ['Wagtail/Django', /be-table-row|csrfmiddlewaretoken/i],
  ['ASP(.asp)', /\.asp(\?|"|')/i],
  ['JSP(.do)', /\.do(\?|"|')/i],
  ['PHP(그밖)', /\.php(\?|"|')/i],
];
const 채용말 = /채용|인재|구인|입사|리크루트|recruit|job/i;

const 묶음 = new Map();
const 못함 = [];
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [i, x] of 사각.slice(0, 몇개).entries()) {
  const 이름 = String(x['기관']);
  const 주소 = 우리주소.get(이름) || 히라.get(이름) || null;
  process.stderr.write('\r  ' + (i + 1) + '/' + Math.min(사각.length, 몇개) + '   ');
  if (!주소) { 못함.push({ 이름, 왜: '주소 없음 (hira_org·기관주소 둘 다)' }); continue; }
  let html; let 끝주소 = 주소;
  try {
    const r = await fetch(주소.startsWith('http') ? 주소 : 'http://' + 주소, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
      redirect: 'follow', signal: AbortSignal.timeout(20000),
    });
    끝주소 = r.url || 주소;
    if (r.status >= 400) { 못함.push({ 이름, 주소, 왜: 'HTTP ' + r.status }); await 자고(400); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  } catch (e) { 못함.push({ ineq: 1, 이름, 주소, 왜: String(e.message).slice(0, 44) }); await 자고(400); continue; }

  /* 채용 쪽으로 가는 링크를 쪽에서 **찾습니다** (주소를 만들지 않습니다) */
  const 링크들 = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,60}?)<\/a>/gi)]
    .filter((m) => 채용말.test(m[2]) || 채용말.test(m[1]))
    .map((m) => m[1]).slice(0, 6);

  const 꼴 = 꼴들.find(([, re]) => re.test(html) || 링크들.some((l) => re.test(l)));
  const 이름꼴 = 꼴 ? 꼴[0] : '모름';
  if (!묶음.has(이름꼴)) 묶음.set(이름꼴, []);
  묶음.get(이름꼴).push({ 이름, 주소: 끝주소, 채용링크: 링크들[0] || null });
  await 자고(400);
}
process.stderr.write('\n');

console.log('── 꼴 묶음 (많은 것부터) ──');
for (const [꼴, 들] of [...묶음].sort((a, b) => b[1].length - a[1].length)) {
  console.log('\n★ ' + 꼴 + ' — ' + 들.length + '곳');
  for (const v of 들.slice(0, 14)) {
    console.log('   ' + v.이름.slice(0, 30).padEnd(32) + (v.주소 || '').slice(0, 46));
    if (v.채용링크) console.log('      채용 링크 — ' + String(v.채용링크).slice(0, 72));
  }
  if (들.length > 14) console.log('   … 그밖 ' + (들.length - 14) + '곳');
}

console.log('\n── 못 본 곳 ' + 못함.length + '곳 ──');
const 까닭별 = new Map();
for (const v of 못함) {
  const k = /주소 없음/.test(v.왜) ? '주소 없음' : v.왜;
  까닭별.set(k, (까닭별.get(k) || 0) + 1);
}
for (const [k, n] of [...까닭별].sort((a, b) => b[1] - a[1])) console.log('   ' + k + ' — ' + n + '곳');
for (const v of 못함.filter((v) => !/주소 없음/.test(v.왜)).slice(0, 10)) {
  console.log('      ' + v.이름.slice(0, 26) + '  ' + (v.주소 || '').slice(0, 40) + '  ' + v.왜);
}

console.log('\n아무것도 바꾸지 않았습니다.');
