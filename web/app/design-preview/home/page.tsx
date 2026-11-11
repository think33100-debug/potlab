import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeU01 } from '@/components/rapo/home-u01';
import { 견본공고 } from '@/components/rapo/home-u01-sample';

/* 새 디자인 홈 — **디자인 견본 그대로** 보는 자리 (2026-11-11 · 원본과 대조용).

   ★ 개발 서버(npm run dev)에서만 열립니다. 배포(빌드)에서는 404 입니다.
   실제 홈은 app/page.tsx 이고 거기는 실제 공고를 씁니다. 여기는 Figma 의 견본 공고
   (좋아요·경력 태그 등 아직 자료가 없는 칸까지)를 그대로 그려 원본과 나란히 봅니다. */
export const metadata: Metadata = { title: 'RAPO · 홈 미리보기', robots: { index: false } };

export default function DesignPreviewHome() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <HomeU01 jobs={견본공고} who="비회원" sample />;
}
