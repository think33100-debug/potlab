'use client';

import type { Session } from '@supabase/supabase-js';
import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthPreview, type Me } from '@/app/auth';
import Welcome from '@/app/welcome/page';

/* 회원가입 새 흐름 미리보기 (2026-11-15 · 피그마 07 B) — 개발 서버에서만(배포 404).
     ?e=없음(기본) · 있음   ?me=1 이면 가입 줄이 생긴 뒤(④ 학력·학점부터)   ?me=who 면 ② 직군·근무 경험
   개발 서버는 DB 가 없어 「가입하기」·저장은 실패합니다 — 칸과 흐름을 보는 자리입니다 */
function Body() {
  const q = useSearchParams();
  const 있음 = q.get('e') === '있음';
  const 줄 = q.get('me');
  const 닉 = q.get('nick') ?? '차분한 수달';   // ?nick= 로 다른 닉네임(규칙에 어긋난 옛 닉네임 시험)
  const me: Me | null = 줄 === 'who'
    ? { id: 'preview', nickname: '차분한 수달', avatar: null, job_group: null, role: null, nickname_changes: 0, survey_at: null }
    : 줄 === '1'
    ? { id: 'preview', nickname: 닉, avatar: null, job_group: '작업치료사', role: 있음 ? '현직' : '학생', nickname_changes: 0, survey_at: null }
    : null;
  const session = { user: { id: 'preview-signup', email: null } } as unknown as Session;
  return <AuthPreview value={{ session, me }}><Welcome /></AuthPreview>;
}

export default function DesignPreviewSignup() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
