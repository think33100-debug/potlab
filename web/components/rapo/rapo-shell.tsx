import type { ReactNode } from 'react';
import type { Who } from '@/lib/supabase-server';
import { RapoBottomNav } from './rapo-bottom-nav';
import { RapoHeader } from './rapo-header';
import { RapoDivider } from './rapo-ui';

/* 새 디자인 화면의 틀 — 헤더 · 구분선 · 본문 · 하단 탐색 (2026-11-11).
   홈(U01)과 공고 목록(U02)이 같이 씁니다. 원본 두 화면 모두 이 차례입니다.

   이 틀을 쓰는 화면은 lib/nav.ts 의 새틀화면 에 길이 있어야 합니다 — 그래야 app/layout.tsx 가
   옛 위쪽 줄·옛 탭바를 그리지 않습니다. 폭은 지금 앱의 기둥(max-w-3xl · 768)입니다.
   data-rapo 가 붙은 안쪽에서만 포커스 테두리가 새 토큰 색입니다 (app/globals.css). */
export function RapoShell({ who, current, 관리덮기, children }: {
  who: Who;
  current: string;
  관리덮기?: { 채용관리: boolean; 교육관리: boolean };   // 미리보기 전용 (rapo-bottom-nav.tsx)
  children: ReactNode;
}) {
  return (
    <div data-rapo className="mx-auto w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />
      <RapoDivider />
      <main>{children}</main>
      {/* 마지막 콘텐츠가 하단 탐색(72 + 선 1 + 안전 영역)에 가리지 않게 */}
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current={current} 관리덮기={관리덮기} />
    </div>
  );
}
