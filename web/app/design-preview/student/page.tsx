'use client';

import type { Session } from '@supabase/supabase-js';
import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthPreview, type Me } from '@/app/auth';
import SpecCompare from '@/app/spec/compare/page';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoSpecCompareBody, type 스펙비교값 } from '@/components/rapo/rapo-spec-compare';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoStudentCommunityNotice } from '@/components/rapo/rapo-student-community';

/* 학생·취준생 화면 미리보기 (2026-11-17) — 개발 서버에서만(배포 404).
     ?v=community(기본)  커뮤니티 대신 보이는 「학생인증을 준비하고 있어요」 안내 (알림 받기는 저장 없이 모양만) · &who=pro 면 임상가 안내
     ?v=compare          취업 스펙 비교 (가짜 학생 회원 · 개발 서버는 DB 가 없어 점수는 「불러오지 못했어요」가 뜹니다)
       &s=none|few|open  DB 대신 가짜 값으로 세 모양 — 스펙 없음 · 20명 미만 · 20명 이상(상위 %) (2026-11-26) */
const 가짜비교: Record<string, 스펙비교값> = {
  none: { 있음: false, 점수: null, 사람: 0, 최소: 20, 상위: null },
  few: { 있음: true, 점수: 72, 사람: 7, 최소: 20, 상위: null },
  open: { 있음: true, 점수: 81, 사람: 34, 최소: 20, 상위: 18 },
};
function Body() {
  const q = useSearchParams();
  const v = q.get('v');
  if (v === 'compare') {
    const me: Me = { id: 'preview', nickname: '차분한 수달', avatar: null, job_group: '작업치료사', role: '학생', nickname_changes: 0, survey_at: '2026-11-17T00:00:00Z' };
    const session = { user: { id: 'preview-student', email: null } } as unknown as Session;
    const 가짜 = 가짜비교[q.get('s') ?? ''];
    return (
      <AuthPreview value={{ session, me }}>
        {가짜
          ? <RapoMeFrame title="취업 스펙 비교" back="/toolkit">{() => <RapoSpecCompareBody v={가짜} 못읽음={false} />}</RapoMeFrame>
          : <SpecCompare />}
      </AuthPreview>
    );
  }
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoStudentCommunityNotice 견본 견본갈래={q.get('who') === 'pro' ? '임상가커뮤니티' : '학생커뮤니티'} />
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/community" />
    </div>
  );
}

export default function DesignPreviewStudent() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
