import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/* 병원정보 찾기(/orgs)가 쓰는 것들.

   자료는 org_group_mv 한 곳에 모여 있습니다 — 표 아홉 개를 이어붙인
   org_directory 를 이름+시도로 묶고, 심평원·장기요양 인력 자료를 붙여 둔 표입니다.

   화면은 그 표를 직접 안 읽습니다. anon 에게 select 를 안 줬습니다 —
   한 번에 통째로 못 가져가게 하려고요. 전부 DB 함수를 거칩니다
   (org_facets · org_search · org_public · org_detail · org_nearby · org_jobs).
   목록 함수가 20곳에서 끊습니다. PostgREST 의 Max rows 에 기대지 않습니다. */

/* 종별 타일 여덟 개. 아이콘은 DB(ui_icons)에서 오고 여기엔 자리 이름만 둡니다 */
export const TILES = [
  { key: 'all',     label: '전체',     slot: 'org.tile.all' },
  { key: 'general', label: '종합병원', slot: 'org.tile.general' },
  { key: 'rehab',   label: '재활병원', slot: 'org.tile.rehab' },
  { key: 'nursing', label: '요양병원', slot: 'org.tile.nursing' },
  { key: 'clinic',  label: '의원',     slot: 'org.tile.clinic' },
  { key: 'ltc',     label: '장기요양', slot: 'org.tile.ltc' },
  { key: 'welfare', label: '복지시설', slot: 'org.tile.welfare' },
  { key: 'health',  label: '보건기관', slot: 'org.tile.health' },
] as const;

/* etc 는 타일이 없습니다 — 병원·한방병원·정신병원·치과병원 1,635곳입니다.
   「전체」와 이름 찾기로만 닿습니다. 배지에는 이름을 적어 줍니다 */
export const TILE_NAME: Record<string, string> = {
  ...Object.fromEntries(TILES.map((t) => [t.key, t.label])),
  etc: '병원',
};

export const SIDOS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

export type OrgListRow = {
  name: string;
  sido_std: string | null;
  sgg_std: string | null;
  kinds: string[] | null;
  tile: string;
  bed: number | null;
  ot: number | null;
  pt: number | null;
  rehab: number | null;
  capacity: number | null;
  band: 'easy' | 'mid' | 'busy' | null;
  staffed: boolean;
  n_jobs: number;
  total: number;
};

export type OrgFacets = {
  tiles: Record<string, number>;
  sidos: { key: string; n: number }[];
  sggs: Record<string, { key: string; n: number }[]>;
  total: number;
};

/* 누구나 볼 수 있는 부분. 숫자는 여기 없습니다 */
export type OrgPublic = {
  name: string;
  sido_std: string | null;
  sgg_std: string | null;
  addr: string | null;
  tel: string | null;
  kinds: string[] | null;
  sources: string[] | null;
  tile: string;
  staffed: boolean;
  band: 'easy' | 'mid' | 'busy' | null;
  est_type: string | null;
  homepage: string | null;
};

/* 회원만 받는 부분. 로그인 안 한 요청에는 DB 가 아무 줄도 안 줍니다 */
export type OrgStat = {
  name: string;
  kinds: string[] | null;
  hosp_kind: string | null;
  tel: string | null;
  bed: number | null;
  rehab: number | null;
  ot: number | null;
  pt: number | null;
  capacity: number | null;
  per_bed: number | null;
  kind_med: number | null;
  kind_p25: number | null;
  kind_p75: number | null;
  kind_n: number | null;
  band: 'easy' | 'mid' | 'busy' | null;
  data_version: string | null;
};

export type OrgJob = {
  id: string;
  title: string;
  job_group: string | null;
  employ_type: string | null;
  apply_to: string | null;
  org_name: string;
};

/* 아래 셋은 **회원만** 봅니다 (2026-09-25).
   org_public · org_nearby · org_jobs 의 실행 권한을 anon 에서 걷었습니다.
   그래서 열쇠꾸러미를 받습니다 — 로그인 안 한 사람으로 부르면 권한 오류가 나고
   여기서 빈 값이 됩니다. 화면은 그 구역을 감추고 가입 권유를 그립니다. */
export async function orgPublic(
  sb: SupabaseClient, name: string, sido: string | null,
): Promise<OrgPublic | null> {
  const { data } = await sb.rpc('org_public', { p_name: name, p_sido: sido });
  return ((data ?? []) as OrgPublic[])[0] ?? null;
}

export async function orgNearby(sb: SupabaseClient, name: string, sido: string | null) {
  const { data } = await sb.rpc('org_nearby', { p_name: name, p_sido: sido, p_n: 3 });
  return (data ?? []) as { name: string; sido_std: string | null; sgg_std: string | null;
                           kinds: string[] | null; tile: string; therapists: number }[];
}

export async function orgJobs(sb: SupabaseClient, name: string): Promise<OrgJob[]> {
  const { data } = await sb.rpc('org_jobs', { p_name: name, p_n: 10 });
  return (data ?? []) as OrgJob[];
}

/* 우리가 보고 있는 규모. 홈의 큰 배너에서 씁니다.
   숫자를 지어내지 않고 실제로 셉니다 */
export async function ourNumbers() {
  const [totals, orgs] = await Promise.all([
    /* 공고 뷰를 직접 세지 않습니다 — 통째로 읽는 길을 닫았습니다 (2026-09-25).
       개수만 내주는 함수라 로그인 없이도 됩니다 */
    supabase.rpc('job_totals'),
    supabase.rpc('org_total'),
  ]);
  return {
    jobs: (totals.data as { jobs?: number } | null)?.jobs ?? 0,
    orgs: (orgs.data as number | null) ?? 0,
  };
}

/* 장기요양 종별은 「노인요양시설·치매전담실가형1실·치매전담실가형2실…」 처럼
   길어서 줄을 다 잡아먹습니다. 앞의 둘만 보여주고 나머지는 셉니다 */
export function shortKinds(kinds: string[] | null): string {
  const xs = kinds ?? [];
  if (xs.length === 0) return '';
  const head = xs.slice(0, 2).map((k) => (k.length > 18 ? k.slice(0, 18) + '…' : k));
  return xs.length > 2 ? `${head.join(' · ')} 외 ${xs.length - 2}개` : head.join(' · ');
}

/* 자료에 따라 시군구가 「대구중구」처럼 시도를 이미 달고 옵니다. 두 번 안 적습니다.
   DB 의 org_sgg() 가 대부분 떼어 주지만, 못 뗀 것이 남아도 여기서 한 번 더 봅니다 */
export function place(sido: string | null, sgg: string | null): string {
  if (!sido) return sgg ?? '';
  if (!sgg) return sido;
  return sgg.startsWith(sido) ? sgg : `${sido} ${sgg}`;
}
