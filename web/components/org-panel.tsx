import Link from 'next/link';
import type { JobListItem } from '@/lib/supabase';
import { orgJobs, orgPublic, place, shortKinds, TILE_NAME } from '@/lib/org';
import { serverSupabase } from '@/lib/supabase-server';

/* 공고 하나를 볼 때 그 기관이 어떤 곳인지 같이 보여줍니다.

   인원·병상은 여기서 뺐습니다 — 바로 위 「병원 뜯어보기」가 같은 숫자를
   더 크게 보여줍니다. 두 벌로 두면 한쪽만 고치게 됩니다.
   대신 병원정보 화면으로 가는 길을 놓습니다.

   급여는 salary_records 가 아직 한 줄뿐이라 자리만 잡아둡니다 —
   없는 숫자를 지어내지 않습니다. */
export async function OrgPanel({ orgName, exceptJobId }: { orgName: string; exceptJobId: string }) {
  /* 2026-09-25 — 회원만 봅니다. 공고 뷰를 직접 읽던 것도 함수로 바꿨습니다.
     로그인 안 한 분에게는 둘 다 빈 값이 오고 이 구역은 통째로 안 그립니다 */
  const sb = await serverSupabase();
  const [org, others] = await Promise.all([
    orgPublic(sb, orgName, null),
    orgJobs(sb, orgName),
  ]);

  const rows = (others as unknown as JobListItem[])
    .filter((r) => r.id !== exceptJobId).slice(0, 5);
  if (!org && rows.length === 0) return null;

  const facts: [string, string][] = [];
  if (org?.kinds?.length) facts.push(['종별', shortKinds(org.kinds)]);
  if (org?.est_type) facts.push(['설립구분', org.est_type]);
  const where = place(org?.sido_std ?? null, org?.sgg_std ?? null);
  if (where) facts.push(['지역', where]);
  if (org?.tel) facts.push(['전화', org.tel]);

  return (
    <section className="mt-8 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <p className="text-xs text-gray-400">이 기관은 이런 곳이에요</p>
      {/* 색을 박습니다. 물려받게 두면 어두운 모드에서 흰색이 되어
          종이색 바탕 위에서 안 보였습니다 (#14181C 로 16.2:1) */}
      <p className="mt-2 text-h3 font-bold text-ink">{org?.name ?? orgName}</p>

      {facts.length > 0 ? (
        <dl className="mt-5 grid grid-cols-[5rem_1fr] gap-y-2 text-lg">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 text-lg text-gray-500">
          기관 자료에서 못 찾았어요. 공고에 적힌 이름과 자료의 이름이 다를 수 있어요
        </p>
      )}

      {org?.addr && <p className="mt-5 text-lg text-gray-700 dark:text-gray-300">{org.addr}</p>}

      {org && (
        <Link
          href={`/orgs?org=${encodeURIComponent(org.name)}&sido=${encodeURIComponent(org.sido_std ?? '')}`}
          className="mt-5 block text-lg font-medium text-interaction-blue hover:underline"
        >
          {TILE_NAME[org.tile] ?? '기관'} 정보 자세히 보기 →
        </Link>
      )}

      {/* 급여는 자료가 없어서 숫자를 안 만듭니다 */}
      <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
        <p className="text-sm font-bold text-gray-500">이 기관 급여</p>
        <p className="mt-1 text-lg text-gray-500">
          아직 올라온 급여 정보가 없어요. 회원이 올려주면 여기에 보여드릴게요
        </p>
      </div>

      {rows.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
          <p className="text-sm font-bold text-gray-500">같은 기관의 다른 공고 {rows.length}건</p>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/jobs/${r.id}`} className="-mx-4 block rounded-sm px-4 py-5 hover:bg-gray-50 dark:hover:bg-gray-950">
                  <p className="truncate text-lg font-medium">{r.title}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {[r.job_group, r.employ_type, r.apply_to ? `~${r.apply_to.slice(5).replace('-', '.')}` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
