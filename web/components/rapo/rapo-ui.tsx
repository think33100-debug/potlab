import Link from 'next/link';
import type { ReactNode } from 'react';

/* RAPO 새 디자인의 공통 UI 조각 (2026-11-11 · 디자이너 검토 반영).

   홈에서 되풀이되는 요소를 한 자리로 모았습니다. 다른 화면도 여기 것을 가져다 씁니다 —
   화면 파일 안에 같은 클래스를 다시 적지 않습니다.
   색·간격·모서리·글자는 app/rapo-tokens.css 의 이름만 씁니다. 값으로 적은 곳은
   Figma 원본이 현행 토큰 밖인 자리뿐이고, 그 목록은 docs/rapo-design/원본확인_1111.md 입니다.

     RapoSectionTitle   RAPO/Type/Section title (20/28 Bold)
     RapoDivider        1px 구분선 (rapo/border/default · color/stroke/neutral-weak)
     RapoBadge          RAPO / Badge · 용도=정보 453:3335 — 읽기용, 누르지 않음
     RapoTextAction     RAPO / Action / 텍스트 버튼 — solid(헤더 954:960) · more(「더 보기」 480:4145)
     RapoButton         RAPO / Button / Filled 172:50 — Navy·BI coral·Deep coral × 40·52
     RapoSortTabs       RAPO / Home 11-04 / 정렬 942:584(선택) · 942:586(기본)
     RapoStatusPanel    RAPO / Home / jobs-empty 496:441 · jobs-error 496:450 */

/* ── 섹션 제목 ─────────────────────────────────────────── */
const 제목색 = {
  neutral: 'text-(color:--rapo-color-fg-neutral)',
  navy: 'text-(color:--rapo-brand-color-navy)',
  inverse: 'text-(color:--rapo-color-bg-layer-default)',
} as const;

export function RapoSectionTitle({ id, tone = 'navy', className = '', children }: {
  id?: string; tone?: keyof typeof 제목색; className?: string; children: ReactNode;
}) {
  return <h2 id={id} className={`rapo-type-section-title ${제목색[tone]} ${className}`}>{children}</h2>;
}

/* ── 구분선 ───────────────────────────────────────────── */
export function RapoDivider({ className = '' }: { className?: string }) {
  return <hr aria-hidden className={`h-(--rapo-border-default) border-0 bg-(--rapo-color-stroke-neutral-weak) ${className}`} />;
}

/* ── 배지 ─────────────────────────────────────────────── */
export function RapoBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rapo-type-t2-medium inline-flex items-center rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak)
                     px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">
      {children}
    </span>
  );
}

/* ── 텍스트 버튼 ───────────────────────────────────────── */
export function RapoTextAction({ href, variant, children, srHint }: {
  href: string; variant: 'solid' | 'more'; children: ReactNode; srHint?: string;
}) {
  const 모양 = variant === 'solid'
    ? 'rapo-type-t4-medium h-(--rapo-dimension-x10) w-[72px] justify-center rounded-(--rapo-radius-r2) ' +
      'bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral) active:bg-(--rapo-color-bg-deep-coral-pressed)'
    : 'rapo-type-t2-medium h-(--rapo-touch-min) w-[90px] justify-end rounded-(--rapo-radius-r1) ' +
      'text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)';
  return (
    <Link href={href} className={`flex shrink-0 items-center whitespace-nowrap ${모양}`}>
      {children}{srHint && <span className="sr-only"> — {srHint}</span>}
    </Link>
  );
}

/* ── 채움 버튼 ─────────────────────────────────────────────
   원본 설명: Medium 40 — 14/19 Bold · 가로 16 · 세로 10 · radius 8
              Large 52  — 18/24 Bold · 가로 20 · 세로 14 · radius 12
              Default / Pressed / Disabled / Loading
   로딩 모양(돌아가는 고리)은 spinner-track 토큰으로 그렸습니다 — 원본 Loading 변형과는
   아직 대조하지 못했습니다(원본확인 문서). 로딩·비활성일 때는 눌리지 않습니다. */
const 버튼색 = {
  navy: 'bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid) enabled:active:bg-(--rapo-color-bg-navy-solid-pressed)',
  coral: 'bg-(--rapo-color-bg-identity) text-(color:--rapo-color-fg-on-identity) enabled:active:bg-(--rapo-color-bg-identity-pressed)',
  'deep-coral': 'bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral) enabled:active:bg-(--rapo-color-bg-deep-coral-pressed)',
  /* RAPO / Button / Outline 172:67 — 선 1px(stroke/neutral-muted) · 글자 fg/neutral */
  outline: 'border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) bg-(--rapo-color-bg-transparent) ' +
           'text-(color:--rapo-color-fg-neutral) enabled:active:bg-(--rapo-color-bg-transparent-pressed)',
} as const;
const 버튼크기 = {
  40: 'rapo-type-t4-bold h-(--rapo-dimension-x10) px-(--rapo-dimension-x4) py-(--rapo-dimension-x2_5) rounded-(--rapo-radius-r2)',
  52: 'rapo-type-t6-bold h-(--rapo-dimension-x13) px-(--rapo-dimension-x5) py-(--rapo-dimension-x3_5) rounded-(--rapo-radius-r3)',
} as const;

type 버튼공통 = { tone?: keyof typeof 버튼색; size?: keyof typeof 버튼크기; full?: boolean; className?: string; children: ReactNode };

export function RapoButton(p: 버튼공통 & (
  | { href: string; onClick?: undefined; loading?: undefined; disabled?: undefined }
  | { href?: undefined; onClick: () => void; loading?: boolean; disabled?: boolean }
)) {
  const { tone = 'navy', size = 52, full = false, className = '', children } = p;
  const 틀 = `flex items-center justify-center gap-(--rapo-dimension-x2) whitespace-nowrap ${버튼크기[size]} ${full ? 'w-full' : ''} ${className} `;
  if (p.href !== undefined) {
    /* 링크에는 enabled: 가 안 걸려서 눌림 색을 따로 붙입니다 */
    return <Link href={p.href} className={틀 + 버튼색[tone].split('enabled:active:').join('active:')}>{children}</Link>;
  }
  const 잠김 = !!p.disabled || !!p.loading;
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={잠김}
      aria-busy={p.loading || undefined}
      className={틀 + 버튼색[tone] + ' disabled:cursor-not-allowed ' +
        (p.disabled && !p.loading ? 'disabled:bg-(--rapo-color-bg-disabled) disabled:text-(color:--rapo-color-fg-disabled)' : '')}
    >
      {p.loading && (
        <span aria-hidden className="size-(--rapo-dimension-x5) shrink-0 animate-spin rounded-(--rapo-radius-full)
                                     border-2 border-(color:--rapo-color-stroke-spinner-track-inverse) border-t-current
                                     motion-reduce:animate-none" />
      )}
      {children}
    </button>
  );
}

/* ── 정렬 탭 ───────────────────────────────────────────────
   선택 면·글자색은 원본이 Archive selected/* 에 묶여 있습니다. 면(#FFE9E6)은 같은 값의
   현행 토큰(브랜드 blush)으로, 글자 #8E241E 와 안 고른 글자 #3F4C57 은 현행에 같은 값이 없어
   값 그대로 둡니다 — 디자이너 확인 대상(원본확인 문서 A-1 · A-2).
   onChange 를 안 주면 눌리지 않는 모양만 그립니다(로딩·오류 때). */
export function RapoSortTabs<K extends string>({ label, items, value, onChange }: {
  label: string;
  items: readonly { key: K; label: string }[];
  value: K;
  onChange?: (k: K) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex h-(--rapo-touch-min) gap-(--rapo-dimension-x1)">
      {items.map((s) => {
        const 켜짐 = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={켜짐}
            disabled={!onChange}
            onClick={onChange ? () => onChange(s.key) : undefined}
            className={
              'flex h-(--rapo-touch-min) w-[80px] items-center justify-center rounded-(--rapo-radius-r2) whitespace-nowrap ' +
              'disabled:cursor-default ' +
              (켜짐
                ? 'rapo-type-t4-bold bg-(--rapo-brand-color-blush) text-[#8E241E]'
                : 'rapo-type-t4-medium text-[#3F4C57] enabled:active:bg-(--rapo-color-bg-transparent-pressed)')
            }
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── 빈 결과·오류 안내 ─────────────────────────────────────
   아이콘은 「RAPO / Home / Status icon」 원본 SVG (Jobs 32 501:125 · Error 32 501:134) */
const 상태그림 = {
  jobs: { src: '/rapo/home/status-jobs.svg', w: 26.4006, h: 25.0667 },
  error: { src: '/rapo/home/status-error.svg', w: 32, h: 32 },
} as const;

export function RapoStatusPanel({ icon, title, text, action, role }: {
  icon: keyof typeof 상태그림; title: string; text: string; action: ReactNode; role?: 'alert' | 'status';
}) {
  const g = 상태그림[icon];
  return (
    <div role={role} className="flex flex-col items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r3)
                                bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x7)">
      <span className="flex size-(--rapo-dimension-x8) items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src={g.src} alt="" width={g.w} height={g.h} />
      </span>
      <p className="rapo-type-t6-bold text-center text-(color:--rapo-color-fg-neutral)">{title}</p>
      <p className="rapo-type-t4-medium text-center text-(color:--rapo-color-fg-neutral-muted)">{text}</p>
      {action}
    </div>
  );
}

/* ── 선택 칩 ───────────────────────────────────────────────
   RAPO / Chip / Selection 172:86 — 보이는 높이 32 · 누르는 자리 44 · 14/19 Medium ·
   full radius · 좌우 12 · 선 1. 선택 = 면 bg/neutral-weak + 선 stroke/neutral-contrast.
   원본 비활성 변형은 값이 없어 fg/disabled·stroke 그대로로 둡니다(원본확인 D). */
export function RapoChip({ label, on, onClick, disabled, className = '' }: {
  label: string; on: boolean; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`group flex h-(--rapo-touch-min) items-center justify-center disabled:cursor-not-allowed ${className}`}
    >
      <span className={
        'rapo-type-t4-medium flex h-(--rapo-dimension-x8) min-w-(--rapo-touch-min) items-center justify-center whitespace-nowrap ' +
        'rounded-(--rapo-radius-full) border-(length:--rapo-border-default) px-(--rapo-dimension-x3) ' +
        'group-enabled:group-active:bg-(--rapo-color-bg-transparent-pressed) group-disabled:text-(color:--rapo-color-fg-disabled) ' +
        (on
          ? 'border-(color:--rapo-color-stroke-neutral-contrast) bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)'
          : 'border-(color:--rapo-color-stroke-neutral-muted) bg-(--rapo-color-bg-transparent) text-(color:--rapo-color-fg-neutral)')
      }>
        {label}
      </span>
    </button>
  );
}

/* ── 쪽 넘기기 ─────────────────────────────────────────────
   RAPO / Pagination 1412:47195 — 이전·다음 56×44 · 쪽 44×44 · radius 8 · 14/19 Medium ·
   지금 쪽 면 bg/brand-weak · 갈 수 없는 이전/다음은 35% 흐림.
   글자색은 원본이 변수 없는 검정이라 palette/static-black 을 씁니다.
   쪽 번호는 지금 쪽을 가운데 두고 다섯 개까지 보입니다 (원본은 두 쪽 견본뿐). */
export function RapoPagination({ page, pages, href }: {
  page: number;            // 0 부터
  pages: number;           // 전체 쪽 수
  href: (p: number) => string;
}) {
  if (pages <= 1) return null;
  const 처음 = Math.max(0, Math.min(page - 2, pages - 5));
  const 쪽들 = Array.from({ length: Math.min(5, pages) }, (_, i) => 처음 + i);
  const 칸 = 'rapo-type-t4-medium flex h-(--rapo-touch-min) items-center justify-center rounded-(--rapo-radius-r2) ' +
             'text-(color:--rapo-color-palette-static-black)';
  const 넘김 = (to: number, label: string, ok: boolean) => ok
    ? <Link href={href(to)} className={`${칸} w-(--rapo-dimension-x14) active:bg-(--rapo-color-bg-transparent-pressed)`}>{label}</Link>
    : <span aria-disabled className={`${칸} w-(--rapo-dimension-x14) opacity-35`}>{label}</span>;
  return (
    <nav aria-label="쪽 넘기기" className="flex items-center justify-center gap-(--rapo-dimension-x2)">
      {넘김(page - 1, '이전', page > 0)}
      {쪽들.map((p) => p === page
        ? <span key={p} aria-current="page" className={`${칸} size-(--rapo-touch-min) bg-(--rapo-color-bg-brand-weak)`}>{p + 1}</span>
        : <Link key={p} href={href(p)} className={`${칸} size-(--rapo-touch-min) active:bg-(--rapo-color-bg-transparent-pressed)`}>{p + 1}</Link>)}
      {넘김(page + 1, '다음', page < pages - 1)}
    </nav>
  );
}

/* ── 자리표시 막대 ─────────────────────────────────────────
   RAPO / Skeleton / 자리표시자 1412:55393 — palette/gray-300 · radius 4 */
export function RapoSkeleton({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-(--rapo-radius-r1) bg-(--rapo-color-palette-gray-300) ${className}`} />;
}

/* ── 원본 SVG 를 글자색으로 칠하기 ─────────────────────────────
   Figma 원본 아이콘은 색이 SVG 안에 박혀 있습니다. 켜짐·꺼짐처럼 색만 다른 모양은
   원본 모양을 **가림판(mask)** 으로 쓰고 글자색(currentColor)으로 칠합니다 —
   모양·크기는 원본 그대로이고 색만 토큰을 따릅니다. */
export function RapoMaskIcon({ src, w, h, className = '' }: { src: string; w: number; h: number; className?: string }) {
  const m = `url(${src})`;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: w, height: h,
        maskImage: m, WebkitMaskImage: m,
        maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
      }}
    />
  );
}
