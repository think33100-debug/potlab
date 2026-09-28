/* 신형 마이다스(JobFlex) 채용사이트에서 공고 목록을 받습니다 (2026-09-28).
 *
 *   node tools/hosp/jobflex.mjs              적어둔 곳 전부
 *   node tools/hosp/jobflex.mjs gnuh         한 곳
 *   node tools/hosp/jobflex.mjs --제목        제목을 전부 찍습니다
 *
 * ── 401 은 로그인이 아니었습니다 ─────────────────────────────
 * 신형은 `*.recruiter.co.kr/career/…` 인 Next.js 화면이고, 자료는
 * `POST https://api-recruiter.recruiter.co.kr/position/v1/jobflex` 가 줍니다.
 * 전에 일곱 번 두드려 401·404 만 받고 「로그인이 필요한 듯」 이라고 적었습니다.
 * **틀렸습니다.**
 *
 * 브라우저로 gnuh 를 열어 보니 —
 *   · 비밀번호 칸 없음 · 「로그인」 이라는 말도 없음 · 공고 5건이 그냥 보임
 *   · 그 화면이 보내는 요청 머리글에 이 줄이 있었습니다
 *
 *       prefix: gnuh.recruiter.co.kr      ← 어느 병원인지 알려주는 줄
 *
 * 이 한 줄이 없으면 서버가 어느 회사인지 몰라 NullPointerException(500) 을 냅니다.
 * 붙이면 200 입니다. **브라우저도 Playwright 도 필요 없습니다.**
 *
 * 배운 것: 「막혔다」 고 적기 전에 **브라우저가 실제로 보내는 머리글**을 봅니다.
 * 우리가 주소를 지어내 두드린 것이 잘못이었습니다.
 *
 * ── 돌려주는 항목 (원문 그대로) ──────────────────────────────
 *   positionSn · title · submissionStatus · openStatus · startDateTime
 *   · endDateTime · careerType · classificationCode · tagList · dday
 *   submissionStatus IN_SUBMISSION = 접수중
 *   공고 주소 = https://<호스트>.recruiter.co.kr/career/jobs/<positionSn>
 *
 * ── 공용 사이트 가르기 ───────────────────────────────────────
 * 한 채용사이트에 여러 병원이 같이 옵니다. `classificationCode` 와
 * `tagList[].tagName` 에 병원 이름이 들어 있어 그걸로 나눕니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchJob, notOurs } from '../gas-rules.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://api-recruiter.recruiter.co.kr/position/v1/jobflex';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* 신형으로 확인된 곳 — tools/hosp/reports/batch*.md 와 HOSP_SITES 에서 모았습니다.
   「지어낸 주소」 가 아니라 보고서에 적힌 것만 넣었습니다 */
export const 곳들 = [
  { 호스트: 'gnuh', 이름: '경상국립대학교병원' },
  { 호스트: 'gcmc', 이름: '경상북도김천의료원' },
  { 호스트: 'scmc', 이름: '성남시의료원' },
  { 호스트: 'smc', 이름: '서울특별시서울의료원' },
  { 호스트: 'nhimc', 이름: '국민건강보험공단일산병원' },
  { 호스트: 'cnuhinsa', 이름: '세종충남대학교병원', 메모: '충남대병원 본원과 공용' },
  { 호스트: 'caumc', 이름: '중앙대학교광명병원', 메모: '중앙대의료원 공용' },
  { 호스트: 'hyumcguri', 이름: '한양대학교구리병원' },
  { 호스트: 'seoulsnh', 이름: '서울특별시서남병원' },
  { 호스트: 'diramsjob', 이름: '동남권원자력의학원원자력병원' },
  { 호스트: 'ish-recruiter', 이름: '가톨릭관동대학교 국제성모병원' },
  { 호스트: 'stcarollo', 이름: '성가롤로병원' },
];

/** 한 쪽을 받습니다. 못 받으면 { 왜 } — 던지지 않습니다 */
async function 한쪽(호스트, 쪽, 크기) {
  const 몸 = {
    pageableRq: { page: 쪽, size: 크기, sort: ['CREATED_DATE_TIME'] },
    filter: { keyword: '', tagSnList: [], jobGroupSnList: [], careerTypeList: [],
      regionSnList: [], submissionStatusList: [], openStatusList: [], resumeLanguageTypeList: [] },
  };
  let r, t;
  try {
    r = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        'User-Agent': UA,
        Referer: 'https://' + 호스트 + '.recruiter.co.kr/',
        prefix: 호스트 + '.recruiter.co.kr',      // ← 이 한 줄이 열쇠입니다
      },
      body: JSON.stringify(몸),
    });
    t = await r.text();
  } catch (e) { return { 왜: String(e && (e.cause?.code || e.message)).slice(0, 60) }; }
  if (!r.ok) return { 왜: 'HTTP ' + r.status + ' · ' + t.slice(0, 120), code: r.status };
  let j;
  try { j = JSON.parse(t); } catch { return { 왜: 'JSON 이 아닙니다 · ' + t.slice(0, 120) }; }
  return { 쪽정보: j.pagination || {}, 목록: j.list || [], 바이트: t.length };
}

/** 한 곳의 공고를 **전부** 받습니다 (쪽 넘김까지) */
export async function 목록(호스트, 최대쪽 = 20) {
  const 첫 = await 한쪽(호스트, 1, 100);
  if (첫.왜) return { 왜: 첫.왜 };
  const 전체 = Number(첫.쪽정보.totalCount || 0);
  const 쪽수 = Number(첫.쪽정보.totalPages || 1);
  const 모음 = [...첫.목록];
  for (let p = 2; p <= Math.min(쪽수, 최대쪽); p++) {
    const g = await 한쪽(호스트, p, 100);
    if (g.왜) break;
    모음.push(...g.목록);
    await new Promise((y) => setTimeout(y, 400));
  }
  return { 전체, 쪽수, 목록: 모음 };
}

/** 한 건을 우리 칸에 맞춰 풉니다 */
export function 풀기(호스트, x) {
  const 제목 = String(x.title || '').trim();
  const 기관 = String(x.classificationCode || ''
    || (x.tagList || []).map((t) => t.tagName).join(' ')).trim();
  const 날 = (v) => (v ? String(v).slice(0, 10) : '');
  return {
    id: 'JF' + x.positionSn,
    제목,
    기관,
    꼬리표: (x.tagList || []).map((t) => t.tagName).join(' · '),
    접수중: x.submissionStatus === 'IN_SUBMISSION',
    상태: String(x.submissionStatus || ''),
    시작: 날(x.startDateTime),
    마감: 날(x.endDateTime),
    경력: x.careerType === 'NEW_CAREER' ? '신입/경력' : String(x.careerType || ''),
    주소: 'https://' + 호스트 + '.recruiter.co.kr/career/jobs/' + x.positionSn,
    직군: (matchJob(제목) && !notOurs(제목)) ? matchJob(제목) : '',
  };
}

/* ── 본체 ── */
if (process.argv[1] && process.argv[1].endsWith('jobflex.mjs')) {
  const argv = process.argv.slice(2);
  const 제목찍기 = argv.includes('--제목');
  const 찾을말 = argv.filter((x) => !x.startsWith('--'));
  const 볼것 = 찾을말.length
    ? 곳들.filter((c) => 찾을말.some((w) => c.호스트.includes(w) || c.이름.includes(w)))
    : 곳들;

  console.log('신형 마이다스(JobFlex) ' + 볼것.length + '곳\n');
  const 결과 = [];
  let 합 = { 글: 0, 물리: 0, 작업: 0, 공통: 0, 접수중: 0 };

  for (const c of 볼것) {
    const g = await 목록(c.호스트);
    if (g.왜) {
      결과.push({ ...c, 왜: g.왜 });
      console.log('✗ ' + c.이름.slice(0, 24).padEnd(26) + c.호스트.padEnd(15) + g.왜);
      continue;
    }
    const 줄 = g.목록.map((x) => 풀기(c.호스트, x));
    const 물리 = 줄.filter((r) => r.직군 === '물리치료사');
    const 작업 = 줄.filter((r) => r.직군 === '작업치료사');
    const 공통 = 줄.filter((r) => r.직군 === '공통');
    const 접수중 = 줄.filter((r) => r.접수중);
    합.글 += 줄.length; 합.물리 += 물리.length; 합.작업 += 작업.length;
    합.공통 += 공통.length; 합.접수중 += 접수중.length;
    결과.push({ ...c, 전체: g.전체, 줄 });

    const 별 = (물리.length + 작업.length + 공통.length) ? '★ ' : '○ ';
    console.log(별 + c.이름.slice(0, 24).padEnd(26) + c.호스트.padEnd(15)
      + '글 ' + String(줄.length).padStart(4)
      + ' · 접수중 ' + String(접수중.length).padStart(3)
      + ' · 물리 ' + String(물리.length).padStart(2)
      + ' · 작업 ' + String(작업.length).padStart(2)
      + ' · 공통 ' + String(공통.length).padStart(2));
    for (const r of [...물리, ...작업, ...공통]) {
      console.log('      ★ ' + r.직군.padEnd(6) + (r.접수중 ? '접수중' : '마감  ') + ' '
        + (r.마감 || '마감일 없음').padEnd(11) + r.제목.slice(0, 44)
        + (r.기관 && r.기관 !== c.이름 ? '  [' + r.기관.slice(0, 14) + ']' : ''));
    }
    if (제목찍기) 줄.forEach((r, i) => console.log('        ' + String(i + 1).padStart(3) + '. '
      + (r.접수중 ? '접수중 ' : '마감   ') + r.제목.slice(0, 60)));
    await new Promise((y) => setTimeout(y, 600));
  }

  console.log('\n── 글 ' + 합.글 + ' · 접수중 ' + 합.접수중
    + ' · 물리치료사 ' + 합.물리 + ' · 작업치료사 ' + 합.작업 + ' · 공통 ' + 합.공통);
  const 못받음 = 결과.filter((r) => r.왜);
  if (못받음.length) console.log('   못 받은 곳 ' + 못받음.length + ' — '
    + 못받음.map((r) => r.이름 + '(' + r.왜.slice(0, 30) + ')').join(' · '));

  fs.writeFileSync(path.join(여기, 'reports', 'jobflex.json'),
    JSON.stringify({ 잰날: new Date().toISOString().slice(0, 10), 결과 }, null, 1), 'utf8');
  console.log('   자세한 것은 tools/hosp/reports/jobflex.json');
}
