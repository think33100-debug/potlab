import Link from 'next/link';
import type { ReactNode } from 'react';
import { Hit } from '@/components/hit';
import { RapoBottomNav } from './rapo-bottom-nav';
import { RapoEduTop } from './rapo-edu';
import { RapoButton } from './rapo-ui';

/* 계산 도구형 화면 틀 — 피그마 「T03 · 계산 도구형」 (15 · 기본 화면 템플릿 614:861) (2026-11-14 세중님 「돈계산들은 다 예전 화면 · 피그마 확인해서 교체」).
   위쪽 줄 → 도구 이름 알약 넷 → 제목·설명 → 넣는 카드 → 결과 칸. 계산 규칙은 건드리지 않았습니다(lib/tax · labor · unemployment).
   넣는 칸·결과 조각은 components/tool-parts.tsx 가 같은 틀로 그립니다. */

const 도구들 = [
  { href: '/tools/pay', 글: '실수령액' },
  { href: '/tools/severance', 글: '퇴직금' },
  { href: '/tools/leave', 글: '연차' },
  { href: '/tools/unemployment', 글: '실업급여' },
];

export function RapoToolPage({ 지금, hit, 제목, 설명, children }: {
  지금: string; hit: string; 제목: string; 설명: string; children: ReactNode;
}) {
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <Hit kind="other" target={hit} />
      <RapoEduTop back="/toolkit" title="계산기" art="/rapo/home/graphic-calc-28.svg" />
      <main className="flex flex-col gap-(--rapo-dimension-x5) px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8) pt-(--rapo-dimension-x2)">
        <nav aria-label="계산기 고르기">
          <ul className="flex flex-wrap gap-(--rapo-dimension-x2)">
            {도구들.map((t) => {
              const on = t.href === 지금;
              return (
                <li key={t.href}>
                  <Link href={t.href} aria-current={on ? 'page' : undefined}
                    className={'rapo-type-t4-medium flex h-(--rapo-touch-min) items-center whitespace-nowrap rounded-full border-(length:--rapo-border-default) px-(--rapo-dimension-x4) '
                      + (on ? 'border-(color:--rapo-color-stroke-neutral-contrast) bg-(--rapo-color-bg-layer-default) font-bold text-(color:--rapo-color-fg-neutral)'
                            : 'border-(color:--rapo-color-stroke-neutral-weak) text-(color:--rapo-color-fg-neutral-muted)')}>
                    {t.글}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <header className="flex flex-col gap-(--rapo-dimension-x1)">
          <h1 className="rapo-type-t9-bold break-keep text-(color:--rapo-brand-color-navy)">{제목}</h1>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{설명}</p>
        </header>
        {children}
        {/* 2026-11-14 세중님 「계산 결과 아래에 라포 올인원 툴킷 더 둘러보기」 — 계산기 넷 모두 맨 아래에 같은 단추 */}
        <RapoButton href="/toolkit" tone="coral" size={52} full>라포 올인원 툴킷 더 둘러보기</RapoButton>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/toolkit" />
    </div>
  );
}
