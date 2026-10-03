/* ═══════════════════════════════════════════════════════════════
 *  화면 색 검사 — 밝은 바탕에서 묻히는 글자를 잡습니다 (2026-10-03)
 * ═══════════════════════════════════════════════════════════════
 *   node tools/화면색검사.mjs
 *
 *  ── 왜 있나 ──────────────────────────────────────────────────
 *  2026-10-03 에 「커뮤니티만 어둡게」로 바꾸면서, 밝은 바탕에서
 *  `text-gray-400`(#A4A7B0)이 **2.18:1** 로 묻히는 것을 찾았습니다.
 *  203곳 중 141곳(맨 것)을 `text-mute`(#5F666C · 5.0:1)로 바꿨습니다.
 *  `dark:text-gray-400` 62곳은 **어두운 바탕에서 맞는 색**이라 남겼습니다.
 *
 *  teamsparta.md 는 gray-400 을 테두리·비활성용으로 둡니다.
 *  글자색으로 쓰면 다시 묻힙니다. 그래서 이 검사를 둡니다.
 *
 *  ── 무엇을 잡나 ──────────────────────────────────────────────
 *   ① 맨 `text-gray-400` (dark: 안 붙은 것)
 *   ② 밝은 바탕에서 쓰면 안 되는 연한 글자색 — gray-300 이하
 *   ③ teamsparta.md 에 없는 색을 화면에 직접 박은 것 (#rrggbb)
 *      → 이미 많이 쓰고 있어 **세는 것만** 합니다. 늘어나면 보입니다
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 볼곳 = [path.join(뿌리, 'web', 'app'), path.join(뿌리, 'web', 'components')];

const 파일들 = [];
const 훑기 = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') 훑기(p); }
    else if (/\.(tsx?|jsx?)$/.test(e.name)) 파일들.push(p);
  }
};
for (const d of 볼곳) if (fs.existsSync(d)) 훑기(d);

const 짧게 = (p) => path.relative(뿌리, p).replace(/\\/g, '/');
let 틀림 = 0;

/* ── ① 맨 text-gray-400 ── */
const 걸린것 = [];
for (const f of 파일들) {
  const 줄들 = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  줄들.forEach((l, i) => {
    for (const m of l.matchAll(/(?<!dark:)text-gray-400\b/g)) {
      걸린것.push(짧게(f) + ':' + (i + 1) + '  ' + l.trim().slice(0, 70));
    }
  });
}
if (걸린것.length) {
  틀림 += 걸린것.length;
  console.log('★ 밝은 바탕에서 묻히는 글자색 ' + 걸린것.length + '곳 — text-gray-400 (2.18:1)');
  console.log('   text-mute 로 바꾸십시오 (#5F666C · 5.0:1).');
  console.log('   어두운 바탕에서 쓰려면 dark:text-gray-400 으로 적으십시오.');
  for (const x of 걸린것.slice(0, 15)) console.log('   · ' + x);
  if (걸린것.length > 15) console.log('   … 그 밖에 ' + (걸린것.length - 15) + '곳');
} else {
  console.log('○ 맨 text-gray-400 없습니다 (밝은 바탕에서 묻히는 글자색)');
}

/* ── ② 더 연한 글자색 ──
   단, **어두운 카드 안**에서는 연한 글자가 맞습니다 (bg-gray-900/950 ·
   히어로의 어두운 구역). 그래서 그런 자리는 빼고 봅니다.
   가리는 법 — 같은 줄이나 바로 위 서른 줄 (감싸는 section 의 bg- 까지 보려고 넉넉히)에 어두운 바탕 표시가 있으면 넘깁니다. */
const 어두운바탕 = /bg-gray-9\d0|bg-surface-dark|bg-\[#(14181C|1B2025|0B0D0F)\]|text-white|어두운 (카드|구역|바탕)/;
const 더연한것 = [];
for (const f of 파일들) {
  const 줄들 = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  줄들.forEach((l, i) => {
    for (const m of l.matchAll(/(?<!dark:)text-gray-(50|100|200|300)\b/g)) {
      const 둘레 = 줄들.slice(Math.max(0, i - 30), i + 2).join(" ");
      if (어두운바탕.test(둘레)) continue;        // 어두운 바탕 위라면 맞는 색입니다
      더연한것.push(짧게(f) + ':' + (i + 1) + '  ' + m[0] + '  ' + l.trim().slice(0, 50));
    }
  });
}
if (더연한것.length) {
  틀림 += 더연한것.length;
  console.log('\n★ gray-400 보다 더 연한 글자색 ' + 더연한것.length + '곳 — 밝은 바탕에서 거의 안 보입니다');
  for (const x of 더연한것.slice(0, 10)) console.log('   · ' + x);
} else {
  console.log('○ gray-300 이하를 **밝은 바탕에서** 글자색으로 쓴 곳 없습니다');
}

/* ── ③ 화면에 직접 박은 색 (세기만) ── */
let 박은색 = 0;
const 박은파일 = new Map();
for (const f of 파일들) {
  const n = (fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{6}\b/g) || []).length;
  if (n) { 박은색 += n; 박은파일.set(짧게(f), n); }
}
const 많은곳 = [...박은파일].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('\n· 화면에 직접 박은 색 ' + 박은색 + '곳 / 파일 ' + 박은파일.size + '개 (세는 것만 — 늘어나면 보입니다)');
for (const [p, n] of 많은곳) console.log('   ' + String(n).padStart(4) + '  ' + p);

console.log('\n' + (틀림 ? '★ ' + 틀림 + '곳을 고쳐야 합니다' : '어긋난 곳 없습니다.'));
process.exit(틀림 ? 1 : 0);
