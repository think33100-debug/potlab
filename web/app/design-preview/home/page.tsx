import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeU01 } from '@/components/rapo/home-u01';
import { 견본공고 } from '@/components/rapo/home-u01-sample';
import { RapoJobList, RapoJobsError, RapoJobsLoading } from '@/components/rapo/rapo-job-list';

/* 새 디자인 홈 — **디자인 견본 그대로** 보는 자리 (2026-11-11 · 원본과 대조용).

   ★ 개발 서버(npm run dev)에서만 열립니다. 배포(빌드)에서는 404 입니다.
   실제 홈은 app/page.tsx 이고 거기는 실제 공고를 씁니다. 여기는 Figma 의 견본 공고
   (좋아요·경력 태그 등 아직 자료가 없는 칸까지)를 그대로 그려 원본과 나란히 봅니다.

   주소 끝에 붙여 상태를 봅니다 —
     ?state=loading   공고 받는 중       ?state=empty   공고 0건
     ?state=error     공고를 못 받음      ?who=member    회원 헤더·배너 글자
     ?manage=1        담당자 메뉴(채용 관리·교육 관리)가 붙은 하단 탐색 */
export const metadata: Metadata = { title: 'RAPO · 홈 미리보기', robots: { index: false } };

export default async function DesignPreviewHome({ searchParams }: {
  searchParams: Promise<{ state?: string; who?: string; manage?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state, who, manage } = await searchParams;
  const jobs = state === 'loading' ? <RapoJobsLoading />
    : state === 'error' ? <RapoJobsError />
    : state === 'empty' ? <RapoJobList lists={{ new: [], views: [], deadline: [] }} />
    : <RapoJobList lists={견본공고} />;
  return (
    <HomeU01 jobs={jobs} who={who === 'member' ? '회원' : '비회원'} sample={!state}
      관리덮기={manage ? { 채용관리: true, 교육관리: true } : undefined} />
  );
}
