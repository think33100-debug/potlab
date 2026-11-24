/* 클린아이 공고 첨부 내려받기 (2026-09-26).
 *
 * API 의 `URL` 은 첨부 직링크가 아니라 **공고 화면 주소**입니다. 두 걸음입니다.
 *   ① 공고 화면 HTML 에서  fn_FileDown('<UPLOAD>','<ORIGINAL>','<PATH>')
 *   ② POST /file/FileDownload.do  그 셋 + Referer
 * 세 인자를 다 넘겨야 옵니다. 하나라도 빠지면 0바이트입니다.
 * 세션 쿠키는 필요 없습니다 (알리오와 다릅니다).
 *
 * ⚠ **속도 제한이 있습니다.** 0.25초 간격으로 받으면 15건쯤에서
 *   HTTP 429 · `다운로드 요청이 많습니다. 잠시 후 다시 시도해 주세요.` 가 옵니다.
 *   429 는 파일이 아니라 text/plain 으로 오기 때문에, 그냥 넘기면
 *   「한글 파일이 아닙니다」 로 잘못 세게 됩니다 (2026-09-26 에 그랬습니다).
 *   그래서 여기서 **429 를 알아보고 기다렸다 다시** 받습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128';
const 받는곳 = 'https://job.cleaneye.go.kr/file/FileDownload.do';
export const 쉼 = (ms) => new Promise((x) => setTimeout(x, ms));

/* ★ 하루 한 번만 엽니다 (2026-11-25 세중님 「하루 1번만 계속」)
 *
 * job.cleaneye.go.kr 은 robots.txt 가 전부 막습니다(`Disallow: /`). 목록은 공공데이터포털
 * API 라 그대로 자주 받지만, **공고 화면·첨부는 하루 한 번(17:50~19:00)만** 엽니다.
 * 그 앞까지는 전체 바퀴 여섯 번이 같은 첨부 30건을 날마다 여섯 번씩 다시 받았습니다.
 *   · 창 밖이면 `첨부받기` 가 요청 없이 { 창밖: true } 를 돌려줍니다.
 *   · 창 안이라도 **같은 공고는 하루 한 번**입니다 (기록 `POTJOB_CLEANEYE_STATE || ~/클린아이연것.json`).
 *     429 로 파일을 못 받은 것만 그 창 안에서 다시 받을 수 있습니다.
 * 여는 쪽은 둘입니다 — 17:50 전체 바퀴(collect-cleaneye.mjs) · 18:40 첨부되메우기.mjs. */
export const 여는창 = { 시작: 17 * 60 + 50, 끝: 19 * 60 };   /* 한국시간 0시부터 분 · 끝은 열린 구간 */
const 한국 = (지금ms) => new Date(지금ms + 9 * 3600e3);
export function 열때인가(지금ms = Date.now()) {
  const d = 한국(지금ms);
  const 분 = d.getUTCHours() * 60 + d.getUTCMinutes();
  return 분 >= 여는창.시작 && 분 < 여는창.끝;
}
export const 클린아이주소인가 = (u) => /^https?:\/\/job\.cleaneye\.go\.kr(?:[/:?]|$)/i.test(String(u || ''));
const 공고키 = (u) => (String(u || '').match(/[?&]idx=(\d+)/) || [])[1] || String(u || '');
const 기록파일 = () => process.env.POTJOB_CLEANEYE_STATE || path.join(os.homedir(), '클린아이연것.json');
function 오늘기록(지금ms) {
  const 날짜 = 한국(지금ms).toISOString().slice(0, 10);
  try {
    const j = JSON.parse(fs.readFileSync(기록파일(), 'utf8'));
    if (j && j.날짜 === 날짜 && Array.isArray(j.연것)) return j;
  } catch { /* 없거나 깨졌으면 빈 것으로 */ }
  return { 날짜, 연것: [] };
}
export const 오늘열었나 = (공고주소, 지금ms = Date.now()) => 오늘기록(지금ms).연것.includes(공고키(공고주소));
export function 열었다고적기(공고주소, 지금ms = Date.now()) {
  const j = 오늘기록(지금ms);
  const k = 공고키(공고주소);
  if (!j.연것.includes(k)) j.연것.push(k);
  try { fs.writeFileSync(기록파일(), JSON.stringify(j)); }
  catch (e) { console.error('클린아이 연 기록을 못 적음 · ' + String(e && e.message || e).slice(0, 80)); }
}
/** 지금 이 공고 화면을 열어도 되나 — 안 되면 까닭, 되면 '' */
export function 못여는까닭(공고주소, 지금ms = Date.now()) {
  if (!열때인가(지금ms)) return '클린아이는 하루 한 번(17:50~19:00)만 엽니다';
  if (오늘열었나(공고주소, 지금ms)) return '클린아이 — 오늘 이미 연 공고입니다';
  return '';
}

/* 첨부 사이 기본 간격 (2026-09-29 에 1.2초 → 10초로 늘렸습니다).
 *
 * ── 왜 늘렸나 ─────────────────────────────────────────────
 * 1.2초로 받으면 **15건 만에 통이 차서 429** 가 납니다. 그 뒤 2.5분을 쉬는데,
 * 429 로 튕긴 요청도 통을 먹어서 회복이 더 느려집니다.
 * 2026-09-29 기준 **429로 첨부를 못 읽은 공고가 16건** 쌓였습니다.
 *
 * 통이 「15건 · 2분」 이니 한 건에 **통쉼 ÷ 통크기 = 10초**로 맞추면
 * 통이 차는 속도와 비우는 속도가 같아져 **429 가 아예 안 납니다.**
 * 18분 몫이면 100건쯤 받습니다 — 의료 공고가 하루 95건이라 넉넉합니다.
 *
 * 느리다고 줄이지 마세요. 줄이면 429 가 나고, 그게 더 느립니다. */
export const 기본간격 = 10000;

/* ⚠ 통(bucket) — 2026-09-26 에 `tools/hwp/bucket.mjs` 로 **재본 값**입니다.
 *
 *   0.25초 간격 → 15건에서 429
 *   1.2초  간격 → 15건에서 429      ← 같은 자리. 간격 문제가 아닙니다
 *   2분 쉰 뒤   → 다시 15건
 *   5분 쉰 뒤   → 다시 15건         ← 2분이면 이미 다 찹니다
 *
 * 「하루 N건」도 「시간당 N건」도 아닙니다. **통 15건 · 2분이면 가득**입니다.
 * 이대로 쉬어 가며 받으면 시간당 450건쯤 됩니다 — 의료 공고가 하루 95건이라
 * 넉넉합니다.
 *
 * **그리고 429 로 튕긴 요청도 통을 먹습니다.** 곧바로 다시 두드리면 통이
 * 영영 안 찹니다. 그래서 `첨부받기` 의 기본 재시도를 **끕니다**(다시: 0) —
 * 부르는 쪽이 통쉼만큼 쉬었다 한 번만 다시 받습니다. */
export const 통크기 = 15;
export const 통쉼 = 150000;   // 2분 + 30초 여유

const 넘침인가 = (code, buf) => code === 429
  || (buf.length < 400 && /다운로드 요청이 많습니다|잠시 후 다시/.test(buf.toString('utf8')));

/** 공고 화면 → 첨부 { buf, 이름, 왜 }. 던지지 않습니다.
 *  @param 공고주소  API 의 URL 칸
 *  @param opt.다시  429 일 때 몇 번까지 기다렸다 다시 받을지 (기본 4)
 *  @param opt.기다림 첫 기다림(ms). 실패할 때마다 두 배 (기본 3000) */
export async function 첨부받기(공고주소, opt) {
  /* 429 가 나면 **한 번만** 다시 받습니다 (2026-09-29 · 세중님 지시).
     ⚠ 곧바로 다시 두드리면 그 요청도 통을 먹어 영영 안 찹니다.
       그래서 기다림을 **통쉼(2분 반)** 으로 둡니다 — 통이 완전히 빈 뒤에 갑니다.
       3초 뒤 재시도 같은 것은 안 됩니다. 재본 값이 그렇습니다. */
  const 막는말 = 못여는까닭(공고주소);
  if (막는말) return { 왜: 막는말, 창밖: true };
  const 다시 = (opt && opt.다시) ?? 1;
  let 기다림 = (opt && opt.기다림) ?? 통쉼;
  let html;
  try {
    html = await (await fetch(공고주소, { headers: { 'User-Agent': UA } })).text();
  } catch (e) { 열었다고적기(공고주소); return { 왜: '공고 화면을 못 열었습니다 · ' + String(e && e.message || e) }; }

  const m = html.match(/fn_FileDown\('([^']+)','([^']*)','([^']*)'/);
  if (!m) { 열었다고적기(공고주소); return { 왜: '공고 화면에 fn_FileDown 이 없습니다 (첨부가 없는 공고)' }; }

  const body = new URLSearchParams();
  body.set('UPLOAD_FILENAME', m[1]); body.set('ORIGINAL_FILENAME', m[2]); body.set('FILE_PATH', m[3]);
  const 이름 = m[2] || m[1];

  for (let t = 0; t <= 다시; t++) {
    let code = 0, buf, ctype = '';
    try {
      const r = await fetch(받는곳, { method: 'POST', body,
        headers: { 'User-Agent': UA, Referer: 공고주소, 'Content-Type': 'application/x-www-form-urlencoded' } });
      code = r.status;
      ctype = r.headers.get('content-type') || '';   /* 0자 덫이 씁니다 */
      buf = Buffer.from(await r.arrayBuffer());
    } catch (e) { 열었다고적기(공고주소); return { 이름, 왜: '첨부를 못 받았습니다 · ' + String(e && e.message || e) }; }

    if (넘침인가(code, buf)) {
      if (t === 다시) return { 이름, code, 넘침: true,
        왜: '클린아이가 다운로드를 막고 있습니다 (HTTP ' + code + ' · ' + (다시 + 1) + '번 시도) — 간격을 늘려야 합니다' };
      await 쉼(기다림); 기다림 *= 2;
      continue;
    }
    열었다고적기(공고주소);   /* 429 가 아니면 오늘 몫은 끝입니다 */
    if (!buf.length) return { 이름, code, 왜: '첨부가 0바이트로 왔습니다 (HTTP ' + code + ')' };
    return { buf, 이름, code, ctype, 다시받음: t };
  }
}

/* ── 목록 API 답 읽기 (collect-cleaneye.mjs 가 씁니다 · 2026-11-25) ── */
/** 그 시도에 공고가 없다는 정상 답인가 — resultCode 3 · NONOTEXISTDATA_ERROR 둘 다 맞을 때만 */
export const 자료없음인가 = (xml) => /<resultCode>\s*0*3\s*<\/resultCode>/.test(String(xml || ''))
  && /<resultMsg>\s*NONOTEXISTDATA/i.test(String(xml || ''));
/** 목록을 통째로 못 받았으면 까닭, 아니면 '' */
export function 목록못받음까닭({ 시도수, 못받은시도, 받은수 }) {
  if (못받은시도 >= 시도수) return '시도 ' + 시도수 + '곳을 하나도 못 받음';
  if (!받은수) return '시도 ' + 시도수 + '곳이 모두 0건 (API 탈)';
  return '';
}
