import { supabase } from './supabase';

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
export async function hospitalStat(orgName: string): Promise<HospitalStat | null> {
  if (!orgName) return null;
  const { data } = await supabase
    .rpc('org_hospital_by_name', { p_name: orgName })
    .maybeSingle();
  return (data as unknown as HospitalStat | null) ?? null;
}

/* 「같은 종합병원끼리 견줬을 때 …」 — 종별 이름이 반드시 들어갑니다.
   무슨 평균인지 안 밝히면 읽는 사람이 전국 평균으로 오해합니다. */
export function busyWord(h: HospitalStat): { label: string; line: string } {
  const kind = h.kind || '같은 종별';
  if (h.band === 'easy') {
    return {
      label: '여유로운 곳',
      line: `같은 ${kind}끼리 견줬을 때 중간보다 적어요`,
    };
  }
  if (h.band === 'busy') {
    return {
      label: '바쁜 곳',
      line: `같은 ${kind}끼리 견줬을 때 중간보다 많습니다`,
    };
  }
  return {
    label: '보통',
    line: `같은 ${kind}끼리 견줬을 때 중간쯤이에요`,
  };
}

/* 막대에서 채울 비율(0~100).
   눈금이 세 칸이라 칸 안에서도 위치가 보이게 폅니다 —
   여유 0~33 · 보통 33~67 · 바쁨 67~100 */
export function busyPercent(h: HospitalStat): number {
  const { per_bed: v, kind_p25: a, kind_p75: b } = h;
  if (a == null || b == null || b <= a) return 50;
  if (v <= a) return Math.max(6, (v / a) * 33);
  if (v >= b) return Math.min(100, 67 + Math.min(1, (v - b) / b) * 33);
  return 33 + ((v - a) / (b - a)) * 34;
}
