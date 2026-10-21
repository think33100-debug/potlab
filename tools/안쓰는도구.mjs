/* **안 쓰는 도구 전수 조사** (2026-10-21 세중님 1번)
 *
 *   node tools/안쓰는도구.mjs                   표를 찍습니다
 *   node tools/안쓰는도구.mjs --크론 <파일>     크론 줄을 적은 파일 (기본 /tmp/크론.txt)
 *   node tools/안쓰는도구.mjs --자기점검
 *
 * ── 무엇을 하나 ───────────────────────────────────────────────
 * ① **운영 경로**를 세웁니다 — 크론 줄이 부르는 스크립트와 `~/*.sh` 가 부르는 것.
 * ② 그 자리에서 `import`·`require` 를 따라 **닿는 파일**을 전부 모읍니다.
 * ③ `tools/` 아래 파일 가운데 **안 닿는 것**을 냅니다.
 * ④ 닿는 파일이라도 **export 했는데 아무도 안 쓰는 함수**를 냅니다
 *    (지침 6절 — 「코드가 있어도 아무도 import 하지 않으면 없는 기능입니다」).
 *
 * ★ 그물·DB 를 안 두드립니다. 파일만 읽습니다.
 * ★ 갈래는 **짐작**입니다 — 이름·머리말로 가립니다. 마지막 판단은 사람이 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};

/** 글에서 들여오는 파일 이름을 뽑습니다 (상대 경로만) */
export function 들여온것(글) {
  const 나온것 = [];
  const 꼴들 = [
    /\bimport\s+[^'"]*from\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\bimport\s*['"](\.[^'"]+)['"]/g,
  ];
  for (const re of 꼴들) {
    let m;
    while ((m = re.exec(String(글 || '')))) 나온것.push(m[1]);
  }
  return [...new Set(나온것)];
}

/** 크론 줄에서 **부르는 스크립트**를 뽑습니다 */
export function 크론속스크립트(줄) {
  const 나온것 = [];
  const s = String(줄 || '');
  for (const m of s.matchAll(/(?:node|\/usr\/bin\/node)\s+([^\s;|&]+\.(?:mjs|js|cjs))/g)) 나온것.push(m[1]);
  for (const m of s.matchAll(/(~\/[A-Za-z가-힣_0-9.-]+\.sh)/g)) 나온것.push(m[1]);
  for (const m of s.matchAll(/(\/home\/[^\s;|&]+\.sh)/g)) 나온것.push(m[1]);
  return [...new Set(나온것)];
}

/** export 한 이름들 */
export function 내보낸이름(글) {
  const 나온것 = [];
  const s = String(글 || '');
  for (const m of s.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z가-힣_$][\w가-힣_$]*)/g)) 나온것.push(m[1]);
  for (const m of s.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z가-힣_$][\w가-힣_$]*)/g)) 나온것.push(m[1]);
  for (const m of s.matchAll(/module\.exports\s*=\s*\{([^}]*)\}/g)) {
    for (const t of m[1].split(',')) {
      const n = t.split(':')[0].trim();
      if (n && /^[A-Za-z가-힣_$][\w가-힣_$]*$/.test(n)) 나온것.push(n);
    }
  }
  return [...new Set(나온것)];
}

function 자기점검() {
  const 탈 = [];
  const 봐 = (말, 참) => { if (!참) 탈.push(말); };
  봐('import from 을 집는다', 들여온것("import { a } from './b.mjs';").includes('./b.mjs'));
  봐('require 를 집는다', 들여온것("const x = require('./c.js');").includes('./c.js'));
  봐('동적 import 를 집는다', 들여온것("await import('./d.mjs')").includes('./d.mjs'));
  봐('밖 꾸러미는 안 집는다', 들여온것("import fs from 'node:fs';").length === 0);
  봐('크론에서 node 스크립트', 크론속스크립트('cd /x && node tools/a.mjs --dry').includes('tools/a.mjs'));
  봐('크론에서 셸', 크론속스크립트('42 7 * * * /home/ubuntu/워크넷크론.sh').some((x) => x.endsWith('.sh')));
  봐('export function 을 집는다', 내보낸이름('export function 가가() {}').includes('가가'));
  봐('module.exports 를 집는다', 내보낸이름('module.exports = { aa, bb };').includes('bb'));
  for (const t of 탈) console.log('  ✗ ' + t);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 안쓰는도구 자기점검 통과 — 8가지') + ' (파일·그물을 안 읽었습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (argv.includes('--자기점검')) process.exit(0);

/* ── ① 운영 경로 세우기 ── */
const 크론파일 = 값('--크론', '/tmp/크론.txt');
let 크론줄 = [];
if (fs.existsSync(크론파일)) {
  크론줄 = fs.readFileSync(크론파일, 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
} else {
  console.log('(크론 파일이 없습니다 — ' + 크론파일 + ' · 셸 스크립트만 봅니다)');
}
const 입구 = new Set();
for (const l of 크론줄) for (const x of 크론속스크립트(l)) 입구.add(x);
/* 셸 스크립트 안에서 부르는 node 파일도 입구입니다 */
const 셸들 = [...입구].filter((x) => x.endsWith('.sh'));
for (const sh of 셸들) {
  const p2 = sh.replace(/^~/, process.env.HOME || '');
  if (!fs.existsSync(p2)) { console.log('  (셸을 못 찾음 — ' + sh + ')'); continue; }
  for (const x of 크론속스크립트(fs.readFileSync(p2, 'utf8'))) 입구.add(x);
}
const 입구파일 = [...입구].filter((x) => /\.(mjs|js|cjs)$/.test(x))
  .map((x) => path.resolve(뿌리, x)).filter((x) => fs.existsSync(x));

/* GitHub 워크플로도 운영 경로입니다 */
const wf = path.join(뿌리, '.github', 'workflows');
if (fs.existsSync(wf)) {
  for (const f of fs.readdirSync(wf)) {
    const 글 = fs.readFileSync(path.join(wf, f), 'utf8');
    for (const x of 크론속스크립트(글)) {
      const p3 = path.resolve(뿌리, x);
      if (fs.existsSync(p3) && /\.(mjs|js|cjs)$/.test(p3)) 입구파일.push(p3);
    }
  }
}

/* ── ② 닿는 파일 모으기 ── */
const 닿음 = new Set();
const 볼것 = [...new Set(입구파일)];
while (볼것.length) {
  const f = 볼것.pop();
  if (닿음.has(f)) continue;
  닿음.add(f);
  let 글 = '';
  try { 글 = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const rel of 들여온것(글)) {
    for (const 꼬리 of ['', '.mjs', '.js', '.cjs', '/index.mjs', '/index.js']) {
      const p4 = path.resolve(path.dirname(f), rel + 꼬리);
      if (fs.existsSync(p4) && fs.statSync(p4).isFile()) { 볼것.push(p4); break; }
    }
  }
}

/* ── ③ tools/ 아래 안 닿는 파일 ── */
const 모든파일 = [];
(function 훑기(d) {
  for (const n of fs.readdirSync(d)) {
    if (['node_modules', '.git', 'reports', 'batches', '원문', '원문2', '원문형식'].includes(n)) continue;
    const p5 = path.join(d, n);
    const st = fs.statSync(p5);
    if (st.isDirectory()) 훑기(p5);
    else if (/\.(mjs|js|cjs)$/.test(n)) 모든파일.push(p5);
  }
})(여기);

/* 어디서 이름이 쓰이나 — 모든 파일의 글을 한 번만 읽어 둡니다 */
const 글들 = new Map();
for (const f of 모든파일) { try { 글들.set(f, fs.readFileSync(f, 'utf8')); } catch { /* 넘어갑니다 */ } }

const 상대 = (f) => path.relative(뿌리, f).replace(/\\/g, '/');
const 안닿음 = 모든파일.filter((f) => !닿음.has(f));

/** 갈래 가리기 — 이름·머리말로 (짐작입니다) */
export function 갈래가리기(f, 글) {
  const n = path.basename(f);
  const 머리 = String(글 || '').slice(0, 700);
  if (/자기점검|시험|test|점검|견주기|진단|보기|찍기|셈$/.test(n) || /자기\s*점검만|시험용/.test(머리)) return '시험용';
  if (/되돌리기|_1\d{3}\.|옛|낡은|한번만|되돌림/.test(n)) return '한 번 쓰고 끝난 것 — 버릴 것';
  if (/모으기|뽑기|받기|읽기|채우기|되메우기|고치기|바로잡기|넣기|길|주소/.test(n)) return '붙이면 값 낼 것';
  return '봐야 알 것';
}

console.log('\n운영 입구 ' + 입구파일.length + '개 → 닿는 파일 ' + 닿음.size + '개');
console.log('tools/ 아래 파일 ' + 모든파일.length + '개 · **안 닿는 것 ' + 안닿음.length + '개**\n');

console.log('══ 운영에서 안 닿는 파일 ══');
const 묶음 = new Map();
for (const f of 안닿음) {
  const g = 갈래가리기(f, 글들.get(f));
  if (!묶음.has(g)) 묶음.set(g, []);
  묶음.get(g).push(f);
}
for (const [g, 들] of [...묶음].sort((a, b) => b[1].length - a[1].length)) {
  console.log('\n── ' + g + ' (' + 들.length + '개)');
  for (const f of 들.sort()) {
    const 글 = 글들.get(f) || '';
    const 첫줄 = (글.split('\n').find((l) => /[가-힣]/.test(l)) || '').replace(/^[\s/*]+/, '').slice(0, 58);
    /* 다른 파일이 이 파일을 들여오나 (운영 밖에서라도) */
    const 쓰는곳 = 모든파일.filter((o) => o !== f
      && 들여온것(글들.get(o) || '').some((r) => path.resolve(path.dirname(o), r).replace(/\.(mjs|js|cjs)$/, '')
        === f.replace(/\.(mjs|js|cjs)$/, '')));
    console.log('  ' + 상대(f).padEnd(42) + (쓰는곳.length ? '← ' + 쓰는곳.length + '곳이 씀 ' : '← 아무도 안 씀 ')
      + '· ' + 첫줄);
  }
}

/* ── ④ 닿는 파일인데 아무도 안 쓰는 export ── */
console.log('\n══ 닿는 파일인데 **아무도 안 쓰는 export** ══');
let 안쓰는export = 0;
for (const f of [...닿음].filter((f) => 모든파일.includes(f)).sort()) {
  const 글 = 글들.get(f) || fs.readFileSync(f, 'utf8');
  const 이름들 = 내보낸이름(글);
  if (!이름들.length) continue;
  const 안쓰는것 = 이름들.filter((n) => {
    for (const [o, g] of 글들) {
      if (o === f) continue;
      if (new RegExp('[^\\w가-힣]' + n.replace(/[$]/g, '\\$') + '[^\\w가-힣]').test(g)) return false;
    }
    return true;
  });
  if (안쓰는것.length) {
    안쓰는export += 안쓰는것.length;
    console.log('  ' + 상대(f).padEnd(42) + 안쓰는것.join(' · ').slice(0, 90));
  }
}
console.log('  — 모두 ' + 안쓰는export + '개 (제 파일 안에서만 쓰거나, 아예 안 쓰는 것)');
console.log('\n★ 갈래는 **짐작**입니다 — 마지막 판단은 사람이 합니다. 그물·DB 를 안 두드렸습니다.');
