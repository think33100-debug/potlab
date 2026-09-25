'use client';

import { isAuthApiError, type Session } from '@supabase/supabase-js';
/* 값이 아니라 **모양**만 가져옵니다 (import type 은 지워집니다).
   서버와 화면이 같은 세 값을 써야 맞춰볼 수 있습니다 — 이름표를 두 벌 만들지 않습니다 */
import type { Who } from '@/lib/supabase-server';
import { useRouter } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

export type Me = {
  id: string;
  nickname: string;
  avatar: string | null;
  job_group: string | null;
  role: string | null;
  nickname_changes: number;
  /* 급여·스펙을 마친 시각. 비어 있으면 가입이 아직 안 끝났습니다 */
  survey_at: string | null;
};

/* 가입 설문을 마쳤나. **세 값입니다** (2026-09-25).

   마침    profiles.survey_at 이 찍혀 있습니다
   안마침  줄을 읽어냈는데 survey_at 이 비어 있습니다 — 가입하다 만 분입니다
   모름    **profiles 를 못 읽었습니다.** 마쳤는지 안 마쳤는지 모릅니다

   왜 세 값인가 — 전에는 `!!me?.survey_at` 한 줄이었습니다. profiles 읽기가
   실패해도 me 가 null 이라, 「못 읽음」이 「안 마침」과 똑같이 보였습니다.
   그래서 가입을 마친 회원에게 「가입하고 전부 보기」 가 떴습니다.
   serverWho 가 서버에서 막은 그 함정이 브라우저에 그대로 남아 있었습니다. */
export type 설문상태 = '마침' | '안마침' | '모름';

type Auth = {
  loading: boolean;
  session: Session | null;
  me: Me | null;          // profiles 줄. 가입을 마치기 전에는 null 입니다
  isAdmin: boolean;       // 단추를 보일지 말지에만 씁니다 — 막는 자리는 DB 입니다
  /* 로그인했나. **lib/supabase-server.ts 의 serverWho 와 같은 세 값·같은 뜻입니다.**
     서버와 화면이 다른 말을 쓰면 맞춰볼 수가 없습니다 */
  who: Who;
  설문: 설문상태;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth>({
  loading: true, session: null, me: null, isAdmin: false,
  who: '모름', 설문: '모름',
  reload: async () => {}, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

/* 로그인은 됐지만 profiles 줄이 아직 없는 상태가 「가입 진행 중」입니다.
   줄은 닉네임을 정하는 칸에서 만듭니다 — nickname 이 NOT NULL 이라
   그 전에는 만들 수가 없습니다. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const sb = browserSupabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  /* profiles 를 읽어냈나. false 면 「모름」입니다 — 「가입 안 함」이 아닙니다 */
  const [meOk, setMeOk] = useState(true);

  const loadMe = useCallback(async (s: Session | null) => {
    if (!s) { setMe(null); setMeOk(true); setIsAdmin(false); return; }

    const [prof, admin] = await Promise.all([
      sb.from('profiles')
        .select('id,nickname,avatar,job_group,role,nickname_changes,survey_at')
        .eq('id', s.user.id).maybeSingle(),
      /* 관리자인지는 DB 에 물어봅니다. 이 값은 단추를 보일지 말지에만 씁니다 —
         진짜로 막는 자리는 RLS 와 칸 단위 권한입니다.
         여기서 true 로 만들어도 서버가 안 해줍니다 */
      sb.rpc('is_admin'),
    ]);

    /* **오류와 「줄이 없음」은 다릅니다** (2026-09-25).

         prof.error 가 있다   못 읽었습니다 → 모름. 가입 안 한 사람 취급하면 안 됩니다
         error 없이 data null  maybeSingle() 이 「그런 줄 없다」고 답한 것입니다 →
                               정말 가입 전입니다

       전에는 `setMe(prof.data ?? null)` 한 줄이라 둘이 똑같이 보였습니다.
       그래서 profiles 를 한 번 못 읽으면 회원이 「가입 안 한 사람」이 됐고,
       흐림·댓글·상단바가 전부 그 말을 따라갔습니다. */
    setMeOk(!prof.error);
    setMe(prof.error ? null : ((prof.data as Me) ?? null));

    /* 관리자는 못 읽으면 아닌 쪽으로 둡니다 — 단추를 보일지 말지에만 쓰고,
       진짜로 막는 자리는 RLS 라 여기서 틀려도 뚫리지 않습니다 */
    setIsAdmin(!admin.error && admin.data === true);
  }, [sb]);

  /* getSession() 은 브라우저에 저장된 것을 읽기만 하고 서버에 물어보지 않습니다.
     그래서 지워진 계정의 토큰도 만료(약 1시간) 전까지는 멀쩡해 보입니다.
     그 상태로 글이나 프로필을 쓰면 「profiles_id_fkey 위반」 같은 영문 오류를 만납니다
     (2026-09-19 실제로 났습니다 — 01:23~01:24).

     그래서 여기서 한 번 서버에 물어봅니다. 없는 사람이면 조용히 내보냅니다.
     쓰는 화면마다 따로 막지 않고 여기 한 곳에서 막습니다. */
  const verify = useCallback(async (s: Session | null): Promise<Session | null> => {
    if (!s) return null;
    const { data, error } = await sb.auth.getUser();
    if (data.user) return s;

    /* 여기서부터가 2026-09-25 에 고친 자리입니다.

       전에는 **오류가 나기만 하면 로그아웃**시켰습니다.
         if (error || !data.user) { await sb.auth.signOut({ scope: 'local' }); }

       그런데 오류에는 두 가지가 섞여 있습니다.
         답을 받았다  서버가 「그런 사람 없다」고 답했습니다 → 내보내는 게 맞습니다
         답을 못 받았다 연결이 끊겼습니다 → **모름입니다. 내보내면 안 됩니다**

       둘을 안 가르는 바람에, 지하철에서 잠깐 끊긴 것만으로 로그인이 풀렸습니다.
       그러면 쿠키가 지워지고, 서버는 다음 새로고침에서 정직하게 「비회원」이라고
       답합니다 — 서버 쪽을 아무리 고쳐도 소용이 없는 상태가 됩니다.

       지금은 **답을 받았을 때만** 내보냅니다. 못 받았으면 가진 것을 그대로 씁니다. */
    if (error && !isAuthApiError(error)) return s;   // 답을 못 받음 → 모름 → 그대로 둠

    await sb.auth.signOut({ scope: 'local' });
    return null;
  }, [sb]);

  useEffect(() => {
    let alive = true;

    sb.auth.getSession().then(async ({ data }) => {
      const ok = await verify(data.session);
      if (!alive) return;
      setSession(ok);
      await loadMe(ok);
      if (alive) setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange(async (e, s) => {
      if (!alive) return;
      /* 로그아웃·토큰 갱신 때는 다시 물어볼 필요가 없습니다 */
      const ok = e === 'SIGNED_OUT' ? null : await verify(s);
      if (!alive) return;
      setSession(ok);
      await loadMe(ok);
      setLoading(false);
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [sb, loadMe, verify]);

  /* 확인 중에는 둘 다 「모름」입니다 — 0.2초 사이에 비회원으로 그리면 안 됩니다 */
  const who: Who = loading ? '모름' : session ? '회원' : '비회원';
  const 설문: 설문상태 = loading || !meOk ? '모름'
                        : me?.survey_at ? '마침' : '안마침';

  const value = useMemo<Auth>(() => ({
    loading, session, me, isAdmin, who, 설문,
    reload: async () => {
      const { data } = await sb.auth.getSession();
      await loadMe(data.session);
    },
    signOut: async () => {
      await sb.auth.signOut();
      setMe(null);
      router.push('/');
    },
  }), [loading, session, me, isAdmin, who, 설문, sb, loadMe, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
