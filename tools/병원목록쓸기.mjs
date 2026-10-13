/* 병원 목록 쪽을 **한 바퀴 쓸어** 제목과 「마감 표시」를 적어 둡니다
 * (2026-10-12 · 조사만 · 읽기만).
 *
 *   node tools/병원목록쓸기.mjs                     켜진 곳 전부
 *   node tools/병원목록쓸기.mjs 청주성모 고신대        이름에 그 말이 든 곳만
 *   node tools/병원목록쓸기.mjs --동시 4
 *
 *   → docs/시험_playwright_1012/C_목록쓸기.json
 *
 * ── ★ 먼저 바로잡은 것 ───────────────────────────────────────
 * 처음에는 `사이트줄()` 이 돌려주는 `raw` 를 원문으로 보고 상태말을 셌습니다.
 * **`raw` 는 HTML 이 아니라 진단용 짧은 글입니다** — 동래봉생이 「원문 16자」로
 * 나와서 알았습니다 (`전체 20건 중 접수중 20건`). 셈이 0 으로 나오는 게 당연했습니다.
 * 지침 2절 — 진단은 원문을 봐야 합니다. 대조군(동래봉생)을 먼저 돌려서 잡았습니다.
 *
 * 그리고 코드를 읽으니 **답이 이미 거기 있었습니다** (지침 6절) —
 * 다섯 갈래 중 **넷은 이미 상태를 읽어 마감을 버립니다.**
 *   appsite·listjson   receiptState 가 「접수중」 인 것만            (sites.mjs:101)
 *   cmc                recruitStatus ≠ '마감' · delYn ≠ 'Y'          (sites.mjs:140)
 *   schmc              isclosed ≠ '1'                               (sites.mjs:163)
 *   greeting           deploy ≠ false                               (sites.mjs:196)
 *   **html**           hospParseHtml → {title,url,from,to,posted} — **상태 없음**
 * `html` 이 261줄입니다 (sites.mjs:5). 거기만 못 읽습니다.
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 두 가지를 한 번에 재려고 만들었습니다.
 *   1번  「사이트에 있는데 우리 DB 에 없는 공고」를 **제목으로** 가립니다.
 *        어제는 링크 개수로만 봤는데, 개수는 메뉴·쪽넘김까지 세서 못 믿습니다
 *   3번  `html` 261곳 중 **목록 원문에 상태 표시가 있는 곳이 몇 곳인가** —
 *        읽으면 바로 쓸 수 있는 자리입니다
 *
 * 수집기와 **같은 함수**로 받습니다 — `사이트줄()` · `글받기()` · `hospParseHtml()`.
 * 따로 긁지 않습니다 (지침 6절 · 기준은 한 자리). 요청은 곳마다 한 번뿐입니다.
 *
 * **안 하는 것** — DB 쓰기 · `hosp_sites` 손대기 · `gas/wage.js` 손대기 ·
 * `tools/hosp/hosp-sites.json` 다시 굽기(`collect-hosp.mjs` 의 `사이트들()` 은
 * 그 파일을 **씁니다**. 그래서 그 함수를 안 부르고 직접 읽습니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';
import { 글받기 } from './certs/index.mjs';

const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hosp/hs_test.js');
const 기본머리 = { 'User-Agent': UA, 'Accept-Language': 'ko' };

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 낼곳 = path.join(여기, '..', 'docs', '시험_playwright_1012', 'C_목록쓸기.json');

const 인수 = process.argv.slice(2);
const 숫자 = (말, 기본) => {
  const i = 인수.indexOf(말);
  return i >= 0 ? Number(인수[i + 1]) : 기본;
};
const 동시 = 숫자('--동시', 4);
const 이름걸기 = 인수.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));

/* ── 설정 288줄 — **읽기만** 합니다 ─────────────────────────── */
function 사이트들읽기() {
  const gas = path.join(여기, '..', 'gas', 'wage.js');
  if (fs.existsSync(gas)) {
    const G = fs.readFileSync(gas, 'utf8');
    const i0 = G.indexOf('const HOSP_SITES = [');
    if (i0 < 0) throw new Error('gas 에서 HOSP_SITES 를 못 찾았습니다');
    let d = 0; let end = -1;
    for (let k = G.indexOf('[', i0); k < G.length; k++) {
      if (G[k] === '[') d++; else if (G[k] === ']' && --d === 0) { end = k + 1; break; }
    }
    return { 어디: 'gas/wage.js', S: new Function('return ' + G.slice(G.indexOf('[', i0), end))() };
  }
  const 구운것 = path.join(여기, 'hosp', 'hosp-sites.json');
  const j = JSON.parse(fs.readFileSync(구운것, 'utf8'));
  return { 어디: 'tools/hosp/hosp-sites.json (' + j.구운날 + ')', S: j.사이트 };
}

const { 어디, S } = 사이트들읽기();

/* 수집기가 **실제로 받는 곳**과 같은 조건으로 고릅니다 (collect-hosp.mjs 와 같은 규칙).
   `off` 는 구글 IP 때문에 꺼둔 것이라 node 에서는 받습니다 —
   「다른 경로로 들어옴」 이라고 적힌 곳만 건너뜁니다 */
const 볼것 = S.filter((s) => {
  if (이름걸기.length && !이름걸기.some((w) => String(s.name).includes(w))) return false;
  if (s.off && /알리오로 들어옴|클린아이로 들어옴/.test(String(s.off))) return false;
  if (!s.url && !s.host) return false;
  return true;
});

/* ── 「마감 표시」가 목록 원문에 있나 (`html` 갈래만) ───────────
 * 상태 낱말이 **제목 밖에서 2번 이상** 나오면 상태 칸이 있는 것으로 봅니다.
 * 한 번뿐이면 공고 제목 안의 말일 수 있어 「제목에만」 으로 가립니다. */
const 상태말 = [
  ['마감', /마감/g],
  ['종료', /종료/g],
  ['접수중', /접수\s*중/g],
  ['진행중', /진행\s*중/g],
  ['채용중', /채용\s*중/g],
  ['모집중', /모집\s*중/g],
  ['접수예정', /접수\s*(예정|대기)/g],
];
function 상태재기(html, 제목들) {
  const 글 = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const 제목글 = 제목들.join(' ');
  const 셈 = {};
  for (const [이름, re] of 상태말) {
    const 전체 = (글.match(re) || []).length;
    const 제목안 = (제목글.match(re) || []).length;
    if (전체) 셈[이름] = { 전체, 제목안, 제목밖: 전체 - 제목안 };
  }
  const 상태칸 = Object.entries(셈).filter(([, v]) => v.제목밖 >= 2).map(([k]) => k);
  const 제목에만 = Object.entries(셈).filter(([, v]) => v.제목안 > 0 && v.제목밖 < 2).map(([k]) => k);
  return { 셈, 상태칸, 제목에만 };
}

const 읽는법 = {
  appsite: 'receiptState 가 「접수중」 인 것만',
  listjson: 'receiptState 가 「접수중」 인 것만',
  cmc: 'recruitStatus ≠ 마감 · delYn ≠ Y',
  schmc: 'isclosed ≠ 1',
  greeting: 'deploy ≠ false',
};

console.log('목록 — ' + 어디);
console.log('켜진 곳 ' + 볼것.length + '곳 · 한 번에 ' + 동시 + '곳');
console.log('');

const 결과 = [];
let 끝낸수 = 0;
for (let i = 0; i < 볼것.length; i += 동시) {
  await Promise.all(볼것.slice(i, i + 동시).map(async (s) => {
    const 줄 = { 곳: s.name, 주소: s.url || s.host, 갈래: s.type || null, 꺼둠: s.off || null };
    try {
      let rows; let html = null; let 진단 = null;
      if (s.type === 'html') {
        /* `html` 갈래만 **직접** 받습니다 — 원문을 봐야 상태말을 셀 수 있습니다.
           sites.mjs 와 똑같은 함수를 씁니다. 요청은 한 번뿐입니다 */
        const g = await 글받기(s.url, { headers: 기본머리, enc: s.enc });
        if (g.왜) { 줄.왜 = '못 받음 · ' + g.왜; 결과.push(줄); return; }
        if (g.code !== 200 || (g.html || '').length < 300) {
          줄.왜 = 'HTTP ' + g.code + ' · ' + (g.html || '').length + '자'; 결과.push(줄); return;
        }
        html = g.html;
        try { rows = hospParseHtml(html, s); }
        catch (e) { 줄.왜 = '규칙이 깨졌습니다 · ' + String(e.message).slice(0, 80); 결과.push(줄); return; }
      } else {
        const g = await 사이트줄(s);
        if (g.err) { 줄.왜 = g.err; 결과.push(줄); return; }
        rows = g.rows || [];
        진단 = g.raw;
      }
      /* 수집기와 같은 걸러내기 */
      if (s.only) rows = rows.filter((r) => new RegExp(s.only).test(r.title));
      if (s.not) rows = rows.filter((r) => !new RegExp(s.not).test(r.title));
      const 제목들 = rows.map((r) => String(r.title || '').trim()).filter(Boolean);
      줄.줄수 = rows.length;
      줄.주소없는줄 = rows.filter((r) => r.title && !r.url).length;
      줄.제목들 = 제목들;
      줄.날짜있는줄 = rows.filter((r) => r.to || r.from || r.posted).length;
      if (html === null) {
        /* 넷은 이미 상태를 읽습니다 — 셈이 아니라 **그 사실**을 적습니다 */
        줄.상태읽나 = '이미 읽습니다 — ' + (읽는법[s.type] || s.type);
        줄.진단 = 진단;
        줄.상태칸 = []; 줄.제목에만 = []; 줄.셈 = {};
      } else {
        줄.상태읽나 = '안 읽습니다 — hospParseHtml 은 상태 칸을 안 돌려줍니다';
        줄.원문글자 = html.length;
        Object.assign(줄, 상태재기(html, 제목들));
      }
    } catch (e) {
      줄.왜 = '탈 ' + String(e.message || e).slice(0, 120);
    }
    결과.push(줄);
  }));
  끝낸수 += Math.min(동시, 볼것.length - i);
  if (끝낸수 % 40 < 동시) console.log('  … ' + 끝낸수 + '/' + 볼것.length);
  await new Promise((r) => setTimeout(r, 400));
}

fs.mkdirSync(path.dirname(낼곳), { recursive: true });
fs.writeFileSync(낼곳, JSON.stringify({ 어디, 센날: new Date().toISOString(), 곳수: 결과.length, 곳: 결과 }, null, 1));

/* ── 화면 ── */
const 받은곳 = 결과.filter((r) => !r.왜);
const 못받은곳 = 결과.filter((r) => r.왜);
console.log('');
console.log('받은 곳     ' + 받은곳.length);
console.log('못 받은 곳   ' + 못받은곳.length);
console.log('공고 줄 합   ' + 받은곳.reduce((a, r) => a + (r.줄수 || 0), 0));
console.log('줄 0 인 곳   ' + 받은곳.filter((r) => !r.줄수).length);
console.log('주소 없는 줄 ' + 받은곳.reduce((a, r) => a + (r.주소없는줄 || 0), 0) + '개');
console.log('');
const 이미읽는곳 = 받은곳.filter((r) => /이미 읽습니다/.test(String(r.상태읽나)));
const html곳 = 받은곳.filter((r) => !/이미 읽습니다/.test(String(r.상태읽나)));
console.log('── 3번 · 우리가 「마감」 을 읽고 있나 — 갈래로 갈립니다 ──');
console.log('  이미 읽는 곳   ' + 이미읽는곳.length + '곳   appsite·listjson·cmc·schmc·greeting');
console.log('  안 읽는 곳     ' + html곳.length + '곳   html (hospParseHtml)');
const 갈래셈 = {};
for (const r of 받은곳) 갈래셈[r.갈래 || '?'] = (갈래셈[r.갈래 || '?'] ?? 0) + 1;
console.log('  갈래별        ' + Object.entries(갈래셈).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(' · '));
console.log('');
const 상태칸있는곳 = html곳.filter((r) => (r.상태칸 || []).length);
console.log('── 안 읽는 ' + html곳.length + '곳 중, 목록 원문에 상태 표시가 **있는** 곳 ──');
console.log('  **' + 상태칸있는곳.length + '곳**  ← 읽으면 바로 쓸 수 있는 자리');
const 말셈 = {};
for (const r of 상태칸있는곳) for (const w of r.상태칸) 말셈[w] = (말셈[w] ?? 0) + 1;
for (const [k, n] of Object.entries(말셈).sort((a, b) => b[1] - a[1])) {
  console.log('     ' + String(n).padStart(4) + '곳  ' + k);
}
console.log('  (제목 안에만 그 말이 있는 곳 '
  + html곳.filter((r) => !(r.상태칸 || []).length && (r.제목에만 || []).length).length + '곳)');
console.log('');
console.log('── 상태 표시가 있는 곳 앞 14 ──');
for (const r of 상태칸있는곳.slice(0, 14)) {
  console.log('   ' + String(r.곳).slice(0, 24).padEnd(26) + '줄 ' + String(r.줄수).padStart(3)
    + ' · ' + r.상태칸.map((w) => w + '×' + r.셈[w].제목밖).join(' · '));
}
console.log('');
if (못받은곳.length) {
  console.log('── 못 받은 곳 ──');
  for (const r of 못받은곳.slice(0, 20)) {
    console.log('   ' + String(r.곳).slice(0, 24).padEnd(26) + String(r.왜).slice(0, 56));
  }
  if (못받은곳.length > 20) console.log('   … 그밖 ' + (못받은곳.length - 20) + '곳');
  console.log('');
}
console.log('→ ' + path.relative(path.join(여기, '..'), 낼곳));
console.log('DB·hosp_sites·gas/wage.js·hosp-sites.json 모두 안 건드렸습니다.');
