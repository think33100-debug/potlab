/* 워크넷 상세 API 진단 — **응답 원문을 찍습니다** (작업지침 2절).
 *
 *   node 워크넷상세진단.mjs [공고번호 …]
 *
 * 왜 (2026-10-10)
 *   보이는 공고 373건 중 **303건(81%)이 워크넷**인데 모집인원 0% · 지원자격 0%
 *   입니다. 그런데 tools/collect-worknet.mjs 머리말에 이렇게 적혀 있습니다 —
 *     「상세  callTp=D + wantedAuthNo + infoSvc … jobCont · collectPsncnt …」
 *   **목록(callTp=L)만 쓰고 상세(callTp=D)를 한 번도 안 부릅니다.**
 *   작업지침 4절 — 「내가 이 API 의 기능을 전부 쓰고 있나」부터 묻습니다.
 *
 * ★ 이 파일은 **서버의 따로 폴더**(~/potlab-kordoc-test)에서 돕니다.
 *   ★ 처음에 「열쇠가 서버 IP 에만 등록돼 있다」고 봤는데 **틀렸습니다.**
 *   서버 .env 의 값이 **따옴표에 싸여** 있어서, ssh 로 읽을 때 따옴표가
 *   딸려 와 열쇠가 한 글자 길어진 것이었습니다 (36자 → 37자).
 *   벗기면 로컬에서도 됩니다. 읽을 때는 sed 로 따옴표를 벗기십시오.
 *
 * 아무것도 안 바꿉니다. 받아서 찍기만 합니다.
 */

import fs from 'node:fs';

const KEY = process.env.WORK_KEY;
if (!KEY) { console.error('WORK_KEY 가 없습니다 (고용24 authKey).'); process.exit(2); }
const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const 직종 = ['306500', '306501', '306502'];
const 가리기 = (t) => String(t).split(KEY).join('‹열쇠›');

const 주소 = (o) => URL_ + '?' + Object.entries({ authKey: KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

async function 받기(u) {
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  return { code: r.status, 글: await r.text() };
}

/* ── ① 목록 — 수집기와 **똑같은 호출** ──────────────────────
   목록에 wantedAuthNo 를 끼우면 「신청하신 OpenApi 서비스가 존재하지 않습니다」가
   옵니다. 그 변수는 목록이 안 받습니다 (2026-10-10 에 쏘아 보고 알았습니다) */
const 표 = new Map();           /* wantedAuthNo → infoSvc */
let 목록줄 = 0;
for (let 쪽 = 1; 쪽 <= 10; 쪽++) {
  const r = await 받기(주소({ callTp: 'L', startPage: 쪽, display: 100, occupation: 직종.join('|') }));
  if (쪽 === 1 && !/<wantedRoot[\s>]/.test(r.글)) {
    console.log('목록 응답이 wantedRoot 가 아닙니다 — HTTP ' + r.code + ' · 앞 300자');
    console.log(가리기(r.글).slice(0, 300).replace(/\s+/g, ' '));
    process.exit(1);
  }
  const 줄 = r.글.split('<wanted>').slice(1);
  목록줄 += 줄.length;
  for (const x of 줄) {
    const no = (x.match(/<wantedAuthNo>([^<]*)</) || [])[1];
    const svc = (x.match(/<infoSvc>([^<]*)</) || [])[1];
    if (no) 표.set(no, svc ?? '');
  }
  if (줄.length < 100) break;
}
console.log('① 목록 — 줄 ' + 목록줄 + ' · 번호→infoSvc 표 ' + 표.size + '개');
if (표.size) console.log('   본보기 ' + [...표.entries()].slice(0, 3).map(([a, b]) => a + ' → ' + b).join(' · '));

/* ── ② 상세 — 원문을 찍습니다 ──────────────────────────── */
let 번호들 = process.argv.slice(2).filter((x) => !x.startsWith('--'));
if (!번호들.length) 번호들 = [...표.keys()].slice(0, 3);

for (const 번호 of 번호들) {
  console.log('\n' + '━'.repeat(70));
  console.log('공고번호 ' + 번호);
  const svc = 표.get(번호);
  if (svc == null) { console.log('  목록에 이 번호가 없습니다 (이미 마감됐을 수 있습니다)'); continue; }
  console.log('  infoSvc = ' + svc);

  const r = await 받기(주소({ callTp: 'D', wantedAuthNo: 번호, infoSvc: svc }));
  console.log('  상세 HTTP ' + r.code + ' · ' + r.글.length + '자');
  console.log('\n  ── 응답 원문 앞 1200자 ──');
  console.log(가리기(r.글).slice(0, 1200).replace(/^/gm, '  '));

  const 이름들 = [...new Set([...r.글.matchAll(/<([A-Za-z][A-Za-z0-9_]*)>/g)].map((m) => m[1]))];
  console.log('\n  ── 항목 이름 ' + 이름들.length + '개 ──');
  console.log('  ' + 이름들.join(' · '));

  const 집 = (이름) => (r.글.match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'))
    || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? null;
  console.log('\n  ── 일곱 칸에 쓸 만한 것 ──');
  let 찾음 = 0;
  for (const k of 이름들) {
    if (!/psncnt|cont|qual|sal|close|emp|cert|major|region|addr|etc|note|career|edu/i.test(k)) continue;
    const v = 집(k);
    if (v) { 찾음++; console.log('    ' + k.padEnd(20) + String(v).replace(/\s+/g, ' ').slice(0, 150)); }
  }
  if (!찾음) console.log('    (쓸 만한 칸을 못 찾았습니다)');
}
console.log('\n' + '━'.repeat(70));
console.log('아무것도 안 바꿨습니다. 받아서 찍기만 했습니다.');
