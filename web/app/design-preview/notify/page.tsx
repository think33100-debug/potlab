'use client';

import { notFound } from 'next/navigation';
import { RapoAppBar } from '@/components/rapo/rapo-me';
import { RapoNotifySettings } from '@/components/rapo/rapo-notify-settings';

/* 알림 설정 미리보기 (2026-11-14) — 개발 서버에서만 열립니다(배포에서는 404).
   봉사·청년 칸을 켠 모양(서울 · 광주·전남)으로 그립니다. 저장은 DB 가 없어 실패합니다 */
export default function DesignPreviewNotify() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title="알림 설정" back="/me" />
      <main className="px-(--rapo-dimension-x6) pb-(--rapo-dimension-x8)">
        <RapoNotifySettings 미리켬 />
      </main>
    </div>
  );
}
