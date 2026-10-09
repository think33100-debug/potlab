/* 인계점검 — 넘기기 전에 묻습니다.
 *
 *   node tools/인계점검.mjs
 *
 * 다섯을 봅니다.
 *   1. app/ 의 화면 수 = 04_화면스펙 에 적힌 주소 수 = 캡처 있는 주소 수
 *   2. docs/인계/*.md 와 docs/screens/index.html 의 링크·그림 경로가 **실제로 열리나**
 *   3. 문서·갤러리에 비번·열쇠·회원 개인정보가 섞였나
 *   4. [미확인] 이 몇 개 남았나
 *   5. 캡처 중 빈 화면(15KB 미만)·짝 없는 것
 *
 * 돌아가는 값 — 하나라도 걸리면 1 입니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 인계방 = path.join(뿌리, 'docs', '인계');
const 그림방 = path.join(뿌리, 'docs', 'screens');

const 탈 = [];
const 적기 = (됐나, 말) => { console.log((됐나 ? '  ○ ' : '  ✗ ') + 말); if (!됐나) 탈.push(말); };

/* ── 1. 화면 수 세 가지가 맞나 ──────────────────────────── */
console.log('\n1. 화면 수');

function 화면들(폴더, 앞 = '') {
  const out = [];
  for (const e of fs.readdirSync(폴더, { withFileTypes: true })) {
    if (e.isDirectory()) {
      /* (묶음) 폴더는 주소에 안 들어갑니다 */
      const 다음 = e.name.startsWith('(') ? 앞 : 앞 + '/' + e.name;
      out.push(...화면들(path.join(폴더, e.name), 다음));
    } else if (e.name === 'page.tsx') out.push(앞 || '/');
  }
  return out;
}
const 코드주소 = [...new Set(화면들(path.join(뿌리, 'web', 'app')))].sort();
console.log(`  app/ 의 page.tsx — ${코드주소.length}곳`);

/* 04_화면스펙 의 제목에 적힌 주소 */
const 스펙글 = fs.readFileSync(path.join(인계방, '04_화면스펙.md'), 'utf8');
const 스펙주소 = new Set();
for (const 줄 of 스펙글.split(/\r?\n/)) {
  if (!/^#{2,4}\s/.test(줄)) continue;
  for (const m of 줄.matchAll(/`(\/[A-Za-z0-9/[\]._-]*)`/g)) 스펙주소.add(m[1]);
}
/* /admin/* 23곳은 14절이 표로 묶어 적습니다 — 주소 하나하나를 제목에 안 씁니다 */
const 관리자묶음 = (a) => a.startsWith('/admin/') && a !== '/admin/jobs/[id]';
const 스펙빠진것 = 코드주소.filter((a) => !스펙주소.has(a) && !관리자묶음(a));
적기(스펙빠진것.length === 0,
  `04_화면스펙 에 절이 있는 주소 ${스펙주소.size}개`
  + (스펙빠진것.length ? ` — 빠진 것: ${스펙빠진것.join(' · ')}` : ''));

/* 캡처 */
const 목록길 = path.join(그림방, '목록.json');
let 목록 = null;
if (!fs.existsSync(목록길)) {
  적기(false, 'docs/screens/목록.json 이 없습니다 (node tools/캡처.mjs 를 먼저)');
} else {
  목록 = JSON.parse(fs.readFileSync(목록길, 'utf8'));
  const 찍은주소 = new Set(목록.줄.map((r) => r.주소.split('?')[0]));
  /* [id] 같은 자리는 **실제 번호**로 찍습니다. 꼴로 맞춰 봅니다 */
  const 찍었나 = (a) => 찍은주소.has(a)
    || (a.includes('[')
        && [...찍은주소].some((x) => new RegExp('^' + a.replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(x)));
  /* 일부러 안 찍는 둘 — 까닭을 여기 적습니다 */
  const 일부러 = {
    '/master': '로그인 칸입니다. 비번이 찍힐 수 있어 안 찍습니다',
    '/auth/callback': '받아서 바로 보내는 자리라 그려지는 화면이 없습니다',
  };
  const 캡처빠진것 = 코드주소.filter((a) => !찍었나(a) && !(a in 일부러));
  적기(캡처빠진것.length === 0,
    `캡처가 있는 주소 ${[...찍은주소].length}개 (일부러 뺀 둘: ${Object.keys(일부러).join(' · ')})`
    + (캡처빠진것.length ? ` — 빠진 것: ${캡처빠진것.join(' · ')}` : ''));

  /* 페르소나 × 상태 덮은 자리 */
  const 상태셈 = {};
  for (const r of 목록.줄) 상태셈[r.상태] = (상태셈[r.상태] ?? 0) + 1;
  console.log('  상태별 — ' + Object.entries(상태셈).map(([k, v]) => `${k} ${v}`).join(' · '));
  const 역할셈 = {};
  for (const r of 목록.줄) 역할셈[r.역할] = (역할셈[r.역할] ?? 0) + 1;
  console.log('  페르소나별 — ' + Object.entries(역할셈).map(([k, v]) => `${k} ${v}`).join(' · '));
  적기(Object.keys(역할셈).length >= 9, `페르소나 ${Object.keys(역할셈).length}가지`);
}

/* ── 2. 링크·그림 경로 ──────────────────────────────────── */
console.log('\n2. 문서 안의 링크와 그림');

const 문서들 = fs.readdirSync(인계방).filter((f) => f.endsWith('.md'))
  .map((f) => path.join(인계방, f));
let 본링크 = 0; const 깨진것 = [];
for (const d of 문서들) {
  const 글 = fs.readFileSync(d, 'utf8');
  for (const m of 글.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const 대상 = m[1];
    if (/^(https?:|mailto:|#)/.test(대상)) continue;
    본링크++;
    const 길 = path.resolve(path.dirname(d), decodeURIComponent(대상.split('#')[0]));
    if (!fs.existsSync(길)) 깨진것.push(`${path.basename(d)} → ${대상}`);
  }
}
적기(깨진것.length === 0, `인계 문서 ${문서들.length}개 안의 파일 링크 ${본링크}개`
  + (깨진것.length ? ` — 깨진 것 ${깨진것.length}: ${깨진것.slice(0, 6).join(' · ')}` : ''));

/* 갤러리의 그림 */
const 갤러리길 = path.join(그림방, 'index.html');
if (!fs.existsSync(갤러리길)) {
  적기(false, 'docs/screens/index.html 이 없습니다 (node tools/갤러리.mjs 를 먼저)');
} else {
  const 글 = fs.readFileSync(갤러리길, 'utf8');
  const 없는것 = [];
  let 셈 = 0;
  for (const m of 글.matchAll(/(?:src|href)="([^"]+\.png)"/g)) {
    셈++;
    if (!fs.existsSync(path.join(그림방, decodeURIComponent(m[1])))) 없는것.push(m[1]);
  }
  const 없는절 = [];
  for (const m of 글.matchAll(/href="(\.\.\/인계\/[^"#]+)(#[^"]*)?"/g)) {
    if (!fs.existsSync(path.resolve(그림방, decodeURIComponent(m[1])))) 없는절.push(m[1]);
  }
  적기(없는것.length === 0 && 없는절.length === 0,
    `갤러리가 가리키는 그림 ${셈}장 · 문서 링크`
    + (없는것.length ? ` — 없는 그림 ${없는것.length}` : '')
    + (없는절.length ? ` — 없는 문서 ${없는절.length}` : ''));
}

/* ── 2b. 갤러리를 **진짜 열어 봅니다** ─────────────────────
   글자로 맞춰 보는 것과 브라우저가 여는 것은 다릅니다 (지침 12).
   playwright 가 없는 자리에서는 건너뜁니다 — 나머지 점검은 그대로 됩니다. */
if (fs.existsSync(갤러리길)) {
  let chromium = null;
  try { ({ chromium } = await import('playwright')); } catch { /* 없으면 건너뜁니다 */ }
  if (!chromium) {
    console.log('  · playwright 가 없어 갤러리를 열어 보지는 않았습니다');
  } else {
    const { pathToFileURL } = await import('node:url');
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const 화면탈 = [];
    p.on('pageerror', (e) => 화면탈.push(String(e)));
    await p.goto(pathToFileURL(갤러리길).href);
    await p.waitForTimeout(2000);
    const 본것 = await p.evaluate(() => ({
      화면: document.querySelectorAll('section.screen').length,
      그림: document.querySelectorAll('figure').length,
      칩: document.querySelectorAll('button.칩').length,
      차례: document.querySelectorAll('nav.차례 a').length,
      절없음: document.querySelectorAll('.nospec').length,
      깨진그림: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    }));
    /* 칩 하나를 눌러 거르기가 실제로 도는지 */
    let 걸러짐 = -1;
    try {
      await p.getByRole('button', { name: /^휴대폰/ }).click();
      await p.waitForTimeout(400);
      걸러짐 = await p.evaluate(() => document.querySelectorAll('figure:not([hidden])').length);
    } catch { /* 칩이 없으면 아래에서 걸립니다 */ }
    await b.close();

    적기(화면탈.length === 0, `갤러리가 열립니다 — 화면 ${본것.화면} · 그림 ${본것.그림}`
      + ` · 칩 ${본것.칩} · 차례 ${본것.차례}`
      + (화면탈.length ? ` — 화면 오류: ${화면탈.join(' | ')}` : ''));
    적기(본것.깨진그림 === 0, `그림이 다 그려집니다`
      + (본것.깨진그림 ? ` — 안 그려진 것 ${본것.깨진그림}장` : ''));
    적기(본것.절없음 === 0, `04 화면스펙 절로 가는 링크`
      + (본것.절없음 ? ` — 절을 못 찾은 화면 ${본것.절없음}곳` : ''));
    적기(걸러짐 > 0 && 걸러짐 < 본것.그림, `「휴대폰」 칩으로 거르기 → ${걸러짐}장`);
  }
}

/* ── 3. 비번·열쇠·개인정보 ──────────────────────────────── */
console.log('\n3. 비번·열쇠·개인정보가 섞였나');

const 거를것 = [
  /* 값이 적힌 것만 잡습니다. 「어디서 읽는지」를 적은 줄은 값이 아닙니다 —
       MASTER_PW = (ssh potjob "…")        ← ( 로 시작합니다
       sed -n 's/^MASTER_PW=//p'           ← 뒤가 // 입니다
     그래서 **비번처럼 생긴 토막 6자 이상**일 때만 잡습니다 */
  ['MASTER_PW 값', /MASTER_PW\s*=\s*['"]?[A-Za-z0-9!@#%^&*_+~?-]{6,}/],
  ['service 열쇠(sk-)', /\bsk-[A-Za-z0-9_-]{16,}/],
  ['JWT(eyJ)', /\beyJ[A-Za-z0-9_-]{20,}/],
  ['메일 주소', /[A-Za-z0-9._%+-]+@(?:naver|gmail|daum|hanmail|kakao|nate)\.[A-Za-z.]{2,}/i],
  ['전화번호', /\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b/],
  ['주민등록번호 꼴', /\b\d{6}[-]\d{7}\b/],
];
const 볼파일 = [
  ...문서들,
  ...fs.readdirSync(그림방).filter((f) => /\.(html|json)$/.test(f)).map((f) => path.join(그림방, f)),
];
const 걸린것 = [];
for (const f of 볼파일) {
  const 글 = fs.readFileSync(f, 'utf8');
  for (const [이름, 꼴] of 거를것) {
    const m = 글.match(꼴);
    if (m) 걸린것.push(`${path.relative(뿌리, f)} — ${이름}`);
  }
}
적기(걸린것.length === 0, `본 파일 ${볼파일.length}개`
  + (걸린것.length ? ` — 걸린 것: ${걸린것.join(' · ')}` : ''));

/* ── 4. [미확인] ───────────────────────────────────────── */
console.log('\n4. [미확인]');
let 미확인 = 0; const 어디 = [];
for (const d of 문서들) {
  const 글 = fs.readFileSync(d, 'utf8').split(/\r?\n/);
  글.forEach((줄, i) => {
    /* 「[미확인] 이라고 적는다」를 설명하는 줄과, 05 부록 7절을 가리키는 줄은
       셈에서 뺍니다 — 그 줄에 <!-- 점검:설명 --> 을 붙여 뒀습니다.
       그러지 않으면 설명이 늘어날수록 미확인 수가 늘어납니다 */
    if (줄.includes('[미확인]') && !줄.includes('점검:설명')) {
      미확인++; 어디.push(`${path.basename(d)}:${i + 1}`);
    }
  });
}
console.log(`  [미확인] ${미확인}곳` + (미확인 ? ' — ' + 어디.join(' · ') : ''));

/* ── 5. 캡처 꼴 ───────────────────────────────────────── */
console.log('\n5. 캡처');
const 그림들 = fs.readdirSync(그림방).filter((f) => f.endsWith('.png'));
const 작은것 = 그림들.filter((f) => fs.statSync(path.join(그림방, f)).size < 15 * 1024);
적기(작은것.length === 0, `그림 ${그림들.length}장 · 15KB 미만(빈 화면 의심) ${작은것.length}장`
  + (작은것.length ? ` — ${작은것.slice(0, 8).join(' · ')}` : ''));

const 짝 = new Map();
for (const f of 그림들) {
  const m = f.match(/^(.*)__(pc|phone)\.png$/);
  if (!m) continue;
  if (!짝.has(m[1])) 짝.set(m[1], new Set());
  짝.get(m[1]).add(m[2]);
}
const 짝없음 = [...짝].filter(([, s]) => s.size < 2).map(([k]) => k);
적기(짝없음.length === 0, `PC·휴대폰 둘 다 있는 화면 ${[...짝].filter(([, s]) => s.size === 2).length}개`
  + (짝없음.length ? ` — 한쪽만: ${짝없음.join(' · ')}` : ''));

if (목록) {
  /* 목록.json 에 없는 그림은 **옛 캡처**입니다 (코드가 찍기 전에 손으로 찍은 것).
     지우지 않습니다 — `docs/IA_화면스펙_2026-10-08.md` 가 20군데에서 가리킵니다.
     그래서 「아무도 안 가리키는 그림(고아)」만 걸러냅니다 */
  const 문서글 = fs.readdirSync(path.join(뿌리, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(path.join(뿌리, 'docs', f), 'utf8')).join('\n');
  const 목록밖 = 그림들.filter((f) => !목록.줄.some((r) => r.파일 === f));
  const 고아 = 목록밖.filter((f) => !문서글.includes(f));
  적기(고아.length === 0,
    `목록.json 안 ${목록.줄.length}장 · 옛 캡처 ${목록밖.length}장(옛 문서가 가리킵니다)`
    + (고아.length ? ` — **아무도 안 가리키는 그림 ${고아.length}장**: ${고아.slice(0, 8).join(' · ')}` : ''));
}

/* ── 끝 ─────────────────────────────────────────────── */
console.log(탈.length ? `\n✗ 걸린 것 ${탈.length}개\n` : '\n○ 다 맞습니다\n');
process.exit(탈.length ? 1 : 0);
