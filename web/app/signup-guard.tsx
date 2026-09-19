'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth';

/* 「급여·스펙은 가입할 때 전부 받는다. 건너뛰기 없어」 — 운영 방침입니다.

   닉네임을 넣는 순간 profiles 줄이 생기므로, 거기서 창을 닫으면
   다음에 들어올 때 가입을 마친 사람처럼 보입니다. 그 구멍을 여기서 막습니다.
   기준은 화면 상태가 아니라 profiles.survey_at 입니다. */
/* /admin 을 열어 두는 이유 — 가입 화면이 망가지면 /admin/reset 으로 계정을 지워
   다시 시작해야 합니다. 여기를 막으면 빠져나갈 길이 없어집니다.
   관리자 화면 자체는 화면이 아니라 DB(is_admin·RLS)가 막습니다 */
const FREE = ['/welcome', '/login', '/terms', '/soon', '/admin'];

export function SignupGuard() {
  const router = useRouter();
  const path = usePathname();
  const { loading, session, me } = useAuth();

  useEffect(() => {
    if (loading || !session || !me || me.survey_at) return;
    if (FREE.some((p) => path === p || path.startsWith(p + '/'))) return;
    router.replace('/welcome');
  }, [loading, session, me, path, router]);

  return null;
}
