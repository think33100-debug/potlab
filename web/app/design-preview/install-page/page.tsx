'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RapoInstallBody, type 설치상태 } from '@/components/rapo/rapo-install';
import { RapoAppBar } from '@/components/rapo/rapo-me';

/* 「핸드폰에 설치하기」 화면 미리보기 (2026-11-14) — 개발 서버에서만(배포 404).
     ?g=단추(기본) · 아이폰 · 앱안 · 맥사파리 · 안내만 · 설치됨 */
function Body() {
  const g = (useSearchParams().get('g') ?? '단추') as 설치상태;
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title="핸드폰에 설치하기" back="/me" />
      <main className="px-(--rapo-dimension-x6) pb-(--rapo-dimension-x8)"><RapoInstallBody 견본={g} /></main>
    </div>
  );
}

export default function DesignPreviewInstallPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
