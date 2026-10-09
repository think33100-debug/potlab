/* 화면 캡처 — **코드가 직접 찍습니다** (2026-10-09).
 *
 *   node tools/캡처.mjs                     기본 (배포 주소 · docs/screens)
 *   node tools/캡처.mjs --주소 http://localhost:3000
 *   node tools/캡처.mjs --폴더 docs/screens --묶음 관리자
 *   node tools/캡처.mjs --목록               무엇을 찍는지만 보여주고 끝
 *
 * ── 비번을 기록에 남기지 않습니다 ────────────────────────────
 * 로그인 값은 **.env / .env.local 의 MASTER_EMAIL · MASTER_PW** 에서 읽습니다
 * (process.env 가 있으면 그쪽이 먼저). 이 파일에는 값이 없고, 화면에도
 * 한 번도 찍지 않습니다. 로그인 칸은 **캡처하지 않습니다** — 로그인한
 * 다음부터 찍습니다. 비번이 틀리면 /master 가 다섯 번에 15분 잠그므로
 * 한 번만 시도하고 멈춥니다.
 *
 * ── 페르소나는 띠를 눌러 바꿉니다 ────────────────────────────
 * 창구(페르소나바꾸기)를 몰래 부르지 않고, 세중님이 누르는 그 단추를
 * 누릅니다. 그러면 띠 자체도 함께 확인됩니다.
 * 끝나면 **반드시 「관리자」로 되돌려 놓습니다** (중간에 죽어도 finally 에서).
 *
 * ── 「비회원 보기」는 나란히 대 봅니다 ───────────────────────
 * 같은 다섯 화면을 ① 마스터가 비회원 보기로 ② 로그인한 적 없는 창으로
 * 열어서, 글자(innerText)를 맞춰 봅니다. 그림을 맞추면 빨간 띠 때문에
 * 늘 다르다고 나옵니다. 다른 곳이 있으면 끝에 적습니다.
 *
 * ── 깔기 ─────────────────────────────────────────────────────
 *   npm install -D playwright     (저장소 맨 위에서)
 *   npx playwright install chromium
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

/* ── 설정 읽기 ──────────────────────────────────────────── */
function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}

function 인수(이름, 기본) {
  const i = process.argv.indexOf('--' + 이름);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 기본;
}
const 목록만 = process.argv.includes('--목록');
/* 로그인이 필요 없는 묶음만. 비번이 없는 자리에서도 돌아갑니다 */
const 손님만 = process.argv.includes('--손님만');

const cfg = env();
/* ★ 배포 주소는 **potjob-web.vercel.app** 입니다.
   potjob.co.kr 은 아직 **옛 앱(GitHub Pages)** 이라 여기서 쓰면 404 만 찍힙니다
   (2026-10-09 에 제가 짐작해서 16장을 404 로 찍었습니다 · 작업지침 3절).
   주소를 옮긴 뒤에는 .env 의 CAPTURE_URL 이나 --주소 로 바꾸십시오. */
const 주소 = (인수('주소', cfg.CAPTURE_URL || 'https://potjob-web.vercel.app')).replace(/\/+$/, '');
const 나갈곳 = path.join(뿌리, 인수('폴더', 'docs/screens'));
const 고른묶음 = 인수('묶음', null);

/* ── 찍을 것 ────────────────────────────────────────────────
   묶음: 어느 역할로 볼지 · 줄: [파일이름, 주소, 기다릴 글자(없으면 생략)]
   공고·회차 번호는 **예시 자료**입니다 (docs/화면상태목록.md).
   번호가 바뀌면 여기만 고치면 됩니다. */
/* 담당자가 올린 **예시 공고** — 회원에게는 안 보입니다 (시험자료).
   마스터·관리자 묶음에서만 씁니다 */
const 예시공고 = cfg.CAPTURE_JOB || 'BIZ000005';
/* **진짜 공개 공고** — 손님·회원 묶음은 이것을 씁니다.
   예시 공고를 쓰면 비로그인 창에 「이 자리에 아무것도 없어요」만 찍힙니다
   (2026-10-09 에 실제로 그렇게 찍혔습니다 — 가리는 규칙이 맞게 돈 것입니다) */
const 진짜공고 = cfg.CAPTURE_REAL_JOB || 'WNK150012610080045';
const 예시방 = cfg.CAPTURE_ROOM || '6';

const 계획 = [
  { 묶음: '비로그인', 역할: null, 손님: true, 줄: [
    ['비로그인_홈', '/'],
    ['비로그인_공고목록', '/jobs'],
    /* 「지원하러 가기」가 로그인 안내로 바뀌고 첨부 칸이 아예 안 보입니다 (C·B) */
    ['비로그인_공고상세_로그인안내', `/jobs/${진짜공고}`],
    /* 목록까지 막힙니다 (2026-10-09 세중님 지시 · 10-05 결정을 뒤집은 자리) */
    ['비로그인_경쟁률_로그인안내', '/compete'],
    ['비로그인_커뮤니티', '/community'],
    ['비로그인_교육', '/edu'],
    ['비로그인_기관', '/orgs'],
    ['비로그인_로그인화면', '/login'],
    ['비로그인_계산기', '/tools'],
  ] },

  { 묶음: '관리자', 역할: '관리자', 줄: [
    ['페르소나띠', '/'],
    ['관리자_홈', '/admin'],
    ...['access', 'ads', 'beat', 'blanks', 'boost', 'compete', 'edu-orgs', 'hand',
        'icons', 'jobs', 'members', 'ops', 'partners', 'posts', 'reports', 'reset',
        'rival', 'staff', 'stats', 'texts', 'trash', 'verify']
      .map((k) => [`관리자_${k}`, `/admin/${k}`]),
    ['진단띠', '/?진단=1'],
    ['알림_일곱줄', '/alarm'],
    ['대화_목록', '/talk'],
    ['대화_사진하나사라짐', `/talk/${예시방}`],
    ['재직_배지', '/verify'],
    ['담당자_내신청', '/partner'],
    ['채용관리', '/biz'],
    ['교육관리', '/edu/manage'],
    ['교육_모집중', '/edu/session/2'],
    ['교육_입금대기', '/edu/session/3'],
    ['교육_미선정', '/edu/session/4'],
    ['교육_후기쓰기', '/edu/session/5'],
    ['교육_후기아직', '/edu/session/6'],
  ] },

  { 묶음: '학생', 역할: '학생', 줄: [
    ['학생_홈', '/'],
    ['학생_공고목록', '/jobs'],
    ['학생_공고상세', `/jobs/${진짜공고}`],
    ['학생_기관목록', '/orgs'],
    ['학생_경쟁률', '/compete?g=작업치료사'],
    ['학생_커뮤니티', '/community'],
    ['학생_내정보', '/me'],
    ['학생_탈퇴', '/me/leave'],
    ['학생_교육', '/edu'],
  ] },

  { 묶음: '작업치료사', 역할: '작업치료사', 줄: [
    ['작업치료사_공고목록', '/jobs'],
    ['작업치료사_공고상세', `/jobs/${진짜공고}`],
    ['작업치료사_커뮤니티', '/community'],
    ['작업치료사_내정보', '/me'],
  ] },

  { 묶음: '채용담당자', 역할: '채용담당자', 줄: [
    ['담당자_채용관리', '/biz'],
    ['담당자_교육관리_막힘', '/edu/manage'],
    ['담당자_커뮤니티', '/community'],
    ['담당자_내정보', '/me'],
  ] },

  { 묶음: '교육담당자', 역할: '교육담당자', 줄: [
    ['교육담당자_교육관리', '/edu/manage'],
    ['교육담당자_채용관리_막힘', '/biz'],
    ['교육담당자_교육목록', '/edu'],
    ['교육담당자_내정보', '/me'],
  ] },

  /* 둘 다 승인된 분 — 메뉴에 둘이 다 뜹니다 (A 규칙) */
  { 묶음: '채용+교육담당자', 역할: '채용+교육담당자', 줄: [
    ['둘다담당자_채용관리', '/biz'],
    ['둘다담당자_교육관리', '/edu/manage'],
    ['둘다담당자_내정보', '/me'],
  ] },

  { 묶음: '가입중', 역할: '가입중', 줄: [
    ['가입중_홈', '/'],
    ['가입중_공고목록', '/jobs'],
    ['가입중_환영', '/welcome'],
  ] },

  /* 비회원 보기 — 로그인은 그대로 둔 채 비회원 화면. 아래 다섯은
     손님 창과 글자를 맞춰 봅니다 (대보기 목록과 같아야 합니다) */
  { 묶음: '비회원보기', 역할: '비회원', 줄: [
    ['비회원보기_홈', '/'],
    ['비회원보기_공고목록', '/jobs'],
    ['비회원보기_공고상세', `/jobs/${진짜공고}`],
    ['비회원보기_경쟁률', '/compete'],
    ['비회원보기_커뮤니티', '/community'],
    ['비회원보기_교육', '/edu'],
  ] },
];

/* 비회원 보기와 손님 창을 맞춰 볼 주소 */
const 대볼것 = ['/', '/jobs', `/jobs/${진짜공고}`, '/community', '/edu'];

const 폭 = [
  { 이름: 'pc', viewport: { width: 1280, height: 900 } },
  { 이름: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 2 },
];

if (목록만) {
  let n = 0;
  for (const g of 계획) {
    console.log('\n[' + g.묶음 + ']' + (g.역할 ? ' 역할 ' + g.역할 : ' 로그인 안 함'));
    for (const [이름, 길] of g.줄) { console.log('  ' + 이름 + '  ' + 길); n += 폭.length; }
  }
  console.log('\n모두 ' + n + '장 (폭 ' + 폭.length + '가지)');
  process.exit(0);
}

if (!손님만 && (!cfg.MASTER_EMAIL || !cfg.MASTER_PW)) {
  console.error('MASTER_EMAIL · MASTER_PW 가 없습니다.');
  console.error('  .env 에 넣거나  MASTER_EMAIL=... MASTER_PW=... node tools/캡처.mjs');
  console.error('  (값은 화면에 안 찍습니다. 이 파일에도 안 적습니다)');
  process.exit(2);
}

const { chromium } = await import('playwright');

fs.mkdirSync(나갈곳, { recursive: true });
const 찍은것 = [];
const 탈 = [];

/* 한 장 찍기. 주소를 열고 글자가 자리 잡을 틈을 준 뒤 전체 높이로.
 *
 * ★ 2026-10-09 — 찍기 전에 **아래까지 한 번 훑습니다.**
 * 화면 부품 Rise 는 스크롤로 들어올 때까지 `opacity: 0` 입니다
 * (components/job-parts.tsx · IntersectionObserver). fullPage 는 스크롤을
 * 안 하므로, 훑지 않으면 화면 아래쪽이 **통째로 빈칸으로** 찍힙니다.
 * 처음 찍은 공고 상세에서 가운데가 비어 있어서 알았습니다.
 */
async function 찍기(page, 이름, 길, 폭이름) {
  const 파일 = path.join(나갈곳, `${이름}__${폭이름}.png`);
  try {
    await page.goto(주소 + 길, { waitUntil: 'networkidle', timeout: 45_000 });
  } catch {
    /* networkidle 이 안 와도(폴링하는 화면) 그려진 것은 찍습니다 */
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(700);

  /* 아래까지 훑어 Rise 를 깨운 뒤 맨 위로 돌아옵니다 */
  await page.evaluate(async () => {
    const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
    const 높이 = () => document.documentElement.scrollHeight;
    const 한걸음 = Math.max(200, Math.floor(window.innerHeight * 0.8));
    /* ★ 돌 횟수에 상한을 둡니다. 스크롤할수록 길어지는 화면(더 받아오는 목록)
       이면 높이()가 계속 늘어나 **고리가 안 끝납니다.** 40걸음이면
       휴대폰 폭에서도 2만 픽셀쯤이라 어느 화면이든 바닥에 닿습니다 */
    for (let i = 0, y = 0; i < 40 && y < 높이(); i++, y += 한걸음) {
      window.scrollTo(0, y);
      await 잠깐(120);
    }
    window.scrollTo(0, 높이());
    await 잠깐(250);
    window.scrollTo(0, 0);
    await 잠깐(150);
  });
  /* Rise 의 등장 효과가 520ms 입니다. 다 끝나고 찍습니다 */
  await page.waitForTimeout(800);

  await page.screenshot({ path: 파일, fullPage: true });
  찍은것.push(path.relative(뿌리, 파일).replace(/\\/g, '/'));
}

/* 띠에서 역할 바꾸기 — 세중님이 누르는 그 단추를 누릅니다 */
async function 역할바꾸기(page, 역할) {
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

const browser = await chromium.launch();
let 마스터창 = null;

try {
  /* ── 손님 창 (로그인한 적 없음) ──────────────────────── */
  for (const w of 폭) {
    const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...w });
    const page = await ctx.newPage();
    const g = 계획.find((x) => x.손님);
    for (const [이름, 길] of g.줄) await 찍기(page, 이름, 길, w.이름);
    /* 대보기용 글자를 받아 둡니다 */
    if (w.이름 === 'pc') {
      g.글자 = {};
      for (const 길 of 대볼것) {
        await page.goto(주소 + 길, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(800);
        g.글자[길] = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
      }
    }
    await ctx.close();
  }
  console.log('○ 손님 창 ' + 찍은것.length + '장');

  if (손님만) {
    console.log('\n--손님만 이라 여기서 멈춥니다. 로그인이 필요한 묶음은');
    console.log('MASTER_EMAIL · MASTER_PW 를 넣고 `node tools/캡처.mjs` 로 돌리십시오.');
  } else {

  /* ── 마스터 창 ────────────────────────────────────────
     한 창(쿠키 하나)으로 끝까지 갑니다. 폭만 바꿔 다시 찍습니다 */
  const ctx = await browser.newContext({
    locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...폭[0],
  });
  마스터창 = ctx;
  const page = await ctx.newPage();

  await page.goto(주소 + '/master', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', cfg.MASTER_EMAIL);
  await page.fill('input[type=password]', cfg.MASTER_PW);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/master'), { timeout: 30_000 }),
    page.click('button[type=submit]'),
  ]);
  console.log('○ 마스터로 들어갔습니다 (로그인 칸은 안 찍었습니다)');

  const 비회원글자 = {};

  for (const g of 계획.filter((x) => !x.손님)) {
    if (고른묶음 && g.묶음 !== 고른묶음) continue;
    await 역할바꾸기(page, g.역할);
    console.log('  · ' + g.묶음);

    for (const w of 폭) {
      await page.setViewportSize(w.viewport);
      for (const [이름, 길] of g.줄) await 찍기(page, 이름, 길, w.이름);
    }

    if (g.역할 === '비회원') {
      await page.setViewportSize(폭[0].viewport);
      for (const 길 of 대볼것) {
        await page.goto(주소 + 길, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(800);
        비회원글자[길] = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
      }
    }
  }

  /* ── 비회원 보기 vs 손님 창 ─────────────────────────── */
  const 손님글자 = 계획.find((x) => x.손님).글자 ?? {};
  console.log('\n── 비회원 보기와 로그아웃 창 맞춰 보기 ──');
  for (const 길 of 대볼것) {
    const a = 비회원글자[길]; const b = 손님글자[길];
    if (a == null || b == null) { console.log('  ? ' + 길 + ' — 한쪽을 못 읽었습니다'); continue; }
    /* 띠는 비회원 보기에만 있습니다. 그 줄만 걷어내고 맞춥니다 */
    const 민 = (s) => s.replace(/운영진 ·[^]*?(?=POTJOB|$)/, '')
                        .replace(/지금 비회원 화면이에요[^]*?돌아옵니다\./, '')
                        .replace(/\s+/g, ' ').trim();
    if (민(a) === 민(b)) { console.log('  ○ ' + 길); continue; }
    탈.push(길);
    console.log('  ✗ ' + 길 + ' — 다릅니다');
    const A = 민(a).split(' '); const B = 민(b).split(' ');
    const 만 = (x, y) => x.filter((t) => !y.includes(t)).slice(0, 12).join(' ');
    console.log('      비회원 보기에만: ' + (만(A, B) || '(없음)'));
    console.log('      로그아웃 창에만: ' + (만(B, A) || '(없음)'));
  }
  } /* 손님만 이 아닐 때 */
} finally {
  /* 중간에 죽어도 **관리자로 되돌립니다**. 안 되돌리면 다음에 열 때
     세중님이 학생이나 비회원으로 들어가 있게 됩니다 */
  if (마스터창) {
    try {
      const p = await 마스터창.newPage();
      await 역할바꾸기(p, '관리자');
      console.log('\n○ 「관리자」로 되돌려 놓았습니다');
    } catch (e) {
      console.error('\n✗ 관리자로 못 되돌렸습니다 — 띠에서 직접 눌러 주세요 (' + e.message + ')');
    }
  }
  await browser.close();
}

console.log('\n찍은 것 ' + 찍은것.length + '장 → ' + path.relative(뿌리, 나갈곳));
if (탈.length) {
  console.log('\n비회원 보기가 로그아웃 창과 다른 곳 ' + 탈.length + '곳: ' + 탈.join(' · '));
  process.exit(1);
}
