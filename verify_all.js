/* ============================================================
 * verify_all.js — 고친 뒤 빠진 게 없는지 대조합니다
 * ------------------------------------------------------------
 * 문법이 멀쩡해도 함수나 CSS 가 통째로 날아가면 앱이 죽습니다.
 * 예전에 정규식으로 블록을 지우다가 loading() errBox() densBlock() 이
 * 사라진 적이 있어서 만든 검사입니다.
 *
 * 쓰는 법:  node verify_all.js            (기준: /tmp/index_old.html)
 *          node verify_all.js 기준파일
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const OLD = process.argv[2] || '/tmp/index_old.html';
const NEW = path.join(ROOT, 'pages', 'index.html');
const FORM = path.join(ROOT, 'WageForm.html');
const GS = path.join(ROOT, 'Wage.gs');
const APPJS = path.join(ROOT, 'pages', 'app.js');

let fail = 0, warn = 0;
function ok(m) { console.log('  ok   ' + m); }
function bad(m) { console.log('  FAIL ' + m); fail++; }
function note(m) { console.log('  주의 ' + m); warn++; }

const read = p => fs.readFileSync(p, 'utf8');

/* ---------- 1. 함수가 사라지지 않았는지 ---------- */
console.log('\n[1] 화면 함수 대조');
function fnNames(src) {
  const s = new Set();
  for (const m of src.matchAll(/function\s+([A-Za-z_]\w*)\s*\(/g)) s.add(m[1]);
  for (const m of src.matchAll(/(?:var|let|const)\s+([A-Za-z_]\w*)\s*=\s*function\s*\(/g)) s.add(m[1]);
  return s;
}
const newFn = fnNames(read(NEW));
console.log('  현재 화면 함수 ' + newFn.size + '개');

if (fs.existsSync(OLD)) {
  const oldFn = fnNames(read(OLD));
  const gone = [...oldFn].filter(n => !newFn.has(n));
  const added = [...newFn].filter(n => !oldFn.has(n));
  if (gone.length) bad('사라진 함수 ' + gone.length + '개: ' + gone.join(' '));
  else ok('사라진 함수 없음 (기준 ' + oldFn.size + '개)');
  if (added.length) note('새로 생긴 함수: ' + added.join(' '));
} else {
  note('기준 파일이 없어 건너뜁니다: ' + OLD);
}

/* 과거에 날아간 적 있는 함수는 이름으로 못박아 확인합니다 */
console.log('\n[2] 과거 사고 함수 확인');
['loading', 'errBox', 'densBlock'].forEach(n => {
  newFn.has(n) ? ok(n + '() 있음') : bad(n + '() 없음 — 예전에 날아갔던 함수입니다');
});

/* ---------- 3. 부르는 함수가 실제로 있는지 ---------- */
console.log('\n[3] 화면이 부르는 함수가 정의돼 있는지');
const newSrc = read(NEW);
const called = new Set();
for (const m of newSrc.matchAll(/\b([a-z][A-Za-z0-9_]*)\s*\(/g)) called.add(m[1]);
const builtin = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
  'parseInt', 'parseFloat', 'isNaN', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'alert', 'confirm', 'prompt', 'encodeURIComponent', 'decodeURIComponent', 'require', 'fetch',
  'nextTick', 'then', 'catch', 'map', 'filter', 'forEach', 'reduce', 'join', 'split', 'slice',
  'push', 'pop', 'shift', 'sort', 'indexOf', 'replace', 'trim', 'toFixed', 'test', 'match',
  'querySelector', 'querySelectorAll', 'getElementById', 'addEventListener', 'concat', 'includes',
  'toLowerCase', 'toUpperCase', 'keys', 'values', 'entries', 'stringify', 'parse', 'apply', 'call',
  'bind', 'find', 'some', 'every', 'reverse', 'charAt', 'substring', 'substr', 'padStart', 'repeat',
  'appendChild', 'removeChild', 'createElement', 'setAttribute', 'getAttribute', 'focus', 'blur',
  'preventDefault', 'stopPropagation', 'scrollTo', 'scrollIntoView', 'toString', 'valueOf',
  'now', 'random', 'round', 'floor', 'ceil', 'min', 'max', 'abs', 'pow', 'sqrt', 'log', 'error',
  'warn', 'from', 'isArray', 'assign', 'freeze', 'open', 'close', 'send', 'catch', 'finally',
  'localeCompare', 'toLocaleString', 'getTime', 'getFullYear', 'getMonth', 'getDate', 'flat',
  'startsWith', 'endsWith', 'lastIndexOf', 'splice', 'unshift', 'fill', 'add', 'has', 'delete',
  'get', 'set', 'clear', 'matchAll', 'trimStart', 'trimEnd', 'toISOString', 'setHours']);
const gsFn = new Set([...read(GS).matchAll(/^function\s+([A-Za-z_]\w*)/gm)].map(m => m[1]));
const missing = [...called].filter(n =>
  !newFn.has(n) && !builtin.has(n) && !gsFn.has(n) && n.length > 2);
if (missing.length > 25) note('확인 못한 이름 ' + missing.length + '개 (대부분 내장 함수)');
else if (missing.length) note('정의를 못 찾은 이름: ' + missing.join(' '));
else ok('모두 정의돼 있음');

/* ---------- 4. id 가 CSS·JS 와 맞는지 ---------- */
console.log('\n[4] id 대조');
const ids = new Set([...newSrc.matchAll(/\bid="([A-Za-z][\w-]*)"/g)].map(m => m[1]));
const used = new Set([...newSrc.matchAll(/getElementById\(\s*'([\w-]+)'/g)].map(m => m[1]));
for (const m of newSrc.matchAll(/getElementById\(\s*"([\w-]+)"/g)) used.add(m[1]);
const noId = [...used].filter(n => !ids.has(n));
console.log('  HTML id ' + ids.size + '개 / JS 가 찾는 id ' + used.size + '개');
if (noId.length) note('HTML 에 없는 id 를 찾습니다: ' + noId.join(' ') + '  (동적으로 만들면 정상)');
else ok('모두 존재');

/* ---------- 5. CSS 클래스 ---------- */
console.log('\n[5] CSS 대조');
const styleBlocks = [...newSrc.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const cssCls = new Set([...styleBlocks.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
console.log('  CSS 클래스 ' + cssCls.size + '개 / <style> 블록 ' +
  (newSrc.match(/<style>/g) || []).length + '개');
if (fs.existsSync(OLD)) {
  const oldCss = new Set([...read(OLD).matchAll(/<style>([\s\S]*?)<\/style>/g)]
    .map(m => m[1]).join('\n').matchAll(/\.([a-zA-Z][\w-]*)/g)).size;
  const oldSet = new Set([...[...read(OLD).matchAll(/<style>([\s\S]*?)<\/style>/g)]
    .map(m => m[1]).join('\n').matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const cssGone = [...oldSet].filter(c => !cssCls.has(c));
  if (cssGone.length) bad('사라진 CSS 클래스: ' + cssGone.join(' '));
  else ok('사라진 CSS 클래스 없음');
}

/* ---------- 6. 서버 API ↔ app.js ↔ 화면 ---------- */
console.log('\n[6] 서버 함수 연결');
const apiBlock = read(GS).match(/const API\s*=\s*\{([\s\S]*?)\n\};/);
const api = new Set([...apiBlock[1].matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)].map(m => m[1]));
const mBlock = read(APPJS).match(/var METHODS\s*=\s*\[([\s\S]*?)\];/);
const methods = new Set([...mBlock[1].matchAll(/'([A-Za-z_]\w*)'/g)].map(m => m[1]));

function chainCalls(src) {
  const found = new Set();
  let i = 0;
  while ((i = src.indexOf('google.script.run', i)) !== -1) {
    let p = i + 17;
    for (;;) {
      while (p < src.length && /\s/.test(src[p])) p++;
      if (src[p] !== '.') break;
      p++;
      const m = /^([A-Za-z_]\w*)/.exec(src.slice(p));
      if (!m) break;
      const name = m[1];
      p += name.length;
      while (p < src.length && /\s/.test(src[p])) p++;
      const isHandler = name === 'withSuccessHandler' || name === 'withFailureHandler';
      if (src[p] !== '(') { if (!isHandler) found.add(name); break; }
      let depth = 0, q = null;
      for (; p < src.length; p++) {
        const c = src[p];
        if (q) { if (c === '\\') { p++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; continue; }
        if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) { p++; break; } }
      }
      if (!isHandler) { found.add(name); break; }
    }
    i += 17;
  }
  return found;
}
const uiCalls = new Set();
['pages/index.html', 'pages/admin.html', 'WageForm.html', 'WageAdmin.html']
  .forEach(f => chainCalls(read(path.join(ROOT, f))).forEach(n => uiCalls.add(n)));

console.log('  서버 API ' + api.size + ' / app.js METHODS ' + methods.size +
  ' / 화면 호출 ' + uiCalls.size);
const notInGs = [...uiCalls].filter(n => !api.has(n));
const notInApp = [...uiCalls].filter(n => !methods.has(n));
notInGs.length ? bad('Wage.gs API 에 없는 함수를 부릅니다: ' + notInGs.join(' '))
               : ok('부르는 함수가 모두 서버에 있음');
notInApp.length ? bad('app.js METHODS 에 빠졌습니다: ' + notInApp.join(' '))
                : ok('app.js 다리가 모두 연결됨');

/* ---------- 7. 버전 ---------- */
console.log('\n[7] 버전');
const formVer = read(FORM).match(/var APP_VER\s*=\s*'([^']+)'/)[1];
const idxVer = newSrc.match(/var APP_VER\s*=\s*'([^']+)'/)[1];
const idxTag = newSrc.match(/app\.js\?v=(\d+)/)[1];
const admTag = read(path.join(ROOT, 'pages', 'admin.html')).match(/app\.js\?v=(\d+)/)[1];
const srvVer = read(GS).match(/SERVER_VER\s*=\s*'([^']+)'/)[1];
console.log('  WageForm ' + formVer + ' / index ' + idxVer);
console.log('  index app.js?v=' + idxTag + ' / admin app.js?v=' + admTag);
console.log('  Wage.gs SERVER_VER ' + srvVer);
formVer === idxVer ? ok('원본과 빌드 버전 일치') : bad('버전 불일치');
idxTag === admTag ? ok('index·admin 캐시 번호 일치') : bad('캐시 번호 불일치');
if (formVer.replace(/^v/, '').split(' ')[0] !== idxTag) bad('APP_VER 과 app.js?v= 가 다릅니다');
else ok('APP_VER 과 app.js?v= 일치');
if (srvVer !== formVer) note('서버 버전이 화면과 다릅니다 — Wage.gs 를 올리고 재배포해야 합니다');

/* ---------- 8. 문법 ---------- */
console.log('\n[8] 스크립트 문법');
const scripts = [...newSrc.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synErr = 0;
scripts.forEach((s, i) => {
  try { new Function(s); } catch (e) { bad('script #' + (i + 1) + ' 문법 오류: ' + e.message); synErr++; }
});
if (!synErr) ok(scripts.length + '개 블록 모두 통과');
try { new Function(read(APPJS)); ok('app.js 통과'); } catch (e) { bad('app.js 문법 오류: ' + e.message); }

/* ---------- 결과 ---------- */
console.log('\n' + '='.repeat(46));
console.log(fail ? '실패 ' + fail + '건 · 주의 ' + warn + '건' : '통과 · 주의 ' + warn + '건');
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
