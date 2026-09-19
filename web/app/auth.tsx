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
      .select('id,nickname,avatar,job_group,nickname_changes')
      .eq('id', s.user.id)
      .maybeSingle();
    setMe((data as Me) ?? null);
  }, [sb]);

  useEffect(() => {
    let alive = true;

    sb.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadMe(data.session);
      if (alive) setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange(async (_e, s) => {
      if (!alive) return;
      setSession(s);
      await loadMe(s);
      setLoading(false);
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [sb, loadMe]);

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
