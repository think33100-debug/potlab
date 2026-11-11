/* RAPO 디자인 토큰 만들기 (2026-11-11)

   Figma 「RAPO 디자인 프로젝트」의 현행 토큰을 CSS 로 옮깁니다.
   원본은 design-tokens/figma/ 의 글 파일들입니다 — Figma 에서 읽은 그대로이고,
   읽을 때 Figma 쪽에서 낸 해시를 아래 HASH 에 적어 두었습니다.
   손으로 옮겨 적다 틀린 글자가 있으면 해시가 안 맞아 여기서 멈춥니다.

     node tools/rapo-tokens.mjs           app/rapo-tokens.css 와 대응표를 새로 씁니다
     node tools/rapo-tokens.mjs --check   새로 만든 것과 저장된 것이 같은지만 봅니다

   대상 (지침 4절) — RAPO · 브랜드 기준 · RAPO / Color palette · Color roles ·
   Dimensions · Typography 다섯 컬렉션 전부 + RAPO/Type/* 글자 스타일 + RAPO/Shadow/*.
   Archive · Wireframe review · 교육 · 프로토타입 상태는 넣지 않습니다
   (홈이 기대는 것은 대응표 끝 「빠진 컬렉션 의존」에 따로 적습니다).

   기존 화면은 안 바뀝니다 — 이름이 전부 --rapo- 로 시작하고 Tailwind @theme 에
   넣지 않습니다. 쓰는 쪽은 bg-(--rapo-…) 처럼 이름을 직접 부릅니다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 웹 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 원본 = path.join(웹, 'design-tokens', 'figma');
const 출력CSS = path.join(웹, 'app', 'rapo-tokens.css');
const 출력표 = path.join(웹, '..', 'docs', 'rapo-design', '토큰대응표.md');

/* Figma 에서 읽은 시각 — 2026-11-11 오후 (KST) · use_figma 읽기 전용.
   해시는 Figma 스크립트가 같은 줄들을 '\n' 으로 이어 djb2 로 낸 값입니다 */
const HASH = { 'vars_a.tsv': 2183991770, 'vars_b.tsv': 123827831, 'vars_c.tsv': 1216148681 };
const HASH_STYLE = { 'text_styles.tsv': 1351222609, 'effect_styles.tsv': 4281016458, 'codesyntax_web.txt': 354619319 };
const 기대개수 = { 변수: 305, 글자: 45, 그림자: 3 };

const djb2 = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
const 읽기 = (f) => fs.readFileSync(path.join(원본, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');

const 틀림 = [];
for (const [f, h] of Object.entries(HASH_STYLE)) if (djb2(읽기(f)) !== h) 틀림.push(`${f} 해시 ${djb2(읽기(f))} ≠ Figma ${h}`);
const 변수 = new Map();
for (const f of Object.keys(HASH)) {
  const 글 = 읽기(f);
  const h = djb2(글);
  if (h !== HASH[f]) 틀림.push(`${f} 해시 ${h} ≠ Figma ${HASH[f]}`);
  for (const 줄 of 글.split('\n')) {
    const [컬렉션, id, 이름, 타입, 값, 범위 = ''] = 줄.split('\t');
    변수.set(id, { 컬렉션, id, 이름, 타입, 값, 범위: 범위.split(',').filter(Boolean) });
  }
}

/* CSS 이름 — Figma 의 WEB code syntax 를 그대로 씁니다.
   브랜드 기준 14개만 code syntax 가 비어 있어 규칙으로 짓습니다 (한글은 ASCII 로) */
const 문법 = new Map(읽기('codesyntax_web.txt').split(/\s+/).map((x) => {
  const i = x.indexOf('=');
  return ['VariableID:' + x.slice(0, i), x.slice(i + 1)];
}));
const 브랜드이름 = (이름) => '--rapo-brand-' + 이름.replace(/^색상\//, 'color-').replace(/^간격\//, 'space-');
for (const v of 변수.values()) {
  const w = 문법.get(v.id);
  if (w === undefined) 틀림.push(`${v.id} code syntax 없음`);
  if (w && w !== '∅') v.css = w.replace(/^var\((--[^)]+)\)$/, '$1');
  else if (v.컬렉션 === 'RAPO · 브랜드 기준') v.css = 브랜드이름(v.이름);
  else 틀림.push(`${v.id} ${v.이름} CSS 이름을 못 지음`);
}

/* 값 — 별칭은 var() 로 남겨 관계를 보존합니다. 숫자는 쓰임새로 단위를 붙입니다 */
const 색 = (s) => {
  const m = s.match(/^#([0-9A-F]{6})(?:@([0-9.]+))?$/);
  if (!m) return null;
  if (m[2] === undefined) return '#' + m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${m[2]})`;
};
const 단위 = (v, n) => (v.범위.includes('FONT_WEIGHT') ? String(n) : `${n}px`);
for (const v of 변수.values()) {
  if (v.값.startsWith('->')) {
    const 대상 = 변수.get(v.값.slice(2));
    if (!대상) { 틀림.push(`${v.이름} 별칭 대상 ${v.값} 이 현행 컬렉션에 없음`); continue; }
    v.별칭 = 대상; continue;
  }
  if (v.타입 === 'COLOR') v.cssValue = 색(v.값);
  else if (v.타입 === 'FLOAT') v.cssValue = 단위(v, Number(v.값));
  else if (v.타입 === 'STRING') v.cssValue = v.값;
  if (v.cssValue == null) 틀림.push(`${v.이름} 값 ${v.값} 을 못 읽음`);
}
for (const v of 변수.values()) if (v.별칭) v.cssValue = `var(${v.별칭.css})`;

/* 순환·끝값 — 별칭을 끝까지 따라가 실제 값을 표에 적습니다 */
const 끝값 = (v, 본 = new Set()) => {
  if (본.has(v.id)) { 틀림.push(`순환 별칭 ${[...본].join(' → ')}`); return '?'; }
  본.add(v.id);
  return v.별칭 ? 끝값(v.별칭, 본) : v.cssValue;
};
const 이름겹침 = new Map();
for (const v of 변수.values()) 이름겹침.set(v.css, (이름겹침.get(v.css) || 0) + 1);
for (const [n, c] of 이름겹침) if (c > 1) 틀림.push(`CSS 이름 겹침 ${n} ×${c}`);
if (변수.size !== 기대개수.변수) 틀림.push(`변수 ${변수.size}개 ≠ ${기대개수.변수}`);

/* 글자 스타일 — 서체·굵기·크기·행간·자간을 함께 옮깁니다.
   크기·행간이 변수에 묶인 것은 변수로, 안 묶인 셋(screen-title 등)은 값으로 */
const 굵기 = { Regular: 'regular', Medium: 'medium', Bold: 'bold' };
const 글자 = 읽기('text_styles.tsv').split('\n').map((줄) => {
  const [id, 이름, 서체, 모양, 크기, 행간, 자간, 대소, 장식, 묶음] = 줄.split('\t');
  const 묶인 = Object.fromEntries((묶음 || '').split(',').filter(Boolean).map((x) => x.split('=')));
  const 변수로 = (k, 값) => {
    if (!묶인[k]) return 값;
    const v = 변수.get(묶인[k]);
    if (!v) { 틀림.push(`${이름} 의 ${k} 묶음 ${묶인[k]} 없음`); return 값; }
    if (끝값(v) !== 값) 틀림.push(`${이름} ${k} 값 ${값} ≠ 변수 ${끝값(v)}`);
    return `var(${v.css})`;
  };
  if (서체 !== 'Pretendard') 틀림.push(`${이름} 서체 ${서체}`);
  if (대소 !== 'ORIGINAL' || 장식 !== 'NONE') 틀림.push(`${이름} 대소문자·장식 ${대소}/${장식} — 옮기는 규칙 없음`);
  if (!굵기[모양]) 틀림.push(`${이름} 굵기 ${모양}`);
  const 클래스 = 'rapo-type-' + 이름.replace(/^RAPO\/Type\//, '').toLowerCase().replace(/[\/\s]+/g, '-');
  return {
    id, 이름, 클래스,
    크기: 변수로('fontSize', `${크기}px`),
    행간: 변수로('lineHeight', 행간),
    자간: 자간 === '0px' || 자간 === '0%' ? '0' : 자간.replace('%', 'em'),
    굵기: `var(--rapo-font-weight-${굵기[모양]})`,
  };
});
if (글자.length !== 기대개수.글자) 틀림.push(`글자 스타일 ${글자.length}개 ≠ ${기대개수.글자}`);

const 그림자 = 읽기('effect_styles.tsv').split('\n').map((줄) => {
  const [id, 이름, 효과] = 줄.split('\t');
  const m = 효과.match(/^DROP_SHADOW true (\S+) (\S+) (\S+) (\S+) (#\S+) NORMAL \{\}$/);
  if (!m) { 틀림.push(`${이름} 효과를 못 읽음: ${효과}`); return null; }
  const [, x, y, 흐림, 번짐, c] = m;
  return { id, 이름, css: '--rapo-shadow-' + 이름.split('/').pop(), 값: `${x}px ${y}px ${흐림}px ${번짐}px ${색(c)}` };
}).filter(Boolean);
if (그림자.length !== 기대개수.그림자) 틀림.push(`그림자 ${그림자.length}개 ≠ ${기대개수.그림자}`);

if (틀림.length) {
  console.error('멈춤 — 원본과 맞지 않습니다\n  ' + 틀림.join('\n  '));
  process.exit(1);
}

/* ── CSS ── */
const 컬렉션차례 = ['RAPO · 브랜드 기준', 'RAPO / Color palette', 'RAPO / Color roles', 'RAPO / Dimensions', 'RAPO / Typography'];
let css = `/* 자동으로 만든 파일입니다 — 손으로 고치지 마세요.
   만드는 법: cd web && node tools/rapo-tokens.mjs
   원본: Figma 「RAPO 디자인 프로젝트」 현행 토큰 (design-tokens/figma/, 2026-11-11 읽음)
   변수 ${변수.size} · 글자 스타일 ${글자.length} · 그림자 ${그림자.length}

   기존 화면에는 영향이 없습니다 — 이름이 모두 --rapo- 로 시작하고 Tailwind @theme 밖입니다.
   글꼴: Figma 는 "Pretendard", 웹은 globals.css 가 받는 "Pretendard Variable" 입니다.
   그래서 글자 스타일은 var(--rapo-font-family) 뒤에 var(--font-sans) 를 이어 둡니다. */
:root {
`;
for (const 컬 of 컬렉션차례) {
  css += `  /* ── ${컬} ── */\n`;
  for (const v of 변수.values()) if (v.컬렉션 === 컬) css += `  ${v.css}: ${v.cssValue};\n`;
}
css += `  /* ── RAPO/Shadow (효과 스타일) ── */\n`;
for (const s of 그림자) css += `  ${s.css}: ${s.값};\n`;
css += `}\n\n/* ── RAPO/Type (글자 스타일) ── */\n@layer components {\n`;
for (const t of 글자) {
  css += `  .${t.클래스} {\n    font-family: var(--rapo-font-family), var(--font-sans);\n    font-weight: ${t.굵기};\n    font-size: ${t.크기};\n    line-height: ${t.행간};\n    letter-spacing: ${t.자간};\n  }\n`;
}
css += `}\n`;

/* ── 대응표 ── */
const 칸 = (s) => String(s).replace(/\|/g, '\\|');
let 표 = `# RAPO 토큰 대응표 (자동 생성 · 손으로 고치지 마세요)

만드는 법 \`cd web && node tools/rapo-tokens.mjs\` · 원본 \`web/design-tokens/figma/\` · Figma 읽은 때 2026-11-11 오후(KST)
코드 위치 \`web/app/rapo-tokens.css\` (globals.css 가 불러옵니다)

| 묶음 | 개수 |
|---|---|
${컬렉션차례.map((c) => `| ${c} | ${[...변수.values()].filter((v) => v.컬렉션 === c).length} |`).join('\n')}
| RAPO/Type 글자 스타일 | ${글자.length} |
| RAPO/Shadow 효과 스타일 | ${그림자.length} |

모든 컬렉션은 모드가 하나입니다(Mode 1 · Value · Light). 어두운 모드는 만들지 않았습니다(지침 4절).

## 변수

| Figma ID | 컬렉션 | Figma 이름 | 타입 | Figma 값(별칭) | CSS 이름 | CSS 값 | 끝값 |
|---|---|---|---|---|---|---|---|
`;
for (const v of 변수.values()) {
  표 += `| ${v.id.replace('VariableID:', '')} | ${칸(v.컬렉션)} | ${칸(v.이름)} | ${v.타입} | ${칸(v.별칭 ? '→ ' + v.별칭.이름 : v.값)} | \`${v.css}\` | \`${칸(v.cssValue)}\` | \`${칸(끝값(v))}\` |\n`;
}
표 += `\n## 글자 스타일\n\n| Figma ID | Figma 이름 | CSS 클래스 | 굵기 | 크기 | 행간 | 자간 |\n|---|---|---|---|---|---|---|\n`;
for (const t of 글자) 표 += `| ${t.id} | ${t.이름} | \`.${t.클래스}\` | \`${t.굵기}\` | \`${t.크기}\` | \`${t.행간}\` | ${t.자간} |\n`;
표 += `\n## 그림자\n\n| Figma ID | Figma 이름 | CSS 이름 | 값 |\n|---|---|---|---|\n`;
for (const s of 그림자) 표 += `| ${s.id} | ${s.이름} | \`${s.css}\` | \`${s.값}\` |\n`;

if (process.argv.includes('--check')) {
  const 같나 = (f, s) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') === s;
  const ok = 같나(출력CSS, css) && 같나(출력표, 표);
  console.log(ok ? `같음 — 변수 ${변수.size} · 글자 ${글자.length} · 그림자 ${그림자.length} · 해시 6/6` : '다름 — node tools/rapo-tokens.mjs 로 다시 만드세요');
  process.exit(ok ? 0 : 1);
}
fs.mkdirSync(path.dirname(출력표), { recursive: true });
fs.writeFileSync(출력CSS, css);
fs.writeFileSync(출력표, 표);
console.log(`썼습니다 — 변수 ${변수.size} · 글자 ${글자.length} · 그림자 ${그림자.length} · 해시 6/6 맞음`);
