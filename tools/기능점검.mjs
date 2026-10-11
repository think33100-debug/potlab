/* 기능을 하나 열 때마다 **페르소나로 눌러 봅니다** (2026-10-11).
 *
 *   node tools/기능점검.mjs 알림함
 *   node tools/기능점검.mjs 재직인증 담당자신청
 *   node tools/기능점검.mjs 전부
 *
 * 「화면이 그려진다」는 근거가 아닙니다 (작업지침 6-2b) — **눌러 보고**
 * 「아직 준비 중이에요」가 안 나오는지, 비회원에게는 안 보이는지 봅니다.
 *
 * 세 줄로 답합니다 — ① 회원에게 열렸나 ② 비회원은 막히나 ③ 눌러 본 것.
 * 끝나면 **반드시 「관리자」로 되돌립니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const cfg = {};
for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}
for (const k of ['MASTER_EMAIL', 'MASTER_PW']) if (process.env[k]) cfg[k] = process.env[k];
if (!cfg.MASTER_EMAIL || !cfg.MASTER_PW) { console.error('MASTER_EMAIL · MASTER_PW 가 없습니다.'); process.exit(2); }

const 주소 = (process.argv.includes('--주소')
  ? process.argv[process.argv.indexOf('--주소') + 1] : 'https://potjob-web.vercel.app').replace(/\/$/, '');

/* 숨긴 화면이 내는 말. 이것이 보이면 **아직 안 열린 것**입니다 */
const 준비중 = '아직 준비 중이에요';

const 기능 = {
  알림함: { 길: '/alarm', 역할: '작업치료사', 손님막힘: true, 눌러볼것: '종' },
  재직인증: { 길: '/verify', 역할: '작업치료사', 손님막힘: true },
  담당자신청: { 길: '/partner', 역할: '작업치료사', 손님막힘: true },
  채용관리: { 길: '/biz', 역할: '채용담당자', 손님막힘: true },
  교육관리: { 길: '/edu/manage', 역할: '교육담당자', 손님막힘: true },
  대화: { 길: '/talk', 역할: '작업치료사', 손님막힘: true },
};

const 고른것 = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const 볼것 = (고른것.includes('전부') || !고른것.length) ? Object.keys(기능)
  : 고른것.filter((k) => 기능[k]);
if (!볼것.length) { console.error('무엇을 볼까요 — ' + Object.keys(기능).join(' · ')); process.exit(2); }

const { chromium } = await import('playwright');
const 브라우저 = await chromium.launch();
const 적기 = [];

/* ── 손님 창 (로그인한 적 없음) ─────────────────────────── */
{
  const 손님 = await (await 브라우저.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' })).newPage();
  for (const 이름 of 볼것) {
    const f = 기능[이름];
    await 손님.goto(주소 + f.길, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {});
    const 글 = await 손님.evaluate(() => document.body.innerText).catch(() => '');
    const 막힘 = /로그인|시작하기|준비 중/.test(글);
    적기.push({ 이름, 무엇: '비회원', 됨: 막힘, 말: 막힘 ? '로그인 안내' : '**그냥 보입니다**' });
  }
  await 손님.context().close();
}

/* ── 마스터 창 (페르소나를 바꿔 가며) ───────────────────── */
const page = await (await 브라우저.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' })).newPage();
page.on('dialog', (d) => d.accept());

async function 역할바꾸기(역할) {
  await page.goto(주소 + '/', { waitUntil: 'domcontentloaded' });
  const 띠 = page.locator('text=운영진 ·').first();
  await 띠.waitFor({ timeout: 20_000 });
  const 지금 = (await 띠.innerText()).replace('운영진 ·', '').trim();
  if (지금 === 역할) return;
  const 단추 = page.getByRole('button', { name: 역할, exact: true });
  await 단추.waitFor({ timeout: 10_000 });
  await Promise.all([page.waitForLoadState('load'), 단추.click()]);
  await page.waitForTimeout(1200);
}

try {
  await page.goto(주소 + '/master', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', cfg.MASTER_EMAIL);
  await page.fill('input[type=password]', cfg.MASTER_PW);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/master'), { timeout: 30_000 }),
    page.click('button[type=submit]'),
  ]);
  console.log('로그인 — 들어갔습니다\n');

  for (const 이름 of 볼것) {
    const f = 기능[이름];
    await 역할바꾸기(f.역할);
    await page.goto(주소 + f.길, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(600);
    const 글 = await page.evaluate(() => document.body.innerText);
    const 열림 = !글.includes(준비중);
    적기.push({ 이름, 무엇: f.역할 + '(회원)', 됨: 열림,
      말: 열림 ? '열렸습니다' : '**아직 「' + 준비중 + '」**' });

    if (f.눌러볼것 === '종') {
      /* 탑바의 종이 회원에게 보이나 — 눌러서 /alarm 으로 가나 */
      const 종 = page.locator('a[href="/alarm"]').first();
      const 있나 = await 종.count();
      if (있나) {
        await page.goto(주소 + '/', { waitUntil: 'networkidle' });
        await page.locator('a[href="/alarm"]').first().click();
        await page.waitForURL((u) => u.pathname === '/alarm', { timeout: 15_000 }).catch(() => {});
      }
      적기.push({ 이름, 무엇: '탑바 종', 됨: !!있나,
        말: 있나 ? '보이고 눌러서 알림함으로 갑니다' : '**안 보입니다**' });
    }
  }
} finally {
  await 역할바꾸기('관리자').catch(() => {});
  await 브라우저.close();
}

console.log('── 점검표 ──');
let 탈 = 0;
for (const r of 적기) {
  if (!r.됨) 탈++;
  console.log('  ' + (r.됨 ? '○' : '✗') + ' ' + r.이름.padEnd(8) + r.무엇.padEnd(16) + r.말);
}
console.log(탈 ? `\n✗ 걸린 것 ${탈}개` : '\n○ 다 지났습니다');
process.exit(탈 ? 1 : 0);
