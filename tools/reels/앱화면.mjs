/* 라포 앱 실제 화면을 휴대폰 크기로 찍습니다 — 사용설명서 카드뉴스 재료 (2026-11-17 세중님 「실제 어플 이용 화면을 넣어서 이런 기능도 있나 싶을 정도로」)

   node tools/reels/앱화면.mjs            찍기 → log/reels/screens/<이름>.png (1170×2532 · 휴대폰 390×844 의 3배)
                                          + 한눈 보기 판(작은 jpg) 을 드라이브 「RAPO 릴스/앱화면」 에 올리고 링크를 찍습니다
   원격: app-shots

   ★ 회원으로 찍습니다 — 경쟁률·월급·계산기·툴킷은 로그인해야 보입니다 (2026-11-17 첫 바퀴에서 7곳이 로그인 화면이었습니다)
     임시 회원(app-shot-…@potjob.invalid · 닉네임 「라포가이드」 · 통계에서 뺌 excluded)을 admin API 로 만들어 로그인 쿠키를 넣고,
     끝나면 **지우고 0줄 남았는지 셉니다** (지침 8-9 · 8-17). 가입그물.mjs 와 같은 길입니다
   ★ 회원 개인정보가 찍히지 않게 내 정보 화면(/me 등)은 안 찍습니다
   --비회원 을 붙이면 로그인 없이 찍습니다 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { env } from './ig.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const 사이트 = 'https://www.rapojob.co.kr';
export const 나감 = path.join(ROOT, 'log', 'reels', 'screens');

/* 찍을 화면 — 이름(영문 · 파일 이름) · 주소 · 아래로 내릴 만큼(px, 휴대폰 기준) */
export const 화면들 = [
  { 이름: 'home', 길: '/', 닫기: true },
  /* 공고 상세 · 병원 정보 상세 — 2026-11-17 전남대학교병원(상급종합 · 물리 12 · 작업 9 · 공고 306936 마감 11/25) */
  { 이름: 'job-detail', 길: '/jobs/306936' },
  { 이름: 'job-detail-2', 길: '/jobs/306936', 내림: 700 },
  { 이름: 'org-detail', 길: '/orgs?org=' + encodeURIComponent('전남대학교병원') },
  { 이름: 'org-detail-2', 길: '/orgs?org=' + encodeURIComponent('전남대학교병원'), 내림: 700 },
  { 이름: 'compete-2', 길: '/compete', 내림: 500 },
  { 이름: 'jobs', 길: '/jobs' },
  { 이름: 'jobs-deadline', 길: '/jobs?sort=deadline' },
  { 이름: 'compete', 길: '/compete' },
  { 이름: 'orgs', 길: '/orgs' },
  { 이름: 'pay', 길: '/pay' },
  { 이름: 'tools', 길: '/tools' },
  { 이름: 'tools-pay', 길: '/tools/pay' },
  { 이름: 'tools-severance', 길: '/tools/severance' },
  { 이름: 'community', 길: '/community', 더기다림: 5000 },
  { 이름: 'edu', 길: '/edu' },
  { 이름: 'toolkit', 길: '/toolkit' },
  { 이름: 'youth', 길: '/youth' },
  { 이름: 'spec', 길: '/spec' },
];

/* ── 임시 회원 ── */
const 임시꼴 = 'app-shot-';
async function 관리(cfg, 길, 옵션 = {}) {
  return fetch(cfg.SUPABASE_URL + 길, { ...옵션, headers: { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', ...(옵션.headers || {}) } });
}
async function 임시치우기(cfg) {
  const r = await 관리(cfg, '/auth/v1/admin/users?page=1&per_page=1000');
  const 들 = r.ok ? ((await r.json()).users || []).filter((u) => String(u.email || '').startsWith(임시꼴)) : [];
  for (const u of 들) await 관리(cfg, `/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  const r2 = await 관리(cfg, '/auth/v1/admin/users?page=1&per_page=1000');
  const 남음 = r2.ok ? ((await r2.json()).users || []).filter((u) => String(u.email || '').startsWith(임시꼴)).length : null;
  return { 지움: 들.length, 남음 };
}
async function 임시회원(cfg) {
  const 메일 = `${임시꼴}${Date.now()}@potjob.invalid`;
  const 비번 = 'Zz' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '!9A';
  const r1 = await 관리(cfg, '/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: 메일, password: 비번, email_confirm: true }) });
  const 누구 = (await r1.json())?.id;
  if (!누구) throw new Error('임시 회원을 못 만듦 HTTP ' + r1.status);
  const r2 = await fetch(cfg.SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 메일, password: 비번 }) });
  const 세션 = await r2.json();
  if (!세션?.access_token) throw new Error('임시 회원 로그인 실패 HTTP ' + r2.status);
  const r3 = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('가입하기'), { method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + 세션.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_닉네임: '라포가이드' + String(Date.now()).slice(-3), p_직군: '물리치료사', p_역할: '현직', p_사진: null, p_약관판: '2026-11-23' }) });
  console.log(`  임시 회원 가입하기 → ${r3.status} ${r3.ok ? '' : (await r3.text()).slice(0, 160)}`);
  await 관리(cfg, `/rest/v1/profiles?id=eq.${누구}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ excluded: true }) });
  return { 누구, 세션 };
}
/* @supabase/ssr 쿠키 꼴 — sb-<ref>-auth-token = 'base64-' + base64url(JSON) · 3180자를 넘으면 .0 .1 … 로 쪼갬 */
export function 세션쿠키(supaUrl, 세션, 도메인) {
  const ref = new URL(supaUrl).hostname.split('.')[0];
  const 이름 = `sb-${ref}-auth-token`;
  const 값 = 'base64-' + Buffer.from(JSON.stringify(세션)).toString('base64url');
  const 조각 = 값.length <= 3180 ? [[이름, 값]] : Array.from({ length: Math.ceil(값.length / 3180) }, (_, i) => [`${이름}.${i}`, 값.slice(i * 3180, (i + 1) * 3180)]);
  return 조각.map(([name, value]) => ({ name, value, domain: 도메인, path: '/', sameSite: 'Lax', secure: true }));
}

async function 찍기(목록, 쿠키 = []) {
  const { chromium } = require('playwright');
  fs.mkdirSync(나감, { recursive: true });
  const b = await chromium.launch();
  const 결과 = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    if (쿠키.length) await ctx.addCookies(쿠키);
    for (const h of 목록) {
      const p = await ctx.newPage();
      try {
        const r = await p.goto(사이트 + h.길, { waitUntil: 'networkidle', timeout: 45000 });
        await p.waitForTimeout(1500 + (h.더기다림 || 0));
        /* 첫 화면 안내 창(설치 안내 등) — 「닫기」를 누릅니다 */
        if (h.닫기) { const 단추 = p.getByRole('button', { name: /닫기/ }).first(); if (await 단추.isVisible().catch(() => false)) { await 단추.click(); await p.waitForTimeout(800); } }
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
  const 칸 = 결과.map((_, i) => `[${i}:v]scale=120:-1,drawtext=text='${i + 1}':x=6:y=6:fontsize=18:fontcolor=red:box=1:boxcolor=white[v${i}]`);
  const 자리 = 결과.map((_, i) => `${(i % 줄) * 120}_${Math.floor(i / 줄) * 260}`).join('|');
  const 필터 = `${칸.join(';')};${결과.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${자리}:fill=white[o]`;
  const r = spawnSync('ffmpeg', ['-y', ...들, '-filter_complex', 필터, '-map', '[o]', '-q:v', '9', 판], { encoding: 'utf8' });
  if (r.status !== 0) { console.log('  ✗ 한눈 판 못 만듦 —', (r.stderr || '').slice(-300)); return null; }
  return 판;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cfg = env();
  cfg.SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let 쿠키 = [];
  let 회원 = null;
  if (!process.argv.includes('--비회원')) {
    const 묵은 = await 임시치우기(cfg);
    if (묵은.지움) console.log(`  지난 임시 회원 ${묵은.지움}개를 먼저 치웠습니다`);
    회원 = await 임시회원(cfg);
    쿠키 = 세션쿠키(cfg.SUPABASE_URL, 회원.세션, 'www.rapojob.co.kr');
    console.log(`  임시 회원으로 찍습니다 · 쿠키 ${쿠키.length}조각`);
  }
  let 결과 = [];
  try { 결과 = await 찍기(화면들, 쿠키); }
  finally {
    if (회원) { const c = await 임시치우기(cfg); console.log(`  임시 회원 지움 ${c.지움}개 · 남음 ${c.남음}개`); }
  }
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
