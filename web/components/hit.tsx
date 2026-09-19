'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/auth';
import { dayKey } from '@/lib/day-key';

/* 이 화면을 한 번 봤다고 알립니다.

   화면마다 하나씩 놓습니다. 같은 화면을 새로고침하면 또 셉니다 —
   「조회 수」는 그게 맞고, 「방문 수」는 하루번호로 세니 안 늘어납니다.

   알림이 실패해도 화면은 아무 일 없습니다. 숫자보다 화면이 먼저입니다. */
export function Hit({
  kind, target,
}: {
  kind: 'home' | 'jobs' | 'job' | 'community' | 'post' | 'other';
  target?: string | number | null;
}) {
  const { loading, isAdmin } = useAuth();

  useEffect(() => {
    /* 관리자인지 알아야 숫자에서 뺄 수 있습니다. 알 때까지 기다립니다 */
    if (loading) return;

    const body = JSON.stringify({
      kind,
      target: target == null ? null : String(target),
      key: dayKey(),
      admin: isAdmin,
    });

    fetch('/api/hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* 조용히 넘어갑니다 */
    });
  }, [kind, target, loading, isAdmin]);

  return null;
}
