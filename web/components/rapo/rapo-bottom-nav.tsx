'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import { 아래탐색, 켜진길 } from '@/lib/nav';
import { RapoMaskIcon } from './rapo-ui';

/* RAPO 새 디자인의 아래 탐색 (2026-11-11).
   Figma 「선택=홈」 954:946 · 높이 72 · 좌우 14 · 위아래 10 · 아이콘 28 · 이름 t2.

   무슨 길이 있는지는 lib/nav.ts 가 정합니다(옛 탭바와 같은 데이터) — 담당자·마스터에게는
   「채용 관리」·「교육 관리」가 「내 정보」 앞에 붙습니다. 여기는 그리는 모양만 정합니다.

   아이콘 — 네 기본 길은 Figma 원본 SVG 모양을 가림판으로 쓰고 글자색으로 칠합니다
   (RapoMaskIcon). 그래서 켜진 길은 어느 것이든 fg/brand-contrast, 꺼진 길은 fg/neutral-muted 로
   원본 「홈 켜짐」(954:946)·「내 정보 켜짐」(1375:1672)과 같은 규칙으로 칠해집니다.
   (공고 목록 원본 462:4070 은 「검토 시안」이라 쓰지 않습니다 — 2026-11-11 대표: 채택안 우선)
   ⚠ 담당자 길은 원본 아이콘이 없어 옛 탭바의 아이콘(Lucide)을 씁니다(원본확인 D-2). */
const 원본아이콘: Record<string, { src: string; w: number; h: number }> = {
  '/':          { src: '/rapo/home/nav-home.svg',      w: 23.1,  h: 23.1 },
  '/jobs':      { src: '/rapo/home/nav-jobs.svg',      w: 23.1,  h: 21.93 },
  '/community': { src: '/rapo/home/nav-community.svg', w: 28,    h: 28 },
  '/me':        { src: '/rapo/home/nav-me.svg',        w: 20.77, h: 23.1 },
};

export function RapoBottomNav({ current, 관리덮기 }: {
  current?: string;
  /* 미리보기에서 담당자 메뉴 모양을 보려고 둔 자리입니다 (app/design-preview). 실제 화면은 안 넘깁니다 */
  관리덮기?: { 채용관리: boolean; 교육관리: boolean };
}) {
  const pathname = usePathname();
  const { 관리 } = useAuth();
  const here = current ?? pathname;
  const tabs = 아래탐색(관리덮기 ?? 관리);

  /* 배경·윗선도 본문 기둥(max-w-3xl · 768)과 같은 폭입니다 — PC 에서 화면 끝까지 펼쳐지지 않게
     (2026-11-11 디자이너 검토). 휴대폰에서는 화면 폭이 768 보다 좁아 전처럼 꽉 찹니다 */
  return (
    <nav
      aria-label="아래 탐색"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl
                 border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak)
                 bg-(--rapo-color-bg-layer-default)"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-[72px] items-start px-(--rapo-dimension-x3_5) py-(--rapo-dimension-x2_5)">
        {tabs.map((t) => {
          const 켜짐 = 켜진길(here, t.href);
          const 그림 = 원본아이콘[t.href];
          return (
            <li key={t.href} className="min-w-0 flex-1">
              <Link
                href={t.href}
                aria-current={켜짐 ? 'page' : undefined}
                className={
                  'relative flex h-(--rapo-dimension-x13) flex-col items-center gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1) ' +
                  'active:bg-(--rapo-color-bg-transparent-pressed) ' +
                  (켜짐
                    ? 'rapo-type-t2-bold text-(color:--rapo-color-fg-brand-contrast)'
                    : 'rapo-type-t2-medium text-(color:--rapo-color-fg-neutral-muted)')
                }
              >
                {켜짐 && (
                  <span aria-hidden className="absolute left-1/2 top-[-4px] h-(--rapo-dimension-x9) w-(--rapo-dimension-x12) -translate-x-1/2
                                               rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-brand-weak)" />
                )}
                <span className="relative flex size-(--rapo-dimension-x7) items-center justify-center">
                  {그림
                    ? <RapoMaskIcon src={그림.src} w={그림.w} h={그림.h} />
                    : <Icon name={t.icon} size={24} />}
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
