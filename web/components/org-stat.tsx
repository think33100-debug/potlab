'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { DiagTag } from '@/components/diag';
import { Icon } from '@/components/icon';
import { JobBusy } from '@/components/job-busy';
import { JobHospital } from '@/components/job-hospital';
import { JobVeil } from '@/components/job-veil';
import { Rise } from '@/components/job-parts';
import { browserSupabase } from '@/lib/supabase-browser';
import type { HospitalStat } from '@/lib/hospital';
import type { OrgStat as Row } from '@/lib/org';

/* 기관 상세의 인원 카드와 바쁨. 공고 상세에서 만든 부품을 그대로 씁니다.

   왜 화면(client)에서 받아오는가 — 서버 렌더는 익명 열쇠로 돌아서 누가 보는지
   모릅니다. 이 숫자는 회원만 받을 수 있어야 해서(org_detail 이 auth.uid() 를 봅니다),
   로그인한 브라우저가 직접 물어봅니다. 화면을 흐리는 것만으로는 안 막힙니다 —
   요청을 쏘면 그대로 나갔습니다.

   세 값으로 갈립니다.
     확인 중   아무것도 안 그립니다. 흐림도 자물쇠도 안 겁니다
     비로그인  자물쇠 카드. 없는 숫자를 지어내 흐리지 않습니다
     로그인    진짜 숫자. 가입을 아직 안 마쳤으면 JobVeil 이 흐립니다 */
export function OrgStat({
  name, sido, staffed, icons,
}: {
  name: string; sido: string | null; staffed: boolean; icons: Record<string, string>;
}) {
  const { loading, session } = useAuth();
  /* undefined = 아직 안 물어봄 */
  const [row, setRow] = useState<Row | null | undefined>(undefined);

  useEffect(() => {
    if (loading || !staffed) return;
    if (!session) { setRow(null); return; }
    browserSupabase()
      .rpc('org_detail', { p_name: name, p_sido: sido })
      .then(({ data }) => setRow(((data ?? []) as Row[])[0] ?? null));
  }, [loading, session, name, sido, staffed]);

  /* 인력 자료가 없는 기관은 이 구역을 통째로 감춥니다. 0 으로 채우지 않습니다 */
  if (!staffed) return null;
  if (loading || row === undefined) return null;

  if (!session) return <Locked />;
  if (!row) return null;

  /* 공고 상세의 부품이 쓰는 모양으로 맞춥니다 */
  const h: HospitalStat = {
    name: row.name,
    kind: row.hosp_kind ?? (row.kinds ?? [])[0] ?? '기관',
    bed: row.bed ?? row.capacity ?? 0,
    rehab: row.rehab,
    ot: row.ot,
    pt: row.pt,
    per_bed: row.per_bed ?? 0,
    kind_med: row.kind_med,
    kind_p25: row.kind_p25,
    kind_p75: row.kind_p75,
    kind_n: row.kind_n,
    band: row.band,
    data_version: row.data_version,
  };

  return (
    <JobVeil>
      <Rise><JobHospital h={h} icons={icons} /></Rise>
      {h.band && <Rise><JobBusy h={h} icons={icons} /></Rise>}
    </JobVeil>
  );
}

function Locked() {
  return (
    <section className="mt-7 flex flex-col items-center rounded-[14px] border border-[#E3E3DE]
                        bg-white px-6 py-8 text-center">
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[#14181C]">
        <Icon name="lock" size={22} className="text-white" />
      </span>
      <h2 className="mt-4 break-keep text-[22px] font-black leading-[1.35] text-[#14181C]">
        이 병원이 어떤 곳인지<br />회원만 볼 수 있어요
      </h2>
      <p className="mt-3 max-w-[20rem] break-keep text-[14px] leading-[1.7] text-[#4A5056]">
        치료사 인원 · 병상 · 얼마나 바쁜 곳인지까지. 가입은 3분이면 끝나요.
      </p>
      <Link
        href="/login"
        className="mt-6 flex h-[54px] w-full max-w-[22rem] items-center justify-center
                   rounded-[12px] bg-[#FF3B30] text-[16px] font-bold text-white
                   transition-transform duration-[120ms] active:translate-y-[2px]
                   active:scale-[0.99] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]
                   motion-reduce:transition-none"
      >
        가입하고 전부 보기
      </Link>
      <p className="mt-3 break-keep text-[12px] text-[#5F666C]">
        카카오 · 네이버로 3초 만에 시작해요
      </p>
      <DiagTag 이름="components/org-stat.tsx · 화면(session 없음으로 봄)" />
    </section>
  );
}
