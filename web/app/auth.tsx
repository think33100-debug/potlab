'use client';

import { isAuthApiError, type Session } from '@supabase/supabase-js';
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

type Auth = {
  loading: boolean;
  session: Session | null;
  me: Me | null;          // profiles 줄. 가입을 마치기 전에는 null 입니다
  isAdmin: boolean;       // 단추를 보일지 말지에만 씁니다 — 막는 자리는 DB 입니다
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth>({
  loading: true, session: null, me: null, isAdmin: false,
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

  const loadMe = useCallback(async (s: Session | null) => {
    if (!s) { setMe(null); setIsAdmin(false); return; }

    const [prof, admin] = await Promise.all([
      sb.from('profiles')
        .select('id,nickname,avatar,job_group,role,nickname_changes,survey_at')
        .eq('id', s.user.id).maybeSingle(),
      /* 관리자인지는 DB 에 물어봅니다. 이 값은 단추를 보일지 말지에만 씁니다 —
         진짜로 막는 자리는 RLS 와 칸 단위 권한입니다.
         여기서 true 로 만들어도 서버가 안 해줍니다 */
      sb.rpc('is_admin'),
    ]);

    setMe((prof.data as Me) ?? null);
    setIsAdmin(admin.data === true);
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

  const value = useMemo<Auth>(() => ({
    loading, session, me, isAdmin,
    reload: async () => {
      const { data } = await sb.auth.getSession();
      await loadMe(data.session);
    },
    signOut: async () => {
      await sb.auth.signOut();
      setMe(null);
      router.push('/');
    },
  }), [loading, session, me, isAdmin, sb, loadMe, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
