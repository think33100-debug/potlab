'use client';

import Link from 'next/link';
import { useState } from 'react';
import { JobSave, RapoSaveFace } from '@/components/job-save';

/* RAPO 새 디자인 · 홈의 「채용 공고」 (2026-11-11).
   Figma 「06 채용 공고」 956:17862 → 원본 「RAPO / Home / 채용 공고 / 기본」 955:710.
   한 줄은 「RAPO / Home / 공고 행 · 시간과 마감 중복 제거」 749:2258,
   조건 태그는 「RAPO / Badge · 용도=정보」 453:3335 (읽기용 · 누르지 않음),
   좋아요·조회는 「RAPO / Home / 공고 좋아요·조회수」.

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
  views?: number | null;
  deadline: string;          // 화면에 쓰는 말 그대로 (lib/job-state.ts 마감배지)
};

export const RAPO_SORTS = [
  { key: 'new',      label: '최신순' },
  { key: 'views',    label: '인기순' },
  { key: 'deadline', label: '마감순' },
] as const;
export type RapoSortKey = (typeof RAPO_SORTS)[number]['key'];
export type RapoJobLists = Record<RapoSortKey, RapoJob[]>;

export function RapoJobList({ lists }: { lists: RapoJobLists }) {
  const [sort, setSort] = useState<RapoSortKey>('new');
  const shown = lists[sort];

  return (
    <section
      aria-labelledby="rapo-home-jobs"
      className="flex flex-col gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default)
                 px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)"
    >
      <div className="flex items-center gap-(--rapo-dimension-x2)">
        <h2 id="rapo-home-jobs" className="rapo-type-section-title min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">
          채용 공고
        </h2>
        {/* 지금 고른 정렬 그대로 목록으로 갑니다 */}
        <Link href={`/jobs?sort=${sort}`}
          className="rapo-type-t2-medium flex h-[44px] w-[90px] items-center justify-end text-(color:--rapo-color-fg-neutral-muted)">
          더 보기<span className="sr-only"> — 채용 공고 전체</span>
        </Link>
      </div>

      <div role="group" aria-label="공고 정렬" className="flex h-[44px] gap-(--rapo-dimension-x1)">
        {RAPO_SORTS.map((s) => {
          const 켜짐 = sort === s.key;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={켜짐}
              onClick={() => setSort(s.key)}
              className={
                'flex h-[44px] w-[80px] items-center justify-center rounded-(--rapo-radius-r2) whitespace-nowrap ' +
                (켜짐
                  /* 선택 색은 원본이 Archive 의 selected/* 에 묶여 있습니다 — 현행에 같은 값이
                     있는 면은 blush 로, 없는 글자색 #8E241E 는 값 그대로 둡니다 (대응표 끝) */
                  ? 'rapo-type-t4-bold bg-(--rapo-brand-color-blush) text-[#8E241E]'
                  : 'rapo-type-t4-medium text-[#3F4C57] active:bg-(--rapo-color-bg-transparent-pressed)')
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rapo-type-t4-medium py-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">
          지금 보여 드릴 공고가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-(--rapo-dimension-x3)">
          {shown.map((j, i) => (
            <li key={j.id ?? `${j.org}-${j.title}`} className="flex flex-col gap-(--rapo-dimension-x3)">
              {i > 0 && <hr aria-hidden className="h-px border-0 bg-(--rapo-color-stroke-neutral-weak)" />}
              <RapoJobRow job={j} />
            </li>
          ))}
        </ul>
      )}
    </section>
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
          <span className="flex size-[32px] shrink-0 items-center justify-center rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src={`/rapo/home/org-${job.orgArt}.svg`} alt="" width={32} height={32} />
          </span>
          <p className="rapo-type-t4-medium min-w-0 flex-1 truncate text-(color:--rapo-color-fg-neutral-muted)">{job.org}</p>
          {job.id ? <JobSave id={job.id} look="rapo" /> : <RapoSaveFace />}
        </div>

        <h3 className="break-keep">
          {job.id
            ? <Link href={`/jobs/${job.id}`} className="hover:underline">{제목}</Link>
            : 제목}
        </h3>

        {job.pay && (
          <div className="flex items-center gap-(--rapo-dimension-x1_5)">
            {job.pay.kind === 'check' && (
              <span className="flex size-[16px] shrink-0 items-center justify-center">
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
            {job.tags.map((t) => (
              <li key={t} className="rapo-type-t2-medium rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak)
                                     px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex min-h-[24px] items-center justify-between gap-(--rapo-dimension-x3)">
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
