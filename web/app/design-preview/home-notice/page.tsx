'use client';

import { notFound } from 'next/navigation';
import { RapoHomeNotice } from '@/components/rapo/home-notice';

/* 홈 안내 팝업 미리보기 (2026-11-15) — 개발 서버에서만(배포 404). 「다시 안 보기」를 눌렀던 브라우저에서는 안 뜹니다 */
export default function DesignPreviewHomeNotice() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <RapoHomeNotice />;
}
