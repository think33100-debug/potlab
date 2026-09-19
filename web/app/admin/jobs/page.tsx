'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ADMIN_LIST_COLS, STATES, type AdminJobListItem, type StateKey,
} from '@/lib/admin-jobs';
import { SOURCE_NAME, TABS, tabLabel } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 관리자 공고 화면.

   admin_jobs 뷰를 봅니다 — 숨김·보류도 나오고 출처·수집일도 나옵니다.
   회원 화면(job_posts)에서는 둘 다 안 보입니다.

   보류함을 첫 칸에 둡니다. 「못 가린 공고는 버리지 말고 보류함으로.
   관리자가 확인 후 올림」이 이 제품의 규칙이라 여기가 매일 보는 자리입니다. */

const PAGE = 50;

export default function AdminJobs() {
  const toast = useToast();

  const [state, setState] = useState<StateKey>('hold');
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<AdminJobListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const build = useCallback(() => {
    let b = browserSupabase().from('admin_jobs').select(ADMIN_LIST_COLS, { count: 'exact' });
    if (state === 'hold') b = b.eq('hold', true);
    if (state === 'live') b = b.eq('hold', false).eq('hidden', false);
    if (state === 'hidden') b = b.eq('hidden', true);
    if (tab) b = b.like('tab', TABS.find((t) => t.key === tab)?.like ?? '%');
    if (q) b = b.or(`title.ilike.%${q}%,org_name.ilike.%${q}%,id.ilike.%${q}%`);
    return b;
  }, [state, tab, q]);

  const fetchRows = useCallback(async () => {
    const { data, count } = await build()
      .order('collected_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    return { rows: (data ?? []) as unknown as AdminJobListItem[], total: count ?? 0 };
  }, [build, page]);

  /* 칸마다 몇 건인지 — 줄은 안 받고 세기만 합니다 */
  const fetchCounts = useCallback(async () => {
    const sb = browserSupabase();
    const one = (f: (b: ReturnType<typeof sb.from>) => unknown) => f;
    void one;
    const [hold, live, hidden, all] = await Promise.all([
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).eq('hold', true),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).eq('hold', false).eq('hidden', false),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).eq('hidden', true),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }),
    ]);
    return {
      hold: hold.count ?? 0, live: live.count ?? 0,
      hidden: hidden.count ?? 0, all: all.count ?? 0,
    };
  }, []);

  const reload = useCallback(async () => {
    const [r, c] = await Promise.all([fetchRows(), fetchCounts()]);
    setRows(r.rows); setTotal(r.total); setCounts(c);
  }, [fetchRows, fetchCounts]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchRows(), fetchCounts()]).then(([r, c]) => {
      if (!alive) return;
      setRows(r.rows); setTotal(r.total); setCounts(c);
    });
    return () => { alive = false; };
  }, [fetchRows, fetchCounts]);

  const patch = async (id: string, v: Record<string, boolean>, said: string) => {
    setBusy(id);
    const { error } = await browserSupabase().from('job_posts')
      .update({ ...v, updated_at: new Date().toISOString() }).eq('id', id);
    setBusy(null);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast(said);
    await reload();
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`「${title}」를 지울까요?\n되돌릴 수 없어요. 보류함으로 보내는 쪽이 안전해요`)) return;
    setBusy(id);
    const { error } = await browserSupabase().from('job_posts').delete().eq('id', id);
    setBusy(null);
    if (error) { toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('공고를 지웠어요');
    await reload();
  };

  const go = (s: StateKey) => { setState(s); setPage(0); };
  const search = () => { setQ(typed.trim()); setPage(0); };

  return (
    <div>
      {/* 상태 칸 */}
      <nav className="flex flex-wrap gap-2" aria-label="공고 상태">
        {STATES.map((s) => (
          <button
            key={s.key} type="button" onClick={() => go(s.key)}
            aria-current={state === s.key ? 'true' : undefined}
            className={
              'rounded-md border px-6 py-4 text-lg font-medium ' +
              (state === s.key
                ? 'border-teal-strong bg-teal-strong text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
            }
          >
            {s.label}
            <span className={'ml-2 text-sm ' + (state === s.key ? 'text-white/70' : 'text-gray-400')}>
              {counts[s.key] ?? '…'}
            </span>
          </button>
        ))}
      </nav>
      {STATES.find((s) => s.key === state)?.hint && (
        <p className="mt-2 text-sm text-gray-500">{STATES.find((s) => s.key === state)!.hint}</p>
      )}

      {/* 찾기 · 탭 거르기 */}
      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) search(); }}
          placeholder="기관명 · 공고명 · 공고ID"
          aria-label="공고 찾기"
          className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
        />
        <button type="button" onClick={search}
          className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-lg font-bold text-white hover:bg-brand-red-dark">
          찾기
        </button>
        <select
          value={tab}
          onChange={(e) => { setTab(e.target.value); setPage(0); }}
          aria-label="탭으로 거르기"
          className="appearance-none rounded-xs border border-gray-200 bg-gray-50 py-4 pl-5 pr-[36px] text-lg dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">탭 전체</option>
          {TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {q && (
        <p className="mt-2 text-sm text-gray-500">
          「{q}」로 찾은 {total}건{' '}
          <button type="button" onClick={() => { setQ(''); setTyped(''); setPage(0); }}
            className="text-interaction-blue hover:underline">검색 지우기</button>
        </p>
      )}

      {/* 목록 */}
      {rows === null ? (
        <p className="mt-7 text-lg text-gray-400">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-7 py-8 text-center text-lg text-gray-500">
          {state === 'hold' ? '보류함이 비었어요. 좋은 신호예요' : '해당하는 공고가 없어요'}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => (
            <li key={r.id} className="py-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                {r.hold && <Badge tone="red">보류</Badge>}
                {r.hidden && <Badge tone="gray">숨김</Badge>}
                {r.tab && <Badge tone="blue">{tabLabel(r.tab)}</Badge>}
                <span>{r.org_name}</span>
                <span className="flex-1" />
                <span>{SOURCE_NAME[r.source] ?? r.source} · 수집 {r.collected_at?.slice(0, 10)}</span>
              </div>

              <Link href={`/admin/jobs/${r.id}`} className="mt-1 block text-body-lg font-medium hover:underline">
                {r.title}
              </Link>

              <p className="mt-1 text-sm text-gray-500">
                {[r.job_group, r.employ_type, r.work_place,
                  r.headcount ? `${r.headcount}명` : null,
                  r.apply_to ? `~${r.apply_to}` : null,
                  r.id].filter(Boolean).join(' · ')}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Act onClick={() => patch(r.id, { hold: !r.hold }, r.hold ? '보류를 풀었어요' : '보류함으로 보냈어요')} busy={busy === r.id}>
                  {r.hold ? '보류 풀기' : '보류로'}
                </Act>
                <Act onClick={() => patch(r.id, { hidden: !r.hidden }, r.hidden ? '다시 보이게 했어요' : '숨겼어요')} busy={busy === r.id}>
                  {r.hidden ? '다시 보이기' : '숨기기'}
                </Act>
                <Link href={`/admin/jobs/${r.id}`}
                  className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                  수정
                </Link>
                <Link href={`/jobs/${r.id}`} target="_blank"
                  className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                  회원 화면
                </Link>
                <span className="flex-1" />
                <Act onClick={() => remove(r.id, r.title)} busy={busy === r.id} danger>삭제</Act>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 쪽 넘기기 */}
      {total > PAGE && (
        <div className="mt-7 flex items-center justify-between gap-5">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-gray-200 px-6 py-4 text-lg disabled:opacity-30 dark:border-gray-700">
            ← 이전
          </button>
          <span className="text-sm text-gray-500">
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} / {total}건
          </span>
          <button type="button" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-gray-200 px-6 py-4 text-lg disabled:opacity-30 dark:border-gray-700">
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: 'red' | 'gray' | 'blue'; children: React.ReactNode }) {
  const cls = tone === 'red' ? 'bg-brand-red-soft text-brand-red-dark'
    : tone === 'blue' ? 'bg-badge-blue-bg text-interaction-blue'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return <span className={'rounded-md px-3 font-medium ' + cls}>{children}</span>;
}

function Act({
  onClick, busy, danger, children,
}: { onClick: () => void; busy: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={
        'rounded-md border px-6 py-4 text-lg font-medium disabled:opacity-40 ' +
        (danger
          ? 'border-gray-200 text-gray-400 hover:border-brand-red hover:text-brand-red dark:border-gray-700'
          : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300')
      }>
      {children}
    </button>
  );
}
