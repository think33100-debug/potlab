/* 재직 인증을 **끝까지 눌러 봅니다** (2026-10-11).
 *
 *   node tools/재직인증시험.mjs
 *
 * 마스터로 신청 → 관리자 화면에서 확인 → 배지 → **파일이 지워졌나**까지.
 * 올리는 서류는 tools/견본서류만들기.mjs 가 만든 **가짜**입니다
 * (「SAMPLE / NOT A REAL DOCUMENT」만 적혀 있습니다).
 *
 * 왜 끝까지 눌러 보나 — 「올리는 기능은 **올려 봐야** 된 것입니다」
 * (작업지침 6-2b). 화면이 그려지는 것은 근거가 아닙니다.
 * 저장소 경로에 한글을 쓰면 InvalidKey 로 막히는 자리라 더 그렇습니다.
 *
 * ── 2026-10-11 — **마스터로는 못 돌렸습니다** ────────────────
 * 마스터 계정에는 이미 「확인」된 재직인증 줄이 있습니다 (예시 자료 id=6).
 * 그래서 /verify 가 **올리는 칸 대신 「확인됨」 화면**을 보여 주고,
 * 올릴 자리가 없습니다. 예시 자료를 치우는 것은 10/25 일이라
 * 여기서 건드리지 않았습니다.
 *
 * 돌리려면 — ⑥ 시험자료치우기() 를 부른 **뒤**에, 또는 재직인증이 없는
 * 계정으로. 그때 이 파일을 그대로 쓰시면 됩니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

/* 가짜 서류 한 장 */
const 서류방 = path.join(뿌리, 'tmp', '재직시험');
execFileSync(process.execPath, [path.join(여기, '견본서류만들기.mjs'), 서류방], { stdio: 'ignore' });
const 서류 = fs.readdirSync(서류방).filter((f) => f.endsWith('.pdf')).sort()[0];
if (!서류) { console.error('견본 서류를 못 만들었습니다'); process.exit(1); }
const 서류길 = path.join(서류방, 서류);
console.log('가짜 서류 — ' + 서류 + ' (' + fs.statSync(서류길).size + '바이트)');

const { chromium } = await import('playwright');
const 브라우저 = await chromium.launch();
const page = await (await 브라우저.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'ko-KR' })).newPage();
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

  /* ① 신청 */
  await page.goto(주소 + '/verify', { waitUntil: 'networkidle' });
  await page.setInputFiles('input[type=file]', 서류길);
  const 병원칸 = page.locator('input[type=text], input:not([type])').first();
  if (await 병원칸.count()) await 병원칸.fill('시험병원');
  const 내기 = page.getByRole('button', { name: /보내|신청|올리/ }).first();
  await 내기.click();
  await page.waitForTimeout(2500);
  const 신청뒤 = await page.evaluate(() => document.body.innerText);
  const 올라감 = /심사|확인 중|보냈|접수/.test(신청뒤) && !/InvalidKey|올리지 못|실패/.test(신청뒤);
  적기.push(['① 서류 올리기', 올라감, 올라감 ? '올라갔습니다' : 신청뒤.replace(/\s+/g, ' ').slice(0, 110)]);

  /* ② 관리자 화면에 뜨나 */
  await page.goto(주소 + '/admin/verify', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const 관리자글 = await page.evaluate(() => document.body.innerText);
  const 보이나 = /심사중|확인 기다/.test(관리자글);
  적기.push(['② 관리자 화면에 뜨나', 보이나, 보이나 ? '떴습니다' : '**안 보입니다**']);

  /* ③ 확인(승인) */
  const 확인단추 = page.getByRole('button', { name: /^확인$|승인/ }).first();
  if (await 확인단추.count()) {
    await 확인단추.click();
    await page.waitForTimeout(2500);
  }
  const 승인뒤 = await page.evaluate(() => document.body.innerText);
  const 됐나 = !/심사중/.test(승인뒤) || /확인됨|확인 완료/.test(승인뒤);
  적기.push(['③ 관리자가 확인', 됐나, 됐나 ? '확인했습니다' : '**아직 심사중입니다**']);

  /* ④ 배지 */
  await page.goto(주소 + '/me', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const 내화면 = await page.evaluate(() => document.body.innerText);
  const 배지 = /재직 확인|재직확인|현직 확인/.test(내화면);
  적기.push(['④ 배지가 생겼나', 배지, 배지 ? '보입니다' : '**안 보입니다**']);

  /* ⑤ 파일이 지워졌나 — 화면 글로 */
  await page.goto(주소 + '/verify', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const 끝글 = await page.evaluate(() => document.body.innerText);
  적기.push(['⑤ /verify 가 뭐라 하나', true, 끝글.replace(/\s+/g, ' ').slice(0, 120)]);
} finally {
  await 브라우저.close();
}

console.log('\n── 재직 인증 한 바퀴 ──');
for (const [a, b, c] of 적기) console.log('  ' + (b ? '○' : '✗') + ' ' + a.padEnd(22) + c);
