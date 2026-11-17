/* 라포 앱 실제 화면을 휴대폰 크기로 찍습니다 — 사용설명서 카드뉴스 재료 (2026-11-17 세중님 「실제 어플 이용 화면을 넣어서 이런 기능도 있나 싶을 정도로」)

   node tools/reels/앱화면.mjs            찍기 → log/reels/screens/<이름>.png (1170×2532 · 휴대폰 390×844 의 3배)
                                          + 한눈 보기 판(작은 jpg) 을 드라이브 「RAPO 릴스/앱화면」 에 올리고 링크를 찍습니다
   원격: app-shots

   ★ 로그인 없이 찍습니다 — 비회원이 보는 화면 그대로입니다. 회원만 보는 숫자는 안 나옵니다 (그 자리는 화면이 가립니다)
   ★ 회원 개인정보가 찍히지 않게 회원 화면(/me 등)은 안 찍습니다 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const 사이트 = 'https://www.rapojob.co.kr';
export const 나감 = path.join(ROOT, 'log', 'reels', 'screens');

/* 찍을 화면 — 이름(영문 · 파일 이름) · 주소 · 아래로 내릴 만큼(px, 휴대폰 기준) */
export const 화면들 = [
  { 이름: 'home', 길: '/' },
  { 이름: 'jobs', 길: '/jobs' },
  { 이름: 'jobs-deadline', 길: '/jobs?sort=deadline' },
  { 이름: 'compete', 길: '/compete' },
  { 이름: 'orgs', 길: '/orgs' },
  { 이름: 'pay', 길: '/pay' },
  { 이름: 'tools', 길: '/tools' },
  { 이름: 'tools-pay', 길: '/tools/pay' },
  { 이름: 'tools-severance', 길: '/tools/severance' },
  { 이름: 'community', 길: '/community' },
  { 이름: 'edu', 길: '/edu' },
  { 이름: 'toolkit', 길: '/toolkit' },
  { 이름: 'youth', 길: '/youth' },
  { 이름: 'spec', 길: '/spec' },
];

async function 찍기(목록) {
  const { chromium } = require('playwright');
  fs.mkdirSync(나감, { recursive: true });
  const b = await chromium.launch();
  const 결과 = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    for (const h of 목록) {
      const p = await ctx.newPage();
      try {
        const r = await p.goto(사이트 + h.길, { waitUntil: 'networkidle', timeout: 45000 });
        await p.waitForTimeout(1500);
        if (h.내림) { await p.evaluate((y) => window.scrollTo(0, y), h.내림); await p.waitForTimeout(600); }
        const f = path.join(나감, h.이름 + '.png');
        await p.screenshot({ path: f });
        결과.push({ ...h, 파일: f, 코드: r?.status() ?? null, 제목: await p.title() });
        console.log(`  ○ ${h.이름} ${h.길} → ${r?.status()} · 「${(await p.title()).slice(0, 40)}」`);
      } catch (e) { console.log(`  ✗ ${h.이름} ${h.길} — ${String(e.message || e).slice(0, 160)}`); }
      await p.close();
    }
  } finally { await b.close(); }
  return 결과;
}

/* 한눈 보기 판 — 화면마다 폭 180 으로 줄여 한 줄 7장씩 · jpg (ffmpeg) */
function 한눈판(결과) {
  const 판 = path.join(나감, '_한눈.jpg');
  const 들 = 결과.flatMap((x) => ['-i', x.파일]);
  const 줄 = 7; const n = 결과.length;
  const 칸 = 결과.map((_, i) => `[${i}:v]scale=180:-1,drawtext=text='${i + 1}':x=6:y=6:fontsize=22:fontcolor=red:box=1:boxcolor=white[v${i}]`);
  const 자리 = 결과.map((_, i) => `${(i % 줄) * 180}_${Math.floor(i / 줄) * 390}`).join('|');
  const 필터 = `${칸.join(';')};${결과.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${자리}:fill=white[o]`;
  const r = spawnSync('ffmpeg', ['-y', ...들, '-filter_complex', 필터, '-map', '[o]', '-q:v', '6', 판], { encoding: 'utf8' });
  if (r.status !== 0) { console.log('  ✗ 한눈 판 못 만듦 —', (r.stderr || '').slice(-300)); return null; }
  return 판;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const 결과 = await 찍기(화면들);
  const 판 = 결과.length ? 한눈판(결과) : null;
  console.log(`찍음 ${결과.length}/${화면들.length} · ${나감}`);
  if (판) {
    결과.forEach((x, i) => console.log(`  ${i + 1}. ${x.이름}`));
    try {
      const { 드라이브되나, 파일들올리기 } = await import('./drive.mjs');
      if (드라이브되나()) {
        const 올림 = await 파일들올리기('앱화면', [{ 파일: 판, 이름: `앱화면_한눈_${Date.now()}.jpg` }]);
        for (const o of 올림) console.log(`  드라이브 ${o.이름} → ${o.링크}`);
      }
    } catch (e) { console.log('  ✗ 드라이브 —', String(e.message || e).slice(0, 200)); }
  }
}
