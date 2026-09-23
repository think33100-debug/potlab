import { supabase } from './supabase';

/* 공고 조회수.

   page_hits 는 넣기만 되고 읽기 규칙이 없습니다 — 날것을 열면 누가 무엇을
   봤는지 훑을 수 있어서요. 그래서 센 값만 내주는 함수(job_views)를 부릅니다.
   관리자가 본 것은 DB 쪽에서 뺍니다.

   지금 화면에 보이는 공고 id 만 넘깁니다. 표 전체를 미리 집계해 두는
   표는 안 만들었습니다 — 자료가 504줄이라 그럴 값이 아닙니다. */
export async function jobViews(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('job_views', { p_ids: ids });
  /* 숫자를 못 세도 공고는 보여야 합니다. 조용히 0 으로 둡니다 */
  if (error) return {};
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: { job_id: string; views: number }) => { out[r.job_id] = r.views; });
  return out;
}
