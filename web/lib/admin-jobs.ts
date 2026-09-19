/* 관리자 공고 화면이 쓰는 것들.

   회원 화면은 job_posts 를 그대로 읽지만 관리자는 admin_jobs 뷰를 봅니다.
   두 가지가 다릅니다 —
     · 숨김·보류 공고도 나옵니다
     · 출처·수집일·분류근거가 나옵니다 (회원에게는 칸 권한으로 막혀 있습니다)

   뷰 안이 is_admin() 으로 잠겨 있어서, 관리자가 아니면 권한 오류가 납니다. */

export type AdminJob = {
  id: string;
  source: string;
  org_name: string;
  title: string;
  job_group: string | null;
  employ_type: string | null;
  work_place: string | null;
  sido: string | null;
  sgg: string | null;
  org_kind: string | null;
  tab: string | null;
  headcount: number | null;
  apply_from: string | null;
  apply_to: string | null;
  posted_at: string | null;
  url: string;
  hidden: boolean;
  hold: boolean;
  detail: Record<string, string>;
  evidence: Record<string, string> | null;
  collected_at: string;
  updated_at: string;
};

export const ADMIN_LIST_COLS =
  'id,source,org_name,title,job_group,employ_type,work_place,sido,tab,'
  + 'headcount,apply_to,posted_at,hidden,hold,collected_at';

export type AdminJobListItem = Pick<
  AdminJob,
  'id' | 'source' | 'org_name' | 'title' | 'job_group' | 'employ_type' | 'work_place'
  | 'sido' | 'tab' | 'headcount' | 'apply_to' | 'posted_at' | 'hidden' | 'hold' | 'collected_at'
>;

/* 관리자가 매일 보는 칸들. 「보류」가 첫째입니다 —
   못 가린 공고가 여기 쌓이고, 관리자가 확인해서 올립니다 */
export const STATES = [
  { key: 'hold',   label: '보류함',   hint: '못 가린 공고 · 확인해서 올릴 것' },
  { key: 'live',   label: '올라간 것', hint: '회원에게 보이는 공고' },
  { key: 'hidden', label: '숨긴 것',   hint: '안 보이게 치운 공고' },
  { key: 'all',    label: '전체',     hint: '' },
] as const;

export type StateKey = (typeof STATES)[number]['key'];

/* 관리자가 손으로 고칠 수 있는 칸.
   id 와 수집기가 쓰는 칸은 뺐습니다 — DB 권한에서도 같이 막아뒀습니다 */
export const EDITABLE: { key: keyof AdminJob; label: string; long?: boolean }[] = [
  { key: 'org_name',   label: '기관명' },
  { key: 'title',      label: '공고명', long: true },
  { key: 'job_group',  label: '직군' },
  { key: 'employ_type', label: '고용형태' },
  { key: 'work_place', label: '근무지' },
  { key: 'sido',       label: '시도' },
  { key: 'sgg',        label: '시군구' },
  { key: 'org_kind',   label: '기관종별' },
  { key: 'tab',        label: '탭분류', long: true },
  { key: 'apply_from', label: '접수시작' },
  { key: 'apply_to',   label: '접수마감' },
  { key: 'posted_at',  label: '공고일' },
  { key: 'url',        label: '원문 주소', long: true },
];
