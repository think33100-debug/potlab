'use client';

import { useCountTo } from '@/lib/reveal';

/* 계산기 넷이 같이 쓰는 조각들 (실수령액 · 퇴직금 · 연차 · 실업급여).

   2026-11-14 새 디자인으로 바꿨습니다 — 피그마 「T03 · 계산 도구형」(614:861)과 RAPO 토큰만 씁니다.
   이름·인수는 그대로라 계산 화면 쪽 코드는 안 바뀝니다. 틀(위쪽 줄 · 알약 · 제목)은 components/rapo/rapo-tool.tsx 입니다.
   넷 다 같은 조각이어야 「기준을 밝히는 줄」 문구를 고칠 때 한쪽만 고치는 일이 없습니다. */

const 칸틀 = 'min-w-0 flex-1 h-(--rapo-dimension-x13) rounded-(--rapo-radius-r2) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) '
  + 'bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) rapo-type-t5-regular text-(color:--rapo-color-fg-neutral) '
  + 'placeholder:text-(color:--rapo-color-fg-neutral-muted) focus:border-(color:--rapo-color-stroke-focus-ring)';

/* ── 넣는 칸 ─────────────────────────────────────── */

/** 숫자 칸. 휴대폰에서 숫자 자판이 뜨게 inputMode 를 답니다 */
export function NumField({
  label, value, onChange, unit, hint, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="rapo-type-t4-medium block break-keep text-(color:--rapo-color-fg-neutral)">{label}{unit ? ` · ${unit}` : ''}</span>
      <span className="mt-(--rapo-dimension-x2) flex items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          /* 숫자 자판 — type="number" 는 위아래 화살표가 붙고 붙여넣기가 까다로워
             text 에 inputMode 를 답니다. 소수점 있는 학점 칸과 같은 방식입니다 */
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          className={칸틀}
        />
      </span>
      {hint && <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">{hint}</span>}
    </label>
  );
}

/** 날짜 칸. 달력은 브라우저가 띄웁니다 — 직접 만들 이유가 없습니다 */
export function DateField({
  label, value, onChange, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <label className="block">
      <span className="rapo-type-t4-medium block break-keep text-(color:--rapo-color-fg-neutral)">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={칸틀 + ' mt-(--rapo-dimension-x2) w-full'}
      />
      {hint && <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">{hint}</span>}
    </label>
  );
}

/** 「세전으로 넣기 / 세후로 넣기」 같은 둘 중 하나 고르기 */
export function PickTwo<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-(--rapo-dimension-x2)">
      {options.map(([k, t]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
          className={'rapo-type-t4-bold h-(--rapo-touch-min) flex-1 rounded-(--rapo-radius-r2) border-(length:--rapo-border-default) '
            + (value === k
              ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)'
              : 'border-(color:--rapo-color-stroke-neutral-muted) bg-(--rapo-color-bg-layer-default) text-(color:--rapo-color-fg-neutral-muted)')}>
          {t}
        </button>
      ))}
    </div>
  );
}

/* ── 결과 ────────────────────────────────────────── */

/** 제일 큰 숫자 하나 — 피그마 「예상 월 실수령액」 연한 코랄 카드. 값이 바뀌면 세어 올라갑니다 (움직임 줄이기면 바로) */
export function BigNum({
  label, value, unit, sub,
}: {
  label: string; value: number; unit: string; sub?: string;
}) {
  const n = useCountTo(value);
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
      <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-brand-contrast)">{label}</p>
      <p className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
        <span className="rapo-type-t12-bold tabular-nums">{n.toLocaleString('ko-KR')}</span>
        <span className="rapo-type-t6-bold ml-[2px] text-(color:--rapo-color-fg-neutral-muted)">{unit}</span>
      </p>
      {sub && <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{sub}</p>}
    </div>
  );
}

/** 줄줄이 늘어놓는 값 한 줄 */
export function Line({
  k, v, strong = false,
}: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-(--rapo-dimension-x4) border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x3) last:border-0">
      <span className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{k}</span>
      <span className={'shrink-0 tabular-nums text-(color:--rapo-color-fg-neutral) ' + (strong ? 'rapo-type-t5-bold' : 'rapo-type-t4-medium')}>
        {v}
      </span>
    </div>
  );
}

/** 카드 — 넣는 칸이면 제목 없이, 결과면 제목(「산정 기준」 같은)을 답니다 */
export function Card({
  title, note, children,
}: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)">
      {title && <h2 className="rapo-type-t6-bold break-keep text-(color:--rapo-brand-color-navy)">{title}</h2>}
      {note && <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">{note}</p>}
      <div className={title || note ? 'mt-(--rapo-dimension-x3)' : ''}>{children}</div>
    </section>
  );
}

/** 값을 넣기 전 빈 결과 칸 — 피그마 「예상 금액을 확인해 보세요」 */
export function ResultHint({ title = '예상 금액을 확인해 보세요', children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
      <p className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{title}</p>
      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{children}</p>
    </div>
  );
}

/** 맨 아래 기준과 한계 — 피그마 「산정 기준」. **계산기마다 반드시 하나씩 답니다** */
export function Basis({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-(--rapo-dimension-x1)">
      <h2 className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">산정 기준</h2>
      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{children}</p>
    </section>
  );
}

/** 못 계산하는 경우의 안내 (1년 미만 퇴직 같은) — 피그마 「입력 오류」의 빨간 선 꼴 */
export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-critical-solid) bg-(--rapo-color-bg-critical-weak) p-(--rapo-dimension-x5)">
      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-critical-contrast)">{children}</p>
    </div>
  );
}

/* 숫자 칸에서 읽어내기. 쉼표를 넣어도 되게 합니다 */
export const num = (s: string): number => {
  const v = Number(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) ? v : 0;
};

/** 원 단위를 「1,234만원」처럼 */
export const man = (원: number): string =>
  `${Math.round(원 / 10_000).toLocaleString('ko-KR')}만원`;

/** 원 단위를 그대로 쉼표로 */
export const won = (원: number): string => `${Math.round(원).toLocaleString('ko-KR')}원`;
