/* 묶음열어보기 — 푼 폴더를 **브라우저로 실제로 열어** 봅니다 (file://).
 *
 *   node tools/묶음열어보기.mjs <푼 폴더>
 *
 * 글자로 맞춰 보는 것과 브라우저가 여는 것은 다릅니다 (작업지침 12절).
 * 시작 → 갤러리 → 04 화면스펙 을 **눌러서** 따라갑니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const 방 = process.argv[2];
if (!방 || !fs.existsSync(방)) { console.error('쓰기: node tools/묶음열어보기.mjs <푼 폴더>'); process.exit(1); }
const 탈 = [];
const 적기 = (됐나, 말) => { console.log((됐나 ? '  ○ ' : '  ✗ ') + 말); if (!됐나) 탈.push(말); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const 화면탈 = [];
p.on('pageerror', (e) => 화면탈.push(String(e).slice(0, 80)));

/* ① 시작.html */
await p.goto(pathToFileURL(path.join(방, '시작.html')).href);
await p.waitForTimeout(600);
적기((await p.title()).includes('POTJOB'), '시작.html 이 열립니다 — ' + (await p.title()));
const 큰단추 = await p.locator('a.큰').count();
const 순서 = await p.locator('ol.순서 li a').count();
적기(큰단추 === 2 && 순서 === 7, `큰 단추 ${큰단추}개 · 읽는 순서 ${순서}줄`);

/* ② 시작 → 갤러리 */
await p.locator('a.큰').first().click();
await p.waitForTimeout(2500);
적기(p.url().includes('index.html'), '시작 → 갤러리로 건너갑니다');
const 갤 = await p.evaluate(() => ({
  화면: document.querySelectorAll('section.screen').length,
  그림: document.querySelectorAll('figure').length,
  깨짐: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
  절링크: document.querySelectorAll('a.spec').length,
}));
적기(갤.깨짐 === 0, `갤러리 — 화면 ${갤.화면} · 그림 ${갤.그림} · 안 그려진 그림 ${갤.깨짐}`);

/* ③ 갤러리 → 04 화면스펙 (닻까지) */
const 첫절 = p.locator('a.spec').first();
const 가는곳 = await 첫절.getAttribute('href');
await 첫절.click();
await p.waitForTimeout(1200);
/* 주소는 퍼센트 인코딩이라 그대로 견주면 안 됩니다 */
적기(decodeURIComponent(p.url()).includes('04_화면스펙.html'), `갤러리 → 04 화면스펙 (${가는곳})`);
const 닻걸림 = await p.evaluate(() => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return '닻 없음';
  const el = document.getElementById(id);
  if (!el) return '닻 못 찾음: ' + id;
  return '닻 걸림: ' + el.textContent.trim().slice(0, 40);
});
적기(닻걸림.startsWith('닻 걸림'), 닻걸림);

/* ④ 시작 → 낱말 풀이 */
await p.goto(pathToFileURL(path.join(방, '시작.html')).href);
await p.locator('a.큰').nth(1).click();
await p.waitForTimeout(900);
적기(await p.evaluate(() => {
  const id = decodeURIComponent(location.hash.slice(1));
  return !!document.getElementById(id);
}), '시작 → 낱말 풀이 닻');

/* ⑤ 문서 일곱을 하나씩 열어 봅니다 */
for (const f of ['00_읽는법', '01_기획', '02_기술스펙', '03_IA', '04_화면스펙', '05_부록']) {
  await p.goto(pathToFileURL(path.join(방, 'docs', '인계', f + '.html')).href);
  await p.waitForTimeout(250);
  const 글자수 = (await p.evaluate(() => document.body.innerText.length));
  적기(글자수 > 500, `${f}.html — 글자 ${글자수}자`);
}

적기(화면탈.length === 0, '화면 오류 ' + (화면탈.length ? 화면탈.join(' | ') : '없음'));
await b.close();
console.log(탈.length ? `\n✗ 걸린 것 ${탈.length}개\n` : '\n○ 다 열립니다\n');
process.exit(탈.length ? 1 : 0);
