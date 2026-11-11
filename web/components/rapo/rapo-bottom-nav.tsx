'use client';

import Link, { useLinkStatus } from 'next/link';
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

/* dark — 커뮤니티의 어두운 판 「하단 탐색 · 커뮤니티」 1264:61 (바탕 #0d1d29 · 꺼짐 #b7c6d1 · 켜짐 #ffa691 · 켜짐 바탕 없음).
   원본 값 그대로입니다 — 현행 토큰에 같은 값이 없습니다 (components/rapo/rapo-community.tsx 의 어둠) */
export function RapoBottomNav({ current, 관리덮기, dark = false }: {
  current?: string;
  dark?: boolean;
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
      className={'fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl ' + (dark ? ''
        : 'border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default)')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', ...(dark ? { background: '#0d1d29' } : {}) }}
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
                /* 누르는 순간 살짝 눌리고(scale), 받는 동안에는 켜진 모양이 먼저 옵니다(NavTabBody · useLinkStatus) —
                   2026-11-11 밤 대표 「누른 느낌도 잘 안 나고」 */
                className="relative flex h-(--rapo-dimension-x13) flex-col items-center gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1)
                           transition-transform duration-[90ms] active:scale-[0.92] active:bg-(--rapo-color-bg-transparent-pressed) motion-reduce:transition-none"
              >
                <NavTabBody 켜짐={켜짐} dark={dark} 그림={그림} icon={t.icon} label={t.label} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* 탭 한 칸의 안쪽 — 링크가 받는 중(pending)이면 이미 켜진 것처럼 그립니다(Next useLinkStatus).
   그래서 누르자마자 색이 바뀌고, 다음 화면이 오면 그대로 이어집니다 */
function NavTabBody({ 켜짐, dark, 그림, icon, label }: {
  켜짐: boolean; dark: boolean; 그림?: { src: string; w: number; h: number }; icon: string; label: string;
}) {
  const { pending } = useLinkStatus();
  const on = 켜짐 || pending;
  const 글 = dark
    ? (on ? 'rapo-type-t2-bold text-[#ffa691]' : 'rapo-type-t2-medium text-[#b7c6d1]')
    : on ? 'rapo-type-t2-bold text-(color:--rapo-color-fg-brand-contrast)' : 'rapo-type-t2-medium text-(color:--rapo-color-fg-neutral-muted)';
  return (
    <span className={'flex flex-col items-center gap-(--rapo-dimension-x1) ' + 글}>
      {on && !dark && (
        <span aria-hidden className="absolute left-1/2 top-[-4px] h-(--rapo-dimension-x9) w-(--rapo-dimension-x12) -translate-x-1/2
                                     rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-brand-weak)" />
      )}
      <span className="relative flex size-(--rapo-dimension-x7) items-center justify-center">
        {그림 ? <RapoMaskIcon src={그림.src} w={그림.w} h={그림.h} /> : <Icon name={icon} size={24} />}
      </span>
      <span className="relative whitespace-nowrap">{label}</span>
    </span>
  );
}
