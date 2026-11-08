/* 회원 화면에 **같은 공고가 두 번** 보이면 메일로 알립니다 (2026-11-08 세중님)
 *
 *   node tools/중복공고경보.mjs              찾고, 새 짝이 있으면 메일
 *   node tools/중복공고경보.mjs --마른        보내지 않고 보낼 글만 화면에 (기록도 안 남김)
 *   node tools/중복공고경보.mjs --자기점검    규칙 시험만 (DB·메일 안 건드림)
 *   node tools/중복공고경보.mjs --끄기 A B    A·B 짝은 다시 안 알림 (같은 공고가 아닐 때)
 *   node tools/중복공고경보.mjs --잊기        보낸 기록을 비움 (시험 뒤)
 *
 * ── 하는 것 / 안 하는 것 ─────────────────────────────────────
 * **읽기 + 메일뿐입니다.** 공고를 숨기거나 묶거나 지우지 않습니다.
 * 묶는 것은 관리자 화면(/admin/jobs)에서 사람이 합니다.
 *
 * ── 언제 도나 ───────────────────────────────────────────────
 * 크론 줄을 새로 만들지 않습니다(크론은 세중님 몫). `tools/수집기멈춤경보.mjs` 가
 * 30분마다 돌 때 맨 앞에서 이 파일을 한 번 부릅니다. 그래서 **30분마다** 봅니다.
 *
 * ── 이미 있는 규칙과의 사이 ─────────────────────────────────
 *   중복숨기기()     같은 공고열쇠(기관|주소|제목) — 자동으로 숨김
 *   출처다른중복()   같은 견줄이름 + 같은 제목열쇠 + 마감 같음/한쪽 빔 — 자동으로 숨김 (좁게)
 *   묶을후보()       관리자 화면이 보여 주는 짝
 *   이 파일          위 셋이 **못 잡고 회원 화면에 남은** 짝을 넓게 찾아 **사람에게 알림**
 * 기관 이름 맞추기는 DB 의 `견줄이름()` 을 그대로 부릅니다 (기준은 한 자리 · 지침 6절).
 * 「같은 공고인가」 판정은 아래 `같은공고인가()` **한 함수**에만 있습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* DB 조회는 공용 받아보기() · 쪽은 모두받기() 로만 넘깁니다 (지침 8-20 ③) */
import { 받아보기, 모두받기 } from './쪽나눠받기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
export const 기록파일 = process.env.POTJOB_DUP_STATE || path.join(여기, '..', 'log', '중복경보기록.json');
const 쉬는시간_기본 = 6;      /* 같은 짝은 6시간에 한 번만 — 수집기멈춤경보와 같은 결 */

/* ═══════════════════ 규칙 — 여기 한 자리 ═══════════════════ */

/* 직군 낱말 — **「직군이 다르면 다른 공고」를 가리는 데만** 씁니다.
   제목에 둘 다 직군이 적혀 있는데 하나도 안 겹치면 같은 공고가 아닙니다. */
const 직군꼴 = [
  ['물리치료', /물리\s*치료/], ['작업치료', /작업\s*치료/], ['언어재활', /언어\s*(?:재활|치료)/],
  ['간호조무', /간호\s*조무/], ['간호', /간호(?!\s*조무)/], ['방사선', /방사선/],
  ['임상병리', /임상\s*병리/], ['치위생', /치위생|치과\s*위생/], ['사회복지', /사회\s*복지/],
  ['영양', /영양/], ['조리', /조리/], ['약사', /약사/], ['의사', /의사(?!\s*소통)|전문의|전공의/],
  ['행정', /행정|사무직/], ['운전', /운전/], ['미화', /미화/],
];
function 직군들(t) { return new Set(직군꼴.filter(([, re]) => re.test(t)).map(([n]) => n)); }

/* 「1차·2차」 「제13회」 「공고 제2026-30호」 — 다르면 **다른 공고**입니다 */
function 가름표(t) {
  const 모아 = (re) => [...t.matchAll(re)].map((m) => m[1].replace(/\s+/g, '')).sort().join(',');
  return {
    차수: 모아(/(\d{1,2})\s*차(?!\s*(?:합격|시험|면접|서류|발표))/g),
    회차: 모아(/제\s*(\d{1,3})\s*회/g),
    번호: 모아(/제?\s*(\d{2,4}\s*[-–]\s*\d{1,4})\s*호/g),
  };
}

const 글자만 = (s) => String(s || '').toLowerCase().replace(/[^가-힣a-z0-9]/g, '');

/** 제목을 견줄 꼴로 다듬습니다 — 기관 이름 · 해 · 날짜 · 차수·번호 · 「공고·채용·재공고」를 걷고
 *  글자·숫자만 남깁니다. (DB 의 `제목속글자()`·`꼬리말떼기()` 와 같은 결이지만 **더 넓게** 걷습니다 —
 *  이 파일은 숨기지 않고 알리기만 하므로 넓어도 됩니다) */
export function 제목다듬기(제목, 기관) {
  let t = String(제목 || '').replace(/&amp;/g, '&').replace(/&amp;/g, '&')
    .replace(/&(?:[a-z]+|#x?[0-9a-f]{1,6});/gi, ' ');
  t = t
    .replace(/20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g, ' ')      /* 2026.10.28 · 2026년 10월 28일 */
    .replace(/\d{1,2}\s*[./]\s*\d{1,2}\s*\.?\s*[~∼～-]\s*\d{1,2}\s*[./]\s*\d{1,2}/g, ' ') /* 11.4~11.14 */
    .replace(/[(\[]?\s*d\s*-\s*(?:day|\d+)\s*[)\]]?/gi, ' ')                         /* D-8 */
    .replace(/20\d{2}\s*(?:년도|년)?/g, ' ').replace(/'?\d{2}\s*년도/g, ' ')         /* 해 */
    .replace(/제?\s*\d{1,2}\s*차(?!\s*(?:합격|시험|면접|서류|발표))/g, ' ')            /* 차수는 가름표로 */
    .replace(/제\s*\d{1,3}\s*회/g, ' ')
    .replace(/(?:공고\s*)?제?\s*\d{2,4}\s*[-–]\s*\d{1,4}\s*호/g, ' ')
    .replace(/재공고|추가\s*(?:모집|채용)|채용\s*공고|모집\s*공고|공고|채용|모집|안내|선발|알림|직원/g, ' ');
  let k = 글자만(t);
  /* 기관 이름을 뗍니다 — 한쪽 출처만 제목 앞에 「[광주보훈병원]」 을 붙입니다 */
  const 통째 = 글자만(기관);
  const 토막 = String(기관 || '').split(/[\s()\[\]·]+/).map(글자만).filter((x) => x.length >= 3);
  for (const x of [통째, ...토막].filter(Boolean).sort((a, b) => b.length - a.length)) k = k.split(x).join('');
  return k;
}

/* 두 글이 얼마나 닮았나 — 두 글자씩 끊어 겹치는 비율(0~1) */
export function 닮음(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const 쌍 = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = 쌍(a), B = 쌍(b);
  let 겹 = 0, 합 = 0;
  for (const [g, n] of A) { 겹 += Math.min(n, B.get(g) || 0); 합 += n; }
  for (const n of B.values()) 합 += n;
  const 다이스 = 합 ? (2 * 겹) / 합 : 0;
  /* 한쪽이 다른 쪽을 통째로 품고 길이가 반을 넘으면 닮은 것으로 봅니다 */
  const [짧, 긴] = a.length <= b.length ? [a, b] : [b, a];
  const 품음 = 짧.length >= 4 && 긴.includes(짧) && 짧.length / 긴.length >= 0.5 ? 0.85 : 0;
  return Math.max(다이스, 품음);
}

const 날 = (s) => (s ? String(s).slice(0, 10) : '');
const 더하기 = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/* 접수 기간 [시작, 끝]. 끝이 없으면 시작 + 30일, 시작이 없으면 올린 날 · 끝 − 30일 */
function 기간(x) {
  let 끝 = 날(x.apply_to);
  let 시작 = 날(x.apply_from) || 날(x.posted_at);
  if (!시작 && 끝) 시작 = 더하기(끝, -30);
  if (시작 && !끝) 끝 = 더하기(시작, 30);
  return 시작 ? [시작, 끝] : null;
}

export const 닮음기준 = 0.8;

/** ★ 「같은 공고인가」 — 이 저장소에서 **이 알림의 판정은 여기 한 곳**입니다.
 *  a·b = { id, source, title, org_name, 기관키, job_group, apply_from, apply_to, posted_at }
 *  돌려줌 = { 같음, 닮음, 까닭 } */
export function 같은공고인가(a, b) {
  const 아님 = (까닭, 점수 = 0) => ({ 같음: false, 닮음: 점수, 까닭 });
  if (!a || !b || a.id === b.id) return 아님('같은 줄');
  if (!a.기관키 || a.기관키 !== b.기관키) return 아님('기관이 다름');
  if (a.job_group && b.job_group && a.job_group !== b.job_group) return 아님('직군 칸이 다름');
  const 직a = 직군들(a.title), 직b = 직군들(b.title);
  if (직a.size && 직b.size && ![...직a].some((x) => 직b.has(x))) return 아님('제목의 직군이 다름');
  const ga = 가름표(a.title), gb = 가름표(b.title);
  if (ga.차수 !== gb.차수) return 아님('차수가 다름');
  if (ga.회차 && gb.회차 && ga.회차 !== gb.회차) return 아님('회차가 다름');
  if (ga.번호 && gb.번호 && ga.번호 !== gb.번호) return 아님('공고 번호가 다름');
  const pa = 기간(a), pb = 기간(b);
  if (pa && pb && (pa[0] > pb[1] || pb[0] > pa[1])) return 아님('접수 기간이 안 겹침');
  const ka = 제목다듬기(a.title, a.org_name), kb = 제목다듬기(b.title, b.org_name);
  if (ka.length < 3 || kb.length < 3) {
    /* 「2026년 제13회 성남시의료원 직원 채용 모집 공고」 처럼 걷고 나면 남는 것이 없는 제목 —
       그때는 **안 걷은 제목이 글자까지 같고 10자 이상**일 때만 같다고 봅니다
       (DB 의 출처다른중복 길이 가드와 같은 10자) */
    const ra = 글자만(String(a.title || '').replace(/&(?:[a-z]+|#x?[0-9a-f]{1,6});/gi, ''));
    const rb = 글자만(String(b.title || '').replace(/&(?:[a-z]+|#x?[0-9a-f]{1,6});/gi, ''));
    if (ra.length >= 10 && ra === rb) return { 같음: true, 닮음: 1, 까닭: (a.source === b.source ? '출처 같음 · 번호 다름' : '출처 다름') + ' · 제목 글자까지 같음' };
    return 아님('다듬은 제목이 너무 짧음');
  }
  const 점수 = Math.round(닮음(ka, kb) * 100) / 100;
  if (점수 < 닮음기준) return 아님('제목이 덜 닮음', 점수);
  return { 같음: true, 닮음: 점수, 까닭: a.source === b.source ? '출처 같음 · 번호 다름' : '출처 다름' };
}

export const 짝열쇠 = (a, b) => [String(a), String(b)].sort().join('|');

/* ═══════════════════ 자기점검 ═══════════════════ */
export function 자기점검() {
  const 줄 = (id, source, org, title, 기간들 = {}, 더 = {}) => ({
    id, source, org_name: org, 기관키: 글자만(org), title, job_group: null, ...기간들, ...더 });
  const 짝 = [
    /* ── 같은 공고 (알려야 함) ── */
    ['성남 — 제목 글자까지 같음, 출처 다름', true,
      줄('CE80464', 'CE2', '성남시의료원', '2026년 제13회 성남시의료원 직원 채용 모집 공고', { apply_from: '2026-10-20', apply_to: '2026-11-03' }),
      줄('HS726356583', 'HS3', '성남시의료원', '2026년 제13회 성남시의료원 직원 채용 모집 공고', { posted_at: '2026-10-20' })],
    ['광주보훈 — 앞에 [기관] · 끝의 「공고」만 다름', true,
      줄('306122', 'AL2', '광주보훈병원', '계약직 보건직(작업치료사) - 휴직대체 직원 채용', { apply_to: '2026-11-10' }),
      줄('HS190712781', 'HS3', '광주보훈병원', '[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용 공고', { posted_at: '2026-10-30' })],
    ['재공고 · 해 · 날짜 꼬리만 다름', true,
      줄('GJ1', 'GJ2', '국립재활원', '[재공고] 2026년 국립재활원 물리치료사(기간제) 채용 (11.4~11.14)', { apply_from: '2026-11-04', apply_to: '2026-11-14' }),
      줄('HS2', 'HS3', '국립재활원', '국립재활원 물리치료사(기간제) 채용', { apply_from: '2026-11-04', apply_to: '2026-11-14' })],
    ['출처 같고 번호만 다름 (같은 글을 두 번 담음)', true,
      줄('HS10', 'HS3', '호남권역재활병원', '정규직(물리치료사·작업치료사) 채용공고', { apply_from: '2026-10-29', apply_to: '2026-11-09' }),
      줄('HS11', 'HS3', '호남권역재활병원', '정규직(물리치료사·작업치료사) 채용공고', { apply_from: '2026-10-29', apply_to: '2026-11-09' })],
    /* ── 같은 공고가 아님 (알리면 안 됨) ── */
    ['1차 · 2차 공고', false,
      줄('A1', 'AL2', '경기도의료원', '2026년 1차 경기도의료원 직원 채용 공고', { apply_from: '2026-10-01', apply_to: '2026-11-20' }),
      줄('A2', 'HS3', '경기도의료원', '2026년 2차 경기도의료원 직원 채용 공고', { apply_from: '2026-11-01', apply_to: '2026-11-15' })],
    ['직군이 다름 (물리 ↔ 작업)', false,
      줄('B1', 'AL2', '국립교통재활병원', '물리치료사 채용 공고', { apply_to: '2026-11-10' }),
      줄('B2', 'HS3', '국립교통재활병원', '작업치료사 채용 공고', { apply_to: '2026-11-10' })],
    ['직군 칸이 다름', false,
      줄('C1', 'WN2', '서울의료원', '의료기사 계약직 채용', { apply_to: '2026-11-10' }, { job_group: '물리치료사' }),
      줄('C2', 'HS3', '서울의료원', '의료기사 계약직 채용', { apply_to: '2026-11-10' }, { job_group: '작업치료사' })],
    ['기관이 다름 (같은 「물리치료사 모집」)', false,
      줄('D1', 'WN2', '밝은집요양원', '물리치료사 모집', { apply_to: '2026-11-10' }),
      줄('D2', 'WN2', '태조요양원', '물리치료사 모집', { apply_to: '2026-11-10' })],
    ['접수 기간이 안 겹침 (봄 공고 ↔ 가을 공고)', false,
      줄('E1', 'AL2', '충주의료원', '물리치료사(기간제) 채용', { apply_from: '2026-03-02', apply_to: '2026-03-12' }),
      줄('E2', 'HS3', '충주의료원', '물리치료사(기간제) 채용', { apply_from: '2026-10-20', apply_to: '2026-10-30' })],
    ['공고 번호가 다름', false,
      줄('F1', 'HS3', '전주시립요양병원', '공고 제2026-30호(작업치료사) 채용', { posted_at: '2026-10-20' }),
      줄('F2', 'HS3', '전주시립요양병원', '공고 제2026-31호(작업치료사) 채용', { posted_at: '2026-10-22' })],
    ['정규직 ↔ 계약직 (같은 직군 · 다른 자리)', false,
      줄('H1', 'WN2', '부산의료원', '물리치료사 채용(정규직)', { apply_to: '2026-11-10' }),
      줄('H2', 'HS3', '부산의료원', '물리치료사 채용(계약직)', { apply_to: '2026-11-10' })],
    ['제목이 꼬리말뿐 (가릴 수 없음)', false,
      줄('G1', 'WN2', '대구의료원', '채용 공고', { apply_to: '2026-11-10' }),
      줄('G2', 'HS3', '대구의료원', '대구의료원 채용 공고', { apply_to: '2026-11-10' })],
  ];
  const 어긴것 = [];
  for (const [이름, 바람, a, b] of 짝) {
    const r = 같은공고인가(a, b);
    const r2 = 같은공고인가(b, a);
    if (r.같음 !== 바람) 어긴것.push(이름 + ' — 바란 것 ' + 바람 + ' · 나온 것 ' + r.같음 + ' (' + r.까닭 + ' · 닮음 ' + r.닮음 + ')');
    else if (r2.같음 !== r.같음) 어긴것.push(이름 + ' — 앞뒤를 바꾸면 답이 달라짐');
    console.log((r.같음 === 바람 ? '  ○ ' : '  ✗ ') + 이름 + '  → ' + (r.같음 ? '같음' : '아님') + ' · ' + r.까닭 + ' · 닮음 ' + r.닮음);
  }
  if (짝열쇠('B', 'A') !== 짝열쇠('A', 'B')) 어긴것.push('짝열쇠가 차례에 따라 달라짐');
  if (어긴것.length) {
    console.error('✗ 중복공고경보 자기점검 실패 ' + 어긴것.length + '가지');
    for (const x of 어긴것) console.error('   · ' + x);
    return false;
  }
  console.log('○ 중복공고경보 자기점검 통과 — ' + (짝.length + 1) + '가지 (DB·메일을 안 건드렸습니다)');
  return true;
}

/* ═══════════════════ 기록 ═══════════════════ */
function 기록읽기() {
  try { const j = JSON.parse(fs.readFileSync(기록파일, 'utf8')); return { 보냄: j.보냄 || {}, 끔: j.끔 || {} }; }
  catch { return { 보냄: {}, 끔: {} }; }
}
function 기록쓰기(기록) {
  fs.mkdirSync(path.dirname(기록파일), { recursive: true });
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1) + '\n');
}

/* ═══════════════════ 돌리기 ═══════════════════ */
function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);     /* 이름 없는 줄은 버립니다 (지침 8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

export async function 돌리기(argv) {
  const 마른 = argv.includes('--마른');
  const 쉬는시간 = Number(argv.includes('--쉬기') ? argv[argv.indexOf('--쉬기') + 1] : 쉬는시간_기본) || 쉬는시간_기본;
  const cfg = env();
  const K = cfg.SUPABASE_SERVICE_KEY;
  if (!cfg.SUPABASE_URL || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); return 1; }
  const H = { apikey: K, Authorization: 'Bearer ' + K };
  const U = cfg.SUPABASE_URL + '/rest/v1/';
  const 우리주소 = (cfg.SITE_URL || 'https://potjob-web.vercel.app').replace(/\/$/, '') + '/jobs/';

  /* ① 회원 화면 공고 (보이는 그대로 · 보여 주는 제목) */
  const 보임 = await 모두받기(U + 'job_posts_pub?select=id,title,' + encodeURIComponent('원문제목')
    + ',org_name,job_group,apply_from,apply_to,posted_at,url', H, { 차례: 'id' });
  /* ② 출처 · 이미 이은 짝 — 뷰에 없는 칸이라 표에서 id 로 집어 옵니다 (읽기만) */
  const 더 = new Map();
  for (let i = 0; i < 보임.length; i += 80) {
    const 묶음 = 보임.slice(i, i + 80).map((x) => encodeURIComponent('"' + x.id + '"')).join(',');
    for (const r of await 모두받기(U + 'job_posts?select=id,source,' + encodeURIComponent('같은공고')
      + '&id=in.(' + 묶음 + ')', H, { 차례: 'id' })) 더.set(r.id, r);
  }
  /* ③ 관리자가 「묶지 않기」 한 짝은 빼고 봅니다 */
  let 묶지않음 = new Set();
  try {
    묶지않음 = new Set((await 모두받기(U + encodeURIComponent('묶지않음') + '?select='
      + encodeURIComponent('왼쪽') + ',' + encodeURIComponent('오른쪽'), H, { 차례: '왼쪽.asc,오른쪽.asc' }))
      .map((r) => 짝열쇠(r['왼쪽'], r['오른쪽'])));
  } catch (e) { console.error('  ⚠ 묶지않음 표를 못 읽었습니다 — 빼지 않고 봅니다 (' + String(e.message).slice(0, 80) + ')'); }
  /* ④ 기관 열쇠는 DB 의 견줄이름() 그대로 (한 자리) — 기관 이름마다 한 번 */
  const 이름들 = [...new Set(보임.map((x) => x.org_name || '').filter(Boolean))];
  const 열쇠 = new Map();
  for (let i = 0; i < 이름들.length; i += 6) {
    await Promise.all(이름들.slice(i, i + 6).map(async (n) => {
      const r = await 받아보기(U + 'rpc/' + encodeURIComponent('견줄이름'), {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ s: n }) });
      const t = await r.text();
      if (!r.ok) throw new Error('견줄이름 ' + r.status + ' ' + t.slice(0, 200));
      열쇠.set(n, JSON.parse(t) || '');
    }));
  }

  const 줄 = 보임.map((x) => ({
    /* 견주는 것은 **원문 제목**입니다 — 보여 주는 제목(보여줄제목)은 우리가 다시 쓴 것이라
       「1차·2차」·공고 번호 같은 가름표가 빠져 있을 수 있습니다 */
    ...x, title: x['원문제목'] || x.title || '', source: (더.get(x.id) || {}).source || '?',
    같은공고: (더.get(x.id) || {})['같은공고'] || null, 기관키: 열쇠.get(x.org_name || '') || '' }));
  const 기관별 = new Map();
  for (const x of 줄) { if (!x.기관키) continue; if (!기관별.has(x.기관키)) 기관별.set(x.기관키, []); 기관별.get(x.기관키).push(x); }

  const 찾은것 = [];
  for (const 무리 of 기관별.values()) {
    for (let i = 0; i < 무리.length; i++) for (let j = i + 1; j < 무리.length; j++) {
      const a = 무리[i], b = 무리[j];
      const k = 짝열쇠(a.id, b.id);
      if (묶지않음.has(k) || a.같은공고 === b.id || b.같은공고 === a.id) continue;
      const r = 같은공고인가(a, b);
      if (r.같음) 찾은것.push({ 열쇠: k, a, b, ...r });
    }
  }

  const 기록 = 기록읽기();
  const 이제 = Date.now();
  const 지금짝 = new Set(찾은것.map((x) => x.열쇠));
  for (const k of Object.keys(기록.보냄)) if (!지금짝.has(k)) delete 기록.보냄[k];   /* 사라진 짝은 기록도 걷음 */
  const 보낼것 = 찾은것.filter((x) => !기록.끔[x.열쇠]
    && (!기록.보냄[x.열쇠] || 이제 - 기록.보냄[x.열쇠] >= 쉬는시간 * 3600e3));

  console.log('중복 의심 — 회원 화면 ' + 보임.length + '건 · 기관 ' + 기관별.size + '곳 · 찾은 짝 ' + 찾은것.length
    + ' · 끈 짝 ' + 찾은것.filter((x) => 기록.끔[x.열쇠]).length + ' · 이번에 알릴 짝 ' + 보낼것.length);
  if (!보낼것.length) { if (!마른) 기록쓰기(기록); console.log('알릴 것이 없습니다.'); return 0; }

  const 한쪽 = (x, 표) => [
    '   ' + 표 + ' ' + x.id + ' [' + x.source + '] ' + String(x.title).slice(0, 70),
    '      접수 ' + (날(x.apply_from) || '?') + ' ~ ' + (날(x.apply_to) || '?') + (x.posted_at ? ' · 올림 ' + 날(x.posted_at) : ''),
    '      원문 ' + (x.url || '(없음)'),
    '      우리 ' + 우리주소 + encodeURIComponent(x.id),
  ];
  const 제목 = '[피오티잡] 같은 공고가 두 번 보일 수 있습니다 — ' + 보낼것.length + '쌍';
  const 본문 = [
    '회원 화면에서 같은 공고로 보이는 짝 ' + 보낼것.length + '쌍입니다. **아무것도 숨기지 않았습니다.**',
    '',
    ...보낼것.flatMap((x, i) => [
      (i + 1) + ') ' + (x.a.org_name || '') + ' · 닮음 ' + x.닮음 + ' · ' + x.까닭
        + (기록.보냄[x.열쇠] ? ' · (전에도 알림 — 아직 남아 있음)' : ' · 새로 찾음'),
      ...한쪽(x.a, '㉮'), ...한쪽(x.b, '㉯'), '']),
    '같은 공고가 맞으면 관리자 화면(/admin/jobs)에서 묶어 주세요.',
    '같은 공고가 아니면 서버에서 —  node tools/중복공고경보.mjs --끄기 <㉮번호> <㉯번호>',
    '  (그 짝은 다시 안 옵니다)',
    '같은 짝은 ' + 쉬는시간 + '시간에 한 번만 다시 알립니다. 이 메일은 30분마다 도는 수집기멈춤경보가 함께 부릅니다.',
  ].join('\n');

  if (마른) {
    console.log('\n[마른] 보내지 않습니다 · 기록도 안 남깁니다\n\n제목: ' + 제목 + '\n\n' + 본문);
    return 0;
  }
  if (!cfg.RESEND_KEY || !cfg.NOTIFY_EMAIL) {
    console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n\n제목: ' + 제목 + '\n\n' + 본문);
    기록쓰기(기록);
    return 0;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
      to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문 }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 메일 못 보냄 · HTTP ' + r.status + ' · ' + t.slice(0, 200)); 기록쓰기(기록); return 1; }
  /* 보낸 것만 적습니다 — 못 보냈으면 다음 번에 다시 */
  for (const x of 보낼것) 기록.보냄[x.열쇠] = 이제;
  기록쓰기(기록);
  console.log('보냈습니다 — ' + 제목 + ' · 기록 ' + 기록파일);
  return 0;
}

/* 직접 돌릴 때만 — 다른 파일이 import 하면 규칙만 빌려 갑니다 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--자기점검')) process.exit(자기점검() ? 0 : 1);
  if (argv.includes('--잊기')) {
    const 기록 = 기록읽기(); 기록.보냄 = {}; 기록쓰기(기록);
    console.log('보낸 기록을 비웠습니다 (끈 짝은 그대로) — ' + 기록파일); process.exit(0);
  }
  if (argv.includes('--끄기')) {
    const i = argv.indexOf('--끄기'); const a = argv[i + 1], b = argv[i + 2];
    if (!a || !b) { console.error('쓰는 법: --끄기 <번호1> <번호2>'); process.exit(1); }
    const 기록 = 기록읽기(); 기록.끔[짝열쇠(a, b)] = new Date().toISOString(); 기록쓰기(기록);
    console.log('끔 — ' + 짝열쇠(a, b) + ' 는 다시 안 알립니다 · ' + 기록파일); process.exit(0);
  }
  돌리기(argv).then((c) => process.exit(c), (e) => { console.error('✗ 중복공고경보 — ' + String(e.message || e).slice(0, 300)); process.exit(1); });
}
