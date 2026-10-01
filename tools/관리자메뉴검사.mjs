/* 관리자 화면을 만들어 놓고 **메뉴에 안 걸면** 아무도 못 찾습니다.
 *
 *   node tools/관리자메뉴검사.mjs
 *
 * ── 왜 만들었나 ──────────────────────────────────────────────
 * 2026-10-01 에 두 번 났습니다 —
 *   경쟁사 비교(/admin/rival)   만들고 메뉴에 안 걸어서 주소를 쳐야만 들어갔습니다
 *   회원·신고                   걸었지만 세중님이 못 보셨습니다
 *
 * 「다음부터 잊지 않겠습니다」 는 약속이라 또 잊습니다.
 * 기계가 잡게 합니다. 커밋 전에 돌리면 빠진 것이 바로 나옵니다.
 *
 * ── 무엇을 보나 ──────────────────────────────────────────────
 *   web/app/admin 아래 page.tsx 가 있는데 layout.tsx 의 메뉴에 없으면 ★
 *   메뉴에는 있는데 화면 파일이 없으면 ★ (눌러도 404)
 */
import fs from 'node:fs';
import path from 'node:path';

const 뿌리 = 'web/app/admin';
const 레이아웃 = path.join(뿌리, 'layout.tsx');

/* ── 화면 파일 찾기 ─────────────────────────────────────── */
function 화면들(디렉터리, 앞 = '/admin') {
  const 나온것 = [];
  for (const e of fs.readdirSync(디렉터리, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const 길 = path.join(디렉터리, e.name);
    const 주소 = 앞 + '/' + e.name;
    /* [id] 같은 자리는 메뉴에 안 겁니다 — 목록에서 눌러 들어가는 화면입니다 */
    if (e.name.startsWith('[')) continue;
    if (fs.existsSync(path.join(길, 'page.tsx'))) 나온것.push(주소);
    나온것.push(...화면들(길, 주소));
  }
  return 나온것;
}

const 있는화면 = ['/admin', ...화면들(뿌리)].sort();

/* ── 메뉴에 걸린 것 ─────────────────────────────────────── */
const 글 = fs.readFileSync(레이아웃, 'utf8');
const 메뉴 = [...글.matchAll(/href:\s*'(\/admin[^']*)'\s*,\s*label:\s*'([^']+)'/g)]
  .map((m) => ({ 주소: m[1], 이름: m[2] }));
const 걸린주소 =메뉴.map((m) => m.주소);

/* ── 맞대보기 ───────────────────────────────────────────── */
const 안걸린것 = 있는화면.filter((p) => !걸린주소.includes(p));
const 빈메뉴   = 걸린주소.filter((p) => !있는화면.includes(p));

console.log('관리자 화면 ' + 있는화면.length + '개 · 메뉴 ' + 메뉴.length + '줄\n');
for (const m of 메뉴) {
  console.log('  ' + (있는화면.includes(m.주소) ? '○ ' : '★ ') + m.주소.padEnd(22) + m.이름);
}

let 틀림 = 0;

if (안걸린것.length) {
  틀림 += 안걸린것.length;
  console.log('\n★ 화면은 있는데 **메뉴에 안 걸린 것** ' + 안걸린것.length + '개 —');
  안걸린것.forEach((p) => console.log('    ' + p + '   (주소를 직접 쳐야만 들어갑니다)'));
  console.log('\n  web/app/admin/layout.tsx 의 목록에 한 줄씩 넣으세요.');
}

if (빈메뉴.length) {
  틀림 += 빈메뉴.length;
  console.log('\n★ 메뉴에는 있는데 **화면 파일이 없는 것** ' + 빈메뉴.length + '개 —');
  빈메뉴.forEach((p) => console.log('    ' + p + '   (누르면 404 입니다)'));
}

console.log(틀림 ? '\n★ ' + 틀림 + '개 어긋납니다' : '\n○ 화면과 메뉴가 다 맞습니다');
process.exit(틀림 ? 1 : 0);
