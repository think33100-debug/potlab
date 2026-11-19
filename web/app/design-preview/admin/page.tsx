import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdminPreview } from './preview';

/* 관리자 화면 — **견본**. 개발 서버에서만.
   2026-11-19 — 숫자가 찬 모양을 보려고 ./mock-db 의 지어낸 견본을 씁니다(진짜 숫자 아님 · 저장 없음).
   ?screen=home|stats|jobs|members|beat 로 화면을 고릅니다 */
export const metadata: Metadata = { title: 'RAPO · 관리자 미리보기', robots: { index: false } };

export default async function DesignPreviewAdmin({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { screen } = await searchParams;
  return <Suspense><AdminPreview screen={screen ?? 'home'} /></Suspense>;
}
