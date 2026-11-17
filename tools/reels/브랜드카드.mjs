/* RAPO 브랜드 카드뉴스 — 만들기 · 올리기 (2026-11-17 세중님 「브랜드 가치·기능을 알릴 카드뉴스를 먼저 하나」)

   node tools/reels/브랜드카드.mjs                 만들기만 — log/reels/brand/<이름>/1.jpg … · 미리보기.jpg · 캡션을 찍음
   node tools/reels/브랜드카드.mjs --실행          만들어서 인스타 카드뉴스로 올림 (이미 올렸으면 멈춤 · --다시 로 다시)
   node tools/reels/브랜드카드.mjs --바꾸기        새 판을 올린 **뒤** 전에 올린 게시물을 지움 (2026-11-17 세중님 「다시 올려 · 기존건 지워」)
                                                  새로 올리기가 실패하면 기존 것은 그대로 둡니다
   원격  reels-remote · brand-check / brand-publish

   디자인 tools/reels/brand.html (디자인 지침의 브랜드 색 · 앱 자산 그대로) · 1080×1350 · 6장
   올리기·댓글은 공고 카드와 같은 길(ig.mjs 카드올리기IG · 댓글) — 댓글 권한이 있으면 태그는 대댓글로 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { env, 인스타되나, 카드올리기IG, 댓글되나, 댓글달기, 답글달기, 게시물지우기 } from './ig.mjs';
import { 라포소개 } from './reel-data.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
export const 이름 = '브랜드소개_1';
const 나감 = path.join(ROOT, 'log', 'reels', 'brand', 이름);
const 기록파일 = path.join(ROOT, 'log', '브랜드_올림.json');

/* 캡션 — 첫 문장 35자 이내 · 사람 말투 · 기능은 앱에 있는 것만 */
export const 태그 = '#물리치료사 #작업치료사 #치료사채용 #병원취업';
export const 캡션 = [
  '치료사 채용, 라포 하나면 돼요!',
  '',
  '공고 하나 찾으려고 병원 홈페이지 여러 개 열어 보셨죠?',
  '라포는 치료사를 포함한 의료기사 모두를 위한 채용 커뮤니티 앱이에요!',
  '공공·종합·대학병원 공고를 한곳에 모아 뒀어요.',
  '',
  '✔ 공공기관 채용 경쟁률',
  '✔ 이 병원 연봉 (정부 공시)',
  '✔ 병원별 치료사 재직자 수',
  '✔ 익명 커뮤니티',
  '',
  ...라포소개.slice(2),          /* 경쟁률·연봉 줄은 위 체크 목록과 겹쳐 뒤 두 줄만 */
  '',
  태그,
  '',
  '프로필 링크에서 라포를 시작해 보세요. 필요한 동료에게 공유도 부탁드려요!',
].join('\n');
export const 첫댓글 = '치료사 동료분들, 라포에 있었으면 하는 기능이 있으면 댓글로 남겨 주세요!';

export async function 만들기() {
  const { chromium } = require('playwright');
  fs.mkdirSync(나감, { recursive: true });
  const browser = await chromium.launch();
  const 장들 = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(여기, 'brand.html')).href);
    await page.evaluate(() => document.fonts.ready);
    const 수 = await page.evaluate(() => window.__장수);
    for (let i = 1; i <= 수; i++) {
      await page.evaluate((n) => window.__장(n), i);
      await page.evaluate(() => Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((z) => { im.onload = im.onerror = z; })))));
      const f = path.join(나감, `${i}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
      장들.push(f);
    }
  } finally { await browser.close(); }
  /* 미리보기 한 장 */
  const 미리 = path.join(나감, '미리보기.jpg');
  const 거름 = 장들.map((_, i) => `[${i}]scale=-2:320[v${i}]`).join(';') + ';' + 장들.map((_, i) => `[v${i}]`).join('') + `hstack=${장들.length}`;
  spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...장들.flatMap((f) => ['-i', f]), '-filter_complex', 거름, '-q:v', '6', 미리]);
  fs.writeFileSync(path.join(나감, '캡션.txt'), 캡션 + '\n');
  return { 장들, 미리 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const 바꾸기 = process.argv.includes('--바꾸기');
  const 실행 = process.argv.includes('--실행') || 바꾸기;
  const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};
  if (바꾸기 && !기록[이름]?.게시물ID) { console.error(`✗ 바꿀 기존 게시물이 없습니다 — ${이름}`); process.exit(1); }
  if (실행 && !바꾸기 && 기록[이름]?.게시물ID && !process.argv.includes('--다시')) {
    console.error(`✗ 이미 올렸습니다 — ${이름} · 게시물 ${기록[이름].게시물ID} · ${기록[이름].주소 || ''} (다시 올리려면 --다시)`);
    process.exit(1);
  }
  const { 장들, 미리 } = await 만들기();
  console.log(`브랜드 카드 ${이름} — ${장들.length}장 · 미리보기 ${미리}`);
  console.log('\n── 캡션 ──\n' + 캡션 + '\n── 캡션 끝 ──');
  console.log(`첫 댓글: ${첫댓글}`);
  if (!실행) { console.log('\n만들기만 했습니다. --실행 을 붙이면 올립니다'); process.exit(0); }
  const cfg = env();
  if (!인스타되나(cfg)) { console.error('IG 열쇠가 없습니다'); process.exit(1); }
  const 댓글 = await 댓글되나(cfg);
  const 올릴캡션 = 댓글 ? 캡션.split('\n').filter((l) => l.trim() !== 태그).join('\n').replace(/\n{3,}/g, '\n\n') : 캡션;
  console.log(댓글 ? '  ○ 댓글 권한 있음 — 태그는 대댓글로' : '  · 댓글 권한 없음 — 태그는 캡션에 · 첫 댓글은 안 답니다');
  const 올림 = await 카드올리기IG(cfg, 장들, 올릴캡션, 'brand');
  let 댓글기록 = null;
  if (댓글) {
    try { const 첫 = await 댓글달기(cfg, 올림.media_id, 첫댓글); const 답 = await 답글달기(cfg, 첫, 태그); 댓글기록 = { 첫, 답 }; console.log(`  ○ 첫 댓글 ${첫} · 태그 대댓글 ${답}`); }
    catch (e) { console.error(`  ✗ 댓글을 못 달았습니다 — ${String(e.message || e).slice(0, 200)}\n    손으로: ${첫댓글} / ${태그}`); }
  }
  /* 바꾸기 — 새 판이 올라간 뒤에 전 게시물을 지웁니다 */
  const 옛것들 = [...(기록[이름]?.옛것들 || [])];
  if (바꾸기) {
    const 옛 = 기록[이름];
    const r = await 게시물지우기(cfg, 옛.게시물ID);
    옛것들.push({ 게시물ID: 옛.게시물ID, 주소: 옛.주소, 올린때: 옛.올린때, 지움: r.ok, 지운때: new Date().toISOString(), 응답: r.응답 });
    console.log(r.ok ? `  ○ 전 게시물 지움 — ${옛.게시물ID} (${옛.주소 || ''})` : `  ✗ 전 게시물을 못 지웠습니다 — ${옛.게시물ID} · ${r.응답} · 인스타에서 손으로 지워 주세요 (${옛.주소 || ''})`);
  }
  기록[이름] = { 게시물ID: 올림.media_id, 주소: 올림.주소, 올린때: new Date().toISOString(), 댓글: 댓글기록, 옛것들 };
  fs.mkdirSync(path.dirname(기록파일), { recursive: true });
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2));
  fs.appendFileSync(path.join(ROOT, 'log', '릴스_발행기록.jsonl'), JSON.stringify({ 때: new Date().toISOString(), 결과: '성공', 길: '브랜드 카드뉴스', 이름, 게시물ID: 올림.media_id, 게시물주소: 올림.주소 }) + '\n');
  console.log(`\n● 브랜드 카드뉴스를 올렸습니다 — 게시물 ${올림.media_id}${올림.주소 ? ' · ' + 올림.주소 : ''}`);
}
