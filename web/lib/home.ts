import { supabase } from './supabase';
import { daysAgoIso, todayIso } from './time';

/* 홈 화면이 DB 에서 받아오는 것들.

   자주 바뀌는 것만 DB 입니다 — 배너 문구·그림·순서·켜기끄기와 배너 속도.
   가는 곳은 lib/routes.ts 가 아는 주소만 통과시킵니다.
   나머지 문구는 코드에 둡니다. 전부 DB 로 빼면 느려지고, 고칠 때
   어느 줄인지 못 찾습니다. */

export type HomeBlock = {
  id: number;
  kind: 'top' | 'category' | 'big';
  sort: number;
  enabled: boolean;
  emoji: string | null;
  image_path: string | null;
  title: string;
  descr: string | null;
  href: string | null;
  metric: 'deadline' | 'coverage' | 'hot' | null;
};

export const HOME_COLS =
  'id,kind,sort,enabled,emoji,image_path,title,descr,href,metric';

export const DEADLINE_DAYS = 7;
const HOT_DAYS = 7;

export type HomeData = {
  top: HomeBlock[];
  categories: HomeBlock[];
  bigs: HomeBlock[];
  seconds: number;
  metrics: {
    deadline: number;
    jobs: number;
    orgs: number;
    hot: { id: number; title: string } | null;
  };
};

export async function getHome(): Promise<HomeData> {
  const today = todayIso();
  const until = new Date(Date.now() + DEADLINE_DAYS * 86400000).toISOString().slice(0, 10);

  const [blocks, settings, deadline, jobs, orgs, hot] = await Promise.all([
    supabase.from('home_blocks').select(HOME_COLS).eq('enabled', true).order('sort'),
    supabase.from('site_settings').select('key,value').eq('key', 'top_banner_seconds').maybeSingle(),

    /* 숫자는 지어내지 않고 실제로 셉니다 */
    supabase.from('job_posts').select('id', { count: 'exact', head: true })
      .gte('apply_to', today).lte('apply_to', until),
    supabase.from('job_posts').select('id', { count: 'exact', head: true }),
    supabase.from('org_directory').select('name', { count: 'exact', head: true }),
    supabase.from('posts').select('id,title,body')
      .gte('created_at', daysAgoIso(HOT_DAYS))
      .order('view_count', { ascending: false }).limit(1),
  ]);

  const rows = (blocks.data ?? []) as unknown as HomeBlock[];
  const hotRow = (hot.data ?? [])[0] as { id: number; title: string | null; body: string } | undefined;

  return {
    top: rows.filter((b) => b.kind === 'top' && b.title),
    categories: rows.filter((b) => b.kind === 'category'),
    bigs: rows.filter((b) => b.kind === 'big'),
    seconds: Number((settings.data as { value: unknown } | null)?.value ?? 5) || 5,
    metrics: {
      deadline: deadline.count ?? 0,
      jobs: jobs.count ?? 0,
      orgs: orgs.count ?? 0,
      hot: hotRow ? { id: hotRow.id, title: hotRow.title || hotRow.body.slice(0, 30) } : null,
    },
  };
}

/* 큰 배너 안에 뜨는 한 줄. metric 이 비어 있으면 관리자가 쓴 설명을 그대로 씁니다 */
export function metricLine(b: HomeBlock, m: HomeData['metrics']): string | null {
  if (b.metric === 'deadline') return `${m.deadline}건이 ${DEADLINE_DAYS}일 안에 닫혀요`;
  if (b.metric === 'coverage') return `공고 ${m.jobs.toLocaleString()}건 · 기관 ${m.orgs.toLocaleString()}곳`;
  if (b.metric === 'hot') return m.hot ? m.hot.title : '아직 이번 주 글이 없어요';
  return b.descr;
}
