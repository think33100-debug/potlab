import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoOrgBoard } from '@/components/rapo/rapo-org-board';
import { RapoPastJobs, type 지난공고줄 } from '@/components/rapo/rapo-past-jobs';

/* 병원 정보 탭 「지난 공고」 시안 — **견본**(병원 이름은 가짜 · 줄 모양은 운영 자료 꼴 그대로). 개발 서버에서만.
   ?more=1 이면 「더 보기」를 누른 뒤 모습. 설계: RAPO노트/설계/지난공고_1122.md */
export const metadata: Metadata = { title: 'RAPO · 지난 공고 미리보기', robots: { index: false } };

const 견본: 지난공고줄[] = [
  { id: 'a', 마감: '2026-10-07', 직군: '작업치료사', 고용형태: '계약직', 인원: 2, 제목: '견본병원 작업치료사 계약직 채용공고' },
  { id: 'b', 마감: '2026-10-07', 직군: '공통', 고용형태: '계약직', 인원: null, 제목: '견본병원 작업치료사·물리치료사 계약직 채용공고' },
  { id: 'c', 마감: '2026-09-02', 직군: '공통', 고용형태: '계약직', 인원: null, 제목: '견본병원 작업치료사·물리치료사 계약직 채용공고' },
  { id: 'd', 마감: '2026-08-10', 직군: '물리치료사', 고용형태: '계약직', 인원: null, 제목: '견본병원 소아 물리치료사 계약직 채용공고' },
  { id: 'e', 마감: '2026-08-10', 직군: '물리치료사', 고용형태: '계약직', 인원: 1, 제목: '견본병원 물리치료사 계약직 채용공고' },
  { id: 'f', 마감: '2026-08-10', 직군: '작업치료사', 고용형태: '계약직', 인원: 4, 제목: '견본병원 작업치료사 계약직 채용공고' },
  { id: 'g', 마감: '2026-06-23', 직군: '작업치료사', 고용형태: '계약직', 인원: 1, 제목: '견본병원 작업치료사 계약직 채용공고' },
];

export default async function DesignPreviewOrgPast({ searchParams }: { searchParams: Promise<{ more?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const 다 = (await searchParams).more === '1';
  const 정보 = (
    <>
      <div className="bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5) rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
        (지금 있는 병원 정보 — 종류·주소·치료사 인원·바쁜 정도·연봉 — 그대로)
      </div>
      <div aria-hidden className="h-(--rapo-dimension-x2) bg-(--rapo-color-bg-neutral-weak)" />
      <RapoPastJobs
        줄={다 ? 견본 : 견본.slice(0, 5)}
        더있음={!다}
        더보기={
          <button type="button"
            className="rapo-type-t4-bold flex h-(--rapo-touch-min) items-center justify-center rounded-(--rapo-radius-r2)
                       border border-(--rapo-color-stroke-neutral-contrast) text-(color:--rapo-color-fg-neutral)">
            지난 공고 더 보기 (2건)
          </button>
        }
      />
    </>
  );
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: '#112332' }}>
      <RapoOrgBoard name="견본 · 푸른재활병원" sido="서울" 탭="info" 있나 정보={정보} />
      <RapoBottomNav current="/community" dark />
    </div>
  );
}
