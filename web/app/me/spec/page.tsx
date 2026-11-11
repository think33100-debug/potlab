'use client';

import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { SurveyEdit } from '@/components/survey-edit';
import type { Role } from '@/lib/who';

/* 스펙 확인·수정 — 내 정보 「경력과 스펙」 (2026-11-11 밤). 전 /me 의 「급여 · 스펙」 칸(SurveyEdit) 그대로입니다.
   안쪽 꼴은 아직 옛 모양입니다 — 피그마 「U14-SPEC-*」 화면은 다음 차례 */
export default function MySpec() {
  return (
    <RapoMeFrame title="스펙 확인·수정">
      {(me) => <SurveyEdit profileId={me.id} role={(me.role ?? '현직') as Role} job={me.job_group ?? '작업치료사'} />}
    </RapoMeFrame>
  );
}
