import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeU01 } from '@/components/rapo/home-u01';
import { 견본공고 } from '@/components/rapo/home-u01-sample';
import { RapoJobList } from '@/components/rapo/rapo-job-list';
import { RapoInstallToastFace, type 설치갈래 } from '@/components/rapo/rapo-install-toast';

/* 설치 안내 토스트 — **시안**을 보는 자리 (2026-11-13 세중님 승인 받기 전 · 눌러도 아무것도 안 됨).
   개발 서버에서만 열립니다(배포에서는 404).
     ?b=prompt       크롬·엣지 — 「설치하기」 단추
     ?b=mac-safari   맥 사파리 — 「파일 → Dock에 추가」 안내
     ?b=ios          아이폰 사파리 — 「공유 → 홈 화면에 추가」 안내 */
export const metadata: Metadata = { title: 'RAPO · 설치 안내 미리보기', robots: { index: false } };

export default async function DesignPreviewInstall({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { b } = await searchParams;
  const 갈래: 설치갈래 = b === 'mac-safari' || b === 'ios' ? b : 'prompt';
  return (
    <>
      <HomeU01 jobs={<RapoJobList lists={견본공고} />} who="회원" sample />
      <RapoInstallToastFace 갈래={갈래} />
    </>
  );
}
