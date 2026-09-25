import type { SupabaseClient } from '@supabase/supabase-js';
import { BUSY_COLOR } from './brand';

/* 「병원 뜯어보기」에 쓰는 숫자.

   전부 심평원 자료입니다. 공고에 적힌 인원이 아니라 **병원 전체 인원**입니다 —
   화면에도 그 한 줄을 반드시 남깁니다. 안 적으면 「이 공고에서 작업치료사 9명을
   뽑는구나」로 읽힙니다.

   band 는 같은 종별끼리 견준 결과입니다 (org_hospital_stat 뷰).
     easy  같은 종별에서 아래 25%
     mid   가운데 50%
     busy  위 25%
   왜 종별끼리인지 · 왜 중위값인지는 뷰의 주석에 적어 뒀습니다. */
export type HospitalStat = {
  name: string;
  kind: string;
  bed: number;
  rehab: number | null;
  ot: number | null;
  pt: number | null;
  per_bed: number;
  kind_med: number | null;
  kind_p25: number | null;
  kind_p75: number | null;
  kind_n: number | null;
  band: 'easy' | 'mid' | 'busy' | null;
  data_version: string | null;
};

/* 기관 이름으로 찾습니다. 못 찾으면 null —
   화면은 이 구역을 통째로 감춥니다. 0 으로 채우지 않습니다.

   이름 맞추기(org_key)는 DB 함수라 여기서 못 합니다. 같은 규칙을 화면에
   또 적으면 반드시 어긋나므로, DB 함수 하나를 부릅니다. */
/* 2026-09-25 — **회원만 봅니다.** org_hospital_by_name 의 실행 권한을
   anon 에서 걷었습니다. 그래서 열쇠꾸러미를 받아야 합니다 —
   로그인 안 한 사람으로 부르면 권한 오류가 나고 여기서 null 이 됩니다.
   화면은 그 구역을 통째로 감추고 가입 권유를 그립니다. */
export async function hospitalStat(
  sb: SupabaseClient, orgName: string,
): Promise<HospitalStat | null> {
  if (!orgName) return null;
  const { data } = await sb
    .rpc('org_hospital_by_name', { p_name: orgName })
    .maybeSingle();
  return (data as unknown as HospitalStat | null) ?? null;
}

/* 바쁨 세 칸에 쓰는 말 · 아이콘 · 색.

   종별 이름이 반드시 들어갑니다 — 무슨 기준인지 안 밝히면 읽는 사람이
   전국 평균으로 오해합니다. 종별은 공고마다 바뀝니다.
   세 경우 모두 마지막 줄에서 기준을 다시 밝힙니다.

   초록이 「좋은 곳」으로만 읽히지 않게 씁니다 —
   환자가 적다는 건 자리도 자주 안 난다는 뜻이기도 합니다.

   이모지는 안 씁니다. 기기마다 모양이 달라 아이폰과 안드로이드가 다르게
   보이고, 홈 화면에서 이미 전부 뺐습니다. 대신 **채운 아이콘**을 씁니다. */
export const BANDS = [
  { key: 'easy', label: '여유로운 곳', icon: 'leaf' },
  { key: 'mid',  label: '보통',       icon: 'equal' },
  { key: 'busy', label: '바쁜 곳',    icon: 'flame' },
] as const;

export type BandKey = (typeof BANDS)[number]['key'];

export function busyWord(h: HospitalStat): {
  label: string; icon: string; color: string;
  where: string; head: string; body: string; basis: string;
} {
  const kind = h.kind || '같은 종별';
  const basis = `같은 ${kind}끼리 견줘서 매긴 기준이에요.`;

  if (h.band === 'easy') {
    return {
      label: '여유로운 곳', icon: 'leaf', color: BUSY_COLOR.easy,
      where: `같은 ${kind} 중 아래쪽 25%`,
      head: '치료사 한 명이 맡는 환자가 적은 편이에요.',
      body: `일은 덜 몰리지만, 그만큼 자리가 자주 나지는 않습니다. ${basis}`,
      basis,
    };
  }
  if (h.band === 'busy') {
    return {
      label: '바쁜 곳', icon: 'flame', color: BUSY_COLOR.busy,
      where: `같은 ${kind} 중 위쪽 25%`,
      head: '치료사 한 명이 맡는 환자가 많은 편이에요.',
      body: `손은 바쁘지만 그만큼 사람을 자주 뽑습니다. ${basis}`,
      basis,
    };
  }
  return {
    label: '보통', icon: 'equal', color: BUSY_COLOR.mid,
    where: `같은 ${kind} 중 가운데 50%`,
    head: '치료사 한 명이 맡는 환자가 중간쯤이에요.',
    body: basis,
    basis,
  };
}
