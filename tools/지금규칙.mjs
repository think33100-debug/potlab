/* 저장된 원문(job_body)을 **지금 규칙으로 다시 읽어** 일곱 칸을 냅니다 (2026-11-24 규칙숙제 #48 · 세중님 「응 그렇게 해」).
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 매일 대조의 「수집기 혼자 정답률」 이 DB 에 담긴 값을 재고 있었습니다. 그 값은 **그 공고를 담던 날의 규칙**으로
 * 뽑힌 것이라, 규칙을 고쳐도 지난 공고에는 안 닿습니다 — 「지금 수집기 실력」 이 아니라 「그때 실력」 을 잰 것입니다.
 *
 * ── 무엇을 흉내 내나 ─────────────────────────────────────────
 * 「지금 이 공고를 다시 읽었다면 담길 값」 입니다. 실제 수집 길과 같은 차례로 —
 *   · HS·HS3·HS4  상세 본문 `칸뽑기('', 글)` 이 먼저(담긴 값을 덮음) → 첨부는 **빈 칸만**  (collect-hosp · 첨부되메우기)
 *   · GJ·CE·ND·AL 첨부 `칸뽑기(md)` (담긴 뽑은값을 덮음)                            (collect-nara · -cleaneye · -nid)
 *   · 모집인원     그 공고 직군 것만. 알리오(AL)는 API 값이 먼저라 **빈 칸만**           (collect-alio)
 *   · 고용형태     병원(HS)만 `고용형태고르기()`. 나머지는 API 값 그대로
 *   · 접수마감     날짜는 안 건드립니다(API·목록·hs_dates 몫). 시각은 첨부에서 **빈 칸만**
 *   · JF 상세·고용24(WN) 는 안 읽습니다 — 그 수집기가 본문에서 칸을 안 뽑습니다
 *   · 지금 규칙이 **못 읽은 칸은 담긴 값을 그대로** 둡니다 (collect_put 이 합쳐 담는 것과 같습니다 — 비우지 않습니다)
 *
 * 이 파일은 DB 를 읽지도 쓰지도 않습니다. 부르는 쪽이 값과 본문을 줍니다.
 *
 *   node tools/지금규칙.mjs --입력 <a.json> --나감 <b.json>
 *   a.json: [{ id, source, 제목, job_group, headcount, 뽑_인원, employ_type, apply_to, apply_to_time, 근무기간, 기간덧말,
 *              근무지, 자격, 보수, 본문: [{ kind, ord, name, url, body }] }]
 *   b.json: [{ id, 값: {…같은 칸…}, 바뀐칸: […], 본문수, 읽은칸: […] }]
 */
import fs from 'node:fs';
import { 칸뽑기, 더담을칸, 고용형태고르기 } from './공고문읽기.mjs';
import hs from './hosp/hs_files.js';
import hsd from './hosp/hs_dates.js';

export const 일곱 = ['headcount', '뽑_인원', 'employ_type', 'apply_to', 'apply_to_time', '근무기간', '기간덧말', '근무지', '자격', '보수'];
const 빔 = (v) => v == null || String(v).trim() === '';

/* 본문 하나 → 우리 칸 이름으로 */
function 본문칸(몸, j) {
  const 상세 = 몸.kind !== '첨부';
  const 칸 = 상세 ? 칸뽑기('', 몸.body) : 칸뽑기(몸.body, '');
  const 더 = 더담을칸(칸, j.job_group);
  const 수 = j.job_group ? (칸.모집인원 || {})[j.job_group] : null;
  return {
    headcount: 수 ?? null,
    뽑_인원: 더.모집인원 ?? null,
    apply_to_time: 상세 ? null : (칸.접수시각 || null),
    근무기간: 더.근무기간 ?? null,
    기간덧말: 더.근무기간덧말 ?? null,
    근무지: 더.근무지 ?? 칸.근무지 ?? null,
    자격: 더.지원자격 ?? 칸.지원자격 ?? null,
    보수: 더.예상연봉 ?? 칸.예상연봉 ?? null,
  };
}

export function 지금읽기(j) {
  const 출처 = String(j.source || '');
  const 병원 = /^HS/.test(출처);
  const 본문 = (j.본문 || []).filter((b) => b && b.body && !/^WN/.test(출처));
  /* 첨부 고르는 차례는 hs_files 점수() 한 자리 — 첨부되메우기와 같습니다 */
  const 첨부 = 본문.filter((b) => b.kind === '첨부' && hs.점수(b.name || '') >= 0 && !hs.공고아닌첨부(b.name || '', b.url || ''))
    .sort((a, b) => hs.점수(b.name || '') - hs.점수(a.name || '') || (a.ord || 0) - (b.ord || 0));
  const 상세 = 병원 ? 본문.filter((b) => b.kind !== '첨부') : [];
  const 값 = {}; for (const k of 일곱) 값[k] = j[k] ?? null;
  const 읽은칸 = [];
  const 넣기 = (k, v, 덮기) => {
    if (빔(v) || (!덮기 && !빔(값[k]))) return;
    값[k] = v; if (!읽은칸.includes(k)) 읽은칸.push(k);
  };
  const 담기 = (읽, 덮기) => {
    /* 인원 — 숫자가 읽히면 글 꼴(「○명」)은 안 씁니다 */
    const 인원덮기 = 덮기 && !/^AL/.test(출처);
    if (읽.headcount != null) 넣기('headcount', 읽.headcount, 인원덮기);
    else if (빔(값.headcount)) 넣기('뽑_인원', 읽.뽑_인원, 덮기);
    if (!빔(읽.근무기간) && (덮기 || 빔(값.근무기간))) { 값.기간덧말 = 읽.기간덧말 ?? (빔(값.근무기간) ? null : 값.기간덧말); 넣기('근무기간', 읽.근무기간, true); }
    for (const k of ['근무지', '자격', '보수']) 넣기(k, 읽[k], 덮기);
    넣기('apply_to_time', 읽.apply_to_time, false);
  };
  for (const b of 상세) {
    담기(본문칸(b, j), true);
    const h = (고용형태고르기(j.제목 || '', b.body) || {}).값;
    if (h) 넣기('employ_type', h, true);
    /* 2026-11-25 #75 — 상세 화면의 마감 시각은 collect-hosp 가 접수문장에서 hs_dates 마감시각() 으로 뽑습니다 (빈 칸만) */
    if (빔(값.apply_to_time) && 값.apply_to) 넣기('apply_to_time', hsd.마감시각(hsd.hs접수문장(b.body), 값.apply_to) || null, false);
  }
  /* 2026-11-25 #74 — 치매센터(ND)는 collect-nid 가 공고문에서 고용형태를 읽습니다 (못 읽은 칸은 담긴 값 그대로) */
  if (/^ND/.test(출처) && 첨부.length) {
    const h = (고용형태고르기(j.제목 || '', 첨부[0].body) || {}).값;
    if (h) 넣기('employ_type', h, true);
  }
  /* 첨부 — 첫 첨부가 읽은 칸은 다음 첨부가 안 덮습니다 */
  const 정한 = new Set();
  for (const b of 첨부) {
    const 읽 = 본문칸(b, j);
    if (병원) { 담기(읽, false); continue; }
    for (const k of Object.keys(읽)) if (정한.has(k)) 읽[k] = null;
    for (const k of Object.keys(읽)) if (!빔(읽[k])) 정한.add(k);
    담기(읽, true);
  }
  const 같 = (a, b) => String(a ?? '').replace(/\s+/g, ' ').trim() === String(b ?? '').replace(/\s+/g, ' ').trim();
  return { id: j.id, 값, 바뀐칸: 일곱.filter((k) => !같(값[k], j[k])), 본문수: 상세.length + 첨부.length, 읽은칸 };
}

if (process.argv[1]?.endsWith('지금규칙.mjs')) {
  const 값 = (이름) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : null; };
  const 들 = JSON.parse(fs.readFileSync(값('--입력'), 'utf8').replace(/^\uFEFF/, ''));
  const 나 = 들.map((j) => { try { return 지금읽기(j); } catch (e) { return { id: j.id, 오류: String((e && e.message) || e).slice(0, 200) }; } });
  fs.writeFileSync(값('--나감'), JSON.stringify(나, null, 1), 'utf8');
  console.log(JSON.stringify({ 공고: 나.length, 본문있음: 나.filter((x) => x.본문수).length, 바뀐공고: 나.filter((x) => x.바뀐칸?.length).length,
    바뀐칸: 나.reduce((n, x) => n + (x.바뀐칸?.length || 0), 0), 오류: 나.filter((x) => x.오류).length }));
}
