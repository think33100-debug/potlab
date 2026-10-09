/* 워크넷 상세 받기 — 일곱 칸을 **상세 API 에서** 뽑습니다. 읽기만 합니다.
 *
 *   node 워크넷상세받기.mjs --번호파일 번호.json --몇개 60 --낼곳 결과.json
 *
 * ★ 서버의 따로 폴더(~/potlab-kordoc-test)에서 돕니다. DB 를 안 건드립니다.
 *
 * ── 왜 (2026-10-10) ─────────────────────────────────────────
 *   보이는 공고 373건 중 303건(81%)이 워크넷인데 모집인원 0% · 지원자격 0%.
 *   수집기는 **목록(callTp=L)만** 쓰고 상세(callTp=D)를 한 번도 안 부릅니다.
 *   상세는 이걸 줍니다 (2026-10-10 원문 확인) —
 *     collectPsncnt  모집인원        certificate  자격·면허
 *     salTpNm        급여 말 그대로   receiptCloseDt  접수마감
 *     workRegion     근무지          jobCont · pfCond · etcPfCond · submitDoc …
 *
 * ── 조심 ────────────────────────────────────────────────────
 *   고용24 는 **하루 한도를 어디에도 안 밝힙니다** (collect-worknet.mjs 210줄).
 *   수집기가 하루 16회를 씁니다. 한도에 부딪히면 수집기가 멈추고 주기가
 *   하루 3회로 되돌아갑니다. 그래서 **--몇개 로 묶고 사이에 쉽니다.**
 *   응답에 x-ratelimit 머리말이 있으면 그대로 적습니다.
 */

import fs from 'node:fs';

const KEY = process.env.WORK_KEY;
if (!KEY) { console.error('WORK_KEY 가 없습니다.'); process.exit(2); }
const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const 직종 = ['306500', '306501', '306502'];
const 가리기 = (t) => String(t).split(KEY).join('‹열쇠›');
const 인수 = (이름, 기본) => {
  const i = process.argv.indexOf('--' + 이름);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 기본;
};
const 몇개 = Number(인수('몇개', 60));
const 쉼ms = Number(인수('쉼', 400));
const 낼곳 = 인수('낼곳', '워크넷상세결과.json');
const 번호파일 = 인수('번호파일', null);

const 주소 = (o) => URL_ + '?' + Object.entries({ authKey: KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));

let 한도말 = null;
async function 받기(u) {
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const lim = r.headers.get('x-ratelimit-limit');
  const rem = r.headers.get('x-ratelimit-remaining');
  if (lim || rem) 한도말 = `한도 ${lim ?? '?'} · 남음 ${rem ?? '?'}`;
  return { code: r.status, 글: await r.text() };
}

/* ── ① 목록 → 번호별 infoSvc ───────────────────────────── */
const 표 = new Map();
let 목록호출 = 0;
for (let 쪽 = 1; 쪽 <= 10; 쪽++) {
  const r = await 받기(주소({ callTp: 'L', startPage: 쪽, display: 100, occupation: 직종.join('|') }));
  목록호출++;
  if (!/<wantedRoot[\s>]/.test(r.글)) {
    console.error('목록이 이상합니다 — HTTP ' + r.code + ' · ' + 가리기(r.글).slice(0, 250).replace(/\s+/g, ' '));
    break;
  }
  const 줄 = r.글.split('<wanted>').slice(1);
  for (const x of 줄) {
    const no = (x.match(/<wantedAuthNo>([^<]*)</) || [])[1];
    const svc = (x.match(/<infoSvc>([^<]*)</) || [])[1];
    if (no) 표.set(no, svc ?? '');
  }
  if (줄.length < 100) break;
  await 쉼(쉼ms);
}
console.log(`① 목록 ${목록호출}회 · 지금 열린 워크넷 공고 ${표.size}건` + (한도말 ? ' · ' + 한도말 : ''));

/* ── ② 우리 공고 번호 ───────────────────────────────────── */
let 우리번호 = [];
if (번호파일 && fs.existsSync(번호파일)) {
  우리번호 = JSON.parse(fs.readFileSync(번호파일, 'utf8'));
} else {
  console.error('--번호파일 이 없습니다. 목록에 있는 것으로 대신합니다.');
  우리번호 = [...표.keys()].map((n) => ({ id: 'WN' + n, 번호: n }));
}
const 할것 = 우리번호.filter((x) => 표.has(x.번호));
const 목록에없음 = 우리번호.filter((x) => !표.has(x.번호));
console.log(`② 우리 워크넷 공고 ${우리번호.length}건 · 지금 목록에 있는 것 ${할것.length}건`
  + ` · 없는 것 ${목록에없음.length}건 (마감돼 목록에서 빠진 것)`);

/* ── ③ 상세 — 다섯 칸 뽑기 ─────────────────────────────── */
const 풀기 = (s) => String(s ?? '')
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&#xd;/gi, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .trim();

function 뽑기(글) {
  const 집 = (이름) => {
    const m = 글.match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
    return m ? 풀기(m[1]) : null;
  };
  const 값 = {};

  /* 모집인원 — 워크넷 공고는 **직종 하나**로 올라옵니다 (jobsNm 306500/1/2).
     그래서 collectPsncnt 가 **우리 직군 몫**입니다. 통합 공고가 아닙니다 */
  const n = 집('collectPsncnt');
  값.모집인원 = n && /^\d+$/.test(n) && Number(n) > 0
    ? { 값: n + '명', 출처: '상세API(collectPsncnt)',
        근거: `<collectPsncnt>${n}</collectPsncnt> · 직종 ${집('jobsNm') ?? ''}` }
    : (n ? { 값: n, 출처: '상세API(collectPsncnt)', 근거: `<collectPsncnt>${n}</collectPsncnt>` } : null);

  /* 접수마감 */
  const d = 집('receiptCloseDt');
  값.접수마감 = d && /^\d{8}$/.test(d)
    ? { 값: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`,
        출처: '상세API(receiptCloseDt)', 근거: `<receiptCloseDt>${d}</receiptCloseDt>` }
    : null;

  /* 근무지 */
  const w = 집('workRegion') || 집('corpAddr');
  값.근무지 = w
    ? { 값: w.replace(/^\(\d{5}\)\s*/, '').slice(0, 120),
        출처: 집('workRegion') ? '상세API(workRegion)' : '상세API(corpAddr)',
        근거: w.slice(0, 120) }
    : null;

  /* 지원자격 — 면허가 먼저, 없으면 우대조건·학력 */
  const c = 집('certificate'); const pf = 집('pfCond'); const epf = 집('etcPfCond');
  const edu = 집('eduNm'); const car = 집('enterTpNm');
  const 자격 = [c, pf, epf].filter(Boolean).join(' · ') || [edu, car].filter(Boolean).join(' · ');
  값.지원자격 = 자격
    ? { 값: 자격.slice(0, 200),
        출처: c ? '상세API(certificate)' : (pf || epf ? '상세API(pfCond)' : '상세API(eduNm)'),
        근거: (c ? `<certificate>${c}</certificate>` : `<eduNm>${edu}</eduNm>`).slice(0, 160) }
    : null;

  /* 예상 연봉 — **공고 말 그대로** 씁니다. 숫자를 만들지 않습니다 */
  const s = 집('salTpNm');
  값.예상연봉 = s
    ? { 값: s.replace(/,\s*$/, '').slice(0, 120), 출처: '상세API(salTpNm)',
        근거: `<salTpNm>${s}</salTpNm>` }
    : null;

  값.__덤 = {
    jobCont: (집('jobCont') ?? '').slice(0, 400),
    submitDoc: (집('submitDoc') ?? '').slice(0, 200),
    selMthd: (집('selMthd') ?? '').slice(0, 200),
    empTpNm: (집('empTpNm') ?? '').slice(0, 120),
    원문길이: 글.length,
  };
  return 값;
}

const 결과 = [];
const 탈 = [];
let 호출 = 0;
for (const x of 할것.slice(0, 몇개)) {
  const r = await 받기(주소({ callTp: 'D', wantedAuthNo: x.번호, infoSvc: 표.get(x.번호) }));
  호출++;
  if (r.code !== 200 || !/<wantedDtl[\s>]/.test(r.글)) {
    탈.push({ id: x.id, 번호: x.번호, HTTP: r.code, 앞: 가리기(r.글).slice(0, 200).replace(/\s+/g, ' ') });
    if (탈.length >= 5) { console.error('★ 연달아 실패 — 멈춥니다 (한도일 수 있습니다)'); break; }
  } else {
    결과.push({ id: x.id, 번호: x.번호, 값: 뽑기(r.글) });
  }
  if (호출 % 20 === 0) console.log(`   … ${호출}건` + (한도말 ? ' · ' + 한도말 : ''));
  await 쉼(쉼ms);
}

fs.writeFileSync(낼곳, JSON.stringify({
  잰때: new Date().toISOString(),
  목록호출, 상세호출: 호출, 한도말,
  열린공고: 표.size, 우리것: 우리번호.length, 목록에있음: 할것.length,
  목록에없음: 목록에없음.map((x) => x.id),
  결과, 탈,
}, null, 1) + '\n');

console.log(`\n③ 상세 ${호출}회 · 받은 것 ${결과.length}건 · 못 받은 것 ${탈.length}건`);
const 셈 = { 모집인원: 0, 접수마감: 0, 근무지: 0, 지원자격: 0, 예상연봉: 0 };
for (const r of 결과) for (const k of Object.keys(셈)) if (r.값[k]) 셈[k]++;
for (const [k, v] of Object.entries(셈)) {
  console.log('   ' + k.padEnd(8) + String(v).padStart(3) + '/' + 결과.length
    + ' (' + Math.round(v / (결과.length || 1) * 100) + '%)');
}
console.log('\n→ ' + 낼곳);
