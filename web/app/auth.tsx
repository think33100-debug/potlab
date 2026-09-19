'use client';

import type { Session } from '@supabase/supabase-js';
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
};

type Auth = {
  loading: boolean;
  session: Session | null;
  me: Me | null;          // profiles 줄. 가입을 마치기 전에는 null 입니다
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth>({
  loading: true, session: null, me: null,
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

  const loadMe = useCallback(async (s: Session | null) => {
    if (!s) { setMe(null); return; }
    const { data } = await sb
      .from('profiles')
      .select('id,nickname,avatar,job_group,role,nickname_changes')
      .eq('id', s.user.id)
      .maybeSingle();
    setMe((data as Me) ?? null);
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
    if (error || !data.user) {
      await sb.auth.signOut({ scope: 'local' });
      return null;
    }
    return s;
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
    loading, session, me,
    reload: async () => {
      const { data } = await sb.auth.getSession();
      await loadMe(data.session);
    },
    signOut: async () => {
      await sb.auth.signOut();
      setMe(null);
      router.push('/');
    },
  }), [loading, session, me, sb, loadMe, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
