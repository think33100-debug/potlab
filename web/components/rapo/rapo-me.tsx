'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/app/auth';
import { RapoBottomNav } from './rapo-bottom-nav';
import { RapoDivider } from './rapo-ui';

/* 내 정보 — 새 디자인 「U14-01 / 내 정보」 조각 (2026-11-11 밤 · 대표: 피그마 우선).
   원본: 12 · 내 정보 → U14-01 1375:160 · 프로필 요약 1376:37165 · 메뉴 행 1422:846 · 관리 메뉴 1508:2398 ·
   앱 바 「라이트 · 중앙 제목」 1211:25726 · 하단 탐색 「선택=내 정보」 1375:1672.
   원본 글자색 #223443 · #253748 · #556474 · 구분선 #e6e9ed 는 현행 토큰에 같은 값이 없어
   가장 가까운 토큰(fg/neutral · fg/neutral-muted · stroke/neutral-weak 의 RapoDivider)으로 맞췄습니다. */

/* 앱 바 — 뒤로 · 가운데 제목 · 균형 여백 (56px). back 이 없으면 뒤로 자리는 비웁니다(탭 첫 화면) */
export function RapoAppBar({ title, back }: { title: string; back?: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-[56px] items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
      {back ? (
        <Link href={back} aria-label="뒤로" className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
        </Link>
      ) : <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />}
      <h1 className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">{title}</h1>
      <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
    </header>
  );
}

/* 메뉴 한 줄 — 아이콘 24 · 글 16/22 · 오른쪽 꺾쇠 18 · 높이 44 */
export function RapoMeRow({ icon, href, children }: { icon: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex h-(--rapo-touch-min) items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r1) active:bg-(--rapo-color-bg-transparent-pressed)">
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src={icon} alt="" width={24} height={24} className="shrink-0" />
      <span className="rapo-type-t5-regular min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">{children}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/me/chevron-18.svg" alt="" width={18} height={18} className="shrink-0" />
    </Link>
  );
}

/* 묶음 — 구분선(첫 묶음 빼고) · 제목 20/27 · 메뉴 */
export function RapoMeSection({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-(--rapo-dimension-x3)">
      {!first && <RapoDivider />}
      <h2 className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/* 내 정보 아래 화면들의 틀 — 로그인·가입 확인 · 앱 바 · 본문. 가입 전이면 가입 화면, 로그인 전이면 로그인으로 */
export function RapoMeFrame({ title, back = '/me', nav = false, children }: {
  title: string; back?: string; nav?: boolean; children: (me: NonNullable<ReturnType<typeof useAuth>['me']>) => ReactNode;
}) {
  const router = useRouter();
  const { loading, session, me, 설문 } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login?next=' + encodeURIComponent(location.pathname)); return; }
    /* 프로필을 **못 읽은** 것(잠깐 끊김 · 설문 「모름」)과 **없는** 것(가입 전)을 가릅니다 (2026-11-12 밤 점검).
       전에는 못 읽었을 때도 가입 화면(/welcome · 옛 모양)으로 보냈다가 되돌아와, 내 정보에 들어갈 때
       옛 화면이 잠깐 비칠 수 있었습니다 — 원인 후보이고, 이 PC 에서는 다시 일으키지 못했습니다 */
    if (!me && 설문 !== '모름') router.replace('/welcome');
  }, [loading, session, me, 설문, router]);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title={title} back={nav ? undefined : back} />
      <main className="px-(--rapo-dimension-x6) pb-(--rapo-dimension-x8)">
        {loading || !me
          ? <p role="status" className="rapo-type-t4-regular py-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>
          : children(me)}
      </main>
      {nav && (
        <>
          <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
          <RapoBottomNav current="/me" />
        </>
      )}
    </div>
  );
}
