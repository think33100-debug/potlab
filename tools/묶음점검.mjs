/* 묶음점검 — 압축을 **푼 폴더**를 보고 넘길 수 있는지 묻습니다.
 *
 *   node tools/묶음점검.mjs <푼 폴더>
 *
 * 다섯을 봅니다
 *   ① 시작.html → 갤러리 → 04 화면스펙 링크가 **파일로 열어도** 다 걸리나
 *   ② 그림이 다 있나 (갤러리가 가리키는 것 전부)
 *   ③ 비번·열쇠·메일·전화번호가 섞였나
 *   ④ 가릴자리 목록의 닉네임이 **글자로** 남아 있나
 *   ⑤ 이 묶음에 **없는 파일**을 가리키는 링크가 있나 (깨진 링크)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.join(여기, '..');
const 방 = process.argv[2];
if (!방 || !fs.existsSync(방)) { console.error('쓰기: node tools/묶음점검.mjs <푼 폴더>'); process.exit(1); }

const 탈 = [];
const 적기 = (됐나, 말) => { console.log((됐나 ? '  ○ ' : '  ✗ ') + 말); if (!됐나) 탈.push(말); };

/* 모든 파일 긁기 */
const 모든파일 = [];
(function 걷기(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) 걷기(p); else 모든파일.push(p);
  }
})(방);
const html들 = 모든파일.filter((f) => f.endsWith('.html'));
const png들 = 모든파일.filter((f) => f.endsWith('.png'));
const 글파일 = 모든파일.filter((f) => /\.(html|md|json)$/.test(f));

console.log(`\n푼 폴더 — 파일 ${모든파일.length}개 (html ${html들.length} · png ${png들.length})`);

/* ── ①⑤ 링크 ──────────────────────────────────────────── */
console.log('\n① 링크 — 파일로 열어도 걸리나');
let 본링크 = 0; const 깨진것 = []; const 닻없음 = [];
for (const h of html들) {
  const 글 = fs.readFileSync(h, 'utf8');
  for (const m of 글.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const 대상 = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(대상)) continue;
    본링크++;
    const [길, 닻] = decodeURIComponent(대상).split('#');
    const 참길 = path.resolve(path.dirname(h), 길);
    if (!fs.existsSync(참길)) { 깨진것.push(`${path.basename(h)} → ${대상}`); continue; }
    if (닻 && 참길.endsWith('.html')) {
      const 받는글 = fs.readFileSync(참길, 'utf8');
      if (!받는글.includes(`id="${닻}"`)) 닻없음.push(`${path.basename(h)} → ${대상}`);
    }
  }
}
적기(깨진것.length === 0, `html 안의 링크 ${본링크}개 · 깨진 것 ${깨진것.length}`
  + (깨진것.length ? ' — ' + 깨진것.slice(0, 6).join(' · ') : ''));
적기(닻없음.length === 0, `닻(#…) 이 받는 쪽에 있나 · 없는 것 ${닻없음.length}`
  + (닻없음.length ? ' — ' + 닻없음.slice(0, 6).join(' · ') : ''));

/* md 안의 링크도 (GitHub 에서 볼 분을 위해) */
const md들 = 모든파일.filter((f) => f.endsWith('.md'));
const md깨짐 = [];
for (const m of md들) {
  const 글 = fs.readFileSync(m, 'utf8');
  for (const x of 글.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const 대상 = x[1];
    if (/^(https?:|mailto:|#)/.test(대상)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(m), decodeURIComponent(대상.split('#')[0])))) {
      md깨짐.push(`${path.basename(m)} → ${대상}`);
    }
  }
}
적기(md깨짐.length === 0, `md 안의 링크 · 깨진 것 ${md깨짐.length}`
  + (md깨짐.length ? ' — ' + md깨짐.slice(0, 8).join(' · ') : ''));

/* ── ② 갤러리 그림 ─────────────────────────────────────── */
console.log('\n② 갤러리 그림');
const 갤 = path.join(방, 'docs', 'screens', 'index.html');
if (!fs.existsSync(갤)) 적기(false, 'docs/screens/index.html 이 없습니다');
else {
  const 글 = fs.readFileSync(갤, 'utf8');
  const 가리킨것 = [...new Set([...글.matchAll(/(?:src|href)="([^"]+\.png)"/g)].map((m) => decodeURIComponent(m[1])))];
  const 없는것 = 가리킨것.filter((f) => !fs.existsSync(path.join(path.dirname(갤), f)));
  적기(없는것.length === 0, `갤러리가 가리키는 그림 ${가리킨것.length}종 · 없는 것 ${없는것.length}`);
  const 빈것 = png들.filter((f) => fs.statSync(f).size < 3 * 1024);
  적기(빈것.length === 0, `3KB 미만(깨진 그림) ${빈것.length}장`);
}

/* ── ③ 비번·열쇠·개인정보 ─────────────────────────────── */
console.log('\n③ 비번·열쇠·메일·전화');
const 거를것 = [
  ['MASTER_PW 값', /MASTER_PW\s*=\s*['"]?[A-Za-z0-9!@#%^&*_+~?-]{6,}/],
  ['sk-ant', /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ['JWT(eyJ)', /\beyJ[A-Za-z0-9_-]{30,}/],
  ['메일 주소', /[A-Za-z0-9._%+-]+@(?:naver|gmail|daum|hanmail|kakao|nate)\.[A-Za-z.]{2,}/i],
  ['전화번호', /\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b/],
  ['주민등록번호 꼴', /\b\d{6}-\d{7}\b/],
  ['supabase 주소+열쇠', /supabase\.co[^\s"']*apikey=/i],
];
const 걸린것 = [];
for (const f of 글파일) {
  const 글 = fs.readFileSync(f, 'utf8');
  for (const [이름, 꼴] of 거를것) if (꼴.test(글)) 걸린것.push(`${path.relative(방, f)} — ${이름}`);
}
적기(걸린것.length === 0, `글 파일 ${글파일.length}개`
  + (걸린것.length ? ' — 걸린 것: ' + 걸린것.slice(0, 8).join(' · ') : ''));

/* ── ④ 가릴 닉네임이 글자로 남았나 ──────────────────────── */
console.log('\n④ 가려야 할 닉네임');
const 가릴 = JSON.parse(fs.readFileSync(path.join(여기, '가릴자리.json'), 'utf8')).글자.목록;
const 닉걸림 = [];
for (const f of 글파일) {
  const 글 = fs.readFileSync(f, 'utf8');
  for (const w of 가릴) {
    /* 낱말 그대로 둘러싸인 자리만 — 「하나요」 같은 데 걸리지 않게 */
    const 꼴 = new RegExp(`(^|[^가-힣])${w}([^가-힣]|$)`);
    if (꼴.test(글)) 닉걸림.push(`${path.relative(방, f)} — ${w}`);
  }
}
적기(닉걸림.length === 0, `닉네임 ${가릴.length}개를 글 파일에서 찾기`
  + (닉걸림.length ? ' — 걸린 것: ' + 닉걸림.slice(0, 8).join(' · ') : ''));

/* ── 끝 ───────────────────────────────────────────────── */
const 바이트 = 모든파일.reduce((a, f) => a + fs.statSync(f).size, 0);
console.log(`\n푼 크기 ${(바이트 / 1024 / 1024).toFixed(1)}MB`);
console.log(탈.length ? `\n✗ 걸린 것 ${탈.length}개\n` : '\n○ 다 맞습니다\n');
process.exit(탈.length ? 1 : 0);
