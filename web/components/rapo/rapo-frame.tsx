import type { ReactNode } from 'react';
import { RapoBottomNav } from './rapo-bottom-nav';
import { RapoAppBar } from './rapo-me';

/* 피그마 원본이 없는 화면의 새 틀 — 앱 바 · 본문 · (고르면) 하단 탐색 (2026-11-16).

   세중님이 11/16 테스터로 눌러 보니 재직 인증·교육기관·담당자 신청·채용 관리·교육 관리와
   주소로만 가는 옛 화면(/pay /spec /talk /alarm /soon /community/<방>)이 아직 옛 위쪽 줄(POTJOB 로고)이었습니다.
   /contact · /compete 와 같은 규칙으로 옮깁니다 — 앱 바(RapoAppBar) · 토큰 · rapo 조각.
   자료를 읽는 길·권한·동작은 각 화면 그대로이고, 여기는 **그리는 틀**만 정합니다.
   이 틀을 쓰는 화면은 lib/nav.ts 새틀화면() 에 길을 더해 옛 위쪽 줄·탭바를 그리지 않습니다. */

export function RapoPageFrame({ title, back, nav, children }: {
  title: string;
  back?: string;
  /* 하단 탐색에서 켤 칸 — 없으면 하단 탐색을 그리지 않습니다(쓰기·신청처럼 한 가지 일을 하는 화면) */
  nav?: string;
  children: ReactNode;
}) {
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title={title} back={back} />
      <main className="flex flex-col gap-(--rapo-dimension-x6) px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8) pt-(--rapo-dimension-x4)">
        {children}
      </main>
      {nav && (
        <>
          <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
          <RapoBottomNav current={nav} />
        </>
      )}
    </div>
  );
}

/* 이 틀 안에서 되풀이되는 모양 — 화면 파일마다 같은 클래스를 다시 적지 않게 한 자리에 둡니다.
   옛 클래스(text-lg · text-mute · border-line · bg-brand-red …)를 옮길 때의 짝입니다 */
export const 틀 = {
  /* 화면 첫 큰 제목(옛 text-h1) */
  큰제목: 'rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)',
  /* 묶음 제목(옛 text-h2 · text-lg font-bold) */
  소제목: 'rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)',
  글: 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)',
  흐린글: 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)',
  작은글: 'rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)',
  오류: 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-critical)',
  /* 흰 카드 — 선 1px · 둥근 12 */
  카드: 'rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) '
      + 'bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)',
  /* 회색 안내 칸 */
  회색칸: 'rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)',
  /* 꼭 읽어야 하는 안내(옛 border-warning) */
  주의칸: 'rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-warning-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)',
  /* 오류 칸(옛 bg-brand-red-soft) */
  오류칸: 'rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-critical-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-critical-contrast)',
  /* 글 링크 */
  링크: 'rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast) underline underline-offset-4',
  /* 작은 상태 표(심사중 · 승인 …) */
  표: 'rapo-type-t2-medium inline-flex items-center whitespace-nowrap rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)',
  /* 입력 칸 — 가입·스펙 화면의 칸(components/rapo/rapo-spec-form.tsx 칸)과 같은 모양 */
  입력: 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
      + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
      + 'placeholder:text-(color:--rapo-color-fg-placeholder)',
  /* 여러 줄 입력 */
  긴입력: 'rapo-type-t5-regular w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
      + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
      + 'placeholder:text-(color:--rapo-color-fg-placeholder)',
  /* 큰 채움 단추(남색 52) — <button type="submit"> 처럼 RapoButton 을 못 쓰는 자리 */
  큰단추: 'rapo-type-t6-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r3) px-(--rapo-dimension-x5) '
      + 'bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid) enabled:active:bg-(--rapo-color-bg-navy-solid-pressed) '
      + 'disabled:cursor-not-allowed disabled:bg-(--rapo-color-bg-disabled) disabled:text-(color:--rapo-color-fg-disabled)',
  /* 작은 선 단추(40) */
  선단추: 'rapo-type-t4-bold inline-flex h-(--rapo-dimension-x10) items-center justify-center whitespace-nowrap rounded-(--rapo-radius-r2) px-(--rapo-dimension-x4) '
      + 'border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral) '
      + 'enabled:active:bg-(--rapo-color-bg-transparent-pressed) disabled:opacity-40',
} as const;

/* 「잠시만요…」 — 틀 안에서 읽는 동안 */
export function RapoWait() {
  return <p role="status" className="rapo-type-t4-regular py-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>;
}
