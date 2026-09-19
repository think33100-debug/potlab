import Link from 'next/link';
import { findOrg } from '@/lib/org';
import { supabase, LIST_COLS, type JobListItem } from '@/lib/supabase';
import { ORG_SOURCE_NAME } from '@/lib/supabase';

/* 공고 하나를 볼 때 그 기관이 어떤 곳인지 같이 보여줍니다.
   예전 앱에서 병원 정보가 같이 뜨던 자리입니다.

   급여는 salary_records 가 아직 0줄이라 자리만 잡아둡니다 —
   없는 숫자를 지어내지 않습니다. */
export async function OrgPanel({ orgName, exceptJobId }: { orgName: string; exceptJobId: string }) {
  const [org, others] = await Promise.all([
    findOrg(orgName),
    supabase.from('job_posts').select(LIST_COLS)
      .eq('org_name', orgName).neq('id', exceptJobId)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  const rows = (others.data ?? []) as unknown as JobListItem[];
  if (!org && rows.length === 0) return null;

  const where = [org?.sido, org?.sgg].filter(Boolean).join(' ');
  const facts: [string, string][] = [];
  if (org?.kind) facts.push(['종별', org.kind]);
  if (org?.est_type) facts.push(['설립구분', org.est_type]);
  if (where) facts.push(['지역', where]);
  if (org?.beds != null) facts.push(['병상', `${org.beds}개`]);
  if (org?.capacity != null) facts.push(['정원', `${org.capacity}명`]);
  if (org?.pt != null || org?.ot != null) {
    facts.push(['치료사', [
      org.pt != null ? `물리치료사 ${org.pt}명` : null,
      org.ot != null ? `작업치료사 ${org.ot}명` : null,
    ].filter(Boolean).join(' · ')]);
  }

  return (
    <section className="mt-8 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <p className="text-xs text-gray-400">이 기관은 이런 곳이에요</p>
      <p className="mt-2 text-h3 font-bold">{org?.name ?? orgName}</p>

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
        <p className="mt-2 text-sm text-gray-400">
          출처 {ORG_SOURCE_NAME[org.source] ?? org.source}
        </p>
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
