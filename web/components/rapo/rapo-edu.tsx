import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RapoJob } from './rapo-job-row';

/* 교육·학술 조각 — 새 디자인 「U12 · 과정 목록」 1377:37059 (2026-11-12 세중님 「라포 더 둘러보기 메뉴 시작」).
   실제 화면(app/edu/page.tsx)과 견본(app/design-preview/edu)이 같이 씁니다.

   원본에서 넣은 것   목록 상단(뒤로 · 「교육」 · 그림) · 직군/기관 칩 · 「교육 목록 N건」 · 「종료된 일정 포함」 ·
                     학회 원문 행(기관 그림 · 학회 이름 · 과정명 + 바깥 열기 · 달력 + 날짜)
   원본에 있지만 뺀 것 검색 칸 — 교육 창구(교육목록)가 검색어를 받지 않습니다. 한 쪽 안에서만 거르면
                     「없다」고 잘못 보여서 넣지 않았습니다
                     신청 회차 행(모집 중 · 금액) — 여러 기관의 회차를 한 번에 주는 창구가 아직 없습니다
   원본에 없지만 남긴 것 맨 아래 출처 안내와 「직접 들어가서 보세요」 링크 — 지침 15절(출처와 한계를 화면에 밝힘) */

/* 목록 상단 — 원본 「교육 탐색 / 목록 상단」 1400:960 · 64 높이 · 뒤로 20 · 제목 t9 Bold · 오른쪽 그림 52 */
export function RapoEduTop({ back = '/' }: { back?: string }) {
  return (
    <header className="flex h-[64px] items-center gap-(--rapo-dimension-x1) bg-(--rapo-color-bg-layer-default) pl-(--rapo-dimension-x1_5) pr-(--rapo-dimension-x5)">
      <Link href={back} aria-label="뒤로"
        className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
      </Link>
      <h1 className="rapo-type-t9-bold min-w-0 flex-1 text-(color:--rapo-brand-color-navy)">교육</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 그림 「임상 실습 교재와 교육 일정」 */}
      <img src="/rapo/edu/hero-52.webp" alt="" width={52} height={52} className="shrink-0" />
    </header>
  );
}

/* 필터 칩 — 원본 「RAPO / Home / 필터 칩」 353:644 (44 터치 · 40 배경 · 아이콘 16 · t4 Medium · 내림 12).
   「선택값은 실제 적용한 조건만 표시」 — 고른 것이 있으면 그 이름을 칩에 씁니다.
   펼침은 details 로 둡니다(서버 화면 · 고르면 주소가 바뀝니다) */
export function RapoEduFilter({ icon, label, 고른것, 선택지 }: {
  icon: string; label: string; 고른것: string | null;
  선택지: { 글: string; 주소: string; 켜짐: boolean; 수?: number }[];
}) {
  return (
    <details className="group relative">
      <summary className="flex h-(--rapo-touch-min) cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
        <span className={'rapo-type-t4-medium flex h-[40px] items-center gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1_5) px-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral) '
          + (고른것 ? 'bg-(--rapo-brand-color-blush)' : 'bg-(--rapo-color-bg-neutral-weak)')}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src={icon} alt="" width={16} height={16} />
          {고른것 ?? label}
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/list/down-12.svg" alt="" width={12} height={12} className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <ul className="absolute left-0 top-[48px] z-30 flex max-h-[60dvh] min-w-[200px] flex-col overflow-y-auto rounded-(--rapo-radius-r3)
                     border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) py-(--rapo-dimension-x1) shadow-(--rapo-shadow-s2)">
        {선택지.map((s) => (
          <li key={s.주소}>
            <Link href={s.주소} aria-current={s.켜짐 ? 'true' : undefined}
              className={'flex h-(--rapo-touch-min) items-center justify-between gap-(--rapo-dimension-x3) px-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-transparent-pressed) '
                + (s.켜짐 ? 'rapo-type-t4-bold text-[#b42a21]' : 'rapo-type-t4-regular text-(color:--rapo-color-fg-neutral)')}>
              {s.글}
              {s.수 != null && <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{s.수}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* 「종료된 일정 포함」 — 원본 「RAPO / Checkbox」 205:46 (마크 20 · 라벨 t4 Regular · 터치 44). 주소로 켜고 끕니다 */
export function RapoEduPastToggle({ on, href }: { on: boolean; href: string }) {
  return (
    <Link href={href} role="checkbox" aria-checked={on}
      className="flex min-h-(--rapo-touch-min) items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r1) active:bg-(--rapo-color-bg-transparent-pressed)">
      <span aria-hidden className={'flex size-[20px] items-center justify-center rounded-(--rapo-radius-r1) border '
        + (on ? 'border-(color:--rapo-brand-color-navy) bg-(--rapo-brand-color-navy) text-white' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
        {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral)">종료된 일정 포함</span>
    </Link>
  );
}

/* 학회 원문 행 — 원본 「교육 목록 / 학회 원문 행」 1412:56114 (144 높이 · 기관 그림 32 · 학회 t4 Medium #3f4c57 ·
   과정명 t7 Bold navy + 바깥 열기 14 · 달력 16 + 날짜 t4 Regular · 아래 선 #dde4e6). 누르면 학회 화면이 새 창으로 */
export function RapoEduRow({ href, 기관, 그림, 제목, 날짜 }: {
  href: string; 기관: string; 그림: RapoJob['orgArt']; 제목: string; 날짜: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex flex-col gap-(--rapo-dimension-x3) border-b border-[#dde4e6] py-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-transparent-pressed)">
      <span className="flex items-center gap-(--rapo-dimension-x2)">
        <span className="flex size-(--rapo-dimension-x8) shrink-0 items-center justify-center rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src={`/rapo/home/org-${그림}.svg`} alt="" width={32} height={32} />
        </span>
        <span className="rapo-type-t4-medium min-w-0 truncate text-[#3f4c57]">{기관}</span>
      </span>
      <span className="flex items-start gap-[6px]">
        <span className="rapo-type-t7-bold min-w-0 break-keep text-(color:--rapo-brand-color-navy)">{제목}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/edu/external-14.svg" alt="" width={14} height={14} className="mt-[7px] shrink-0" />
        <span className="sr-only">(학회 화면 · 새 창)</span>
      </span>
      <span className="flex items-center gap-[6px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/edu/calendar-16.svg" alt="" width={16} height={16} className="shrink-0" />
        <span className="rapo-type-t4-regular min-w-0 text-[#3f4c57]">{날짜}</span>
      </span>
    </a>
  );
}
