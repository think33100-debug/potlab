/* 1층 사각지대 기관의 **채용 게시판을 찾아 꼴별로 묶습니다** (2026-10-18 세중님 B)
 *
 *   node tools/hosp/사각지대훑기.mjs                 상급종합·대학·종합 (주소 있는 곳)
 *   node tools/hosp/사각지대훑기.mjs --갈래 종합병원
 *   node tools/hosp/사각지대훑기.mjs --몇개 20
 *   node tools/hosp/사각지대훑기.mjs --자기점검
 *
 * ── 왜 ───────────────────────────────────────────────
 * ① 안 긁는 1층 기관이 **476곳**입니다. 그중 보건소 244 는 중앙 창구로 들어오니
 * 긁어서 메울 자리가 아니고, **상급종합 2 · 대학 19 · 종합 56 이 진짜 숙제**입니다.
 *
 * 주소는 `hira_org.hosp_url` 에서 옵니다 — **짐작하지 않습니다** (지침 3절).
 *
 * ── 무엇을 내나 ──────────────────────────────────────
 *   · robots 판정 (`User-agent: *` 쪽 Disallow 만 봅니다)
 *   · 첫 화면이 열리나 · 몇 바이트인가
 *   · 채용·인재 링크 (글자와 주소)
 *   · **꼴 묶음** — 아래 `꼴가리기()` 가 정합니다. 같은 꼴은 설정 하나로 여러 곳이 됩니다
 *
 * ★ 같은 사이트 3.5초 이상. 403·429·빈 응답이 이어서 3번이면 그 사이트를 멈춥니다.
 * ★ 읽기만 합니다. 설정을 만들지 않습니다 — 묶음을 보고 사람이 정합니다.
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};

/* 쪽을 보고 **꼴**을 가립니다. 같은 꼴이면 설정 하나로 여러 곳이 풀립니다.
   ★ 꼴 이름은 **우리가 본 것**만 씁니다 — 「아마 ○○」 같은 짐작을 넣지 않습니다 */
export function 꼴가리기({ 끝주소, 바이트, 글, 링크수 }) {
  const u = String(끝주소 || '');
  const h = String(글 || '');
  if (/jobflex|job-?flex/i.test(u + h)) return 'JobFlex (대행)';
  if (/recruiter\.co\.kr/i.test(u + h)) return 'recruiter.co.kr (대행)';
  if (/incruit\.com/i.test(u + h)) return '인크루트 (대행)';
  if (/greetinghr|ninehire|saramin|jobkorea/i.test(u + h)) return '그밖 대행';
  if (바이트 > 0 && 바이트 < 3000 && /location\s*(?:\.href)?\s*=|url\s*=/.test(h)) return 'JS 로 옮겨 가는 껍데기';
  if (바이트 > 0 && 바이트 < 4000 && 링크수 === 0) return 'JS 로 만드는 껍데기';
  if (링크수 > 0) return '자체 게시판 (링크 찾음)';
  return '열리는데 채용 링크를 못 찾음';
}

/* 스킴 후보 — 아래 잘받기() 가 씁니다. 자기점검이 먼저 쓰니 여기 둡니다 */
const 짝스킴 = (t) => (/^http:/i.test(t) ? t.replace(/^http:/i, 'https:') : t.replace(/^https:/i, 'http:'));
export const 후보주소 = (u) => {
  const t = String(u || '').trim();
  if (!t) return [];
  if (!/^https?:\/\//i.test(t)) return ['https://' + t, 'http://' + t];
  return [t, 짝스킴(t)];
};

if (argv.includes('--자기점검')) {
  const 어겼나 = [];
  const 봐 = (n, c) => { if (!c) 어겼나.push(n); };
  /* 스킴 후보 — 2026-10-18 에 실제로 열어 본 다섯 곳이 견본입니다
     (docs/주소_열어본근거_1018.md) */
  봐('스킴 없음 → https 먼저',
    JSON.stringify(후보주소('www.kbhospital.com/'))
    === JSON.stringify(['https://www.kbhospital.com/', 'http://www.kbhospital.com/']));
  봐('http 이면 https 로 한 번 더 (울산대)',
    JSON.stringify(후보주소('http://www.uuh.ulsan.kr/main/main.asp'))
    === JSON.stringify(['http://www.uuh.ulsan.kr/main/main.asp', 'https://www.uuh.ulsan.kr/main/main.asp']));
  봐('https 이면 http 로 한 번 더 (세종여주·화성유일)',
    JSON.stringify(후보주소('https://www.hsyuil.kr/'))
    === JSON.stringify(['https://www.hsyuil.kr/', 'http://www.hsyuil.kr/']));
  봐('후보는 늘 두 개 — 세 번 두드리지 않습니다', 후보주소('https://a.kr').length === 2);
  봐('빈 값은 후보가 없습니다', 후보주소('').length === 0 && 후보주소(null).length === 0);
  봐('경로 안의 http 는 안 건드립니다',
    후보주소('https://a.kr/go?u=http://b.kr')[1] === 'http://a.kr/go?u=http://b.kr');
  봐('JobFlex', 꼴가리기({ 끝주소: 'https://a.jobflex.com/x', 바이트: 50000, 글: '', 링크수: 2 }) === 'JobFlex (대행)');
  봐('recruiter', 꼴가리기({ 끝주소: 'https://x.recruiter.co.kr/', 바이트: 50000, 글: '', 링크수: 1 }) === 'recruiter.co.kr (대행)');
  봐('JS 로 옮겨 가는 껍데기',
    꼴가리기({ 끝주소: 'https://a.kr/', 바이트: 218, 글: '<script>location.href="/index.jsp"</script>', 링크수: 0 }) === 'JS 로 옮겨 가는 껍데기');
  봐('JS 로 만드는 껍데기',
    꼴가리기({ 끝주소: 'https://a.kr/', 바이트: 1687, 글: '<div id="root"></div>', 링크수: 0 }) === 'JS 로 만드는 껍데기');
  봐('자체 게시판', 꼴가리기({ 끝주소: 'https://a.kr/', 바이트: 90000, 글: '', 링크수: 3 }) === '자체 게시판 (링크 찾음)');
  봐('링크 못 찾음', 꼴가리기({ 끝주소: 'https://a.kr/', 바이트: 90000, 글: '', 링크수: 0 }) === '열리는데 채용 링크를 못 찾음');
  if (어겼나.length) { console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과 — 꼴 가리기 6가지 · 스킴 후보 6가지 (사이트를 두드리지 않았습니다)');
  process.exit(0);
}

const 갈래 = 값('--갈래', '');
const 뚜껑 = Number(값('--몇개', 200));
const cfg = {};
for (const 이름 of ['../../.env', '../../.env.local']) {
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
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

/* 사각지대 기관 + hira_org 주소 — 창구로 받습니다.
 *
 * ★ 2026-10-18 — **RPC 결과도 100줄에서 끊깁니다.** 처음에 한 번만 불러
 *   「사각지대 21곳」 으로 나왔는데 SQL 로 세면 **77곳**이었습니다.
 *   `Range: 0-999` 를 줘도 `content-range: 0-99/*` 로 **100줄만** 옵니다 —
 *   Supabase 가 max-rows 를 100 으로 묶어 두었고 Range 로는 못 넘깁니다.
 *   그래서 **`offset` 으로** 넘깁니다. 갈래별로 보니 종합병원이 아예 안 와서
 *   21곳이었습니다 (상급종합 2 · 대학병원 19 · 공공보건의료 79 = 100줄).
 *
 * ★ 같은 실수를 **다섯 번** 했습니다 — 916→100 · 343→100 · 시험자료 섞임 ·
 *   77→21 · 그리고 Range 로 고쳤다고 믿은 것. **받은 줄 수를 분모와 맞춰 보는
 *   것**이 유일한 그물입니다. 그래서 아래에 받은 줄 수를 찍습니다. */
const 구멍전부 = [];
for (let off = 0; ; off += 100) {
  const r0 = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('일층병원_구멍')
    + '?limit=100&offset=' + off, { method: 'POST', headers: H, body: '{}' });
  if (!r0.ok) { console.error('✗ 일층병원_구멍 ' + r0.status + ' ' + (await r0.text()).slice(0, 160)); process.exit(1); }
  const 한쪽 = await r0.json();
  구멍전부.push(...한쪽);
  if (!한쪽.length) break;
  if (off > 20000) { console.error('✗ 너무 많습니다 — 멈춥니다'); break; }
}
{
  const 갈 = {};
  for (const x of 구멍전부) 갈[x['갈래']] = (갈[x['갈래']] || 0) + 1;
  console.log('일층병원_구멍() 받은 줄 ' + 구멍전부.length + ' — '
    + Object.entries(갈).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
}
const 구멍 = 구멍전부.filter((x) => x['상태'] === '사각지대'
  && ['상급종합', '대학병원', '종합병원'].includes(x['갈래'])
  && (!갈래 || x['갈래'] === 갈래));
const 이름들 = [...new Set(구멍.map((x) => x['기관']))];
const 주소 = {};
for (let i = 0; i < 이름들.length; i += 40) {
  const 조각 = 이름들.slice(i, i + 40).map((n) => '"' + n.replace(/"/g, '') + '"').join(',');
  const r = await fetch(U + '/rest/v1/hira_org?select=yadm_nm,hosp_url&yadm_nm=in.(' + encodeURIComponent(조각) + ')', { headers: H });
  if (!r.ok) continue;
  for (const x of await r.json()) if (x.hosp_url) 주소[x.yadm_nm] = x.hosp_url;
}
const 볼것 = 구멍.filter((x) => 주소[x['기관']]).slice(0, 뚜껑);
console.log('사각지대 ' + 구멍.length + '곳 (상급종합·대학·종합) · 그중 주소 있는 곳 '
  + 구멍.filter((x) => 주소[x['기관']]).length + '곳 · 볼 것 ' + 볼것.length + '곳');
console.log(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' KST\n');

const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const 끝때 = new Map();
const 막힘 = new Map();
const 결과 = [];

const robots판정 = (txt) => {
  if (!txt) return '없음(열림)';
  let 안 = false; const 금지 = [];
  for (const l of txt.split(/\r?\n/).map((x) => x.trim())) {
    const ua = l.match(/^user-agent\s*:\s*(.+)$/i);
    if (ua) { 안 = ua[1].trim() === '*'; continue; }
    const d = l.match(/^disallow\s*:\s*(.*)$/i);
    if (d && 안) 금지.push(d[1].trim());
  }
  if (금지.includes('/')) return '★ 전면 금지';
  return 금지.length ? '일부 금지' : '제한 없음';
};
const 받기 = async (u) => {
  let host;
  try { host = new URL(u).host; } catch { return { 왜: '주소 꼴이 아님' }; }
  if ((막힘.get(host) || 0) >= 3) return { 왜: '그 사이트 막힘 3번' };
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 3500) await 자고(3500 - 지난);
  끝때.set(host, Date.now());
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (r.status === 403 || r.status === 429) { 막힘.set(host, (막힘.get(host) || 0) + 1); return { 왜: 'HTTP ' + r.status + ' (막힘)' }; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) { 막힘.set(host, (막힘.get(host) || 0) + 1); return { 왜: '빈 응답' }; }
    막힘.set(host, 0);
    const euc = /charset=['"]?(euc-kr|ks_c_5601)/.test(buf.toString('latin1').slice(0, 2000).toLowerCase());
    let t; try { t = new TextDecoder(euc ? 'euc-kr' : 'utf-8').decode(buf); } catch { t = buf.toString('utf8'); }
    return { code: r.status, 글: t, 끝: r.url, 바이트: buf.length };
  } catch (e) { return { 왜: String(e && e.message || e).slice(0, 44) }; }
};
/* ── 스킴을 가립니다 (2026-10-18 세중님 9번) ──────────────────────
 * `hira_org.hosp_url` 8,824줄 중 **822줄에 `http://` 가 없습니다**(9.3%).
 * 그리고 스킴이 적혀 있어도 틀린 곳이 있습니다 — 울산대학교병원은 값이
 * `http://` 인데 **사이트는 https 만 받습니다**(http 는 소켓을 끊습니다).
 * 반대도 있습니다 — 세종여주병원·화성유일병원은 값이 `https://` 인데
 * 인증서가 만료·이름 불일치라 **http 로만** 열립니다.
 *
 * 그래서 **표를 822번 고치지 않고 읽는 자리에서 가립니다.** 두 번 해 보고
 * 안 되면 멈춥니다 (세중님 규칙 · 근거는 docs/주소_열어본근거_1018.md).
 * 822줄을 고치는 길로 갔다면 다음 심평원 동기화가 우리 수정을 덮습니다. */
const 잘받기 = async (u) => {
  let 마지막 = { 왜: '주소가 비었습니다' };
  for (const c of 후보주소(u)) {
    const r = await 받기(c);
    if (!r.왜) return { ...r, 쓴주소: c, 고침: c === String(u).trim() ? '' : '원값 「' + u + '」 → ' + c };
    마지막 = { ...r, 왜: r.왜 + ' (' + c.replace(/^(https?):\/\/.*/, '$1') + ')' };
  }
  return { ...마지막, 쓴주소: null };
};

const 링크찾기 = (글) => {
  const 본것 = new Set(); const out = [];
  for (const m of String(글).matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,70}?)<\/a>/gi)) {
    const t = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/채용|인재|구인|모집|취업|recruit|job/i.test(t + ' ' + m[1])) continue;
    const k = t + '|' + m[1];
    if (본것.has(k)) continue; 본것.add(k);
    out.push({ 글자: t.slice(0, 22), 주소: m[1].slice(0, 90) });
  }
  return out;
};

for (const [i, x] of 볼것.entries()) {
  const u = 주소[x['기관']];
  /* 본 주소를 먼저 받아 **쓸 주소**를 정하고, 그 origin 으로 robots 를 봅니다.
     못 받는 곳에 robots 요청을 또 보내지 않습니다 */
  const h = await 잘받기(u);
  if (h.왜) { 결과.push({ x, u, robots: '(안 봄)', 꼴: '못 받음 · ' + h.왜 }); }
  else {
    let origin;
    try { origin = new URL(h.쓴주소).origin; } catch { 결과.push({ x, u, 꼴: '주소 꼴이 아님' }); continue; }
    const rb = await 받기(origin + '/robots.txt');
    const rbs = rb.왜 ? '못 받음' : (rb.code === 200 ? robots판정(rb.글) : '없음(열림)');
    if (h.고침) console.log('    [스킴] ' + x['기관'] + ' — ' + h.고침);
    const L = 링크찾기(h.글);
    결과.push({ x, u, robots: rbs, 바이트: h.바이트, 끝: h.끝, 링크: L, 꼴: 꼴가리기({ 끝주소: h.끝, 바이트: h.바이트, 글: h.글, 링크수: L.length }) });
  }
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + '   ');
}
process.stderr.write('\n');

const 꼴별 = {};
for (const r of 결과) (꼴별[r.꼴] ??= []).push(r);
console.log('── 꼴 묶음 ──');
for (const [k, xs] of Object.entries(꼴별).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + String(xs.length).padStart(3) + '곳  ' + k);
}
console.log('\n── 꼴별 자세히 ──');
for (const [k, xs] of Object.entries(꼴별).sort((a, b) => b[1].length - a[1].length)) {
  console.log('\n════ ' + k + ' (' + xs.length + '곳) ════');
  for (const r of xs.slice(0, 12)) {
    console.log('  [' + r.x['갈래'] + '] ' + String(r.x['기관']).slice(0, 26) + ' · robots ' + (r.robots || '-'));
    console.log('     ' + r.u + (r.바이트 ? ' → ' + r.바이트 + '바이트' : ''));
    for (const l of (r.링크 || []).slice(0, 3)) console.log('        ' + l.글자 + ' → ' + l.주소);
  }
  if (xs.length > 12) console.log('  … 그밖 ' + (xs.length - 12) + '곳');
}
const 금지 = 결과.filter((r) => r.robots === '★ 전면 금지');
if (금지.length) console.log('\n★ robots 전면 금지 ' + 금지.length + '곳 — ' + 금지.map((r) => r.x['기관']).join(' · '));
console.log('\n※ 읽기만 했습니다. 설정을 만들지 않았습니다');
