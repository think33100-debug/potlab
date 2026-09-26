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

const 범위 = 'https://www.googleapis.com/auth/drive';
let 계정 = null, 토큰 = null, 토큰끝 = 0;

function 열쇠읽기() {
  if (계정 !== null) return 계정;
  const raw = process.env.GDRIVE_SA_JSON;
  if (!raw) { 계정 = false; return 계정; }
  try {
    const j = JSON.parse(raw);
    계정 = (j.client_email && j.private_key) ? j : false;
  } catch { 계정 = false; }
  return 계정;
}

export function OCR쓸수있나() { return !!열쇠읽기(); }

const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function 토큰받기() {
  const sa = 열쇠읽기();
  if (!sa) throw new Error('GDRIVE_SA_JSON 이 없습니다');
  if (토큰 && Date.now() < 토큰끝 - 60000) return 토큰;

  const 이제 = Math.floor(Date.now() / 1000);
  const 머리 = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const 몸 = b64url(JSON.stringify({
    iss: sa.client_email, scope: 범위,
    aud: 'https://oauth2.googleapis.com/token',
    iat: 이제, exp: 이제 + 3600,
  }));
  const 서명 = b64url(crypto.createSign('RSA-SHA256')
    .update(머리 + '.' + 몸).sign(sa.private_key));

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: 머리 + '.' + 몸 + '.' + 서명,
    }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('토큰을 못 받았습니다 ' + r.status + ' ' + t.slice(0, 200));
  const j = JSON.parse(t);
  토큰 = j.access_token;
  토큰끝 = Date.now() + (Number(j.expires_in) || 3600) * 1000;
  return 토큰;
}

/** PDF 알맹이 → 글자. 못 읽으면 '' (던지지 않습니다 — 부르는 쪽이 보류함으로) */
export async function pdf글자(buf, 이름 = '공고문.pdf') {
  if (!OCR쓸수있나()) return '';
  let id = null;
  try {
    const tok = await 토큰받기();

    /* ① 올리면서 문서로 바꾸게 합니다.
       **대상 mimeType 을 정하지 않습니다** (정하면 OCR 이 거절됩니다) */
    const 경계 = '----potjob' + crypto.randomBytes(8).toString('hex');
    const 메타 = JSON.stringify({ name: 이름, mimeType: 'application/pdf' });
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
      body: JSON.stringify({ mimeType: 'application/vnd.google-apps.document' }),
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
    return 글;
  } catch (e) {
    if (id) { try { await 지우기(await 토큰받기(), id); } catch { /* 넘어갑니다 */ } }
    console.error('  OCR 실패 · ' + String(e.message).slice(0, 140));
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
