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

/* 하이라이트 표지 — 가운데 원 안에 테두리와 짧은 말. 색은 RAPO 토큰 팔레트만 (web/app/rapo-tokens.css)
   한 색 통일 네 벌 + 주제마다 색이 다른 두 벌 (2026-11-17 세중님 「라포 색을 변경하면서 쓰게 여러색 버전」) */
const 표지 = [
  ['1-univ', '대학', '병원', 'blue'],
  ['2-public', '공공', '기관', 'green'],
  ['3-dday', 'D-3', '마감임박', 'coral'],
  ['4-compete', '경쟁률', '', 'purple'],
  ['5-pay', '연봉', '', 'yellow'],
  ['6-guide', '이용법', '', 'navy'],
];
const 팔레트 = {   /* [연한 100, 600, 진한 900] */
  coral: ['#FFF1EE', '#FF4F40', '#851E17'], navy: ['#F5F8FA', '#112231', '#112231'],
  blue: ['#EFF6FF', '#5E98FE', '#0B4596'], green: ['#EDFAF6', '#10AB7D', '#075445'],
  purple: ['#F5F3FE', '#9F84FB', '#50379B'], yellow: ['#FFF7DE', '#C49725', '#4F3E1F'],
};
/* 벌마다 (주제색) → [바탕, 테두리, 큰 글, 작은 글] */
const 벌 = {
  'navy':        () => ['#112231', '#FF4F40', '#FFFFFF', '#FF4F40'],
  'coral':       () => ['#FF4F40', '#FFFFFF', '#FFFFFF', '#112231'],
  'blush':       () => ['#FFE9E6', '#FF4F40', '#112231', '#FF4F40'],
  'white':       () => ['#FFFFFF', '#112231', '#112231', '#FF4F40'],
  'color-soft':  (c) => [팔레트[c][0], 팔레트[c][1], 팔레트[c][2], 팔레트[c][1]],
  'color-solid': (c) => [c === 'navy' ? '#112231' : 팔레트[c][1], '#FFFFFF', '#FFFFFF', c === 'navy' ? '#FF4F40' : 팔레트[c][2]],
};
const 표지글 = (위, 아래, [바탕, 테, 큰, 작은]) => `<body style="width:1080px;height:1920px;background:${바탕};display:flex;align-items:center;justify-content:center">
  <div style="width:640px;height:640px;border-radius:50%;border:22px solid ${테};display:flex;flex-direction:column;align-items:center;justify-content:center;color:${큰}">
    <div style="font-size:${위.length >= 3 ? 150 : 190}px;font-weight:900;line-height:1">${위}</div>
    ${아래 ? `<div style="font-size:${아래.length >= 4 ? 84 : 110}px;font-weight:800;line-height:1;margin-top:26px;color:${작은}">${아래}</div>` : ''}
  </div></body>`;

/* R 로고 색 벌 (2026-11-17 세중님 「로고 R 을 색별로 · 프로필 사진을 색별로 만든다고 생각」)
   [이름, 바탕, R 색] — 진한 바탕엔 흰 R, 연한 바탕엔 그 색의 R. 색은 RAPO 토큰 팔레트만 */
const 로고색 = [
  ['01-coral', '#FF4F40', '#FFFFFF'], ['02-navy', '#112231', '#FF4F40'], ['03-navy-white', '#112231', '#FFFFFF'],
  ['04-blue', '#5E98FE', '#FFFFFF'], ['05-green', '#10AB7D', '#FFFFFF'], ['06-purple', '#9F84FB', '#FFFFFF'],
  ['07-yellow', '#C49725', '#FFFFFF'], ['08-gray', '#2A3038', '#FFFFFF'],
  ['11-coral-soft', '#FFF1EE', '#FF4F40'], ['12-blush', '#FFE9E6', '#FF4F40'], ['13-white', '#FFFFFF', '#FF4F40'],
  ['14-blue-soft', '#EFF6FF', '#5E98FE'], ['15-green-soft', '#EDFAF6', '#10AB7D'], ['16-purple-soft', '#F5F3FE', '#9F84FB'],
  ['17-yellow-soft', '#FFF7DE', '#C49725'], ['18-navy-soft', '#F5F8FA', '#112231'],
];
const R = (색) => 데이터(심볼.replace(/#FF4F40/gi, 색));
/* R 폭 — 프로필 520 · 하이라이트는 원에 잘리지 않게 작게 (2026-11-17 세중님 「하이라이트로 넣으니 로고가 잘린다」) */
const 로고판 = (바탕, 색, h, 폭 = 520) => `<body style="width:1080px;height:${h}px;background:${바탕};display:flex;align-items:center;justify-content:center">
  <img src="${R(색)}" style="width:${폭}px;height:${Math.round(폭 * 31.5 / 32.25)}px;transform:translateX(${Math.round(폭 / 65)}px)"></body>`;

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
for (const [벌이름, 색고르기] of Object.entries(벌)) {
  fs.mkdirSync(path.join(나감, 'highlight-' + 벌이름), { recursive: true });
  for (const [이름, 위, 아래, 주제색] of 표지) await 찍기(path.join('highlight-' + 벌이름, 이름), 표지글(위, 아래, 색고르기(주제색)), 1080, 1920);
}
for (const [이름, 바탕, 색] of 로고색) {
  fs.mkdirSync(path.join(나감, 'logo-profile'), { recursive: true });
  fs.mkdirSync(path.join(나감, 'logo-highlight'), { recursive: true });
  fs.mkdirSync(path.join(나감, 'logo-highlight-square'), { recursive: true });
  await 찍기(path.join('logo-profile', 이름), 로고판(바탕, 색, 1080), 1080, 1080);
  await 찍기(path.join('logo-highlight', 이름), 로고판(바탕, 색, 1920, 300), 1080, 1920);
  await 찍기(path.join('logo-highlight-square', 이름), 로고판(바탕, 색, 1080, 360), 1080, 1080);
}
await browser.close();
