'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* RAPO 새 디자인의 아래 탐색 (2026-11-11).
   Figma 「선택=홈」 954:946 · 높이 72 · 좌우 14 · 위아래 10 · 아이콘 28 · 이름 t2.
   네 길은 지금 탭바(components/tab-bar.tsx)와 같습니다 — 길을 바꾸지 않았습니다.

   ⚠ 아이콘은 원본 SVG 에 색이 박혀 있습니다. 원본에는 「홈이 켜진」 모양만 있어서
     다른 탭이 켜진 모양(빨간 공고 아이콘 등)은 아직 없습니다 — 다른 화면에 쓰기 전에
     켜진 모양 원본을 받아야 합니다. 그때까지는 켜진 표시를 색면과 글자로만 합니다. */
const TABS = [
  { href: '/',          label: '홈',       icon: '/rapo/home/nav-home.svg',      w: 23.1, h: 23.1 },
  { href: '/jobs',      label: '공고',     icon: '/rapo/home/nav-jobs.svg',      w: 23.1, h: 20.64 },
  { href: '/community', label: '커뮤니티', icon: '/rapo/home/nav-community.svg', w: 28,   h: 28 },
  { href: '/me',        label: '내 정보',  icon: '/rapo/home/nav-me.svg',        w: 20.77, h: 23.1 },
];

export function RapoBottomNav({ current }: { current?: string }) {
  const pathname = usePathname();
  const here = current ?? pathname;
  const on = (href: string) => (href === '/' ? here === '/' : here.startsWith(href));

  return (
    <nav
      aria-label="아래 탐색"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-(--rapo-color-stroke-neutral-weak)
                 bg-(--rapo-color-bg-layer-default)"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex h-[72px] max-w-3xl items-start px-(--rapo-dimension-x3_5) py-[10px]">
        {TABS.map((t) => {
          const 켜짐 = on(t.href);
          return (
            <li key={t.href} className="min-w-0 flex-1">
              <Link
                href={t.href}
                aria-current={켜짐 ? 'page' : undefined}
                className={
                  'relative flex h-[52px] flex-col items-center gap-(--rapo-dimension-x1) ' +
                  (켜짐
                    ? 'rapo-type-t2-bold text-(color:--rapo-color-fg-brand-contrast)'
                    : 'rapo-type-t2-medium text-(color:--rapo-color-fg-neutral-muted)')
                }
              >
                {켜짐 && (
                  <span aria-hidden className="absolute left-1/2 top-[-4px] h-[36px] w-[48px] -translate-x-1/2
                                               rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-brand-weak)" />
                )}
                <span className="relative flex size-[28px] items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                  <img src={t.icon} alt="" width={t.w} height={t.h} />
                </span>
                <span className="relative whitespace-nowrap">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
