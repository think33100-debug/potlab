'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import {
  HOT_DAYS, 인기글열쇠, 인기글자리, 인기글줄, 회원인기글읽기, type 인기글값,
} from '@/lib/home-hot';
import { browserSupabase } from '@/lib/supabase-browser';
import { daysAgoIso } from '@/lib/time';

/* 큰 배너 metric='hot' 의 한 줄. 회원에게는 이번 주 인기 글 제목,
   그 밖에는 관리자가 쓴 설명입니다. 설명도 없으면 줄을 안 그립니다 */
export function MemberHotLine({ 설명, className }: { 설명: string | null; className?: string }) {
  const { who, session, me, isAdmin } = useAuth();
  const 열쇠 = 인기글열쇠({
    who, 회원번호: session?.user.id ?? null, 프로필있음: !!me, 관리자: isAdmin,
  });
  const [값, set값] = useState<인기글값>(null);

  useEffect(() => {
    const 자리 = 인기글자리(() => 회원인기글읽기(browserSupabase(), daysAgoIso(HOT_DAYS)), set값);
    자리.바꿈(열쇠);
    return () => 자리.바꿈(null);
  }, [열쇠]);

  const 줄 = 인기글줄(열쇠, 값, 설명);
  return 줄 ? <p className={className}>{줄}</p> : null;
}
