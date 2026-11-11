'use client';

import NotifyToggle from '@/components/notify-toggle';
import { RapoMeFrame } from '@/components/rapo/rapo-me';

/* 공고 알림 설정 — 내 정보 「설정」 (2026-11-11 밤). 전 /me 의 「알림」 칸 그대로입니다 */
export default function MyNotify() {
  return (
    <RapoMeFrame title="공고 알림 설정">
      {() => (
        <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x4)">
          <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            찜한 기관에 새 공고가 뜨거나, 찜한 공고가 마감 3일 전이면 알려드려요.
            밤 10시부터 아침 7시까지는 보내지 않고 아침에 모아서 보냅니다.
          </p>
          <NotifyToggle />
        </div>
      )}
    </RapoMeFrame>
  );
}
