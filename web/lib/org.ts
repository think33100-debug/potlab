import { supabase } from './supabase';

/* 기관 하나를 찾아 「이런 곳이에요」에 쓸 값을 모읍니다.

   org_directory 는 표 9개를 이어붙인 뷰라 이름·종별·지역·주소뿐입니다.
   치료사 인원처럼 더 깊은 값은 원본 표에 있어서, 찾은 출처에 따라
   그 표를 한 번 더 봅니다 (hospitals · ltc_facilities).

   ponytail: 이름이 정확히 같은 줄을 먼저 찾고, 없으면 부분 일치로 내려갑니다.
   공고의 org_name 은 기관이 직접 쓴 이름이라 대개 그대로 맞습니다.
   헛짚는 게 보이면 그때 pg_trgm 점수(설계 문서 1-8)로 올립니다. */

export type OrgInfo = {
  source: string;
  name: string;
  kind: string | null;
  sido: string | null;
  sgg: string | null;
  addr: string | null;
  /* 아래는 원본 표에서 더 찾아온 값입니다. 없으면 null */
  beds: number | null;       // 병상
  est_type: string | null;   // 설립구분 (공공보건의료기관)
  pt: number | null;         // 물리치료사
  ot: number | null;         // 작업치료사
  capacity: number | null;   // 정원 (장기요양기관)
};

const COLS = 'source,name,kind,sido,sgg,addr';

export async function findOrg(orgName: string): Promise<OrgInfo | null> {
  const q = orgName.trim();
  if (q.length < 2) return null;

  /* 이름이 똑같은 줄 먼저 */
  const exact = await supabase.from('org_directory').select(COLS).eq('name', q).limit(1);
  let row = (exact.data ?? [])[0] as OrgInfo | undefined;

  if (!row) {
    const like = await supabase.from('org_directory').select(COLS).ilike('name', `%${q}%`).limit(1);
    row = (like.data ?? [])[0] as OrgInfo | undefined;
  }
  if (!row) return null;

  const out: OrgInfo = {
    ...row, beds: null, est_type: null, pt: null, ot: null, capacity: null,
  };

  /* 출처에 따라 원본 표에서 치료사 인원·병상을 더 찾아옵니다 */
  if (row.source === 'hospital') {
    const { data } = await supabase
      .from('hospitals').select('bed,pt,ot').eq('name', row.name).limit(1);
    const h = (data ?? [])[0] as { bed: number | null; pt: number | null; ot: number | null } | undefined;
    if (h) { out.beds = h.bed; out.pt = h.pt; out.ot = h.ot; }
  } else if (row.source === 'public') {
    const { data } = await supabase
      .from('public_hospitals').select('beds,est_type').eq('name', row.name).limit(1);
    const h = (data ?? [])[0] as { beds: number | null; est_type: string | null } | undefined;
    if (h) { out.beds = h.beds; out.est_type = h.est_type; }
  } else if (row.source === 'ltc') {
    const { data } = await supabase
      .from('ltc_facilities').select('capacity,pt,ot').eq('name', row.name).limit(1);
    const h = (data ?? [])[0] as { capacity: number | null; pt: number | null; ot: number | null } | undefined;
    if (h) { out.capacity = h.capacity; out.pt = h.pt; out.ot = h.ot; }
  }

  return out;
}

/* 우리가 보고 있는 규모. 홈의 큰 배너에서 씁니다.
   숫자를 지어내지 않고 실제로 셉니다 */
export async function ourNumbers() {
  const [jobs, orgs] = await Promise.all([
    supabase.from('job_posts').select('id', { count: 'exact', head: true }),
    supabase.from('org_directory').select('name', { count: 'exact', head: true }),
  ]);
  return { jobs: jobs.count ?? 0, orgs: orgs.count ?? 0 };
}
