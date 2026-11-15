'use client';

import type { Session } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { AuthPreview, type Me } from '@/app/auth';
import Convert from '@/app/me/convert/page';

/* 임상가 전환 미리보기 (2026-11-15) — 개발 서버에서만(배포 404).
   개발 서버는 DB 가 없어 가입 때 스펙이 비어 있고 저장은 실패합니다 — 칸과 흐름을 보는 자리입니다 */
export default function DesignPreviewConvert() {
  if (process.env.NODE_ENV === 'production') notFound();
  const me: Me = { id: 'preview', nickname: '차분한 수달', avatar: null, job_group: '작업치료사', role: '학생', nickname_changes: 0, survey_at: '2026-11-01' };
  const session = { user: { id: 'preview-convert', email: null } } as unknown as Session;
  return <AuthPreview value={{ session, me, reload: async () => {} }}><Convert /></AuthPreview>;
}
