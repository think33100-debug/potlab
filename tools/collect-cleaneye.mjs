/* 클린아이 새 수집기 — 시트를 거치지 않고 DB 에 바로 담습니다 (2026-09-26).
 *
 *   node tools/collect-cleaneye.mjs --dry        담지 않고 옛 수집기(CE)와 대조만
 *   node tools/collect-cleaneye.mjs --dry --한줄 사흘 대조용 한 줄만
 *   node tools/collect-cleaneye.mjs              정말로 담습니다 (source = CE2)
 *   node tools/collect-cleaneye.mjs --dry --n 10 앞 10건만 (빠른 확인)
 *   node tools/collect-cleaneye.mjs --첨부안열기  첨부를 안 읽습니다 (옛 수집기와 같은 조건)
 *
 * ── 이 경로의 핵심 ───────────────────────────────────────────
 * 알리오는 「상세를 열어야 안다」 였는데, 클린아이는
 * **「목록 어느 칸에도 직군이 안 적혀 있다」** 입니다.
 * 의료 공고 95건을 훑어보니 제목·자격증·직무 어디에서도 0건이 갈렸습니다.
 * **답은 전부 첨부에 있습니다** (hwp 49 · pdf 44 · 없음 2).
 * 그래서 이 수집기는 **첨부를 읽는 것이 본체**입니다.
 *
 * ── 규칙은 한 벌입니다 ────────────────────────────────────────
 *   직군 판정   tools/gas-rules.mjs  (gas/wage.js 에서 떼어 옵니다. 안 베낍니다)
 *   네 갈래     tools/sort-rule.mjs
 *   한글 읽기   tools/hwp/           PDF 읽기  tools/ocr/
 *   첨부 받기   tools/cleaneye-file.mjs
 *   기관 붙이기 DB 의 org_public()
 *   쓰기        DB 의 collect_put()  ← **유일한 쓰기 통로.** service_role 을 안 씁니다
 *
 * ── 열쇠 (GitHub Secrets) ─────────────────────────────────────
 *   CLEANEYE_KEY      공공데이터포털 열쇠 (알리오 상세와 **같은 값**입니다.
 *                     이 열쇠를 갈면 두 경로가 같이 멈춥니다)
 *   SUPABASE_URL · SUPABASE_ANON_KEY
 *   COLLECT_KEY_CE2   collect_put 의 열쇠
 *   OCR_GAS_URL · OCR_KEY   PDF 읽기 (없으면 PDF 는 보류함으로)
 *
 * ── ⚠ 클린아이는 첨부 다운로드를 **건수로** 막습니다 ────────────
 * 재본 값입니다 (`tools/hwp/bucket.mjs`) — **통 15건 · 2분이면 가득**.
 * 0.25초로 받아도 1.2초로 받아도 똑같이 15건에서 429 이고, 2분·5분 쉰 뒤
 * 다시 15건입니다. 하루치도 시간당도 아닙니다.
 * **429 로 튕긴 요청도 통을 먹습니다** — 곧바로 다시 두드리면 영영 안 찹니다.
 * 그래서 통이 차면 2분 반 쉬고 이어가다, 이번 실행 몫(`--분`, 기본 18분)을
 * 넘기면 나머지를 **「다음에」** 로 넘깁니다. 다음 실행이 이어서 읽습니다.
 *
 * ── 판정은 여기서 안 합니다 ───────────────────────────────────
 * 읽은 첨부 글은 그대로 `sortJob(제목, 직군, 첨부)` 5단계에 넘깁니다.
 * 규칙을 클린아이 전용 코드에 두면 두 벌이 됩니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchJob, notOurs, mixedTitle, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { sortJob } from './sort-rule.mjs';
import { hwp글자, 한글파일인가 } from './hwp/index.mjs';
import { pdf글자, 쓸수있나 as OCR쓸수있나, 이름표 as OCR이름표 } from './ocr/index.mjs';
import { 첨부받기, 기본간격, 통크기, 통쉼, 쉼 } from './cleaneye-file.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'CE2';
const 목록URL = 'https://apis.data.go.kr/B551982/openApiEmployInfo/openXmlEmployInfo';

/* 시도 17곳. gas 의 JOB2_API.SIDO 와 같은 값입니다 */
const SIDO = [
  ['007001', '서울'], ['007002', '부산'], ['007003', '대구'], ['007004', '인천'],
  ['007005', '광주'], ['007006', '대전'], ['007007', '울산'], ['007008', '경기'],
  ['007009', '강원'], ['007010', '충북'], ['007011', '충남'], ['007012', '전북'],
  ['007013', '전남'], ['007014', '경북'], ['007015', '경남'], ['007016', '제주'],
  ['007017', '세종'],
];

/* ── 설정 ─────────────────────────────────────────────────── */
function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  /* 집 컴퓨터에서는 gas 안의 열쇠를 빌립니다. Actions 에는 gas/ 가 없습니다 */
  const gas = path.join(여기, '..', 'gas', 'wage.js');
  if (fs.existsSync(gas)) {
    const src = fs.readFileSync(gas, 'utf8');
    out.CLEANEYE_KEY = out.CLEANEYE_KEY
      || (src.match(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1] || '';
  }
  /* 알리오 상세와 같은 열쇠입니다 — 하나만 넣어 두셨어도 돌게 */
  out.CLEANEYE_KEY = out.CLEANEYE_KEY || out.ALIO_DETAIL_KEY || '';
  return out;
}

/* ── 클린아이 두드리기 ────────────────────────────────────── */
/* 엔티티가 **두 번** 감싸여 옵니다 (`&amp;amp;`). 변화가 없을 때까지 풉니다 */
const de = (s) => {
  let t = String(s ?? ''), 앞;
  do {
    앞 = t;
    t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
  } while (t !== 앞);
  return t.trim();
};
const 치 = (v) => { const t = de(v); return (t === '-' || t.toLowerCase() === 'null') ? '' : t; };

/** 시도 한 곳. 못 받으면 **왜 못 받았는지 원문을 찍습니다** (CLAUDE.md 2번) */
async function 시도한곳(cfg, cd, 이름, 떠들기) {
  /* 열쇠는 이미 인코딩된 값입니다. 다시 감싸면 안 됩니다 */
  const u = 목록URL + '?serviceKey=' + cfg.CLEANEYE_KEY + '&type=xml&sidoCd=' + cd + '&numOfRows=100';
  let txt = '';
  try {
    const r = await fetch(u, { headers: { accept: 'application/xml' } });
    txt = await r.text();
    if (!r.ok) {
      console.error('  ' + 이름 + ' HTTP ' + r.status + ' · 응답 앞 500자 — ' + txt.slice(0, 500).replace(/\s+/g, ' '));
      return null;
    }
  } catch (e) {
    console.error('  ' + 이름 + ' 못 받음 · ' + String(e && e.message || e).slice(0, 200));
    return null;
  }
  const code = (txt.match(/<resultCode>\s*([^<]*)<\/resultCode>/) || [])[1];
  if (code && !/^0+$/.test(code.trim())) {
    console.error('  ' + 이름 + ' resultCode ' + code.trim()
      + ' · ' + (txt.match(/<resultMsg>\s*([^<]*)<\/resultMsg>/) || [])[1]
      + ' · 응답 앞 400자 — ' + txt.slice(0, 400).replace(/\s+/g, ' '));
    return null;
  }
  const 것들 = [];
  for (const m of txt.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const o = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = 치(f[2]);
    것들.push(o);
  }
  const total = Number((txt.match(/<totalCount>\s*(\d+)/) || [])[1] || 것들.length);
  if (떠들기) {
    console.log('  ' + 이름.padEnd(4) + String(것들.length).padStart(4) + '건'
      + (total > 것들.length ? '  ⚠ totalCount ' + total + ' — 다 안 왔습니다' : ''));
  }
  return 것들;
}

/* ── 첨부 읽기 ────────────────────────────────────────────── */
/** 공고 하나의 첨부 → { 글, 왜, 꼴 }. 던지지 않습니다 */
async function 첨부글자(o, 셈, 옵션) {
  const 이름 = String(o.FILE_NAME1 || '');
  if (!이름) { 셈.첨부없음++; return { 글: '', 왜: '첨부가 없는 공고입니다' }; }

  let g = await 첨부받기(o.URL, { 다시: 0 });
  /* ⚠ **429 로 튕긴 요청도 통을 먹습니다.** 그래서 곧바로 다시 두드리면
     통이 영영 안 찹니다 (2026-09-26 에 그렇게 헛돌았습니다).
     재어 보니 **통 15건 · 2분이면 다 찹니다.** 한 번 기다렸다 이어갑니다 */
  if (!g.buf && g.넘침 && 옵션 && !옵션.통막힘.막힘) {
    const 남은 = 옵션.끝날때 - Date.now();
    if (남은 > 통쉼 + 30000) {
      셈.통쉼++;
      console.log('   … 통이 찼습니다 (' + 셈.첨부받음 + '건 받음). ' + (통쉼 / 1000) + '초 쉬고 이어갑니다');
      await 쉼(통쉼);
      g = await 첨부받기(o.URL, { 다시: 0 });
    } else {
      /* 이번 실행에 남은 시간이 모자랍니다 — 다음 실행이 이어서 읽습니다 */
      옵션.통막힘.막힘 = true;
    }
  }
  if (!g.buf) {
    if (g.넘침) { 셈.막힘++; return { 글: '', 왜: g.왜, 막힘: true }; }
    셈.첨부못받음++; return { 글: '', 왜: g.왜 };
  }
  셈.첨부받음++;

  if (한글파일인가(g.이름)) {
    const r = hwp글자(g.buf, g.이름);
    if (r.글) 셈.hwp읽음++; else 셈.hwp못읽음++;
    return { 글: r.글, 왜: r.왜, 꼴: 'hwp' };
  }
  /* PDF — 앞 5글자가 %PDF- 인지 봅니다 (CLAUDE.md 5번) */
  if (g.buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    if (!OCR쓸수있나()) { 셈.OCR못씀++; return { 글: '', 왜: 'PDF 인데 OCR 을 맡길 곳이 없습니다', 꼴: 'pdf' }; }
    셈.OCR++;
    const r = await pdf글자(g.buf, g.이름);
    if (r.글) 셈.pdf읽음++; else 셈.pdf못읽음++;
    return { 글: r.글, 왜: r.왜, 꼴: 'pdf' };
  }
  셈.모르는꼴++;
  const 머리 = [...g.buf.subarray(0, 8)].map((x) => x.toString(16).padStart(2, '0')).join(' ');
  return { 글: '', 왜: g.이름 + ' — 읽을 줄 모르는 꼴입니다 (' + g.buf.length + '바이트 · 앞 8바이트 ' + 머리 + ')' };
}

/* ── 한 건을 판정합니다 ───────────────────────────────────── */
async function 한건(o, 셈, 옵션) {
  const id = String(o.NO || '');
  if (!id) return null;
  const title = String(o.ENT_TITLE || '');
  const org = String(o.ENT_NAME || '');

  /* ① 제목이 남의 자리뿐이면 볼 것 없습니다 */
  if (notOurs(title)) { 셈.남의자리++; return null; }

  /* ② 제목 → ③ 자격증·직무 칸 */
  let job = matchJob(title);
  let 근거 = job ? '제목' : '';
  if (!job) {
    const 자격 = ['ENT_LICENSE1', 'ENT_LICENSE2', 'ENT_LICENSE3', 'ENT_LICENSE4']
      .map((k) => String(o[k] || '')).join(' ');
    const j = matchJob(자격);
    if (j) { job = j; 근거 = '자격증'; }
  }
  if (!job) {
    const 직무 = ['POSITION', 'DUTY_DETAIL', 'ENT_RECRUIT', 'SPECIAL_ITEM']
      .map((k) => String(o[k] || '')).join(' ');
    const j = matchJob(직무);
    if (j) { job = j; 근거 = '직무'; }
  }

  /* ④ 첨부 — **이 경로의 본체입니다.**
     버릴 것은 첨부를 열기 전에 버립니다 (알리오에서 배운 것).
     클린아이는 통이 15건이라 더 아껴야 합니다.

     **판정은 여기서 안 합니다.** 읽은 글을 그대로 `sortJob` 5단계에 넘깁니다 —
     규칙을 클린아이 전용 코드에 두면 두 벌이 됩니다 (2026-09-26 세중님 지시) */
  let 첨부 = undefined;
  if (!job && !옵션.첨부안열기) {
    if (titleOtherOnly(title)) { 셈.남의자리++; return null; }
    if (옵션.통막힘 && 옵션.통막힘.막힘) {
      /* 이번 실행에서는 더 못 읽습니다 — 다음 실행이 이어서 읽습니다 */
      셈.다음번++;
      첨부 = { 읽음: false, 왜: '이번 실행의 다운로드 몫을 다 썼습니다 — 다음 실행이 이어서 읽습니다' };
    } else {
      const a = await 첨부글자(o, 셈, 옵션);
      첨부 = a.글 ? { 읽음: true, 글: a.글 } : { 읽음: false, 왜: a.왜 };
      if (!a.글 && a.막힘) 셈.다음번++;
      await 쉼(기본간격);
    }
  }

  /* 마감 지난 것은 빼기 */
  const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const 끝 = 날(o.PUB_END_DATE);
  if (끝 && 끝 < 오늘) { 셈.마감++; return null; }

  /* ⑤ 갈래 — 규칙은 tools/sort-rule.mjs 한 벌 (네 갈래 + 5단계) */
  const 갈래 = sortJob(title, job || '', 첨부);
  if (!job && 갈래.갈래 === '회원목록' && 갈래.단계 === 5) {
    job = matchJob(첨부.글) || '공통';
    근거 = '첨부';
    셈.첨부로가림++;
  }
  const hold = 갈래.갈래 === '보류함' ? 갈래.왜 : '';
  return { id, org, title, job, 근거, hold, 다시: !!갈래.다시, 갈래, o };
}

function 날(v) {
  const t = String(v || '').replace(/\D/g, '');
  return t.length === 8 ? t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6) : null;
}
function 자르기(s, n) { const t = String(s || '').trim(); return t ? t.slice(0, n) : undefined; }

/* ── DB ───────────────────────────────────────────────────── */
async function rpc(cfg, fn, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
               'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}
async function 옛것(cfg) {
  const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
  if (!열쇠) {
    console.log('  (대조 안 함 — SUPABASE_SERVICE_KEY 가 없습니다. 집 컴퓨터에서만 됩니다)');
    return null;
  }
  const u = cfg.SUPABASE_URL
    + '/rest/v1/job_posts?source=eq.CE&select=id,title,org_name,job_group,hold,apply_to&limit=2000';
  try {
    const r = await fetch(u, { headers: { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 } });
    const txt = await r.text();
    if (!r.ok) { console.error('  옛것 읽기 실패 · HTTP ' + r.status + ' · ' + txt.slice(0, 300)); return null; }
    return JSON.parse(txt);
  } catch (e) { console.error('  옛것 읽기 실패 · ' + String(e.message).slice(0, 200)); return null; }
}

/* ── 본체 ─────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const 한줄 = argv.includes('--한줄');
const dry = argv.includes('--dry') || 한줄;
const 몇건 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
const 첨부안열기 = argv.includes('--첨부안열기');
/* 이번 실행에 쓸 시간. 통이 차면 2분 쉬고 이어가다가, 이 시간을 넘기면
   나머지는 「다음에」 로 넘깁니다 (Actions timeout 25분보다 넉넉히 짧게) */
const 시간예산 = (argv.includes('--분') ? Number(argv[argv.indexOf('--분') + 1]) || 18 : 18) * 60000;

const 원래log = console.log;
if (한줄) console.log = () => {};

const t0 = Date.now();
const cfg = env();

/* ── 열쇠가 들어왔나 (값은 안 찍습니다. 있는지와 길이만) ── */
console.log('클린아이 새 수집기 (CE2) · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          클린아이 ' + (cfg.CLEANEYE_KEY ? cfg.CLEANEYE_KEY.length + '자' : '**없음**')
  + ' · Supabase ' + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_CE2 ? '있음' : '**없음**'));
console.log('  첨부 읽기     한글 tools/hwp · PDF ' + (OCR쓸수있나() ? OCR이름표 : '**맡길 곳 없음**')
  + ' · 통 ' + 통크기 + '건/' + (통쉼 / 1000) + '초 · 이번 실행 ' + Math.round(시간예산 / 60000) + '분까지');
if (!cfg.CLEANEYE_KEY) { console.error('CLEANEYE_KEY 가 없습니다'); process.exit(1); }

/* ① 목록 — 시도 17곳 */
console.log('\n① 목록 —');
let 전부 = [];
let 못받은시도 = 0;
for (const [cd, 이름] of SIDO) {
  const got = await 시도한곳(cfg, cd, 이름, true);
  if (got === null) { 못받은시도++; continue; }
  전부 = 전부.concat(got);
  await 쉼(150);
}
if (못받은시도 === SIDO.length) {
  console.error('\n시도 17곳을 하나도 못 받았습니다 — 열쇠나 막힘을 보세요');
  process.exit(1);
}
const 의료 = 전부.filter((o) => o.ENT_KIND === '의료');
console.log('  전체 ' + 전부.length + '건 · 그중 의료 ' + 의료.length + '건'
  + (못받은시도 ? ' · 못 받은 시도 ' + 못받은시도 + '곳' : ''));

/* ② 판정 — **의료만** 봅니다. 나머지는 우리 일이 아닙니다 */
const 셈 = { 남의자리: 0, 마감: 0, 첨부없음: 0, 첨부받음: 0, 첨부못받음: 0, 막힘: 0,
  hwp읽음: 0, hwp못읽음: 0, OCR: 0, pdf읽음: 0, pdf못읽음: 0, OCR못씀: 0,
  모르는꼴: 0, 첨부로가림: 0, 다음번: 0, 통쉼: 0 };
const 볼것 = 몇건 ? 의료.slice(0, 몇건) : 의료;
console.log('\n② 판정 — ' + 볼것.length + '건');
const 결과 = [];
const 통막힘 = { 막힘: false };
const 옵션 = { 첨부안열기, 통막힘, 끝날때: t0 + 시간예산 };
for (const o of 볼것) {
  if (Date.now() > 옵션.끝날때) 통막힘.막힘 = true;   // 시간이 다 됐습니다
  const x = await 한건(o, 셈, 옵션);
  if (x) 결과.push(x);
}

/* 갈래는 sortJob 하나가 정합니다 — 여기서 다시 안 가릅니다 */
const 회원 = 결과.filter((x) => x.갈래.갈래 === '회원목록');
const 보류 = 결과.filter((x) => x.갈래.갈래 === '보류함');
const 쓰레기 = 결과.filter((x) => x.갈래.갈래 === '쓰레기통');

console.log('  남의 자리라 버림  ' + 셈.남의자리 + ' · 마감 지남 ' + 셈.마감);
console.log('  첨부 — 없음 ' + 셈.첨부없음 + ' · 받음 ' + 셈.첨부받음
  + ' · 못 받음 ' + 셈.첨부못받음 + ' · 막힘(429) ' + 셈.막힘 + ' · 다음 번에 ' + 셈.다음번
  + (셈.통쉼 ? ' · 통이 차서 쉰 횟수 ' + 셈.통쉼 : ''));
console.log('         한글 읽음 ' + 셈.hwp읽음 + '/' + (셈.hwp읽음 + 셈.hwp못읽음)
  + ' · PDF 읽음 ' + 셈.pdf읽음 + '/' + (셈.pdf읽음 + 셈.pdf못읽음)
  + (셈.OCR못씀 ? ' · OCR 못 씀 ' + 셈.OCR못씀 : '') + (셈.모르는꼴 ? ' · 모르는 꼴 ' + 셈.모르는꼴 : ''));
console.log('\n  ★ 첨부를 읽고 나서 직군이 가려진 공고  ' + 셈.첨부로가림 + '건   ← 이 일의 값어치');
console.log('  회원 목록 ' + 회원.length + ' · 보류함 ' + 보류.length + ' · 쓰레기통 ' + 쓰레기.length);

if (회원.length) {
  console.log('\n  회원 목록에 올라갈 것 —');
  회원.forEach((x) => console.log('    ' + x.org.slice(0, 18).padEnd(20) + x.title.slice(0, 44)
    + '   [' + x.job + ' · ' + x.근거 + ']'));
}

/* ③ 담을 줄 만들기 — 쓰레기통은 안 담습니다 */
const 이제 = new Date().toISOString();
const 담을것 = 회원.concat(보류).map((x) => {
  const o = x.o;
  return {
    id: 'CE' + x.id,
    external_id: x.id,
    org_name: x.org || '(없음)', title: x.title || '(없음)',
    hire_type: String(o.EMPLOY_GB || ''), employ_type: String(o.JOB_TYPE || ''),
    work_place: String(o.WORK_PLACE || o.ADDRESS || ''), sido: null, sgg: null,
    edu: '',
    headcount: Number(String(o.EMPLOY_NUM || '').replace(/\D/g, '')) || null,
    apply_from: 날(o.PUB_DATE), apply_to: 날(o.PUB_END_DATE), posted_at: 날(o.PUB_DATE),
    url: String(o.URL || ''),
    job_group: x.job || null,
    form: (x.근거 === '제목' && !mixedTitle(x.title)) ? null : '포함',
    hidden: false,
    hold: !!(x.hold || x.갈래.갈래 === '보류함'),
    detail: {
      지원자격: 자르기(['ENT_LICENSE1', 'ENT_LICENSE2', 'ENT_LICENSE3', 'ENT_LICENSE4']
        .map((k) => String(o[k] || '')).filter(Boolean).join(' · '), 900),
      전형방법: 자르기(o.JUDGE_METHOD, 900),
      우대사항: 자르기(o.SPECIAL_ITEM, 700),
      결격사유: 자르기(o.ACCUSATION, 700),
      제출서류: 자르기(o.EXHIBIT, 700),
      연봉: 자르기(o.YEARINCOME, 200),
      근무시간: 자르기(o.OFFICE_HOURS, 200),
      문의처: 자르기(o.REFERENCE, 300),
      기관홈: String(o.URL || ''),
    },
    evidence: {
      직군근거: x.근거 || '',
      걸린단어: (x.갈래.걸린단어 || []).join(','),
      보류사유: x.hold || (x.갈래.갈래 === '보류함' ? x.갈래.왜 : ''),
      갈래: x.갈래.갈래,
      /* **몇 단계에서 갈렸는지.** 쓰레기통 화면에서 관리자가
         「의료기사인데 왜 버렸지」 를 사유만 보고 알 수 있어야 합니다 */
      단계: String(x.갈래.단계 || ''),
      사유: x.갈래.왜 || '',
      다시볼것: x.다시 ? 'Y' : '',
      첨부: String(o.FILE_NAME1 || ''),
    },
    collected_at: 이제,
  };
});

/* 버린 것도 남깁니다 — 관리자 화면(admin/trash)이 「버린 이유」 를 보여줍니다.
   사유에 **몇 단계에서 버렸는지**와 첨부에서 찾은 직군이 들어 있어야
   「의료기사인데 왜 버렸지」 를 사유만 보고 알 수 있습니다 */
const 버릴것 = 쓰레기.map((x) => ({
  id: 'CE' + x.id, org_name: x.org, title: x.title, url: String(x.o.URL || ''),
  why: x.갈래.왜 + ((x.갈래.걸린단어 || []).length ? ' — ' + x.갈래.걸린단어.join(',') : ''),
  trashed_at: 이제,
}));

/* ④ 담거나, 옛것과 대조하거나 */
if (dry) {
  const 옛 = await 옛것(cfg);
  if (!옛) console.log('\n옛 수집기 것을 못 읽었습니다 (대조 못 함)');
  else {
    const 옛집 = new Map(옛.map((x) => [String(x.id), x]));
    const 새집 = new Map(담을것.map((x) => [String(x.id), x]));
    const 같음 = [...새집.keys()].filter((k) => 옛집.has(k));
    const 새것만 = [...새집.keys()].filter((k) => !옛집.has(k));
    const 옛것만 = [...옛집.keys()].filter((k) => !새집.has(k));
    const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    /* 마감된 옛 공고는 클린아이가 안 주므로 차이가 아닙니다 */
    const 살아있는옛것만 = 옛것만.filter((k) => {
      const v = 옛집.get(k);
      return !v.apply_to || String(v.apply_to) >= 오늘;
    });
    /* 통과 기준은 **「gas 에만 0」 이 사흘**입니다 (「다름 0」 이 아닙니다) */
    원래log('CE2 vs gas: 같음 ' + 같음.length
      + ' · **gas 에만 ' + 살아있는옛것만.length + '** ← 이게 0 이어야 통과'
      + '  (CE2 에만 ' + 새것만.length + ')'
      + '  첨부로 가린 것 ' + 셈.첨부로가림 + '건'
      + '   [' + 오늘 + ' · 모집중만]');
    if (한줄) process.exit(0);

    console.log('\n━━ 옛 수집기(CE)와 대조 — 공고 번호로');
    console.log('  같음 ' + 같음.length + ' · CE2 에만 ' + 새것만.length
      + ' · gas 에만 ' + 옛것만.length + ' (그중 아직 모집중 ' + 살아있는옛것만.length + ' ← 진짜 차이)');
    const 보기 = (이름, 열쇠들, 집) => {
      if (!열쇠들.length) return;
      console.log('\n  ' + 이름 + ' 5건 —');
      열쇠들.slice(0, 5).forEach((k) => {
        const v = 집.get(k);
        console.log('    ' + k + '  ' + String(v.org_name).slice(0, 20).padEnd(22) + String(v.title).slice(0, 44)
          + (v.evidence ? '   [' + v.evidence.직군근거 + '·' + v.evidence.갈래 + ']' : ''));
      });
    };
    보기('CE2 에만', 새것만, 새집);
    보기('gas 에만 (아직 모집중)', 살아있는옛것만, 옛집);
  }
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0, 건너뜀 = 0;
  for (let i = 0; i < 담을것.length; i += 200) {
    const r = await rpc(cfg, 'collect_put', {
      p_secret: cfg.COLLECT_KEY_CE2, p_source: SOURCE, p_rows: 담을것.slice(i, i + 200),
    });
    담음 += r['담음'] || 0; 건너뜀 += r['건너뜀'] || 0;
    (r['건너뛴것'] || []).slice(0, 5).forEach((x) => console.error('  건너뜀 ' + x.id + ' · ' + x.why));
  }
  console.log('\n씀          ' + 담음 + '건' + (건너뜀 ? ' · 건너뜀 ' + 건너뜀 + '건' : ''));

  let 버림 = 0;
  for (let i = 0; i < 버릴것.length; i += 200) {
    const r = await rpc(cfg, 'collect_trash', {
      p_secret: cfg.COLLECT_KEY_CE2, p_source: SOURCE, p_rows: 버릴것.slice(i, i + 200),
    });
    버림 += r['담음'] || 0;
    (r['건너뛴것'] || []).slice(0, 5).forEach((x) => console.error('  쓰레기통 건너뜀 ' + x.id + ' · ' + x.why));
  }
  console.log('쓰레기통     ' + 버림 + '건 (사유를 함께 남겼습니다)');
  console.log(Math.round((Date.now() - t0) / 1000) + '초');
}
