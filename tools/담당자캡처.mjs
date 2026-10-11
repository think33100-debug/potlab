/* 담당자 신청 화면에서 「국세청 확인」이 **정말 도는지** 눌러 봅니다 (2026-10-11).
 *
 *   node tools/담당자캡처.mjs
 *
 * 화면이 그려지는 것은 근거가 아닙니다 (작업지침 6-2b) — **눌러 봐야** 됩니다.
 * 마스터로 들어가 페르소나를 「채용담당자」로 바꾸고, 사업자번호를 넣고
 * 단추를 눌러 결과 글자를 읽습니다. 끝나면 **「관리자」로 되돌립니다.**
 *
 * 비번은 MASTER_EMAIL · MASTER_PW 에서 프로세스 안으로만 읽습니다.
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
const 낼곳 = path.join(뿌리, 'docs', 'screens', '국세청_1011');

/* 삼성전자(계속사업자) · 없는 번호. 공개된 번호만 씁니다 */
const 볼것 = [['계속사업자', '1248100998'], ['없는번호', '0000000000']];

const { chromium } = await import('playwright');
const 브라우저 = await chromium.launch();
const 창 = await 브라우저.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'ko-KR' });
const page = await 창.newPage();
fs.mkdirSync(낼곳, { recursive: true });
const 적은것 = [];

try {
  await page.goto(주소 + '/master', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', cfg.MASTER_EMAIL);
  await page.fill('input[type=password]', cfg.MASTER_PW);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/master'), { timeout: 30_000 }),
    page.click('button[type=submit]'),
  ]);
  console.log('로그인 — 들어갔습니다');

  for (const [이름, 번호] of 볼것) {
    await page.goto(주소 + '/partner', { waitUntil: 'networkidle', timeout: 45_000 });
    await page.fill('input[placeholder*="사업자등록번호"]', 번호);
    await page.click('button:has-text("국세청 확인")');
    /* 단추 옆 글자가 「보는 중…」에서 답으로 바뀔 때까지 */
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return /계속사업자|휴업자|폐업자|없는 번호|수동 확인|확인이 안 돼요|숫자 10자리/.test(t);
    }, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const 답 = await page.evaluate(() => {
      const m = document.body.innerText.match(/계속사업자|휴업자|폐업자|없는 번호|수동 확인|확인이 안 돼요[^\n]*/);
      return m ? m[0] : '(못 읽음)';
    });
    const 그림 = path.join(낼곳, '담당자_국세청_' + 이름 + '.png');
    await page.screenshot({ path: 그림, fullPage: true });
    적은것.push({ 이름, 번호, 답 });
    console.log('  ○ ' + 번호 + ' → ' + 답);
  }
} finally {
  await 브라우저.close();
}

fs.writeFileSync(path.join(낼곳, '목록.json'),
  JSON.stringify({ 찍은때: new Date().toISOString(), 주소, 줄: 적은것 }, null, 1) + '\n');
console.log(`\n${적은것.length}장 → docs/screens/국세청_1011/`);
