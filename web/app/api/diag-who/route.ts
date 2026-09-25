import { NextResponse } from 'next/server';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 서버가 지금 이 사람을 무엇으로 보는지 그대로 돌려줍니다 (2026-09-25).

   왜 만들었나 — serverWho 로 고쳤는데도 회원에게 가입 권유가 떴습니다.
   세 가지가 의심스러운데, 셋을 가르려면 **서버 판정과 화면 판정을
   나란히 놓고 봐야** 합니다.

     가  쿠키가 서버까지 안 감      → 서버 「비회원」 · 화면 「회원」
     나  캐시된 비회원 화면이 내려감 → 서버 「회원」 인데 벽이 그려짐
     다  아래 부품이 옛 판정을 함   → 서버 「회원」 · 벽에 붙은 이름이 화면 부품

   화면을 그릴 때와 **같은 쿠키**가 이 요청에도 실립니다. 그래서 여기 답이
   화면 렌더의 답과 같습니다 — 이 세 길은 캐시가 없는 것을 이미 확인했습니다
   (private, no-store · X-Vercel-Cache MISS).

   ── 무엇을 안 찍나 ────────────────────────────────────────────
   **쿠키 값도 토큰도 사람 id 도 안 찍습니다.** 있는지 없는지와 개수만입니다.
   캡처해서 주고받을 것이라 값이 들어가면 안 됩니다. */

export const dynamic = 'force-dynamic';   // 캐시되면 진단이 거짓말을 합니다

export async function GET() {
  const sb = await serverSupabase();

  /* 서버가 실제로 쓰는 그 함수입니다. 여기서 따로 판정하지 않습니다 */
  const who = await serverWho(sb);

  /* 오류 이름만 따로 봅니다 — 「비회원」과 「모름」을 가른 근거 */
  const { error } = await sb.auth.getUser();

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const all = jar.getAll();

  /* 이름을 정확히 갈라야 합니다.

     처음에 `auth-token 이 이름에 들어있으면 로그인 쿠키` 로 셌더니, 로그인을
     한 적 없는 브라우저가 「로그인 쿠키 있음 · 7개」 라고 나왔습니다.
     일곱 개 전부 `…auth-token-…-code-verifier` — 로그인하러 갔다가 돌아오는
     길에 쓰는 임시 쪽지였습니다. 진단이 거짓말을 하면 엉뚱한 데를 팝니다.

       sb-<ref>-auth-token            진짜 세션. 4KB 를 넘으면 .0 .1 로 쪼개집니다
       sb-<ref>-auth-token-…-code-verifier   로그인 도중의 임시 쪽지. 세션이 아닙니다 */
  const 임시쪽지 = (n: string) => n.includes('code-verifier');
  const 세션 = all.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  const 쪽지 = all.filter((c) => c.name.startsWith('sb-') && 임시쪽지(c.name));

  return NextResponse.json({
    서버판정: who,
    오류이름: error?.name ?? null,
    로그인쿠키: 세션.length ? '있음' : '없음',
    로그인쿠키조각: 세션.length,          // 4KB 를 넘으면 .0 .1 로 쪼개집니다
    로그인도중쪽지: 쪽지.length,          // 쌓이기만 하고 안 지워집니다 (많으면 그것도 단서)
    쿠키전체개수: all.length,
    배포: (process.env.VERCEL_GIT_COMMIT_SHA ?? '로컬').slice(0, 7),
    배포판: process.env.VERCEL_ENV ?? '로컬',
    지금: new Date().toISOString(),
  });
}
