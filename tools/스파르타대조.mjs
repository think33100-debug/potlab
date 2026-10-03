/* ═══════════════════════════════════════════════════════════════
 *  teamsparta.md ↔ web/app/globals.css 토큰 대조 (2026-10-03)
 *  문서가 기준입니다. 다른 곳만 찍습니다.
 * ═══════════════════════════════════════════════════════════════
 *   node tools/스파르타대조.mjs
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';

const md = fs.readFileSync('teamsparta.md', 'utf8');
const css = fs.readFileSync('web/app/globals.css', 'utf8');

/* 문서 머리(--- … ---)의 colors·spacing·rounded 를 읽습니다 */
const 머리 = md.slice(0, md.indexOf('\n---', 4));
const 문서값 = new Map();
let 묶음 = '';
for (const l of 머리.split(/\r?\n/)) {
  const b = l.match(/^([a-z]+):\s*$/);
  if (b) { 묶음 = b[1]; continue; }
  const m = l.match(/^\s{2}([a-z0-9-]+):\s*(.+?)\s*(?:#.*)?$/i);
  if (!m || !['colors', 'spacing', 'rounded'].includes(묶음)) continue;
  let v = m[2].trim().replace(/\s*#.*$/, '').trim();
  if (/^\{colors\./.test(v)) continue;            // 별명은 건너뜁니다
  문서값.set(m[1], v);
}

/* ★ @theme 블록만 읽습니다 (2026-10-03 고침)
   처음엔 파일 전체를 읽어서, 커뮤니티 전용 덮어쓰기
     html[data-surface="dark"] { --color-gray-500: #9BA3AB; … }
   까지 집어 「gray-600 이 gray-500 보다 밝다 · 눈금이 뒤집혔다」고 잘못
   보고했습니다. 그 값은 **어두운 구역에서만** 쓰는 것이고 밝은 모드는
   문서 값 그대로입니다. 블록을 가려 읽습니다. */
const 테마 = (() => {
  const i = css.indexOf('@theme');
  if (i < 0) return '';
  let 깊이 = 0; let j = css.indexOf('{', i);
  const 시작 = j;
  for (; j < css.length; j++) {
    if (css[j] === '{') 깊이++;
    else if (css[j] === '}') { 깊이--; if (!깊이) break; }
  }
  return css.slice(시작, j);
})();
if (!테마) { console.error('globals.css 에서 @theme 블록을 못 찾았습니다'); process.exit(1); }
const css값 = new Map();
for (const m of 테마.matchAll(/--(?:color|radius)-([a-z0-9-]+):\s*([^;]+);/g)) {
  css값.set(m[1], m[2].trim());
}
for (const m of 테마.matchAll(/--(space-[0-9]+):\s*([^;]+);/g)) css값.set(m[1], m[2].trim());

/* 일부러 POTJOB 색으로 바꾼 것 — globals.css 주석에 potjob_* 로 적혀 있습니다 */
const 일부러 = new Set(['gray-50', 'gray-900', 'gray-950', 'brand-red', 'brand-red-dark', 'danger']);

const 같나 = (a, b) => {
  const n = (s) => String(s).replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim();
  return n(a) === n(b);
};

console.log('teamsparta.md 토큰 ' + 문서값.size + '개 · globals.css ' + css값.size + '개\n');
const 없음 = []; const 다름 = []; let 맞음 = 0;
for (const [k, v] of 문서값) {
  if (!css값.has(k)) { 없음.push([k, v]); continue; }
  if (같나(v, css값.get(k))) 맞음++;
  else 다름.push([k, v, css값.get(k)]);
}
console.log('맞는 것 ' + 맞음 + '개');
const 뜻밖 = 다름.filter(([k]) => !일부러.has(k));
const 알고있는것 = 다름.filter(([k]) => 일부러.has(k));
if (알고있는것.length) {
  console.log('\n일부러 POTJOB 색으로 바꾼 것 ' + 알고있는것.length + '개 (globals.css 주석에 적혀 있습니다)');
  for (const [k, a, b] of 알고있는것) console.log('  ' + k.padEnd(18) + '문서 ' + a.padEnd(26) + '→ POTJOB ' + b);
}
if (뜻밖.length) {
  console.log('\n★ 까닭 없이 다른 것 ' + 뜻밖.length + '개 — 문서가 기준입니다');
  for (const [k, a, b] of 뜻밖) console.log('  ' + k.padEnd(18) + '문서 ' + a.padEnd(26) + 'css  ' + b);
} else console.log('\n까닭 없이 다른 것 없습니다');
if (없음.length) {
  console.log('\n문서에 있고 css 에 없는 것 ' + 없음.length + '개');
  for (const [k, v] of 없음) console.log('  ' + k.padEnd(22) + v);
} else console.log('문서에 있고 css 에 없는 것 없습니다');
process.exit(뜻밖.length ? 1 : 0);
