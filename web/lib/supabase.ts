import { createClient } from '@supabase/supabase-js';

/* 브라우저에 나가도 되는 열쇠입니다.
   무엇을 읽을 수 있는지는 DB 쪽 RLS 가 정합니다 — 여기서 막는 게 아닙니다.
   service_role 키는 절대 이쪽에 두지 않습니다. */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

/* 공고를 받는 길은 2026-09-25 에 함수로 바뀌었습니다.

   전에는 화면이 job_posts_pub 뷰를 직접 읽고 필요한 칸을 골랐습니다.
   그러면 요청을 직접 쏘는 쪽도 똑같이 읽을 수 있어서, 로그인 없이
   한 번에 100건이 나갔습니다 (실제로 쏴서 확인 — 0-99/497).

   지금은 뷰를 통째로 읽는 길을 닫고 함수 셋으로만 엽니다.
     job_one(id)      한 건. 공유 링크가 살아야 해서 누구나. 본문은 회원만
     job_list(...)    목록·검색. 회원만 · 한 번에 20건
     job_counts(...)  탭별 건수. 회원만
     job_totals()     홈에 쓰는 개수. 줄이 안 나가므로 누구나

   그래서 JOB_ONE_COLS · LIST_COLS 같은 칸 목록은 없어졌습니다 —
   무엇을 내줄지는 이제 DB 함수가 정합니다. */

export type JobMeta = {
  id: string;
  source: string;
  collected_at: string;
  evidence: Record<string, string> | null;
  hidden: boolean;
  hold: boolean;
};

/* 지금 화면이 쓰는 칸만 적습니다.
   표 전체 타입이 필요해지면 그때 만들면 됩니다 (supabase gen types). */
export type JobPost = {
  id: string;
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
};

export type JobListItem = Pick<
  JobPost,
  'id' | 'org_name' | 'title' | 'employ_type' | 'work_place'
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

/* ── 커뮤니티 ───────────────────────────────────────── */

/* 글쓴이 이름을 고르는 규칙은 lib/who.ts 에 있습니다 (shownName).
   여기 두면 시험에서 못 불러옵니다 — 이 파일은 열쇠로 클라이언트를 만듭니다 */

export type PostRow = {
  id: number;
  channel: string;
  author_id: string;
  title: string | null;
  body: string;
  comment_count: number;
  like_count: number;
  view_count: number;
  created_at: string;
  edited_at: string | null;
  profiles: { nickname: string; avatar: string | null; erased_at: string | null } | null;
  post_images?: { thumb_path: string }[];
};

/* 목록에서는 본문을 통째로 안 받습니다. 사진도 썸네일 경로만 받습니다.
   profiles 는 닉네임과 아바타뿐입니다 — 이메일 칸은 애초에 없습니다.

   `profiles!posts_author_id_fkey` 로 관계 이름을 박아야 합니다.
   그냥 `profiles` 라고 쓰면 PGRST201 이 납니다 — posts 에서 profiles 로 가는 길이
   둘이라(작성자 author_id, 좋아요 post_likes 다대다) 어느 쪽인지 못 정합니다. */
const AUTHOR = 'profiles!posts_author_id_fkey(nickname,avatar,erased_at)';

export const POST_LIST_COLS =
  'id,channel,author_id,title,body,comment_count,like_count,view_count,created_at,'
  + AUTHOR + ',post_images(thumb_path)';

export const POST_ONE_COLS =
  'id,channel,author_id,title,body,comment_count,like_count,view_count,created_at,edited_at,'
  + AUTHOR;

export type CommentRow = {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { nickname: string; avatar: string | null; erased_at: string | null } | null;
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
