/* 공고문 첨부를 **kordoc 으로 읽고 칸을 뽑습니다** — 기준은 이 파일 한 벌입니다.
 * (2026-10-11 세중님 1순위 지시 · 지침 6절 「기준은 한 자리」)
 *
 *   import { 첨부읽기, 칸뽑기 } from './공고문읽기.mjs';
 *   const r = await 첨부읽기(buf, '공고문.hwp');
 *   const 칸 = 칸뽑기(r.md, r.글);
 *
 *   자기 점검:  node tools/공고문읽기.mjs <파일> [<파일>...]
 *
 * ── 왜 kordoc 인가 ──────────────────────────────────────────
 * 옛 `tools/hwp/`(맨손 UTF-16LE)는 표를 `<성 명><(한글) ><>` 로 뭉개고
 * **줄 구분이 없습니다.** 그래서 어느 인원이 어느 직군 것인지 못 가립니다.
 * kordoc 은 `rowspan`·`colspan` 까지 살립니다 (2026-10-11 에 실제 파일로 확인) —
 *
 *   | 작업치료사 | 단기고용직 | 1명 | 작업치료사 면허증 소지자 … |
 *   | 물리치료사 | 단기고용직 | 1명 | 물리치료사 면허증 소지자 … |
 *
 * 전체 9명 공고에서 **우리 직군 1명씩**이 분리됩니다 (지침 15절이 요구하는 것).
 *
 * ── 맨손도 함께 씁니다 ──────────────────────────────────────
 * 잰 결과 맨손이 글자가 더 많은 파일이 있었습니다 (8,873 vs 3,874).
 * 표는 kordoc, **직군 판별용 글은 둘을 합쳐** 씁니다 — 잃는 것이 없게.
 *
 * ── 서버 부담 (2026-10-11 실측 · Lightsail CPU 2 · 메모리 2GB) ──
 *   hwp  0.31~0.51초 · 메모리 78~86MB
 *   pdf  1.30~3.68초 · 메모리 127~393MB
 *   평균 0.97초 → 하루 300건이면 4.8분. 한 번에 하나씩 돕니다
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · 모집인원은 **우리 직군 줄의 인원만**. 줄이 없으면 **비웁니다**
 *   · 「0명」·「O명」 같은 값은 버립니다 (2026-10-10 에 28건 나왔던 것)
 *   · 「내규에 따름」·「협의」는 공고 말 그대로. 숫자를 만들지 않습니다
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { 읽기, kordoc있나, 워커끝내기, 워커셈 } from './kordoc워커.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { hsDetailDates } = require_('./hosp/hs_dates.js');

/* kordoc있나 · 읽기 는 tools/kordoc워커.mjs 한 곳에 있습니다 (지침 6절) */
export { kordoc있나, 워커끝내기, 워커셈 };

/* 맨손 hwp — 있으면 씁니다 (없어도 kordoc 만으로 돕니다) */
let 맨손 = null;
try { 맨손 = await import('./hwp/index.mjs'); } catch { /* 넘어갑니다 */ }

/* ── 첨부 한 건 읽기 ──────────────────────────────────────────
 *
 * ★ 2026-10-11 — **상주 워커**를 씁니다 (tools/kordoc워커.mjs).
 * 전에는 파일마다 node 를 새로 띄웠습니다. 바꾸고 재 보니 hwp 가
 * 0.31초 → 0.009~0.057초 이고, 15건 합이 14.6초 → 5.8초,
 * 최대 메모리가 393MB → 239MB 입니다.
 *
 * ★ 스캔 PDF 는 `pageQuality.needsOcr` 를 보고 **필요할 때만** 내장 OCR 을
 * 한 번 더 켭니다 (`ocr: "auto"`). 모델은 ~18MB 이고 서버에 미리 받아 둡니다
 * (`kordoc check-ocr-models`). `formulaOcr` 는 **안 씁니다** (AGPL).
 */
export async function 첨부읽기(buf, 이름 = '공고문.hwp', 옵션 = {}) {
  if (!kordoc있나()) return { md: '', 글: '', 왜: 'kordoc 이 안 깔렸습니다 (tools/kordoc 에서 npm ci)', 초: 0 };

  /* 받은 것이 정말 그 형식인지 **먼저** 봅니다 (지침 5절).
     kordoc 의 detectFormat 과 같은 생각이고, 우리는 바이트만 들고 있어서
     여기서 앞 글자로 봅니다 — 주소가 틀리면 HTML 이 옵니다 */
  const 꼴 = 진짜형식(buf);
  if (!['pdf', 'hwp', 'zip계열'].includes(꼴)) {
    return { md: '', 글: '', 왜: '읽을 수 있는 형식이 아닙니다 (' + 꼴 + ' · ' + buf.length + '바이트)', 초: 0, 꼴 };
  }

  /* 저장 이름은 **ASCII 만** — 한글 경로는 탈이 납니다 (지침 6-2b).
   *
   * ★ 2026-10-12 — ZIP 속을 **kordoc 의 detectZipFormat 으로 가립니다.**
   * 문서(usage.md 417·421줄) —
   *   「detectFormat(buffer) … ZIP 은 hwpx, OLE2 는 hwp 반환」
   *   「ZIP 종류를 가르려면 detectFormat() 이 hwpx 일 때 await detectZipFormat(buffer)」
   * 전에는 ZIP 이면 무조건 `.hwpx` 로 저장했습니다. 공고 첨부에 xlsx·docx 가
   * 섞여 오면 이름과 속이 어긋나, kordoc 이 자동 감지로 살려 주긴 해도
   * 엉뚱한 자리에서 탈이 날 수 있습니다. */
  let 확장자 = 꼴 === 'pdf' ? '.pdf' : (/\.hwpx$/i.test(이름) || 꼴 === 'zip계열' ? '.hwpx' : '.hwp');
  let zip속 = null;
  if (꼴 === 'zip계열') {
    try {
      const { detectZipFormat } = await import('kordoc');
      zip속 = await detectZipFormat(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) : buf);
      if (zip속 && zip속 !== 'unknown') 확장자 = '.' + zip속;
    } catch { /* 못 불러도 .hwpx 로 갑니다 — kordoc 이 자동 감지합니다 */ }
  }
  const 바닥 = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-'));
  const 넣을곳 = path.join(바닥, 'in' + 확장자);
  fs.writeFileSync(넣을곳, buf);

  let 초 = 0; let 결과 = null; let 왜 = ''; let OCR썼나 = false; let rssMB = null;
  try {
    const r = await 읽기(넣을곳, {});
    초 += r.초; rssMB = r.rssMB; 결과 = r.result;

    /* ★ 스캔 쪽이 있으면 **그때만** OCR 을 켜 한 번 더.
       ★ 2026-10-12 — 세중님이 주신 문서(usage.md 239줄)가 **`qualitySummary.needsOcr`
         를 먼저 보라**고 합니다 —
           if (r.success && r.qualitySummary?.needsOcr) await parse(buffer, { ocr: true })
         전에는 쪽별 `pageQuality[]` 만 봤습니다. 둘 다 봅니다 */
    const 필요쪽 = (결과?.pageQuality || []).filter((q) => q.needsOcr);
    const 묶음신호 = 결과?.qualitySummary?.needsOcr === true;
    const 그림뿐 = 결과?.code === 'IMAGE_BASED_PDF' || 결과?.isImageBased;
    if (옵션.OCR안함 !== true && (필요쪽.length || 묶음신호 || 그림뿐)) {
      const r2 = await 읽기(넣을곳, { ocr: 'auto' });
      초 += r2.초; rssMB = Math.max(rssMB ?? 0, r2.rssMB);
      if (r2.result?.success && (r2.result.markdown || '').length > (결과?.markdown || '').length) {
        결과 = r2.result; OCR썼나 = true;
      }
    }
  } catch (e) { 왜 = 'kordoc 탈 · ' + String(e.message).slice(0, 140); }

  const md = 결과?.success ? String(결과.markdown || '') : '';
  const blocks = 결과?.success ? (결과.blocks || []) : [];

  /* 맨손도 함께 (hwp 만) — 잰 결과 글자가 더 많은 파일이 있습니다 (8,873 vs 3,874).
     표는 blocks, **직군 판별용 글은 둘을 합쳐** 씁니다 */
  let 맨손글 = '';
  if (맨손 && 꼴 === 'hwp') {
    try { 맨손글 = String(맨손.hwp글자(buf, 이름).글 || ''); } catch { /* 넘어갑니다 */ }
  }

  try { fs.rmSync(바닥, { recursive: true, force: true }); } catch { /* 넘어갑니다 */ }

  if (!md && !맨손글) {
    return {
      md: '', blocks: [], 글: '', 초, 꼴, rssMB,
      /* ★ 실패 코드를 그대로 돌려줍니다 — 요약 메일이 사유별로 셉니다 */
      코드: 결과?.code || (왜 ? 'PARSE_ERROR' : 'EMPTY'),
      왜: 왜 || (결과?.error ? String(결과.error).slice(0, 160) : 'kordoc 이 0자를 냈습니다'),
    };
  }
  return {
    md, blocks, 글: (글만(md) + '\n' + 맨손글).trim(), 왜: '', 초, 꼴, rssMB,
    맨손글자: 맨손글.length, OCR썼나,
    쪽수: 결과?.pageCount ?? null,
    OCR필요쪽: (결과?.pageQuality || []).filter((q) => q.needsOcr).length,
    OCR묶음신호: 결과?.qualitySummary?.needsOcr ?? null,
  };
}

/* 앞 글자로 본 진짜 형식 — 확장자를 믿지 않습니다 (지침 5절) */
export function 진짜형식(바이트) {
  let i = 0;
  if (바이트[0] === 0xef && 바이트[1] === 0xbb && 바이트[2] === 0xbf) i = 3;
  while (i < 바이트.length && [0x20, 0x09, 0x0a, 0x0d].includes(바이트[i])) i++;
  const b = 바이트.subarray ? 바이트.subarray(i) : 바이트.slice(i);
  const 같나 = (...xs) => xs.every((x, j) => b[j] === x);
  if (같나(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';
  if (같나(0xd0, 0xcf, 0x11, 0xe0)) return 'hwp';
  if (같나(0x50, 0x4b, 0x03, 0x04)) return 'zip계열';
  if (같나(0xff, 0xd8, 0xff)) return 'jpg';
  if (같나(0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (같나(0x3c, 0x21) || 같나(0x3c, 0x68) || 같나(0x3c, 0x48)) return 'HTML';
  return '모름';
}

/* 마크다운에서 태그를 걷어 글자만 */
function 글만(md) {
  return String(md || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&darr;|&rarr;/g, ' ')
    .replace(/[|#*_>\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── 표 떼어내기 — <table> 하나를 줄·칸으로 ──────────────────
   kordoc 은 rowspan·colspan 을 살려 줍니다. 우리는 **그 줄에 우리 직군이
   적혀 있나**만 보면 되므로 칸을 펼치지 않고 그대로 읽습니다 */
/* ── IRTable 에서 줄·칸 떼어내기 (2026-10-11 세중님 1순위) ──────
 *
 * **마크다운을 정규식으로 긁지 않습니다.** kordoc 의 `blocks` 에
 * `IRTable { rows, cols, cells: IRCell[][], hasHeader }` 가 있고
 * `IRCell { text, colSpan, rowSpan, blocks?, isHeader? }` 입니다
 * (깔린 index.d.ts 에서 읽어 확인했습니다).
 *
 * 이렇게 하면 버그 ②가 **형식과 무관하게** 풀립니다 — 전에는 hwp 는
 * `<table>`, pdf 는 파이프 표로 나와서 한쪽만 읽고 있었습니다.
 * `blocks` 는 두 형식이 같은 꼴입니다.
 *
 * 셀 안에 중첩 표가 있으면(`IRCell.blocks`) 그 안까지 들어갑니다. */
export function 블록표들(blocks) {
  const 모두 = [];
  const 걷기 = (bs) => {
    for (const b of (bs || [])) {
      if (b && b.type === 'table' && b.table && Array.isArray(b.table.cells)) {
        모두.push({
          줄: b.table.cells.map((행) => (행 || []).map((c) => String(c?.text ?? '').replace(/\s+/g, ' ').trim())),
          머리있나: !!b.table.hasHeader,
          분류: b.table.classification?.kind ?? null,
          캡션: b.table.caption ?? null,
        });
        /* 셀 안 중첩 표 */
        for (const 행 of b.table.cells) for (const c of (행 || [])) if (c?.blocks) 걷기(c.blocks);
      }
      if (b?.children) 걷기(b.children);
    }
  };
  걷기(blocks);
  return 모두;
}

/* blocks 전체에서 **글만** — 문단·헤딩·표 칸을 원문 순서대로.
   전에는 표만 모아서 문단에 있는 접수기간을 놓쳤습니다 (자기 점검에서 잡았습니다) */
export function 블록글(blocks) {
  const 조각 = [];
  const 걷기 = (bs) => {
    for (const b of (bs || [])) {
      if (!b) continue;
      if (b.text) 조각.push(String(b.text));
      if (b.table && Array.isArray(b.table.cells)) {
        if (b.table.caption) 조각.push(String(b.table.caption));
        for (const 행 of b.table.cells) {
          조각.push((행 || []).map((c) => String(c?.text ?? '')).join(' | '));
          for (const c of (행 || [])) if (c?.blocks) 걷기(c.blocks);
        }
      }
      if (b.children) 걷기(b.children);
    }
  };
  걷기(blocks);
  return 조각.join(' ').replace(/\s+/g, ' ').trim();
}

export function 표들(md) {
  /* blocks 배열을 받으면 그쪽으로 — 형식과 무관한 길입니다 */
  if (Array.isArray(md)) return 블록표들(md).map((t) => t.줄);
  const s = String(md || '');
  const 모두 = [];

  /* ① <table> 꼴 — kordoc 이 **hwp** 를 이렇게 냅니다 */
  for (const t of s.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    모두.push([...t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
      [...r[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map((c) => 글만(c[1]))));
  }

  /* ② 파이프 표 — kordoc 이 **pdf** 를 이렇게 냅니다 (2026-10-11 에 확인).
     꼴이 다른 것을 모르고 <table> 만 읽어서, PDF 공고의
     「| 정규직 | 물리치료사 | 물리치료 | 1명 | 물리치료사 면허증 소지자 |」
     을 통째로 놓치고 있었습니다 */
  let 모임 = [];
  for (const 줄 of s.split(/\r?\n/)) {
    const t = 줄.trim();
    if (t.startsWith('|') && t.endsWith('|')) {
      const 칸 = t.slice(1, -1).split('|').map((c) => 글만(c));
      /* 구분선(| --- | --- |)은 줄로 안 셉니다 */
      if (칸.every((c) => /^-*$/.test(c))) continue;
      모임.push(칸);
    } else if (모임.length) { 모두.push(모임); 모임 = []; }
  }
  if (모임.length) 모두.push(모임);

  return 모두;
}

/* ⚠ `사` 를 **반드시** 요구합니다. 전에는 `물리\s*치료사?` 였는데 `?` 때문에
   「물리치료**학과**」·「물리치료실」이 걸렸습니다 — pt.hwp 의 성적 배점 표가
   우리 직군 줄로 잡혀 지원자격에 성적 기준이 들어왔습니다 (2026-10-11) */
/* ★ 2026-10-14 — **뒤에 한글이 오면 안 된다는 조건을 뺐습니다.**
   `사` 를 요구하는 것만으로 위의 「물리치료학과」·「물리치료실」은 이미 안 걸립니다
   (그 말에는 「치료사」가 없습니다). 그런데 `(?![가-힣])` 는 **우리말 조사까지
   막고 있었습니다** — 아래가 전부 「직군 없음」으로 나왔습니다.

     「물리치료사**를** 모집합니다」      「물리치료사**선생님**을 모십니다」
     「작업치료사**님** 구인합니다」      「물리/작업치료사**를** 모집합니다」

   표 칸(「물리치료사 | 1명」)만 보던 때는 칸이 깔끔히 끊겨 안 드러났습니다.
   2026-10-14 에 이 기준을 **본문 전체**에도 쓰기 시작하면서 드러났습니다 —
   「직군 의심」 그물을 돌려 보니 회원 화면 18건이 이 꼴로 걸렸습니다. */
const 우리직군 = { 물리치료사: /물리\s*치료사/, 작업치료사: /작업\s*치료사/ };

/* 본문(페이지 전체 글)에서 직군을 가립니다 — **「치료사」를 반드시 요구합니다** (2026-10-14).
 *
 * 목록 제목에는 `matchJob` 을 씁니다. 그런데 **본문에는 사이트 꾸밈이 섞여 들어옵니다** —
 * 왼쪽 메뉴의 「물리치료센터」·「물리치료실」 같은 **부서 이름**이 그렇습니다.
 * `matchJob` 은 맨 「물리치료」 로도 걸리니 그 메뉴 글자에 걸렸습니다 —
 *
 *   강진의료원 7건   본문 900~1,626자가 전부 왼쪽 메뉴입니다
 *                    「… 종합검진센터 **물리치료센터** 진료안내 …」
 *   한국병원 1건     기관 원문 제목이 「[모집]심뇌혈관센터 **방사선사**」인데
 *                    「… 직업환경의학센터 진료지원 **물리치료실**」에 걸려
 *                    물리치료사 공고로 회원 화면에 떠 있었습니다
 *
 * 같은 뿌리를 2026-10-11 에 `물리\s*치료사?` 의 `?` 로 한 번 밟았습니다 (바로 위 주석).
 * 그때 제목·첨부 쪽만 고치고 **본문 승격 자리를 안 고쳤습니다.**
 * 돌려주는 말은 `matchJob` 과 같은 꼴입니다 — '공통' · '물리치료사' · '작업치료사' · '' */
/* 「물리/작업치료사」·「물리(작업)치료사」·「작업,물리치료사」처럼 **묶어 적은 것**을
   둘로 풀어 씁니다. 안 풀면 앞말에 「치료사」가 안 붙어 한쪽만 걸립니다 —
   둘 다인 공고를 한쪽으로 단정하면 나머지 직군은 자기 공고를 못 봅니다
   (CLAUDE.md 의 `matchJob_` 주석과 같은 뜻). */
const 묶음꼴 = /(물리|작업)\s*[/(,·、]\s*\(?\s*(물리|작업)\s*\)?\s*치료사/g;

export function 본문직군(글) {
  const t = String(글 || '').replace(묶음꼴, '$1치료사 $2치료사');
  const ot = 우리직군.작업치료사.test(t);
  const pt = 우리직군.물리치료사.test(t);
  if (ot && pt) return '공통';
  if (ot) return '작업치료사';
  if (pt) return '물리치료사';
  return '';
}

/* 「N명」 — 0명·O명·00명 은 버립니다 (2026-10-10 에 28건) */
function 명뽑기(글) {
  const m = String(글 || '').match(/([0-9]{1,3})\s*명/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;                       /* 0명 */
  if (n > 50) return null;                   /* 통합공고 전체일 수 있어 비웁니다 */
  return n;
}

/* ── 칸 뽑기 ─────────────────────────────────────────────────
   돌려주는 것마다 **근거**를 함께 냅니다. 근거 없는 값은 쓰지 않습니다 */
export function 칸뽑기(md, 합친글 = '') {
  /* `md` 는 **마크다운 글** 또는 **blocks 배열** 입니다.
     blocks 를 주면 표를 IRTable 에서 집어 **형식과 무관**합니다 (버그 ②).
     글을 주면 옛 길(정규식)로 — 자기 점검과 md 만 든 부르는 쪽을 위해 남깁니다 */
  const 글 = (합친글 || (Array.isArray(md) ? 블록글(md) : 글만(md)));
  const 낸것 = { 접수마감: null, 접수시각: null, 모집인원: {}, 지원자격: null,
    근무지: null, 예상연봉: null, 근거: {} };

  /* ① 접수마감 — hs_dates 한 벌을 씁니다 (기준은 한 자리 · 지침 6절) */
  const d = hsDetailDates(글);
  if (d && d.to) {
    낸것.접수마감 = String(d.to).replace(/\./g, '-');
    낸것.근거.접수마감 = 'hs_dates · ' + (d.근거 || '').slice(0, 90);
  }
  /* 시각 — 「23:00까지」 「16:00 까지」. 마감 날짜 뒤 60자 안에서만 */
  if (낸것.접수마감) {
    const 날글 = String(d.to).replace(/^20\d\d\./, '').replace(/\./g, '[.\\s]*');
    const 창 = 글.match(new RegExp(날글 + '[^0-9]{0,20}(\\d{1,2})\\s*:\\s*(\\d{2})'));
    if (창) 낸것.접수시각 = String(창[1]).padStart(2, '0') + ':' + 창[2];
    else {
      const 또 = 글.match(/(\d{1,2})\s*:\s*(\d{2})\s*(까지|한)/);
      if (또) { 낸것.접수시각 = String(또[1]).padStart(2, '0') + ':' + 또[2]; }
    }
    if (낸것.접수시각) 낸것.근거.접수시각 = '마감 시각 말이 붙어 있습니다';
  }

  /* ② 모집인원 — **표에서 우리 직군 줄만** */
  for (const 표 of 표들(md)) {
    for (const 줄 of 표) {
      const 줄글 = 줄.join(' | ');
      for (const [이름, re] of Object.entries(우리직군)) {
        if (!re.test(줄글)) continue;
        /* 그 줄의 칸들 중 「N명」 이 있는 칸 */
        const n = 줄.map(명뽑기).find((x) => x != null) ?? 명뽑기(줄글);
        if (n != null && 낸것.모집인원[이름] == null) {
          낸것.모집인원[이름] = n;
          낸것.근거['모집인원.' + 이름] = '표 줄 — ' + 줄글.slice(0, 140);
        }
        /* 같은 줄에 자격이 적혀 있는 때가 많습니다 */
        if (!낸것.지원자격) {
          const 자격칸 = 줄.find((c) => /면허|자격|소지자|이수|전공|학위/.test(c) && c.length > 8);
          if (자격칸) {
            낸것.지원자격 = 자격칸.slice(0, 300);
            낸것.근거.지원자격 = '표 줄 (' + 이름 + ') — ' + 줄글.slice(0, 120);
          }
        }
      }
    }
  }

  /* ★ 이 공고문에 **우리 직군이 한 번이라도 적혀 있나.**
     없으면 지원자격·근무지·예상연봉을 **내지 않습니다.** 우리 직군 공고가
     아닌데 값을 내면 남의 직군 조건이 우리 공고 칸에 들어갑니다 —
     2026-10-11 에 세종시 임기제공무원 공고에서 「지방공무원법 제31조 결격사유…」
     가, 충주의료원 원장 공고에서 「4급 상당 계약직 보수규정」 이 나왔습니다.
     「줄이 없으면 비웁니다」 (세중님 규칙 · 지침 15절) */
  const 우리것인가 = Object.values(우리직군).some((re) => re.test(글));
  if (!우리것인가) {
    낸것.근거.왜비었나 = '공고문에 물리치료사·작업치료사가 안 적혀 있습니다 — 접수마감만 냅니다';
    return 낸것;
  }

  /* ③ 지원자격 — 표에서 못 찾았으면 표식 뒤에서 */
  if (!낸것.지원자격) {
    const a = 글.match(/(응시\s*자격|지원\s*자격|자격\s*요건|응시요건|자격조건)/);
    if (a && a.index != null) {
      const 뒤 = 글.slice(a.index + a[0].length, a.index + a[0].length + 400).trim();
      const 끊 = 뒤.search(/전형\s*방법|접수\s*(기간|방법)|제출\s*서류|근무\s*조건/);
      const 값 = (끊 > 30 ? 뒤.slice(0, 끊) : 뒤).trim();
      if (값.length >= 12) {
        낸것.지원자격 = 값.slice(0, 300);
        낸것.근거.지원자격 = a[1] + ' 표식 뒤';
      }
    }
  }

  /* ④ 근무지 — 표 머리글은 **아닙니다.**
     전에는 「근무 기간 직무내용 --- --- --- 청소년지도사 …」 처럼 표 머리글을
     통째로 먹었습니다 (a.pdf · 2026-10-11). 뒤에 `---` 나 다른 머리글 낱말이
     붙으면 표를 읽고 있는 것이니 버립니다 */
  const w = 글.match(/(근무\s*(지|장소|부서|처)|배치\s*부서)\s*[:：]?\s*([^|]{2,60})/);
  if (w && w[3]) {
    let 값 = w[3].split(/\s{2,}|◯|▣|■|·\s·/)[0].trim();
    const 끊 = 값.search(/-{3}|직무내용|임용직급|선발|모집부문|응시자격|구\s*분/);
    if (끊 >= 0) 값 = 값.slice(0, 끊).trim();
    /* 표 머리글 낱말이 섞였거나, 날·기간 말이면 근무지가 아닙니다 */
    if (값.length >= 2 && 값.length <= 60
        && !/기간|개월|[0-9]{4}\s*\.|^-/.test(값)) {
      낸것.근무지 = 값.slice(0, 80); 낸것.근거.근무지 = w[1] + ' 표식 뒤';
    }
  }

  /* ⑤ 예상연봉 — **말 그대로만.** 숫자를 만들지 않습니다 */
  /* ⚠ **낱말 경계를 요구합니다.** 앞에 한글이 붙어 있으면 다른 낱말의 일부입니다 —
     「개인정보**수집**」 안의 「보수집」 에서 「보수」가 걸려
     「보수 집 이용 및 제3자 제공에 관한 동의서 각 1부」 가 나왔습니다
     (2026-10-11 되메우기 마른 실행에서 잡았습니다).
     그리고 값에 **숫자나 금액 말**이 없으면 급여 이야기가 아닙니다 */
  const p = 글.match(/(?:^|[^가-힣])(보수|급여|연봉|임금|처우)\s*[:：]?\s*([^|]{4,120})/);
  if (p && p[2] && !/^(정보|안내|진료비|항목|집)/.test(p[2].trim())
      && /[0-9]|내규|협의|규정|따름|상당|호봉|월\s*급|연\s*봉|만\s*원/.test(p[2])) {
    /* **다음 꼭지를 만나면 끊습니다.** 안 끊으면 뒷 칸을 먹습니다 —
       자기 점검에서 「보수 회사 내규에 따름 근무지 : 재활치료실」 이 나왔습니다 */
    let 값 = p[2].split(/◯|▣|■|\s{3,}/)[0];
    /* 번호 붙은 다음 꼭지(「9. 기 타」)에서도 끊습니다 — 충주의료원 공고에서
       「… 별도 지급 9. 기 타 가. 복무는…」 까지 먹었습니다 (2026-10-11) */
    const 끊 = 값.search(/근무\s*(지|장소|부서|처)|접수\s*(기간|방법)|전형\s*방법|제출\s*서류|응시\s*자격|지원\s*자격|문의|\s\d{1,2}\s*\.\s*[가-힣]|\s[가-힣]\s*\.\s/);
    if (끊 > 3) 값 = 값.slice(0, 끊);
    값 = 값.replace(/[\s:：]+$/, '').trim();
    if (값.length >= 4) { 낸것.예상연봉 = (p[1] + ' ' + 값).slice(0, 160); 낸것.근거.예상연봉 = p[1] + ' 표식'; }
  }

  return 낸것;
}

/* ── 자기 점검 ───────────────────────────────────────────────
   node tools/공고문읽기.mjs <파일>...
   파일을 안 주면 들어 있는 견본으로 **assert** 를 돌립니다 */
if (import.meta.url === 'file://' + process.argv[1] || process.argv[1]?.endsWith('공고문읽기.mjs')) {
  const 파일들 = process.argv.slice(2).filter((x) => fs.existsSync(x));
  if (!파일들.length) {
    /* 견본 — kordoc 없이도 도는 표 분해·칸 뽑기 점검 */
    const 견본 = [
      '# 채용 공고',
      '<table>',
      '<tr><th colspan="2">구 분</th><th>채용예정<br>인 원</th><th>자격요건등</th></tr>',
      '<tr><td>조리원</td><td>정규직 8급</td><td>1명</td><td>병원 구내식당 근무</td></tr>',
      '<tr><td>작업치료사</td><td>단기고용직</td><td>1명</td><td>작업치료사 면허증 소지자 (소아 재활 유경험자 우대)</td></tr>',
      '<tr><td>물리치료사</td><td>단기고용직</td><td>2명</td><td>물리치료사 면허증 소지자</td></tr>',
      '<tr><td>영양사</td><td>정규직</td><td>85명</td><td>영양사 면허</td></tr>',
      '</table>',
      '접수기간 : 2026. 9. 30. ~ 2026. 10. 18. 23:00까지',
      '보수 : 회사 내규에 따름',
      '근무지 : 재활치료실',
    ].join('\n');
    const r = 칸뽑기(견본);
    const 어겼나 = [];
    const 봐 = (말, 참) => { if (!참) 어겼나.push(말); };
    봐('표 하나', 표들(견본).length === 1);
    봐('작업치료사 1명', r.모집인원.작업치료사 === 1);
    봐('물리치료사 2명', r.모집인원.물리치료사 === 2);
    봐('영양사 85명은 안 가져온다', !Object.values(r.모집인원).includes(85));
    봐('접수마감 2026-10-18', r.접수마감 === '2026-10-18');
    봐('접수시각 23:00', r.접수시각 === '23:00');
    봐('지원자격에 면허', /면허/.test(r.지원자격 || ''));
    봐('예상연봉은 말 그대로', /내규/.test(r.예상연봉 || ''));
    봐('예상연봉이 뒷 칸을 안 먹는다', !/재활치료실/.test(r.예상연봉 || ''));

    /* ★ 파이프 표도 읽나 — kordoc 이 pdf 를 이 꼴로 냅니다 */
    const 파이프 = [
      '| 구 분 | 모집부문 | 업 무 | 인원 | 응시자격 |',
      '| --- | --- | --- | --- | --- |',
      '| 정규직 | 물리치료사 | 물리치료 | 1명 | 물리치료사 면허증 소지자 |',
      '| 정규직 | 간호사 | 병동 | 12명 | 간호사 면허증 소지자 |',
      '접수기간 : 2026. 10. 26.(월) ~ 10. 28.(수) 18:00까지',
    ].join('\n');
    const r2 = 칸뽑기(파이프);
    봐('파이프 표 하나', 표들(파이프).length === 1);
    봐('파이프 표에서 물리치료사 1명', r2.모집인원.물리치료사 === 1);
    봐('간호사 12명은 안 가져온다', !Object.values(r2.모집인원).includes(12));
    봐('파이프 표 접수마감', r2.접수마감 === '2026-10-28');

    /* ★ 「물리치료학과」 는 우리 직군 줄이 아닙니다 (사 를 요구합니다) */
    const 학과 = [
      '<table>',
      '<tr><td>성적</td><td>50</td><td>물리치료학과의 최소학력 성적만 인정. 3명 이내</td></tr>',
      '</table>',
    ].join('\n');
    const r3 = 칸뽑기(학과);
    봐('「물리치료학과」는 우리 직군 줄이 아니다', !Object.keys(r3.모집인원).length);
    봐('그래서 지원자격도 안 가져온다', !/최소학력/.test(r3.지원자격 || ''));

    /* ★ 표 머리글을 근무지로 읽지 않습니다 */
    const 머리 = '| 임용분야 | 임용직급 | 선발 인원 | 근무 기간 | 직무내용 |\n| --- | --- | --- | --- | --- |\n물리치료사 안내';
    봐('표 머리글은 근무지가 아니다', 칸뽑기(머리).근무지 == null);

    /* ★ 우리 직군이 안 적힌 공고문에서는 **지원자격·예상연봉을 안 냅니다** */
    const 남의것 = [
      '세종특별자치시 임기제공무원 임용시험 공고',
      '가. 공통요건 1) 지방공무원법 제31조의 결격사유가 없는 자',
      '응시자격 기준 ※ 기준일: 최종시험 예정일',
      '보수 : 지방공무원 보수규정에 따름',
      '근무지 : 아동청소년과',
      '접수기간 : 2026. 10. 26.(월) ~ 10. 28.(수)',
    ].join('\n');
    const r4 = 칸뽑기(남의것);
    봐('남의 직군 공고문은 지원자격을 안 낸다', r4.지원자격 == null);
    봐('남의 직군 공고문은 예상연봉을 안 낸다', r4.예상연봉 == null);
    봐('남의 직군 공고문은 근무지를 안 낸다', r4.근무지 == null);
    봐('그래도 접수마감은 낸다', r4.접수마감 === '2026-10-28');
    봐('왜 비었는지 적는다', /안 적혀 있습니다/.test(r4.근거.왜비었나 || ''));

    /* ★ 「개인정보수집」 안의 「보수집」 을 급여로 읽지 않습니다 */
    const 가짜보수 = [
      '물리치료사 채용',
      '제출서류 : 응시원서, 개인정보수집 이용 및 제3자 제공에 관한 동의서 각 1부.',
    ].join('\n');
    봐('「개인정보수집」을 보수로 안 읽는다', 칸뽑기(가짜보수).예상연봉 == null);

    /* ★ 숫자도 금액 말도 없으면 급여가 아닙니다 */
    봐('급여 말만 있고 값이 없으면 안 낸다',
      칸뽑기('작업치료사 모집\n급여 : 별도 안내 예정').예상연봉 == null);

    /* ★ 제대로 된 것은 그대로 냅니다 */
    봐('내규는 낸다', /내규/.test(칸뽑기('물리치료사 모집\n보수 : 병원 내규에 따름').예상연봉 || ''));
    봐('숫자 있는 것도 낸다', /2,800/.test(칸뽑기('작업치료사 모집\n연봉 : 2,800만원').예상연봉 || ''));

    /* ★ 2026-10-11 — **blocks(IRTable) 로도 같은 값이 나오나.**
       같은 표를 hwp 꼴(<table>) · pdf 꼴(파이프) · blocks 셋으로 주고
       **셋이 같은 답**인지 봅니다. 버그 ②가 형식과 무관하게 풀렸다는 증거입니다 */
    const 블록 = [
      { type: 'heading', text: '채용 공고' },
      { type: 'table',
        table: { rows: 4, cols: 4, hasHeader: true,
          cells: [
            [{ text: '구 분', colSpan: 2, rowSpan: 1, isHeader: true },
             { text: '채용예정 인 원', colSpan: 1, rowSpan: 1, isHeader: true },
             { text: '자격요건등', colSpan: 1, rowSpan: 1, isHeader: true }],
            [{ text: '조리원', colSpan: 1, rowSpan: 1 }, { text: '정규직 8급', colSpan: 1, rowSpan: 1 },
             { text: '1명', colSpan: 1, rowSpan: 1 }, { text: '병원 구내식당 근무', colSpan: 1, rowSpan: 1 }],
            [{ text: '작업치료사', colSpan: 1, rowSpan: 1 }, { text: '단기고용직', colSpan: 1, rowSpan: 1 },
             { text: '1명', colSpan: 1, rowSpan: 1 },
             { text: '작업치료사 면허증 소지자 (소아 재활 유경험자 우대)', colSpan: 1, rowSpan: 1 }],
            [{ text: '물리치료사', colSpan: 1, rowSpan: 1 }, { text: '단기고용직', colSpan: 1, rowSpan: 1 },
             { text: '2명', colSpan: 1, rowSpan: 1 }, { text: '물리치료사 면허증 소지자', colSpan: 1, rowSpan: 1 }],
            [{ text: '영양사', colSpan: 1, rowSpan: 1 }, { text: '정규직', colSpan: 1, rowSpan: 1 },
             { text: '85명', colSpan: 1, rowSpan: 1 }, { text: '영양사 면허', colSpan: 1, rowSpan: 1 }],
          ] } },
      { type: 'paragraph', text: '접수기간 : 2026. 9. 30. ~ 2026. 10. 18. 23:00까지' },
      { type: 'paragraph', text: '보수 : 회사 내규에 따름' },
      { type: 'paragraph', text: '근무지 : 재활치료실' },
    ];
    const rB = 칸뽑기(블록);
    봐('blocks 로 표 하나', 표들(블록).length === 1);
    봐('blocks — 작업치료사 1명', rB.모집인원.작업치료사 === 1);
    봐('blocks — 물리치료사 2명', rB.모집인원.물리치료사 === 2);
    봐('blocks — 영양사 85명은 안 가져온다', !Object.values(rB.모집인원).includes(85));
    봐('blocks — 접수마감', rB.접수마감 === '2026-10-18');
    봐('blocks — 접수시각', rB.접수시각 === '23:00');
    봐('blocks — 지원자격에 면허', /면허/.test(rB.지원자격 || ''));
    /* 셋이 같은 답인가 — <table> · 파이프 · blocks */
    봐('세 형식이 같은 모집인원',
      JSON.stringify(rB.모집인원) === JSON.stringify(r.모집인원));

    /* ★ 중첩 표(IRCell.blocks)도 들어가나 */
    const 중첩 = [{ type: 'table', table: { rows: 1, cols: 1, hasHeader: false,
      cells: [[{ text: '', colSpan: 1, rowSpan: 1, blocks: [
        { type: 'table', table: { rows: 2, cols: 2, hasHeader: true,
          cells: [[{ text: '직종' }, { text: '인원' }],
            [{ text: '물리치료사' }, { text: '3명' }]] } }] }]] } }];
    봐('셀 안 중첩 표도 읽는다', 칸뽑기(중첩).모집인원.물리치료사 === 3);
    봐('근무지', /재활치료실/.test(r.근무지 || ''));

    /* ★ 본문직군 — **사이트 왼쪽 메뉴에 안 걸리나** (2026-10-14).
       아래 글은 강진의료원 HS1611728177 의 job_body 에서 그대로 떼어 온 것입니다 */
    const 메뉴 = '인트라넷 강진의료원 주메뉴 의료원소개 병원소개 원장님인사말 연혁 미션과 비전 '
      + '기구 및 조직도 병원윤리강령 경영전략 및 과제 의료환경 찾아오시는길 이용안내 원내전화번호 '
      + '원내배치도 첨단장비소개 진료전문센터 종합검진센터 물리치료센터 진료안내 진료과/의료진 소개';
    봐('메뉴의 「물리치료센터」에 안 걸린다', 본문직군(메뉴) === '');
    봐('「물리치료실」에 안 걸린다', 본문직군('직업환경의학센터 진료지원 물리치료실 임상병리실') === '');
    봐('「물리치료학과」에 안 걸린다', 본문직군('물리치료학과 졸업예정자') === '');
    봐('「물리치료사」는 걸린다', 본문직군('가. 모집직종 : 계약직 물리치료사 1명') === '물리치료사');
    봐('「작업 치료사」 띈 것도 걸린다', 본문직군('작업 치료사 면허 소지자') === '작업치료사');
    봐('둘 다 있으면 공통', 본문직군('물리치료사 2명, 작업치료사 1명') === '공통');
    봐('빈 글은 빈 말', 본문직군('') === '' && 본문직군(null) === '');
    /* ★ 우리말 조사·높임말이 붙어도 걸려야 합니다 (2026-10-14 · 위 주석) */
    봐('「물리치료사를」', 본문직군('물리치료사를 모집합니다') === '물리치료사');
    봐('「물리치료사선생님」', 본문직군('물리치료사선생님을 모십니다') === '물리치료사');
    봐('「작업치료사님」', 본문직군('함께 일하실 작업치료사님 구인합니다') === '작업치료사');
    /* 묶어 적은 것은 둘 다로 읽습니다 — 실제 공고 제목에서 떼어 온 네 꼴입니다 */
    봐('「물리/작업치료사를」', 본문직군('물리/작업치료사를 모집합니다') === '공통');
    봐('「물리(작업)치료사」', 본문직군('양주실버케어센터 물리(작업)치료사 구인') === '공통');
    봐('「작업,물리치료사선생님」', 본문직군('요양보호사님&작업,물리치료사선생님 을 구합니다') === '공통');
    봐('「물리·작업치료사」', 본문직군('물리·작업치료사 2명') === '공통');

    if (어겼나.length) {
      console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · '));
      console.error(JSON.stringify(r, null, 1));
      process.exit(1);
    }
    console.log('○ 자기 점검 통과 — 표에서 우리 직군 줄만 집고, 85명은 안 가져옵니다');
    console.log(JSON.stringify(r, null, 1));
  } else {
    for (const f of 파일들) {
      const r = await 첨부읽기(fs.readFileSync(f), path.basename(f));
      console.log('\n══ ' + path.basename(f) + '  (' + r.꼴 + ' · ' + r.초 + '초'
        + (r.왜 ? ' · ✗ ' + r.왜 : '') + ')');
      if (!r.md && !r.글) continue;
      const 칸 = 칸뽑기(r.md, r.글);
      for (const [k, v] of Object.entries(칸)) {
        if (k === '근거') continue;
        if (v == null || (typeof v === 'object' && !Object.keys(v).length)) continue;
        console.log('   ' + k.padEnd(8) + ' ' + JSON.stringify(v));
      }
      for (const [k, v] of Object.entries(칸.근거)) console.log('     근거 ' + k + ' — ' + v);
    }
  }
}
