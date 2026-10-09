/* 갤러리 — docs/screens/index.html 을 만듭니다.
 *
 *   node tools/갤러리.mjs
 *
 * 개발자가 **파일만 두 번 눌러** 보도록 만듭니다. 서버가 필요 없습니다.
 * 자료는 docs/screens/목록.json (tools/캡처.mjs 가 남깁니다) 에서 읽어
 * 이 파일 안에 박아 넣습니다 — file:// 에서는 fetch 가 막히기 때문입니다.
 *
 * 묶는 순서: 화면(주소) → 그 안에서 페르소나 × 상태 × PC/휴대폰.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 그림방 = path.join(뿌리, 'docs', 'screens');
const 목록길 = path.join(그림방, '목록.json');

if (!fs.existsSync(목록길)) {
  console.error('docs/screens/목록.json 이 없습니다. 먼저 node tools/캡처.mjs 를 돌리십시오.');
  process.exit(1);
}
const 목록 = JSON.parse(fs.readFileSync(목록길, 'utf8'));

/* ── 주소 → 04_화면스펙 의 절 ──────────────────────────────
   스펙 문서의 제목에서 `/주소` 를 뽑아 닻 이름을 만듭니다.
   GitHub·VS Code 미리보기가 쓰는 규칙(소문자·공백→-·특수문자 빼기)과 같게. */
const 스펙길 = path.join(뿌리, 'docs', '인계', '04_화면스펙.md');
const 절 = [];
if (fs.existsSync(스펙길)) {
  for (const 줄 of fs.readFileSync(스펙길, 'utf8').split(/\r?\n/)) {
    const m = 줄.match(/^(#{2,4})\s+(.*)$/);
    if (!m) continue;
    const 제목 = m[2].trim();
    /* GitHub·VS Code 미리보기의 규칙 — 소문자로, 글자·숫자·한글·밑줄·하이픈·공백만
       남기고, 공백을 하이픈으로. 백틱·마침표·슬래시·꺾쇠는 **없어집니다** */
    const 닻 = 제목.toLowerCase()
      .replace(/[^0-9a-z가-힣_\s-]/g, '')
      .trim().replace(/\s+/g, '-');
    /* 제목에 적힌 주소들을 전부 거둡니다 */
    for (const a of 제목.matchAll(/`?(\/[A-Za-z0-9/[\]._-]*)`?/g)) 절.push({ 주소: a[1], 제목, 닻 });
  }
}
/* 주소 하나에 절이 여럿이면 **가장 긴 주소**를 쓴 절이 맞습니다 */
function 절찾기(주소) {
  const 길 = 주소.split('?')[0];
  let 최고 = null;
  for (const s of 절) {
    const 같나 = s.주소 === 길
      /* /jobs/[id] ↔ /jobs/WNK… · /edu/session/[id] ↔ /edu/session/2 */
      || (s.주소.includes('[') && new RegExp('^' + s.주소.replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(길));
    if (같나 && (!최고 || s.주소.length > 최고.주소.length)) 최고 = s;
  }
  /* 관리자 화면 23곳은 14절이 **표로 묶어** 적습니다 — 제목에 주소를 하나하나
     쓰지 않습니다. 그래서 /admin/* 는 그 절로 보냅니다 */
  if (!최고 && 길.startsWith('/admin/')) 최고 = 절.find((s) => s.주소 === '/admin') ?? null;
  /* 404 는 **길이 없는 화면**입니다 (app/not-found.tsx). 아무 없는 주소로
     들어가 찍으니 그 주소로는 절을 못 찾습니다 — 21절로 보냅니다 */
  if (!최고 && !라우트.some((r) => r.꼴.test(길))) 최고 = 절.find((s) => /not-found/.test(s.제목)) ?? null;
  return 최고;
}

/* ── 화면(주소)별로 묶기 ───────────────────────────────────
   묶는 열쇠는 **app/ 의 길(라우트)** 입니다. 두 가지를 접어 넣습니다.
     ?q= · ?진단=1 같은 묻는 말  → 그 화면의 **상태**
     /edu/session/2 · 3 · 4 …    → /edu/session/[id] 한 자리
   그래야 「화면 수」가 app 안 page.tsx 의 수와 맞고, 한 자리에서 상태를
   나란히 볼 수 있습니다. 온전한 주소는 칸 설명에 그대로 적습니다. */
function 길들(폴더, 앞 = '') {
  const out = [];
  for (const e of fs.readdirSync(폴더, { withFileTypes: true })) {
    if (e.isDirectory()) {
      out.push(...길들(path.join(폴더, e.name), e.name.startsWith('(') ? 앞 : 앞 + '/' + e.name));
    /* page.tsx 말고 route.ts(x) 도 봅니다 — /api/og/job/[id] 같은 길이
       공고 번호마다 다른 자리로 갈라지지 않게 */
    } else if (/^(page|route)\.tsx?$/.test(e.name)) out.push(앞 || '/');
  }
  return out;
}
/* 긴 길부터 봅니다 — /admin/jobs/[id] 가 /admin/jobs 보다 먼저 */
const 라우트 = [...new Set(길들(path.join(뿌리, 'web', 'app')))]
  .sort((a, b) => b.length - a.length)
  .map((r) => ({ 길: r, 꼴: new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$') }));

function 라우트찾기(주소) {
  const 길 = 주소.split('?')[0];
  return 라우트.find((r) => r.꼴.test(길))?.길 ?? 길;
}

const 화면 = new Map();
for (const r of 목록.줄) {
  const 키 = 라우트찾기(r.주소);
  if (!화면.has(키)) 화면.set(키, []);
  화면.get(키).push(r);
}

/* 주소 정렬 — / 먼저, 그다음 글자순 */
const 주소들 = [...화면.keys()].sort((a, b) =>
  (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b, 'ko')));

const 페르소나순 = ['(로그인 안 함)', '비회원', '가입중', '학생', '작업치료사', '물리치료사',
  '채용담당자', '교육담당자', '채용+교육담당자', '관리자'];
const 순 = (r) => {
  const i = 페르소나순.indexOf(r.역할);
  return (i < 0 ? 99 : i) * 10 + (r.폭 === 'pc' ? 0 : 1);
};

const 안전 = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── 세기 ───────────────────────────────────────────────── */
const 페르소나셈 = new Map();
const 상태셈 = new Map();
for (const r of 목록.줄) {
  페르소나셈.set(r.역할, (페르소나셈.get(r.역할) ?? 0) + 1);
  상태셈.set(r.상태, (상태셈.get(r.상태) ?? 0) + 1);
}

/* ── 글로 ───────────────────────────────────────────────── */
let 몸 = '';
for (const 주소 of 주소들) {
  const 줄들 = 화면.get(주소).slice().sort((a, b) => 순(a) - 순(b) || a.파일.localeCompare(b.파일));
  const s = 절찾기(주소);
  const 묶음말 = [...new Set(줄들.map((r) => r.역할))].join(' · ');
  몸 += `
<section class="screen" id="screen-${안전(주소.replace(/[^A-Za-z0-9]/g, '_'))}"
         data-personas="${안전([...new Set(줄들.map((r) => r.역할))].join('|'))}"
         data-states="${안전([...new Set(줄들.map((r) => r.상태))].join('|'))}">
  <h2><code>${안전(주소)}</code></h2>
  <p class="meta">
    <span class="count">${줄들.length}장</span>
    <span>${안전(묶음말)}</span>
    ${s ? `<a class="spec" href="../인계/04_화면스펙.md#${안전(s.닻)}">04 화면스펙 → ${안전(s.제목)}</a>`
        : '<span class="nospec">04 화면스펙에 절이 없습니다</span>'}
  </p>
  <div class="shots">`;
  for (const r of 줄들) {
    몸 += `
    <figure data-persona="${안전(r.역할)}" data-state="${안전(r.상태)}" data-w="${안전(r.폭)}">
      <a href="${안전(r.파일)}" target="_blank" rel="noopener">
        <img src="${안전(r.파일)}" alt="${안전(r.이름)}" loading="lazy">
      </a>
      <figcaption>
        <b>${안전(r.역할)}</b>
        <span class="st st-${안전(r.상태.replace(/[^가-힣]/g, ''))}">${안전(r.상태)}</span>
        <span class="w">${r.폭 === 'pc' ? 'PC 1280' : '휴대폰 390'}</span>
        <code>${안전(r.주소)}</code>
        <span class="fn">${안전(r.파일)}</span>
      </figcaption>
    </figure>`;
  }
  몸 += `
  </div>
</section>`;
}

const 찍은때 = 목록.찍은때 ? new Date(목록.찍은때).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';

const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>POTJOB 화면 갤러리</title>
<style>
  :root { --줄: #e5e7eb; --흐림: #6b7280; --파랑: #2563eb; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.6 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
         color: #111; background: #fafafa; }
  header { position: sticky; top: 0; z-index: 5; background: #fff;
           border-bottom: 1px solid var(--줄); padding: 14px 20px; }
  header h1 { margin: 0 0 4px; font-size: 19px; }
  header .한줄 { color: var(--흐림); font-size: 13px; }
  .고르기 { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
  .고르기 b { font-size: 12px; color: var(--흐림); margin-right: 2px; }
  button.칩 { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid var(--줄);
              background: #fff; border-radius: 999px; cursor: pointer; }
  button.칩[aria-pressed="true"] { background: var(--파랑); border-color: var(--파랑); color: #fff; }
  main { padding: 20px; max-width: 1500px; margin: 0 auto; }
  nav.차례 { background: #fff; border: 1px solid var(--줄); border-radius: 10px;
             padding: 12px 16px; margin-bottom: 20px;
             /* 62곳이라 한 줄로 두면 옆으로 넘칩니다 — 접어 보입니다 */
             display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
  nav.차례 a { font-size: 12px; color: var(--파랑); text-decoration: none;
               white-space: nowrap; }
  section.screen { background: #fff; border: 1px solid var(--줄); border-radius: 10px;
                   padding: 16px; margin-bottom: 22px; }
  section.screen h2 { margin: 0 0 4px; font-size: 16px; }
  section.screen h2 code { background: #f3f4f6; padding: 2px 8px; border-radius: 6px; }
  p.meta { margin: 0 0 12px; font-size: 12px; color: var(--흐림);
           display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .count { background: #111; color: #fff; border-radius: 999px; padding: 1px 8px; }
  a.spec { color: var(--파랑); }
  .nospec { color: #b45309; }
  .shots { display: grid; gap: 14px;
           grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
  figure { margin: 0; border: 1px solid var(--줄); border-radius: 8px; overflow: hidden;
           background: #fff; }
  /* PC 그림은 1280px 넓이라 좁은 칸에 넣으면 글자가 안 보입니다. 두 칸을 씁니다 */
  figure[data-w="pc"] { grid-column: span 2; }
  figure img { display: block; width: 100%; height: 320px; object-fit: cover;
               object-position: top; background: #f9fafb; }
  @media (max-width: 560px) { figure[data-w="pc"] { grid-column: span 1; } }
  figcaption { padding: 8px 10px; font-size: 11px; line-height: 1.5; }
  figcaption b { display: inline-block; margin-right: 6px; }
  figcaption code { display: block; color: var(--흐림); word-break: break-all; margin-top: 2px; }
  figcaption .fn { display: block; color: #9ca3af; font-size: 10px; word-break: break-all; }
  .w { color: var(--흐림); }
  .st { display: inline-block; padding: 0 6px; border-radius: 4px; font-size: 10px;
        background: #f3f4f6; color: #374151; }
  .st-자료있음 { background: #dcfce7; color: #166534; }
  .st-빈상태 { background: #fef3c7; color: #92400e; }
  .st-로그인안내 { background: #dbeafe; color: #1e40af; }
  .st-권한없음 { background: #fee2e2; color: #991b1b; }
  .st-숨김준비중 { background: #ede9fe; color: #5b21b6; }
  section.screen[hidden], figure[hidden] { display: none; }
</style>

<header>
  <h1>POTJOB 화면 갤러리</h1>
  <div class="한줄">
    화면 <b>${주소들.length}</b>곳 · 그림 <b>${목록.줄.length}</b>장 · 찍은 때 ${안전(찍은때)}
    · 찍은 곳 <code>${안전(목록.주소 ?? '')}</code>
  </div>
  <div class="한줄" style="margin-top:4px">
    그림을 누르면 원래 크기로 열립니다. 긴 화면은 위에서 320px 만 보입니다.
  </div>
  <div class="고르기" id="페르소나고르기"><b>페르소나</b></div>
  <div class="고르기" id="상태고르기"><b>상태</b></div>
  <div class="고르기" id="폭고르기"><b>폭</b></div>
</header>

<main>
  <nav class="차례" id="차례"></nav>
  ${몸}
</main>

<script>
const 페르소나 = ${JSON.stringify([...페르소나셈].sort((a, b) => b[1] - a[1]))};
const 상태 = ${JSON.stringify([...상태셈].sort((a, b) => b[1] - a[1]))};
const 폭목록 = [['pc', 'PC 1280'], ['phone', '휴대폰 390']];
const 켠것 = { persona: null, state: null, w: null };

function 칩들(통, 줄들, 키, 이름내기) {
  for (const [값, 수] of 줄들) {
    const b = document.createElement('button');
    b.className = '칩'; b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.textContent = (이름내기 ? 이름내기(값) : 값) + ' ' + 수;
    b.onclick = () => {
      켠것[키] = 켠것[키] === 값 ? null : 값;
      for (const x of 통.querySelectorAll('button')) x.setAttribute('aria-pressed', 'false');
      if (켠것[키] === 값) b.setAttribute('aria-pressed', 'true');
      거르기();
    };
    통.append(b);
  }
}
칩들(document.getElementById('페르소나고르기'), 페르소나, 'persona');
칩들(document.getElementById('상태고르기'), 상태, 'state');
칩들(document.getElementById('폭고르기'),
     폭목록.map(([v]) => [v, document.querySelectorAll('figure[data-w="' + v + '"]').length]),
     'w', (v) => (v === 'pc' ? 'PC' : '휴대폰'));

function 거르기() {
  for (const s of document.querySelectorAll('section.screen')) {
    let 보인다 = 0;
    for (const f of s.querySelectorAll('figure')) {
      const ok = (!켠것.persona || f.dataset.persona === 켠것.persona)
              && (!켠것.state || f.dataset.state === 켠것.state)
              && (!켠것.w || f.dataset.w === 켠것.w);
      f.hidden = !ok; if (ok) 보인다++;
    }
    s.hidden = 보인다 === 0;
    const c = s.querySelector('.count'); if (c) c.textContent = 보인다 + '장';
  }
  차례그리기();
}

function 차례그리기() {
  const n = document.getElementById('차례');
  n.innerHTML = '<b style="font-size:12px;color:#6b7280">차례 </b>';
  for (const s of document.querySelectorAll('section.screen:not([hidden])')) {
    const a = document.createElement('a');
    a.href = '#' + s.id; a.textContent = s.querySelector('h2 code').textContent;
    n.append(a);
  }
}
차례그리기();
</script>
</html>
`;

fs.writeFileSync(path.join(그림방, 'index.html'), html);
console.log(`○ docs/screens/index.html — 화면 ${주소들.length}곳 · 그림 ${목록.줄.length}장`);
const 절없음 = 주소들.filter((a) => !절찾기(a));
if (절없음.length) {
  console.log(`\n04_화면스펙 에 절이 없는 주소 ${절없음.length}곳:`);
  for (const a of 절없음) console.log('  · ' + a);
}
