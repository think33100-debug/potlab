'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CompareNotify } from '@/components/compare-notify';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { JOB_GROUPS, type JobGroup } from '@/lib/who';
import { useAuth } from '../../auth';

/* 내 정보의 아직 기능이 없는 메뉴 — 「아직 비어 있어요」 (2026-11-11 밤 · 2026-11-12 밤 근무에 피그마 틀을 입힘).
   화면 틀(제목 · 칸 이름)은 피그마대로 두고, 값이 들어갈 자리는 **빈 칸**으로 둡니다 — 지어낸 숫자를 넣지 않습니다.
     paycmp  피그마 「D · 급여 비교」(09 · D 급여 비교)        spec  피그마 「E · 입사 스펙 비교 홈」(10 · E)
     pay     피그마 「PAY · 급여 불러오기」(11 · PAY)           그 밖  12 · 내 정보의 해당 화면
   급여·스펙(pay · paycmp · spec)은 연봉 비교 알림 신청 창(compare-notify)으로 이어집니다 —
   공고 목록 급여 「알림 신청」과 같은 창 · 같은 표(비교알림신청) */
type 꼴 = { 제목: string; 머리?: string; 큰글: string; 설명: string; 칸?: string[]; 알림?: boolean };
const 메뉴: Record<string, 꼴> = {
  pay: {
    제목: '내 급여', 머리: '세전 연 소득', 큰글: '내 급여를 불러와\n한눈에 확인해요',
    설명: '내 급여를 등록하고 같은 직군·연차와 비교하는 기능을 준비하고 있어요.', 칸: ['내 급여', '급여 등록 방법'], 알림: true,
  },
  paycmp: {
    제목: '급여 비교', 머리: '세전 연 소득', 큰글: '내 연봉은 동료들 사이\n어디쯤일까요?',
    설명: '같은 직군·연차·지역 치료사들의 연봉과 내 연봉을 비교해 드려요.',
    칸: ['같은 조건의 동료', '동료 평균과 얼마나 차이 날까요?', '기관 유형별로는 얼마나 받을까요?'], 알림: true,
  },
  spec: {
    제목: '입사 스펙 비교', 큰글: '입사자와 나,\n차이를 바로 확인해요',
    설명: '관심 병원 하나만 검색하면 나의 강점과 다음 준비가 보여요.',
    칸: ['내 스펙, 어디까지 준비됐을까?', '입사자 보유 자격증 TOP 3', '어떤 교육을 듣고 입사했을까요?'], 알림: true,
  },
  hosp:   { 제목: '관심 병원', 큰글: '저장한 병원', 설명: '저장한 병원을 모아 보는 화면이에요.' },
  pref:   { 제목: '희망 취업 조건', 큰글: '어떤 곳에서\n일하고 싶으세요?', 설명: '원하는 기관 유형·지역을 정해 두면 맞는 공고를 먼저 보여 드릴 거예요.', 칸: ['희망 기관 유형', '희망 지역'] },
  edu:    { 제목: '내 교육 관리', 큰글: '신청한 교육', 설명: '신청한 교육과 회차를 한곳에서 보는 기능을 준비하고 있어요.', 칸: ['신청한 교육', '지난 교육'] },
  status: { 제목: '이용 상태 · 학적 정보', 큰글: '이용 상태', 설명: '무료 이용 기간과 학적 정보를 확인·수정하는 기능을 준비하고 있어요.', 칸: ['현재 이용 상태', '학적 정보'] },
  report: { 제목: '신고 센터', 큰글: '신고 내역', 설명: '신고한 글·댓글의 처리 결과를 보는 기능을 준비하고 있어요. 지금은 글마다 신고할 수 있어요.', 칸: ['처리 중', '처리 완료'] },
};

export default function MySoon() {
  return <Suspense><Soon /></Suspense>;
}

function Soon() {
  const k = useSearchParams().get('k') ?? '';
  const m: 꼴 = 메뉴[k] ?? { 제목: '준비 중', 큰글: '곧 열려요', 설명: '아직 비어 있는 화면이에요.' };
  const { session, me } = useAuth();
  const [창, set창] = useState(false);
  return (
    <RapoMeFrame title={m.제목}>
      {() => (
        <div className="flex flex-col gap-(--rapo-dimension-x6) pt-(--rapo-dimension-x4)">
          {/* 머리 — 피그마의 연한 판 위 큰 제목 */}
          <div className="-mx-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x6) py-(--rapo-dimension-x5)">
            {m.머리 && <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{m.머리}</p>}
            <h2 className="rapo-type-t9-bold whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral)">{m.큰글}</h2>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{m.설명}</p>
          </div>

          {/* 칸 — 이름은 피그마대로, 값 자리는 비워 둡니다 */}
          {(m.칸 ?? []).map((t) => (
            <section key={t} className="flex flex-col gap-(--rapo-dimension-x3)">
              <h3 className="rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)">{t}</h3>
              <p className="rapo-type-t4-regular rounded-(--rapo-radius-r3) border border-dashed border-(--rapo-color-stroke-neutral-weak) p-(--rapo-dimension-x5)
                            text-center text-(color:--rapo-color-fg-neutral-muted)">
                아직 비어 있어요
              </p>
            </section>
          ))}

          <div className="flex flex-col gap-(--rapo-dimension-x3)">
            <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">아직 오픈 전 기능이에요!</p>
            {m.알림 && (
              <>
                <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral-muted)">오픈 알림을 받고 싶다면 알림 신청을 눌러주세요.</p>
                <RapoButton onClick={() => set창(true)} tone="deep-coral" full>알림 신청</RapoButton>
              </>
            )}
          </div>

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
