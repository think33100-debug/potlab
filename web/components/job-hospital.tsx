'use client';

import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import type { HospitalStat } from '@/lib/hospital';
import { useCountUp } from '@/lib/reveal';

/* 이 화면의 중심입니다.

   밝은 화면 한가운데가 검게 들어가면서 시선이 한 번 걸립니다.
   숫자는 전부 DB 에서 옵니다 — 여기에 박아 넣은 값은 하나도 없습니다.

   병원 자료가 없는 공고는 이 구역을 **통째로 감춥니다**.
   0 으로 채우면 「치료사가 없는 병원」으로 읽혀서 더 나쁩니다.

   「치료사 한 명당 병상 N개」는 화면에서 뺐습니다 (2026-09-20).
   바쁨을 가르는 근거로는 계속 씁니다 — 안 보일 뿐입니다 (lib/hospital.ts). */

const OT = '작업치료사';
const PT = '물리치료사';

/* 어느 시점 자료인지 한 줄로. data_version 은 두 가지로 옵니다 —
     「심평원 2026-09-25」  API 로 받은 곳 (의료기관별상세정보서비스)
     「2026Q2」             아직 못 받아 자료판을 쓰는 곳
   기관이 55,338곳이라 전부 받는 데 며칠 걸립니다. 그동안 섞여 있습니다 */
function srcWord(v: string | null): string {
  if (!v) return '심사평가원에서 받아온 자료입니다.';
  const day = v.match(/^심평원 (\d{4}-\d{2}-\d{2})$/)?.[1];
  if (day) return `심사평가원 ${day} 기준입니다.`;
  const q = v.match(/^(\d{4})Q([1-4])$/);
  if (q) return `심사평가원 ${q[1]}년 ${q[2]}분기 자료입니다.`;
  return `심사평가원 ${v} 자료입니다.`;
}

function Num({
  to, unit, label, hot, slot,
}: {
  to: number | null; unit: string; label: string; hot: boolean; slot: string;
}) {
  const { ref, n } = useCountUp(to ?? 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[13px] text-[#8A9299]">
        <Icon name={slot} size={14} className="shrink-0" />
        <span className="break-keep">{label}</span>
      </div>
      <div className={`num text-[40px] leading-none ${hot ? 'text-[#FF3B30]' : 'text-white'}`}>
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

  return (
    <section className="mt-7">
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1B2025]">
        <Icon name={icons['job.hospital']} size={18} />
        병원 뜯어보기
      </h2>

      <div className="mt-3 rounded-[14px] bg-[#14181C] p-6">
        {/* 위에 「모집 인원 3명」이 있는데 아래 「작업치료사 24」가 나오면 헷갈립니다.
            이 표 하나로 그게 풀립니다. 빼지 마세요 */}
        <p className="inline-block rounded-[8px] bg-[#2A3138] px-[11px] py-[6px]
                      text-[11px] font-bold text-[#C6CCD2]">
          병원 전체 인원
        </p>

        <p className="mt-3 break-keep text-[15px] text-[#8A9299]">{h.name}</p>

        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7">
          <Num slot={icons['job.bed']} to={h.bed} unit="개" label="병상" hot={false} />
          <Num slot={icons['job.rehab']} to={h.rehab} unit="명"
               label="재활의학과 전문의" hot={false} />
          <Num slot={icons['job.ot']} to={h.ot} unit="명" label={OT} hot={mine === OT} />
          <Num slot={icons['job.pt']} to={h.pt} unit="명" label={PT} hot={mine === PT} />
        </div>

        {/* 언제 받은 값인지 밝힙니다 (2026-09-25).
            줄마다 다릅니다 — API 로 받은 곳은 그날 값, 아직 못 받은 곳은
            2026Q2 자료판 값입니다. 한 문구로 뭉뚱그리면 거짓이 됩니다 */}
        <p className="mt-6 break-keep text-[12px] leading-relaxed text-[#6C757C]">
          {srcWord(h.data_version)} 실제와 다를 수 있어요.
        </p>
      </div>
    </section>
  );
}
