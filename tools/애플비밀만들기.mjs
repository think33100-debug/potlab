/* 애플 client secret (JWT) 만들기 — **세중님 PC 에서 돌립니다** (2026-10-11).
 *
 *   node tools/애플비밀만들기.mjs
 *
 * Supabase 의 Apple 칸이 「Secret Key (for OAuth)」 하나뿐이고
 * 「Secret key should be a JWT」 라고 합니다. Team ID·Key ID 칸이 없으므로
 * **우리가 JWT 를 만들어 넣어야 합니다.**
 *
 * ── 이 파일에는 값이 하나도 없습니다 ────────────────────────
 * `.p8` 경로 · Team ID · Key ID · Client ID 를 **돌릴 때 물어서** 받습니다.
 * 만든 JWT 는 **화면에도 로그에도 안 찍습니다** — 바탕화면
 * `apple_secret.txt` 에만 씁니다. Supabase 에 붙이신 뒤 그 파일은 지우십시오.
 * 만료 **날짜**만 화면에 적습니다 (날짜는 비밀이 아닙니다).
 *
 * ── 애플이 정한 것 ──────────────────────────────────────────
 *   alg  ES256 (.p8 는 타원곡선 열쇠입니다)
 *   kid  Key ID            iss  Team ID
 *   aud  https://appleid.apple.com
 *   sub  Client ID (Services ID — 예 kr.co.potjob.web)
 *   exp  **최대 6개월**(15,777,000초). 그보다 길면 애플이 거절합니다
 *
 * 밖에서 받아오는 것이 없습니다 — node 에 들어 있는 것만 씁니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import crypto from 'node:crypto';

const 최대 = 15777000;              /* 애플이 받는 가장 긴 기간 — 6개월 */

/* 바탕화면 찾기 — OneDrive 로 옮겨 둔 경우가 많아 몇 자리를 봅니다 */
function 바탕화면() {
  const 밖 = process.argv.indexOf('--낼곳');
  if (밖 > 0 && process.argv[밖 + 1]) return process.argv[밖 + 1];
  const 집 = os.homedir();
  const 후보 = [
    process.env.OneDrive && path.join(process.env.OneDrive, '바탕 화면'),
    process.env.OneDrive && path.join(process.env.OneDrive, 'Desktop'),
    path.join(집, 'OneDrive', '바탕 화면'),
    path.join(집, 'Desktop'),
    path.join(집, '바탕 화면'),
  ].filter(Boolean);
  for (const d of 후보) if (fs.existsSync(d)) return d;
  return 집;
}

const 물음 = readline.createInterface({ input: process.stdin, output: process.stdout });
const 묻기 = async (말) => (await 물음.question(말)).trim().replace(/^["']|["']$/g, '');

console.log('애플 client secret 만들기 — 값은 화면에 안 찍습니다\n');

const p8길 = await 묻기('① .p8 파일 경로 (끌어다 놓으셔도 됩니다) : ');
if (!fs.existsSync(p8길)) { console.error('✗ 그 자리에 파일이 없습니다 — ' + p8길); 물음.close(); process.exit(1); }

const teamId = await 묻기('② Team ID (Membership details 의 열 글자)  : ');
const keyIdInput = await 묻기('③ Key ID (파일 이름 AuthKey_XXXXXXXXXX.p8 의 열 글자 · 비우면 파일 이름에서) : ');
const clientId = await 묻기('④ Client ID (Services ID · 예 kr.co.potjob.web) : ');
물음.close();

const keyId = keyIdInput || (path.basename(p8길).match(/AuthKey_([A-Za-z0-9]{10})\.p8$/)?.[1] ?? '');
const 모자람 = [['Team ID', teamId], ['Key ID', keyId], ['Client ID', clientId]]
  .filter(([, v]) => !v).map(([k]) => k);
if (모자람.length) { console.error('✗ 안 적힌 것 — ' + 모자람.join(' · ')); process.exit(1); }

/* .p8 은 PKCS#8 PEM 입니다. 모양만 보고 값은 안 찍습니다 */
const p8 = fs.readFileSync(p8길, 'utf8');
if (!/-----BEGIN PRIVATE KEY-----/.test(p8)) {
  console.error('✗ .p8 모양이 아닙니다 (BEGIN PRIVATE KEY 가 없습니다)');
  process.exit(1);
}

const 이제 = Math.floor(Date.now() / 1000);
const 끝 = 이제 + 최대;
const 머리 = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const 속 = { iss: teamId, iat: 이제, exp: 끝, aud: 'https://appleid.apple.com', sub: clientId };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const 앞 = b64(머리) + '.' + b64(속);

let 서명;
try {
  /* ieee-p1363 은 r|s 를 그대로 붙인 꼴입니다 — JWT 가 바라는 모양입니다.
     기본값(der)으로 두면 애플이 「invalid_client」 로 거절합니다 */
  서명 = crypto.sign('sha256', Buffer.from(앞),
    { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
} catch (e) {
  console.error('✗ 서명하지 못했습니다 — ' + String(e.message).slice(0, 160));
  console.error('   .p8 이 Sign in with Apple 용 열쇠가 맞는지 보십시오');
  process.exit(1);
}

const jwt = 앞 + '.' + 서명;
const 낼곳 = path.join(바탕화면(), 'apple_secret.txt');
fs.writeFileSync(낼곳, jwt + '\n', { mode: 0o600 });

const 날 = (t) => new Date(t * 1000).toLocaleDateString('ko-KR',
  { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });

console.log('\n○ 만들었습니다 — ' + 낼곳);
console.log('  글자 수 ' + jwt.length + ' (값은 안 찍습니다)');
console.log('  만든 날  ' + 날(이제));
console.log('  **만료일 ' + 날(끝) + '**  ← 이 날 전에 다시 만들어 넣어야 합니다');
console.log('\n다음 — 그 파일을 열어 **전체를 복사**해서');
console.log('  Supabase → Authentication → Providers → Apple → Secret Key (for OAuth) 에 붙이고 Save');
console.log('  붙인 뒤 **apple_secret.txt 를 지우십시오.**');
