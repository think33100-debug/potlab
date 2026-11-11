import type { SupabaseClient } from '@supabase/supabase-js';
import type { RapoJob, RapoJobLists, RapoSortKey } from '@/components/rapo/rapo-job-list';
import { jobViews } from './job-views';
import { 기관이름말, 마감배지 } from './job-state';
import { supabase, type JobListItem, type 맛보기공고 } from './supabase';

/* 새 홈(「U01 · 홈」)의 「채용 공고」 칸에 넣을 줄 (2026-11-11).

   **새 창구를 만들지 않았습니다.** 공고 목록(app/jobs/page.tsx)이 쓰는 것 그대로입니다 —
     회원     job_list(p_sort) 를 정렬마다 한 번씩 (new · views · deadline)
     비회원   job_list 가 42501 로 거절 → 공개공고() 맛보기 줄을 여기서 다시 늘어놓습니다
     조회수   job_views() (누구나)

   화면에 못 싣는 것 (자료가 없습니다 — 지어내지 않습니다)
     좋아요        공고에 그런 기능이 아직 없습니다
     경력·근무일    공고에 그런 칸이 없습니다. 대신 있는 칸(지역·고용형태·직군)을 태그로 씁니다
     급여          목록 창구가 안 내줍니다. 비회원은 원본 문구, 회원은 줄을 뺍니다 */

const 줄수 = 4;   // 원본 홈이 네 줄입니다

const 그림 = ['01', '03', '06'] as const;
/* 「기관 기본 이미지」 — 원본 설명대로 공고(기관)마다 늘 같은 그림이 나오게 고릅니다 */
function 기관그림(열쇠: string): RapoJob['orgArt'] {
  let h = 0;
  for (let i = 0; i < 열쇠.length; i++) h = (h * 31 + 열쇠.charCodeAt(i)) >>> 0;
  return 그림[h % 그림.length];
}

const 태그 = (...xs: (string | null | undefined | false)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))];

export async function getRapoHomeJobs(sb: SupabaseClient): Promise<RapoJobLists> {
  const 받기 = (s: RapoSortKey) => sb.rpc('job_list', {
    p_job: null, p_sido: null, p_tab: null, p_q: null, p_all: false, p_sort: s, p_page: 0,
  });
  const [n, v, d] = await Promise.all([받기('new'), 받기('views'), 받기('deadline')]);

  /* 42501 = 권한 없음 = 로그인 안 한 분 (app/jobs/page.tsx 와 같은 가름) */
  if (n.error?.code === '42501') return 비회원줄();
  /* 그 밖의 오류는 빈 칸으로 둡니다 — 「보여 드릴 공고가 없어요」가 뜹니다 */

  const 자르기 = (x: { data: unknown }) => ((x.data ?? []) as JobListItem[]).slice(0, 줄수);
  const rows = { new: 자르기(n), views: 자르기(v), deadline: 자르기(d) };
  const views = await jobViews([...new Set(Object.values(rows).flat().map((r) => r.id))]);

  const 꼴 = (r: JobListItem): RapoJob => ({
    id: r.id,
    org: 기관이름말(r.org_name),
    orgArt: 기관그림(r.org_name || r.id),
    title: r.title,
    pay: null,
    /* 지역은 지역보임 을 읽습니다 — 제목과 같은 계산입니다 (lib/supabase.ts) */
    tags: 태그(r.지역보임, r.employ_type, r.job_group, r.is_intern && '체험형 인턴'),
    likes: null,
    views: views[r.id] ?? 0,
    deadline: 마감배지(r.apply_to, r.마감표시, r.apply_to_time).text,
  });
  return { new: rows.new.map(꼴), views: rows.views.map(꼴), deadline: rows.deadline.map(꼴) };
}

async function 비회원줄(): Promise<RapoJobLists> {
  const { data } = await supabase.rpc('공개공고');
  const 줄 = (data ?? []) as 맛보기공고[];
  const views = await jobViews(줄.map((r) => r.id));

  const 꼴 = (r: 맛보기공고): RapoJob => ({
    id: r.id,
    org: 기관이름말(r.org_name),
    orgArt: 기관그림(r.org_name || r.id),
    title: r.title,
    pay: { text: '이용 권한 확인 후 공개', kind: 'value' },   // 원본 비회원 문구
    tags: 태그(r.sido, r.job_group, r.is_intern && '체험형 인턴'),
    likes: null,
    views: views[r.id] ?? 0,
    deadline: 마감배지(r.apply_to).text,
  });
  /* 맛보기는 최신 차례로 옵니다. 인기·마감 차례는 **받은 줄 안에서만** 다시 늘어놓습니다 */
  const 조회순 = [...줄].sort((a, b) => (views[b.id] ?? 0) - (views[a.id] ?? 0));
  const 마감순 = [...줄].sort((a, b) => (a.apply_to ?? '9999').localeCompare(b.apply_to ?? '9999'));
  const 넷 = (xs: 맛보기공고[]) => xs.slice(0, 줄수).map(꼴);
  return { new: 넷(줄), views: 넷(조회순), deadline: 넷(마감순) };
}
