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
  /* 체험형 인턴인가 — 정규 채용과 구분해 보여주려고 (2026-10-01).
     DB 가 제목으로 스스로 정합니다: 수련생|체험형|청년인턴|인턴
     이런 공고도 우리 직군 직렬이 실제로 있어서 올립니다 —
     근로복지공단 청년인턴은 응시자격에 「(물리치료사) 면허증 소지자」가
     적혀 있습니다. 다만 인턴이라 회원이 헷갈리지 않게 표시를 답니다 */
  is_intern: boolean | null;
  /* 카드와 상세가 **같은 계산 결과**를 읽는 칸입니다 (2026-10-07 확정 방침).
     DB 의 지역보임(job_posts) 이 정합니다 — 제목도 같은 함수를 씁니다.
       공공기관 본체가 직접 뽑으면      비웁니다
       「전남광주」                   전남·광주로 가릅니다. 못 가르면 비웁니다
       아는 데까지                    「전남 순천시」 (짧은 시도 + 시군구)
     ★ work_place·sido 를 화면에 직접 쓰지 마십시오. 그래서 어긋났습니다 */
  지역보임: string | null;
};

export type JobListItem = Pick<
  JobPost,
  'id' | 'org_name' | 'title' | 'employ_type' | 'work_place'
  | 'sido' | 'job_group' | 'org_kind' | 'tab'
  | 'apply_from' | 'apply_to' | 'posted_at' | 'headcount' | 'is_intern'
  | '지역보임'
> & {
  /* 관리자가 추천순 맨 위로 올린 공고인가 (2026-10-07 · DB 의 job_list 가 붙입니다).
     job_posts 에는 없는 칸이라 Pick 이 아니라 여기서 더합니다 */
  올림?: boolean | null;
};

/* 로그인 안 한 분에게 보여주는 맛보기 (2026-10-01).
   DB 의 공개공고() 가 내주는 것 그대로입니다.
   **여기 없는 칸은 비로그인에게 안 나갑니다** — 근거·상세·점수·인원·
   고용형태·경쟁률·급여는 창구에서 아예 빼 두었습니다.
   몇 건을 보여줄지는 site_settings 「비로그인_공고수」 한 줄로 정합니다. */
export type 맛보기공고 = Pick<
  JobPost,
  'id' | 'title' | 'org_name' | 'sido' | 'job_group' | 'apply_to' | 'is_intern' | 'url'
> & { 전체건수: number; 보여주는수: number };

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
