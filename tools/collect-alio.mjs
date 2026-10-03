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
import { 모두받기 } from './쪽나눠받기.mjs';
import { matchJob, notOurs, mixedTitle, titleOtherOnly, MEDTECH, 구운날 } from './gas-rules.mjs';
import { sortJob } from './sort-rule.mjs';
import { pdf글자, 쓸수있나 as OCR쓸수있나, 멈췄나 as OCR멈췄나, 이름표 as OCR이름표 } from './ocr/index.mjs';
import { 공공부르기, 한도알리기, 한도들 } from './공공데이터부르기.mjs';
import { 판정한것빼기, 판정남기기, 지문 } from './순찰기억.mjs';

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
  /* 서버에서는 HS3 서버 전용 값을 씁니다 — collect_secret 에 같은 값을 등록해 뒀습니다.
     값을 어디로도 옮기지 않으려고 이렇게 합니다 (GitHub Actions 는 제 열쇠를 그대로 씁니다) */
  out.COLLECT_KEY_AL2 = out.COLLECT_KEY_AL2 || out.COLLECT_KEY_HS3;

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

/* 못 받았을 때 **왜 못 받았는지를 반드시 찍습니다** (2026-09-26).
   전에는 응답을 통째로 삼켜서, GitHub 에서 0건이 나왔을 때 시간 초과인지
   403 인지 칸 이름이 다른 건지 알 길이 없었습니다.
   진단 함수가 원문을 안 찍으면 진단을 못 합니다. */
async function 목록한쪽(cfg, page, 떠들기) {
  const q = new URLSearchParams({ pageNo: String(page), numOfRows: '100', ongoingYn: 'Y' });
  for (let t = 0; t < 3; t++) {
    if (t) await 쉬기(1500 * t);
    const t0 = Date.now();
    let 어땠나 = '';
    try {
      /* 인증키는 이미 인코딩돼 있어 **다시 감싸면 안 됩니다** */
      /* ⚠ **이 창구는 POST 만 받습니다.** GET 으로 보내면
         「Request method 'GET' not supported」 가 옵니다 (2026-09-30 에 제가 그렇게 깨뜨렸습니다) */
      const r = await 공공부르기(목록URL + '?serviceKey=' + cfg.ALIO_LIST_KEY + '&' + q,
        { 방법: 'POST', headers: { accept: 'application/json', 'User-Agent': UA } });
      const txt = r.글;
      const ms = Date.now() - t0;
      if (떠들기) {
        console.log('    [' + page + '쪽 ' + (t + 1) + '번째] HTTP ' + r.code
          + ' · ' + ms + 'ms · ' + txt.length + '자 · 오늘 남은 몫 ' + r.남음 + '/' + r.한도
          + (r.다시 ? ' · 다시 ' + r.다시 + '번' : ''));
      }
      if (r.code !== 200) {
        어땠나 = r.왜 || ('HTTP ' + r.code);
      } else {
        let j = null;
        try { j = JSON.parse(txt); }
        catch (e) { 어땠나 = 'JSON 이 아닙니다 (' + e.message.slice(0, 60) + ')'; }
        if (j) {
          /* resultCode 5 는 **알리오 쪽이 잠깐 안 되는 것**입니다.
             열쇠가 틀려도 같은 값이 오지만(2026-09-26 확인), 실제로 겪어 보니
             **같은 열쇠로 조금 뒤에 다시 하면 됩니다.**
             GitHub 에서 한 번 0건이 나와 열쇠를 의심했는데, 그대로 다시
             돌리니 500건이 왔습니다. **열쇠를 다시 볼 일이 아닙니다.** */
          if (j.resultCode === '5') {
            어땠나 = 'resultCode 5 · ' + (j.resultMsgEng || '') + ' / ' + (j.resultMsg || '');
          }
          else if (!j.result) {
            어땠나 = 'result 칸이 없습니다 · 맨 위 칸 이름 — ' + Object.keys(j).join(',');
          } else {
            if (떠들기) console.log('    → 받았습니다. 맨 위 칸 — ' + Object.keys(j).join(','));
            return j;
          }
        }
      }
      if (떠들기) {
        console.log('    ✗ ' + 어땠나);
        console.log('    응답 앞 500자 — ' + txt.slice(0, 500).replace(/\s+/g, ' '));
      }
    } catch (e) {
      if (떠들기) {
        console.log('    [' + page + '쪽 ' + (t + 1) + '번째] 못 붙음 · '
          + (Date.now() - t0) + 'ms · ' + String(e.message).slice(0, 200)
          + (e.cause ? ' · ' + String(e.cause.message || e.cause).slice(0, 120) : ''));
      }
    }
  }
  return null;
}

/* 알리오가 **이 자리(GitHub)의 IP 를 막는지** 봅니다.
   열쇠 없이 두드려서 응답 코드만 봅니다 — 막혔으면 열쇠와 상관없이 막힙니다 */
async function 막혔나() {
  const 볼것 = [
    ['목록 (열쇠 없이 POST)', 목록URL, 'POST'],
    ['목록 (열쇠 없이 GET)', 목록URL, 'GET'],
    ['포털 첫 화면', 'https://opendata.alio.go.kr/new/', 'GET'],
    ['상세 (열쇠 없이 GET)', 상세URL, 'GET'],
  ];
  for (const [이름, u, m] of 볼것) {
    const t0 = Date.now();
    try {
      const r = await fetch(u, { method: m, headers: { 'User-Agent': UA }, redirect: 'follow' });
      const txt = await r.text();
      console.log('  ' + 이름.padEnd(24) + 'HTTP ' + String(r.status).padEnd(5)
        + (Date.now() - t0) + 'ms · ' + txt.length + '자 · '
        + txt.slice(0, 90).replace(/\s+/g, ' '));
    } catch (e) {
      console.log('  ' + 이름.padEnd(24) + '못 붙음 · ' + (Date.now() - t0) + 'ms · '
        + String(e.message).slice(0, 90)
        + (e.cause ? ' · ' + String(e.cause.message || e.cause).slice(0, 80) : ''));
    }
  }
}
async function 상세받기(cfg, sn) {
  const n = String(sn || '').replace(/\D/g, '');
  if (!n) return null;
  try {
    const r = await 공공부르기(상세URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&sn=' + n,
      { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (r.code !== 200) return null;
    const j = JSON.parse(r.글);
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
    /* 어디에 맡기는지는 tools/ocr/index.mjs 가 정합니다. 여기는 모릅니다.
       곁들이는 0자가 나왔을 때 남길 자료입니다 (2026-09-30 덫) */
    return await pdf글자(buf, pdf.atchFileNm,
      { ctype: r.headers.get('content-type') || '',
        공고: String(box.sn || box.recrutPblntSn || '') });
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
  if (notOurs(title)) { 셈.남의자리++; r.__판정 = '남의 자리'; return null; }

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

  if (!job) {
    job = matchJob(hay);
    if (job) {
      /* 전에는 그냥 '목록' 이라고만 적었습니다. 그러면 나중에 「이게 왜 우리
         공고지?」 를 물었을 때 **어느 칸의 어느 낱말이 걸렸는지 알 수가 없어**
         매번 API 를 다시 두드려야 했습니다 (2026-10-01).
         어느 칸인지와 그 앞뒤 글자를 같이 남깁니다. */
      const 걸린칸 = Object.entries(r)
        .filter(([k]) => !우대칸.includes(k))
        .find(([, v]) => matchJob(String(v ?? '')));
      if (걸린칸) {
        const 글 = String(걸린칸[1] ?? '').replace(/\s+/g, ' ');
        const 어디 = 글.search(/물리치료|작업치료/);
        근거 = '목록 · ' + 걸린칸[0] + ' 칸 — 「'
          + 글.slice(Math.max(0, 어디 - 30), 어디 + 50).trim() + '」';
      } else {
        근거 = '목록 (어느 칸인지 못 가림)';
      }
    }
  }
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
        셈.남의자리++; r.__판정 = '남의 자리'; return null;
      }
      /* 「의료기술·의료기사·보건직」 같은 말이 있어야 우리 직군이 숨어 있을 수
         있습니다. 그런 말이 없으면 우리와 무관한 공고입니다 */
      if (!job && !우대에만 && !MEDTECH.test(hay)) { 셈.우리와무관++; r.__판정 = '우리와 무관'; return null; }

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
  if (끝8.length === 8 && 끝8 < 오늘8) { 셈.마감++; r.__판정 = '마감'; return null; }

  /* ⑥ 네 갈래 — 규칙은 tools/sort-rule.mjs 한 벌 */
  const 갈래 = sortJob(title, job || '');
  /* 다시 받아야 할 까닭으로 걸린 것은 **판정을 안 남깁니다** (2026-10-01).
     남기면 순찰이 영영 건너뛰어 다시 OCR 할 기회를 잃습니다.
     실제로 걸렸습니다 — 충남대학교병원 「보건직(의학물리사)」 공고가 구글
     드라이브 500 (drive.files.insert Internal Error) 으로 OCR 에 실패했습니다.
     보류함에 있으니 사람은 봅니다. 다만 **자동으로 다시 해 볼 길**을 남깁니다.
     사람이 봐야 하는 까닭(우대 자격증뿐·뭉뚱그림·한글 첨부)은 남깁니다 —
     다시 받아도 결과가 같고, 관리자가 처리할 몫입니다 */
  const 다시볼까닭 = /OCR 실패|OCR 을 맡길 곳이 없어|PDF 를 못 받음|PDF 가 아닌 것이 옴|상세를 못 받았습니다/;
  r.__판정 = (hold && 다시볼까닭.test(hold)) ? '' : (hold ? '보류함' : 갈래.갈래);
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
  if (!열쇠) {
    console.log('  (대조 안 함 — SUPABASE_SERVICE_KEY 가 없습니다.');
    console.log('   job_posts 를 통째로 읽는 것은 anon 에게 **일부러** 안 열어 뒀습니다.');
    console.log('   GitHub 에서는 대조가 안 되고 집 컴퓨터에서만 됩니다)');
    return null;
  }
  /* ★ 전에는 `&limit=2000` 이었습니다. 그 글자는 거짓입니다 —
     PostgREST 가 **100줄에서 자릅니다.** limit 을 키워도 안 됩니다.
     AL 은 지금 58줄이라 안 걸렸지만, 100을 넘으면 대조가 조용히
     틀려집니다 (없는 공고를 「새로 생겼다」고 셉니다). 쪽을 나눕니다 */
  const u = cfg.SUPABASE_URL
    + '/rest/v1/job_posts?source=eq.AL&select=id,title,org_name,job_group,hold,apply_to';
  try {
    return await 모두받기(u, { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 });
  } catch (e) {
    console.error('  옛것 읽기 실패 · ' + String(e.message).slice(0, 300));
    return null;
  }
}

/* ── 본체 ─────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
/* --한줄 — 사흘 대조용. 담지 않고 「AL2 vs gas: 같음 N · 다름 N」 만 찍습니다.
 *
 * ── 왜 DB 를 읽어 견주지 않나 ────────────────────────────────
 * 처음에 job_posts 의 source 로 견주는 도구를 따로 만들었다가 지웠습니다.
 * **거짓말을 합니다** — 겹치는 공고는 gas 가 임자라 AL2 로 안 써집니다
 * (collect_put 이 남의 줄을 안 덮습니다). 그래서 source 로 세면 「같음」이
 * 영원히 0 입니다. 2026-09-26 에 실제로 0 이 나와 알았습니다.
 *
 * 견줄 것은 「표에 뭐가 있나」가 아니라 **「새 수집기가 뭐라고 판정하나」**
 * 입니다. 그건 dry 가 내는 것이고, 규칙이 한 벌이니 여기서 같이 냅니다.
 */
const 한줄 = argv.includes('--한줄');
const dry = argv.includes('--dry') || 한줄;
/* --순찰 — 자주 도는 가벼운 모드. 첫 쪽만 받고 DB 에 없는 번호만 상세를 엽니다 */
const 순찰 = argv.includes('--순찰');
const 몇건 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
/* --한줄 일 때는 중간 로그를 죽입니다. 한 줄만 남기려고요 */
const 원래log = console.log;
if (한줄) console.log = () => {};
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
      : '열쇠 없음 → PDF 는 보류함으로'));
console.log('도는 곳 ' + (process.env.GITHUB_ACTIONS ? 'GitHub Actions' : '집 컴퓨터')
  + ' · node ' + process.version);

/* ── 열쇠가 들어왔나 (값은 안 찍습니다. 있는지와 길이만) ──────
   이름이 어긋나면 「없다」가 아니라 **엉뚱한 값**이 들어옵니다.
   workflow 의 env 이름과 Secrets 이름이 같은지 여기서 드러납니다 */
console.log('\n── 열쇠 ──');
for (const k of ['ALIO_LIST_KEY', 'ALIO_DETAIL_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
                 'COLLECT_KEY_AL2', 'OCR_GAS_URL', 'OCR_KEY', 'SUPABASE_SERVICE_KEY']) {
  const v = cfg[k];
  console.log('  ' + k.padEnd(22) + (v ? '있음 · ' + String(v).length + '자' : '없음'));
}

/* ── 알리오가 이 자리를 막는지 (열쇠와 상관없이) ── */
if (dry) {
  console.log('\n── 알리오가 이 자리를 막나 (열쇠 없이 두드려 응답 코드만) ──');
  await 막혔나();
}

/* ① 목록 — 순찰이면 첫 쪽만, 아니면 전부 ─────────────────────
   순찰(--순찰)은 **자주, 가볍게** 도는 모드입니다 (2026-10-01).
     목록 첫 쪽만 받고 → DB 에 없는 번호만 골라 → 그것만 상세를 엽니다
     새 공고가 없으면 상세를 한 번도 안 열고 몇 초에 끝납니다.
   전체 한 바퀴(--순찰 없이)는 지금처럼 다 훑습니다 —
   마감일이 바뀌거나 고쳐진 것을 따라잡는 몫입니다. */
console.log('\n── 목록 받기 ──' + (순찰 ? ' (순찰 — 첫 쪽만)' : ''));
let rows = [];
let total = null;
for (let p = 1; p <= (순찰 ? 1 : 120); p++) {
  /* 첫 쪽은 무슨 일이 있었는지 다 찍습니다. 뒷쪽까지 찍으면 로그가 넘칩니다 */
  const j = await 목록한쪽(cfg, p, p === 1 || dry);
  if (!j) {
    console.error('  ' + p + '쪽에서 멈췄습니다');
    /* 세 번 다시 두드려도 안 되면 **알리오 쪽 일입니다.**
       2026-09-26 에 한 번 0건이 나와 열쇠를 의심했는데, 그대로 다시 돌리니
       500건이 왔습니다. 다음 사람이 같은 데를 파지 않게 적어 둡니다 */
    console.error('  ※ 세 번 다 실패했습니다 — **알리오 쪽 오류입니다. 열쇠 확인 불필요.**');
    console.error('     같은 열쇠로 조금 뒤에 다시 돌리면 됩니다 (30분 뒤 저절로 다시 돕니다).');
    break;
  }
  if (p === 1) {
    console.log('  totalCount 원문 — ' + JSON.stringify(j.totalCount)
      + ' · result 줄 수 ' + (j.result || []).length);
  }
  if (total === null) total = Number(j.totalCount || 0);
  const 쪽 = j.result || [];
  if (!쪽.length) break;
  rows = rows.concat(쪽);
  if (rows.length >= total) break;
  await 쉬기(200);
}
console.log('받음        ' + rows.length + '건 (접수중 ' + total + '건) · ' + Math.round((Date.now() - t0) / 1000) + '초');

const 열쇠 = cfg.COLLECT_KEY_AL2 || cfg.COLLECT_KEY_HS3 || '';

/* ①-2 순찰이면 **DB 에 없는 번호만** 남깁니다 ─────────────────
   이걸 안 하면 순찰이 돌 때마다 상세 100번을 다시 엽니다.
   창구가 막히면(열쇠·통신) **거르지 않고 그대로 갑니다** —
   거르다 실패했다고 공고를 놓치면 안 됩니다. */
if (순찰 && rows.length) {
  const 번호들 = rows.map((r) => String(r.recrutPblntSn)).filter(Boolean);
  try {
    if (!열쇠) throw new Error('COLLECT_KEY 가 없습니다');
    /* ★ **100개씩** 묻습니다. Supabase 는 줄을 돌려주는 함수의 응답을 100줄로
       자릅니다 (2026-10-02 확인). 순찰은 한 쪽이 100건이라 지금은 딱 한도에
       걸터앉아 있습니다 — 쪽이 101건이 되면 조용히 덜 거릅니다.
       덜 거르면 상세를 더 열 뿐이라 공고가 빠지지는 않지만, 순찰의 뜻이 없어집니다 */
    const 있는것 = new Set();
    for (let i = 0; i < 번호들.length; i += 100) {
      const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('있는번호'), {
        method: 'POST',
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_secret: 열쇠, p_source: SOURCE, p_ids: 번호들.slice(i, i + 100) }),
      });
      const 글 = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status + ' · 응답 원문 — ' + 글.slice(0, 400));
      for (const x of JSON.parse(글)) 있는것.add(String(x.id));
    }
    const 전 = rows.length;
    rows = rows.filter((r) => !있는것.has(String(r.recrutPblntSn)));
    console.log('순찰        이미 있는 것 ' + 있는것.size + '건을 빼고 '
      + rows.length + '건만 봅니다 (받은 ' + 전 + '건 중)');
  } catch (e) {
    console.error('순찰        ★ 있는 번호를 못 물어봤습니다 — 거르지 않고 그대로 갑니다');
    console.error('            ' + String(e.message).slice(0, 400));
  }
}

/* ①-3 순찰은 **이미 판정한 번호도** 건너뜁니다 (2026-10-01) ─────
   있는번호만으로는 모자랍니다. 「우리 직군이 아니라 안 담은」 공고는
   job_posts 에 없으니 순찰마다 되살아나 상세를 다시 열고, 첨부가 있으면
   OCR 까지 다시 돕니다. 실측 — 받은 100건 중 13건이 그랬고(남의 자리 6 ·
   우리와 무관 7), 그중 9건이 상세를 다시 열었습니다.

   그래서 버린 것까지 판정을 기억해 두고(수집판정 표), 목록 줄이 그대로면
   건너뜁니다. 알리오 목록에는 **수정일 칸이 없습니다** — 날짜 칸은
   pbancBgngYmd·pbancEndYmd 둘뿐이고 decimalDay 는 D-day 라 날마다 바뀝니다.
   그래서 수정일 대신 목록 줄의 지문을 견줍니다. 지문이 달라지면 다시 봅니다.

   **전체 한 바퀴(--순찰 없이)는 건너뛰지 않습니다** — 하루 한 번은 다 봅니다. */
if (순찰 && rows.length) {
  rows = await 판정한것빼기(cfg, { 열쇠, source: SOURCE, 줄들: rows,
    번호뽑기: (r) => r.recrutPblntSn });
}

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
/* ②-2 내린 판정을 기억에 남깁니다 — **버린 것까지** (2026-10-01).
   담지 않은 공고도 남겨야 순찰이 같은 상세를 다시 안 엽니다.
   남기는 것은 번호·출처·판정·판정때·지문뿐입니다. 공고 본문은 안 담습니다.
   던진 줄(셈.건너뜀)은 **안 남깁니다** — 다음에 다시 봐야 하니까요. */
if (!dry) {
  await 판정남기기(cfg, { 열쇠, source: SOURCE, 줄들: 볼것
    .filter((r) => r.__판정 && r.recrutPblntSn)
    .map((r) => ({ 번호: String(r.recrutPblntSn), 판정: r.__판정, 지문: 지문(r) })) });
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
    /* 알리오는 srcUrl 에 **공고별 주소가 아니라 기관 대문**을 주는 때가 많습니다
       (2026-10-01). 근로복지공단 12건이 전부 comwel.or.kr/recruit/hp/main.do
       하나였습니다 — 눌러도 그 공고로 안 갑니다.
       알리오 자체 공고 쪽으로 보냅니다. 확인한 것 — idx 는 recrutPblntSn 과
       같은 번호입니다 (305616·305572·305539 세 건을 열어 API 제목이
       그 쪽 안에 있는 것을 봤습니다).
       기관 대문은 detail.기관홈 에 그대로 남깁니다 — 버리지 않습니다. */
    url: r.recrutPblntSn
      ? 'https://job.alio.go.kr/recruitview.do?idx=' + r.recrutPblntSn
      : de(r.srcUrl),
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
    /* ── 사흘 대조용 한 줄 ────────────────────────────────────
       **통과 기준은 「gas 에만 0」 이 사흘입니다** (2026-09-26 정정).
       「다름 0」 이 아닙니다 — AL2 가 더 찾는 것은 **좋은 일**이라
       그걸 차이로 세면 영영 통과가 안 됩니다.
       대신 「AL2 에만」 은 **진짜 우리 공고인지** 눈으로 봐야 합니다.
       잘못 넓게 잡은 것이면 그것도 문제입니다.

       마감된 옛 공고는 알리오가 안 주므로 차이가 아닙니다 */
    원래log('AL2 vs gas: 같음 ' + 같음.length
      + ' · **gas 에만 ' + 살아있는옛것만.length + '** ← 이게 0 이어야 통과'
      + '  (AL2 에만 ' + 새것만.length + ' — 더 찾은 것이라 좋은 쪽)'
      + '   [' + 오늘 + ' · 접수중만]');
    if (한줄) process.exit(0);

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

/* 박동 — 관리자 → 기관 현황 화면이 이것으로 「돌고 있나」를 봅니다 (2026-10-02).
   알리오·클린아이만 빠져 있어서 collector_beat 에 안 남았습니다. 그래서
   24시간 실행 여부를 로그로만 확인할 수 있었습니다.
   **순찰도 남깁니다** — 순찰이 멈춘 것도 화면에서 보여야 합니다 */
if (!dry) {
  try {
    await rpc(cfg, 'collect_beat', {
      p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
      p_beat: { took_ms: Date.now() - t0, ok: !process.exitCode,
        본곳: 1, 담음: 회원.length + 보류.length, 보류: 보류.length,
        버림: 쓰레기.length, 못받음: 셈.상세못받음,
        메모: { 모드: 순찰 ? '순찰' : '전체', 받음: rows.length, 상세: 셈.상세,
          OCR: 셈.OCR, 남의자리: 셈.남의자리, 우리와무관: 셈.우리와무관, 건너뜀: 셈.건너뜀 } },
    });
  } catch (e) { console.error('박동 못 남김 · ' + String(e.message).slice(0, 120)); }
}

/* 남은 하루 한도를 남깁니다 — 쓴 양은 신청 건마다 하나이고
   우리 열쇠 둘이 같이 씁니다. 남이 쓰면 우리 몫도 줄어듭니다 (2026-09-30) */
const 한도 = await 한도알리기('AL2');
if (한도.왜) console.error('한도 기록 못 함 · ' + 한도.왜);
else if (한도.올림) {
  console.log('한도 기록    ' + 한도들().map((x) =>
    x.서비스.replace(/^apis?\.data\.go\.kr/, '') + ' ' + (x.한도 - x.남음) + '/' + x.한도).join(' · '));
}
