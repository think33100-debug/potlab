'use client';

import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoNotifySettings } from '@/components/rapo/rapo-notify-settings';

/* 알림 설정 — 내 정보 「설정」 (2026-11-11 밤 · 2026-11-14 교육·봉사·청년까지 넓힘).
   화면 몸은 components/rapo/rapo-notify-settings.tsx (미리보기 /design-preview/notify 와 같이 씁니다) */
export default function MyNotify() {
  return (
    <RapoMeFrame title="알림 설정">
      {() => <RapoNotifySettings />}
    </RapoMeFrame>
  );
}
