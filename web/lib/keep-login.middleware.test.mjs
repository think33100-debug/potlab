/* node --experimental-strip-types web/lib/keep-login.middleware.test.mjs

   문지기(middleware.ts)를 **진짜 그 함수로** 돌려 로그인 쿠키 다시 굽기를 봅니다 (2026-11-23).
   로그인 서버만 가짜입니다 — 「이 사람은 회원」이라고 답하는 자리 하나. 나머지(쿠키 읽기·쓰기 · 응답)는 Next 것 그대로입니다.
   사파리의 7일 규칙 자체는 여기서 못 봅니다(사파리만 압니다) — 「서버 응답으로 같은 값이 400일짜리로 내려가나」까지 봅니다. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const 웹 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let 회원 = null;          // 가짜 로그인 서버가 답할 사람
globalThis.__가짜회원 = () => 회원;

registerHooks({
  resolve(이름, 맥락, 다음) {
    if (이름 === '@supabase/ssr') return { url: 'data:text/javascript,' + encodeURIComponent(`
      export const DEFAULT_COOKIE_OPTIONS = { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 400 * 24 * 60 * 60 };
      export function createServerClient() {
        const 답 = () => { const u = globalThis.__가짜회원(); return u ? { data: { claims: { sub: u } }, error: null } : { data: null, error: { name: 'AuthSessionMissingError' } }; };
        const 줄 = { select: () => 줄, eq: () => 줄, maybeSingle: async () => ({ data: globalThis.__가짜회원() ? { id: 'x' } : null, error: null }) };
        return { auth: { getClaims: async () => 답() }, from: () => 줄 };
      }`), shortCircuit: true };
    if (이름 === 'next/server') return 다음('next/server.js', 맥락);
    if (이름.startsWith('@/')) {
      const 자리 = path.join(웹, 이름.slice(2));
      for (const 끝 of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(자리 + 끝)) return { url: pathToFileURL(자리 + 끝).href, shortCircuit: true };
    }
    return 다음(이름, 맥락);
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:1';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'x';
const { NextRequest } = await import('next/server.js');
const { middleware } = await import('../middleware.ts');
const { 쿠키지문, 굽기표 } = await import('./keep-login.ts');

const 요청 = (길, 쿠키) => new NextRequest('https://www.rapojob.co.kr' + 길, {
  headers: { host: 'www.rapojob.co.kr', cookie: Object.entries(쿠키).map(([k, v]) => `${k}=${v}`).join('; ') },
});
const 내려온 = (res) => res.headers.getSetCookie().map((s) => ({ 이름: s.split('=')[0], 글: s }));

const 세션 = { 'sb-abc-auth-token.0': 'base64-AAAA', 'sb-abc-auth-token.1': 'BBBB' };
const 지문 = 쿠키지문(Object.entries(세션).map(([name, value]) => ({ name, value })));

/* ① 회원 · 표 없음 → 로그인 쿠키 둘 + 표가 400일짜리로 내려갑니다 */
회원 = 'u1';
let res = await middleware(요청('/jobs', 세션));
let 쿠키 = 내려온(res);
assert.deepEqual(쿠키.map((c) => c.이름).sort(), ['rapo-keep', 'sb-abc-auth-token.0', 'sb-abc-auth-token.1']);
for (const c of 쿠키) {
  assert.match(c.글, /Max-Age=34560000/, c.글);
  assert.match(c.글, /Path=\//);
  assert.match(c.글, /SameSite=lax/i);
  assert.doesNotMatch(c.글, /HttpOnly/i);   // 브라우저 쪽 로그인 꾸러미가 읽어야 합니다
}
assert.ok(쿠키.find((c) => c.이름 === 'sb-abc-auth-token.0').글.startsWith('sb-abc-auth-token.0=base64-AAAA;'));
assert.ok(쿠키.find((c) => c.이름 === 굽기표).글.startsWith(`${굽기표}=${지문};`));

/* ② 회원 · 표가 지금 값과 같음 → 아무 쿠키도 안 내려갑니다 (요청마다 큰 쿠키를 안 보냄) */
res = await middleware(요청('/jobs', { ...세션, [굽기표]: 지문 }));
assert.deepEqual(내려온(res), []);

/* ③ 회원 · 값이 바뀜(토큰 갱신 뒤) → 다시 굽습니다 */
res = await middleware(요청('/jobs', { ...세션, 'sb-abc-auth-token.0': 'base64-CCCC', [굽기표]: 지문 }));
assert.equal(내려온(res).length, 3);

/* ④ 비회원 → 로그인 쿠키를 안 굽습니다 (쿠키가 남아 있어도 · 회원 확인이 안 된 값은 늘려 주지 않음) */
회원 = null;
res = await middleware(요청('/jobs', 세션));
assert.deepEqual(내려온(res), []);

/* ⑤ 굽는길 — 회원이면 204 + 쿠키, 비회원이면 204 뿐 */
회원 = 'u1';
res = await middleware(요청('/auth/keep', 세션));
assert.equal(res.status, 204);
assert.equal(내려온(res).length, 3);
assert.match(res.headers.get('cache-control') ?? '', /no-store/);
회원 = null;
res = await middleware(요청('/auth/keep', {}));
assert.equal(res.status, 204);
assert.deepEqual(내려온(res), []);

/* ⑥ 임시 쪽지(code-verifier)는 안 굽습니다 */
회원 = 'u1';
res = await middleware(요청('/jobs', { ...세션, 'sb-abc-auth-token-code-verifier': 'vvv' }));
assert.equal(내려온(res).some((c) => c.이름.includes('code-verifier')), false);

/* ⑦ 주소 하나로 — 옛 주소로 온 화면 요청은 같은 길 그대로 대표 주소로 (2026-11-23) */
const 옛 = (길, 더 = {}) => new NextRequest('https://potjob-web.vercel.app' + 길, { headers: { host: 'potjob-web.vercel.app', cookie: Object.entries(세션).map(([k, v]) => `${k}=${v}`).join('; ') }, ...더 });
for (const [길, 갈곳] of [['/', 'https://www.rapojob.co.kr/'], ['/jobs/HS123?tab=a&b=1', 'https://www.rapojob.co.kr/jobs/HS123?tab=a&b=1'], ['/login?next=%2Fme', 'https://www.rapojob.co.kr/login?next=%2Fme'], ['/community/%EC%9E%84%EC%83%81', 'https://www.rapojob.co.kr/community/%EC%9E%84%EC%83%81']]) {
  res = await middleware(옛(길));
  assert.equal(res.status, 307, 길);
  assert.equal(res.headers.get('location'), 갈곳, 길);
  assert.deepEqual(내려온(res), []);            // 옛 주소에는 쿠키를 새로 굽지 않습니다
}
/* 옛 주소의 로그인 마치는 자리 · 굽는 길 · 로그인 값 들고 온 첫 화면은 전처럼 */
res = await middleware(옛('/auth/callback?code=abc'));
assert.notEqual(res.status, 307);
res = await middleware(옛('/auth/keep'));
assert.equal(res.status, 204);
res = await middleware(옛('/?code=abc'));
assert.equal(res.headers.get('location'), 'https://www.rapojob.co.kr/auth/callback?code=abc');
/* 화면 요청이 아닌 것(POST)은 안 보냅니다 */
res = await middleware(옛('/jobs', { method: 'POST' }));
assert.notEqual(res.status, 307);
/* 대표 주소·미리보기 주소는 안 보냅니다 */
res = await middleware(요청('/jobs', 세션));
assert.notEqual(res.status, 307);
res = await middleware(new NextRequest('https://potjob-abc-projects.vercel.app/jobs', { headers: { host: 'potjob-abc-projects.vercel.app' } }));
assert.equal(res.headers.get('location')?.startsWith('https://www.rapojob.co.kr') ?? false, false);

console.log('문지기 점검 통과 (다시 굽기 여섯 + 주소 하나로)');
