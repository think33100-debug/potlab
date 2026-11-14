'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SignupSurvey } from '@/components/signup-survey';
import type { Role } from '@/lib/who';

/* 가입 5단계 「직접 입력하기」(급여·스펙) 미리보기 (2026-11-14) — 개발 서버에서만(배포 404).
     ?r=학생(기본) · 현직   ?j=작업치료사(기본) · 물리치료사
   저장은 안 됩니다(개발 서버는 DB 가 없습니다) — 칸과 줄바꿈을 보는 자리입니다 */
function Body() {
  const q = useSearchParams();
  const role = (q.get('r') ?? '학생') as Role;
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6) pt-(--rapo-dimension-x6)">
        <SignupSurvey userId={`preview-${role}`} job={q.get('j') ?? '작업치료사'} role={role} onDone={() => {}} />
      </main>
    </div>
  );
}

export default function DesignPreviewSurvey() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
