/* ═══════════════════════════════════════════════════════════════
 *  지역거점공공병원 알리미(rhs.mohw.go.kr)의 「직원 평균보수(직종별)」에서 보건직 평균 · 신입직원 평균을 읽습니다 (2026-11-12 밤)
 *  세중님이 찾아 주신 자리 — 「지역거점공공병원 알리미에 다 있다 · 높은 평균들 빼고 보건직·신입만」
 * ═══════════════════════════════════════════════════════════════
 *
 *  어디서 — 보건복지부 지역거점공공병원 알리미 · 공개 화면(로그인 없음) · robots.txt 없음(404 · 2026-11-12 확인)
 *    /Disclosure/View10.do?hospitalNumber=<번호>&searchYearMonth=&pageNum=02&subNum=14   「직원 평균보수(직종별)」
 *    표가 글로 들어 있습니다 (2026-11-12 서울의료원 10000001 원문으로 확인 · 단위 천원):
 *      구분 2021년 … 2025년 / 직원전체평균보수 … / 직종별 평균연봉 의사직(봉직의) … 간호직 … 보건직 … 행정직 … /
 *      신입직원평균보수 … / 직원평균근속년수 …
 *    병원 목록(번호 - 이름)은 같은 화면의 「기관별 공시」 메뉴에 있습니다 — 지방의료원 35 + 적십자병원 6 = 41곳.
 *
 *  고르는 값 — 가장 최근 해. 그 해가 0(아직 안 올림)이면 그 앞 해로 물러나고 그 해를 함께 적습니다.
 *    보건직     의료기사(물리치료사·작업치료사·방사선사·임상병리사 …)가 든 직종 — 치료사 연봉에 가장 가까운 공시 값
 *    신입직원    전 직종 신입 평균 (직종별 신입은 공시에 없습니다)
 *
 *  쓰는 법 (열쇠 필요 없음 · 한 곳에 1초씩 쉽니다)
 *    node tools/알리미-보수.mjs                 41곳 전부
 *    node tools/알리미-보수.mjs --번호 10000001   한 곳
 *    node tools/알리미-보수.mjs --원문 --번호 10000001   글 앞 1,200자와 잘라 낸 줄
 *    결과 → 표 + tmp/알리미-보수_<날짜>.json  (DB 에는 담지 않습니다)
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const 값 = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const 원문보기 = argv.includes('--원문');
const 한곳 = 값('--번호');

const 길 = (번호) => `https://rhs.mohw.go.kr/Disclosure/View10.do?hospitalNumber=${번호}&searchYearMonth=&pageNum=02&subNum=14`;
const 받기 = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'RAPO-collector (rapojob.co.kr)' } }); return { status: r.status, text: await r.text() }; };
const 글로 = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const 수 = (s) => Number(String(s).replace(/,/g, ''));

/* 「기관별 공시」 메뉴에서 번호 - 이름을 집습니다 */
const 목록 = (html) => {
  const m = new Map();
  for (const x of html.matchAll(/hospitalNumber=(\d{8})[^"'>]*["'][^>]*>\s*-\s*([^<]{2,40})</g)) m.set(x[1], x[2].trim());
  return [...m].map(([번호, 이름]) => ({ 번호, 이름 }));
};

/* 「줄이름 n n n n n」 을 해마다 값으로. 가장 최근의 0 이 아닌 해를 고릅니다 */
function 표(글) {
  /* 표 머리(「구분 2021년 … 직원전체평균보수」)에 닻을 내립니다 — 위쪽 「수정공시」 글에도 같은 낱말이 나옵니다
     (2026-11-12 원주의료원: 첫 「직원전체평균보수」가 수정 사유 글이라 9곳을 못 읽었음) */
  const 머리 = 글.match(/구분((?:\s*\d{4}년)+)\s*직원전체평균보수/);
  if (!머리) return null;
  const 해들 = [...머리[1].matchAll(/(\d{4})년/g)].map((m) => Number(m[1]));
  const a = 머리.index + 머리[0].length - '직원전체평균보수'.length;
  const 조각 = 글.slice(a, a + 1500);
  const 줄 = (이름) => {
    const m = 조각.match(new RegExp(이름.replace(/[()]/g, '\\$&') + '((?:\\s+[\\d,]+){' + 해들.length + '})'));
    if (!m) return null;
    const 값들 = m[1].trim().split(/\s+/).map(수);
    /* 단위는 천원 — 원 단위로 적은 곳(1,000,000 이상)은 그대로 씁니다 */
    for (let i = 값들.length - 1; i >= 0; i--) if (값들[i] > 0) return { 해: 해들[i], 값: 값들[i] >= 1e6 ? 값들[i] : 값들[i] * 1000, 원문: m[0].trim() };
    return { 해: null, 값: null, 원문: m[0].trim() };
  };
  return { 해들, 전체: 줄('직원전체평균보수'), 보건직: 줄('보건직'), 간호직: 줄('간호직'), 신입: 줄('신입직원평균보수') };
}

const 첫 = await 받기(길(한곳 || '10000001'));
const 대상 = 한곳 ? [{ 번호: 한곳, 이름: 목록(첫.text).find((x) => x.번호 === 한곳)?.이름 ?? '?' }] : 목록(첫.text);
if (!대상.length) { console.error(`병원 목록을 못 찾았습니다 (HTTP ${첫.status})`); process.exit(1); }

const 결과 = [];
const 만 = (x) => (x?.값 ? `${Math.round(x.값 / 1e4).toLocaleString('ko-KR')}만(${x.해})` : '없음');
for (const [k, h] of 대상.entries()) {
  const r = k === 0 ? 첫 : (await new Promise((ok) => setTimeout(ok, 1000)), await 받기(길(h.번호)));
  const 글 = 글로(r.text);
  const t = 표(글);
  if (원문보기) {
    const a = 글.search(/구분(?:\s*\d{4}년)+\s*직원전체평균보수/);
    console.log(`\n── ${h.번호} ${h.이름} (HTTP ${r.status}) ──\n${글.slice(Math.max(0, a - 150), a + 1050)}`);
    console.log(`── 보건직 줄: ${t?.보건직?.원문 ?? '(없음)'}\n── 신입 줄: ${t?.신입?.원문 ?? '(없음)'}`);
  }
  결과.push({ ...h, 보건직: t?.보건직?.값 ?? null, 보건직해: t?.보건직?.해 ?? null, 신입: t?.신입?.값 ?? null, 신입해: t?.신입?.해 ?? null,
    전체: t?.전체?.값 ?? null, 전체해: t?.전체?.해 ?? null, 간호직: t?.간호직?.값 ?? null, 주소: 길(h.번호) });
  console.log(`${t?.보건직?.값 || t?.신입?.값 ? '○' : '△'} ${h.번호} ${h.이름} — 보건직 ${만(t?.보건직)} · 신입 ${만(t?.신입)} · 전체 ${만(t?.전체)}`);
}

const 남길곳 = path.join(ROOT, 'tmp', `알리미-보수_${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(남길곳), { recursive: true });
fs.writeFileSync(남길곳, JSON.stringify({ 만든때: new Date().toISOString(), 결과 }, null, 1));
console.log(`\n${결과.length}곳 · 보건직 값 있는 곳 ${결과.filter((x) => x.보건직).length} · 신입 값 있는 곳 ${결과.filter((x) => x.신입).length} → ${path.relative(ROOT, 남길곳)}`);
