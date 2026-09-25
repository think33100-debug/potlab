import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/* 서버에서 **그 사람으로** 읽는 열쇠꾸러미입니다 (2026-09-25).

   lib/supabase.ts 와 무엇이 다른가 —
     lib/supabase.ts         세션이 없습니다. 누구나 보는 자료만 읽습니다
                             (홈 배너·문구·아이콘 · 카톡 미리보기 그림)
     lib/supabase-server.ts  요청에 실려 온 쿠키를 읽어 **로그인한 사람으로** 읽습니다
     lib/supabase-browser.ts 브라우저에서. 세션을 쿠키에 씁니다

   왜 필요한가 — 공고 목록·병원정보를 회원에게만 주려면 **서버가 누구인지
   알아야 합니다.** 전에는 세션이 localStorage 에만 있어서 서버가 몰랐고,
   그래서 익명으로 읽을 수밖에 없었습니다.

   ※ 이 함수는 요청마다 새로 만듭니다. 하나를 만들어 두고 돌려쓰면
     앞 사람의 쿠키로 뒷사람 화면을 그리게 됩니다. */
export async function serverSupabase(): Promise<SupabaseClient> {
  const jar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        /* 서버 컴포넌트에서는 쿠키를 못 씁니다 (읽기 전용).
           토큰 갱신은 middleware.ts 가 맡습니다 — 여기서는 조용히 넘깁니다.
           try 로 감싸지 않으면 갱신이 필요한 순간 화면이 통째로 500 이 됩니다 */
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* 서버 컴포넌트에서 부른 것입니다. middleware 가 이미 갱신했습니다 */
          }
        },
      },
    },
  );
}

/** 지금 보고 있는 사람의 id. 로그인 안 했으면 null */
export async function serverUserId(): Promise<string | null> {
  const sb = await serverSupabase();
  /* getUser() 는 서버에 물어봅니다. getSession() 은 쿠키에 적힌 것을 믿기만 해서
     남이 만들어 넣은 값도 그대로 통과합니다 — 막는 자리에서는 쓰면 안 됩니다 */
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/* 서버에서 본 로그인 상태. **세 값입니다.**

   회원    로그인한 사람입니다
   비회원  로그인을 안 했습니다 — 물어봤고 아니라는 답을 받았습니다
   모름    물어봤는데 답을 못 받았습니다 (연결 끊김 · 토큰 갱신 실패 등)

   ── 왜 세 값이어야 하나 ─────────────────────────────────────
   전에는 이렇게 썼습니다.

       const { data: who } = await sb.auth.getUser();   // error 를 버림
       if (!who.user) → 가입 권유 카드

   getUser() 가 **실패해도** user 는 null 입니다. 그래서 잠깐 연결이 끊기면
   로그인한 회원에게 「가입하고 전부 보기」 가 떴습니다. 눌러 보면
   「이미 로그인되어 있어요」 — 회원인데 비회원 화면을 본 것입니다 (2026-09-25).

   목록 화면(app/jobs/page.tsx)은 이 함정을 안 밟았습니다. 거기서는
   **DB 가 보낸 42501** 로 가립니다 — 「권한 없음」은 물어봐서 받은 답이지
   못 물어본 것이 아닙니다.

   ── 「모름」 일 때 무엇을 그리나 ─────────────────────────────
   **가입 권유도 회원 자료도 안 그립니다. 자리만 비웁니다.**
   화면 쪽 규칙과 같습니다 (components/org-stat.tsx · job-veil.tsx). */
export type Who = '회원' | '비회원' | '모름';

export async function serverWho(sb: SupabaseClient): Promise<Who> {
  const { data, error } = await sb.auth.getUser();
  if (data?.user) return '회원';
  /* AuthSessionMissingError 는 「쿠키에 세션이 없다」 — 물어본 답입니다.
     그 밖의 오류는 못 물어본 것이라 「모름」 입니다 */
  if (error && error.name !== 'AuthSessionMissingError') return '모름';
  return '비회원';
}
