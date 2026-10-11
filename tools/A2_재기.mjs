/* A2 — 「fetch 가 받은 HTML」 과 「브라우저가 그린 HTML」 을 **같은 자**로 잽니다
 * (2026-10-12 · 읽기만).
 *
 *   node tools/A2_재기.mjs
 *
 * 줄을 뽑는 자는 하나뿐입니다 — `hospParseHtml(html, s)`.
 * 수집기(`sites.mjs`)가 쓰는 것과 같은 함수입니다 (지침 6절).
 * 브라우저는 아무 판정도 하지 않았습니다. HTML 만 가져왔습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 글받기 } from './certs/index.mjs';

const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hosp/hs_test.js');
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');

const G = fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8');
const i0 = G.indexOf('const HOSP_SITES = [');
let d = 0; let end = -1;
for (let k = G.indexOf('[', i0); k < G.length; k++) {
  if (G[k] === '[') d++; else if (G[k] === ']' && --d === 0) { end = k + 1; break; }
}
const S = new Function('return ' + G.slice(G.indexOf('[', i0), end))();

const 두겹 = (p) => {
  const s = fs.readFileSync(p, 'utf8').trim();
  try { return JSON.parse(JSON.parse(s)); } catch { return JSON.parse(s); }
};
const 쓸기 = JSON.parse(fs.readFileSync(path.join(폴더, 'C_목록쓸기.json'), 'utf8'));
const 기본머리 = { 'User-Agent': UA, 'Accept-Language': 'ko' };
const 줄뽑기 = (html, s) => {
  let rows;
  try { rows = hospParseHtml(html, s); } catch (e) { return { 탈: String(e.message).slice(0, 90) }; }
  if (s.only) rows = rows.filter((r) => new RegExp(s.only).test(r.title));
  if (s.not) rows = rows.filter((r) => !new RegExp(s.not).test(r.title));
  return { rows };
};

const 결과 = [];
for (const c of ['bohun', 'smc', 'knuh', 'daejain']) {
  const p = path.join(폴더, 'A2_결과_' + c + '.json');
  if (!fs.existsSync(p)) { console.log('✗ ' + c + ' — 결과 파일이 없습니다'); continue; }
  const j = 두겹(p);
  const s = S.find((x) => x.name === j.이름);
  const 줄 = { 코드: c, 곳: j.이름, 갈래: j.갈래, HTTP: j.HTTP, 브라우저_HTML: j.HTML글자, 걸린초: j.걸린초, 탈: j.탈 };

  if (s.type === 'html') {
    /* 브라우저가 그린 HTML 로 뽑기 */
    const b = 줄뽑기(j.HTML, s);
    줄.브라우저_줄 = b.rows ? b.rows.length : null;
    줄.브라우저_제목 = b.rows ? b.rows.map((r) => String(r.title || '').trim()).filter(Boolean) : [];
    줄.브라우저_탈 = b.탈 || null;
    /* fetch 로 다시 받아 같은 함수로 뽑기 — 쓸기 때와 같은 길입니다 */
    const g = await 글받기(s.url, { headers: 기본머리, enc: s.enc });
    줄.fetch_HTTP = g.code ?? null;
    줄.fetch_HTML = (g.html || '').length;
    const f = g.html ? 줄뽑기(g.html, s) : { rows: [] };
    줄.fetch_줄 = f.rows ? f.rows.length : null;
    줄.fetch_제목 = f.rows ? f.rows.map((r) => String(r.title || '').trim()).filter(Boolean) : [];
  } else {
    /* greeting 은 `__NEXT_DATA__` 를 읽는 갈래라 hospParseHtml 이 안 맞습니다.
       브라우저 쪽은 **그린 쪽에 공고 카드가 몇 장인가**로 가늠하고,
       fetch 쪽은 쓸기 결과(= 수집기가 실제로 뽑는 줄)를 그대로 씁니다 */
    const nd = /<script id="__NEXT_DATA__"/.test(j.HTML || '');
    줄.브라우저_줄 = null;
    줄.브라우저_메모 = '갈래 greeting — hospParseHtml 을 안 씁니다. __NEXT_DATA__ 가 그린 쪽에 '
      + (nd ? '있습니다' : '**없습니다**') + ' (수집기는 그것을 읽습니다)';
    const 쓸 = 쓸기.곳.find((x) => x.곳 === j.이름);
    줄.fetch_줄 = 쓸 ? 쓸.줄수 : null;
    줄.fetch_제목 = 쓸 ? 쓸.제목들 : [];
  }
  결과.push(줄);
}

const 견줄 = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
console.log('| 곳 | 갈래 | HTML 글자 b/f | 뽑힌 줄 b/f | 제목이 같나 | 브라우저에만 | fetch 에만 |');
console.log('|---|---|---|---|---|---|---|');
for (const r of 결과) {
  const B = new Set((r.브라우저_제목 || []).map(견줄));
  const F = new Set((r.fetch_제목 || []).map(견줄));
  const b만 = [...B].filter((x) => !F.has(x)).length;
  const f만 = [...F].filter((x) => !B.has(x)).length;
  console.log('| ' + r.곳 + ' | ' + r.갈래
    + ' | ' + r.브라우저_HTML + '/' + (r.fetch_HTML ?? '-')
    + ' | ' + (r.브라우저_줄 ?? '-') + '/' + (r.fetch_줄 ?? '-')
    + ' | ' + (r.갈래 !== 'html' ? '—' : (b만 === 0 && f만 === 0 ? '**똑같습니다**' : '다름'))
    + ' | ' + (r.갈래 !== 'html' ? '—' : b만)
    + ' | ' + (r.갈래 !== 'html' ? '—' : f만) + ' |');
}
console.log('');
for (const r of 결과) {
  console.log('**' + r.곳 + '**' + (r.브라우저_메모 ? ' — ' + r.브라우저_메모 : ''));
  if (r.브라우저_탈) console.log('   브라우저 HTML 로 규칙이 깨짐 — ' + r.브라우저_탈);
  if (r.탈 && r.탈.length) console.log('   쪽 안의 탈 — ' + r.탈.join(' / ').slice(0, 140));
  const B = new Set((r.브라우저_제목 || []).map(견줄));
  for (const t of (r.fetch_제목 || []).slice(0, 4)) {
    console.log('   f · ' + String(t).slice(0, 56) + (B.has(견줄(t)) ? '   (브라우저에도 있음)' : '   ← 브라우저에는 없음'));
  }
  console.log('');
}
fs.writeFileSync(path.join(폴더, 'A2_재기.json'), JSON.stringify({ 센날: new Date().toISOString(), 곳: 결과 }, null, 1));
console.log('→ docs/시험_playwright_1012/A2_재기.json');
