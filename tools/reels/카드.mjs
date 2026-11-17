/* 릴스 자료(JSON) → 카드뉴스 사진 3~4장 (1080×1350 · JPEG) (2026-11-17 세중님 「카드뉴스도 · 릴스와 둘 다」)

   node tools/reels/카드.mjs --자료 <reel.json> --나감 <폴더>    → <폴더>/<id>-카드1.jpg … 를 만들고 경로를 한 줄씩 찍음

   · 영상과 **같은 장면**(scene.html)을 카드 판(4:5)으로 놓고, 장면마다 애니메이션이 끝난 순간을 찍습니다
       1 걸기(사진·로고 · 이미지 출처)  2 기관 소개(공식 값이 있을 때만)  3 공고 내용  4 마무리(CTA)
   · 글과 숫자는 영상과 같은 자료에서 옵니다 — 카드라고 따로 지어 쓰는 말이 없습니다
   · 인스타 API 로 카드뉴스를 올리려면 사진이 **공개 주소**에 있어야 합니다(image_url). 그 자리는 아직 정하지 않았습니다 —
     지금은 메일·드라이브로 보내 휴대폰에서 올립니다 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));

export async function 카드만들기(자료파일, 나감) {
  const { chromium } = require('playwright');
  const 자료 = JSON.parse(fs.readFileSync(자료파일, 'utf8'));
  const 바탕 = path.dirname(자료파일);
  if (자료.사진 && !/^file:/.test(자료.사진)) 자료.사진 = pathToFileURL(path.resolve(바탕, 자료.사진)).href;
  if (자료.로고?.파일 && !/^file:/.test(자료.로고.파일)) 자료.로고.파일 = pathToFileURL(path.resolve(바탕, 자료.로고.파일)).href;
  자료.카드 = true;
  fs.mkdirSync(나감, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(여기, 'scene.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => window.__setData(d), 자료);
    await page.evaluate(() => window.__seek(1000));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => window.__setData(d), 자료);       /* 글꼴이 온 뒤 다시 — 긴 이름 줄이기가 실제 폭으로 재도록 */
    /* 장면마다 끝나기 조금 전 — 들어오는 움직임은 다 끝나고 나가는 흐림은 아직인 순간 */
    const 때들 = await page.evaluate(() => {
      const 길 = { s1: [0, 3200], s2: [3200, 7600], s3: [7600, 11800], s4: [11800, 15000] };
      const 짧 = { s1: [0, 3200], s2: [-1, -1], s3: [3200, 8400], s4: [8400, 12000] };
      const T = window.__LEN === 15000 ? 길 : 짧;
      return [T.s1[1] - 300, T.s2[1] > 0 ? T.s2[1] - 300 : null, T.s3[1] - 300, T.s4[1] - 50].filter((x) => x != null);
    });
    const 나온것 = [];
    for (const [i, t] of 때들.entries()) {
      await page.evaluate((v) => window.__seek(v), t);
      const f = path.join(나감, `${자료.id}-카드${i + 1}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
      나온것.push(f);
    }
    return 나온것;
  } finally { await browser.close(); }
}

/* 커버 (2026-11-17 세중님 「커버 이미지는 톤앤매너 맞게 따로 · 시그니처 컬러에 흰색 글」) — cover.html
   → { 릴스: <id>-커버.jpg (1080×1920 · 릴스 커버) , 카드: <id>-커버카드.jpg (1080×1350 · 카드뉴스 첫 장) } */
export async function 커버만들기(자료파일, 나감) {
  const { chromium } = require('playwright');
  const 자료 = JSON.parse(fs.readFileSync(자료파일, 'utf8'));
  fs.mkdirSync(나감, { recursive: true });
  const browser = await chromium.launch();
  try {
    const 나온것 = {};
    for (const [판, 높이, 이름] of [['reel', 1920, '커버'], ['card', 1350, '커버카드']]) {
      const page = await browser.newPage({ viewport: { width: 1080, height: 높이 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(여기, 'cover.html')).href);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(([d, p]) => window.__setData(d, p), [자료, 판]);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(([d, p]) => window.__setData(d, p), [자료, 판]);   /* 글꼴이 온 뒤 다시 — 폭 재기 */
      const f = path.join(나감, `${자료.id}-${이름}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
      나온것[판 === 'reel' ? '릴스' : '카드'] = f;
      await page.close();
    }
    return 나온것;
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const 인수 = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
  if (!인수('자료') || !인수('나감')) { console.error('--자료 <reel.json> --나감 <폴더>'); process.exit(2); }
  const 나온것 = await 카드만들기(인수('자료'), 인수('나감'));
  for (const f of 나온것) console.log(f);
}
