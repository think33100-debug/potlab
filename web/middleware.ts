import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { 가입중길, 길에있나, 비회원길 } from '@/lib/beta';
import { GUEST_COOKIE } from '@/lib/guest-view';

/* 로그인 토큰을 이어주는 자리입니다 (2026-09-25).

   토큰은 한 시간쯤 지나면 만료됩니다. 브라우저 안에 있을 때는 supabase-js 가
   알아서 갱신했는데, 쿠키로 옮기고 나면 **서버가 갱신한 값을 다시 쿠키에
   써 줘야** 합니다. 서버 컴포넌트는 쿠키를 못 씁니다(읽기 전용).
   그 일을 할 수 있는 유일한 자리가 미들웨어입니다.

   이게 없으면 — 한 시간 뒤 새로고침하면 회원이 갑자기 비회원으로 보입니다.

   ★ 2026-11-11 — **클로즈드 베타(11/13~) 동안은 여기서도 막습니다** (세중님 결정 · 줄 A).
   「비회원은 아무것도 못 본다」 — 로그인 안 한 사람은 어느 주소로 오든
   /beta 안내 화면으로 갑니다 (lib/beta.ts 의 비회원길만 예외).
   ⚠ 여기는 **첫 벽**입니다. 요청을 직접 쏘는 사람은 화면을 안 거치므로,
   DB 쪽 벽(비회원에게 데이터 창구 닫기 · RAPO노트/SQL_1113/A2_회원전용.sql)이
   함께 올라가야 닫힌 것입니다. */

/* 비회원에게 막는 API — 공고 미리보기 그림 · 커뮤니티 글 사진.
   나머지 API(hit · build · biz · apple-revoke · diag-who)는 예전처럼 안 거칩니다 */
const 막는API = ['/api/og', '/api/post-image'];

/* 검색엔진 색인을 막습니다 (테스트 동안). app/robots.ts 와 한 쌍 */
const 색인막기 = 'noindex, nofollow';

export async function middleware(req: NextRequest) {
  /* 디자인 견본(/design-preview)은 **개발 서버에서만** 문을 지나갑니다 (2026-11-11).
     그 화면들은 배포에서 스스로 404 이고(각 page.tsx 의 NODE_ENV 검사), 배포에서는 이 줄이 아예 안 돕니다.
     비회원길(lib/beta.ts)에 넣지 않은 까닭 — 거기 넣으면 배포에서도 비회원에게 열립니다 */
  if (process.env.NODE_ENV !== 'production' && req.nextUrl.pathname.startsWith('/design-preview')) {
    return NextResponse.next({ request: req });
  }

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

  /* 이 한 줄이 갱신을 일으킵니다 —
     빼면 토큰이 안 늘어나고, 한 시간 뒤부터 로그인이 풀립니다 */
  const { data, error } = await sb.auth.getUser();

  /* 다른 응답(돌려보내기·바꿔 보여주기)으로 갈아탈 때 갱신한 쿠키를 같이 싣습니다.
     안 실으면 돌려보낸 화면에서 다시 옛 토큰을 들고 옵니다 */
  const 쿠키싣기 = (r: NextResponse) => {
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    r.headers.set('X-Robots-Tag', 색인막기);
    return r;
  };

  const path = req.nextUrl.pathname;
  const api = 막는API.some((p) => path === p || path.startsWith(p + '/'));

  /* 「비회원 보기」(마스터가 비회원 화면을 겪어 보는 쿠키)는 비회원으로 셉니다 —
     lib/supabase-server.ts 와 같은 뜻입니다 */
  const 비회원보기 = req.cookies.get(GUEST_COOKIE)?.value === '1';

  /* 회원 · 비회원 · 모름 세 값 (web/회원여부_읽는_법.md).
     getUser 의 AuthSessionMissingError 만 「비회원」이라는 답이고,
     그 밖의 오류는 못 물어본 것이라 「모름」입니다 */
  const user = 비회원보기 ? null : data?.user ?? null;
  const 모름 = !비회원보기 && !user && !!error && error.name !== 'AuthSessionMissingError';

  if (!user) {
    if (!모름 && 길에있나(path, 비회원길)) return 쿠키싣기(res);
    if (api) return 쿠키싣기(new NextResponse('회원 전용입니다', { status: 401 }));
    /* 모름 — 회원일 수도 있으니 주소는 그대로 두고 안내만 보입니다.
       새로고침하면 다시 물어봅니다 */
    if (모름) return 쿠키싣기(NextResponse.rewrite(new URL('/beta?r=1', req.url)));
    /* ★ 2026-11-11 밤 세중님 — 비회원이 공고·커뮤니티·내 정보 등을 누르면 「테스트 중」(/beta) 대신 **바로 로그인**.
       가려던 주소는 next 로 실어 보내고, 로그인 화면이 돌아올 자리(potjob.after-login)에 적습니다 */
    const to = req.nextUrl.clone();
    to.pathname = '/login';
    to.search = '';
    to.searchParams.set('next', path + req.nextUrl.search);
    return 쿠키싣기(NextResponse.redirect(to));
  }

  /* 로그인은 했는데 **가입을 안 마친** 사람 (카카오만 누르고 멈춘 사람 포함).
     세션만 보고 열면 가입(동의·닉네임) 없이 공고를 다 보게 됩니다 — 그래서 profiles 줄을 봅니다.
     자기 줄은 읽을 수 있습니다 (auth/callback 이 같은 질의를 씁니다) */
  if (!길에있나(path, 가입중길)) {
    const { data: prof, error: profErr } = await sb
      .from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (profErr) {
      if (api) return 쿠키싣기(new NextResponse('잠시 뒤 다시', { status: 503 }));
      return 쿠키싣기(NextResponse.rewrite(new URL('/beta?r=1', req.url)));
    }
    if (!prof) {
      if (api) return 쿠키싣기(new NextResponse('가입을 마쳐 주세요', { status: 401 }));
      const to = req.nextUrl.clone();
      to.pathname = '/welcome';
      to.search = '';
      return 쿠키싣기(NextResponse.redirect(to));
    }
  }

  return 쿠키싣기(res);
}

export const config = {
  matcher: [
    /* 그림·글꼴·파비콘에는 안 걸립니다. 걸어두면 요청마다 헛일을 합니다.
       _next(빌드 산출물) · api(자기 열쇠로 돕니다) · 확장자가 붙은 파일 제외 */
    '/((?!_next/static|_next/image|api/|favicon|icons/|robots\\.txt|site\\.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|css|js)$).*)',
    /* ★ 2026-11-11 — 비회원에게 막는 API 둘은 따로 겁니다 (베타 · 위 막는API) */
    '/api/og/:path*',
    '/api/post-image/:path*',
  ],
};
