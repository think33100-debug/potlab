'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { ORG_SOURCE_NAME } from '@/lib/supabase';
import { place, shortKinds } from '@/lib/org';

/* 기관 찾기. 62,749곳을 이름·분류·종별·지역으로 좁힙니다.

   종별(kind)은 자료마다 수십 가지입니다 — 장기요양만 73가지.
   전부 목록에 넣으면 아무도 못 고릅니다. 그래서 분류를 먼저 고르면
   그 분류의 종별만 보여줍니다. 10곳 미만인 종별은 아예 안 내보냅니다. */

const PAGE = 30;

/* 한 기관이 자료 여러 곳에 들어 있어서 이름+지역으로 묶어 옵니다.
   묶기 전에는 「경북대학교병원」이 세 줄로 나왔습니다 */
type Row = {
  name: string; sido_std: string | null; sgg: string | null; addr: string | null;
  kinds: string[] | null; sources: string[]; n_jobs: number; total: number;
};
type Facets = {
  sources: { key: string; n: number }[];
  kinds: { source: string; kind: string; n: number }[];
  sidos: { key: string; n: number }[];
  total: number;
};

export function OrgSearch() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [source, setSource] = useState('');
  const [kind, setKind] = useState('');
  const [sido, setSido] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    browserSupabase().rpc('org_facets').then(({ data, error }) => {
      if (error) setErr(`거르는 목록을 못 불러왔어요 — ${error.message}`);
      else setFacets(data as Facets);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    browserSupabase().rpc('org_search', {
      p_q: q || null, p_source: source || null, p_kind: kind || null,
      p_sido: sido || null, p_limit: PAGE, p_offset: page * PAGE,
    }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setErr(`못 불러왔어요 — ${error.message}`); return; }
      setErr(null);
      setRows((data ?? []) as Row[]);
    });
    return () => { alive = false; };
  }, [q, source, kind, sido, page]);

  /* 고른 분류의 종별만. 분류를 안 골랐으면 종별도 안 고르게 둡니다 —
     같은 종별 이름이 자료마다 다른 뜻인 경우가 있습니다 */
  const kinds = useMemo(
    () => (facets && source ? facets.kinds.filter((k) => k.source === source) : []),
    [facets, source]);

  const total = rows?.[0]?.total ?? 0;
  const last = Math.max(0, Math.ceil(total / PAGE) - 1);

  const reset = () => { setPage(0); };

  return (
    <>
      <p className="mt-2 text-lg text-gray-500">
        {facets ? `${facets.total.toLocaleString('ko-KR')}곳을 보고 있어요` : ' '}
      </p>

      {/* 이름 찾기 */}
      <form className="mt-7 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); reset(); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)}
          placeholder="기관 이름으로 찾기" aria-label="기관 이름"
          className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950" />
        <button type="submit"
          className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark">
          찾기
        </button>
      </form>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Sel label="분류" v={source} all="전체"
          on={(v) => { setSource(v); setKind(''); reset(); }}
          opts={(facets?.sources ?? []).map((s) => ({
            value: s.key, label: `${ORG_SOURCE_NAME[s.key] ?? s.key} (${s.n.toLocaleString('ko-KR')})`,
          }))} />
        <Sel label="지역" v={sido} all="전국"
          on={(v) => { setSido(v); reset(); }}
          opts={(facets?.sidos ?? []).map((s) => ({ value: s.key, label: `${s.key} (${s.n.toLocaleString('ko-KR')})` }))} />
      </div>

      <div className="mt-2">
        <Sel label="종별" v={kind} all={source ? '전체' : '분류를 먼저 골라 주세요'}
          disabled={!source}
          on={(v) => { setKind(v); reset(); }}
          opts={kinds.map((k) => ({ value: k.kind, label: `${k.kind} (${k.n.toLocaleString('ko-KR')})` }))} />
      </div>

      {err && <p className="mt-6 text-lg text-brand-red">{err}</p>}

      {rows && (
        <>
          <p className="mt-7 text-sm text-gray-500">
            {total.toLocaleString('ko-KR')}곳
            {total > PAGE && ` · ${page + 1} / ${last + 1}쪽`}
          </p>

          {rows.length === 0 ? (
            <p className="mt-6 text-lg text-gray-500">
              찾은 곳이 없어요. 이름을 줄이거나 조건을 넓혀 보세요
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <li key={`${r.name}/${r.sido_std}`}>
                  <Link
                    href={`/orgs?org=${encodeURIComponent(r.name)}&sido=${encodeURIComponent(r.sido_std ?? '')}`}
                    className="-mx-4 block rounded-sm px-4 py-6 hover:bg-gray-50 dark:hover:bg-gray-950">
                    <div className="flex items-baseline justify-between gap-5">
                      <p className="min-w-0 text-body-lg font-bold">{r.name}</p>
                      {r.n_jobs > 0 && (
                        <span className="shrink-0 rounded-md bg-badge-teal-bg px-3 py-1 text-sm font-medium text-teal-strong dark:border dark:border-teal-strong/40 dark:bg-transparent">
                          공고 {r.n_jobs}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {[shortKinds(r.kinds), place(r.sido_std, r.sgg)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {r.sources.map((s) => ORG_SOURCE_NAME[s] ?? s).join(' · ')}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {total > PAGE && (
            <div className="mt-7 flex items-center justify-between gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}
                className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
                이전
              </button>
              <span className="text-sm text-gray-500">{page + 1} / {last + 1}</span>
              <button type="button" disabled={page >= last} onClick={() => setPage(page + 1)}
                className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
                다음
              </button>
            </div>
          )}
        </>
      )}

      <p className="mt-7 text-sm text-gray-400">
        심평원·공공보건의료기관·장기요양기관 등 공공자료를 모은 것이에요.
        한 기관이 자료 여러 곳에 있으면 한 줄로 묶어서 보여드려요
      </p>
    </>
  );
}

function Sel({
  label, v, on, opts, all, disabled,
}: {
  label: string; v: string; on: (v: string) => void; all: string; disabled?: boolean;
  opts: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-gray-500">{label}</span>
      <select value={v} onChange={(e) => on(e.target.value)} disabled={disabled}
        className="mt-1 block w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950">
        <option value="">{all}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
