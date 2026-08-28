/* ============================================================
 * WageForm.html  →  pages/index.html 만들기
 * ------------------------------------------------------------
 * index.html 을 직접 고치지 마세요. 원본은 WageForm.html 입니다.
 * 이 파일이 하는 일은 두 가지뿐입니다.
 *   ① <head> 안에 PWA·공유 미리보기용 태그를 끼워 넣기
 *   ② 본문 스크립트 바로 앞에 app.js 불러오는 줄 넣기
 *
 * 쓰는 법:  node build.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'WageForm.html');
const OUT = path.join(ROOT, 'pages', 'index.html');

/* 화면 버전을 WageForm 에서 읽어옵니다 (v54 → 54) */
const src = fs.readFileSync(SRC, 'utf8');
const verM = src.match(/var APP_VER\s*=\s*'v(\d+)/);
if (!verM) { console.error('WageForm.html 에서 APP_VER 을 못 찾았습니다'); process.exit(1); }
const VER = verM[1];

/* ① 헤드에 넣을 태그 — GitHub Pages 에서만 필요한 것들입니다 */
const HEAD = `<title>POT JOB · 작업·물리치료사 급여와 채용</title>
<link rel="manifest" href="/manifest.json">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="POT JOB">
<meta name="theme-color" content="#0d5c4f">
<meta name="format-detection" content="telephone=no">
<meta name="description" content="치료사들이 더 좋은 곳에 취업할 때까지. 작업·물리치료사 급여 통계, 병원별 인원, 공공기관 채용공고를 한곳에서.">
<link rel="canonical" href="https://potjob.co.kr/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://potjob.co.kr/">
<meta property="og:site_name" content="POT JOB">
<meta property="og:title" content="POT JOB · 작업·물리치료사 급여와 채용">
<meta property="og:description" content="내 연봉이 어디쯤인지 3분이면 나옵니다. 병원별 치료사 인원, 공공기관 채용공고까지.">
<meta property="og:image" content="https://potjob.co.kr/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">

<!-- 아이폰 실행 화면 -->
<link rel="apple-touch-startup-image" href="/splash-1125x2436.png"
  media="(device-width:375px) and (device-height:812px) and (-webkit-device-pixel-ratio:3)">
<link rel="apple-touch-startup-image" href="/splash-1242x2688.png"
  media="(device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:3)">
<link rel="apple-touch-startup-image" href="/splash-828x1792.png"
  media="(device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:2)">
<link rel="apple-touch-startup-image" href="/splash-750x1334.png"
  media="(device-width:375px) and (device-height:667px) and (-webkit-device-pixel-ratio:2)">
<link rel="apple-touch-startup-image" href="/splash-1536x2048.png"
  media="(device-width:768px) and (device-height:1024px) and (-webkit-device-pixel-ratio:2)">
<link rel="apple-touch-startup-image" href="/splash.png">
<meta name="mobile-web-app-capable" content="yes">`;

/* ② 헤드 태그를 viewport 줄 바로 다음에 넣습니다 */
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
if (src.indexOf(VIEWPORT) < 0) { console.error('viewport 줄을 못 찾았습니다'); process.exit(1); }
let out = src.replace(VIEWPORT, VIEWPORT + '\n' + HEAD);

/* ③ 본문 스크립트가 시작되기 직전에 app.js 를 넣습니다.
      기준점은 <div id="msg"></div> 다음에 오는 첫 <script> 입니다. */
const ANCHOR = '<div id="msg"></div>';
const ai = out.indexOf(ANCHOR);
if (ai < 0) { console.error('<div id="msg"> 를 못 찾았습니다'); process.exit(1); }
const si = out.indexOf('<script>', ai);
if (si < 0) { console.error('본문 <script> 를 못 찾았습니다'); process.exit(1); }
out = out.slice(0, si)
      + '<script src="/app.js?v=' + VER + '"></script>\n'
      + out.slice(si);

fs.writeFileSync(OUT, out);

/* ④ 관리자 화면도 같은 버전을 보게 맞춥니다 */
const ADM = path.join(ROOT, 'pages', 'admin.html');
let adm = fs.readFileSync(ADM, 'utf8');
adm = adm.replace(/\/app\.js\?v=\d+/, '/app.js?v=' + VER);
fs.writeFileSync(ADM, adm);

console.log('index.html 만들었습니다 — v' + VER + ' / ' + out.split('\n').length + '줄');
console.log('admin.html app.js?v=' + VER + ' 로 맞췄습니다');
