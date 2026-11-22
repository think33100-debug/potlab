import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoPastJobsBrief, type 지난공고줄 } from '@/components/rapo/rapo-past-jobs';
import { RapoSectionGap } from '@/components/rapo/rapo-job-detail';

/* 공고 상세 「이 병원 지난 공고」 시안 — **견본**(줄 모양은 운영 자료 꼴). 개발 서버에서만.
   설계: RAPO노트/설계/지난공고_1122.md */
export const metadata: Metadata = { title: 'RAPO · 공고 상세 지난 공고 미리보기', robots: { index: false } };

const 견본: 지난공고줄[] = [
  { id: 'a', 마감: '2026-10-07', 직군: '작업치료사', 고용형태: '계약직', 인원: 2, 제목: '' },
  { id: 'b', 마감: '2026-10-07', 직군: '공통', 고용형태: '계약직', 인원: null, 제목: '' },
  { id: 'c', 마감: '2026-09-02', 직군: '공통', 고용형태: '계약직', 인원: null, 제목: '' },
  { id: 'd', 마감: '2026-08-10', 직군: '물리치료사', 고용형태: '계약직', 인원: 1, 제목: '' },
  { id: 'e', 마감: '2026-08-10', 직군: '작업치료사', 고용형태: '정규직', 인원: 4, 제목: '' },
];

export default function DesignPreviewJobPast() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <div className="p-(--rapo-dimension-x5) rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
        (지금 있는 공고 상세 — 제목·연봉·자격·병원 한눈에 — 그대로)
      </div>
      <RapoSectionGap />
      <RapoPastJobsBrief
        줄={견본.slice(0, 2)}
        더보기={
          <a className="rapo-type-t4-bold flex h-(--rapo-touch-min) items-center justify-center rounded-(--rapo-radius-r2)
                        border border-(--rapo-color-stroke-neutral-contrast) text-(color:--rapo-color-fg-neutral)">
            병원 둘러보기에서 지난 공고 전부 보기
          </a>
        }
      />
      <RapoSectionGap />
      <div className="p-(--rapo-dimension-x5) rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
        (지원 방법 — 그대로)
      </div>
    </div>
  );
}
