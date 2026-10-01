/* 나라일터 수집기 (GJ2) — 시트를 거치지 않고 DB 에 바로 담습니다 (2026-09-30).
 *
 *   node tools/collect-nara.mjs --dry        담지 않고 옛 수집기(GJ)와 대조만
 *   node tools/collect-nara.mjs --dry --한줄  사흘 대조용 한 줄만
 *   node tools/collect-nara.mjs              정말로 담습니다 (source = GJ2)
 *   node tools/collect-nara.mjs --상세 0      상세 열기를 끕니다
 *   node tools/collect-nara.mjs --쪽 5        5쪽만
 *
 * ── 어디서 받나 ──────────────────────────────────────────────
 * 인사혁신처 「공공취업정보 조회 서비스」 (운영계정 · 일 10만건)
 *   https://apis.data.go.kr/1760000/PblJobService
 *
 * 세 가지를 다 씁니다 (신청 화면의 상세기능 전부 — CLAUDE.md 4번) —
 *   /getList       목록. Begin_de · End_de · Sort_order=2(최신순) 가 먹습니다
 *   /getItem       상세. contents 에 모집분야·자격요건이 글로 들어 있습니다
 *   /getItemFile   첨부. filename · filepath (downFile.do?...)
 *
 * 2026-09-30 에 응답 원문을 찍어 항목 이름을 눈으로 확인했습니다 —
 *   목록  areacode · begindate · enddate · idx · insttname · moddate
 *         · readnum · regdate · title · type01 · type02
 *   상세  위 + areaname · contents · insttcode · link01~03
 *   첨부  filename · filepath · filesize · idx · parentidx · sort
 *
 * ── 왜 제목만 보면 안 되나 ───────────────────────────────────
 * 보건소 공고는 제목에 직종을 안 씁니다 —
 *     "결핵관리사업 기간제근로자 채용"
 *     "지역사회중심재활사업 기간제근로자 채용"
 * 그래서 재활·보건 냄새가 나는 것을 골라 상세를 열고, 거기에도 없으면
 * 첨부 공고문(PDF·HWP)까지 읽습니다. 그래도 못 가리면 **보류함**으로 보냅니다.
 * 버리지 않습니다.
 *
 * ── 규칙은 한 벌입니다. 여기서 만들지 않습니다 ────────────────
 *   갈래 판정   tools/sort-rule.mjs    (gas 와 같은 한 벌)
 *   직군 낱말   tools/gas-rules.mjs
 *   첨부 글자   tools/ocr · tools/hwp
 *   부르기     tools/공공데이터부르기.mjs  (간격 · 429 · 하루 한도)
 *   쓰기       DB 의 collect_put()
 *   박동       DB 의 collect_beat()   ← 안 돌면 관리자 화면에 빨간 줄
 *
 * ── 열쇠 ─────────────────────────────────────────────────────
 *   ALIO_DETAIL_KEY (공공데이터포털 인증키) · SUPABASE_URL · SUPABASE_ANON_KEY
 *   COLLECT_KEY_GJ2 (없으면 COLLECT_KEY_HS3 — 같은 값입니다)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 공공부르기, 한도알리기, 한도들 } from './공공데이터부르기.mjs';
import { pdf글자, 쓸수있나 as OCR쓸수있나, 이름표 as OCR이름표 } from './ocr/index.mjs';
import { hwp글자, 한글파일인가 } from './hwp/index.mjs';
import { sortJob } from './sort-rule.mjs';
import { matchJob, notOurs, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { 첨부직군 } from './첨부직군.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'GJ2';
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const 원문주소 = (idx) => 'https://www.gojobs.go.kr/apmView.do?empmnsn=' + idx;

/* ── 설정 ─────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? Number(argv[i + 1]) : 기본;
};
const dry = argv.includes('--dry');
const 한줄 = argv.includes('--한줄');
/* --첨부셈만 — 첨부를 **열지 않고 몇 건이 열릴지만 셉니다** (2026-10-02).
   줄 330 의 「의료 냄새 없으면 안 연다」 규칙을 넓히기 전에, 부담이 얼마나
   늘지 OCR 한 건도 안 쓰고 재려고 만들었습니다. 담지도 않습니다. */
const 첨부셈만 = argv.includes('--첨부셈만');
const 최대쪽 = 값('--쪽', 30);
const 상세몫 = 값('--상세', 600);
const 며칠 = 값('--날', 30);

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
  /* GJ2 열쇠는 HS3 서버 전용 값과 **같은 값**입니다 (값을 옮기지 않으려고) */
  out.COLLECT_KEY_GJ2 = out.COLLECT_KEY_GJ2 || out.COLLECT_KEY_HS3;
  return out;
}
const cfg = env();

/* ── 잔심부름 ─────────────────────────────────────────────── */
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));
/* 엔티티가 **두 번** 감싸여 오는 줄이 있습니다 — `&amp;amp;` (2026-10-01).
   한 번만 풀면 `&amp;` 가 남아 회원 화면에 「식음팀(F&amp;B)」 처럼 보입니다.
   클린아이 수집기는 이미 반복해서 풉니다. 같은 방식으로 맞춥니다 —
   **변화가 없을 때까지** 풉니다 (돌고 도는 것을 막으려 최대 5번). */
const 한번풀기 = (s) => String(s == null ? '' : s)
  .replace(/&amp;/g, '&').replace(/&#38;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x?[0-9A-Fa-f]+;/g, (m) => {
    const n = m[2] === 'x' || m[2] === 'X'
      ? parseInt(m.slice(3, -1), 16) : parseInt(m.slice(2, -1), 10);
    return Number.isFinite(n) ? String.fromCharCode(n) : ' ';
  });

const 풀기 = (s) => {
  let v = String(s == null ? '' : s);
  for (let i = 0; i < 5; i++) {
    const 다음 = 한번풀기(v);
    if (다음 === v) break;
    v = 다음;
  }
  return v.trim();
};

/** XML <item> 들을 { 태그: 값 } 으로. 가벼운 파서입니다 */
function 아이템들(글) {
  const out = [];
  for (const m of String(글).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const o = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = 풀기(f[2]);
    out.push(o);
  }
  return out;
}

const 날짜 = (d) => {
  const s = String(d || '').replace(/[^0-9]/g, '');
  return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : null;
};
const 오늘8 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
const 날 = (d) => new Date(Date.now() + d * 86400000 + 9 * 3600000).toISOString().slice(0, 10);

/* 고용형태 코드 — gas 의 job3Type_ 과 같은 표입니다 */
const 고용형태표 = {
  e01: '공무원', e02: '공무원', e03: '공무원',
  e07: '정규직', e08: '기간제', e09: '무기계약직', e10: '시간선택제',
};
const 고용형태 = (t) => 고용형태표[String(t || '').trim()] || '';

/* 제목·기관에 이 냄새가 나면 상세를 열어 봅니다 (gas 의 PEEK 과 같은 말들) */
const 열어볼말 = ['재활', '치매', '정신건강', '방문건강', '건강증진', '지역사회',
  '장애', '노인', '복지관', '발달', '보건지소', '통합돌봄', '치료', '작업', '물리',
  '보건소', '보건의료원', '건강센터', '요양', '돌봄', '재가', '아동센터', '주간보호', '장애인'];
/* 이 말이 있으면 안 엽니다. 명백히 다른 자리이거나 공고가 아닙니다 */
const 안열말 = /간호사|의사|한의사|약사|치과|영양사|방사선|임상병리|사회복지사|행정|운전|환경미화|시설관리|교사|강사|경비|조리|통역|전산|합격자|최종합격|명단|결과\s*발표|서류전형\s*합격|면접대상|필기시험\s*장소|시험장소|취소\s*공고|정정\s*공고|연기\s*공고/;
/* 이 기관·제목이면 아예 안 엽니다 — 교육청·법원·교정시설에는 치료사 자리가 거의 없습니다 */
const 비의료기관 = /교육청|교육지원청|초등학교|중학교|고등학교|대학교\s*부설|법원|검찰|교도소|구치소|보호관찰|세무서|국세청|관세청|병무청|국회/;
const 의료냄새 = /치료|재활|보건|의료|병원|간호|복지|센터|요양|장애|치매|특수교육/;
/* 지자체·공공 **통합공고** — 제목이 「임기제공무원 임용시험 시행계획」처럼
   뭉뚱그려져 있어 의료 냄새가 안 나지만, 첨부에는 직렬이 쭉 적혀 있고 그 안에
   보건직이 섞입니다. **제목에 직군이 없으면 첨부까지 보는 것이 우리 원칙**입니다
   (2026-10-02 세중님 지시). 그래서 이 말이 있으면 냄새가 없어도 첨부를 엽니다.
   안열말·비의료기관 관문은 이보다 앞에서 돌아 그대로 걸러집니다 */
const 통합공고말 = /임기제공무원|임용시험|경력경쟁\s*임용|공무원\s*(채용|임용)|채용시험\s*시행계획|통합\s*채용/;
/* 처음에는 「기간제·공무직·계약직」까지 넣었다가 105건 → 290건(+176%) 으로
   불었습니다. 본보기를 보니 우체국 집배원·소포배달원·청원경찰이었습니다 —
   거기에는 보건직이 없습니다. 그래서 **지자체·국가 공무원 임용시험**만
   남겼습니다. 그런 공고의 첨부에는 직렬표가 있고 보건직이 섞입니다.
   우정사업본부는 공무원 채용도 집배 쪽이라 따로 뺍니다 */
const 통합공고에서뺄곳 = /우정사업본부|우체국|청원경찰|집배|소포배달/;
/* 먼저 여는 것 — 1차 목표 */
const 먼저 = /지역사회중심재활|치매안심센터|치매|보건소|보건의료원|보건지소|재활/;

/* ── DB ───────────────────────────────────────────────────── */
async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  if (!k) throw new Error('SUPABASE_ANON_KEY 가 없습니다');
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 300));
  try { return JSON.parse(t); } catch { return t; }
}

/* ── ① 목록 ───────────────────────────────────────────────── */
const t0 = Date.now();
if (한줄) console.log = () => {};

console.log('나라일터 새 수집기 (' + SOURCE + ') · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · **--dry**' : ''));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          공공데이터 ' + (cfg.ALIO_DETAIL_KEY ? '있음' : '**없음**')
  + ' · Supabase ' + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_GJ2 ? '있음' : '**없음**'));
console.log('  첨부 읽기     한글 tools/hwp · PDF ' + OCR이름표);
if (!cfg.ALIO_DETAIL_KEY) { console.error('공공데이터 인증키가 없습니다'); process.exit(1); }
if (!dry && !cfg.COLLECT_KEY_GJ2) { console.error('COLLECT_KEY_GJ2 가 없습니다'); process.exit(1); }

const 셈 = {
  읽은줄: 0, 마감지남: 0, 남의자리: 0, 비의료: 0,
  상세연것: 0, 첨부연것: 0, 상세로가림: 0, 첨부로가림: 0,
  /* 규칙을 견주는 계량기 — 어느 규칙이 몇 건을 살리고 몇 건을 거르나 */
  잰것_옛: 0,        // 글 아무 데나 있으면 인정 (2026-09-30 이전)
  잰것_제목없으면보류: 0,  // 제목에 직군이 없으면 보류 (너무 넓어 안 씁니다)
  잰것_모집: 0, 잰것_가산점: 0, 잰것_모름: 0,
  /* 줄 330 관문을 넓히면 얼마나 늘까 — --첨부셈만 으로 OCR 없이 셉니다 */
  셈_옛관문: 0, 셈_새관문: 0, 셈_새로열릴것: 0, 셈본보기: [],
  셈_PDF: 0, 셈_한글: 0, 셈_첨부없음: 0,
  통합공고로열었다: 0,
  회원: 0, 보류: 0, 쓰레기: 0, 못받은쪽: 0,
};
const 모은것 = [];
let 전체 = null;

console.log('\n① 목록 — 최근 ' + 며칠 + '일');
let 빈쪽 = 0;
for (let 쪽 = 1; 쪽 <= 최대쪽; 쪽++) {
  const u = BASE + '/getList?serviceKey=' + cfg.ALIO_DETAIL_KEY
    + '&pageNo=' + 쪽 + '&numOfRows=100&Sort_order=2'
    + '&Begin_de=' + 날(-며칠) + '&End_de=' + 날(1);
  const r = await 공공부르기(u, { headers: { accept: 'application/xml' } });
  if (r.code !== 200) {
    셈.못받은쪽++;
    console.error('  ' + 쪽 + '쪽 HTTP ' + r.code + ' · ' + (r.왜 || '')
      + ' · 응답 앞 500자 — ' + String(r.글).replace(/\s+/g, ' ').slice(0, 500));
    break;
  }
  if (전체 === null) {
    전체 = Number((r.글.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] || 0);
    console.log('  최근 ' + 며칠 + '일 공고 ' + 전체 + '건');
  }
  const 줄 = 아이템들(r.글);
  if (!줄.length) break;
  셈.읽은줄 += 줄.length;

  let 살아있는쪽 = 0;
  for (const x of 줄) {
    const 끝 = String(x.enddate || '').replace(/[^0-9]/g, '');
    if (끝.length === 8 && 끝 < 오늘8) { 셈.마감지남++; continue; }
    살아있는쪽++;
    모은것.push(x);
  }
  /* 접수중이 한 건도 없는 쪽이 이어지면 멈춥니다 — 최신순이라 뒤는 다 지난 것입니다 */
  if (살아있는쪽 === 0) { 빈쪽++; if (빈쪽 >= 3) { console.log('  ' + 쪽 + '쪽에서 멈춥니다 (접수중 0인 쪽이 3번)'); break; } }
  else 빈쪽 = 0;
  if (전체 && 셈.읽은줄 >= 전체) break;
}
console.log('  읽은 줄 ' + 셈.읽은줄 + ' · 마감 지난 것 ' + 셈.마감지남 + ' · 접수중 ' + 모은것.length
  + (셈.못받은쪽 ? ' · 못 받은 쪽 ' + 셈.못받은쪽 : ''));

/* ── ② 제목으로 1차 판정 ──────────────────────────────────── */
console.log('\n② 제목 판정 —');
const 볼것 = [];
for (const x of 모은것) {
  const 제목 = String(x.title || '').trim();
  const 기관 = String(x.insttname || '').trim();
  if (!제목) continue;
  if (안열말.test(제목)) { 셈.남의자리++; continue; }
  if (notOurs(제목) || titleOtherOnly(제목)) { 셈.남의자리++; continue; }
  /* 교육청·법원 같은 곳은 제목에 의료 냄새가 없으면 안 봅니다 */
  if (비의료기관.test(기관) && !의료냄새.test(제목)) { 셈.비의료++; continue; }

  const 직군 = matchJob(제목);
  const 냄새 = 의료냄새.test(기관 + ' ' + 제목)
    || 열어볼말.some((w) => (기관 + ' ' + 제목).includes(w));
  볼것.push({
    x, 제목, 기관, 직군,
    열까: !직군,
    등급: 직군 ? 0 : 먼저.test(제목 + ' ' + 기관) ? 1 : 냄새 ? 2 : 3,
  });
}
볼것.forEach((v, i) => { v.순서 = i; });
볼것.sort((a, b) => (a.등급 - b.등급) || (a.순서 - b.순서));
console.log('  볼 것 ' + 볼것.length + '건 (제목에 직군 ' + 볼것.filter((v) => v.직군).length
  + ' · 재활·보건 냄새 ' + 볼것.filter((v) => !v.직군 && v.등급 <= 2).length + ' 먼저)'
  + ' · 남의 자리 ' + 셈.남의자리 + ' · 비의료 기관 ' + 셈.비의료 + ' 건너뜀');

/* ── ③ 상세·첨부 ──────────────────────────────────────────── */
console.log('\n③ 상세 — 제목만으로 못 가린 ' + 볼것.filter((v) => v.열까).length
  + '건 중 ' + Math.min(상세몫, 볼것.filter((v) => v.열까).length) + '건을 엽니다');

async function 상세받기(idx) {
  const r = await 공공부르기(BASE + '/getItem?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&idx=' + idx,
    { headers: { accept: 'application/xml' } });
  if (r.code !== 200) return null;
  return 아이템들(r.글)[0] || null;
}

/** 첨부 — 공고문으로 보이는 것을 고릅니다 */
async function 첨부받기(idx) {
  const r = await 공공부르기(BASE + '/getItemFile?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&idx=' + idx,
    { headers: { accept: 'application/xml' } });
  if (r.code !== 200) return { pdf: '', hwp: '' };
  const 점수 = (nm) => (/직무기술|제출서류|서식|응시원서|양식|명세서/.test(nm) ? 0
    : /공고|모집|채용/.test(nm) ? 2 : 1);
  /* 주소를 온전하게 — XML 에서 &amp; 로 와서 그대로 쓰면 오류 화면(HTML)이 옵니다.
     값만 감싸고 뼈대(? & =)는 안 건드립니다 (CLAUDE.md 5번) */
  const 온전히 = (fp) => {
    let p = String(fp || '').trim();
    if (!p) return '';
    if (!p.startsWith('http')) p = 'https://www.gojobs.go.kr/' + p.replace(/^\//, '');
    const q = p.indexOf('?');
    if (q < 0) return p;
    return p.slice(0, q) + '?' + p.slice(q + 1).split('&').map((kv) => {
      const e = kv.indexOf('=');
      if (e < 0) return kv;
      const k = kv.slice(0, e), v = kv.slice(e + 1);
      return k + '=' + (/%[0-9A-Fa-f]{2}/.test(v) ? v : encodeURIComponent(v));
    }).join('&');
  };
  let pdf = '', hwp = '', 좋은것 = -1, 좋은한글 = -1;
  for (const f of 아이템들(r.글)) {
    const nm = String(f.filename || '');
    const sc = 점수(nm);
    if (/\.hwpx?$/i.test(nm) && sc > 좋은한글) { 좋은한글 = sc; hwp = 온전히(f.filepath); }
    if (/\.pdf$/i.test(nm) && sc > 좋은것) { 좋은것 = sc; pdf = 온전히(f.filepath); }
  }
  return { pdf, hwp };
}

async function 파일글자(주소, 이름) {
  try {
    const r = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return { 글: '', 왜: '첨부 HTTP ' + r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    if (한글파일인가(이름)) { const h = hwp글자(buf, 이름); return { 글: h.글, 왜: h.왜 }; }
    /* 정말 PDF 인지 봅니다 — 주소가 틀리면 HTML 이 옵니다 (CLAUDE.md 5번) */
    const 앞5 = buf.subarray(0, 5).toString('latin1');
    if (앞5 !== '%PDF-') return { 글: '', 왜: 'PDF 가 아닌 것이 옴 (' + buf.length + '바이트 · 앞5 「' + 앞5 + '」)' };
    if (!OCR쓸수있나()) return { 글: '', 왜: 'PDF 인데 OCR 을 맡길 곳이 없습니다' };
    return await pdf글자(buf, 이름, { ctype: r.headers.get('content-type') || '' });
  } catch (e) { return { 글: '', 왜: '첨부를 못 받음 · ' + String(e.message).slice(0, 80) }; }
}

let 연것 = 0;
for (const v of 볼것) {
  if (!v.열까) continue;
  if (연것 >= 상세몫) break;
  if (Date.now() - t0 > 20 * 60000) { console.log('  20분이 넘어 여기서 멈춥니다'); break; }
  연것++; 셈.상세연것++;

  const d = await 상세받기(v.x.idx);
  if (!d) { v.보류 = '상세를 못 받았습니다'; continue; }
  v.상세 = d;
  const 글 = Object.values(d).join(' ');
  const j = matchJob(글);
  if (j) { v.직군 = j; v.근거 = '상세'; 셈.상세로가림++; continue; }

  /* 상세에도 없으면 첨부를 읽습니다. 다만 의료 냄새가 없으면 열지 않습니다 —
     첨부 읽기가 한 건에 몇 초라 이게 시간의 대부분입니다 */
  const 냄새글 = v.기관 + ' ' + v.제목 + ' ' + 글.slice(0, 1500);
  const 옛관문 = 의료냄새.test(냄새글) || 열어볼말.some((w) => 냄새글.includes(w));
  const 통합 = 통합공고말.test(v.제목)
    && !통합공고에서뺄곳.test(v.기관 + ' ' + v.제목);
  if (첨부셈만) {
    /* 두 규칙을 한 번에 셉니다 — 넓히면 몇 건이 더 열리는지 보려고 */
    if (옛관문) 셈.셈_옛관문++;
    if (옛관문 || 통합) 셈.셈_새관문++;
    if (!옛관문 && 통합) {
      셈.셈_새로열릴것++;
      if (셈.셈본보기.length < 12) 셈.셈본보기.push(v.기관 + ' · ' + v.제목.slice(0, 48));
      /* 첨부 **목록만** 받아 꼴을 셉니다 (파일은 안 내려받습니다 · OCR 0건).
         한글은 서버에서 공짜로 읽고, PDF 만 구글 OCR 을 씁니다 —
         그래서 늘어나는 부담은 「PDF 가 몇 건이냐」로 정해집니다 */
      const ff = await 첨부받기(v.x.idx);
      if (ff.pdf) 셈.셈_PDF++;
      else if (ff.hwp) 셈.셈_한글++;
      else 셈.셈_첨부없음++;
    }
    continue;
  }
  if (!옛관문 && !통합) continue;
  if (!옛관문 && 통합) 셈.통합공고로열었다++;

  const f = await 첨부받기(v.x.idx);
  if (!f.pdf && !f.hwp) continue;
  셈.첨부연것++;
  const 고른것 = f.pdf || f.hwp;
  const 이름 = 고른것.includes('.hwp') ? '공고문.hwp' : '공고문.pdf';
  const a = await 파일글자(고른것, 이름);
  if (a.글) {
    /* ⚠ **어느 부분에 있느냐**를 봅니다 (2026-09-30).
       부산교도소 「한시임기제공무원(8호, 간호직)」 공고가 물리치료사로 잡혔습니다.
       첨부(28,911자)를 열어 보니 채용 직종이 아니라 **가산점 자격증 목록**이었습니다 —
         "… 임상병리사, 보건의료정보관리사, 물리치료사  C급  보건교육사 3급 …"

       한때 「제목에 직군이 없으면 첨부만 보고는 안 올린다」 로 막았는데
       그건 너무 넓습니다 — 공공기관 공고는 제목이 「직원 채용」 뿐이고
       첨부에만 직군이 있는 경우가 많아 보류함이 넘칩니다 (세중님 지적).
       그래서 첨부 판정은 그대로 쓰되, **모집 부분에 있는 것만** 인정합니다.
       가르는 규칙은 tools/첨부직군.mjs 한 곳에 있습니다. */
    const 옛 = matchJob(a.글);
    if (옛) 셈.잰것_옛++;
    if (옛 && !matchJob(v.제목)) 셈.잰것_제목없으면보류++;

    const g = 첨부직군(a.글);
    if (g.직군) {
      셈.잰것_모집++; 셈.첨부로가림++;
      v.직군 = g.직군; v.근거 = '첨부 공고문 · 모집 부분';
      v.걸린줄 = g.줄;
    } else if (g.어디 === '가산점') {
      /* 가산점·자격증 목록에만 있는 것은 우리 자리가 아닙니다.
         쓰레기통으로 보내되 **까닭과 함께 남깁니다** — 지우지 않습니다 */
      셈.잰것_가산점++;
      v.가산점뿐 = '첨부의 가산점·자격증 목록에만 「' + (g.후보 || '') + '」 가 있었습니다 · ' + g.까닭;
      v.걸린줄 = g.줄;
    } else if (g.어디 === '모름') {
      셈.잰것_모름++;
      v.보류 = '첨부에 「' + (g.후보 || '') + '」 가 있는데 모집 부분인지 가산점인지 못 가렸습니다';
      v.걸린줄 = g.줄;
    } else {
      v.보류못가림 = '첨부를 읽었지만 우리 직군이 없음';
    }
  } else if (의료냄새.test(v.기관 + ' ' + v.제목)) {
    /* 못 읽은 것은 **버리지 않고** 보류함으로. 다만 의료 냄새가 나는 것만 —
       안 그러면 관리자가 다 못 볼 만큼 쌓입니다 */
    v.보류 = '첨부를 못 읽었습니다 · ' + (a.왜 || '');
  }
  await 쉼(200);
}
console.log('  연 것 ' + 셈.상세연것 + '건 · 첨부까지 ' + 셈.첨부연것 + '건');
if (첨부셈만) {
  console.log('\n══ 줄 330 관문 셈 (첨부를 열지 않았습니다 · OCR 0건) ══');
  console.log('  지금 규칙으로 열릴 것        ' + 셈.셈_옛관문 + '건');
  console.log('  통합공고 말을 보태면 열릴 것   ' + 셈.셈_새관문 + '건');
  console.log('  ★ 더 열리는 것              ' + 셈.셈_새로열릴것 + '건'
    + (셈.셈_옛관문 ? ' (' + Math.round(셈.셈_새로열릴것 / 셈.셈_옛관문 * 100) + '% 늘어남)' : ''));
  if (셈.셈본보기.length) {
    console.log('\n  더 열릴 공고 본보기 —');
    for (const x of 셈.셈본보기) console.log('    ' + x);
  }
  console.log('\n  한 바퀴 ' + Math.round((Date.now() - t0) / 1000) + '초 (첨부 안 열고)');
  process.exit(0);
}
if (셈.통합공고로열었다) {
  console.log('  그중 통합공고 말 때문에 연 것 ' + 셈.통합공고로열었다 + '건');
}
console.log('  ★ 상세를 읽고 가린 ' + 셈.상세로가림 + '건 · 첨부를 읽고 가린 ' + 셈.첨부로가림 + '건');
console.log('\n  ── 첨부 규칙 견주기 ──');
console.log('   ㉮ 옛 규칙 (글 아무 데나)        ' + 셈.잰것_옛 + '건 인정');
console.log('   ㉯ 제목에 직군 없으면 보류        ' + (셈.잰것_옛 - 셈.잰것_제목없으면보류) + '건 인정 · '
  + 셈.잰것_제목없으면보류 + '건 보류로 빠짐   ← 너무 넓어서 안 씁니다');
console.log('   ㉰ 모집 부분만 인정 (지금)        ' + 셈.잰것_모집 + '건 인정 · '
  + 셈.잰것_가산점 + '건 가산점이라 거름 · ' + 셈.잰것_모름 + '건 못 가려 보류');

/* ── ④ 갈래 ───────────────────────────────────────────────── */
const 줄만들기 = (v) => {
  const x = v.x;
  return {
    id: 'GJ' + String(x.idx || ''),          /* 옛 수집기와 같은 규칙 — 겹치면 덮지 않습니다 */
    external_id: String(x.idx || ''),
    org_name: v.기관,
    title: v.제목,
    employ_type: 고용형태(x.type01) || 고용형태(x.type02) || '',
    sido: String((v.상세 || {}).areaname || '').split(/[ ,]/)[0] || '',
    apply_from: 날짜(x.begindate),
    apply_to: 날짜(x.enddate),
    posted_at: 날짜(x.regdate),
    url: 원문주소(x.idx),
    job_group: v.직군 || '',
    org_kind: '공공',
    detail: { 근거: v.근거 || '제목', type01: x.type01 || '', type02: x.type02 || '',
      ...(v.걸린줄 ? { 걸린줄: String(v.걸린줄).slice(0, 300) } : {}) },
    evidence: v.보류 || v.보류못가림 ? { 보류사유: v.보류 || v.보류못가림 } : {},
  };
};

const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const 갈래 = sortJob(v.제목, v.직군 || '', null);
  const 줄 = 줄만들기(v);
  if (v.가산점뿐) {
    쓰레기.push({ id: 줄.id, org_name: 줄.org_name, title: 줄.title, url: 줄.url, why: v.가산점뿐 });
    continue;
  }
  if (v.보류 || v.보류못가림) { 줄.hold = true; 보류.push(줄); continue; }
  if (갈래.갈래 === '회원목록') { 회원.push(줄); continue; }
  if (갈래.갈래 === '보류함') { 줄.hold = true; 보류.push(줄); continue; }
  쓰레기.push({ id: 줄.id, org_name: 줄.org_name, title: 줄.title, url: 줄.url, why: 갈래.왜 || '우리 직군 아님' });
}
셈.회원 = 회원.length; 셈.보류 = 보류.length; 셈.쓰레기 = 쓰레기.length;

console.log('\n④ 갈래 — 회원 목록 ' + 셈.회원 + ' · 보류함 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기);
if (회원.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 —');
  회원.slice(0, 12).forEach((r) => console.log('     ' + String(r.job_group).padEnd(8)
    + String(r.apply_to || '날짜없음').padEnd(12) + r.org_name.slice(0, 22).padEnd(24) + r.title.slice(0, 44)));
  if (회원.length > 12) console.log('     … 그리고 ' + (회원.length - 12) + '건 더');
}

/* ── ⑤ 담기 ───────────────────────────────────────────────── */
if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0;
  const 넣을것 = [...회원, ...보류];
  for (let i = 0; i < 넣을것.length; i += 100) {
    const r = await rpc('collect_put', {
      p_secret: cfg.COLLECT_KEY_GJ2, p_source: SOURCE, p_rows: 넣을것.slice(i, i + 100),
    });
    담음 += r['담음'] || 0;
  }
  console.log('\n씀          ' + 담음 + '건');
  if (쓰레기.length) {
    let 버림 = 0;
    for (let i = 0; i < 쓰레기.length; i += 200) {
      const r = await rpc('collect_trash', {
        p_secret: cfg.COLLECT_KEY_GJ2, p_source: SOURCE, p_rows: 쓰레기.slice(i, i + 200),
      });
      버림 += r['담음'] || 0;
    }
    console.log('쓰레기통     ' + 버림 + '건 (지우지 않고 까닭과 함께 남깁니다)');
  }
  console.log(Math.round((Date.now() - t0) / 1000) + '초');
}

/* ── ⑥ 박동 — 안 돌면 관리자 화면에 빨간 줄 ──────────────── */
if (!dry) {
  try {
    await rpc('collect_beat', {
      p_secret: cfg.COLLECT_KEY_GJ2, p_source: SOURCE,
      p_beat: {
        took_ms: Date.now() - t0, ok: true,
        본곳: 1, 담음: 셈.회원 + 셈.보류, 보류: 셈.보류, 버림: 셈.쓰레기, 못받음: 셈.못받은쪽,
        메모: { 읽은줄: 셈.읽은줄, 마감지남: 셈.마감지남, 상세연것: 셈.상세연것, 첨부연것: 셈.첨부연것 },
      },
    });
  } catch (e) { console.error('박동 못 남김 · ' + String(e.message).slice(0, 120)); }
}

/* ── ⑦ 한도 남기기 ───────────────────────────────────────── */
const 한도 = await 한도알리기(SOURCE);
if (한도.왜) console.error('한도 기록 못 함 · ' + 한도.왜);
else if (한도.올림) {
  console.log('한도 기록    ' + 한도들().map((x) =>
    x.서비스.replace(/^apis?\.data\.go\.kr/, '') + ' ' + (x.한도 - x.남음) + '/' + x.한도).join(' · '));
}

/* ── ⑧ 한 줄 — 사흘 대조용 ───────────────────────────────── */
if (한줄) {
  // eslint-disable-next-line no-console
  console.error('── ' + SOURCE + ' · 읽은 줄 ' + 셈.읽은줄 + ' · 담은 줄 ' + (셈.회원 + 셈.보류)
    + ' · 회원 ' + 셈.회원 + ' · 보류 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기
    + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
}
