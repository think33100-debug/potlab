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
