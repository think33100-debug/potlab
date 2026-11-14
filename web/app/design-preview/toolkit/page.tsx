import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoToolkit } from '@/components/rapo/rapo-toolkit';

/* 라포 올인원 툴킷 미리보기 (2026-11-14) — 개발 서버에서만 열립니다(배포에서는 404).
   실제 화면 /toolkit 은 테스트 기간 동안 로그인한 테스터만 봅니다 */
export const metadata: Metadata = { title: 'RAPO · 툴킷 미리보기', robots: { index: false } };

export default function DesignPreviewToolkit() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <RapoToolkit />;
}
