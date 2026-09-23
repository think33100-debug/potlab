'use client';

import { useCountTo } from '@/lib/reveal';

/* 계산기 셋이 같이 쓰는 조각들 (연봉 · 퇴직금 · 연차).

   세 벌로 두면 다음에 「기준을 밝히는 줄」 문구를 고칠 때 한쪽만 고치게 됩니다.

   색은 전부 여기서 정합니다 —
     바탕 #F4F4F1 · 카드 #FFFFFF · 어두운 카드 #14181C · 빨강 #FF3B30
   빨강 위 흰 글자는 16px 이상 굵게만 씁니다 (#FF3B30 위 흰 글자가 3.55:1). */

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
      <span className="block break-keep text-sm font-bold text-[#5F666C]">{label}</span>
      <span className="mt-2 flex items-center gap-3">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          /* 숫자 자판 — type="number" 는 위아래 화살표가 붙고 붙여넣기가 까다로워
             text 에 inputMode 를 답니다. 소수점 있는 학점 칸과 같은 방식입니다 */
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xs border border-[#E3E3DE] bg-white px-5 py-4
                     text-[17px] text-[#14181C] placeholder:text-[#8A9299]"
        />
        {unit && <span className="shrink-0 break-keep text-[15px] text-[#5F666C]">{unit}</span>}
      </span>
      {hint && <span className="mt-1 block break-keep text-sm text-[#5F666C]">{hint}</span>}
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
      <span className="block break-keep text-sm font-bold text-[#5F666C]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xs border border-[#E3E3DE] bg-white px-5 py-4
                   text-[17px] text-[#14181C]"
      />
      {hint && <span className="mt-1 block break-keep text-sm text-[#5F666C]">{hint}</span>}
    </label>
  );
}

/* ── 결과 ────────────────────────────────────────── */

/** 제일 큰 숫자 하나. 값이 바뀌면 세어 올라갑니다 (움직임 줄이기면 바로) */
export function BigNum({
  label, value, unit, sub,
}: {
  label: string; value: number; unit: string; sub?: string;
}) {
  const n = useCountTo(value);
  return (
    <div className="rounded-[14px] bg-[#14181C] p-7 text-white">
      <p className="break-keep text-[13px] text-[#9BA3AB]">{label}</p>
      <p className="num mt-2 text-[40px] font-black leading-none tabular-nums">
        {n.toLocaleString('ko-KR')}
        <span className="ml-1 text-[17px] font-medium text-[#9BA3AB]">{unit}</span>
      </p>
      {sub && <p className="mt-3 break-keep text-[14px] text-[#9BA3AB]">{sub}</p>}
    </div>
  );
}

/** 줄줄이 늘어놓는 값 한 줄 */
export function Line({
  k, v, strong = false,
}: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-5 border-b border-[#ECECE8] py-4
                    last:border-0">
      <span className="break-keep text-[14px] text-[#5F666C]">{k}</span>
      <span className={'num shrink-0 tabular-nums '
        + (strong ? 'text-[17px] font-black text-[#14181C]' : 'text-[15px] text-[#14181C]')}>
        {v}
      </span>
    </div>
  );
}

/** 흰 카드 */
export function Card({
  title, note, children,
}: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
      {title && <h2 className="break-keep text-[17px] font-bold text-[#1B2025]">{title}</h2>}
      {note && <p className="mt-1 break-keep text-sm leading-relaxed text-[#5F666C]">{note}</p>}
      <div className={title || note ? 'mt-5' : ''}>{children}</div>
    </section>
  );
}

/** 맨 아래 기준과 한계. **계산기마다 반드시 하나씩 답니다** */
export function Basis({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 break-keep rounded-[10px] bg-[#ECECE8] p-5 text-[12px]
                  leading-relaxed text-[#5F666C]">
      {children}
    </p>
  );
}

/** 못 계산하는 경우의 안내 (1년 미만 퇴직 같은) */
export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-[14px] border border-[#FF3B30]/30 bg-brand-red-soft p-6">
      <p className="break-keep text-[15px] leading-relaxed text-brand-red-dark">{children}</p>
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
