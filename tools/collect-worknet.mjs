/* 워크넷 수집기 (WN2) — 고용24 채용정보 API (2026-09-30).
 *
 *   node tools/collect-worknet.mjs --dry        담지 않고 견주기만
 *   node tools/collect-worknet.mjs --dry --한줄  사흘 대조용 한 줄만
 *   node tools/collect-worknet.mjs              정말로 담습니다 (source = WN2)
 *
 * ── 어디서 받나 ──────────────────────────────────────────────
 *   https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do
 *   authKey · callTp L=목록 D=상세 · returnType=XML
 *   startPage 최대 1000 · display 최대 100
 *   occupation  306500 물리및작업치료사 · 306501 물리치료사 · 306502 작업치료사
 *
 * **공공데이터포털 열쇠가 아닙니다.** 고용24 전용 authKey 입니다 (UUID 36자).
 *
 * ── 워크넷은 과거를 안 줍니다 ────────────────────────────────
 * 지금 접수 중인 것만 옵니다. **매일 받아 쌓는 것이 우리가 가진 유일한 이력**입니다.
 * 그래서 마감된 줄도 지우지 않습니다 (DB 의 hide_stale_posts 가 감춥니다).
 *
 * ── 2026-09-30 에 응답 원문으로 확인한 것 ────────────────────
 *   목록 항목  wantedAuthNo company busino indTpNm title salTpNm sal minSal maxSal
 *             region holidayTpNm minEdubg maxEdubg career regDt closeDt infoSvc
 *             wantedInfoUrl wantedMobileInfoUrl smodifyDtm zipCd strtnmCd
 *             basicAddr detailAddr empTpCd jobsCd
 *   상세      callTp=D + wantedAuthNo + **infoSvc** (없으면 「정보제공처가 바르지 않습니다」)
 *             empTpNm · receiptCloseDt · jobCont · collectPsncnt …
 *
 * ── 고쳐 넣은 것 (예전에 찾아둔 버그) ────────────────────────
 *   ① closeDt 가 「채용시까지  26-11-07」 로 섞여 옴 (235건 중 156건 · 66%)
 *      → tools/날짜.mjs 의 공용 함수로 풉니다. 치매센터·나라일터와 같은 함수
 *   ② 우리 직종이 아닌 공고가 섞여 옴 (235건 중 13건)
 *      → jobsCd 로 한 번 더 거릅니다
 *   ③ 고용형태가 코드(10·20)로 옴. empTpNm 은 목록에 **안 옵니다**
 *      → 상세 API 로 코드마다 이름을 직접 확인해 표를 만들었습니다 (짐작 아님)
 *   ④ 제목의 HTML 기호가 두 번·세 번 겹쳐 옴 (&amp;amp; · &amp;gt;)
 *      → 바뀌지 않을 때까지 되풀이해 풉니다
 *   ⑤ 「전남광주 목포시」 → 「전남 목포시」
 *      → 「화성시 만세구·효행구」 「인천 서해구」 는 진짜 행정구역이라 안 건드립니다
 *   ⑥ 명세에 없는 사업자번호(busino)가 옴 → 저장해 둡니다 (심평원 자료와 이을 용도)
 *
 * ── 워크넷 승인 때 약속한 것 ─────────────────────────────────
 *   · 출처를 「고용24」 로 밝힙니다
 *   · 원문·지원은 고용24 원본 링크(wantedInfoUrl)로 보냅니다
 *   · 내용을 임의로 고치거나 재가공해 팔지 않습니다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortJob } from './sort-rule.mjs';
import { matchJob, notOurs, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { 날짜풀기, 채용시까지인가 } from './날짜.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'WN2';
const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
/* 물리및작업치료사 · 물리치료사 · 작업치료사 */
const 직종 = ['306500', '306501', '306502'];
const 직종이름 = { 306500: '물리및작업치료사', 306501: '물리치료사', 306502: '작업치료사' };

/* ③ 고용형태 코드 → 말.
   **상세 API 의 empTpNm 을 직접 읽어 만든 표입니다** (2026-09-30) —
     10  기간의 정함이 없는 근로계약
     11  기간의 정함이 없는 근로계약(시간(선택)제)
     20  기간의 정함이 있는 근로계약
     21  기간의 정함이 있는 근로계약(시간(선택)제)
   4(파견)·Y(대체인력)은 오늘 응답에 없어 gas/wage.js 의 HIRE_CODE 를 따랐습니다. */
const 고용형태표 = {
  10: '정규직', 11: '정규직(시간제)',
  20: '기간제', 21: '기간제(시간제)',
  4: '파견', Y: '대체인력',
};
const 고용형태 = (v) => String(v || '').split(',')
  .map((x) => 고용형태표[x.trim()] || x.trim()).filter(Boolean).join(', ');

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = argv.indexOf(이름); return i > -1 && argv[i + 1] != null ? Number(argv[i + 1]) : 기본; };
const dry = argv.includes('--dry');
const 한줄 = argv.includes('--한줄');
const 최대쪽 = 값('--쪽', 10);

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^'|'$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.COLLECT_KEY_WN2 = out.COLLECT_KEY_WN2 || out.COLLECT_KEY_HS3;
  /* 집에서 돌릴 때는 gas 에서 꺼내 씁니다 (서버에는 WORK_KEY 로 보냅니다) */
  if (!out.WORK_KEY && fs.existsSync(path.join(여기, '..', 'gas', 'wage.js'))) {
    const g = fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8');
    out.WORK_KEY = (g.match(/const WORK_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1] || '';
  }
  return out;
}
const cfg = env();
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/* ④ HTML 기호가 두 번·세 번 겹쳐 옵니다. **바뀌지 않을 때까지** 풉니다 */
function 겹친것풀기(s0) {
  let s = String(s0 == null ? '' : s0);
  for (let i = 0; i < 5; i++) {
    const 앞 = s;
    s = s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&amp;/g, '&');
    if (s === 앞) break;
  }
  return s.replace(/\s+/g, ' ').trim();
}

/* ⑤ 지역 — gas 의 regionNorm_ 과 같은 규칙입니다.
   「전남광주 광산구」 처럼 광주 자치구가 붙은 것은 광주로, 나머지는 전남으로.
   **화성시 만세구·효행구, 인천 서해구는 진짜 행정구역이라 안 건드립니다.** */
const 시도줄임 = { 충청북: '충북', 충청남: '충남', 전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남' };
function 지역손질(v) {
  return String(v || '').split(',').map((s0) => s0.trim().replace(/\s+/g, ' ')
    .replace(/^전남광주(통합특별시)?\s*(동구|서구|남구|북구|광산구)(?![가-힣])/, '광주 $2')
    .replace(/^전남광주(통합특별시)?\s*/, '전남 ')
    .replace(/^(경기|강원|충청북|충청남|전라북|전라남|경상북|경상남|제주|전북)(특별자치도|도)?\s*/,
      (_, a) => (시도줄임[a] || a) + ' ')
    .replace(/^(서울|부산|대구|인천|광주|대전|울산)(특별시|광역시)\s*/, '$1 ')
    .replace(/^세종특별자치시\s*/, '세종 ')
    .trim()).filter(Boolean).join(', ');
}

/* 시설 어림 — 응답에 기관 종류가 없어 이름으로 짐작합니다.
   **짐작이라는 것을 화면에 밝혀야 합니다** */
const 요양꼴 = /요양원|요양병원|주간보호|데이케어|노인복지|실버|재가장기요양|방문요양|양로/;
const 병원꼴 = /병원|의원|의료원|클리닉|센터|재활|한방/;
const 시설어림 = (이름, 업종) => {
  const t = String(이름 || '') + ' ' + String(업종 || '');
  if (요양꼴.test(t)) return '요양';
  if (병원꼴.test(t)) return '병원';
  return '기타';
};

function 아이템들(t) {
  return [...String(t).matchAll(/<wanted>([\s\S]*?)<\/wanted>/g)].map((x) => {
    const o = {};
    for (const f of x[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = 겹친것풀기(f[2]);
    return o;
  });
}

async function 받기(주소, 다시 = 3) {
  for (let t = 0; t <= 다시; t++) {
    try {
      const r = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const 글 = await r.text();
      if (r.ok) return { code: r.status, 글 };
      if (t === 다시) return { code: r.status, 글 };
    } catch (e) {
      if (t === 다시) return { code: 0, 글: '', 왜: String(e.message).slice(0, 90) };
    }
    await 쉼(1500 * (t + 1));
  }
  return { code: 0, 글: '' };
}
const 주소만들기 = (o) => URL_ + '?' + Object.entries({ authKey: cfg.WORK_KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
/* 로그에 열쇠가 찍히지 않게 */
const 가리기 = (t) => (cfg.WORK_KEY ? String(t).split(cfg.WORK_KEY).join('‹열쇠›') : String(t));

/* ── 본체 ─────────────────────────────────────────────────── */
const t0 = Date.now();
if (한줄) console.log = () => {};

console.log('워크넷 새 수집기 (' + SOURCE + ') · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · **--dry**' : ''));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          고용24 authKey ' + (cfg.WORK_KEY ? '있음 (' + cfg.WORK_KEY.length + '자)' : '**없음**')
  + ' · Supabase ' + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_WN2 ? '있음' : '**없음**'));
console.log('  직종          ' + 직종.map((c) => c + ' ' + 직종이름[c]).join(' · '));
if (!cfg.WORK_KEY) { console.error('WORK_KEY 가 없습니다'); process.exit(1); }
if (!dry && !cfg.COLLECT_KEY_WN2) { console.error('COLLECT_KEY_WN2 가 없습니다'); process.exit(1); }

const 셈 = {
  읽은줄: 0, 남의직종: 0, 남의자리: 0, 마감지남: 0,
  회원: 0, 보류: 0, 쓰레기: 0, 못받은쪽: 0,
  날짜섞임: 0, 기호겹침: 0, 지역고침: 0, 사업자번호: 0,
};
const 보기 = { 날짜: [], 기호: [], 지역: [], 남의직종: [] };

console.log('\n① 목록 —');
const 모은것 = [];
let 전체 = null;
for (let 쪽 = 1; 쪽 <= 최대쪽; 쪽++) {
  const r = await 받기(주소만들기({ callTp: 'L', startPage: 쪽, display: 100, occupation: 직종.join('|') }));
  if (r.code !== 200 || !r.글) {
    셈.못받은쪽++;
    console.error('  ' + 쪽 + '쪽 HTTP ' + r.code + ' · ' + (r.왜 || '')
      + ' · 응답 앞 500자 — ' + 가리기(r.글).replace(/\s+/g, ' ').slice(0, 500));
    break;
  }
  if (전체 === null) {
    전체 = Number((r.글.match(/<total>(\d+)<\/total>/) || [])[1] || 0);
    console.log('  접수 중인 공고 ' + 전체 + '건');
  }
  const 줄 = 아이템들(r.글);
  if (!줄.length) break;
  셈.읽은줄 += 줄.length;
  모은것.push(...줄);
  console.log('  ' + 쪽 + '쪽 ' + 줄.length + '건');
  if (모은것.length >= 전체) break;
  await 쉼(400);
}
console.log('  읽은 줄 ' + 셈.읽은줄 + (셈.못받은쪽 ? ' · 못 받은 쪽 ' + 셈.못받은쪽 : ''));

/* ── ② 거르고 다듬기 ──────────────────────────────────────── */
const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const 볼것 = [];
for (const r of 모은것) {
  /* ② 우리 직종이 아닌 것은 여기서 거릅니다 */
  if (!직종.includes(String(r.jobsCd || ''))) {
    셈.남의직종++;
    if (보기.남의직종.length < 5) 보기.남의직종.push(String(r.jobsCd) + ' · ' + String(r.title).slice(0, 40));
    continue;
  }
  const 제목 = String(r.title || '').trim();
  if (!제목) continue;
  if (/&amp;|&lt;|&gt;|&#/.test(String(r.title))) 셈.기호겹침++;

  /* ① 마감일 — 「채용시까지  26-11-07」 이 66% */
  const 섞임 = 채용시까지인가(r.closeDt);
  if (섞임) 셈.날짜섞임++;
  const 마감 = 날짜풀기(r.closeDt);
  if (섞임 && 보기.날짜.length < 3) 보기.날짜.push(String(r.closeDt) + '  →  ' + String(마감));
  if (마감 && 마감 < 오늘) { 셈.마감지남++; continue; }

  /* ⑤ 지역 */
  const 지역0 = String(r.region || '');
  const 지역 = 지역손질(지역0);
  if (지역 !== 지역0) { 셈.지역고침++; if (보기.지역.length < 3) 보기.지역.push('「' + 지역0 + '」 → 「' + 지역 + '」'); }

  if (r.busino) 셈.사업자번호++;

  /* 직군 — jobsCd 가 이미 우리 직종이라 확정입니다.
     306500(물리및작업치료사)은 둘 다이므로 「공통」 */
  const 직군코드 = String(r.jobsCd) === '306501' ? '물리치료사'
    : String(r.jobsCd) === '306502' ? '작업치료사' : '공통';
  const 제목직군 = matchJob(제목);
  if (notOurs(제목) || titleOtherOnly(제목)) { 셈.남의자리++; continue; }

  볼것.push({
    r, 제목, 지역, 마감, 섞임,
    직군: 제목직군 || 직군코드,
    근거: 제목직군 ? '제목' : '고용24 직종코드 ' + r.jobsCd,
  });
}
console.log('\n② 거르기 — 우리 직종이 아닌 것 ' + 셈.남의직종 + '건 · 남의 자리 ' + 셈.남의자리
  + '건 · 마감 지난 것 ' + 셈.마감지남 + '건 뺐습니다');
console.log('  고친 것 — 마감일 섞임 ' + 셈.날짜섞임 + '건 · 제목 기호 겹침 ' + 셈.기호겹침
  + '건 · 지역 ' + 셈.지역고침 + '건 · 사업자번호 ' + 셈.사업자번호 + '건 저장');
if (보기.남의직종.length) console.log('  남의 직종 보기 — ' + 보기.남의직종.join(' / '));
if (보기.날짜.length) 보기.날짜.forEach((x) => console.log('  마감일 — ' + x));
if (보기.지역.length) 보기.지역.forEach((x) => console.log('  지역 — ' + x));

/* ── ③ 갈래 ───────────────────────────────────────────────── */
const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const r = v.r;
  const 시설 = 시설어림(r.company, r.indTpNm);
  const 줄 = {
    id: 'WN' + String(r.wantedAuthNo || ''),      /* 옛 수집기와 같은 규칙 — 겹치면 안 덮습니다 */
    external_id: String(r.wantedAuthNo || ''),
    org_name: String(r.company || '').trim(),
    title: v.제목,
    employ_type: 고용형태(r.empTpCd),
    work_place: 지역손질(r.basicAddr || ''),
    sido: (v.지역.split(' ')[0] || ''),
    sgg: (v.지역.split(' ').slice(1).join(' ') || ''),
    edu: [r.minEdubg, r.maxEdubg].filter(Boolean).join('~'),
    apply_to: v.마감,
    posted_at: 날짜풀기(r.regDt),
    url: String(r.wantedInfoUrl || ''),           /* 약속 — 원문·지원은 고용24 원본으로 */
    job_group: v.직군,
    org_kind: 시설,
    detail: {
      출처: '고용24',                              /* 약속 — 출처를 밝힙니다 */
      근거: v.근거,
      직종코드: String(r.jobsCd || ''),
      직종이름: 직종이름[r.jobsCd] || '',
      사업자번호: String(r.busino || ''),          /* ⑥ 심평원 자료와 이을 용도 */
      업종: String(r.indTpNm || ''),
      급여: [r.salTpNm, r.sal].filter(Boolean).join(' '),
      경력: String(r.career || ''),
      휴일: String(r.holidayTpNm || ''),
      시설어림: 시설 + ' (기관 이름으로 어림 — 응답에 기관 종류가 없습니다)',
      ...(v.섞임 ? { 마감메모: '채용시까지 (마감 전이라도 사람이 정해지면 닫힙니다)' } : {}),
      모바일: String(r.wantedMobileInfoUrl || ''),
    },
    evidence: {},
  };
  const 갈래 = sortJob(v.제목, v.직군, null);
  if (갈래.갈래 === '회원목록') { 회원.push(줄); continue; }
  if (갈래.갈래 === '쓰레기통') {
    /* 직종코드가 우리 것인데 갈래가 쓰레기통이면 사람이 봐야 합니다. 버리지 않습니다 */
    줄.hold = true;
    줄.evidence = { 보류사유: '고용24 직종코드는 우리 것인데 제목 규칙이 걸렀습니다 — ' + (갈래.왜 || '') };
    보류.push(줄); continue;
  }
  줄.hold = true; 보류.push(줄);
}
셈.회원 = 회원.length; 셈.보류 = 보류.length; 셈.쓰레기 = 쓰레기.length;
console.log('\n③ 갈래 — 회원 목록 ' + 셈.회원 + ' · 보류함 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기);
console.log('   시설 어림 — 병원 ' + 회원.filter((x) => x.org_kind === '병원').length
  + ' · 요양 ' + 회원.filter((x) => x.org_kind === '요양').length
  + ' · 기타 ' + 회원.filter((x) => x.org_kind === '기타').length);
if (회원.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 (앞 8건) —');
  회원.slice(0, 8).forEach((r) => console.log('     ' + String(r.job_group).padEnd(8)
    + String(r.employ_type || '').padEnd(10) + String(r.apply_to || '날짜없음').padEnd(12)
    + String(r.org_name).slice(0, 18).padEnd(20) + String(r.title).slice(0, 38)));
}

/* ── ④ 담기 ───────────────────────────────────────────────── */
async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0;
  const 넣을것 = [...회원, ...보류];
  for (let i = 0; i < 넣을것.length; i += 100) {
    const r = await rpc('collect_put', { p_secret: cfg.COLLECT_KEY_WN2, p_source: SOURCE, p_rows: 넣을것.slice(i, i + 100) });
    담음 += r['담음'] || 0;
  }
  console.log('\n씀          ' + 담음 + '건');
  console.log(Math.round((Date.now() - t0) / 1000) + '초');
  try {
    await rpc('collect_beat', {
      p_secret: cfg.COLLECT_KEY_WN2, p_source: SOURCE,
      p_beat: { took_ms: Date.now() - t0, ok: true, 본곳: 1, 담음: 셈.회원 + 셈.보류,
        보류: 셈.보류, 버림: 셈.쓰레기, 못받음: 셈.못받은쪽,
        메모: { 읽은줄: 셈.읽은줄, 남의직종: 셈.남의직종, 마감지남: 셈.마감지남,
          날짜섞임: 셈.날짜섞임, 기호겹침: 셈.기호겹침, 지역고침: 셈.지역고침 } },
    });
  } catch (e) { console.error('박동 못 남김 · ' + String(e.message).slice(0, 120)); }
}

if (한줄) {
  console.error('── ' + SOURCE + ' · 읽은 줄 ' + 셈.읽은줄 + ' · 담은 줄 ' + (셈.회원 + 셈.보류)
    + ' · 회원 ' + 셈.회원 + ' · 보류 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기
    + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
}
