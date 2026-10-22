/* **들여오기(import)가 다 풀리나** 봅니다 (2026-10-22 밤 · 서버를 안 씁니다)
 *
 *   node tools/들여오기점검.mjs            tools/ 아래 전부
 *   node tools/들여오기점검.mjs --전부      web/ 까지
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 2026-10-22 밤에 규칙을 「한 자리」로 모으면서 파일 사이를 여러 번 옮겼습니다 —
 *   · 점수() 다섯 벌 → tools/hosp/hs_files.js
 *   · 서식말 두 벌 → hs_files 가 내놓고 묶음파일이 가져다 씀
 *   · 칸 대조 규칙 → tools/칸대조.mjs (긁기출처채점·신뢰셋표본이 가져다 씀)
 *   · 마감 지났나 → tools/마감지남.mjs (정리매시·보류함정리가 가져다 씀)
 * 들여오기를 하나라도 틀리면 **그 도구는 크론에서 죽습니다.** `node --check` 는
 * 문법만 보고 **들여오기는 안 봅니다** — 돌려 봐야 압니다. 그래서 그물을 겁니다.
 *
 * 보는 것 — 상대 경로 들여오기(`./`·`../`)가 **있는 파일을 가리키나**.
 *   꾸러미 이름(node:fs·undici 등)은 건너뜁니다.
 *   `import()` 안에 변수가 든 것은 셀 수 없으니 **따로 적습니다**.
 *
 * ★ 읽기만 합니다. 그물·DB 를 안 두드립니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 전부 = process.argv.includes('--전부');

const 볼폴더 = 전부 ? ['tools', 'web/lib', 'web/app'] : ['tools'];
const 코드꼴 = /\.(mjs|js|cjs)$/;

function 파일모으기(터) {
  const 모 = [];
  const 걷기 = (d) => {
    let 들;
    try { 들 = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of 들) {
      if (x.name === 'node_modules' || x.name.startsWith('.')) continue;
      const p = path.join(d, x.name);
      if (x.isDirectory()) 걷기(p);
      else if (코드꼴.test(x.name)) 모.push(p);
    }
  };
  걷기(path.join(뿌리, 터));
  return 모;
}

/* ★ 2026-10-22 — **주석을 먼저 떼어 냅니다.** 첫 판이 여덜 개를 「풀리지 않는다」고
   했는데 **여덜 다 거짓 경보**였습니다 —
     · 머리말의 「쓰는 법」 보기 (certs/index.mjs · hs_files.js · hs_목록상태.mjs)
     · 「전에는 이랬다」는 주석 (첨부담기 → collect-lib.mjs)
   재는 자를 먼저 의심하라는 그 지침(10-5)이 또 맞았습니다. */
const 주석떼기 = (글) => String(글)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ');

/* 아는 거짓 경보 — 까닭을 적어 둡니다 (그물이 0 을 내야 쓸모가 있습니다) */
const 아는거짓 = [
  ['tools/반영전마른실행.mjs', './공고문읽기_기준.mjs',
   '그 파일을 **이 도구가 만들어** 놓고 들여옵니다 (74줄에서 씁니다)'],
  ['tools/안쓰는도구.mjs', './b.mjs', '자기점검 보기 글자입니다'],
  ['tools/안쓰는도구.mjs', './c.js', '자기점검 보기 글자입니다'],
  ['tools/안쓰는도구.mjs', './d.mjs', '자기점검 보기 글자입니다'],
];
const 윈도우경로풀기 = (f) => String(f).split(path.sep).join('/');
const 거짓인가 = (f, x) => 아는거짓.some(([a, b]) => 윈도우경로풀기(f) === a && b === x);

/** 글에서 상대 경로 들여오기를 뽑습니다 (변수가 든 것은 따로) */
function 들여온것(글) {
  const 길 = []; const 모름 = [];
  const 꼴들 = [
    /\bimport\s+[^'"\n]*from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"\n]*from\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of 꼴들) {
    let m;
    while ((m = re.exec(글))) if (m[1].startsWith('.')) 길.push(m[1]);
  }
  /* 변수가 든 동적 들여오기 — 셀 수 없습니다 */
  let m2;
  const re2 = /\bimport\s*\(\s*(?!['"])([^)]{1,60})\)/g;
  while ((m2 = re2.exec(글))) 모름.push(m2[1].trim().slice(0, 40));
  return { 길, 모름 };
}

const 탈 = []; const 못본것 = [];
let 본파일 = 0; let 본들여오기 = 0;

for (const 터 of 볼폴더) {
  for (const f of 파일모으기(터)) {
    본파일++;
    let 글;
    try { 글 = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const { 길, 모름 } = 들여온것(주석떼기(글));
    for (const x of 모름) 못본것.push([path.relative(뿌리, f), x]);
    for (const 하나 of 길) {
      본들여오기++;
      const 바탕 = path.resolve(path.dirname(f), 하나);
      /* 확장자가 없으면 node 가 보는 꼴대로 몇 가지를 봅니다 */
      const 후보 = [바탕, 바탕 + '.mjs', 바탕 + '.js', 바탕 + '.cjs',
        path.join(바탕, 'index.mjs'), path.join(바탕, 'index.js')];
      if (!후보.some((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } })) {
        const 짧 = path.relative(뿌리, f);
        if (거짓인가(짧, 하나)) continue;
        탈.push([짧, 하나]);
      }
    }
  }
}

console.log('들여오기 점검 — 파일 ' + 본파일 + '개 · 상대 들여오기 ' + 본들여오기 + '개'
  + (전부 ? ' (tools + web)' : ' (tools 만 · --전부 로 web 까지)'));
if (탈.length) {
  console.log('\n██ 풀리지 않는 들여오기 ' + 탈.length + '개 ██');
  for (const [f, x] of 탈) console.log('  ✗ ' + f + '  →  ' + x);
} else {
  console.log('\n○ 다 풀립니다 — 없는 파일을 가리키는 들여오기가 없습니다');
}
if (못본것.length) {
  console.log('\n※ 변수가 든 동적 들여오기 ' + 못본것.length + '개 — 이 그물로는 못 봅니다');
  for (const [f, x] of 못본것.slice(0, 8)) console.log('    ' + f + '  →  import(' + x + ')');
}
process.exit(탈.length ? 1 : 0);
