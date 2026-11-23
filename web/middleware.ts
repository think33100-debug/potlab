import { createServerClient, DEFAULT_COOKIE_OPTIONS } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { 가입중길, 길에있나, 비회원길 } from '@/lib/beta';
import { GUEST_COOKIE } from '@/lib/guest-view';
import { 굽기표, 굽는길, 로그인쿠키인가, 쿠키지문 } from '@/lib/keep-login';
import { 색인되나 } from '@/lib/seo';
import { 대표주소, 옛주소호스트 } from '@/lib/site-url';

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
   나머지 API(hit · build · biz · apple-revoke · diag-who)는 예전처럼 안 거칩니다.
   ★ 2026-11-12 세중님 「공유하기 하면 누구든 그 공고를 볼 수 있어야」 — 공고 미리보기 그림(/api/og/job/…)은 엽니다.
     카톡이 링크 미리보기를 만들 때 비회원으로 그림을 받아 가기 때문입니다 (아래 공유공고길) */
const 막는API = ['/api/og', '/api/post-image'];
/* 공유받은 공고 — 공고 하나(/jobs/<번호>)와 그 미리보기 그림은 비회원에게도 엽니다 (2026-11-12 세중님).
   비회원에게 무엇이 나가는지는 DB 창구 job_one 이 정합니다 — 원문 주소·지원 자격·급여는 안 나갑니다(10월 규칙 그대로) */
const 공유공고길 = (p: string) => /^\/jobs\/[^/]+$/.test(p) || /^\/api\/og\/job\/[^/]+$/.test(p)
  /* ★ 2026-11-12 밤 — 기본 미리보기 그림(홈·가입 링크·커뮤니티 글)도 카톡 로봇이 받아 가야 합니다. 브랜드 글뿐입니다 */
  || p === '/api/og/site';

/* 비회원에게 **맛보기**로 여는 첫 화면 (딱 그 주소만) — 공고 목록(11/12) · 커뮤니티 · 교육·학술 · 병원 찾기(11/13) */
const 맛보기길 = ['/jobs', '/community', '/edu', '/orgs'];

/* 검색엔진 색인을 막습니다 (테스트 동안).
   ★ 2026-11-13 세중님 「검색 가능하게」 — 비회원도 보는 쪽(홈·공고 목록·문의·약관)만 대표 주소에서 엽니다.
   그 목록은 lib/seo.ts 한 자리입니다 */
const 색인막기 = 'noindex, nofollow';

export async function middleware(req: NextRequest) {
  /* 디자인 견본(/design-preview)은 **개발 서버에서만** 문을 지나갑니다 (2026-11-11).
     그 화면들은 배포에서 스스로 404 이고(각 page.tsx 의 NODE_ENV 검사), 배포에서는 이 줄이 아예 안 돕니다.
     비회원길(lib/beta.ts)에 넣지 않은 까닭 — 거기 넣으면 배포에서도 비회원에게 열립니다 */
  if (process.env.NODE_ENV !== 'production' && req.nextUrl.pathname.startsWith('/design-preview')) {
    return NextResponse.next({ request: req });
  }

  /* ★ 2026-11-22 — 「카카오 로그인을 계속 다시 하라고 한다」 (아이폰 사파리 회원 제보).
     로그인 서버(Supabase)의 「돌아와도 되는 주소」 목록에 www.rapojob.co.kr 이 없어서,
     www 에서 누른 로그인은 늘 기본 주소(potjob-web.vercel.app/?code=…)로 돌아왔습니다.
     로그인 확인 쪽지(code-verifier)는 www 에만 있으니 거기서는 못 마치고, 회원은 옛 주소에서 한 번 더 눌러
     **옛 주소에만** 로그인됐습니다 → 다음에 rapojob.co.kr 을 열면 또 비회원 (auth.flow_state: www 로 돌아온 줄 0).
     옛 주소 첫 화면에 로그인 값(code·error)을 들고 오면 www 의 돌아오는 자리로 그대로 넘겨 거기서 마칩니다.
     로그인 서버 목록에 www 를 넣으면(세중님 손) 이 줄은 안 걸립니다 — 그래도 남겨 둡니다 */
  const 호스트 = (req.headers.get('host') ?? req.nextUrl.hostname).split(':')[0].toLowerCase();
  if (호스트 === 옛주소호스트 && req.nextUrl.pathname === '/'
      && (req.nextUrl.searchParams.has('code') || req.nextUrl.searchParams.has('error'))) {
    return NextResponse.redirect(`${대표주소}/auth/callback${req.nextUrl.search}`, 307);
  }

  /* ★ 2026-11-23 세중님 「로그인하고 난 뒤 다시 들어가면 처음부터 다시 로그인해야 한다」 — **주소를 하나로.**
     사이트가 옛 주소(potjob-web.vercel.app)로도 그대로 열려서, 로그인이 주소마다 따로였습니다(쿠키는 주소별).
     옛 주소로 들어온 날은 거기서 로그인하고, 공유 링크(늘 www)로 들어온 날은 또 비회원 — 번갈아 들어올 때마다 풀려 보입니다.
     근거(11/23 · 로그인 서버 기록 24시간): 브라우저 요청의 온 곳이 옛 주소인 기기 — 아이폰 12대 · 그 밖 11대 (www 는 30대 · 35대).
     옛 주소로 온 **화면 요청**은 같은 길 그대로 대표 주소로 보냅니다. 한 번은 www 에서 다시 로그인해야 하고, 그 뒤로는 한 곳에만 남습니다.
     안 보내는 것 — /auth/…(옛 주소에서 시작한 로그인이 돌아와 마치는 자리 · 쿠키 굽는 길) · /api/…(자기 열쇠로 도는 자리) · GET·HEAD 가 아닌 요청.
     307(임시)입니다 — 308 은 브라우저가 오래 기억해 되돌리기 어렵습니다. 미리보기 주소(potjob-…-projects.vercel.app)는 그대로 열립니다 */
  if (호스트 === 옛주소호스트 && (req.method === 'GET' || req.method === 'HEAD')
      && !req.nextUrl.pathname.startsWith('/auth/') && !req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.redirect(`${대표주소}${req.nextUrl.pathname}${req.nextUrl.search}`, 307);
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
     빼면 토큰이 안 늘어나고, 한 시간 뒤부터 로그인이 풀립니다.
     ★ 2026-11-12 (세중님 「속도 최적화」) — getUser() → getClaims().
       getClaims 도 안에서 getSession 을 불러 만료된 토큰을 갱신하고 쿠키를 다시 씁니다(위 setAll).
       다른 점은 **로그인 서버에 묻지 않고** 증표 서명을 여기서 확인한다는 것 하나입니다(ES256 · 공개 열쇠 10분 기억).
       화면을 바꿀 때마다 들던 왕복 한 번이 빠집니다. 자세한 것은 lib/supabase-server.ts serverWho */
  const { data, error } = await sb.auth.getClaims();

  /* 다른 응답(돌려보내기·바꿔 보여주기)으로 갈아탈 때 갱신한 쿠키를 같이 싣습니다.
     안 실으면 돌려보낸 화면에서 다시 옛 토큰을 들고 옵니다 */
  const 쿠키싣기 = (r: NextResponse) => {
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    if (!색인되나(req.nextUrl.hostname, path)) r.headers.set('X-Robots-Tag', 색인막기);
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
  const 아이디 = 비회원보기 ? null : ((data?.claims?.sub as string | undefined) ?? null);
  const 모름 = !비회원보기 && !아이디 && !!error && error.name !== 'AuthSessionMissingError';

  /* ★ 2026-11-23 세중님 「사파리 아직도 해결 안 되고 있다」 — 로그인 쿠키를 **서버가 다시 구워 줍니다** (lib/keep-login.ts).
     로그인은 브라우저에서 끝나서 쿠키를 자바스크립트가 씁니다. 사파리는 그런 쿠키를 7일까지만 둡니다(400일로 적어도) —
     서버 응답으로 쓴 쿠키는 안 줄입니다. 그래서 회원이 확인된 요청에서 **같은 값을 한 번 더** 내려보냅니다.
     값이 바뀔 때마다 한 번(로그인 직후 · 토큰 갱신 직후) — 지문이 표(굽기표)와 같으면 안 씁니다.
     빈 값(지워지는 조각)은 건드리지 않습니다 — 건드리면 지운 쿠키가 되살아납니다 */
  if (아이디) {
    const 지금쿠키 = req.cookies.getAll();
    const 지문 = 쿠키지문(지금쿠키);
    if (지문 && req.cookies.get(굽기표)?.value !== 지문) {
      지금쿠키.filter((c) => 로그인쿠키인가(c.name) && c.value)
        .forEach((c) => res.cookies.set(c.name, c.value, DEFAULT_COOKIE_OPTIONS));
      /* 표는 비밀이 아닙니다(값이 바뀌었나만 가리는 8글자) — 화면에서도 읽혀서 「구워졌나」를 눈으로 확인할 수 있습니다 */
      res.cookies.set(굽기표, 지문, DEFAULT_COOKIE_OPTIONS);
    }
  }
  /* 굽는길(/auth/keep)은 화면이 없습니다 — 브라우저가 토큰을 스스로 갱신한 뒤 한 번 부르는 자리(lib/supabase-browser.ts).
     위에서 구운 쿠키만 싣고 204 로 답합니다. 비회원이 불러도 아무것도 안 나갑니다 */
  if (path === 굽는길) {
    const 답 = new NextResponse(null, { status: 204 });
    답.headers.set('Cache-Control', 'private, no-store');
    return 쿠키싣기(답);
  }

  if (!아이디) {
    if (!모름 && 길에있나(path, 비회원길)) return 쿠키싣기(res);
    /* ★ 2026-11-12 밤 세중님 — 공고 **목록**(/jobs 딱 그 주소)만 비회원에게 엽니다: 맛보기 몇 건 + 가입 권유.
       공고 상세(/jobs/<번호>)와 그 밖은 전처럼 로그인으로 갑니다. 비회원길(lib/beta.ts)에 넣지 않은 까닭 —
       거기는 아래 길(/jobs/…)까지 같이 열립니다 */
    /* ★ 2026-11-13 세중님 「커뮤니티·교육·병원 찾기도 채용공고 보여주는 것처럼 · 자세히 보려면 회원가입」 —
       그 셋의 **첫 화면 주소만** 엽니다. 화면은 비회원이면 맛보기(가린 견본 + 가입 권유)만 그립니다
       (components/rapo/rapo-guest-preview.tsx). 아래 길(/community/<방> · /edu/session/… · 글 · /orgs?org= 의 자료)은 그대로 닫힘 */
    if (!모름 && 맛보기길.includes(path)) return 쿠키싣기(res);
    /* ★ 2026-11-12 세중님 — 공유받은 공고 상세와 그 미리보기 그림도 비회원에게 엽니다. 아래 가입 권유로 이어집니다 */
    if (!모름 && 공유공고길(path)) return 쿠키싣기(res);
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
      .from('profiles').select('id').eq('id', 아이디).maybeSingle();
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
       _next(빌드 산출물) · api(자기 열쇠로 돕니다) · 확장자가 붙은 파일 제외
       ★ 2026-11-20 — 오픈소스 라이선스 고지 글 둘(licenses.txt · Pretendard-LICENSE.txt)은 비회원도 읽습니다.
         글꼴 파일(woff)이 열려 있으니 그 라이선스 글도 같이 열려 있어야 합니다. 그 두 파일 이름만 뺍니다 */
    '/((?!_next/static|_next/image|api/|favicon|icons/|robots\\.txt|sitemap\\.xml|site\\.webmanifest|licenses\\.txt|Pretendard-LICENSE\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|css|js)$).*)',
    /* ★ 2026-11-11 — 비회원에게 막는 API 둘은 따로 겁니다 (베타 · 위 막는API) */
    '/api/og/:path*',
    '/api/post-image/:path*',
  ],
};
