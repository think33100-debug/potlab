/* ★ **쪽 나눠 받는 자리에 차례(order)가 있나** — 저장소 전체 검사 (2026-10-25 세중님 2·4번)
 *
 *   node tools/쪽나눠받기_점검.mjs            걸린 자리를 찍습니다 (걸리면 exit 1)
 *   node tools/쪽나눠받기_점검.mjs --다보기    통과한 자리도 함께
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * PostgREST 는 한 번에 **100줄**에서 끊습니다. `offset` 으로 다음 쪽을 받을 때
 * **차례(order)가 없으면 줄이 겹치거나 빠집니다** (지침 8-20 ③).
 * 2026-10-23 에 회원 화면을 292 → 231 로 잘못 셌고, **2026-10-25 에 또** 219 ↔ 281 로
 * 잘못 셌습니다 (전수 검사 도구). 같은 함정을 두 번 밟았으니 **검사로 막습니다.**
 *
 * ── 무엇을 보나 ─────────────────────────────────────────────
 *   ① `offset=` 이나 `Range:` 로 쪽을 넘기는 줄을 찾습니다
 *   ② 그 줄(또는 그 줄이 쓰는 길 변수)에 `order=` 가 있거나,
 *      `차례붙이기()` · `모두받기()` · `쪽나눠받기` 를 쓰면 **통과**입니다
 *   ③ 아니면 **걸립니다** — 파일:줄 로 냅니다
 * ★ 걸린 자리는 `tools/쪽나눠받기.mjs` 의 `차례붙이기(길)` 를 끼우면 됩니다.
 */
import fs from 'node:fs';
import path from 'node:path';

const 뿌리 = path.join(import.meta.dirname, '..');
const 다보기 = process.argv.includes('--다보기');

/** 볼 폴더와 확장자 */
const 볼곳 = ['tools', 'scripts', 'web/app', 'web/lib', 'web/components'];
const 볼꼴 = /\.(mjs|js|ts|tsx)$/;
/** 넘어가는 자리 — 이 파일 자신과 공용 받기 도구 */
const 봐주는파일 = /쪽나눠받기(_점검)?\.mjs$/;

export const 쪽넘김꼴 = /offset\s*=|offset:\s*|['"]Range['"]\s*:|\.range\s*\(/;
export const 차례있나꼴 = /order\s*=|order:\s*|차례붙이기|모두받기|쪽나눠받기|\.order\s*\(/;

/* ★ 우리 쪽나눔이 **아닌** 자리 — 셈에서 뺍니다
     ㉠ 남의 사이트 주소 안의 offset (긁기 설정 · tools/hosp_sites.js 꼴)
     ㉡ DB 창구 인수 `p_offset`·`p_limit` (함수가 제 안에서 차례를 정합니다)
     ㉢ Storage 목록 API (이름 차례로 옵니다) */
export const 우리것아님 = [
  /https?:\/\/[^'"`]*offset=/,
  /p_offset|p_limit/,
  /storage\s*\.\s*from|\.list\s*\(/,
];

export function 파일보기(글, 이름) {
  const 줄들 = 글.split('\n');
  const 걸림 = []; const 통과 = [];
  줄들.forEach((줄, i) => {
    if (!쪽넘김꼴.test(줄)) return;
    if (/^\s*(\*|\/\/|#)/.test(줄)) return;                 /* 주석 */
    if (우리것아님.some((re) => re.test(줄))) return;
    /* 그 줄 앞뒤 **열두 줄**을 함께 봅니다 — 길을 변수에 담아 쓰는 꼴이 많습니다 */
    const 창 = 줄들.slice(Math.max(0, i - 12), i + 6).join('\n');
    (차례있나꼴.test(줄) || 차례있나꼴.test(창) ? 통과 : 걸림)
      .push({ 파일: 이름, 줄번호: i + 1, 글: 줄.trim().slice(0, 110) });
  });
  return { 걸림, 통과 };
}

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('order 없는 offset 은 걸린다',
    파일보기("const r = await fetch(U + '/rest/v1/job_posts?select=id&limit=100&offset=' + off);", 'a').걸림.length === 1);
  보('order 있으면 통과',
    파일보기("fetch(U + '/rest/v1/job_posts?select=id&order=id.asc&limit=100&offset=' + off)", 'a').걸림.length === 0);
  보('차례붙이기를 쓰면 통과',
    파일보기("fetch(U + '/rest/v1/' + 차례붙이기(길) + '&limit=100&offset=' + off)", 'a').걸림.length === 0);
  보('앞줄에 order 가 있어도 통과',
    파일보기("const 길 = 'job_posts?select=id&order=id.asc';\nfetch(U + 길 + '&offset=' + off)", 'a').걸림.length === 0);
  보('주석은 안 본다', 파일보기("// offset= 어쩌고", 'a').걸림.length === 0);
  보('Range 머리도 본다',
    파일보기("headers: { 'Range': '0-99' }", 'a').걸림.length === 1);
  보('남의 주소 안 offset 은 안 본다',
    파일보기("url: 'https://x.or.kr/list?offset=0&board_no=1'", 'a').걸림.length === 0);
  보('창구 인수 p_offset 은 안 본다',
    파일보기("sb.rpc('org_search', { p_offset: p * 20 })", 'a').걸림.length === 0);
  보('Storage 목록은 안 본다',
    파일보기("storage.from('notices').list(prefix, { limit: 1000, offset: 0 })", 'a').걸림.length === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

function 훑기(터) {
  const 낸것 = [];
  const 걷기 = (여기) => {
    for (const d of fs.readdirSync(여기, { withFileTypes: true })) {
      const p = path.join(여기, d.name);
      if (d.isDirectory()) {
        if (/node_modules|\.next|\.git/.test(d.name)) continue;
        걷기(p);
      } else if (볼꼴.test(d.name) && !봐주는파일.test(d.name)) 낸것.push(p);
    }
  };
  if (fs.existsSync(터)) 걷기(터);
  return 낸것;
}

const 걸린것 = []; const 통과것 = [];
for (const 터 of 볼곳) {
  for (const f of 훑기(path.join(뿌리, 터))) {
    const { 걸림, 통과 } = 파일보기(fs.readFileSync(f, 'utf8'), path.relative(뿌리, f).replace(/\\/g, '/'));
    걸린것.push(...걸림); 통과것.push(...통과);
  }
}

console.log('쪽 나눠 받는 자리 — 통과 ' + 통과것.length + ' · **걸림 ' + 걸린것.length + '**');
for (const x of 걸린것) console.log('  ✗ ' + x.파일 + ':' + x.줄번호 + '  ' + x.글);
if (다보기) for (const x of 통과것) console.log('  ○ ' + x.파일 + ':' + x.줄번호);
if (걸린것.length) {
  console.error('\n✗ 차례(order) 없이 쪽을 넘기는 자리가 ' + 걸린것.length + '곳입니다.');
  console.error('  고치는 법 — tools/쪽나눠받기.mjs 의 차례붙이기(길) 를 끼웁니다 (지침 8-20 ③)');
  process.exit(1);
}
console.log('○ 모두 차례를 붙여 받습니다');
