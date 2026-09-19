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
  return withExtras(row);
}

/* 병원정보 찾기에서 고른 기관.

   한 기관이 자료 여러 곳에 들어 있습니다 — 경북대학교병원은 심평원·
   공공보건의료기관·정신건강시설 셋에 있습니다. 하나만 보면 치료사 인원이
   있는 자료를 놓칠 수 있어서, 이름이 같은 줄을 전부 보고 합칩니다.
   지역까지 같이 보는 이유는 분원 때문입니다. */
export async function findOrgMerged(orgName: string, sido: string | null): Promise<OrgInfo[]> {
  const { data } = await supabase.from('org_directory').select(COLS).eq('name', orgName).limit(20);
  let rows = (data ?? []) as OrgInfo[];
  if (sido) {
    const same = rows.filter((r) => sidoOf(r) === sido);
    if (same.length) rows = same;
  }
  return Promise.all(rows.map(withExtras));
}

/* DB 의 org_sido() 와 같은 규칙입니다. 자료마다 「경기도」와 「경기」가 섞여 있어서요 */
export function sidoOf(r: { sido: string | null; addr: string | null }): string | null {
  const s = (r.sido?.trim() || r.addr || '').trim();
  const two: [string, string][] = [
    ['서울', '서울'], ['부산', '부산'], ['대구', '대구'], ['인천', '인천'],
    ['광주', '광주'], ['대전', '대전'], ['울산', '울산'], ['세종', '세종'],
    ['경기', '경기'], ['강원', '강원'], ['제주', '제주'],
    ['충청북', '충북'], ['충북', '충북'], ['충청남', '충남'], ['충남', '충남'],
    ['전라북', '전북'], ['전북', '전북'], ['전라남', '전남'], ['전남', '전남'],
    ['경상북', '경북'], ['경북', '경북'], ['경상남', '경남'], ['경남', '경남'],
  ];
  for (const [pre, out] of two) if (s.startsWith(pre)) return out;
  return null;
}

async function withExtras(row: OrgInfo): Promise<OrgInfo> {
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

/* 장기요양 종별은 「노인요양시설·치매전담실가형1실·치매전담실가형2실…」 처럼
   길어서 줄을 다 잡아먹습니다. 앞의 둘만 보여주고 나머지는 셉니다 */
export function shortKinds(kinds: string[] | null): string {
  const xs = kinds ?? [];
  if (xs.length === 0) return '';
  const head = xs.slice(0, 2).map((k) => (k.length > 18 ? k.slice(0, 18) + '…' : k));
  return xs.length > 2 ? `${head.join(' · ')} 외 ${xs.length - 2}개` : head.join(' · ');
}

/* 자료에 따라 시군구가 「대구중구」처럼 시도를 이미 달고 옵니다. 두 번 안 적습니다 */
export function place(sido: string | null, sgg: string | null): string {
  if (!sido) return sgg ?? '';
  if (!sgg) return sido;
  return sgg.startsWith(sido) ? sgg : `${sido} ${sgg}`;
}

