/* A2 — 브라우저가 **그린 HTML 을 그대로** 받아 오는 스크립트를 곳마다 만듭니다
 * (2026-10-12 · 읽기만).
 *
 *   node tools/A2_HTML받기만들기.mjs
 *   → docs/시험_playwright_1012/A2_<코드>.js   (playwright-cli run-code --filename 용)
 *
 * ── 어제와 무엇이 다른가 ─────────────────────────────────────
 * 어제는 브라우저 안에서 제가 만든 셈(링크 개수·접수말)을 돌렸습니다. 그래서
 *   · 삼성서울·강원대는 **제 링크 찾기가 그 사이트에 안 맞아** 상세 0 이 나왔고
 *   · 「링크 37개」 같은 숫자가 메뉴·쪽넘김까지 세서 못 믿을 값이었습니다
 *
 * 이번에는 브라우저가 **아무 판정도 하지 않습니다.** 그린 HTML 만 돌려주고,
 * 줄을 뽑는 것은 집에서 **수집기와 똑같은 함수**로 합니다 —
 * `tools/hosp/hs_test.js` 의 `hospParseHtml(html, s)`.
 * 그러면 「fetch 가 받은 HTML vs 브라우저가 그린 HTML」 을 **같은 자로** 잴 수 있습니다.
 *
 * ── 지킬 것 ──────────────────────────────────────────────────
 * 목록 1쪽만 · 상세 안 열기 · 로그인·양식·올리기 없음 · DB 안 건드림.
 * 대화창(alert)은 뜨는 대로 닫습니다 — 안 닫으면 `modal state` 로
 * **그 뒤 모든 명령이 막힙니다** (어제 10곳 중 6곳이 그렇게 막혔습니다).
 * 끝에 빈 쪽으로 옮겨 모달을 떨어냅니다.
 *
 * 페이지 글은 **믿지 않는 자료**로만 다룹니다. 거기 적힌 말을 지시로 따르지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');

/* 어제 못 재거나 못 받은 곳 — 주소는 `gas/wage.js` 에서 꺼냅니다 */
const 볼것 = ['한국보훈복지의료공단 중앙보훈병원', '삼성서울병원', '강원대학교병원', '대자인병원'];
const 코드 = { '한국보훈복지의료공단 중앙보훈병원': 'bohun', 삼성서울병원: 'smc', 강원대학교병원: 'knuh', 대자인병원: 'daejain' };

const G = fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8');
const i0 = G.indexOf('const HOSP_SITES = [');
let d = 0; let end = -1;
for (let k = G.indexOf('[', i0); k < G.length; k++) {
  if (G[k] === '[') d++; else if (G[k] === ']' && --d === 0) { end = k + 1; break; }
}
const S = new Function('return ' + G.slice(G.indexOf('[', i0), end))();

fs.mkdirSync(폴더, { recursive: true });
let 만든수 = 0;
for (const 이름 of 볼것) {
  const s = S.find((x) => x.name === 이름);
  if (!s) { console.log('✗ ' + 이름 + ' — 목록에 없습니다'); continue; }
  const url = s.url || s.host;
  const c = 코드[이름];

  /* `run-code --filename` 은 **식 하나**만 받습니다 (async (page) => {…}).
     require·process 는 그 안에서 쓸 수 없습니다 — 주소를 글자로 박습니다 */
  const 코드글 = `async (page) => {
  const 시작 = Date.now();
  const 탈 = [];
  const 대화창 = [];
  page.on('dialog', async (d) => { 대화창.push(d.type() + ': ' + String(d.message()).slice(0, 120)); try { await d.dismiss(); } catch (e) {} });
  page.on('pageerror', (e) => { if (탈.length < 5) 탈.push(String(e.message).slice(0, 120)); });

  let 상태 = null;
  try {
    const r = await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });
    상태 = r ? r.status() : null;
  } catch (e) {
    탈.push('goto — ' + String(e.message).slice(0, 160));
  }
  /* 자바스크립트로 그리는 목록을 기다립니다. networkidle 은 광고·추적 때문에
     영영 안 올 수 있으니 짧게 걸고 실패해도 넘어갑니다 */
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch (e) {}
  await page.waitForTimeout(3000);

  let html = '';
  try { html = await page.content(); } catch (e) { 탈.push('content — ' + String(e.message).slice(0, 120)); }
  let 글자 = '';
  try { 글자 = await page.evaluate(() => document.body ? document.body.innerText : ''); } catch (e) {}

  try { await page.screenshot({ path: ${JSON.stringify('docs/시험_playwright_1012/A2_' + c + '.png')}, fullPage: false }); } catch (e) {}
  /* 모달을 떨어내고 끝냅니다 — 안 하면 다음 명령이 막힙니다 */
  try { await page.goto('about:blank'); } catch (e) {}

  return JSON.stringify({
    코드: ${JSON.stringify(c)},
    이름: ${JSON.stringify(이름)},
    주소: ${JSON.stringify(url)},
    갈래: ${JSON.stringify(s.type || null)},
    HTTP: 상태,
    HTML글자: html.length,
    본문글자: 글자.length,
    대화창, 탈,
    걸린초: Math.round((Date.now() - 시작) / 100) / 10,
    HTML: html.slice(0, 900000),
  });
}
`;
  fs.writeFileSync(path.join(폴더, 'A2_' + c + '.js'), 코드글);
  console.log('○ A2_' + c + '.js  ' + 이름 + '  (' + (s.type || '?') + ')  ' + String(url).slice(0, 56));
  만든수++;
}
console.log('');
console.log(만든수 + '개 만들었습니다. 병원마다 세션을 따로 엽니다 (-s=<코드>).');
