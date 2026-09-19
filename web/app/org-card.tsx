import { supabase, ORG_SOURCE_NAME, type OrgRow } from '@/lib/supabase';

/* 「이 기관은 이런 곳이에요」 — org_directory 에서 찾아 붙입니다.

   ponytail: 이름이 겹치면 첫 줄을 씁니다. 「제주한라병원」 처럼 이름을 통째로
   치는 경우가 대부분이라 이걸로 충분합니다. 헛짚는 게 보이면 그때 pg_trgm
   점수(설계 문서 1-8)로 올립니다. */
export async function OrgCard({ name }: { name: string }) {
  const q = name.trim();
  if (q.length < 2) return null;

  const { data, error } = await supabase
    .from('org_directory')
    .select('source,name,kind,sido,sgg,addr')
    .ilike('name', `%${q}%`)
    .limit(1);

  /* 못 읽으면 조용히 숨기지 않습니다. 「서버에 연결하지 못했습니다」 같은 말로는
     무엇을 고쳐야 하는지 알 수 없습니다 — 진짜 이유를 적습니다 */
  if (error) {
    return (
      <p className="mb-6 rounded-sm border border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-800">
        기관 정보를 못 읽었어요 — {error.message}
        {error.code ? ` (${error.code})` : ''}
        <br />
        org_directory 는 머티리얼라이즈드 뷰라 RLS 가 안 붙습니다.
        <code className="mx-1">grant select on public.org_directory to anon, authenticated;</code>
        가 필요합니다.
      </p>
    );
  }

  const org = (data ?? [])[0] as OrgRow | undefined;
  if (!org) return null;

  const where = [org.sido, org.sgg].filter(Boolean).join(' ');

  return (
    <section className="mb-6 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <p className="text-xs text-gray-400">이 기관은 이런 곳이에요</p>
      <p className="mt-2 text-h3 font-bold">{org.name}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {org.kind && (
          <span className="rounded-md bg-badge-teal-bg px-4 py-1 text-sm font-medium text-teal-strong">
            {org.kind}
          </span>
        )}
        {where && (
          <span className="rounded-md bg-gray-50 px-4 py-1 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-400">
            {where}
          </span>
        )}
      </div>

      {org.addr && <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">{org.addr}</p>}
      <p className="mt-2 text-sm text-gray-400">
        출처 {ORG_SOURCE_NAME[org.source] ?? org.source}
      </p>
    </section>
  );
}
