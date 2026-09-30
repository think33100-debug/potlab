/* 서버 전용 수집기 열쇠를 만들어 .env.server 에 넣습니다 (2026-09-30).
 *
 *   node tools/서버열쇠만들기.mjs HS3 JF
 *
 * ── 지킬 것 ───────────────────────────────────────────────
 * · 값을 **화면에 안 찍습니다.** 길이만 말합니다
 * · 값은 potlab/.env.server 에만 적습니다 (.gitignore 에 걸려 있습니다)
 * · 옛 열쇠는 **안 건드립니다.** 3일 나란히 돌리는 동안 옛 수집기가 계속 돕니다
 *   (collect_secret 의 기본 열쇠를 (source, secret) 으로 바꿔 둘이 같이 삽니다)
 *
 * ── 왜 DB 함수를 안 쓰나 ──────────────────────────────────
 * `admin_new_collect_secret()` 은 관리자로 **로그인한 자리**에서만 됩니다
 * (is_admin() 이 auth.uid() 를 봅니다). 여기서는 로그인이 없습니다.
 * 그리고 DB 가 만들어 돌려주면 그 값이 제 화면을 거칩니다.
 *
 * 그래서 **값을 여기서 만들어** 표에 바로 담습니다. 값이 화면을 안 거칩니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = {};
for (const f of ['.env.local', 'web/.env.local']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2];
  });
}
const U = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }

const 것 = process.argv.slice(2).filter((x) => /^[A-Z0-9]{2,6}$/.test(x));
if (!것.length) { console.error('쓰기: node tools/서버열쇠만들기.mjs HS3 JF'); process.exit(1); }

/* .env.server 를 읽어 둡니다 — 이미 있는 줄은 덮어씁니다 */
const 파일 = '.env.server';
const 있던것 = fs.existsSync(파일) ? fs.readFileSync(파일, 'utf8') : '';
let 글 = 있던것;

const 머리 = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const 메모 = '서버 전용 (Lightsail 서울) 2026-09-30';

for (const src of 것) {
  /* 이미 서버 전용이 있으면 또 만들지 않습니다 */
  const 있나 = await (await fetch(U + '/rest/v1/collect_secret?select=source,note&source=eq.'
    + src + '&note=like.' + encodeURIComponent('서버 전용%'), { headers: 머리 })).json();
  if (Array.isArray(있나) && 있나.length) {
    console.log(src + ' — 서버 전용 열쇠가 이미 있습니다. 그냥 둡니다');
    continue;
  }

  /* 값은 **여기서** 만듭니다. 화면에 안 찍습니다 */
  const 새것 = crypto.randomBytes(32).toString('base64url');

  const r = await fetch(U + '/rest/v1/collect_secret', {
    method: 'POST', headers: { ...머리, Prefer: 'return=minimal' },
    body: JSON.stringify({ source: src, secret: 새것, note: 메모,
      made_on: new Date().toISOString().slice(0, 10) }),
  });
  if (!r.ok) {
    console.error(src + ' — 못 담았습니다 · ' + r.status + ' ' + (await r.text()).slice(0, 160));
    continue;
  }

  const 이름 = 'COLLECT_KEY_' + src;
  const 줄 = 이름 + '=' + 새것;
  글 = 글.includes(이름 + '=')
    ? 글.replace(new RegExp('^' + 이름 + '=.*$', 'm'), 줄)
    : (글 + (글 && !글.endsWith('\n') ? '\n' : '') + 줄 + '\n');

  const 몇 = await (await fetch(U + '/rest/v1/collect_secret?select=source&source=eq.' + src,
    { headers: 머리 })).json();
  console.log(src + ' — 만들었습니다 · ' + 새것.length + '자 · 이 수집기의 열쇠 '
    + (Array.isArray(몇) ? 몇.length : '?') + '개 (옛것 + 새것)');
}
fs.writeFileSync(파일, 글);
console.log('\n' + 파일 + ' 에 적었습니다. 값은 화면에 안 찍었습니다.');
