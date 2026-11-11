'use client';

import { useState, type ReactNode } from 'react';
import { RapoRetryButton } from './rapo-retry';
import { RapoJobRow, type RapoJob } from './rapo-job-row';
import { RapoButton, RapoDivider, RapoSectionTitle, RapoSortTabs, RapoStatusPanel, RapoTextAction } from './rapo-ui';
import { 공고정렬들, 기본정렬, type 공고정렬 } from '@/lib/rapo-job-options';

/* RAPO 새 디자인 · 홈의 「채용 공고」 (2026-11-11).
   Figma 원본 — 기본 955:710 · 로딩 955:767 · 없음 955:802 · 오류 955:835.
   한 줄은 「RAPO / Home / 공고 행 · 시간과 마감 중복 제거」 749:2258.
   버튼·탭·배지·제목·구분선은 rapo-ui.tsx 의 공통 조각을 씁니다.

   네 상태를 가릅니다 (요청 실패가 「0건」처럼 보이지 않게) —
     RapoJobsLoading   받는 중 (서버가 줄을 보내기 전 · app/page.tsx 의 Suspense)
     RapoJobList       받았고 줄이 있음 / 받았는데 0건이면 「없음」 안내
     RapoJobsError     못 받음 — 이 칸만 다시 불러옵니다

   정렬 셋은 서버가 차례대로 받아 온 세 줄(lists)을 바꿔 보여 주기만 합니다 —
   인기순 views(조회수 · 기본) · 최신순 new · 마감 임박순 deadline (lib/rapo-job-options.ts · lib/rapo-home.ts).
   좋아요는 공고에 아직 없는 기능이라 값이 없으면 그리지 않습니다. */

export type { RapoJob } from './rapo-job-row';

export const RAPO_SORTS = 공고정렬들;
export type RapoSortKey = 공고정렬;
export type RapoJobLists = Record<RapoSortKey, RapoJob[]>;

/* 제목 줄 + 정렬 탭 — 네 상태가 같은 틀을 씁니다. onSort 가 없으면 탭이 눌리지 않습니다 */
function Frame({ sort, onSort, busy, children }: {
  sort: RapoSortKey; onSort?: (k: RapoSortKey) => void; busy?: boolean; children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="rapo-home-jobs"
      aria-busy={busy || undefined}
      className="flex flex-col gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default)
                 px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)"
    >
      <div className="flex items-center gap-(--rapo-dimension-x2)">
        <RapoSectionTitle id="rapo-home-jobs" tone="neutral" className="min-w-0 flex-1">채용 공고</RapoSectionTitle>
        {/* 지금 고른 정렬 그대로 목록으로 갑니다 */}
        <RapoTextAction href={`/jobs?sort=${sort}`} variant="more" srHint="채용 공고 전체">더 보기</RapoTextAction>
      </div>
      <RapoSortTabs label="공고 정렬" items={RAPO_SORTS} value={sort} onChange={onSort} />
      {children}
    </section>
  );
}

export function RapoJobList({ lists }: { lists: RapoJobLists }) {
  const [sort, setSort] = useState<RapoSortKey>(기본정렬);
  const shown = lists[sort];

  return (
    <Frame sort={sort} onSort={setSort}>
      {shown.length === 0 ? (
        <RapoStatusPanel
          role="status"
          icon="jobs"
          title="지금 보여드릴 공고가 없어요"
          text="전체 공고에서 다른 일자리를 찾아보세요."
          action={<RapoButton href="/jobs" full>공고 전체 보기</RapoButton>}
        />
      ) : (
        <ul className="flex flex-col gap-(--rapo-dimension-x3)">
          {shown.map((j, i) => (
            <li key={j.id ?? `${j.org}-${j.title}`} className="flex flex-col gap-(--rapo-dimension-x3)">
              {i > 0 && <RapoDivider />}
              <RapoJobRow job={j} variant="home" />
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

/* 비회원 — 테스트 동안 공고는 회원만 봅니다 (2026-11-11 클로즈드 베타 · 공개공고() 가 비회원에게 닫힘).
   홈은 비회원에게도 열고(대표 11/11 밤), 이 칸만 가입 안내로 바꿉니다. 꼴은 오류·없음과 같은 RapoStatusPanel */
export function RapoJobsGuest() {
  return (
    <Frame sort={기본정렬}>
      <RapoStatusPanel
        icon="jobs"
        title="공고는 회원만 볼 수 있어요"
        text="지금은 테스트 기간이라 가입한 분께만 보여 드려요. 가입은 1분이면 끝나요."
        action={<RapoButton href="/login" full>로그인하고 공고 보기</RapoButton>}
      />
    </Frame>
  );
}

/* 못 받았을 때 — 원본 설명 「해당 영역만 재시도하며 다른 영역은 유지」 (rapo-retry.tsx) */
export function RapoJobsError() {
  return (
    <Frame sort={기본정렬}>
      <RapoStatusPanel
        role="alert"
        icon="error"
        title="공고를 불러오지 못했어요"
        text="잠시 후 다시 시도해 주세요."
        action={
<RapoRetryButton>다시 불러오기</RapoRetryButton>
        }
      />
    </Frame>
  );
}

/* 받는 중 — 「RAPO / Home / 공고 로딩 / 최신 4행」 954:1078 (정적 스켈레톤 · 실제 값 미표시).
   한 줄 190px 안의 블록 자리·크기는 원본 그대로입니다. 블록 색 #F6F8F9 는 원본이
   Archive surface/subtle 에 묶여 있고 현행에 같은 값이 없어 값 그대로 둡니다(원본확인 A-3). */
const 뼈대 = [
  'left-0 top-0 size-[32px]',
  'left-[44px] top-[7px] h-[14px] w-[104px]',
  'left-0 top-[44px] h-[20px] w-[252px]',
  'left-0 top-[80px] h-[16px] w-[148px]',
  'left-0 top-[108px] h-[24px] w-[70px]',
  'left-[78px] top-[108px] h-[24px] w-[132px]',
  'left-0 top-[154px] h-[16px] w-[104px]',
];

export function RapoJobsLoading() {
  return (
    <Frame sort={기본정렬} busy>
      <p className="sr-only" role="status">공고를 불러오는 중이에요</p>
      <ul aria-hidden className="flex flex-col">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            {i > 0 && <hr className="mb-(--rapo-dimension-x3) h-(--rapo-border-default) border-0 bg-(--rapo-brand-color-line)" />}
            <div className="relative h-[190px] max-w-full overflow-hidden">
              {뼈대.map((c) => <span key={c} className={`absolute rounded-(--rapo-radius-r1) bg-[#F6F8F9] ${c}`} />)}
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
