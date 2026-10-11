/* 병원 목록 쪽을 **한 바퀴 쓸어** 제목과 「마감 표시」를 적어 둡니다
 * (2026-10-12 · 조사만 · 읽기만).
 *
 *   node tools/병원목록쓸기.mjs                     켜진 곳 전부
 *   node tools/병원목록쓸기.mjs 청주성모 고신대        이름에 그 말이 든 곳만
 *   node tools/병원목록쓸기.mjs --동시 4
 *
 *   → docs/시험_playwright_1012/C_목록쓸기.json
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 두 가지를 한 번에 재려고 만들었습니다.
 *   1번  「사이트에 있는데 우리 DB 에 없는 공고」를 **제목으로** 가립니다.
 *        어제는 링크 개수로만 봤는데, 개수는 메뉴·쪽넘김까지 세서 못 믿습니다
 *   3번  목록 쪽에 「마감 · 종료 · 진행중 · 접수중」 표시를 하는 곳이 몇 곳인가.
 *        **지금 수집기는 그 표시를 안 읽습니다** — `사이트줄()` 이 돌려주는 줄은
 *        `{title, url, from, to, posted}` 뿐이고 상태 칸이 없습니다
 *
 * 수집기와 **같은 길**로 받습니다 — `tools/hosp/sites.mjs` 의 `사이트줄()`.
 * 따로 긁지 않습니다 (지침 6절 · 기준은 한 자리).
 *
 * **안 하는 것** — DB 쓰기 · `hosp_sites` 손대기 · `gas/wage.js` 손대기 ·
 * `tools/hosp/hosp-sites.json` 다시 굽기(`collect-hosp.mjs` 의 `사이트들()` 은
 * 그 파일을 **씁니다**. 그래서 여기서는 그 함수를 안 부르고 직접 읽습니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';

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

/* 수집기가 **실제로 받는 곳**과 같은 조건으로 고릅니다.
   `off` 는 구글 IP 때문에 꺼둔 것이라 node 에서는 받습니다 —
   「다른 경로로 들어옴」 이라고 적힌 곳만 건너뜁니다 (collect-hosp.mjs 와 같은 규칙) */
const 볼것 = S.filter((s) => {
  if (이름걸기.length && !이름걸기.some((w) => String(s.name).includes(w))) return false;
  if (s.off && /알리오로 들어옴|클린아이로 들어옴/.test(String(s.off))) return false;
  if (!s.url && !s.host) return false;
  return true;
});

/* ── 「마감 표시」를 하는 곳인가 ───────────────────────────────
 * 목록 원문에 상태 낱말이 **여러 번** 나오면 상태 칸이 있는 것으로 봅니다.
 * 한 번뿐이면 공고 제목 안의 말일 수 있어 「제목에만」 으로 가립니다. */
const 상태말 = [
  ['마감', /마감/g],
  ['종료', /종료/g],
  ['접수중', /접수\s*중/g],
  ['진행중', /진행\s*중/g],
  ['채용중', /채용\s*중/g],
  ['모집중', /모집\s*중/g],
  ['대기', /접수\s*(예정|대기)/g],
];
function 상태재기(raw, 제목들) {
  const 글 = String(raw || '')
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
  /* 제목 밖에서 2번 이상 나오는 낱말이 있으면 **상태 칸이 있는 것**으로 봅니다 */
  const 칸있나 = Object.entries(셈).filter(([, v]) => v.제목밖 >= 2).map(([k]) => k);
  const 제목에만 = Object.entries(셈).filter(([, v]) => v.제목안 > 0 && v.제목밖 < 2).map(([k]) => k);
  return { 셈, 상태칸: 칸있나, 제목에만 };
}

console.log('목록 — ' + 어디);
console.log('켜진 곳 ' + 볼것.length + '곳 · 한 번에 ' + 동시 + '곳');
console.log('');

const 결과 = [];
let 끝낸수 = 0;
for (let i = 0; i < 볼것.length; i += 동시) {
  await Promise.all(볼것.slice(i, i + 동시).map(async (s) => {
    const 줄 = { 곳: s.name, 주소: s.url || s.host, 갈래: s.type || null, 꺼둠: s.off || null };
    try {
      const g = await 사이트줄(s);
      if (g.err) { 줄.왜 = g.err; 결과.push(줄); return; }
      let rows = g.rows || [];
      /* 수집기와 같은 걸러내기 */
      if (s.only) rows = rows.filter((r) => new RegExp(s.only).test(r.title));
      if (s.not) rows = rows.filter((r) => !new RegExp(s.not).test(r.title));
      const 제목들 = rows.map((r) => String(r.title || '').trim()).filter(Boolean);
      줄.줄수 = rows.length;
      줄.주소없는줄 = rows.filter((r) => r.title && !r.url).length;
      줄.원문글자 = String(g.raw || '').length;
      줄.제목들 = 제목들;
      줄.날짜있는줄 = rows.filter((r) => r.to || r.from || r.posted).length;
      Object.assign(줄, 상태재기(g.raw, 제목들));
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
console.log('');
const 상태칸있는곳 = 받은곳.filter((r) => (r.상태칸 || []).length);
console.log('── 3번 · 목록에 「마감·진행」 상태 칸이 있는 곳 ──');
console.log('  **' + 상태칸있는곳.length + '곳** / 받은 ' + 받은곳.length + '곳');
const 말셈 = {};
for (const r of 상태칸있는곳) for (const w of r.상태칸) 말셈[w] = (말셈[w] ?? 0) + 1;
for (const [k, n] of Object.entries(말셈).sort((a, b) => b[1] - a[1])) {
  console.log('     ' + String(n).padStart(4) + '곳  ' + k);
}
console.log('  (제목 안에만 그 말이 있는 곳 '
  + 받은곳.filter((r) => !(r.상태칸 || []).length && (r.제목에만 || []).length).length + '곳)');
console.log('');
console.log('→ ' + path.relative(path.join(여기, '..'), 낼곳));
console.log('DB·hosp_sites·gas/wage.js·hosp-sites.json 모두 안 건드렸습니다.');
