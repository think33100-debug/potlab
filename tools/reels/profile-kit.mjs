/* 인스타 프로필 꾸러미 그림 — 프로필 사진 · 하이라이트 표지 (2026-11-17)
   node tools/reels/profile-kit.mjs <나갈폴더>
   인스타 API 는 프로필을 바꾸지 못합니다 — 그림·글을 만들고 넣는 것은 사람이 합니다.
   프로필 사진은 원으로 잘립니다(가운데 원 안에만 그림). 하이라이트 표지도 가운데 원만 보입니다. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 나감 = path.resolve(process.argv[2] || 'insta-profile');
fs.mkdirSync(나감, { recursive: true });

const 글꼴 = pathToFileURL(path.join(여기, 'fonts', 'PretendardVariable.woff2')).href;
const 심볼 = fs.readFileSync(path.join(여기, 'assets', 'symbol.svg'), 'utf8');
const 심볼흰 = 심볼.replace(/#FF4F40/gi, '#FFFFFF');
const 글자로고 = fs.readFileSync(path.join(여기, 'assets', 'wordmark.svg'), 'utf8');
const 데이터 = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const 머리 = `<meta charset="utf-8"><style>
@font-face { font-family: P; src: url("${글꼴}") format("woff2"); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: P, sans-serif; letter-spacing: -0.02em; word-break: keep-all; }
</style>`;

/* 프로필 사진 셋 — 원으로 잘려도 심볼이 가운데에 크게 */
const 프로필 = {
  'profile-coral': `<body style="width:1080px;height:1080px;background:#FF4F40;display:flex;align-items:center;justify-content:center">
    <img src="${데이터(심볼흰)}" style="width:520px;height:508px;transform:translateX(8px)"></body>`,
  'profile-navy': `<body style="width:1080px;height:1080px;background:#112231;display:flex;align-items:center;justify-content:center">
    <img src="${데이터(심볼)}" style="width:520px;height:508px;transform:translateX(8px)"></body>`,
  'profile-navy-word': `<body style="width:1080px;height:1080px;background:#112231;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px">
    <img src="${데이터(심볼)}" style="width:360px;height:352px;transform:translateX(6px)">
    <img src="${데이터(글자로고)}" style="height:92px"></body>`,
};

/* 하이라이트 표지 — 남색 바탕 · 가운데 원 안에 코랄 테두리와 짧은 말 */
const 표지 = [
  ['hl-1-univ', '대학', '병원'],
  ['hl-2-public', '공공', '기관'],
  ['hl-3-dday', 'D-3', '마감임박'],
  ['hl-4-compete', '경쟁률', ''],
  ['hl-5-pay', '연봉', ''],
  ['hl-6-guide', '이용법', ''],
];
const 표지글 = (위, 아래) => `<body style="width:1080px;height:1920px;background:#112231;display:flex;align-items:center;justify-content:center">
  <div style="width:640px;height:640px;border-radius:50%;border:22px solid #FF4F40;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff">
    <div style="font-size:${위.length >= 3 ? 150 : 190}px;font-weight:900;line-height:1">${위}</div>
    ${아래 ? `<div style="font-size:${아래.length >= 4 ? 84 : 110}px;font-weight:800;line-height:1;margin-top:26px;color:#FF4F40">${아래}</div>` : ''}
  </div></body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function 찍기(이름, 몸, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(머리 + 몸);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(나감, 이름 + '.png') });
  console.log('그림', 이름 + '.png');
}
for (const [이름, 몸] of Object.entries(프로필)) await 찍기(이름, 몸, 1080, 1080);
for (const [이름, 위, 아래] of 표지) await 찍기(이름, 표지글(위, 아래), 1080, 1920);
await browser.close();
