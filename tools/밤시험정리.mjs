/* 밤시험 결과를 **표 하나**로 모읍니다 (2026-10-12 아침 보고용).
 *
 *   node tools/밤시험정리.mjs
 *   → docs/시험_playwright_1012/정리.md
 *
 * 읽기만 합니다. DB 를 안 건드립니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');

const 읽기 = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const 두겹 = (p) => {
  try {
    const s = fs.readFileSync(p, 'utf8').trim();
    try { return JSON.parse(JSON.parse(s)); } catch { return JSON.parse(s); }
  } catch { return null; }
};

/* ── A번 ── */
const A코드 = ['gangjin', 'ccmc', 'daejain', 'dcmc', 'kosin', 'smc', 'knuh', 'bohun', 'bjhosp', 'rchin'];
const A = [];
for (const c of A코드) {
  const j = 두겹(path.join(폴더, 'A_결과_' + c + '.json'));
  if (!j || !j.이름) { A.push({ 코드: c, 못함: true }); continue; }
  A.push(j);
}

/* ── B번 ── */
const B = 읽기(path.join(폴더, 'B_42곳판정.json')) || [];

const 줄 = [];
const ㄱ = (s) => 줄.push(s);

ㄱ('# 밤시험 결과 — playwright-cli (2026-10-12)');
ㄱ('');
ㄱ('`playwright-cli 0.1.22` · 세중님 PC · headless Chrome · 요청 사이 3초 ·');
ㄱ('한 곳당 목록 1쪽 + 상세 최대 3개 · 로그인·양식·올리기 없음 · **DB 안 건드림**');
ㄱ('');
ㄱ('---');
ㄱ('');

/* ═══ A ═══ */
ㄱ('## A. 지금 읽고 있는 10곳 — 브라우저로 읽으면 더 정확해지나');
ㄱ('');
ㄱ('| 곳 | 갈래 | 왜 골랐나 | 목록 글자 b/f | 공고링크 b/f | 상세 | 접수말 b/f | 첨부 b/f | 결론 | 스크린샷 |');
ㄱ('|---|---|---|---|---|---|---|---|---|---|');
for (const a of A) {
  if (a.못함) { ㄱ('| `' + a.코드 + '` | — | — | — | — | — | — | — | **못 받음** | — |'); continue; }
  const c = a.셈 || {};
  const 사진 = a.스크린샷 ? '`A_' + (a.코드 || '') + '.png`' : '—';
  ㄱ('| ' + a.이름 + ' | ' + a.갈래 + ' | ' + a.왜고름
    + ' | ' + (a.브라우저_글자 ?? '-') + '/' + (a.fetch_글자 ?? '-')
    + ' | ' + (a.브라우저_공고링크 ?? '-') + '/' + (a.fetch_공고링크 ?? '-')
    + ' | ' + (a.상세 || []).length
    + ' | ' + (c.브라우저_접수말 ?? '-') + '/' + (c.fetch_접수말 ?? '-')
    + ' | ' + (c.브라우저_첨부 ?? '-') + '/' + (c.fetch_첨부 ?? '-')
    + ' | ' + (a.결론 || a.막힘 || '?')
    + ' | ' + 사진 + ' |');
}
ㄱ('');
ㄱ('`b` = 브라우저(playwright) · `f` = fetch(지금 수집기가 받는 방식)');
ㄱ('');

/* 견본 원문 */
ㄱ('### 견본 — 원문 ↔ 뽑힌 값 (접수기간 줄)');
ㄱ('');
for (const a of A) {
  if (a.못함 || !(a.상세 || []).length) continue;
  const 쓸것 = (a.상세 || []).filter((d) => d.브라우저_접수줄 || d.fetch_접수줄).slice(0, 2);
  if (!쓸것.length) continue;
  ㄱ('**' + a.이름 + '**');
  ㄱ('');
  for (const d of 쓸것) {
    ㄱ('- `' + String(d.제목).slice(0, 46) + '`');
    if (d.브라우저_접수줄) ㄱ('  - 브라우저 — ' + String(d.브라우저_접수줄).slice(0, 150));
    if (d.fetch_접수줄) ㄱ('  - fetch — ' + String(d.fetch_접수줄).slice(0, 150));
    if (d.브라우저_접수줄 && d.fetch_접수줄 && d.브라우저_접수줄 === d.fetch_접수줄) ㄱ('  - **똑같습니다**');
  }
  ㄱ('');
}

/* 대화창 */
const 대화 = A.filter((a) => !a.못함 && a.대화창);
if (대화.length) {
  ㄱ('### 대화창(alert)을 띄우는 곳');
  ㄱ('');
  for (const a of 대화) ㄱ('- ' + a.이름 + ' — ' + a.대화창.join(' / '));
  ㄱ('');
  ㄱ('> 이 대화창을 안 닫으면 **그 뒤 모든 명령이 막힙니다** (`modal state`).');
  ㄱ('> 10곳 중 6곳이 그렇게 막혀 두 번 다시 돌렸습니다. 정기 점검을 만들면');
  ㄱ('> `page.on(\'dialog\')` 로 닫고 **끝에 빈 쪽으로 옮기는 것**을 꼭 넣어야 합니다.');
  ㄱ('');
}

/* ═══ B ═══ */
ㄱ('---');
ㄱ('');
ㄱ('## B. 꺼 둔 병원 — **실제로 꺼진 것은 42곳**입니다');
ㄱ('');
ㄱ('> ⚠ 먼저 바로잡을 것 — 세중님이 말씀하신 「47곳」은 **DB 표 `hosp_sites.off_why`** 의 수입니다.');
ㄱ('> 그런데 **수집기는 그 표를 안 봅니다.** `collect-hosp.mjs:118 사이트들()` 이');
ㄱ('> `gas/wage.js` 의 `HOSP_SITES` (또는 구워 둔 `tools/hosp/hosp-sites.json`)를 씁니다.');
ㄱ('> 거기서 `off: true` 인 곳이 **42곳**입니다. `off_why` 칸을 읽는 코드는');
ㄱ('> 저장소 전체에 **없습니다** (`tools/copy_jobs.js` 의 옛 시트 복사뿐).');
ㄱ('');
const 갈래셈 = {};
for (const b of B) { const k = b.꺼둔까닭 + ' → ' + b.지금; 갈래셈[k] = (갈래셈[k] ?? 0) + 1; }
ㄱ('### 꺼 둔 까닭 × 지금 (서울 서버에서 다시 받아 봄)');
ㄱ('');
ㄱ('| 꺼 둔 까닭 | 지금 | 곳수 |');
ㄱ('|---|---|---|');
for (const [k, n] of Object.entries(갈래셈).sort((a, b2) => b2[1] - a[1])) {
  const [까닭, 지금] = k.split(' → ');
  ㄱ('| ' + 까닭 + ' | ' + 지금 + ' | **' + n + '** |');
}
ㄱ('');
ㄱ('### 곳마다 — 판정');
ㄱ('');
ㄱ('| 곳 | 꺼 둔 까닭 | 지금 | 글자 | 판정 | 주소 |');
ㄱ('|---|---|---|---|---|---|');
for (const b of B.slice().sort((x, y) => (x.지금 === y.지금 ? 0 : x.지금 === '열림' ? -1 : 1))) {
  const 판정 = b.꺼둔까닭 === '다른 출처로 이미 들어옴' ? '그대로 둠 — 중복'
    : b.지금 === '열림' ? '**fetch 로 충분 — 다시 켤 수 있습니다**'
      : b.꺼둔까닭 === '주소 못 찾음' ? '새 주소로 교체 (주소부터)'
        : '아직 막힘 — 브라우저도 안 될 수 있음 (차단은 IP 기준)';
  ㄱ('| ' + b.곳 + ' | ' + b.꺼둔까닭 + ' | ' + b.지금
    + ' | ' + (b.글자 ?? '-') + ' | ' + 판정
    + ' | `' + String(b.주소 || '').slice(0, 44) + '` |');
}
ㄱ('');

fs.writeFileSync(path.join(폴더, '정리.md'), 줄.join('\n') + '\n');
console.log('○ docs/시험_playwright_1012/정리.md');
console.log('  A ' + A.filter((a) => !a.못함).length + '/10 · B ' + B.length + '곳');
