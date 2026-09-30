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
const 풀기 = (s) => String(s == null ? '' : s)
  .replace(/&amp;/g, '&').replace(/&#38;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x?[0-9A-Fa-f]+;/g, (m) => {
    const n = m[2] === 'x' || m[2] === 'X'
      ? parseInt(m.slice(3, -1), 16) : parseInt(m.slice(2, -1), 10);
    return Number.isFinite(n) ? String.fromCharCode(n) : ' ';
  })
  .trim();

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
  if (!의료냄새.test(냄새글) && !열어볼말.some((w) => 냄새글.includes(w))) continue;

  const f = await 첨부받기(v.x.idx);
  if (!f.pdf && !f.hwp) continue;
  셈.첨부연것++;
  const 고른것 = f.pdf || f.hwp;
  const 이름 = 고른것.includes('.hwp') ? '공고문.hwp' : '공고문.pdf';
  const a = await 파일글자(고른것, 이름);
  if (a.글) {
    const j2 = matchJob(a.글);
    if (j2) { v.직군 = j2; v.근거 = '첨부 공고문'; 셈.첨부로가림++; }
    else v.보류못가림 = '첨부를 읽었지만 우리 직군이 없음';
  } else if (의료냄새.test(v.기관 + ' ' + v.제목)) {
    /* 못 읽은 것은 **버리지 않고** 보류함으로. 다만 의료 냄새가 나는 것만 —
       안 그러면 관리자가 다 못 볼 만큼 쌓입니다 */
    v.보류 = '첨부를 못 읽었습니다 · ' + (a.왜 || '');
  }
  await 쉼(200);
}
console.log('  연 것 ' + 셈.상세연것 + '건 · 첨부까지 ' + 셈.첨부연것 + '건');
console.log('  ★ 상세를 읽고 가린 ' + 셈.상세로가림 + '건 · 첨부를 읽고 가린 ' + 셈.첨부로가림 + '건');

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
    detail: { 근거: v.근거 || '제목', type01: x.type01 || '', type02: x.type02 || '' },
    evidence: v.보류 || v.보류못가림 ? { 보류사유: v.보류 || v.보류못가림 } : {},
  };
};

const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const 갈래 = sortJob(v.제목, v.직군 || '', null);
  const 줄 = 줄만들기(v);
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
