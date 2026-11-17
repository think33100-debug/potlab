/* 릴스 자료(JSON) → 1080×1920 · 30fps · H.264 + AAC mp4 (2026-11-16)

   node tools/reels/render.mjs --자료 <reel.json> --나감 <out.mp4> [--음악 <음악파일>] [--표지 <cover.jpg>] [--사진 <사진> --사진출처 <이름>]

   · scene.html 을 Playwright 로 열고 __seek(t) 를 프레임마다 불러 JPEG 로 찍어 ffmpeg 에 바로 흘립니다
   · 음악이 없으면 music-placeholder.mjs 로 합성한 자리 채움 소리를 씁니다
   · 인스타 릴스 권장: 9:16 · H.264 · AAC 48kHz · 30fps — 그대로 맞춥니다 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const 여기 = path.dirname(fileURLToPath(import.meta.url));

function 인수(이름, 기본 = null) {
  const i = process.argv.indexOf('--' + 이름);
  return i > 0 ? process.argv[i + 1] : 기본;
}
const 자료파일 = 인수('자료');
const 나감 = 인수('나감', 'reel.mp4');
let 음악 = 인수('음악');
const 표지 = 인수('표지');
const FPS = 30;
if (!자료파일) { console.error('--자료 <reel.json> 가 필요합니다'); process.exit(2); }
const 자료 = JSON.parse(fs.readFileSync(자료파일, 'utf8'));
/* --사진 <파일> [--사진출처 <이름>] — 손으로 사진을 대어 볼 때 */
if (인수('사진')) { 자료.사진 = pathToFileURL(path.resolve(인수('사진'))).href; 자료.사진출처 = 인수('사진출처') || 자료.기관; }
if (자료.사진 && /^file:/.test(자료.사진)) { /* 그대로 */ }
else if (자료.사진) 자료.사진 = pathToFileURL(path.resolve(path.dirname(자료파일), 자료.사진)).href;
/* 로고(RAPO 777 묶음) — 사진과 같이 파일 주소로 */
if (자료.로고?.파일 && !/^file:/.test(자료.로고.파일)) 자료.로고.파일 = pathToFileURL(path.resolve(path.dirname(자료파일), 자료.로고.파일)).href;

/* --무음 — 소리 없는 영상. 인스타 앱에서 손으로 올리며 그때 인기곡을 붙이는 길 (API 로는 인스타 음악을 못 붙입니다) */
const 무음 = process.argv.includes('--무음');
if (무음) 음악 = 'anullsrc=r=48000:cl=stereo';
else if (!음악) {
  음악 = path.join(os.tmpdir(), 'rapo-reel-placeholder.wav');
  const r = spawnSync(process.execPath, [path.join(여기, 'music-placeholder.mjs'), 음악, '15'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(여기, 'scene.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.evaluate((d) => window.__setData(d), 자료);
const 글꼴 = await page.evaluate(() => [...document.fonts].map((f) => f.family + ':' + f.status));
if (!글꼴.some((x) => x.includes('PretendardV') && x.endsWith('loaded'))) {
  /* 글꼴이 아직이면 한 번 그려 불러오게 합니다 */
  await page.evaluate(() => window.__seek(1000));
  await page.evaluate(() => document.fonts.ready);
}
/* 글꼴이 다 온 뒤에 한 번 더 — 긴 이름 줄이기가 실제 글꼴 폭으로 재도록 */
await page.evaluate((d) => window.__setData(d), 자료);
const LEN = await page.evaluate(() => window.__LEN);
const 장수 = Math.round((LEN / 1000) * FPS);

const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  ...(무음 ? ['-f', 'lavfi', '-i', 음악] : ['-i', 음악]),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-r', String(FPS), '-g', String(FPS * 2),
  '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  '-af', `afade=t=out:st=${(LEN / 1000 - 1).toFixed(2)}:d=1`,
  '-shortest', '-movflags', '+faststart', 나감,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const 시작 = Date.now();
for (let f = 0; f < 장수; f++) {
  const t = (f / FPS) * 1000;
  await page.evaluate((t) => window.__seek(t), t);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  if (표지 && Math.abs(t - 2600) < 1000 / FPS / 2) fs.writeFileSync(표지, jpg);
}
ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));
await browser.close();
if (code !== 0) { console.error('ffmpeg 실패', code); process.exit(1); }
console.log(`릴스 ${나감} · ${장수}장 · ${((Date.now() - 시작) / 1000).toFixed(1)}초 걸림`);
