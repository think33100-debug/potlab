'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { JobSave, RapoSaveFace } from '@/components/job-save';
import { RapoBadge, RapoButton, RapoDivider, RapoSectionTitle, RapoSortTabs, RapoStatusPanel, RapoTextAction } from './rapo-ui';

/* RAPO 새 디자인 · 홈의 「채용 공고」 (2026-11-11).
   Figma 원본 — 기본 955:710 · 로딩 955:767 · 없음 955:802 · 오류 955:835.
   한 줄은 「RAPO / Home / 공고 행 · 시간과 마감 중복 제거」 749:2258.
   버튼·탭·배지·제목·구분선은 rapo-ui.tsx 의 공통 조각을 씁니다.

   네 상태를 가릅니다 (요청 실패가 「0건」처럼 보이지 않게) —
     RapoJobsLoading   받는 중 (서버가 줄을 보내기 전 · app/page.tsx 의 Suspense)
     RapoJobList       받았고 줄이 있음 / 받았는데 0건이면 「없음」 안내
     RapoJobsError     못 받음 — 이 칸만 다시 불러옵니다

   정렬 셋은 서버가 차례대로 받아 온 세 줄(lists)을 바꿔 보여 주기만 합니다 —
   최신순 new · 인기순 views(조회수) · 마감순 deadline (lib/rapo-home.ts).
   좋아요는 공고에 아직 없는 기능이라 값이 없으면 그리지 않습니다. */

export type RapoJob = {
  id?: string;               // 없으면 견본 — 저장 단추가 잠기고 줄이 링크가 아닙니다
  org: string;
  orgArt: '01' | '03' | '06'; // 「기관 기본 이미지」 여섯 가운데 원본에 쓰인 셋
  title: string;
  /* 급여 칸 — 값이면 그대로, 원문 확인이면 문서 아이콘과 흐린 글씨. 모르면 줄을 뺍니다 */
  pay?: { text: string; kind: 'value' | 'check' } | null;
  tags: string[];
  likes?: number | null;
  views?: number | null;     // null 이면 조회수를 못 받은 것 — 0 으로 적지 않고 뺍니다
  deadline: string;          // 화면에 쓰는 말 그대로 (lib/job-state.ts 마감배지)
};

export const RAPO_SORTS = [
  { key: 'new',      label: '최신순' },
  { key: 'views',    label: '인기순' },
  { key: 'deadline', label: '마감순' },
] as const;
export type RapoSortKey = (typeof RAPO_SORTS)[number]['key'];
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
  const [sort, setSort] = useState<RapoSortKey>('new');
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
              <RapoJobRow job={j} />
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

/* 못 받았을 때 — 원본 설명 「해당 영역만 재시도하며 다른 영역은 유지」.
   router.refresh() 는 서버 쪽 줄만 다시 받고 화면의 다른 칸(배너 위치 등)은 그대로 둡니다.
   받는 동안 버튼이 로딩 모양으로 잠겨 두 번 눌리지 않습니다. */
export function RapoJobsError() {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Frame sort="new" busy={busy}>
      <RapoStatusPanel
        role="alert"
        icon="error"
        title="공고를 불러오지 못했어요"
        text="잠시 후 다시 시도해 주세요."
        action={
          <RapoButton onClick={() => start(() => router.refresh())} loading={busy} full>
            다시 불러오기
          </RapoButton>
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
    <Frame sort="new" busy>
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

function RapoJobRow({ job }: { job: RapoJob }) {
  const 제목 = (
    <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">{job.title}</span>
  );
  return (
    <article className="flex flex-col gap-(--rapo-dimension-x2)">
      <div className="flex flex-col gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x2)">
        <div className="flex items-center gap-(--rapo-dimension-x2_5)">
          <span className="flex size-(--rapo-dimension-x8) shrink-0 items-center justify-center rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src={`/rapo/home/org-${job.orgArt}.svg`} alt="" width={32} height={32} />
          </span>
          <p className="rapo-type-t4-medium min-w-0 flex-1 truncate text-(color:--rapo-color-fg-neutral-muted)">{job.org}</p>
          {job.id ? <JobSave id={job.id} look="rapo" /> : <RapoSaveFace />}
        </div>

        <h3 className="break-keep">
          {job.id
            ? <Link href={`/jobs/${job.id}`} className="block rounded-(--rapo-radius-r1) active:bg-(--rapo-color-bg-transparent-pressed)">{제목}</Link>
            : 제목}
        </h3>

        {job.pay && (
          <div className="flex items-center gap-(--rapo-dimension-x1_5)">
            {job.pay.kind === 'check' && (
              <span className="flex size-(--rapo-dimension-x4) shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 (16 틀 안 9.4×13.4) */}
                <img src="/rapo/home/icon-doc.svg" alt="" width={9.4} height={13.4} />
              </span>
            )}
            <p className={
              'min-w-0 flex-1 ' + (job.pay.kind === 'check'
                ? 'rapo-type-t4-medium text-(color:--rapo-color-fg-neutral-muted)'
                : 'rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)')
            }>
              {job.pay.text}
            </p>
          </div>
        )}

        {job.tags.length > 0 && (
          <ul aria-label="조건" className="flex flex-wrap gap-(--rapo-dimension-x2)">
            {job.tags.map((t) => <li key={t} className="flex"><RapoBadge>{t}</RapoBadge></li>)}
          </ul>
        )}
      </div>

      {/* 좋아요·조회 13/20 Medium · 마감 12/20 Regular — 원본에 글자 스타일이 없는 값입니다(원본확인 B) */}
      <div className="flex min-h-(--rapo-dimension-x6) items-center justify-between gap-(--rapo-dimension-x3)">
        <div className="flex gap-(--rapo-dimension-x3)">
          {job.likes != null && (
            <span className="flex items-center gap-(--rapo-dimension-x1) text-[13px] font-medium leading-[20px] text-(color:--rapo-color-fg-neutral-muted)">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src="/rapo/home/icon-heart.svg" alt="" width={16} height={16} />
              좋아요 {job.likes}
            </span>
          )}
          {job.views != null && (
            <span className="flex items-center gap-(--rapo-dimension-x1) text-[13px] font-medium leading-[20px] text-(color:--rapo-color-fg-neutral-muted)">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src="/rapo/home/icon-eye.svg" alt="" width={16} height={16} />
              조회 {job.views}
            </span>
          )}
        </div>
        <p className="whitespace-nowrap text-[12px] leading-[20px] text-(color:--rapo-color-fg-neutral-muted)">{job.deadline}</p>
      </div>
    </article>
  );
}
