/* 알리오 새 수집기 — 시트를 거치지 않고 DB 에 바로 담습니다 (2026-09-26).
 *
 *   node tools/collect-alio.mjs --dry     담지 않고 옛 수집기(AL)와 대조만
 *   node tools/collect-alio.mjs           정말로 담습니다 (source = AL2)
 *   node tools/collect-alio.mjs --dry --n 40   상세를 40건만 열어 봅니다 (빠른 확인)
 *
 * ── 규칙은 한 벌입니다 ────────────────────────────────────────
 *   직군 판정   tools/gas-rules.mjs  (gas/wage.js 에서 떼어 옵니다. 안 베낍니다)
 *   네 갈래     tools/sort-rule.mjs
 *   기관 붙이기 DB 의 org_public()   (대괄호 병원명·본사 이름·분원을 이미 풉니다)
 *   쓰기        DB 의 collect_put()  ← **유일한 쓰기 통로.** service_role 을 안 씁니다
 *
 * ── 열쇠 (GitHub Secrets) ─────────────────────────────────────
 *   ALIO_LIST_KEY     알리오 목록 (opendata.alio.go.kr) — 이미 인코딩된 키
 *   ALIO_DETAIL_KEY   상세 (apis.data.go.kr/1051000) — 이미 인코딩된 키
 *   SUPABASE_URL · SUPABASE_ANON_KEY
 *   COLLECT_KEY_AL2   collect_put 의 열쇠
 *   GDRIVE_SA_JSON    구글 서비스 계정 (PDF OCR용) — 없으면 PDF 는 보류함으로
 *
 * ── 6분 한도가 없습니다 ───────────────────────────────────────
 * gas 는 예산을 쪼개 며칠에 나눠 돌았습니다. 여기서는 한 번에 다 봅니다.
 * 「어디까지 봤는지 기억하기」 구조를 안 옮긴 까닭입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchJob, notOurs, mixedTitle, titleOtherOnly, MEDTECH, 구운날 } from './gas-rules.mjs';
import { sortJob } from './sort-rule.mjs';
import { pdf글자, 쓸수있나 as OCR쓸수있나, 멈췄나 as OCR멈췄나, 이름표 as OCR이름표 } from './ocr/index.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'AL2';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const 목록URL = 'https://opendata.alio.go.kr/new/v1/recruit/list.do';
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';

/* ── 설정 ─────────────────────────────────────────────────── */
function env() {
  const out = {};
  /* 집 컴퓨터의 두 곳. Actions 에는 없고 환경변수로 옵니다 */
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  /* 화면 쪽 이름으로 들어 있으면 그것도 받습니다 */
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;

  /* 집 컴퓨터에서는 gas/wage.js 안의 열쇠를 빌려 씁니다.
     Actions 에는 gas/ 가 없으니 Secrets 로 와야 합니다 */
  const gas = path.join(여기, '..', 'gas', 'wage.js');
  if (fs.existsSync(gas)) {
    const src = fs.readFileSync(gas, 'utf8');
    const 뽑기 = (re) => (src.match(re) || [])[1] || '';
    out.ALIO_LIST_KEY = out.ALIO_LIST_KEY
      || 뽑기(/const JOB_API = \{[\s\S]*?KEY:\s*'([^']+)'/);
    out.ALIO_DETAIL_KEY = out.ALIO_DETAIL_KEY
      || 뽑기(/const ALIO_D = \{[\s\S]*?KEY:\s*'([^']+)'/);
  }
  return out;
}

/* ── 알리오 두드리기 ──────────────────────────────────────── */
const de = (s) => String(s ?? '')
  .replace(/&#xD;/gi, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function 목록한쪽(cfg, page) {
  const q = new URLSearchParams({ pageNo: String(page), numOfRows: '100', ongoingYn: 'Y' });
  for (let t = 0; t < 3; t++) {
    if (t) await 쉬기(1500 * t);
    try {
      /* 인증키는 이미 인코딩돼 있어 **다시 감싸면 안 됩니다** */
      const r = await fetch(목록URL + '?serviceKey=' + cfg.ALIO_LIST_KEY + '&' + q,
        { method: 'POST', headers: { accept: 'application/json', 'User-Agent': UA } });
      if (r.status !== 200) continue;
      const j = JSON.parse(await r.text());
      if (j && j.resultCode === '5') continue;
      if (j && j.result) return j;
    } catch { /* 다시 */ }
  }
  return null;
}
async function 상세받기(cfg, sn) {
  const n = String(sn || '').replace(/\D/g, '');
  if (!n) return null;
  try {
    const r = await fetch(상세URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&sn=' + n,
      { headers: { 'User-Agent': UA } });
    if (r.status !== 200) return null;
    const j = JSON.parse(await r.text());
    const box = j && j.result;
    return Array.isArray(box) ? box[0] : box || null;
  } catch { return null; }
}
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));

/* 첨부를 받으려면 포털 세션 쿠키가 있어야 합니다.
   없으면 파일 대신 포털 첫 화면(8,333자 HTML)이 옵니다 — 확인했습니다 */
let 쿠키 = null;
async function 포털쿠키() {
  if (쿠키 !== null) return 쿠키;
  const jar = {};
  let u = 'https://opendata.alio.go.kr/new/';
  for (let hop = 0; hop < 4 && u; hop++) {
    const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': UA, Cookie: 담기(jar) } });
    (r.headers.getSetCookie?.() || []).forEach((x) => {
      const kv = String(x).split(';')[0], i = kv.indexOf('=');
      if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    });
    const loc = r.headers.get('location');
    u = (r.status >= 300 && r.status < 400 && loc)
      ? (/^https?:/.test(loc) ? loc : 'https://opendata.alio.go.kr' + loc) : '';
  }
  쿠키 = 담기(jar);
  return 쿠키;
}
const 담기 = (jar) => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');

/** 첨부 공고문(A)을 받아 글자로. 못 읽으면 '' */
async function 공고문글자(box, 셈) {
  const files = box.files || [];
  const pdf = files.find((f) => String(f.atchFileType) === 'A'
    && /\.pdf$/i.test(String(f.atchFileNm || '')));
  if (!pdf) {
    const hwp = files.some((f) => String(f.atchFileType) === 'A' && /\.hwpx?$/i.test(String(f.atchFileNm || '')));
    return { 글: '', 왜: hwp ? '공고문이 한글(hwp)이라 못 읽음' : '공고문 첨부가 없음' };
  }
  if (!OCR쓸수있나()) return { 글: '', 왜: 'PDF 공고문 · OCR 을 맡길 곳이 없어 못 읽음' };
  try {
    const ck = await 포털쿠키();
    const r = await fetch(pdf.url, { headers: { 'User-Agent': UA, Cookie: ck, Referer: 'https://opendata.alio.go.kr/new/' } });
    const buf = Buffer.from(await r.arrayBuffer());
    /* **받은 것이 정말 PDF 인지 봅니다.** 주소가 틀리면 HTML 이 옵니다 */
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return { 글: '', 왜: 'PDF 가 아닌 것이 옴 (' + buf.length + '바이트)' };
    }
    셈.OCR++;
    /* 어디에 맡기는지는 tools/ocr/index.mjs 가 정합니다. 여기는 모릅니다 */
    return await pdf글자(buf, pdf.atchFileNm);
  } catch (e) {
    return { 글: '', 왜: 'PDF 를 못 받음 · ' + String(e.message).slice(0, 80) };
  }
}

/* ── 한 건을 판정합니다 ───────────────────────────────────── */
async function 한건(cfg, r, 셈, 옵션) {
  const title = de(r.recrutPbancTtl);
  const org = de(r.instNm);
  const id = String(r.recrutPblntSn || '');
  if (!id) return null;

  /* ① 제목이 남의 자리뿐이면 볼 것 없습니다 */
  if (notOurs(title)) { 셈.남의자리++; return null; }

  /* ② 제목 → ③ 목록 전체 */
  let job = matchJob(title);
  let 근거 = job ? '제목' : '';

  /* ── 우대 칸은 **따로 봅니다** (2026-09-26) ────────────────────
     목록 응답에도 `prefCn`(우대사항)이 들어 있습니다. 그대로 이어 붙여
     보면, 「작업치료사 1급」이 **가산점 주는 자격증 목록**에만 적힌 조리원
     공고가 작업치료사 공고로 확정됩니다 (305299 대한적십자사가 그랬습니다).
     우대 칸은 「있으면 좋다」는 뜻일 뿐이라 직군을 정하지 않습니다.
     대신 보류함으로 보내 사람이 봅니다. */
  const 우대칸 = ['prefCn', 'prefCondCn'];
  const hay = Object.entries(r)
    .filter(([k]) => !우대칸.includes(k))
    .map(([, v]) => String(v ?? '')).join(' ');
  const 우대글 = 우대칸.map((k) => String(r[k] ?? '')).join(' ');
  let 우대에만 = !!matchJob(우대글);

  if (!job) { job = matchJob(hay); if (job) 근거 = '목록'; }
  if (job) 우대에만 = false;   // 제대로 된 칸에서 나왔으면 우대는 상관없습니다

  let hold = '', 인원 = Number(r.recrutNope) || null, 못읽은까닭 = '';

  /* ④ 상세 — 접수중 500건 중 467건이 여기까지 옵니다 */
  if (!job && !옵션.상세안열기) {
    셈.상세++;
    const box = await 상세받기(cfg, id);
    if (!box) { 셈.상세못받음++; hold = '상세를 못 받았습니다'; }
    else {
      const names = (box.steps || []).map((s) => String(s.recrutPbancTtl || '').trim()).filter(Boolean);
      const j1 = matchJob(names.join(' · '));
      if (j1) {
        job = j1; 근거 = '상세 전형단계';
        /* 우리 직군이 든 단계만 세어 인원을 냅니다 (전체 51명이 아니라) */
        let n = 0;
        names.forEach((t) => {
          if (!/작업치료|물리치료/.test(t)) return;
          const m = t.match(/[-–]\s*\((\d{1,3})\)\s*$/) || t.match(/\((\d{1,3})\s*명\)/);
          n += m ? Number(m[1]) : 1;
        });
        if (n) 인원 = n;
      }
      /* ── 자격 칸 · 우대 칸 ────────────────────────────────────
         **두 칸을 갈라 봅니다.** gas 는 둘을 이어 붙여 한꺼번에 봤는데,
         그래서 305299 대한적십자사 「직원(조리원) 채용공고」가
         작업치료사 공고로 담겼습니다 — 「작업치료사 1급」이 **가산점 주는
         자격증 목록**에만 있었습니다 (조리기능사·사회복지사·언어재활사와 나란히).

         모집분야·자격요건에 있으면 그 자리를 뽑는 것입니다 → 회원 목록.
         우대·가산점에만 있으면 **있으면 좋다**는 뜻일 뿐입니다 → 보류함.
         (2026-09-26 · 세중님이 정하신 규칙) */
      if (!job) {
        const j2 = matchJob(String(box.aplyQlfcCn || ''));
        if (j2) { job = j2; 근거 = '상세 자격요건'; }
      }
      /* 우대 칸에서 보이면 **바로 보류로 굳히지 않습니다.** 뒤이어 첨부
         공고문에서 「모집분야: 작업치료사」 가 나오면 그건 진짜 우리 자리입니다.
         표시만 해 두고 끝에서 정합니다 */
      /* 상세의 우대 칸도 같은 잣대로 봅니다 (목록에 안 실려 오는 경우가 있습니다) */
      if (!job && !우대에만) {
        우대에만 = !!matchJob(String(box.prefCn || '') + ' ' + String(box.prefCondCn || ''));
      }
      /* ── 버릴 것은 **OCR 하기 전에** 버립니다 (2026-09-26) ──────
         처음에는 첨부를 먼저 읽고 나서 버렸습니다. 그래서 속리산국립공원·
         발전공기업처럼 어차피 버릴 공고까지 OCR 을 돌렸고, 한 번 돌 때
         OCR 실패 줄이 90줄 가까이 나왔습니다. PDF 를 열 값어치가 있는
         공고는 10건 남짓입니다.
         OCR 은 느리고(한 건에 수 초) 드라이브 할당량을 먹습니다.
         **버릴 것을 먼저 버리고, 남은 것만 읽습니다.** */

      /* 제목이 남의 자리인데 단계에도 우리 직군이 없으면 버립니다 (gas 와 같게).
         **다만 우대 칸에 우리 직군이 적혀 있으면 안 버립니다** — 305299
         대한적십자사 조리원 공고가 그렇습니다. 버리면 아무도 못 보고,
         회원 목록에 올리면 조리원 자리가 작업치료사로 뜹니다. 보류함이 맞습니다 */
      if (!job && !우대에만 && titleOtherOnly(title) && 근거 !== '상세 전형단계') {
        셈.남의자리++; return null;
      }
      /* 「의료기술·의료기사·보건직」 같은 말이 있어야 우리 직군이 숨어 있을 수
         있습니다. 그런 말이 없으면 우리와 무관한 공고입니다 */
      if (!job && !우대에만 && !MEDTECH.test(hay)) { 셈.우리와무관++; return null; }

      /* ⑤ 여기까지 살아남은 것만 첨부 공고문을 읽습니다 (OCR) */
      if (!job) {
        const a = await 공고문글자(box, 셈);
        if (a.글) {
          const j3 = matchJob(a.글);
          if (j3) { job = j3; 근거 = '첨부 공고문'; }
          else 못읽은까닭 = '공고문을 읽었지만 우리 직군이 없음';
        } else 못읽은까닭 = a.왜;
      }

      /* ⑥ 그래도 못 가렸으면 보류함으로 — **버리지 않습니다** */
      if (!job) {
        if (우대에만) { hold = '직군이 우대 자격증에만 있음 — 확인 필요'; 근거 = '상세 우대'; }
        else hold = 못읽은까닭 || '직군을 뭉뚱그린 공고입니다';
      }
      if (box.files) r.__files = box.files.length;
      r.__box = box;
    }
  }

  /* 마감된 것은 빼기 */
  const 오늘8 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
  const 끝8 = String(r.pbancEndYmd || '').replace(/\D/g, '');
  if (끝8.length === 8 && 끝8 < 오늘8) { 셈.마감++; return null; }

  /* ⑥ 네 갈래 — 규칙은 tools/sort-rule.mjs 한 벌 */
  const 갈래 = sortJob(title, job || '');
  return { id, org, title, job, 근거, hold, 인원, 갈래, r };
}

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
  /* 옛 수집기(AL)가 담은 공고 번호 — **대조할 때만** 읽습니다.
     job_posts 를 통째로 읽는 것은 anon 에게 안 열려 있습니다(일부러).
     그래서 대조는 열쇠를 가진 집 컴퓨터에서만 됩니다 — Actions 에서는
     대조를 안 하고 담기만 합니다. */
  const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
  if (!열쇠) return null;
  const r = await fetch(cfg.SUPABASE_URL
    + '/rest/v1/job_posts?source=eq.AL&select=id,title,org_name,job_group,hold,apply_to&limit=2000', {
    headers: { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 },
  });
  if (!r.ok) { console.error('  옛것 읽기 실패 ' + r.status); return null; }
  return r.json();
}

/* ── 본체 ─────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 몇건 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
const t0 = Date.now();
const cfg = env();
for (const k of ['ALIO_LIST_KEY', 'ALIO_DETAIL_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
if (!dry && !cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다 (담으려면 필요합니다)'); process.exit(1); }

console.log('알리오 새 수집기 · ' + (dry ? '**--dry · 담지 않습니다**' : '담습니다 (source=' + SOURCE + ')'));
console.log('규칙 구운 날 ' + 구운날 + ' · OCR '
  + (OCR쓸수있나()
      ? OCR이름표
      : '열쇠 없음 → PDF 는 보류함으로') + '\n');

/* ① 목록 전부 */
let rows = [];
let total = null;
for (let p = 1; p <= 120; p++) {
  const j = await 목록한쪽(cfg, p);
  if (!j) { console.error('  ' + p + '쪽에서 멈췄습니다'); break; }
  if (total === null) total = Number(j.totalCount || 0);
  const 쪽 = j.result || [];
  if (!쪽.length) break;
  rows = rows.concat(쪽);
  if (rows.length >= total) break;
  await 쉬기(200);
}
console.log('받음        ' + rows.length + '건 (접수중 ' + total + '건) · ' + Math.round((Date.now() - t0) / 1000) + '초');

/* ② 판정 */
const 셈 = { 상세: 0, 상세못받음: 0, OCR: 0, 남의자리: 0, 우리와무관: 0, 마감: 0, 건너뜀: 0 };
const 건너뛴것 = [];
const 결과 = [];
const 볼것 = 몇건 ? rows.slice(0, 몇건) : rows;
for (const r of 볼것) {
  try {
    const x = await 한건(cfg, r, 셈, {});
    if (x) 결과.push(x);
  } catch (e) {
    셈.건너뜀++;
    if (건너뛴것.length < 20) 건너뛴것.push({ id: r.recrutPblntSn, why: String(e.message).slice(0, 120) });
  }
}
const 회원 = 결과.filter((x) => !x.hold && x.갈래.갈래 === '회원목록');
const 보류 = 결과.filter((x) => x.hold || x.갈래.갈래 === '보류함');
const 쓰레기 = 결과.filter((x) => !x.hold && x.갈래.갈래 === '쓰레기통');

console.log('상세 열림   ' + 셈.상세 + '건 (못 받음 ' + 셈.상세못받음 + ')');
console.log('OCR        ' + 셈.OCR + '건');
/* 열쇠가 죽었으면 **조용히 넘어가지 않습니다.** 빨간 줄로 잡히게 exit 1 입니다 */
if (OCR멈췄나()) { console.error('\n' + OCR멈췄나()); process.exitCode = 1; }
console.log('남의 자리   ' + 셈.남의자리 + '건 · 우리와 무관 ' + 셈.우리와무관 + '건 · 마감 ' + 셈.마감 + '건');
console.log('회원 목록   ' + 회원.length + '건');
console.log('보류함      ' + 보류.length + '건');
console.log('쓰레기통    ' + 쓰레기.length + '건');
if (셈.건너뜀) {
  console.error('건너뜀      ' + 셈.건너뜀 + '건');
  건너뛴것.slice(0, 5).forEach((x) => console.error('    ' + x.id + ' · ' + x.why));
}

/* ③ 담을 줄 만들기 — 쓰레기통은 안 담습니다 */
const 이제 = new Date().toISOString();
const 담을것 = 회원.concat(보류).map((x) => {
  const r = x.r;
  const 지역 = de(r.workRgnNmLst);
  return {
    id: x.id,
    external_id: x.id,
    org_name: x.org, title: x.title,
    hire_type: de(r.recrutSeNm), employ_type: de(r.hireTypeNmLst),
    work_place: 지역, sido: null, sgg: null,
    edu: de(r.acbgCondNmLst),
    headcount: x.인원 || null,
    apply_from: 날(r.pbancBgngYmd), apply_to: 날(r.pbancEndYmd),
    posted_at: 날(r.pbancBgngYmd),
    url: de(r.srcUrl),
    job_group: x.job || null,
    form: (x.근거 === '제목' && !mixedTitle(x.title)) ? null : '포함',
    hidden: false,
    hold: !!(x.hold || x.갈래.갈래 === '보류함'),
    detail: {
      전형방법: 자르기(de(r.scrnprcdrMthdExpln), 900),
      지원자격: 자르기(de(r.aplyQlfcCn), 900),
      우대사항: 자르기(de(r.prefCn || r.prefCondCn), 700),
      결격사유: 자르기(de(r.disqlfcRsn), 700),
      기관홈: de(r.srcUrl),
    },
    evidence: {
      직군근거: x.근거 || '',
      걸린단어: (x.갈래.걸린단어 || []).join(','),
      보류사유: x.hold || (x.갈래.갈래 === '보류함' ? x.갈래.왜 : ''),
      갈래: x.갈래.갈래,
    },
    collected_at: 이제,
  };
});
function 날(v) {
  const t = String(v || '').replace(/\D/g, '');
  return t.length === 8 ? t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6) : null;
}
function 자르기(s, n) { const t = String(s || '').trim(); return t ? t.slice(0, n) : undefined; }

/* ④ 담거나, 옛것과 대조하거나 */
if (dry) {
  const 옛 = await 옛것(cfg);
  if (!옛) { console.log('\n옛 수집기 것을 못 읽었습니다 (대조 못 함)'); }
  else {
    const 옛집 = new Map(옛.map((x) => [String(x.id), x]));
    const 새집 = new Map(담을것.map((x) => [String(x.id), x]));
    const 같음 = [...새집.keys()].filter((k) => 옛집.has(k));
    const 새것만 = [...새집.keys()].filter((k) => !옛집.has(k));
    const 옛것만 = [...옛집.keys()].filter((k) => !새집.has(k));
    /* **마감된 공고는 견주지 않습니다.** 알리오 목록은 접수중만 주는데
       gas 표에는 30일치가 쌓여 있어, 그대로 견주면 「gas 에만 56건」 처럼
       보입니다. 실제로 55건이 이미 마감된 것이었습니다 (2026-09-26) */
    const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const 살아있는옛것만 = 옛것만.filter((k) => {
      const v = 옛집.get(k);
      return !v.apply_to || String(v.apply_to) >= 오늘;
    });
    console.log('\n━━ 옛 수집기(AL)와 대조 — 공고 번호로');
    console.log('  같음        ' + 같음.length + '건');
    console.log('  새 것에만    ' + 새것만.length + '건');
    console.log('  gas 에만    ' + 옛것만.length + '건'
      + '  (그중 아직 접수중 ' + 살아있는옛것만.length + '건 ← **이것만 진짜 차이입니다**)');
    const 보기 = (이름, 열쇠들, 집) => {
      if (!열쇠들.length) return;
      console.log('\n  ' + 이름 + ' 원문 5건 —');
      열쇠들.slice(0, 5).forEach((k) => {
        const v = 집.get(k);
        console.log('    ' + k + '  ' + String(v.org_name || v.org_name).slice(0, 20).padEnd(22)
          + String(v.title).slice(0, 46)
          + (v.evidence ? '   [' + v.evidence.직군근거 + '·' + v.evidence.갈래 + ']' : ''));
      });
    };
    보기('새 것에만', 새것만, 새집);
    보기('gas 에만 (아직 접수중인 것)', 살아있는옛것만, 옛집);
  }
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0, 건너뜀2 = 0;
  for (let i = 0; i < 담을것.length; i += 200) {
    const r = await rpc(cfg, 'collect_put', {
      p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_rows: 담을것.slice(i, i + 200),
    });
    담음 += r['담음'] || 0; 건너뜀2 += r['건너뜀'] || 0;
    (r['건너뛴것'] || []).slice(0, 5).forEach((x) => console.error('  건너뜀 ' + x.id + ' · ' + x.why));
  }
  console.log('\n씀          ' + 담음 + '건' + (건너뜀2 ? ' · 건너뜀 ' + 건너뜀2 + '건' : ''));
  console.log(Math.round((Date.now() - t0) / 1000) + '초');
}
