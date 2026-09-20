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
  icon: string | null;          // 라인 아이콘 이름 (components/icon.tsx)
  image_path: string | null;
  title: string;
  descr: string | null;
  href: string | null;
  metric: 'deadline' | 'coverage' | 'hot' | null;
};

export const HOME_COLS =
  'id,kind,sort,enabled,emoji,icon,image_path,title,descr,href,metric';

export const DEADLINE_DAYS = 7;
const HOT_DAYS = 7;

/* 홈에 뜨는 숫자. 전부 DB 에서 옵니다 (home_stats()).
   코드에 박으면 다음 분기에 틀린 화면이 됩니다 */
export type HomeStats = {
  hospitals: number;        // 심평원 병원 수
  ot: number;               // 작업치료사
  pt: number;               // 물리치료사
  hira_ver: string | null;  // 심평원 자료판 — 화면 표기가 이걸 따라갑니다
  joined: { job: string; n: number; mid: number | null }[];
  min_n: number;            // 이 수보다 적으면 중위값을 안 내보냅니다
};

export type HomeData = {
  top: HomeBlock[];
  categories: HomeBlock[];
  bigs: HomeBlock[];
  seconds: number;
  stats: HomeStats;
  metrics: {
    deadline: number;
    jobs: number;
    orgs: number;
    hot: { id: number; title: string } | null;
  };
};

/* 치료사 합계는 두 값을 읽어 더합니다. 미리 더한 숫자를 두지 않습니다 —
   한쪽 자료만 바뀌면 합계가 조용히 어긋납니다 */
export const therapists = (s: HomeStats) => s.ot + s.pt;

export async function getHome(): Promise<HomeData> {
  const today = todayIso();
  const until = new Date(Date.now() + DEADLINE_DAYS * 86400000).toISOString().slice(0, 10);

  const [blocks, settings, deadline, jobs, orgs, hot, stats] = await Promise.all([
    supabase.from('home_blocks').select(HOME_COLS).eq('enabled', true).order('sort'),
    supabase.from('site_settings').select('key,value').eq('key', 'top_banner_seconds').maybeSingle(),

    /* 숫자는 지어내지 않고 실제로 셉니다 */
    supabase.from('job_posts_pub').select('id', { count: 'exact', head: true })
      .gte('apply_to', today).lte('apply_to', until),
    supabase.from('job_posts_pub').select('id', { count: 'exact', head: true }),
    supabase.from('org_directory').select('name', { count: 'exact', head: true }),
    supabase.from('posts').select('id,title,body')
      .gte('created_at', daysAgoIso(HOT_DAYS))
      .order('view_count', { ascending: false }).limit(1),
    supabase.rpc('home_stats'),
  ]);

  const rows = (blocks.data ?? []) as unknown as HomeBlock[];
  const hotRow = (hot.data ?? [])[0] as { id: number; title: string | null; body: string } | undefined;

  return {
    top: rows.filter((b) => b.kind === 'top' && b.title),
    categories: rows.filter((b) => b.kind === 'category'),
    bigs: rows.filter((b) => b.kind === 'big'),
    seconds: Number((settings.data as { value: unknown } | null)?.value ?? 5) || 5,
    stats: (stats.data as HomeStats | null)
      ?? { hospitals: 0, ot: 0, pt: 0, hira_ver: null, joined: [], min_n: 3 },
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
