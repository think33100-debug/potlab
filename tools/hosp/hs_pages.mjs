/* 「첫 페이지만 긁고 있나」 를 잽니다 (2026-09-27).
 *
 *   node tools/hosp/hs_pages.mjs 한림 순천향 …
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 * 대학병원 17곳에서 96줄이 나왔고 그중 우리 직군이 1건이라, 저는
 * 「우리 직군이 없어서 0건」 이라고 보고했습니다. 그런데 한 곳 평균 6줄입니다.
 * 같은 날 마이다스에서 getMainView 가 6건을 주는 걸 보고 전체를 찾아보니
 * **491건**이었습니다. 6은 「첫 화면에 보이는 수」 였습니다.
 *
 * 그래서 홈페이지 쪽도 같은 의심을 합니다 — 쪽에 적힌 **전체 건수**와
 * **페이지 넘김 표시**를 찾아 우리가 뽑은 줄 수와 견줍니다.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hs_test.js');

const 찾을말 = process.argv.slice(2).filter((x) => !x.startsWith('--'));

const GAS = fs.readFileSync(new URL('../../gas/wage.js', import.meta.url), 'utf8');
const i0 = GAS.indexOf('const HOSP_SITES = [');
let d = 0, end = -1;
for (let k = GAS.indexOf('[', i0); k < GAS.length; k++) {
  if (GAS[k] === '[') d++; else if (GAS[k] === ']' && --d === 0) { end = k + 1; break; }
}
const SITES = new Function('return ' + GAS.slice(GAS.indexOf('[', i0), end))();
const 볼것 = (찾을말.length ? SITES.filter((s) => 찾을말.some((w) => s.name.includes(w))) : SITES)
  .filter((s) => s.type === 'html' && s.url);

console.log('볼 곳 ' + 볼것.length + '곳\n');
console.log('기관'.padEnd(28) + '뽑은줄  쪽에 적힌 전체  페이지넘김  마지막쪽');

for (const s of 볼것) {
  let html = '', code = 0;
  try {
    const r = await fetch(s.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, redirect: 'follow' });
    code = r.status;
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    let cs = s.enc || (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  } catch (e) {
    console.log(s.name.slice(0, 26).padEnd(28) + '못 붙음 · ' + String(e && (e.cause?.code || e.message)).slice(0, 40));
    continue;
  }
  if (code >= 400) { console.log(s.name.slice(0, 26).padEnd(28) + 'HTTP ' + code); continue; }

  let 줄 = [];
  try { 줄 = hospParseHtml(html, s); } catch { /* 규칙이 깨짐 */ }

  /* 쪽에 적힌 전체 건수 — 「총 123건」 「전체 123」 「Total 123」 */
  const 전체 = (html.match(/(?:총|전체|Total)\s*[:\s]*<?[^>]{0,30}?>?\s*([\d,]{1,7})\s*(?:건|개|EA)?/i) || [])[1];
  /* 페이지 넘김 — 쪽 번호 링크가 둘 이상이면 여러 쪽입니다 */
  const 쪽번호 = [...new Set([...html.matchAll(/(?:page|pageNo|pageIndex|currentPage|movePage|nowPage|cpage)\s*=\s*["']?(\d{1,4})/gi)]
    .map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 999))];
  const 마지막 = 쪽번호.length ? Math.max(...쪽번호) : 0;

  const 의심 = 전체 && 줄.length && Number(String(전체).replace(/,/g, '')) > 줄.length * 1.5;
  console.log((의심 ? '⚠ ' : '  ') + s.name.slice(0, 24).padEnd(26)
    + String(줄.length).padStart(5)
    + String(전체 ? 전체 + '건' : '-').padStart(14)
    + String(쪽번호.length > 1 ? 쪽번호.length + '개' : '-').padStart(11)
    + String(마지막 > 1 ? 마지막 : '-').padStart(10)
    + (의심 ? '   ← 첫 페이지만일 수 있습니다' : ''));
  await new Promise((x) => setTimeout(x, 500));
}
console.log('\n⚠ 는 「쪽에 적힌 전체」 가 우리가 뽑은 줄의 1.5배를 넘는 곳입니다');
