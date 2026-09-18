import { createClient } from '@supabase/supabase-js';

/* 브라우저에 나가도 되는 열쇠입니다.
   무엇을 읽을 수 있는지는 DB 쪽 RLS 가 정합니다 — 여기서 막는 게 아닙니다.
   service_role 키는 절대 이쪽에 두지 않습니다. */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

/* 지금 화면이 쓰는 칸만 적습니다.
   표 전체 타입이 필요해지면 그때 만들면 됩니다 (supabase gen types). */
export type JobPost = {
  id: string;
  source: string;
  org_name: string;
  title: string;
  hire_type: string | null;
  employ_type: string | null;
  work_place: string | null;
  sido: string | null;
  sgg: string | null;
  edu: string | null;
  headcount: number | null;
  apply_from: string | null;
  apply_to: string | null;
  posted_at: string | null;
  url: string;
  job_group: string | null;
  org_kind: string | null;
  tab: string | null;
  detail: Record<string, string>;
  evidence: Record<string, string>;
  collected_at: string;
};

/* 목록에서는 본문(detail)을 안 받습니다 — 전송량이 열 배 차이납니다 */
export const LIST_COLS =
  'id,source,org_name,title,employ_type,work_place,sido,job_group,org_kind,apply_from,apply_to,posted_at,headcount';

export type JobListItem = Pick<
  JobPost,
  'id' | 'source' | 'org_name' | 'title' | 'employ_type' | 'work_place'
  | 'sido' | 'job_group' | 'org_kind' | 'apply_from' | 'apply_to' | 'posted_at' | 'headcount'
>;

export const SOURCE_NAME: Record<string, string> = {
  WN: '워크넷', HS: '병원 게시판', AL: '알리오', GJ: '나라일터',
  ND: '치매센터', CE: '클린아이', BZ: '기업 직접등록',
};
