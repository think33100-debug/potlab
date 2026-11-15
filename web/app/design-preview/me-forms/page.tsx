'use client';

import type { Session } from '@supabase/supabase-js';
import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthPreview, type Me } from '@/app/auth';
import Career from '@/app/me/career/page';
import Pref from '@/app/me/pref/page';
import Profile from '@/app/me/profile/page';
import Spec from '@/app/me/spec/page';
import { 내스펙미리, type 내스펙 } from '@/components/rapo/rapo-spec-form';
import { toDraft } from '@/lib/signup-fields';

/* 내 정보 입력 화면 미리보기 (2026-11-15) — 개발 서버에서만(배포 404). 견본 스펙(실제 아님)으로 그립니다. 저장은 실패합니다.
     ?p=spec(기본) · career · pref · profile     ?e=학생 이면 학생 견본 */
function Body() {
  const q = useSearchParams();
  const p = q.get('p') ?? 'spec';
  const 학생 = q.get('e') === '학생';
  const spec = 학생
    ? { school_type: '4년제 대학', gpa: 3.8, gpa_scale: 4.5, licenses: ['없음'], trainings: [], practice: [], want_type: '대학병원', want_region: '서울', 근무경험: false, 학교: null }
    : { school_type: '전문대학', gpa: 3.5, gpa_scale: 4.5, licenses: [], trainings: [], practice: [], want_type: '재활병원', want_region: '경기', 근무경험: true, 근무병원: '견본재활병원', 입사연도: 2024 };
  const 견본: 내스펙 = { spec, draft: toDraft(null, spec, []), 남은: 2 };
  const me: Me = { id: 'preview', nickname: '차분한 수달', avatar: 'a/otter|#BBF7D0', job_group: '작업치료사', role: 학생 ? '학생' : '현직', nickname_changes: 1, survey_at: '2026-11-01' };
  const session = { user: { id: 'preview-me', email: null } } as unknown as Session;
  const 화면 = p === 'career' ? <Career /> : p === 'pref' ? <Pref /> : p === 'profile' ? <Profile /> : <Spec />;
  return <AuthPreview value={{ session, me, reload: async () => {} }}><내스펙미리.Provider value={견본}>{화면}</내스펙미리.Provider></AuthPreview>;
}

export default function DesignPreviewMeForms() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
