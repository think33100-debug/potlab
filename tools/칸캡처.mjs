/* 일곱 칸 반영 뒤 — 공고 다섯 건만 찍습니다 (2026-10-11).
 *
 *   node tools/칸캡처.mjs
 *   node tools/칸캡처.mjs --주소 http://localhost:3000
 *
 * ── 왜 따로 만드나 ──────────────────────────────────────────
 * tools/캡처.mjs 는 화면 230장을 통째로 찍습니다. 반영이 화면에 보이는지만
 * 보려고 그걸 다 돌릴 까닭이 없습니다. 묶음·페르소나도 필요 없습니다 —
 * **마스터로 로그인한 한 창**에서 다섯 쪽만 찍습니다.
 *
 * ── 로그인한 창이어야 합니다 ────────────────────────────────
 * 지원자격·예상 연봉은 **회원 자료**입니다. 창구 공고뽑은값() 이
 * `auth.uid() is null` 이면 빈 것을 줍니다. 비로그인 창으로 찍으면
 * 「반영이 안 됐다」로 잘못 보입니다.
 *
 * 비번은 .env 의 MASTER_PW 에서 프로세스 안으로만 읽습니다 —
 * 화면·파일·로그 어디에도 안 찍습니다 (작업지침 8-11).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of ['MASTER_EMAIL', 'MASTER_PW']) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
const 주소 = (process.argv.includes('--주소')
  ? process.argv[process.argv.indexOf('--주소') + 1] : 'https://potjob-web.vercel.app').replace(/\/$/, '');
const 낼곳 = path.join(뿌리, 'docs', 'screens', '칸반영_1011');

if (!cfg.MASTER_EMAIL || !cfg.MASTER_PW) { console.error('MASTER_EMAIL · MASTER_PW 가 없습니다.'); process.exit(2); }

/* 왜 이 다섯인가 — 반영이 어느 길로 화면에 닿는지 다 다릅니다 */
const 볼것 = [
  ['워크넷_새수집기_headcount', 'WNK140022610060007', '사랑방재활주간보호센터 · 새 수집기가 headcount 를 채운 것'],
  ['워크넷_반영_뽑은값', 'WNK120232609280018', '둔촌데이케어센터 · 반영안이 뽑은값에 넣은 것'],
  ['워크넷_옛출처_뽑은값', 'WNK120032609220013', '주식회사도타이 · 출처가 옛 WN 인 것'],
  ['알리오', '305539', '건강보험심사평가원 · 알리오 상세가 주는 칸'],
  ['병원누리집_빈칸', 'HS1004062063', '대자인병원 · 공고에 정말 없는 칸은 안 그립니다'],
];

const { chromium } = await import('playwright');
const 브라우저 = await chromium.launch();
const 창 = await 브라우저.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
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

  for (const [이름, id, 왜] of 볼것) {
    await page.goto(`${주소}/jobs/${id}`, { waitUntil: 'networkidle', timeout: 45_000 });
    /* Rise(스크롤 등장) 때문에 아래쪽이 비어 찍힙니다 — 끝까지 내렸다가 올립니다 */
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    /* 일곱 칸만 또 따로 한 장 — 글자가 보이는지가 요점입니다 */
    const 칸글 = await page.evaluate(() => {
      const out = {};
      for (const dt of document.querySelectorAll('dl dt, dl div')) {
        const t = (dt.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
        if (t.length >= 2) out[t[0]] = t.slice(1).join(' / ');
      }
      return out;
    });
    const 그림 = path.join(낼곳, 이름 + '.png');
    await page.screenshot({ path: 그림, fullPage: true });
    적은것.push({ 이름, id, 왜, 칸: 칸글 });
    console.log('  ○ ' + 이름 + '  ' + Object.entries(칸글).map(([k, v]) => k + '=' + String(v).slice(0, 28)).join(' · '));
  }
} finally {
  await 브라우저.close();
}

fs.writeFileSync(path.join(낼곳, '목록.json'),
  JSON.stringify({ 찍은때: new Date().toISOString(), 주소, 줄: 적은것 }, null, 1) + '\n');
console.log(`\n${적은것.length}장 → docs/screens/칸반영_1011/`);
