import Link from 'next/link';
import { findOrgMerged, place, sidoOf } from '@/lib/org';
import { supabase, LIST_COLS, ORG_SOURCE_NAME, type JobListItem } from '@/lib/supabase';

/* 기관 하나. 치료사 인원·정원·병상·주소와, 그 기관의 공고를 같이 보여줍니다.

   한 기관이 자료 여러 곳에 있어서 전부 보고 합칩니다 — 치료사 인원은
   심평원 자료에만, 정원은 장기요양 자료에만 있어서 하나만 보면 놓칩니다.

   숫자를 만들지 않습니다. 원본 자료에 없으면 「자료에 없어요」라고 적습니다. */
export async function OrgDetail({ name, sido }: { name: string; sido: string | null }) {
  const [orgs, jobs] = await Promise.all([
    findOrgMerged(name, sido),
    supabase.from('job_posts').select(LIST_COLS)
      .eq('org_name', name)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  const rows = (jobs.data ?? []) as unknown as JobListItem[];

  if (orgs.length === 0) {
    return (
      <>
        <Back />
        <h1 className="mt-6 text-h2 font-bold">{name}</h1>
        <p className="mt-5 text-lg text-gray-500">
          이 기관을 자료에서 못 찾았어요. 이름이 바뀌었거나 문 닫았을 수 있어요
        </p>
      </>
    );
  }

  /* 여러 자료 중 값이 있는 것을 씁니다 */
  const first = <T,>(pick: (o: (typeof orgs)[number]) => T | null | undefined): T | null => {
    for (const o of orgs) { const v = pick(o); if (v != null && v !== '') return v; }
    return null;
  };

  const kinds = [...new Set(orgs.map((o) => o.kind).filter(Boolean))] as string[];
  const ot = first((o) => o.ot);
  const pt = first((o) => o.pt);
  const addr = first((o) => o.addr);

  const facts: [string, string][] = [];
  if (kinds.length) facts.push(['종별', kinds.join(' · ')]);
  const est = first((o) => o.est_type);
  if (est) facts.push(['설립구분', est]);
  const where = place(sidoOf({ sido: first((o) => o.sido), addr }), first((o) => o.sgg));
  if (where) facts.push(['지역', where]);
  const beds = first((o) => o.beds);
  if (beds != null) facts.push(['병상', `${beds.toLocaleString('ko-KR')}개`]);
  const cap = first((o) => o.capacity);
  if (cap != null) facts.push(['정원', `${cap.toLocaleString('ko-KR')}명`]);

  return (
    <>
      <Back />

      <h1 className="mt-6 text-h2 font-bold">{orgs[0].name}</h1>
      <p className="mt-2 text-sm text-gray-400">
        출처 {[...new Set(orgs.map((o) => ORG_SOURCE_NAME[o.source] ?? o.source))].join(' · ')}
      </p>

      <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="text-h3 font-bold">치료사</h2>
        {ot != null || pt != null ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Big label="작업치료사" v={ot} />
            <Big label="물리치료사" v={pt} />
          </div>
        ) : (
          <p className="mt-2 text-lg text-gray-500">
            이 자료에는 치료사 인원이 없어요. 심평원 병원정보와 장기요양기관 자료에만 들어 있어요
          </p>
        )}
      </section>

      {facts.length > 0 && (
        <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
          <h2 className="text-h3 font-bold">기관 정보</h2>
          <dl className="mt-5 grid grid-cols-[5rem_1fr] gap-y-4 text-lg">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{k}</dt>
                <dd className="break-words font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {addr && (
            <p className="mt-5 border-t border-gray-100 pt-5 text-lg text-gray-700 dark:border-gray-800 dark:text-gray-300">
              {addr}
            </p>
          )}
        </section>
      )}

      <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
        <h2 className="text-h3 font-bold">이 기관의 공고</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-lg text-gray-500">
            지금 올라온 공고가 없어요. 새로 뜨면 공고 화면에 올라와요
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/jobs/${r.id}`}
                  className="-mx-4 block rounded-sm px-4 py-5 hover:bg-gray-50 dark:hover:bg-gray-950">
                  <p className="text-lg font-medium">{r.title}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {[r.job_group, r.employ_type,
                      r.apply_to ? `~${r.apply_to.slice(5).replace('-', '.')}` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Back() {
  return (
    <Link href="/orgs" className="text-lg text-interaction-blue hover:underline">
      ← 병원정보 찾기
    </Link>
  );
}

function Big({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="rounded-sm bg-gray-50 p-5 dark:bg-gray-950">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-h2 font-bold">
        {v == null ? <span className="text-h3 font-medium text-gray-400">자료에 없어요</span> : `${v}명`}
      </p>
    </div>
  );
}
