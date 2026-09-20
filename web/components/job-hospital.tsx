'use client';

import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import { busyPercent, busyWord, type HospitalStat } from '@/lib/hospital';
import { useCountUp, useGrow } from '@/lib/reveal';

/* 이 화면의 중심입니다.

   밝은 화면 한가운데가 검게 들어가면서 시선이 한 번 걸립니다.
   숫자는 전부 DB 에서 옵니다 — 여기에 박아 넣은 값은 하나도 없습니다.

   병원 자료가 없는 공고는 이 구역을 **통째로 감춥니다**.
   0 으로 채우면 「치료사가 없는 병원」으로 읽혀서 더 나쁩니다. */

const OT = '작업치료사';
const PT = '물리치료사';

function Num({
  to, unit, label, hot, digits = 0, slot,
}: {
  to: number | null; unit: string; label: string; hot: boolean;
  digits?: number; slot: string;
}) {
  const { ref, n } = useCountUp(to ?? 0, 1100, digits);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[13px] text-[#8A9299]">
        <Icon name={slot} size={14} className="shrink-0" />
        <span className="break-keep">{label}</span>
      </div>
      <div className={`num text-[34px] leading-none ${hot ? 'text-[#FF3B30]' : 'text-white'}`}>
        <span ref={ref} className="tabular-nums">{n}</span>
        <span className="ml-1 text-[15px] font-medium text-[#8A9299]">{unit}</span>
      </div>
    </div>
  );
}

export function JobHospital({
  h, icons,
}: { h: HospitalStat; icons: Record<string, string> }) {
  const { me } = useAuth();
  /* 보는 사람의 직군만 빨강입니다. 로그인 전에는 둘 다 흰색 */
  const mine = me?.job_group ?? null;
  const word = busyWord(h);
  const pct = busyPercent(h);
  const bar = useGrow(pct);

  return (
    <section className="mt-7">
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1B2025]">
        <Icon name={icons['job.hospital']} size={18} />
        병원 뜯어보기
      </h2>

      <div className="mt-3 rounded-[14px] bg-[#14181C] p-6">
        <p className="break-keep text-[15px] text-[#8A9299]">{h.name}</p>

        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7">
          <Num slot={icons['job.bed']} to={h.bed} unit="개" label="병상" hot={false} />
          <Num slot={icons['job.rehab']} to={h.rehab} unit="명"
               label="재활의학과 전문의" hot={false} />
          <Num slot={icons['job.ot']} to={h.ot} unit="명" label={OT} hot={mine === OT} />
          <Num slot={icons['job.pt']} to={h.pt} unit="명" label={PT} hot={mine === PT} />
        </div>

        {/* 인원 수보다 이게 근무 강도를 말해줍니다 */}
        <div className="mt-6 rounded-[10px] bg-[#1B2025] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[15px] text-[#C7CDD2]">
              치료사 한 명당 병상{' '}
              <PerBed to={h.per_bed} />
              <span className="text-[15px] font-medium text-[#8A9299]">개</span>
            </p>
            <p className="break-keep text-[13px] text-[#8A9299]">{word.line}</p>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#2A3037]">
            <div
              ref={bar.ref}
              className="h-full rounded-full bg-[#FF3B30] motion-reduce:transition-none"
              style={{ width: `${bar.w}%`, transition: `width ${bar.ms}ms ease-out` }}
            />
          </div>
        </div>

        {/* 이 한 줄을 빼면 공고에서 뽑는 인원으로 읽힙니다 */}
        <p className="mt-5 break-keep text-[12px] leading-relaxed text-[#6C757C]">
          심평원 {h.data_version ?? '최근'} 기준이에요. 공고에 적힌 인원이 아니라
          병원 전체 인원입니다
        </p>
      </div>
    </section>
  );
}

/* 12.1 처럼 소수점 있는 값도 자연스럽게 오릅니다 */
function PerBed({ to }: { to: number }) {
  const { ref, n } = useCountUp(to, 1100, 1);
  return (
    <span ref={ref} className="num tabular-nums text-[22px] text-white">{n}</span>
  );
}
