/* 백필 품을 미리 잽니다 (2026-09-27).
 *
 *   node tools/hosp/hs_census.mjs            288곳 전부 (4분쯤)
 *   node tools/hosp/hs_census.mjs 한림 영천    이름에 그 말이 든 곳
 *
 * 세는 것 —
 *   ① 1쪽에서 뽑히는 줄
 *   ② 쪽에 적힌 전체 건수
 *   ③ 쪽 수 · 쪽 넘김 주소를 만들 수 있나
 *   ④ **상세를 열어야 하는 줄** — 네 갈래가 2·3(보류 보장 · 아무 단어 없음)인 것
 *      1(우리 직군 확정)·4(버림 단어만)는 안 엽니다 (2026-09-27 세중님)
 *
 * ④ 를 1쪽 비율로 전체에 늘려 「백필 때 상세를 몇 번 열게 되나」 를 어림합니다.
 * 이 숫자를 먼저 보고 백필을 돌립니다 — 사이트를 두드리는 일이라 함부로 못 합니다.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hs_test.js');
import { sortJob } from '../sort-rule.mjs';
import { 쪽넘김찾기, 적힌전체 } from './paging.mjs';

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

async function 받기(s) {
  const r = await fetch(s.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, redirect: 'follow' });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  let cs = s.enc || (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let html;
  try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  return { code: r.status, html };
}

const 결과 = [];
console.log('볼 곳 ' + 볼것.length + '곳\n');
for (const s of 볼것) {
  let g;
  try { g = await 받기(s); } catch (e) { 결과.push({ 이름: s.name, 왜: String(e && (e.cause?.code || e.message)).slice(0, 40) }); continue; }
  if (g.code >= 400) { 결과.push({ 이름: s.name, 왜: 'HTTP ' + g.code }); continue; }

  let 줄 = [];
  try { 줄 = hospParseHtml(g.html, s); } catch { /* 규칙이 깨짐 */ }
  const 넘김 = 쪽넘김찾기(g.html, s.url);
  const 전체 = 적힌전체(g.html);

  /* 상세를 열어야 하는 줄 — 네 갈래 2·3 */
  let 열것 = 0, 회원 = 0, 버림 = 0;
  줄.forEach((r) => {
    const v = sortJob(r.title, '');
    if (v.단계 === 1) 회원++;
    else if (v.단계 === 4) 버림++;
    else 열것++;
  });

  결과.push({ 이름: s.name, 줄: 줄.length, 전체, 쪽: 넘김 ? 넘김.마지막 : 1,
    넘김됨: !!(넘김 && 넘김.주소만들기), JS로넘김: !!(넘김 && 넘김.JS로넘김),
    회원, 열것, 버림 });
  await new Promise((x) => setTimeout(x, 450));
}

/* ── 모아 보기 ── */
const 산것 = 결과.filter((r) => !r.왜);
const 여러쪽 = 산것.filter((r) => r.쪽 > 1);
const 넘김가능 = 여러쪽.filter((r) => r.넘김됨);
const JS만 = 여러쪽.filter((r) => !r.넘김됨);
const 어림 = (r) => {
  /* 전체 건수를 알면 그것, 모르면 쪽수 × 1쪽 줄 수 */
  const 전부 = r.전체 || (r.쪽 * r.줄);
  const 비율 = r.줄 ? r.열것 / r.줄 : 0;
  return Math.round(전부 * 비율);
};
console.log('\n════ 백필 품 ════');
console.log('  html 쪽 ' + 볼것.length + '곳 중 받은 곳 ' + 산것.length + ' · 못 받은 곳 ' + (결과.length - 산것.length));
console.log('  한 쪽뿐인 곳            ' + (산것.length - 여러쪽.length) + '곳');
console.log('  여러 쪽인 곳            ' + 여러쪽.length + '곳   ← 백필 대상');
console.log('     쪽 주소를 만들 수 있음 ' + 넘김가능.length + '곳');
console.log('     JS 로만 넘김(못 만듦)  ' + JS만.length + '곳   ← 손으로 봐야 합니다');
const 쪽합 = 넘김가능.reduce((a, r) => a + r.쪽, 0);
const 글합 = 넘김가능.reduce((a, r) => a + (r.전체 || r.쪽 * r.줄), 0);
const 열합 = 넘김가능.reduce((a, r) => a + 어림(r), 0);
console.log('\n  넘길 수 있는 ' + 넘김가능.length + '곳 —');
console.log('     받을 쪽 수 합계      ' + 쪽합 + '쪽');
console.log('     글 수 합계(어림)     ' + 글합 + '건');
console.log('     ★ 상세를 열 횟수(어림) ' + 열합 + '번   ← 1쪽의 2·3단계 비율로 늘린 것');
console.log('       한 건에 1.5초면 ' + Math.round(열합 * 1.5 / 60) + '분 · 3초면 ' + Math.round(열합 * 3 / 60) + '분');

console.log('\n════ 쪽이 많은 곳 앞 20 ════');
console.log('기관'.padEnd(30) + '1쪽줄  전체   쪽수  열것(어림)  넘김');
여러쪽.sort((a, b) => (b.전체 || b.쪽 * b.줄) - (a.전체 || a.쪽 * a.줄)).slice(0, 20)
  .forEach((r) => console.log('  ' + r.이름.slice(0, 26).padEnd(28)
    + String(r.줄).padStart(4) + String(r.전체 ?? '-').padStart(7) + String(r.쪽).padStart(6)
    + String(어림(r)).padStart(9) + '   ' + (r.넘김됨 ? '주소' : 'JS')));

const 못받음 = 결과.filter((r) => r.왜);
if (못받음.length) {
  console.log('\n════ 못 받은 곳 ' + 못받음.length + ' ════');
  못받음.slice(0, 15).forEach((r) => console.log('  ' + r.이름.slice(0, 28).padEnd(30) + r.왜));
}
fs.writeFileSync(new URL('./reports/hs_census.json', import.meta.url), JSON.stringify(결과, null, 1), 'utf8');
console.log('\n자세한 것은 tools/hosp/reports/hs_census.json');
