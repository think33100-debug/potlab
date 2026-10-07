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
  /* 왜 감췄나 — 「재판정으로 버림 (9/28)」 · 「마감 지남」 · 「45일 지남」 … */
  hidden_why: string | null;
  hidden_on: string | null;
  /* 관리자가 손으로 정한 공고 — 규칙이 못 덮어씁니다 (2026-09-29) */
  admin_locked: boolean;
  admin_at: string | null;
  admin_note: string | null;
  /* 마감일 자리에 쓸 말 (2026-10-07 · DB 의 마감표시()). 회원 화면과 글자가 같습니다 */
  마감표시: string | null;
};

/* evidence 를 함께 받습니다 — 보류함에서 **왜 보류인지**를 목록에서
   바로 보여주려고입니다 (2026-09-25). 없으면 관리자가 한 건씩 열어
   원문을 읽어야 합니다. jsonb 한 칸이라 목록이 많이 무거워지지 않습니다 */
export const ADMIN_LIST_COLS =
  'id,source,org_name,title,job_group,employ_type,work_place,sido,tab,'
  + 'headcount,apply_to,posted_at,hidden,hold,collected_at,evidence,hidden_why,admin_locked,'
  + 'admin_note,마감표시';

export type AdminJobListItem = Pick<
  AdminJob,
  'id' | 'source' | 'org_name' | 'title' | 'job_group' | 'employ_type' | 'work_place'
  | 'sido' | 'tab' | 'headcount' | 'apply_to' | 'posted_at' | 'hidden' | 'hold' | 'collected_at'
  | 'evidence' | 'hidden_why' | 'admin_locked' | 'admin_note' | '마감표시'
>;

/* 관리자가 매일 보는 칸들. 「보류」가 첫째입니다 —
   못 가린 공고가 여기 쌓이고, 관리자가 확인해서 올립니다 */
export const STATES = [
  { key: 'hold',   label: '보류함',   hint: '못 가린 공고 · 확인해서 올릴 것' },
  { key: 'live',   label: '올라간 것', hint: '회원에게 보이는 공고' },
  { key: 'hidden', label: '숨긴 것',   hint: '안 보이게 치운 공고' },
  /* 규칙을 바꾼 뒤 다시 판정해 감춘 것만 따로 봅니다 (2026-09-28).
     「숨긴 것」 에는 마감 지남·쓰레기통 등 450건이 섞여 있어 못 찾습니다.
     **지운 것이 아니라 감춘 것**이라 여기서 되살릴 수 있습니다 */
  { key: 'rejudged', label: '재판정으로 버림', hint: '규칙을 바꿔 다시 판정한 것 · 되살릴 수 있습니다' },
  /* 마감일이 없어 날수로 내린 공고입니다 (2026-10-07).
     기관이 아직 뽑고 있는데 우리가 접수기간을 못 읽은 것일 수 있어
     **사람이 한 번 봐야 합니다.** 되살릴 수 있습니다.
     사유는 hide_stale_posts 가 「30일 지남」 으로 적습니다 (전에는 45일). */
  { key: 'needcheck', label: '확인 필요', hint: '마감일 없이 날수가 지나 내린 공고 · 아직 뽑는 중일 수 있습니다' },
  /* ★ 2026-10-07 — 올라가 있는데 **마감일을 못 읽은** 공고 (세중님 지시).
     DB 의 마감표시() 가 「마감일 공고문 확인」 이라고 한 것만 모입니다.
     원문에 「채용시까지·상시·수시」 가 적힌 진짜 수시 공고는 여기 안 옵니다 —
     그건 「수시채용」 으로 갈라집니다. 여기 있는 것은 **우리가 못 읽은 것**이라
     사람이 원 공고문을 열어 접수기간을 넣어 주면 됩니다 */
  { key: 'nodeadline', label: '마감일 못 읽음', hint: '회원에게 보이는데 접수기간을 못 읽은 공고 · 원 공고문을 열어 채워 주십시오' },
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
