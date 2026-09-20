'use client';

import { Icon } from '@/components/icon';
import { BANDS, busyWord, type HospitalStat } from '@/lib/hospital';
import { useSeen } from '@/lib/reveal';

/* 「얼마나 바쁜 곳인지」 — 위 어두운 카드의 숫자를 말로 풀어줍니다.

   칸 세 개입니다. 해당하는 칸만 커지며 빨갛게 찹니다.
   가는 막대로는 「내가 어디쯤인지」가 한눈에 안 들어와서 바꿨습니다 (2026-09-20).

   가르는 근거는 「치료사 한 명당 병상 수」인데 화면에는 안 씁니다.
   같은 종별에서 아래 25% 가 여유, 위 25% 가 바쁨입니다 —
   왜 전체가 아니라 종별인지 · 왜 평균이 아니라 중위값인지는
   org_hospital_stat 뷰의 주석에 있습니다. */

export function JobBusy({
  h, icons,
}: { h: HospitalStat; icons: Record<string, string> }) {
  const w = busyWord(h);
  /* 세 칸이 같은 크기로 시작해서 해당하는 칸만 커집니다. 한 번만 */
  const { ref, seen } = useSeen<HTMLDivElement>();

  return (
    <section className="mt-7">
      <p className="text-[12px] font-bold tracking-[0.08em] text-[#5F666C]">
        <span className="mr-2 inline-block h-[2px] w-4 -translate-y-[3px]"
              style={{ backgroundColor: w.color }} />
        얼마나 바쁜 곳인지
      </p>

      <div className="mt-3 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center
                           rounded-[15px]"
                style={{ backgroundColor: w.color }}>
            <Icon name={w.icon} size={26} filled className="text-white" />
          </span>
          <span className="min-w-0">
            <span className="block break-keep text-[28px] font-black leading-none
                             tracking-[-0.035em]"
                  style={{ color: w.color }}>
              {w.label}
            </span>
            <span className="mt-1.5 block break-keep text-[12px] font-bold text-[#5F666C]">
              {w.where}
            </span>
          </span>
        </div>

        {/* 칸 세 개 — 아래를 맞춰 세웁니다 */}
        <div ref={ref} className="mt-6 flex items-end gap-2">
          {BANDS.map((b) => {
            const on = b.key === h.band;
            return (
              <div
                key={b.key}
                className={
                  'flex items-center justify-center gap-1.5 overflow-hidden '
                  + 'motion-reduce:transition-none '
                  + (on ? 'rounded-[16px] text-white' : 'rounded-[12px] text-[#8A9096]')
                }
                style={{
                  backgroundColor: on ? w.color : '#F4F4F1',
                  /* 움직임 줄이기면 seen 이 처음부터 true 라 곧바로 최종 모습입니다 */
                  height: on ? (seen ? 72 : 56) : 56,
                  flexGrow: on ? (seen ? 1.15 : 1) : 1,
                  flexBasis: 0,
                  transition: 'height 460ms ease-out, flex-grow 460ms ease-out,'
                              + ' background-color 460ms ease-out',
                }}
              >
                {on && <Icon name={b.icon} size={16} filled className="shrink-0" />}
                <span className={on
                  ? 'break-keep text-[14px] font-extrabold'
                  : 'break-keep text-[12px] font-bold'}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-6 break-keep text-[15px] font-bold leading-[1.6] text-[#14181C]">
          {w.head}
        </p>
        <p className="mt-1.5 break-keep text-[14px] leading-[1.7] text-[#4A5056]">
          {w.body}
        </p>
      </div>
    </section>
  );
}
