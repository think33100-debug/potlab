import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoOrgBoard } from '@/components/rapo/rapo-org-board';

/* 병원 게시판 — **견본**(병원 이름은 가짜). 개발 서버에서만. ?tab=review 면 근무 후기 탭 */
export const metadata: Metadata = { title: 'RAPO · 병원 게시판 미리보기', robots: { index: false } };

export default async function DesignPreviewOrg({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const 탭 = (await searchParams).tab === 'review' ? 'review' : 'talk';
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: '#112332' }}>
      <RapoOrgBoard name="견본 · 푸른재활병원" sido="서울" 탭={탭} 있나 />
      <RapoBottomNav current="/community" dark />
    </div>
  );
}
