import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrgSearch } from '@/components/org-search';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';

/* 병원 찾기 — **견본**. 개발 서버에서만. 이 PC 는 DB 에 못 닿아 목록 자리는 「못 불러왔어요」로 보입니다(틀을 보는 자리) */
export const metadata: Metadata = { title: 'RAPO · 병원 찾기 미리보기', robots: { index: false } };

export default function DesignPreviewOrgs() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-[#112332]">
      <main className="px-[22px] pb-(--rapo-dimension-x6) pt-[15px]">
        <OrgSearch facets={{ tiles: {}, sidos: [], sggs: {}, total: 0 }} />
      </main>
      <RapoBottomNav current="/" dark />
    </div>
  );
}
