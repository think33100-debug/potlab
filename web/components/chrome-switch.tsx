'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { 새틀화면 } from '@/lib/nav';

/* 화면 틀 가르기 (2026-11-11).

   새 디자인 화면(lib/nav.ts 의 새틀화면)은 자기 헤더와 하단 탐색을 갖고 있습니다.
   그래서 app/layout.tsx 가 모든 화면에 그리던 옛 위쪽 줄은 그 화면에서 **그리지 않습니다**.
   전에는 그려 놓고 CSS(:has)로 가렸는데, 가려도 화면 읽는 도구·검색에는 남고
   화면마다 가리는 규칙이 늘어납니다. 옛 탭바는 components/tab-bar.tsx 가 같은 함수를 봅니다. */
export function LegacyChrome({ children }: { children: ReactNode }) {
  return 새틀화면(usePathname()) ? null : <>{children}</>;
}

/* 새 하단 탐색(72 + 선 1px)은 넓은 화면에서도 보입니다. 옛 탭바는 휴대폰에서만 보여서
   layout 의 footer 는 넓은 화면에서 밑 여백이 얕습니다 — 그만큼만 더 띄웁니다 */
export function RapoChromeGap() {
  return 새틀화면(usePathname())
    ? <div aria-hidden className="hidden md:block" style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
    : null;
}
