'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CompareNotify } from '@/components/compare-notify';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { JOB_GROUPS, type JobGroup } from '@/lib/who';
import { useAuth } from '../../auth';

/* 내 정보의 아직 기능이 없는 메뉴 — 「준비 중」 (2026-11-11 밤).
   급여·스펙 비교(pay · paycmp · spec)는 연봉 비교 알림 신청 창(compare-notify)으로 이어집니다 —
   공고 목록 급여 「알림 신청」과 같은 창 · 같은 표(비교알림신청) */
const 메뉴: Record<string, { 제목: string; 설명: string; 알림?: boolean }> = {
  pay:    { 제목: '내 급여', 설명: '내 급여를 등록하고 같은 직군·연차와 비교하는 기능을 준비하고 있어요.', 알림: true },
  paycmp: { 제목: '내 급여 비교', 설명: '같은 직군·연차·지역 치료사들의 연봉과 내 연봉을 비교해 드려요.', 알림: true },
  spec:   { 제목: '입사 스펙 비교', 설명: '합격한 사람들의 입사 당시 스펙과 내 스펙을 비교해 드려요.', 알림: true },
  hosp:   { 제목: '관심 병원', 설명: '저장한 병원을 모아 보고, 새 공고가 올라오면 알려 드리는 기능을 준비하고 있어요.' },
  pref:   { 제목: '희망 취업 조건', 설명: '원하는 기관 유형·지역을 정해 두면 맞는 공고를 먼저 보여 드릴 거예요.' },
  edu:    { 제목: '내 교육 관리', 설명: '신청한 교육과 회차를 한곳에서 보는 기능을 준비하고 있어요.' },
  status: { 제목: '이용 상태 · 학적 정보', 설명: '무료 이용 기간과 학적 정보를 확인·수정하는 기능을 준비하고 있어요.' },
  report: { 제목: '신고 센터', 설명: '신고한 글·댓글의 처리 결과를 보는 기능을 준비하고 있어요. 지금은 글마다 신고할 수 있어요.' },
};

export default function MySoon() {
  return <Suspense><Soon /></Suspense>;
}

function Soon() {
  const k = useSearchParams().get('k') ?? '';
  const m = 메뉴[k] ?? { 제목: '준비 중', 설명: '곧 열려요.' };
  const { session, me } = useAuth();
  const [창, set창] = useState(false);
  return (
    <RapoMeFrame title={m.제목}>
      {() => (
        <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x8)">
          <p className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">아직 오픈 전 기능이에요!</p>
          <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{m.설명}</p>
          {m.알림 && (
            <>
              <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">오픈 알림을 받고 싶다면 알림 신청을 눌러주세요.</p>
              <RapoButton onClick={() => set창(true)} full>알림 신청</RapoButton>
            </>
          )}
          {창 && session && (
            <CompareNotify userId={session.user.id}
              job={(JOB_GROUPS as readonly string[]).includes(me?.job_group ?? '') ? (me!.job_group as JobGroup) : null}
              email={session.user.email ?? null} onDone={() => set창(false)} />
          )}
        </div>
      )}
    </RapoMeFrame>
  );
}
