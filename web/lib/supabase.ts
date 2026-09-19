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
  'id,source,org_name,title,employ_type,work_place,sido,job_group,org_kind,tab,apply_from,apply_to,posted_at,headcount';

export type JobListItem = Pick<
  JobPost,
  'id' | 'source' | 'org_name' | 'title' | 'employ_type' | 'work_place'
  | 'sido' | 'job_group' | 'org_kind' | 'tab'
  | 'apply_from' | 'apply_to' | 'posted_at' | 'headcount'
>;

export const SOURCE_NAME: Record<string, string> = {
  WN: '워크넷', HS: '병원 게시판', AL: '알리오', GJ: '나라일터',
  ND: '치매센터', CE: '클린아이', BZ: '기업 직접등록',
};

/* 화면은 네 탭인데 DB 의 tab 칸은 여섯 값입니다.
     공공기관·대학·종합 · 공공 / · 종합 / · 대학   ← 셋이 한 탭
   그래서 eq 가 아니라 like 로 맞춥니다. 뒤에 % 가 없는 것은 like 여도 eq 와 같습니다. */
export const TABS = [
  { key: 'public', label: '공공기관·대학·종합', like: '공공기관·대학·종합%' },
  { key: 'rehab',  label: '재활·요양병원·의원', like: '재활·요양병원·의원' },
  { key: 'child',  label: '아동·정신센터',      like: '아동·정신센터' },
  { key: 'ltc',    label: '요양원·노인센터',    like: '요양원·노인센터' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

/** DB 의 tab 값을 화면의 네 탭 이름으로 줄입니다 (「공공기관·대학·종합 · 대학」 → 「공공기관·대학·종합」) */
export function tabLabel(tab: string | null): string {
  if (!tab) return '';
  return TABS.find((t) => tab.startsWith(t.label))?.label ?? tab;
}

/* 기관 대조용 머티리얼라이즈드 뷰 (62,749줄 · 표 9개를 이어붙인 것).
   칸은 이것뿐입니다 — 더 필요하면 원본 표를 봐야 합니다 */
export type OrgRow = {
  source: string;
  name: string;
  kind: string | null;
  sido: string | null;
  sgg: string | null;
  addr: string | null;
};

export const ORG_SOURCE_NAME: Record<string, string> = {
  hospital: '심평원 병원정보',
  public: '공공보건의료기관',
  dementia: '치매센터',
  dev_rehab: '발달재활서비스',
  ltc: '장기요양기관',
  mental: '정신건강시설',
  welfare_ctr: '사회복지관',
  welfare: '사회복지시설',
};
