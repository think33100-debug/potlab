'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 회원이 「오늘 왔다」고 DB 에 한 줄 남깁니다 (2026-11-18 · 멘토-5-2 · 사업계획서 재방문율).

   화면에는 아무것도 안 그립니다. DB 의 visit_mark() 가 회원·한국 날짜 한 쌍을 넣고,
   이미 있으면 아무 일도 안 합니다 — 담는 것은 그 둘뿐입니다 (IP·브라우저·화면 주소 없음).

   ── 언제 부르나 ───────────────────────────────────────────────
   가입을 마친 회원(me 가 있음)만 · 관리자는 안 부릅니다(DB 도 한 번 더 거릅니다).
   같은 탭에서는 **하루 한 번**만 부릅니다 — sessionStorage 에 「누가·어느 날」을 적어 둡니다.
   탭을 켜 둔 채 날이 바뀌면 탭으로 돌아올 때(visibilitychange) 다시 봅니다.

   실패해도 조용히 넘어갑니다. 숫자보다 화면이 먼저입니다 (components/hit.tsx 와 같은 결). */

const KEY = 'rapo.visit-mark';

function seoulToday(): string {
  /* 한국 날짜 — lib/day-key.ts 와 같은 셈 */
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function VisitMark() {
  const { loading, me, isAdmin } = useAuth();
  const id = me?.id ?? null;

  useEffect(() => {
    if (loading || !id || isAdmin) return;

    /* 한 번 실패하면 이 화면을 새로 열 때까지 다시 안 부릅니다 —
       DB 에 함수가 아직 없을 때(초안을 올리기 전) 탭을 오갈 때마다 두드리지 않게 */
    let 쉼 = false;

    const mark = () => {
      if (쉼 || document.visibilityState === 'hidden') return;
      const 표 = `${id}|${seoulToday()}`;
      try {
        if (sessionStorage.getItem(KEY) === 표) return;
      } catch {
        /* 저장이 막힌 창 — 아래에서 그냥 부릅니다. DB 가 하루 한 줄만 받으니 숫자는 안 늘어납니다 */
      }
      browserSupabase().rpc('visit_mark').then(({ error }) => {
        if (error) { 쉼 = true; return; }   // 조용히 넘어갑니다. 새로고침하면 다시 해 봅니다
        try { sessionStorage.setItem(KEY, 표); } catch { /* 그냥 둡니다 */ }
      }, () => { 쉼 = true; /* 연결 끊김 — 조용히 넘어갑니다 */ });
    };

    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [loading, id, isAdmin]);

  return null;
}
