import type { SupabaseClient } from '@supabase/supabase-js';
import type { RapoJob, RapoJobLists, RapoSortKey } from '@/components/rapo/rapo-job-list';
import { 기관이름말, 마감배지, 조교연구말 } from './job-state';
import { supabase, type JobListItem, type 맛보기공고 } from './supabase';

/* 새 홈(「U01 · 홈」)의 「채용 공고」 칸에 넣을 줄 (2026-11-11).

   **새 창구를 만들지 않았습니다.** 공고 목록(app/jobs/page.tsx)이 쓰는 것 그대로입니다 —
     회원     job_list(p_sort) 를 정렬마다 한 번씩 (new · views · deadline)
     비회원   job_list 가 42501 로 거절 → 공개공고() 맛보기 줄을 여기서 다시 늘어놓습니다
     조회수   job_views() (누구나)

   ★ 「못 받음」과 「0건」을 가릅니다 (2026-11-11 디자이너 검토).
     전에는 요청이 실패해도 빈 줄을 돌려줘서 화면이 「공고가 없어요」로 보였습니다.
     이제 status 로 알립니다 — 'error' 면 화면이 「불러오지 못했어요 · 다시 불러오기」를 그립니다.
     조회수만 못 받았으면 공고는 보이고 조회수는 0 이 아니라 **빈 칸**(null)입니다.

   화면에 못 싣는 것 (자료가 없습니다 — 지어내지 않습니다)
     좋아요        공고에 그런 기능이 아직 없습니다
     경력·근무일    공고에 그런 칸이 없습니다. 대신 있는 칸(지역·고용형태·직군)을 태그로 씁니다
     급여          목록 창구가 안 내줍니다. 비회원은 원본 문구, 회원은 줄을 뺍니다 */

export type RapoHomeJobs =
  | { status: 'ok'; lists: RapoJobLists }
  | { status: 'error' };

const 줄수 = 4;   // 원본 홈이 네 줄입니다

const 그림 = ['01', '03', '06'] as const;
/* 「기관 기본 이미지」 — 원본 설명대로 공고(기관)마다 늘 같은 그림이 나오게 고릅니다.
   홈 · 공고 목록 · 공고 상세가 같이 씁니다 (한 기관이 화면마다 다른 그림이면 안 됩니다) */
export function 기관그림(열쇠: string): RapoJob['orgArt'] {
  let h = 0;
  for (let i = 0; i < 열쇠.length; i++) h = (h * 31 + 열쇠.charCodeAt(i)) >>> 0;
  return 그림[h % 그림.length];
}

export const 태그 = (...xs: (string | null | undefined | false)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))];

/* 회원 목록 창구(job_list) 한 줄 → 새 디자인 공고 행. 공고 목록(/jobs)과 상세의 「비슷한 공고」가 같이 씁니다.
   목록 창구는 급여를 안 줍니다 — pay 는 비웁니다.
   「추천」·「체험형 인턴」·「조교·연구」는 공고를 잘못 읽지 않게 하는 표시라 태그로 남깁니다 */
export function 목록줄(r: JobListItem): RapoJob {
  return {
    id: r.id, org: 기관이름말(r.org_name), orgArt: 기관그림(r.org_name || r.id), title: r.title,
    pay: null,
    tags: 태그(r.올림 && '추천', r.is_intern && '체험형 인턴', 조교연구말(r.조교연구), r.지역보임, r.employ_type || '공고문 참고', r.job_group),
    deadline: 마감배지(r.apply_to, r.마감표시, r.apply_to_time).text,
  };
}

/* 조회수 — 못 받으면 null (lib/job-views.ts 는 실패를 {} 로 돌려줘 0 과 못 가립니다) */
async function 조회수(ids: string[]): Promise<Record<string, number> | null> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('job_views', { p_ids: ids });
  if (error) return null;
  const out: Record<string, number> = {};
  ((data ?? []) as { job_id: string; views: number }[]).forEach((r) => { out[r.job_id] = r.views; });
  return out;
}
const 본수 = (v: Record<string, number> | null, id: string) => (v ? v[id] ?? 0 : null);

export async function getRapoHomeJobs(sb: SupabaseClient): Promise<RapoHomeJobs> {
  try {
    const 받기 = (s: RapoSortKey) => sb.rpc('job_list', {
      p_job: null, p_sido: null, p_tab: null, p_q: null, p_all: false, p_sort: s, p_page: 0,
    });
    const 셋 = await Promise.all([받기('new'), 받기('views'), 받기('deadline')]);

    /* 42501 = 권한 없음 = 로그인 안 한 분 (app/jobs/page.tsx 와 같은 가름) */
    if (셋[0].error?.code === '42501') return await 비회원줄();
    /* 셋 가운데 하나라도 못 받았으면 못 받은 것입니다 — 빈 줄로 넘기지 않습니다 */
    if (셋.some((x) => x.error)) return { status: 'error' };

    const 자르기 = (x: { data: unknown }) => ((x.data ?? []) as JobListItem[]).slice(0, 줄수);
    const rows = { new: 자르기(셋[0]), views: 자르기(셋[1]), deadline: 자르기(셋[2]) };
    const views = await 조회수([...new Set(Object.values(rows).flat().map((r) => r.id))]);

    const 꼴 = (r: JobListItem): RapoJob => ({
      id: r.id,
      org: 기관이름말(r.org_name),
      orgArt: 기관그림(r.org_name || r.id),
      title: r.title,
      pay: null,
      /* 지역은 지역보임 을 읽습니다 — 제목과 같은 계산입니다 (lib/supabase.ts) */
      tags: 태그(r.지역보임, r.employ_type, r.job_group, r.is_intern && '체험형 인턴'),
      likes: null,
      views: 본수(views, r.id),
      deadline: 마감배지(r.apply_to, r.마감표시, r.apply_to_time).text,
    });
    return { status: 'ok', lists: { new: rows.new.map(꼴), views: rows.views.map(꼴), deadline: rows.deadline.map(꼴) } };
  } catch {
    /* 연결이 끊겨 요청 자체가 던진 때 */
    return { status: 'error' };
  }
}

async function 비회원줄(): Promise<RapoHomeJobs> {
  const { data, error } = await supabase.rpc('공개공고');
  if (error) return { status: 'error' };
  const 줄 = (data ?? []) as 맛보기공고[];
  const views = await 조회수(줄.map((r) => r.id));

  const 꼴 = (r: 맛보기공고): RapoJob => ({
    id: r.id,
    org: 기관이름말(r.org_name),
    orgArt: 기관그림(r.org_name || r.id),
    title: r.title,
    pay: { text: '이용 권한 확인 후 공개', kind: 'value' },   // 원본 비회원 문구
    tags: 태그(r.sido, r.job_group, r.is_intern && '체험형 인턴'),
    likes: null,
    views: 본수(views, r.id),
    deadline: 마감배지(r.apply_to).text,
  });
  /* 맛보기는 최신 차례로 옵니다. 인기·마감 차례는 **받은 줄 안에서만** 다시 늘어놓습니다.
     조회수를 못 받았으면 인기 차례를 지어내지 않고 최신 차례 그대로 둡니다 */
  const 조회순 = views ? [...줄].sort((a, b) => (views[b.id] ?? 0) - (views[a.id] ?? 0)) : 줄;
  const 마감순 = [...줄].sort((a, b) => (a.apply_to ?? '9999').localeCompare(b.apply_to ?? '9999'));
  const 넷 = (xs: 맛보기공고[]) => xs.slice(0, 줄수).map(꼴);
  return { status: 'ok', lists: { new: 넷(줄), views: 넷(조회순), deadline: 넷(마감순) } };
}
