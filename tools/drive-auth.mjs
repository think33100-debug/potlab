/* 구글 드라이브 OCR 열쇠 받기 — **세중님 컴퓨터에서 한 번만** 돌립니다.
 *
 *   node tools/drive-auth.mjs
 *
 * 브라우저가 열리고 「허용」 을 누르면, 화면에 refresh token 이 찍힙니다.
 * 그 값을 GitHub Secrets 의 GDRIVE_REFRESH_TOKEN 에 넣으시면 됩니다.
 *
 * ── 왜 서비스 계정을 안 쓰나 ─────────────────────────────────
 * 서비스 계정은 **제 드라이브 용량이 0** 입니다. 폴더를 공유받아도 올린 파일의
 * 주인은 서비스 계정이라 403 storageQuotaExceeded 가 납니다.
 * 공유 드라이브가 있으면 풀리는데, 개인 gmail 에는 공유 드라이브가 없습니다.
 * 그래서 **세중님 계정으로** 올립니다.
 *
 * ── 범위는 가장 좁게 ─────────────────────────────────────────
 * drive.file — **이 앱이 만든 파일만** 볼 수 있습니다.
 * 세중님 드라이브의 다른 파일은 못 읽고 못 지웁니다.
 * (전체 드라이브 권한 `drive` 는 요청하지 않습니다)
 *
 * ── 7일 만에 죽지 않게 ───────────────────────────────────────
 * OAuth 동의 화면이 「테스트」 상태면 refresh token 이 **7일 뒤 죽습니다.**
 * 구글 문서 그대로 —
 *   "a publishing status of 'Testing' is issued a refresh token expiring
 *    in 7 days, unless the only OAuth scopes requested are a subset of
 *    name, email address, and user profile."
 * 그래서 **「프로덕션」 으로 게시**해야 합니다. drive.file 은 「민감하지 않은
 * 범위」라 보안 심사 없이 게시됩니다 (구글 문서: non-sensitive scopes
 * "only require basic OAuth App Verification").
 * 누르는 순서는 tools/드라이브_OCR_설정.md 에 적어 뒀습니다.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';

const 범위 = 'https://www.googleapis.com/auth/drive.file';
const 포트 = 4765;                      // 돌려받을 자리 (안 쓰이는 번호)
const 돌아올곳 = 'http://localhost:' + 포트;

const ID = process.env.GDRIVE_CLIENT_ID || process.argv[2];
const SECRET = process.env.GDRIVE_CLIENT_SECRET || process.argv[3];
if (!ID || !SECRET) {
  console.log('쓰는 법 —');
  console.log('  node tools/drive-auth.mjs <클라이언트 ID> <클라이언트 보안 비밀번호>');
  console.log('');
  console.log('구글 클라우드 콘솔에서 「데스크톱 앱」 OAuth 클라이언트를 만들고');
  console.log('그 두 값을 넣어 주세요. 순서는 tools/드라이브_OCR_설정.md 에 있습니다.');
  process.exit(1);
}

/* PKCE — 보안 비밀번호가 새도 코드만으로는 토큰을 못 받게 */
const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const 검증값 = b64url(crypto.randomBytes(32));
const 도전값 = b64url(crypto.createHash('sha256').update(검증값).digest());
const 표 = crypto.randomBytes(16).toString('hex');

const 갈곳 = 'https://accounts.google.com/o/oauth2/v2/auth?'
  + new URLSearchParams({
    client_id: ID,
    redirect_uri: 돌아올곳,
    response_type: 'code',
    scope: 범위,
    access_type: 'offline',      // refresh token 을 받으려면 꼭 필요합니다
    prompt: 'consent',           // 이미 허용했어도 refresh token 을 다시 줍니다
    code_challenge: 도전값,
    code_challenge_method: 'S256',
    state: 표,
  });

console.log('브라우저를 엽니다. 「허용」 을 눌러 주세요.');
console.log('안 열리면 이 주소를 직접 여세요 —\n');
console.log(갈곳 + '\n');
/* 「이 앱은 Google에서 확인하지 않았습니다」 가 뜨면 → 고급 → 이동(안전하지 않음) */
console.log('※ 「확인되지 않은 앱」 이라고 뜨면 「고급」 → 「…(으)로 이동(안전하지 않음)」 을 누르세요.');
console.log('   세중님이 만든 앱이라 그렇습니다.\n');

const 열기 = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
exec(열기 + ' "' + 갈곳 + '"');

const 서버 = http.createServer(async (req, res) => {
  const u = new URL(req.url, 돌아올곳);
  if (u.pathname !== '/') { res.writeHead(404).end(); return; }
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  const 답 = (글) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;font-size:18px">'
      + 글 + '</body>');
  };
  if (err) { 답('허용하지 않으셨습니다 — ' + err + '<br>창을 닫고 다시 돌려 주세요.'); 서버.close(); process.exit(1); }
  if (u.searchParams.get('state') !== 표) { 답('상태값이 안 맞습니다. 다시 돌려 주세요.'); 서버.close(); process.exit(1); }
  if (!code) { 답('코드가 안 왔습니다.'); return; }

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ID, client_secret: SECRET, code,
        code_verifier: 검증값, grant_type: 'authorization_code',
        redirect_uri: 돌아올곳,
      }),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
    const j = JSON.parse(t);
    if (!j.refresh_token) {
      throw new Error('refresh token 이 안 왔습니다. 구글 계정 → 보안 → '
        + '「타사 앱」 에서 이 앱의 권한을 지우고 다시 돌려 주세요');
    }
    답('다 됐습니다. 터미널로 돌아가 주세요.');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('GitHub Secrets 에 넣으실 값 세 개');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('GDRIVE_CLIENT_ID');
    console.log(ID + '\n');
    console.log('GDRIVE_CLIENT_SECRET');
    console.log(SECRET + '\n');
    console.log('GDRIVE_REFRESH_TOKEN');
    console.log(j.refresh_token + '\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('※ 동의 화면이 「테스트」 상태면 이 토큰은 7일 뒤 죽습니다.');
    console.log('   「프로덕션」 으로 게시하셨는지 꼭 확인해 주세요.');
    console.log('   (tools/드라이브_OCR_설정.md 의 3단계)');
  } catch (e) {
    답('토큰을 못 받았습니다 — ' + String(e.message));
    console.error('\n실패: ' + e.message);
    process.exitCode = 1;
  }
  서버.close();
});
서버.listen(포트, () => {});
