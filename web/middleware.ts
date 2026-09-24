import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/* 로그인 토큰을 이어주는 자리입니다 (2026-09-25).

   토큰은 한 시간쯤 지나면 만료됩니다. 브라우저 안에 있을 때는 supabase-js 가
   알아서 갱신했는데, 쿠키로 옮기고 나면 **서버가 갱신한 값을 다시 쿠키에
   써 줘야** 합니다. 서버 컴포넌트는 쿠키를 못 씁니다(읽기 전용).
   그 일을 할 수 있는 유일한 자리가 미들웨어입니다.

   이게 없으면 — 한 시간 뒤 새로고침하면 회원이 갑자기 비회원으로 보입니다.

   **여기서 막지 않습니다.** 막는 자리는 DB 입니다.
   미들웨어에서 길을 막으면 화면을 뚫는 사람은 못 막고(요청을 직접 쏘면 그만),
   멀쩡한 사람만 걸립니다. 여기는 토큰만 이어줍니다. */

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  /* 이 한 줄이 갱신을 일으킵니다. 결과는 안 씁니다 —
     빼면 토큰이 안 늘어나고, 한 시간 뒤부터 로그인이 풀립니다 */
  await sb.auth.getUser();

  return res;
}

export const config = {
  matcher: [
    /* 그림·글꼴·파비콘에는 안 걸립니다. 걸어두면 요청마다 헛일을 합니다.
       _next(빌드 산출물) · api(자기 열쇠로 돕니다) · 확장자가 붙은 파일 제외 */
    '/((?!_next/static|_next/image|api/|favicon|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|css|js)$).*)',
  ],
};
