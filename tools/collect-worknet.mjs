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
import { 판정남기기, 지문 } from './순찰기억.mjs';
import { matchJob, notOurs, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { 날짜풀기, 채용시까지인가 } from './날짜.mjs';
import { 기관종별, 시설구분 } from './wn-kind.mjs';
/* ㉮ 덧갈래로 온 줄을 제목으로 가립니다 (2026-10-03 세중님 승인).
   새 앱 판정(gas-rules · 뽑을단어)을 그대로 쓰고 세 겹만 얹은 것입니다 */
import { 덧갈래가리기, 괄호풀기 } from './덧갈래판정.mjs';

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
/* 덧갈래 (면허 3 · 낱말 4) — `--덧` 을 줄 때만 돕니다. 하루 3회만 걸 생각입니다.
   갈래마다 첫 쪽만 보고, 꽉 찼으면 한 쪽 더까지 (--덧쪽 으로 바꿀 수 있습니다) */
const 덧켬 = argv.includes('--덧');
const 덧최대쪽 = 값('--덧쪽', 2);

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

/* 기관종별은 **gas/wage.js 의 wnKind_ 규칙을 떼어** 씁니다 (tools/wn-kind.mjs).
   옛 수집기가 이미 그 말로 1,000건 가까이 담아 놨습니다 —
   요양원·주야간보호 107 · 요양병원 47 · 공공·복지기관 43 …
   여기서 새로 만들면 두 벌이 되어 한쪽만 고치게 됩니다. */

function 아이템들(t) {
  return [...String(t).matchAll(/<wanted>([\s\S]*?)<\/wanted>/g)].map((x) => {
    const o = { 원문: {} };
    for (const f of x[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      o.원문[f[1]] = f[2];              /* 푼 뒤만 들고 있으면 「고치기 전」 을 못 셉니다 */
      o[f[1]] = 겹친것풀기(f[2]);
    }
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
  코드틀림: 0,
};
const 보기 = { 날짜: [], 기호: [], 지역: [], 남의직종: [], 코드틀림: [] };

/* ── 이상한 응답을 스스로 잡습니다 (2026-10-02) ──────────────────
   고용24 는 **하루 호출 한도를 어디에도 밝히지 않습니다.** 문서 두 곳,
   data.go.kr, 응답 헤더 13개, 응답 본문을 다 봤는데 없었습니다.
   그래서 주기를 하루 3회 → 16회로 올리면서 「이상하면 바로 멈추는」 장치를 둡니다.

   정상 응답은 반드시 <wantedRoot> 로 시작합니다. 200 인데 그게 아니면
   (한도 초과·열쇠 거절·점검 화면 등) **원문을 남기고 exit 1 로 멈춥니다.**
   그러면 ~/워크넷크론.sh 가 주기를 하루 3회로 되돌립니다. */
const 로그터 = (process.env.HOME || process.env.USERPROFILE || '.') + '/log';
function 이상한응답남기기(쪽, r) {
  try {
    fs.mkdirSync(로그터, { recursive: true });
    const 글 = '[' + new Date().toISOString() + '] ' + 쪽 + '쪽 · HTTP ' + r.code
      + ' · ' + (r.왜 || '') + '\n' + 가리기(r.글).slice(0, 1200) + '\n\n';
    fs.appendFileSync(로그터 + '/워크넷_이상.log', 글);
  } catch (e) { console.error('이상 기록 실패 · ' + String(e.message).slice(0, 120)); }
}
/* 하루 호출 수 — 나중에 한도를 문의할 때 근거로 씁니다 */
let 호출수 = 0;
function 호출수남기기() {
  try {
    fs.mkdirSync(로그터, { recursive: true });
    const 파일 = 로그터 + '/워크넷_호출수.json';
    let 표 = {};
    try { 표 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { /* 처음이면 빈 표 */ }
    const 날 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    표[날] = (표[날] || 0) + 호출수;
    /* 60일치만 들고 있습니다 */
    const 날들 = Object.keys(표).sort();
    while (날들.length > 60) delete 표[날들.shift()];
    fs.writeFileSync(파일, JSON.stringify(표, null, 1));
    console.log('  호출 ' + 호출수 + '번 · 오늘 누적 ' + 표[날] + '번 (한도는 공개 안 됨)');
  } catch (e) { console.error('호출 수 기록 실패 · ' + String(e.message).slice(0, 120)); }
}

/* ── 덧갈래 — 면허 3 · 낱말 4 (2026-10-03 · 세중님 승인) ──────────
 *
 *  왜 붙이나 — 2026-10-03 짝 대조에서 **옛것만 읽은 접수 중 83건**이 나왔습니다.
 *  옛 WN(gas/wage.js 2577줄 WN_QUERIES)은 여덟 갈래로 찾는데 여기는 직종코드
 *  한 갈래뿐이었습니다. 「요양원인데 제목에 물리치료사가 있는」 공고가
 *  낱말 검색으로만 잡힙니다.
 *
 *  호출을 줄이는 방식 (세중님이 못 박으신 것)
 *    · 직종코드 갈래는 **그대로** — 하루 16회 · 최대 10쪽
 *    · 덧갈래는 `--덧` 을 줄 때만 돕니다 — 하루 3회 · **갈래마다 첫 쪽만**
 *      → 한 바퀴 7회. 첫 쪽이 꽉 차고 맨 아래가 처음 보는 번호면 그때만 한 쪽 더
 *    · 순찰 기억으로 이미 판정한 번호는 상세를 안 엽니다
 *    · 이상한 응답을 받으면 **그 갈래만** 접고 넘어갑니다 (직종 갈래와 달리
 *      전체를 멈추지 않습니다 — 덧갈래는 거드는 것이라 하나 빠져도 본 목록은 옵니다)
 *
 *  옛 WN 과 같은 값입니다. 짐작해 만들지 않았습니다 — gas 에서 그대로 옮겼습니다. */
const 덧갈래 = [
  ['면허6006184', { certLic: '6006184' }],
  ['면허6006189', { certLic: '6006189' }],
  ['면허6099839', { certLic: '6099839' }],
  ['낱말작업치료', { keyword: '작업치료' }],
  ['낱말작업치료사', { keyword: '작업치료사' }],
  ['낱말물리치료', { keyword: '물리치료' }],
  ['낱말물리치료사', { keyword: '물리치료사' }],
];

console.log('\n① 목록 —');
const 모은것 = [];
let 전체 = null;
let 이상 = false;
for (let 쪽 = 1; 쪽 <= 최대쪽; 쪽++) {
  const r = await 받기(주소만들기({ callTp: 'L', startPage: 쪽, display: 100, occupation: 직종.join('|') }));
  호출수++;
  if (r.code !== 200 || !r.글) {
    셈.못받은쪽++;
    이상 = true;
    이상한응답남기기(쪽, r);
    console.error('  ★ ' + 쪽 + '쪽 HTTP ' + r.code + ' · ' + (r.왜 || '')
      + ' · 응답 앞 500자 — ' + 가리기(r.글).replace(/\s+/g, ' ').slice(0, 500));
    break;
  }
  /* 200 인데 wantedRoot 가 아니면 한도 초과·열쇠 거절·점검 화면입니다 */
  if (!/<wantedRoot[\s>]/.test(r.글)) {
    셈.못받은쪽++;
    이상 = true;
    이상한응답남기기(쪽, r);
    console.error('  ★ ' + 쪽 + '쪽 HTTP 200 인데 wantedRoot 가 아닙니다'
      + ' · ' + r.글.length + '자 · 앞 500자 — ' + 가리기(r.글).replace(/\s+/g, ' ').slice(0, 500));
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

/* ── ①-2 덧갈래 (--덧 일 때만) ────────────────────────────────── */
if (덧켬 && !이상) {
  console.log('\n①-2 덧갈래 — 면허 3 · 낱말 4 (갈래마다 첫 쪽만)');
  const 이미 = new Set(모은것.map((x) => String(x.wantedAuthNo || '')));
  for (const [이름, 인자] of 덧갈래) {
    let 더한것 = 0;
    for (let 쪽 = 1; 쪽 <= 덧최대쪽; 쪽++) {
      const r = await 받기(주소만들기({ callTp: 'L', startPage: 쪽, display: 100, ...인자 }));
      호출수++;
      /* 이상한 응답이면 **그 갈래만** 접습니다. 본 목록은 이미 받았습니다 */
      if (r.code !== 200 || !r.글 || !/<wantedRoot[\s>]/.test(r.글)) {
        셈.못받은쪽++;
        이상한응답남기기(이름 + ' ' + 쪽 + '쪽', r);
        console.error('  ★ ' + 이름 + ' ' + 쪽 + '쪽 — HTTP ' + r.code
          + (r.글 && !/<wantedRoot[\s>]/.test(r.글) ? ' (200 인데 wantedRoot 가 아닙니다)' : '')
          + ' · 이 갈래만 접습니다 · 앞 300자 — '
          + 가리기(String(r.글 || '')).replace(/\s+/g, ' ').slice(0, 300));
        break;
      }
      const 줄 = 아이템들(r.글);
      if (!줄.length) break;
      let 새것 = 0;
      for (const x of 줄) {
        const no = String(x.wantedAuthNo || '');
        if (!no) continue;
        if (이미.has(no)) {
          /* 본 갈래가 **먼저** 집어간 줄입니다. 그래도 덧갈래에도 걸렸다는
             표시는 남겨야 합니다 — 안 그러면 겹치는 줄이 ㉮ 판정을 영영
             못 받습니다 (2026-10-04 에 「물리(작업)치료사 모집」이 그래서
             버려지고 있는 것을 보고 고쳤습니다) */
          const 먼저 = 모은것.find((y) => String(y.wantedAuthNo || '') === no);
          if (먼저 && !먼저.__덧) 먼저.__덧 = 이름;
          continue;
        }
        /* ㉮ 표시 — 덧갈래로 온 줄입니다. 직종코드가 우리 것이 아닐 수밖에
           없으므로(면허·낱말로 찾았으니) 아래 ②에서 코드 검사를 건너뛰고
           **제목으로** 가립니다 (2026-10-03 세중님 승인) */
        x.__덧 = 이름;
        이미.add(no); 모은것.push(x); 새것++;
      }
      더한것 += 새것;
      셈.읽은줄 += 줄.length;
      /* 첫 쪽이 꽉 차고(100건) 그 쪽에서 처음 보는 것이 있었으면 한 쪽 더.
         아니면 거기서 멈춥니다 — 호출을 아끼는 자리입니다 */
      if (줄.length < 100 || 새것 === 0) break;
      await 쉼(400);
    }
    console.log('  ' + 이름.padEnd(14) + '새로 더한 것 ' + 더한것 + '건');
  }
  console.log('  덧갈래 뒤 모은 것 ' + 모은것.length + '건');
}

호출수남기기();
/* 이상한 응답을 한 번이라도 받으면 **담지 않고 멈춥니다.**
   반쪽만 읽은 목록으로 담으면 멀쩡한 공고가 사라진 것처럼 보입니다.
   exit 1 을 보고 ~/워크넷크론.sh 가 주기를 하루 3회로 되돌립니다 */
if (이상) {
  console.error('\n★ 이상한 응답을 받아 멈춥니다 — 담지 않았습니다');
  console.error('   원문은 ' + 로그터 + '/워크넷_이상.log 에 남겼습니다');
  process.exit(1);
}

/* ── ② 거르고 다듬기 ──────────────────────────────────────── */
const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const 볼것 = [];
for (const r of 모은것) {
  /* ② 우리 직종이 아닌 것은 여기서 거릅니다.
     **다만 제목에 우리 직군이 또렷하면 버리지 않고 보류함으로 보냅니다** (2026-10-02).
     사업주가 직종코드를 엉뚱하게 넣는 일이 있습니다. 실측으로 확인했습니다 —
       대명노인전문요양원 「물리치료사/작업치료사 채용」   jobsCd 307903
       삼성요양원 「… 작업,물리치료사 …」               jobsCd 550100 (요양보호사)
     우리가 받는 코드는 306500·306501·306502 뿐이라, 코드만 믿으면 이런 공고를
     **조용히 버립니다.** 「못 가린 공고는 버리지 말고 보류함으로」가 우리 원칙입니다.
     제목에 우리 직군이 없는 것(운동처방사·특수교사·요양보호사 강사 등)은
     지금처럼 버립니다 — 그래야 보류함이 안 넘칩니다. */
  /* ㉮ 덧갈래로 온 줄 — 직종코드 검사를 건너뜁니다 (2026-10-03 세중님 승인).
     면허·낱말로 찾아온 것이라 코드가 우리 것일 리가 없습니다. 코드로 거르면
     **덧갈래를 붙인 뜻이 통째로 없어집니다.**
     대신 tools/덧갈래판정.mjs 가 제목으로 가립니다 — 새 앱의 판정
     (gas-rules · 뽑을단어)을 그대로 쓰고 그 위에 세 겹만 얹은 것입니다.
       · 시설 설명인가   「물리치료실 완비 요양보호사 모집」을 안 올립니다
       · 괄호 꼴         「물리(작업)치료사」를 우리 직군으로 읽습니다
       · 잘린 제목       「… 공공어린이재활의료센터(목포중앙병원) ...」을 안 버립니다 */
  /* ★ 직종코드가 **이미 우리 것**이면 ㉮ 판정을 쓰지 않습니다.
     고용24가 우리 직종이라고 적어 준 공고는 그걸로 확인된 것입니다.
     제목만 보고 다시 가리면 「○○요양원 직원 채용」처럼 제목이 뭉뚱그려진
     멀쩡한 공고가 보류함으로 떨어집니다.
     2026-10-04 에 이걸 빠뜨려 회원 목록이 243 → 230 으로 줄었습니다. */
  if (r.__덧 && !직종.includes(String(r.jobsCd || ''))) {
    const 가림 = 덧갈래가리기({ 제목: String(r.title || ''), 기관: String(r.company || '') });
    if (가림.갈래 === '버림') {
      셈.남의직종++;
      if (보기.남의직종.length < 5) 보기.남의직종.push('[덧] ' + String(r.title || '').slice(0, 40));
      continue;
    }
    r.__덧판정 = 가림;          // 아래 ③에서 회원목록/보류함을 가릅니다
  } else if (!직종.includes(String(r.jobsCd || ''))) {
    const 제목만 = String(r.title || '');
    /* 괄호 꼴을 펼쳐서 봅니다 — 「물리(작업)치료사」를 matchJob 이 못 읽습니다.
       2026-10-04 에 「* 물리(작업)치료사 모집」(jobsCd 307903)이 조용히
       버려지고 있는 것을 보고 넣었습니다. 펼친 말을 뒤에 붙이면
       matchJob 이 둘 다 보고 「공통」까지 알아서 가립니다 */
    const 펼친말 = 괄호풀기(제목만);
    const 볼제목 = 펼친말.length ? 제목만 + ' ' + 펼친말.join(' ') : 제목만;
    const 우리것 = matchJob(볼제목) && !notOurs(제목만);
    if (!우리것) {
      셈.남의직종++;
      if (보기.남의직종.length < 5) 보기.남의직종.push(String(r.jobsCd) + ' · ' + 제목만.slice(0, 40));
      continue;
    }
    셈.코드틀림++;
    if (보기.코드틀림.length < 8) {
      보기.코드틀림.push('jobsCd ' + String(r.jobsCd) + ' · ' + String(r.company || '').slice(0, 18)
        + ' · ' + 제목만.slice(0, 40));
    }
    r.__코드틀림 = String(r.jobsCd || '');
  }
  const 제목 = String(r.title || '').trim();
  if (!제목) continue;
  /* ④ 원문(푸는 앞)을 봐야 합니다 */
  const 제목원문 = String((r.원문 || {}).title || '');
  if (/&amp;|&lt;|&gt;|&#/.test(제목원문)) {
    셈.기호겹침++;
    if (보기.기호.length < 3) 보기.기호.push('「' + 제목원문.slice(0, 48) + '」  →  「' + 제목.slice(0, 48) + '」');
  }

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
/* ★ 이 보고는 **거르기 고리 뒤**에 있어야 합니다 — 목록 받기 요약에 붙였더니
   셈이 아직 0 일 때 찍혀 아무것도 안 나왔습니다 (2026-10-02 에 그렇게 틀렸습니다) */
if (셈.코드틀림) {
  console.log('\n  ★ 직종코드는 남의 것인데 제목에 우리 직군이 있는 공고 '
    + 셈.코드틀림 + '건 — 회원 목록으로 (근거에 코드를 남깁니다)');
  for (const x of 보기.코드틀림) console.log('     ' + x);
}
if (보기.기호.length) 보기.기호.forEach((x) => console.log('  제목 기호 — ' + x));
if (보기.날짜.length) 보기.날짜.forEach((x) => console.log('  마감일 — ' + x));
if (보기.지역.length) 보기.지역.forEach((x) => console.log('  지역 — ' + x));

/* ── ③ 갈래 ───────────────────────────────────────────────── */
const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const r = v.r;
  const 종별 = 기관종별(r.indTpNm, r.company);
  /* 나중에 만들 「전체 / 병원 / 요양」 화면용. **아직 화면에 안 씁니다** */
  const 구분 = 시설구분(종별.종별, r.company);
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
    org_kind: 종별.종별,
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
      시설구분: 구분,                              /* 병원 · 요양·주간보호 · 모름 */
      기관종별근거: 종별.왜,                        /* 업종 신고 · 이름 추정 */
      ...(v.섞임 ? { 마감메모: '채용시까지 (마감 전이라도 사람이 정해지면 닫힙니다)' } : {}),
      모바일: String(r.wantedMobileInfoUrl || ''),
    },
    evidence: {},
  };
  const 갈래 = sortJob(v.제목, v.직군, null);
  /* 직종코드가 틀린 공고 — **회원 목록으로 올립니다** (2026-10-02 세중님 결정).
     처음엔 보류함으로 보냈는데, 그러면 토요일 주인 넘기기 때 **지금 회원 화면에
     보이는 공고가 사라집니다.** 옛 WN 이 제목을 보고 이미 제대로 올려 둔 것을
     새 수집기가 치우는 꼴입니다.
     직군을 **못 가린** 게 아니라 **남이 코드를 잘못 넣은** 것입니다.
     그래서 제목으로 가린 직군 그대로 올리고, 근거에 코드만 적어 둡니다 —
     나중에 「코드가 틀린 공고가 얼마나 되나」를 셀 수 있게. */
  /* ㉮ 덧갈래로 온 줄은 덧갈래판정이 내린 대로 갑니다 */
  if (v.r && v.r.__덧판정) {
    const 가림 = v.r.__덧판정;
    if (가림.갈래 === '보이기') {
      v.__판정 = '회원목록';
      줄.hold = false;
      줄.evidence = { 덧갈래: v.r.__덧 + ' — ' + 가림.왜 };
      회원.push(줄); continue;
    }
    v.__판정 = '보류함';
    줄.hold = true;
    줄.evidence = { 보류사유: '[덧갈래 ' + v.r.__덧 + '] ' + 가림.왜 };
    보류.push(줄); continue;
  }
  if (v.r && v.r.__코드틀림) {
    v.__판정 = '회원목록';
    줄.hold = false;
    줄.evidence = { 직종코드다름: 'jobsCd ' + v.r.__코드틀림
      + ' — 우리 코드(306500·306501·306502)가 아닙니다. 제목으로 직군을 가렸습니다' };
    회원.push(줄); continue;
  }
  if (갈래.갈래 === '회원목록') { v.__판정 = '회원목록'; 회원.push(줄); continue; }
  if (갈래.갈래 === '쓰레기통') {
    /* 직종코드가 우리 것인데 갈래가 쓰레기통이면 사람이 봐야 합니다. 버리지 않습니다 */
    줄.hold = true;
    줄.evidence = { 보류사유: '고용24 직종코드는 우리 것인데 제목 규칙이 걸렀습니다 — ' + (갈래.왜 || '') };
    v.__판정 = '보류함';
    보류.push(줄); continue;
  }
  v.__판정 = '보류함';
  줄.hold = true; 보류.push(줄);
}
셈.회원 = 회원.length; 셈.보류 = 보류.length; 셈.쓰레기 = 쓰레기.length;
/* 내린 판정을 기억에 남깁니다 — 10/3 짝 대조용 (2026-10-02).
   워크넷 응답에는 **smodifyDtm(수정일시)** 가 있습니다 (예 202610011621).
   원 출처가 「언제 고쳤나」를 알려주면 그게 지문보다 정확합니다 —
   알리오·나라일터에는 그 칸이 없어서 목록 줄 지문을 쓰고 있습니다 */
if (!dry) {
  await 판정남기기(cfg, { 열쇠: cfg.COLLECT_KEY_WN2 || cfg.COLLECT_KEY_HS3 || '', source: SOURCE,
    줄들: 볼것.filter((v) => v.__판정 && v.r && v.r.wantedAuthNo)
      .map((v) => ({ 번호: String(v.r.wantedAuthNo), 판정: v.__판정,
        지문: 지문({ m: String(v.r.smodifyDtm || ''), t: v.제목 }) })) });
}
console.log('\n③ 갈래 — 회원 목록 ' + 셈.회원 + ' · 보류함 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기);
const 구분셈 = {};
회원.forEach((x) => { const g = x.detail.시설구분; 구분셈[g] = (구분셈[g] || 0) + 1; });
console.log('   시설 구분 (아직 화면에 안 씁니다) — '
  + Object.entries(구분셈).map(([k, v]) => k + ' ' + v).join(' · '));
const 종별셈 = {};
회원.forEach((x) => { 종별셈[x.org_kind] = (종별셈[x.org_kind] || 0) + 1; });
console.log('   기관종별 — ' + Object.entries(종별셈).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => k + ' ' + v).join(' · '));
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

  /* ── 덧갈래 박동 (2026-10-04 세중님 지시) ──────────────────────
     덧갈래 크론(`워크넷덧크론.sh`)은 탈나면 **제 crontab 줄만 스스로 끕니다.**
     그러면 조용히 멈추고 아무도 모릅니다.

     그래서 `--덧` 으로 돌 때마다 **따로 박동을 남깁니다**(경로 WNX).
     크론이 스스로 꺼지면 박동이 끊기고, `beat_health()` 가 평소 간격의
     2배를 넘긴 것을 보고 관리자 화면(/admin/beat)에 **빨간 줄**을 띄웁니다.
     새 화면을 만들 필요가 없습니다 — 이미 있는 장치를 쓰는 것입니다. */
  if (덧켬) {
    try {
      await rpc('collect_beat', {
        p_secret: cfg.COLLECT_KEY_WN2, p_source: 'WNX',
        p_beat: { took_ms: Date.now() - t0, ok: true, 본곳: 덧갈래.length,
          담음: 셈.회원 + 셈.보류, 보류: 셈.보류,
          메모: { 덧갈래수: 덧갈래.length, 읽은줄: 셈.읽은줄 } },
      });
    } catch (e) { console.error('덧갈래 박동 못 남김 · ' + String(e.message).slice(0, 120)); }
  }
}

if (한줄) {
  console.error('── ' + SOURCE + ' · 읽은 줄 ' + 셈.읽은줄 + ' · 담은 줄 ' + (셈.회원 + 셈.보류)
    + ' · 회원 ' + 셈.회원 + ' · 보류 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기
    + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
}
