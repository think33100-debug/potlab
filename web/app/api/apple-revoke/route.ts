import { NextResponse } from 'next/server';

/* 탈퇴할 때 **애플 연결을 끊습니다** (2026-10-11 · 애플 5.1.1(v)).
 *
 *   POST /api/apple-revoke     (Authorization: Bearer <회원 토큰>)
 *
 * 애플은 「앱에서 탈퇴하면 애플 쪽 연결도 거두라」고 합니다
 * (POST https://appleid.apple.com/auth/revoke).
 *
 * ── 어떻게 돌아가나 ─────────────────────────────────────────
 * ① 애플로 로그인하고 돌아온 **그 순간**에만 세션에 `provider_refresh_token`
 *    이 실려 옵니다. /auth/callback 이 그것을 창구 `애플연결저장()` 으로
 *    넣어 둡니다 (표는 창구로만 봅니다).
 * ② 탈퇴할 때 이 자리가 `내애플연결()` 로 **그 사람 것만** 꺼내
 *    애플에 revoke 를 부릅니다.
 * ③ 끝나면 `애플연결끊음()` 이 값을 비웁니다 (지우지 않습니다 · 8-7).
 *
 * ── 열쇠는 세중님이 넣습니다 ────────────────────────────────
 * `APPLE_CLIENT_ID` · `APPLE_CLIENT_SECRET`(⑤ 에서 만든 **JWT**).
 * 없으면 **아무것도 안 하고 그 사실을 그대로 돌려줍니다** — 탈퇴 자체는
 * 막지 않습니다. 애플 로그인이 아직 없는 동안에도 화면이 안 깨집니다.
 * .p8 이 아니라 JWT 를 두는 까닭은 docs/애플로그인_준비.md 에 적었습니다.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function 창구(토큰: string, 이름: string, 몸: unknown = {}) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${encodeURIComponent(이름)}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${토큰}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(몸),
    cache: 'no-store',
  });
  const t = await r.text();
  try { return { ok: r.ok, 답: JSON.parse(t) }; } catch { return { ok: r.ok, 답: t }; }
}

export async function POST(req: Request) {
  const 토큰 = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!토큰) return NextResponse.json({ 됨: false, 왜: '로그인이 필요합니다' }, { status: 401 });

  const 아이디 = process.env.APPLE_CLIENT_ID;
  const 비밀 = process.env.APPLE_CLIENT_SECRET;
  if (!아이디 || !비밀) {
    /* 탈퇴를 막지 않습니다 — 아직 안 붙인 것뿐입니다 */
    return NextResponse.json({ 됨: false, 왜: '애플 열쇠가 아직 없습니다 (승인대기 ⑲)' });
  }

  const 꺼냄 = await 창구(토큰, '내애플연결');
  const 리프레시 = typeof 꺼냄.답 === 'string' ? 꺼냄.답 : null;
  if (!꺼냄.ok) return NextResponse.json({ 됨: false, 왜: '연결을 못 읽었습니다' }, { status: 502 });
  if (!리프레시) {
    /* 애플로 로그인한 적이 없거나 이미 끊었습니다 — 할 일이 없습니다 */
    return NextResponse.json({ 됨: true, 왜: '끊을 애플 연결이 없습니다' });
  }

  const 몸 = new URLSearchParams({
    client_id: 아이디,
    client_secret: 비밀,
    token: 리프레시,
    token_type_hint: 'refresh_token',
  });
  const r = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 몸,
    cache: 'no-store',
  });
  /* 애플은 성공하면 **빈 몸에 200** 을 줍니다 */
  if (!r.ok) {
    const 글 = (await r.text()).slice(0, 300);
    return NextResponse.json({ 됨: false, HTTP: r.status, 왜: 글 }, { status: 502 });
  }

  await 창구(토큰, '애플연결끊음');
  return NextResponse.json({ 됨: true });
}
