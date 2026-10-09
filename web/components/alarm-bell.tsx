'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 탑바의 알림 종 (2026-10-09).
   안 읽은 것이 있을 때만 숫자가 붙습니다. 0 이면 종만 보입니다 —
   늘 「0」 이 떠 있으면 눈이 그 자리를 안 봅니다. */
export function AlarmBell() {
  const { session, me } = useAuth();
  const [안읽음, set안읽음] = useState(0);

  useEffect(() => {
    if (!session || !me) return;
    let 살아있나 = true;
    browserSupabase().rpc('안읽은알림').then(({ data, error }) => {
      if (!살아있나 || error) return;
      set안읽음(Number(data ?? 0));
    });
    return () => { 살아있나 = false; };
  }, [session, me]);

  if (!session || !me) return null;

  return (
    <Link href="/alarm" aria-label={안읽음 > 0 ? `알림 ${안읽음}개` : '알림'}
      className="relative flex h-9 w-9 items-center justify-center rounded-md
                 hover:bg-gray-50 dark:hover:bg-gray-950">
      <span aria-hidden className="text-[19px] leading-none">🔔</span>
      {안읽음 > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand-red
                         px-1 text-center text-[11px] font-bold leading-[18px] text-white">
          {안읽음 > 99 ? '99+' : 안읽음}
        </span>
      )}
    </Link>
  );
}
