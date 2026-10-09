'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 탑바의 알림 종 (2026-10-09).
   안 읽은 것이 있을 때만 숫자가 붙습니다. 0 이면 종만 보입니다 —
   늘 「0」 이 떠 있으면 눈이 그 자리를 안 봅니다.

   ── 아직 관리자에게만 보입니다 ───────────────────────────────
   알림함은 오늘 만든 기능이고, 새 기능은 관리자·마스터에게만 보이게
   숨겨서 배포합니다. /alarm 쪽도 같은 기준으로 막혀 있습니다.
   여기서 마스터인가() 를 따로 묻지 않는 까닭 — 종은 **모든 화면의 탑바**에
   있어서, 묻는 순간 회원 한 명이 화면을 옮길 때마다 창구를 한 번씩 더
   두드립니다. 마스터는 「관리자」 페르소나일 때 보입니다. */
export function AlarmBell() {
  const { session, me, isAdmin } = useAuth();
  const [안읽음, set안읽음] = useState(0);

  useEffect(() => {
    if (!session || !me || !isAdmin) return;
    let 살아있나 = true;
    browserSupabase().rpc('안읽은알림').then(({ data, error }) => {
      if (!살아있나 || error) return;
      set안읽음(Number(data ?? 0));
    });
    return () => { 살아있나 = false; };
  }, [session, me, isAdmin]);

  if (!session || !me || !isAdmin) return null;

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
