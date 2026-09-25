import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase-server';
import { place, shortKinds, TILE_NAME, type OrgListRow } from '@/lib/org';

/* 공고를 이름으로 찾을 때 「이 기관은 이런 곳이에요」를 위에 붙입니다.

   org_group_mv 를 직접 안 읽습니다 — anon 에게 select 를 안 줬습니다.
   목록 함수(org_search)를 그대로 씁니다. 한 줄만 받습니다.

   ponytail: 이름이 겹치면 첫 줄을 씁니다. 「제주한라병원」 처럼 이름을 통째로
   치는 경우가 대부분이라 이걸로 충분합니다. */
export async function OrgCard({ name }: { name: string }) {
  const q = name.trim();
  if (q.length < 2) return null;

  /* 2026-09-25 — org_search 는 회원만입니다. 그 사람의 열쇠꾸러미로 부릅니다 */
  const sb = await serverSupabase();
  const { data, error } = await sb.rpc('org_search', {
    p_q: q, p_sort: 'staff', p_limit: 1, p_offset: 0,
  });

  /* 못 읽으면 조용히 숨기지 않습니다. 진짜 이유를 적습니다 */
  if (error) {
    return (
      <p className="mb-6 rounded-sm border border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-800">
        기관 정보를 못 읽었어요 — {error.message}
        {error.code ? ` (${error.code})` : ''}
      </p>
    );
  }

  const org = ((data ?? []) as OrgListRow[])[0];
  if (!org) return null;

  const where = place(org.sido_std, org.sgg_std);

  return (
    <Link
      href={`/orgs?org=${encodeURIComponent(org.name)}&sido=${encodeURIComponent(org.sido_std ?? '')}`}
      className="mb-6 block rounded-sm border border-gray-100 p-6 dark:border-gray-800"
    >
      <p className="text-xs text-gray-400">이 기관은 이런 곳이에요</p>
      <p className="mt-2 text-h3 font-bold">{org.name}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-md bg-badge-teal-bg px-4 py-1 text-sm font-medium text-teal-strong">
          {TILE_NAME[org.tile] ?? '기관'}
        </span>
        {where && (
          <span className="rounded-md bg-gray-50 px-4 py-1 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-400">
            {where}
          </span>
        )}
      </div>

      {org.kinds?.length ? (
        <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">{shortKinds(org.kinds)}</p>
      ) : null}
      <p className="mt-2 text-sm text-gray-400">눌러서 병원정보 보기</p>
    </Link>
  );
}
