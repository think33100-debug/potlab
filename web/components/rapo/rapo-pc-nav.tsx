'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { 아래탐색, 켜진길 } from '@/lib/nav';

/* PC 위쪽 탐색 — 피그마 「17 · 1 depth UI」 의 「PC 상단 탐색」(1936:2013 · PC 1040 · 본문 800 · 2026-11-26 세중님 「최근 PC 화면 적용」).
   높이 72 · 좌우 20 · 사이 28 · 아래 선 · 로고 → 메뉴(오른쪽 붙임 · 칸 높이 48 · 좌우 13) → 로그인(비회원만 · 72×40 딥코랄).
   켜진 칸은 굵게 + 딥코랄 글자 + 아래 2px 선, 꺼진 칸은 보통 + 흐린 글자.

   app/layout.tsx 가 모든 화면 맨 위에 그려 두고 **숨겨 둡니다.** 보이는 때는 둘이 다 맞을 때뿐입니다(app/globals.css) —
     ① 창 폭이 1040 이상   ② 그 화면에 아래 탐색(RapoBottomNav · data-rapo-bottom-nav)이 있음
   그때는 아래 탐색과 휴대폰 위쪽 줄(RapoHeader)을 숨기고 본문 기둥을 768 → 800 으로 넓힙니다.
   아래 탐색이 없는 화면(공고 상세 · 글쓰기 · 로그인처럼 한 가지 일을 하는 화면)은 지금 모양 그대로입니다.
   메뉴 목록은 아래 탐색과 같은 자리(lib/nav.ts 아래탐색) — 담당자면 「채용 관리」·「교육 관리」가 함께 붙습니다. */
export function RapoPcNav() {
  const pathname = usePathname();
  const { who, 관리 } = useAuth();
  const tabs = 아래탐색(관리);
  return (
    <div data-rapo data-rapo-pc-nav className="hidden w-full shrink-0 bg-(--rapo-color-bg-layer-default)">
      <nav aria-label="주요 메뉴"
        className="mx-auto flex h-[72px] w-full max-w-[800px] items-center gap-[28px] border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) px-(--rapo-dimension-x5)">
        <Link href="/" aria-label="RAPO 홈" className="relative block h-[31.5px] w-[120px] shrink-0">
          {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 (휴대폰 위쪽 줄 rapo-header.tsx 와 같은 두 조각) */}
          <img src="/rapo/home/logo-symbol.svg" alt="" className="absolute left-0 top-0 h-[31.5px] w-[32.25px]" />
          <img src="/rapo/home/logo-wordmark.svg" alt="" className="absolute bottom-[24.37%] left-[34.21%] right-[0.04%] top-[24.67%]" />
          {/* eslint-enable @next/next/no-img-element */}
        </Link>
        <ul className="flex h-full min-w-0 flex-1 items-center justify-end gap-[2px]">
          {tabs.map((t) => {
            const 켜짐 = 켜진길(pathname, t.href);
            return (
              <li key={t.href} className="flex">
                <Link href={t.href} aria-current={켜짐 ? 'page' : undefined}
                  className={'flex h-(--rapo-dimension-x12) items-center whitespace-nowrap border-b-2 px-[13px] '
                    + (켜짐
                      ? 'rapo-type-t5-bold border-(color:--rapo-color-fg-brand-contrast) text-(color:--rapo-color-fg-brand-contrast)'
                      : 'rapo-type-t5-regular border-transparent text-(color:--rapo-color-fg-neutral-muted) hover:text-(color:--rapo-color-fg-neutral)')}>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {who === '비회원' && (
          <Link href="/login"
            className="rapo-type-t4-medium flex h-(--rapo-dimension-x10) w-[72px] shrink-0 items-center justify-center rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral) active:bg-(--rapo-color-bg-deep-coral-pressed)">
            로그인
          </Link>
        )}
      </nav>
    </div>
  );
}
