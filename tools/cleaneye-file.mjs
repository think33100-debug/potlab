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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128';
const 받는곳 = 'https://job.cleaneye.go.kr/file/FileDownload.do';
export const 쉼 = (ms) => new Promise((x) => setTimeout(x, ms));

/* 첨부 사이 기본 간격 */
export const 기본간격 = 1200;
/* ⚠ 간격을 늘려도 소용없습니다 — **건수로 막습니다.**
   0.25초로 받아도 1.2초로 받아도 정확히 **15건**에서 429 가 났습니다 (2026-09-26 두 번 다).
   시간당·분당이 아니라 통(bucket)입니다. 그래서 15건마다 통이 다시 찰 때까지 쉽니다. */
export const 묶음 = 15;
export const 묶음쉼 = 180000;   // 3분. 그 사이 15건이 다시 찼습니다

const 넘침인가 = (code, buf) => code === 429
  || (buf.length < 400 && /다운로드 요청이 많습니다|잠시 후 다시/.test(buf.toString('utf8')));

/** 공고 화면 → 첨부 { buf, 이름, 왜 }. 던지지 않습니다.
 *  @param 공고주소  API 의 URL 칸
 *  @param opt.다시  429 일 때 몇 번까지 기다렸다 다시 받을지 (기본 4)
 *  @param opt.기다림 첫 기다림(ms). 실패할 때마다 두 배 (기본 3000) */
export async function 첨부받기(공고주소, opt) {
  const 다시 = (opt && opt.다시) ?? 4;
  let 기다림 = (opt && opt.기다림) ?? 3000;
  let html;
  try {
    html = await (await fetch(공고주소, { headers: { 'User-Agent': UA } })).text();
  } catch (e) { return { 왜: '공고 화면을 못 열었습니다 · ' + String(e && e.message || e) }; }

  const m = html.match(/fn_FileDown\('([^']+)','([^']*)','([^']*)'/);
  if (!m) return { 왜: '공고 화면에 fn_FileDown 이 없습니다 (첨부가 없는 공고)' };

  const body = new URLSearchParams();
  body.set('UPLOAD_FILENAME', m[1]); body.set('ORIGINAL_FILENAME', m[2]); body.set('FILE_PATH', m[3]);
  const 이름 = m[2] || m[1];

  for (let t = 0; t <= 다시; t++) {
    let code = 0, buf;
    try {
      const r = await fetch(받는곳, { method: 'POST', body,
        headers: { 'User-Agent': UA, Referer: 공고주소, 'Content-Type': 'application/x-www-form-urlencoded' } });
      code = r.status;
      buf = Buffer.from(await r.arrayBuffer());
    } catch (e) { return { 이름, 왜: '첨부를 못 받았습니다 · ' + String(e && e.message || e) }; }

    if (넘침인가(code, buf)) {
      if (t === 다시) return { 이름, code, 넘침: true,
        왜: '클린아이가 다운로드를 막고 있습니다 (HTTP ' + code + ' · ' + (다시 + 1) + '번 시도) — 간격을 늘려야 합니다' };
      await 쉼(기다림); 기다림 *= 2;
      continue;
    }
    if (!buf.length) return { 이름, code, 왜: '첨부가 0바이트로 왔습니다 (HTTP ' + code + ')' };
    return { buf, 이름, code, 다시받음: t };
  }
}
