/* PDF → 글자. 구글 Drive 의 `convert:true` 를 씁니다 (2026-09-26).
 *
 * ── 왜 Drive 인가 ────────────────────────────────────────────
 * 알리오 공고문은 **거의 전부 스캔 그림**입니다. 2026-09-26 에 의료 기관
 * 공고문 12건을 받아 pdftotext 로 읽어보니 12건 다 한글이 0자였습니다
 * (글꼴 0개 · 그림 9개). 글자를 뽑으려면 OCR 이 있어야 하고,
 * gas 가 쓰던 Drive 가 이미 검증된 길입니다.
 *
 * ── gas 에서 배운 것 두 가지 ─────────────────────────────────
 *  1. 바꿀 대상(mimeType)을 정하고 OCR 을 같이 요청하면
 *     「OCR is not supported for files of type …document」 가 납니다.
 *     **대상을 정하지 말고 convert 로 「문서로 바꿔달라」 고만** 해야 합니다.
 *  2. 받은 것이 정말 PDF 인지 먼저 봐야 합니다 (앞 5글자 %PDF-).
 *     HTML 을 올리면 「OCR is not supported for files of type text/html」.
 *     그 확인은 부르는 쪽(collect-alio.mjs)에서 이미 합니다.
 *
 * ── 열쇠 ─────────────────────────────────────────────────────
 * GDRIVE_SA_JSON — 구글 서비스 계정 열쇠(JSON) 통째로. GitHub Secrets.
 * **없으면 OCR쓸수있나() 가 false 를 돌려주고, 부르는 쪽이 보류함으로 보냅니다.**
 * 못 읽었다고 공고를 버리지 않습니다.
 *
 * 서비스 계정에 Drive API 를 켜 두어야 합니다. 올린 파일은 **바로 지웁니다** —
 * 서비스 계정의 드라이브 용량이 차면 다음부터 조용히 실패합니다.
 *
 * 라이브러리를 안 씁니다 (`googleapis` 는 무겁습니다). JWT 는 node:crypto 로
 * 직접 서명합니다 — 40줄이면 됩니다.
 */
import crypto from 'node:crypto';

/* ── 두 가지 길 ───────────────────────────────────────────────
 *  ① **세중님 계정 (OAuth · 지금 쓰는 길)**
 *     GDRIVE_CLIENT_ID · GDRIVE_CLIENT_SECRET · GDRIVE_REFRESH_TOKEN
 *     범위는 drive.file — **이 앱이 만든 파일만** 봅니다.
 *  ② 서비스 계정 (2026-09-26 에 막혔습니다. 남겨만 둡니다)
 *     GDRIVE_SA_JSON. **서비스 계정은 제 드라이브 용량이 0** 이라
 *     폴더를 공유받아도 올린 파일 주인이 서비스 계정이라 403 이 납니다.
 *     공유 드라이브가 있으면 풀리는데 개인 gmail 에는 없습니다.
 */
const 범위 = 'https://www.googleapis.com/auth/drive.file';
let 토큰 = null, 토큰끝 = 0;

function 어느길() {
  if (process.env.GDRIVE_REFRESH_TOKEN && process.env.GDRIVE_CLIENT_ID
      && process.env.GDRIVE_CLIENT_SECRET) return 'oauth';
  if (process.env.GDRIVE_SA_JSON) return 'sa';
  return '';
}
export function OCR쓸수있나() { return !!어느길(); }
export function OCR어느길() { return 어느길(); }

const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function 토큰받기() {
  if (토큰 && Date.now() < 토큰끝 - 60000) return 토큰;
  const 길 = 어느길();
  if (!길) throw new Error('드라이브 열쇠가 없습니다');

  let body;
  if (길 === 'oauth') {
    body = new URLSearchParams({
      client_id: process.env.GDRIVE_CLIENT_ID,
      client_secret: process.env.GDRIVE_CLIENT_SECRET,
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    });
  } else {
    const sa = JSON.parse(process.env.GDRIVE_SA_JSON);
    const 이제 = Math.floor(Date.now() / 1000);
    const 머리 = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const 몸 = b64url(JSON.stringify({
      iss: sa.client_email, scope: 범위,
      aud: 'https://oauth2.googleapis.com/token', iat: 이제, exp: 이제 + 3600,
    }));
    const 서명 = b64url(crypto.createSign('RSA-SHA256').update(머리 + '.' + 몸).sign(sa.private_key));
    body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: 머리 + '.' + 몸 + '.' + 서명,
    });
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const t = await r.text();
  if (!r.ok) {
    /* **토큰이 죽으면 여기서 납니다.** 동의 화면이 「테스트」 상태면
       refresh token 이 7일 뒤 죽습니다 (구글 문서). 무슨 일인지 또렷이 적습니다 */
    const 죽음 = /invalid_grant/.test(t);
    throw new Error((죽음 ? '★ 드라이브 열쇠가 죽었습니다 (invalid_grant) — '
      + '동의 화면이 「테스트」 상태면 7일 뒤 죽습니다. 「프로덕션」 으로 게시하고 '
      + 'node tools/drive-auth.mjs 로 다시 받으세요. · ' : '토큰을 못 받았습니다 ')
      + r.status + ' ' + t.slice(0, 200));
  }
  const j = JSON.parse(t);
  토큰 = j.access_token;
  토큰끝 = Date.now() + (Number(j.expires_in) || 3600) * 1000;
  return 토큰;
}

/* 연속으로 실패하면 더 안 두드립니다. 열쇠가 죽은 것과 한 건이 이상한 것은
   다른 일입니다. 앞엣것은 로그를 90줄로 만들고 아무것도 안 알려줍니다 */
let 연속실패 = 0, 꺼짐 = '';
const 실패한도 = 5;
/** 지금 OCR 이 멈춰 있나 — 멈춰 있으면 까닭을 돌려줍니다 */
export function OCR멈췄나() { return 꺼짐; }

/** PDF 알맹이 → 글자. 못 읽으면 '' (던지지 않습니다 — 부르는 쪽이 보류함으로) */
export async function pdf글자(buf, 이름 = '공고문.pdf') {
  if (!OCR쓸수있나() || 꺼짐) return '';
  let id = null;
  try {
    const tok = await 토큰받기();

    /* ① 올리면서 문서로 바꾸게 합니다.
       **대상 mimeType 을 정하지 않습니다** (정하면 OCR 이 거절됩니다) */
    const 경계 = '----potjob' + crypto.randomBytes(8).toString('hex');
    /* **폴더를 정해 그 안에 올립니다.**
       서비스 계정은 제 드라이브 용량이 0 입니다. 아무 데나 올리면
       「storageQuotaExceeded」 가 납니다. 사람 계정이 만든 폴더를 서비스
       계정에게 편집자로 공유하고, 그 폴더 번호를 GDRIVE_OCR_FOLDER 에 둡니다 */
    const 폴더 = process.env.GDRIVE_OCR_FOLDER;
    const 메타 = JSON.stringify({
      name: 이름, mimeType: 'application/pdf',
      ...(폴더 ? { parents: [폴더] } : {}),
    });
    const 앞 = Buffer.from('--' + 경계 + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
      + 메타 + '\r\n--' + 경계 + '\r\nContent-Type: application/pdf\r\n\r\n');
    const 뒤 = Buffer.from('\r\n--' + 경계 + '--');
    const up = await fetch('https://www.googleapis.com/upload/drive/v3/files'
      + '?uploadType=multipart&ocrLanguage=ko&fields=id', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + 경계 },
      body: Buffer.concat([앞, buf, 뒤]),
    });
    if (!up.ok) throw new Error('올리기 실패 ' + up.status + ' ' + (await up.text()).slice(0, 200));
    id = JSON.parse(await up.text()).id;

    /* ② 문서로 복사(= 변환 + OCR) */
    const cp = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?fields=id', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mimeType: 'application/vnd.google-apps.document',
        ...(폴더 ? { parents: [폴더] } : {}),
      }),
    });
    if (!cp.ok) throw new Error('바꾸기 실패 ' + cp.status + ' ' + (await cp.text()).slice(0, 200));
    const 문서 = JSON.parse(await cp.text()).id;

    /* ③ 글로 내려받기 */
    const tx = await fetch('https://www.googleapis.com/drive/v3/files/' + 문서
      + '/export?mimeType=text/plain', { headers: { Authorization: 'Bearer ' + tok } });
    const 글 = tx.ok ? await tx.text() : '';

    /* ④ **바로 치웁니다.** 안 지우면 서비스 계정 용량이 차고
          그다음부터 조용히 실패합니다 */
    await 지우기(tok, 문서);
    await 지우기(tok, id);
    id = null;
    연속실패 = 0;   // 한 번 되면 셈을 되돌립니다
    return 글;
  } catch (e) {
    if (id) { try { await 지우기(await 토큰받기(), id); } catch { /* 넘어갑니다 */ } }
    연속실패++;
    console.error('  OCR 실패 (' + 연속실패 + '번째) · ' + String(e.message).slice(0, 160));
    /* **연속으로 실패하면 멈춥니다.** 열쇠가 죽었는데 500건을 다 두드리면
       로그가 90줄씩 쌓이고 무엇이 문제인지 안 보입니다.
       한 건씩 다른 까닭으로 실패하는 것과, 열쇠가 죽어 전부 실패하는 것은
       다른 일입니다 — 뒤엣것은 사람이 손봐야 합니다 (2026-09-26) */
    if (연속실패 >= 실패한도) {
      꺼짐 = '★ OCR 열쇠 확인 — 연속 ' + 연속실패 + '번 실패해서 멈췄습니다. '
        + '마지막 까닭: ' + String(e.message).slice(0, 120);
      console.error('\n' + 꺼짐 + '\n');
    }
    return '';
  }
}
async function 지우기(tok, id) {
  if (!id) return;
  try {
    await fetch('https://www.googleapis.com/drive/v3/files/' + id,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
  } catch { /* 지우기 실패는 넘어갑니다 */ }
}
