'use client';

import { Icon } from '@/components/icon';
import { busyPercent, busyWord, type HospitalStat } from '@/lib/hospital';
import { useGrow } from '@/lib/reveal';

/* 「얼마나 바쁜 곳인지」 — 위 어두운 카드의 숫자를 말로 풀어줍니다.

   눈금이 세 칸입니다. 같은 종별에서 아래 25% 가 여유, 위 25% 가 바쁨입니다.
   왜 전체가 아니라 종별인지 · 왜 평균이 아니라 중위값인지는
   org_hospital_stat 뷰의 주석에 적어 뒀습니다. */

const TICKS = ['여유로운 곳', '보통', '바쁜 곳'];

export function JobBusy({
  h, icons,
}: { h: HospitalStat; icons: Record<string, string> }) {
  const word = busyWord(h);
  const bar = useGrow(busyPercent(h));

  return (
    <section className="mt-7 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1B2025]">
        <Icon name={icons['job.busy']} size={18} className="text-[#FF3B30]" />
        {word.label}
      </h2>

      <div className="mt-5">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#ECECE8]">
          <div
            ref={bar.ref}
            className="h-full rounded-full bg-[#FF3B30] motion-reduce:transition-none"
            style={{ width: `${bar.w}%`, transition: `width ${bar.ms}ms ease-out` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-[#5F666C]">
          {TICKS.map((t) => <span key={t} className="break-keep">{t}</span>)}
        </div>
      </div>

      <p className="mt-5 break-keep text-[15px] leading-relaxed text-[#4A5056]">
        치료사 한 명이 병상 {h.per_bed}개를 맡습니다. {word.line}.
      </p>
      {h.kind_med != null && h.kind_n != null && (
        <p className="mt-1 break-keep text-[13px] leading-relaxed text-[#5F666C]">
          견준 상대는 전국 {h.kind} {h.kind_n.toLocaleString('ko-KR')}곳이고,
          그 가운데 값은 {h.kind_med.toFixed(1)}개죠
        </p>
      )}
    </section>
  );
}
