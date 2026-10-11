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
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const KORDOC = path.join(여기, 'kordoc', 'node_modules', 'kordoc', 'dist', 'cli.js');
const require_ = createRequire(import.meta.url);
const { hsDetailDates } = require_('./hosp/hs_dates.js');

export function kordoc있나() { return fs.existsSync(KORDOC); }

/* 맨손 hwp — 있으면 씁니다 (없어도 kordoc 만으로 돕니다) */
let 맨손 = null;
try { 맨손 = await import('./hwp/index.mjs'); } catch { /* 넘어갑니다 */ }

/* ── 첨부 한 건 읽기 ────────────────────────────────────────── */
export async function 첨부읽기(buf, 이름 = '공고문.hwp', 옵션 = {}) {
  const 제한초 = 옵션.제한초 ?? 120;
  if (!kordoc있나()) return { md: '', 글: '', 왜: 'kordoc 이 안 깔렸습니다 (tools/kordoc 에서 npm ci)', 초: 0 };

  /* 받은 것이 정말 그 형식인지 **먼저** 봅니다 (지침 5절) */
  const 꼴 = 진짜형식(buf);
  if (!['pdf', 'hwp', 'zip계열'].includes(꼴)) {
    return { md: '', 글: '', 왜: '읽을 수 있는 형식이 아닙니다 (' + 꼴 + ' · ' + buf.length + '바이트)', 초: 0 };
  }

  /* 저장 이름은 **ASCII 만** — 한글 경로는 탈이 납니다 (지침 6-2b) */
  const 확장자 = 꼴 === 'pdf' ? '.pdf' : (/\.hwpx$/i.test(이름) || 꼴 === 'zip계열' ? '.hwpx' : '.hwp');
  const 바닥 = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-'));
  const 넣을곳 = path.join(바닥, 'in' + 확장자);
  const 낼곳 = path.join(바닥, 'out.md');
  fs.writeFileSync(넣을곳, buf);

  const t0 = Date.now();
  const 탈 = await new Promise((맺) => {
    execFile(process.execPath, [KORDOC, 넣을곳, '-o', 낼곳],
      { maxBuffer: 64e6, timeout: 제한초 * 1000, cwd: path.join(여기, 'kordoc') },
      (e) => 맺(e ? String(e.message).slice(0, 140) : null));
  });
  const 초 = (Date.now() - t0) / 1000;

  let md = '';
  try { md = fs.readFileSync(낼곳, 'utf8'); } catch { /* 안 나왔습니다 */ }

  /* 맨손도 함께 (hwp 만) — 글자가 더 많은 파일이 있습니다 */
  let 맨손글 = '';
  if (맨손 && 꼴 === 'hwp') {
    try { 맨손글 = String(맨손.hwp글자(buf, 이름).글 || ''); } catch { /* 넘어갑니다 */ }
  }

  try { fs.rmSync(바닥, { recursive: true, force: true }); } catch { /* 넘어갑니다 */ }

  if (!md && !맨손글) {
    return { md: '', 글: '', 왜: 탈 ? 'kordoc 탈 · ' + 탈 : 'kordoc 이 0자를 냈습니다', 초, 꼴 };
  }
  return { md, 글: (글만(md) + '\n' + 맨손글).trim(), 왜: '', 초, 꼴, 맨손글자: 맨손글.length };
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
export function 표들(md) {
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
const 우리직군 = { 물리치료사: /물리\s*치료사(?![가-힣])/, 작업치료사: /작업\s*치료사(?![가-힣])/ };

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
  const 글 = (합친글 || 글만(md));
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
  const p = 글.match(/(보수|급여|연봉|임금|처우)\s*[:：]?\s*([^|]{4,120})/);
  if (p && p[2] && !/^(정보|안내|진료비|항목)/.test(p[2].trim())) {
    /* **다음 꼭지를 만나면 끊습니다.** 안 끊으면 뒷 칸을 먹습니다 —
       자기 점검에서 「보수 회사 내규에 따름 근무지 : 재활치료실」 이 나왔습니다 */
    let 값 = p[2].split(/◯|▣|■|\s{3,}/)[0];
    const 끊 = 값.search(/근무\s*(지|장소|부서|처)|접수\s*(기간|방법)|전형\s*방법|제출\s*서류|응시\s*자격|지원\s*자격|문의/);
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
    const 머리 = '| 임용분야 | 임용직급 | 선발 인원 | 근무 기간 | 직무내용 |\n| --- | --- | --- | --- | --- |';
    봐('표 머리글은 근무지가 아니다', 칸뽑기(머리).근무지 == null);
    봐('근무지', /재활치료실/.test(r.근무지 || ''));
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
