/* 커뮤니티 차단을 **눌러서** 확인합니다 (2026-10-11).
 *
 *   node tools/차단시험.mjs
 *
 * 화면이 그려지는 것은 근거가 아닙니다 — 차단하고, 글이 사라지는 것을 보고,
 * 다시 풀어 돌아오는 것까지 봅니다. **끝나면 반드시 풉니다.**
 *
 * 마스터로 들어가 **남의 글** 하나를 차단합니다. 쓰는 것은 「마스터가
 * 누구를 가렸다」 한 줄뿐이고, 상대 계정에는 아무것도 안 들어갑니다
 * (작업지침 8-9). 끝에 풀어서 그 한 줄도 꺼집니다.
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

const { chromium } = await import('playwright');
const 브라우저 = await chromium.launch();
const page = await (await 브라우저.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'ko-KR' })).newPage();
/* confirm 창을 받아 줍니다 — 안 받으면 멈춥니다 */
page.on('dialog', (d) => d.accept());

const 적기 = [];
try {
  await page.goto(주소 + '/master', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', cfg.MASTER_EMAIL);
  await page.fill('input[type=password]', cfg.MASTER_PW);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/master'), { timeout: 30_000 }),
    page.click('button[type=submit]'),
  ]);
  console.log('로그인 — 들어갔습니다');

  /* ① 커뮤니티에서 **남의 글** 하나를 고릅니다 */
  await page.goto(주소 + '/community/free', { waitUntil: 'networkidle' });
  const 글들 = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/post/"]')].map((a) => a.getAttribute('href')));
  const 처음 = [...new Set(글들)];
  console.log('  커뮤니티 글 ' + 처음.length + '개 — ' + 처음.slice(0, 5).join(' '));
  if (!처음.length) { console.error('볼 글이 없습니다'); process.exit(1); }

  let 고른것 = null;
  for (const h of 처음) {
    await page.goto(주소 + h, { waitUntil: 'networkidle' });
    const 차단있나 = await page.locator('button:has-text("차단")').count();
    if (차단있나) { 고른것 = h; break; }     /* 내 글에는 차단 단추가 없습니다 */
  }
  if (!고른것) { console.error('남의 글을 못 찾았습니다 (전부 내 글)'); process.exit(1); }
  console.log('  고른 글 — ' + 고른것);

  /* ② 차단 */
  await page.click('button:has-text("차단")');
  await page.waitForURL((u) => u.pathname === '/community', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  /* ③ 목록에서 사라졌나 */
  await page.goto(주소 + '/community/free', { waitUntil: 'networkidle' });
  const 뒤 = [...new Set(await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/post/"]')].map((a) => a.getAttribute('href'))))];
  const 사라졌나 = !뒤.includes(고른것);
  적기.push(['차단 뒤 목록에서 사라졌나', 사라졌나 ? '○ 사라졌습니다' : '✗ 아직 보입니다']);
  console.log('  차단 뒤 글 ' + 뒤.length + '개 · 그 글이 ' + (사라졌나 ? '사라졌습니다' : '**아직 보입니다**'));

  /* ④ /me 에 「차단한 분」 이 뜨나 */
  await page.goto(주소 + '/me', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const 목록보임 = await page.locator('text=차단한 분').count();
  적기.push(['/me 에 차단 목록', 목록보임 ? '○ 보입니다' : '✗ 안 보입니다']);

  /* ⑤ 풀기 — **반드시** */
  if (목록보임) {
    await page.click('button:has-text("풀기")');
    await page.waitForTimeout(1500);
  }
  await page.goto(주소 + '/community/free', { waitUntil: 'networkidle' });
  const 끝 = [...new Set(await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/post/"]')].map((a) => a.getAttribute('href'))))];
  const 돌아왔나 = 끝.includes(고른것);
  적기.push(['풀고 나서 돌아왔나', 돌아왔나 ? '○ 돌아왔습니다' : '✗ 아직 안 보입니다']);
  console.log('  푼 뒤 글 ' + 끝.length + '개 · 그 글이 ' + (돌아왔나 ? '돌아왔습니다' : '**아직 안 보입니다**'));
} finally {
  await 브라우저.close();
}

console.log('\n── 결과 ──');
for (const [a, b] of 적기) console.log('  ' + a.padEnd(24) + b);
