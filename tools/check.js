/* 화면(app.js METHODS)과 서버(Wage.gs API 표)가 어긋났는지 봅니다.
 *
 *   node tools/check.js
 *
 * 2026-09-17 에 adminDropRules·adminDropRun·adminDropRuleSet 이
 * 서버 API 표에는 있는데 app.js METHODS 에 빠져 있어
 * 「버림 규칙」 화면이 통째로 안 열렸습니다. 그 사고를 잡는 도구입니다.
 *
 * gas/wage.js 는 저장소에 안 올라갑니다(.gitignore). 없으면 그 대조는 건너뜁니다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const problems = [];

/* ── app.js 의 METHODS 목록 ── */
const appSrc = read('app.js');
const mBlock = appSrc.match(/var METHODS = \[([\s\S]*?)\];/);
if (!mBlock) {
  problems.push('app.js 에서 METHODS 목록을 못 찾았습니다');
}
const methods = mBlock
  ? (mBlock[1].replace(/\/\*[\s\S]*?\*\//g, '').match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1))
  : [];

/* 같은 이름이 두 번 들어간 것 (2026-09-17 adminOrgList 가 그랬습니다) */
const seen = Object.create(null);
methods.forEach((m) => {
  if (seen[m]) problems.push('app.js METHODS 에 ' + m + ' 이(가) 두 번 있습니다');
  seen[m] = true;
});

/* ── 서버 API 표 ── */
let api = null;
try {
  const wage = read('gas/wage.js');
  const block = wage.match(/const API = \{([\s\S]*?)\n\};/);
  if (!block) problems.push('gas/wage.js 에서 API 표를 못 찾았습니다');
  else {
    api = (block[1].replace(/\/\*[\s\S]*?\*\//g, '').match(/^\s*([A-Za-z_]\w*)\s*:/gm) || [])
      .map((s) => s.trim().replace(/:$/, ''));

    /* 표에 적힌 함수가 실제로 있는지 */
    api.forEach((name) => {
      if (!new RegExp('function\\s+' + name + '\\s*\\(').test(wage))
        problems.push('API 표의 ' + name + ' · gas/wage.js 에 그런 함수가 없습니다');
    });
  }
} catch (e) {
  console.log('· gas/wage.js 가 없어 서버 대조는 건너뜁니다 (' + e.code + ')');
}

/* ── 양쪽 대조 ── */
if (api) {
  methods.forEach((m) => {
    if (api.indexOf(m) < 0)
      problems.push('app.js 가 부르는 ' + m + ' 이(가) 서버 API 표에 없습니다 → 「알 수 없는 요청입니다」');
  });
  /* 서버에만 있는 것은 사고가 아니라 「화면에서 아직 안 쓰는 것」 일 수 있어 알림만 합니다 */
  const onlyServer = api.filter((a) => methods.indexOf(a) < 0);
  if (onlyServer.length)
    console.log('· 서버에만 있는 이름 ' + onlyServer.length + '개 (화면에서 부르려면 METHODS 에 넣어야 합니다)\n  '
      + onlyServer.join(' · '));
}

/* ── 화면이 app.js 를 어느 판으로 부르는지 ── */
const ver = (appSrc.match(/var APP_JS_VER = '([^']+)'/) || [])[1] || '?';
['index.html', 'admin.html'].forEach((f) => {
  const tag = (read(f).match(/app\.js\?v=(\d+)/) || [])[1];
  if (!tag) problems.push(f + ' 에 app.js 를 부르는 줄이 없습니다');
  else console.log('· ' + f + ' → app.js?v=' + tag + ' (다리 ' + ver + ')');
});

/* ── 갈래 규칙이 두 벌로 갈라지지 않았나 (2026-09-28) ──────────
   gas 의 갈래 규칙은 tools/sort-rule.mjs 에서 **구워 넣은** 것입니다.
   누가 gas 쪽을 손으로 고치면 두 벌이 됩니다 — 2026-09-28 에 제목 940건 중
   550건(58%)이 갈라져 있던 것을 찾았습니다. 여기서 매번 봅니다. */
try {
  const out = require('child_process').execFileSync(
    process.execPath, [path.join(__dirname, 'sort-rule-to-gas.mjs'), '--검사'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('· ' + String(out).trim().split('\n')[0]);
} catch (e) {
  const 말 = String((e.stdout || '') + (e.stderr || '')).trim().split('\n');
  problems.push('gas 의 갈래 규칙이 tools/sort-rule.mjs 와 다릅니다 — '
    + 'node tools/sort-rule-to-gas.mjs 를 돌려 다시 구우세요'
    + (말[0] ? ' (' + 말[0].replace(/^✗\s*/, '') + ')' : ''));
}

/* ── 결과 ── */
console.log('· METHODS ' + methods.length + '개' + (api ? ' · API 표 ' + api.length + '개' : ''));
/* ── 화면 색 (2026-10-03) ──────────────────────────────────────
   밝은 바탕에서 묻히는 글자색을 잡습니다. 자세한 것은 tools/화면색검사.mjs.
   「커뮤니티만 어둡게」로 바꾸면서 text-gray-400 이 2.18:1 로 묻혔습니다.
   dark: 가 붙은 것은 어두운 바탕에서 맞는 색이라 안 잡습니다. */
try {
  const { execFileSync } = require("child_process");
  execFileSync(process.execPath, [require("path").join(__dirname, "화면색검사.mjs")],
    { stdio: "inherit" });
} catch (e) {
  problems.push("화면 색 — 밝은 바탕에서 묻히는 글자색이 있습니다 (위 ★ 를 보십시오)");
}

if (!problems.length) {
  console.log('\n어긋난 곳 없습니다.');
} else {
  console.log('\n어긋난 곳 ' + problems.length + '개');
  problems.forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}
