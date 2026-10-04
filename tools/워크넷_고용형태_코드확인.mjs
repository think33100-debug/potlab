/* 워크넷 고용형태 코드 ↔ 이름을 **응답 원문으로** 확인합니다 (2026-10-05).
 *
 *  왜 — job_posts 에 employ_type 이 `10`·`20`·`21` 로 남은 줄이 있습니다.
 *  푸는 표가 collect-worknet.mjs 안에 있는데, 그게 맞는지 **주석 말고
 *  응답으로** 확인하고 고쳐야 합니다 (작업지침 2·3번).
 *
 *  무엇을 하나
 *    ① 목록(callTp=L)으로 공고를 받아 empTpCd 가 서로 다른 것을 고릅니다
 *    ② 각각 상세(callTp=D)를 열어 **empTpNm 원문**을 찍습니다
 *    ③ 응답 원문 1,000자와 칸 이름 목록을 함께 찍습니다
 *
 *  ⚷ 열쇠는 찍지 않습니다 — 주소와 응답에서 ‹열쇠›로 가립니다.
 *  ⚷ 읽기만 합니다. DB 에 아무것도 안 씁니다.
 *
 *  쓰는 법   node tools/워크넷_고용형태_코드확인.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env')),
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...process.env,
};

const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const 직종 = ['306500', '306501', '306502'];

if (!cfg.WORK_KEY) { console.error('WORK_KEY 가 없습니다'); process.exit(1); }
const 가리기 = (t) => String(t).split(cfg.WORK_KEY).join('‹열쇠›');
const 주소 = (o) => URL_ + '?' + Object.entries({ authKey: cfg.WORK_KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

const 받기 = async (u) => {
  const r = await fetch(u, { headers: { 'User-Agent': 'potjob-diag/1.0' } });
  return { code: r.status, 글: await r.text() };
};
/* 아주 작은 XML 꺼내기 — 한 태그의 첫 값만 */
const 값 = (xml, 태그) => {
  const m = xml.match(new RegExp('<' + 태그 + '>([\\s\\S]*?)</' + 태그 + '>'));
  return m ? m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim() : '';
};
const 조각들 = (xml, 태그) => {
  const out = [];
  const re = new RegExp('<' + 태그 + '>([\\s\\S]*?)</' + 태그 + '>', 'g');
  let m; while ((m = re.exec(xml))) out.push(m[1]);
  return out;
};

console.log('워크넷 고용형태 코드 확인 · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('  열쇠 ' + cfg.WORK_KEY.length + '자 (값은 안 찍습니다)');

/* ── ① 목록 ──────────────────────────────────────────────── */
const 목록주소 = 주소({ callTp: 'L', startPage: 1, display: 100, occupation: 직종.join('|') });
console.log('\n① 목록 주소 — ' + 가리기(목록주소));
const L = await 받기(목록주소);
console.log('   HTTP ' + L.code + ' · ' + L.글.length + '자');
console.log('\n── 목록 응답 원문 앞 1,000자 ──');
console.log(가리기(L.글).slice(0, 1000));

const 줄들 = 조각들(L.글, 'wanted');
console.log('\n   공고 ' + 줄들.length + '건');
if (줄들[0]) {
  const 칸 = [...줄들[0].matchAll(/<([a-zA-Z][a-zA-Z0-9]*)>/g)].map((m) => m[1]);
  console.log('   목록 칸 이름 — ' + [...new Set(칸)].join(' · '));
}

/* ── ② empTpCd 가 서로 다른 것 고르기 ────────────────────── */
const 본코드 = new Map();
for (const w of 줄들) {
  const cd = 값(w, 'empTpCd');
  if (!cd || 본코드.has(cd)) continue;
  본코드.set(cd, { 번호: 값(w, 'wantedAuthNo'), 출처: 값(w, 'infoSvc'), 제목: 값(w, 'title') });
}
console.log('\n② 목록에 나온 empTpCd — ' + [...본코드.keys()].join(' · '));

/* ── ③ 코드마다 상세를 열어 empTpNm 원문 ─────────────────── */
console.log('\n③ 코드마다 상세(callTp=D)에서 empTpNm 을 읽습니다\n');
const 표 = [];
for (const [cd, x] of 본코드) {
  const u = 주소({ callTp: 'D', wantedAuthNo: x.번호, infoSvc: x.출처 });
  const D = await 받기(u);
  const nm = 값(D.글, 'empTpNm');
  표.push({ 코드: cd, empTpNm: nm, 번호: x.번호, HTTP: D.code });
  console.log('   ' + cd.padEnd(4) + ' → ' + (nm || '**못 읽음**')
    + '   (' + x.번호 + ' · HTTP ' + D.code + ')');
  if (!nm) {
    console.log('     ── 상세 응답 원문 앞 600자 ──');
    console.log('     ' + 가리기(D.글).slice(0, 600).replace(/\n/g, '\n     '));
  }
  await new Promise((f) => setTimeout(f, 800));
}

/* 첫 건은 상세 원문을 통째로 보여 줍니다 — 칸 이름을 눈으로 확인하려고 */
const 첫 = [...본코드.values()][0];
if (첫) {
  const D = await 받기(주소({ callTp: 'D', wantedAuthNo: 첫.번호, infoSvc: 첫.출처 }));
  console.log('\n── 상세 응답 원문 앞 1,200자 (' + 첫.번호 + ') ──');
  console.log(가리기(D.글).slice(0, 1200));
  const 칸 = [...D.글.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)>/g)].map((m) => m[1]);
  console.log('\n   상세 칸 이름 — ' + [...new Set(칸)].join(' · '));
}

console.log('\n── 확인한 표 ──');
for (const r of 표) console.log('   ' + r.코드.padEnd(4) + ' = ' + r.empTpNm);
console.log('\n이 표와 tools/collect-worknet.mjs 의 고용형태표를 맞춰 보십시오.');
