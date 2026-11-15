'use client';

import type { Session } from '@supabase/supabase-js';
import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthPreview } from '@/app/auth';
import LeavePage from '@/app/me/leave/page';
import { RapoLeaveDone } from '@/components/rapo/rapo-leave';

/* 회원 탈퇴 미리보기 (2026-11-15) — 개발 서버에서만(배포 404).  ?s=끝 이면 탈퇴 완료 화면
   개발 서버는 DB 가 없어 「탈퇴하기」는 실패합니다 — 칸과 문구를 보는 자리입니다 */
function Body() {
  const 끝 = useSearchParams().get('s') === '끝';
  if (끝) return <RapoLeaveDone onHome={() => {}} />;
  const session = { user: { id: 'preview-leave', email: null }, access_token: 'x' } as unknown as Session;
  return <AuthPreview value={{ session }}><LeavePage /></AuthPreview>;
}

export default function DesignPreviewLeave() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
