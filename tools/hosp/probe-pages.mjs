/* 「채용페이지_손으로채울곳.md」 에 세중님이 채워 주신 주소를 한 곳씩 두드립니다.
 *
 *   node tools/hosp/probe-pages.mjs              전부
 *   node tools/hosp/probe-pages.mjs 한림 차의과   이름에 그 말이 든 곳만
 *
 * 보는 것 — 응답 코드 · 크기 · 채용글처럼 보이는 줄 수 · 열림/막힘/JS
 * **뚫으려 하지 않습니다.** 막힌 곳은 표시만 하고 넘어갑니다 (세중님 지시).
 *
 * 「채용글 수」 는 어림입니다 — 날짜(2026-09-01 꼴)가 든 표 줄이나 목록 줄을 셉니다.
 * 정확한 셈은 `HOSP_SITES` 규칙을 만들고 나서 `hs_test.js` 로 합니다.
 */
import fs from 'node:fs';
import https from 'node:https';

const 찾을말 = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* 표에서 기관 이름과 채용 페이지 주소를 꺼냅니다 */
const 글 = fs.readFileSync(new URL('../../채용페이지_손으로채울곳.md', import.meta.url), 'utf8');
const 줄들 = [];
for (const line of 글.split(/\r?\n/)) {
  if (!line.startsWith('|')) continue;
  const c = line.split('|').map((x) => x.trim());
  if (c.length < 7) continue;
  const [, 갈래, 기관, 지역, 홈, 채용, 비고] = c;
  if (!기관 || 기관 === '기관' || /^-+$/.test(기관)) continue;
  if (/제외/.test(비고 || '')) { 줄들.push({ 갈래, 기관, 지역, url: '', 비고, 건너뜀: '제외 — ' + 비고 }); continue; }
  const u = (채용 || '').match(/https?:\/\/\S+/);
  줄들.push({ 갈래, 기관, 지역, url: u ? u[0] : '', 비고, 상태쓴것: 비고 });
}
const 볼것 = 찾을말.length ? 줄들.filter((r) => 찾을말.some((w) => r.기관.includes(w))) : 줄들;
console.log('표에서 읽은 것 ' + 줄들.length + '곳 · 이번에 볼 것 ' + 볼것.length + '곳\n');

/* 인증서가 낡은 곳이 있어 따로 봅니다 — **끄지 않고**, 실패하면 그렇게 적습니다 */
const agent = new https.Agent({ keepAlive: false });

async function 두드리기(u) {
  const t0 = Date.now();
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, redirect: 'follow', agent });
    const buf = Buffer.from(await r.arrayBuffer());
    return { code: r.status, 몸: buf, ms: Date.now() - t0, 끝주소: r.url,
      ct: r.headers.get('content-type') || '' };
  } catch (e) {
    return { code: 0, ms: Date.now() - t0, 왜: String(e && (e.cause?.code || e.message) || e).slice(0, 80) };
  }
}

/* 채용글처럼 보이는 줄 세기 — 어림입니다 */
function 글수(html) {
  const 날짜 = (html.match(/20\d{2}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/g) || []).length;
  const tr = (html.match(/<tr[\s>]/gi) || []).length;
  const li = (html.match(/<li[\s>]/gi) || []).length;
  const 채용말 = (html.match(/채용|모집|구인/g) || []).length;
  return { 날짜, tr, li, 채용말 };
}
/* 알맹이가 자바스크립트로 그려지는 쪽인가 */
function JS쪽인가(html, u) {
  if (/#\//.test(u)) return true;                                  // #/… 주소
  const 본문 = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const 글자 = 본문.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return 글자.length < 600 && /<div id="(root|app|__next)"|React|Vue|angular/i.test(html);
}

const 결과 = [];
for (const r of 볼것) {
  if (r.건너뜀) { 결과.push({ ...r, 판정: '건너뜀', 메모: r.건너뜀 }); console.log('－ ' + r.기관.slice(0, 24).padEnd(26) + r.건너뜀); continue; }
  if (!r.url) { 결과.push({ ...r, 판정: '주소 없음', 메모: r.비고 || '' }); console.log('? ' + r.기관.slice(0, 24).padEnd(26) + '채용 페이지 칸이 비었습니다'); continue; }

  const g = await 두드리기(r.url);
  if (!g.code) {
    결과.push({ ...r, 판정: '못 붙음', code: 0, 메모: g.왜 });
    console.log('✗ ' + r.기관.slice(0, 24).padEnd(26) + '못 붙음 · ' + g.왜);
    continue;
  }
  const html = g.몸.toString('utf8');
  const n = 글수(html);
  const js = JS쪽인가(html, r.url);
  let 판정 = '열림';
  if (g.code >= 400) 판정 = '막힘';
  else if (js) 판정 = 'JS';
  else if (n.채용말 < 3) 판정 = '글 적음';

  결과.push({ ...r, 판정, code: g.code, 크기: g.몸.length, n, 끝주소: g.끝주소 });
  const 표 = 판정 === '열림' ? '○' : 판정 === 'JS' ? '◐' : '✗';
  console.log(표 + ' ' + r.기관.slice(0, 24).padEnd(26)
    + String(g.code).padStart(3) + ' · ' + String(g.몸.length).padStart(7) + '바이트'
    + ' · 날짜 ' + String(n.날짜).padStart(3) + ' · tr ' + String(n.tr).padStart(3)
    + ' · 「채용/모집」 ' + String(n.채용말).padStart(3)
    + ' · ' + 판정
    + (g.끝주소 && g.끝주소 !== r.url ? '  → ' + g.끝주소.slice(0, 60) : ''));
  await new Promise((x) => setTimeout(x, 700));
}

console.log('\n── 모아 보기 ──');
const 갈래별 = {};
결과.forEach((r) => { (갈래별[r.판정] = 갈래별[r.판정] || []).push(r); });
for (const k of Object.keys(갈래별)) {
  console.log('\n' + k + ' ' + 갈래별[k].length + '곳');
  갈래별[k].forEach((r) => console.log('   ' + r.기관.slice(0, 30).padEnd(32)
    + (r.code !== undefined ? 'HTTP ' + r.code + ' · ' : '') + (r.메모 || (r.n ? '채용말 ' + r.n.채용말 + ' · 날짜 ' + r.n.날짜 : ''))));
}
fs.writeFileSync(new URL('./reports/probe-pages.json', import.meta.url),
  JSON.stringify(결과, null, 1).replace(/"몸":[^,]*,/g, ''), 'utf8');
console.log('\n자세한 것은 tools/hosp/reports/probe-pages.json');
