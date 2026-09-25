'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 쓰레기통 — 버림 단어만 있어 아예 안 담은 공고 (2026-09-25).

   ── 왜 있나 ──────────────────────────────────────────────────
   그냥 안 담으면 **무엇을 버렸는지 아무도 모릅니다.** 단어 하나가 진짜
   공고를 죽였을 때 알아챌 길이 없습니다. 그래서 버린 것도 남기고 봅니다.

   **자동으로 안 비웁니다.**

   ── 「잘못 버림」 을 누르면 ───────────────────────────────────
   그 줄에 되돌림 표시를 합니다. 그리고 **그 단어가 「다시 볼 단어」 목록에
   올라갑니다** — 되돌린 것들의 걸린 단어를 세어 보여주는 것이 그 목록입니다.
   새 표를 따로 만들지 않았습니다. 같은 단어로 두 번 되돌렸다면 그 단어를
   버림 목록에서 빼야 한다는 뜻입니다.

   단어를 빼는 곳은 두 군데입니다 (둘 다 같이 고쳐야 합니다) —
     gas/wage.js 의 SORT_버림
     tools/sort-rule.mjs 의 버림단어  → node tools/check-sort.mjs 로 확인 */

type 줄 = {
  id: string; trashed_at: string; source: string | null;
  org_name: string | null; title: string; url: string | null;
  why: string; restored: boolean; restored_at: string | null;
};

export default function AdminTrash() {
  const toast = useToast();
  const [rows, setRows] = useState<줄[] | null>(null);
  const [q, setQ] = useState('');
  const [되돌린것만, set되돌린것만] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /* 가져오기만 합니다 — 화면 값은 바꾸지 않습니다.
     effect 안에서 바로 setState 하면 경고가 나고, 실제로도 한 번 더 그려집니다.
     이 저장소의 다른 관리자 화면과 같은 꼴입니다 (app/admin/jobs/page.tsx) */
  const fetchRows = useCallback(async (): Promise<줄[]> => {
    let b = browserSupabase().from('job_trash')
      .select('*').order('trashed_at', { ascending: false }).limit(500);
    if (되돌린것만) b = b.eq('restored', true);
    if (q) b = b.or(`title.ilike.%${q}%,org_name.ilike.%${q}%,why.ilike.%${q}%`);
    const { data, error } = await b;
    if (error) { toast(`불러오지 못했어요 — ${error.message}`, { tone: 'danger' }); return []; }
    return (data ?? []) as 줄[];
  }, [q, 되돌린것만, toast]);

  useEffect(() => {
    let 살아있나 = true;
    fetchRows().then((r) => { if (살아있나) setRows(r); });
    return () => { 살아있나 = false; };
  }, [fetchRows]);

  /* 「다시 볼 단어」 — 되돌린 줄들의 걸린 단어를 셉니다.
     같은 단어가 두 번 넘게 나오면 그 단어가 진짜 공고를 죽이고 있는 것입니다 */
  const 다시볼단어 = useMemo(() => {
    const 셈 = new Map<string, number>();
    (rows ?? []).filter((r) => r.restored).forEach((r) => {
      /* 「버림 단어(직군) 요양보호사,간호조무사」 에서 단어만 꺼냅니다 */
      const 뒤 = r.why.replace(/^[^)]*\)\s*/, '');
      뒤.split(/[,·]/).map((x) => x.trim()).filter(Boolean)
        .forEach((w) => 셈.set(w, (셈.get(w) ?? 0) + 1));
    });
    return [...셈].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const 되돌리기 = async (r: 줄) => {
    if (!confirm(`「${r.title}」를 잘못 버린 것으로 표시할까요?\n`
      + `걸린 단어 — ${r.why}\n\n`
      + '표시만 합니다. 공고를 다시 담으려면 수집기가 다시 돌아야 해요.')) return;
    setBusy(r.id);
    const { error } = await browserSupabase().from('job_trash')
      .update({ restored: true, restored_at: new Date().toISOString() }).eq('id', r.id);
    setBusy(null);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    toast('잘못 버림으로 표시했어요. 위 「다시 볼 단어」 에 올라가요');
    setRows(await fetchRows());
  };

  return (
    <section>
      <h1 className="text-h2 font-bold">쓰레기통</h1>
      <p className="mt-2 break-keep text-lg text-gray-500">
        제목에 버림 단어만 있어 아예 안 담은 공고예요. <b>자동으로 안 비워요.</b>
        <br />
        진짜 공고가 잘못 버려졌으면 「잘못 버림」 을 눌러 주세요.
      </p>

      {/* 다시 볼 단어 — 되돌린 것들의 걸린 단어 */}
      {다시볼단어.length > 0 && (
        <div className="mt-6 rounded-sm border-2 border-brand-red/40 bg-brand-red-soft/30 p-5">
          <p className="text-body-lg font-bold text-brand-red-dark">다시 볼 단어</p>
          <p className="mt-1 break-keep text-sm text-gray-600">
            되돌린 공고에서 걸렸던 단어예요. 두 번 넘게 나오면 그 단어가 진짜 공고를
            죽이고 있는 거예요 — 버림 목록에서 빼는 걸 생각해 보세요.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {다시볼단어.map(([w, n]) => (
              <li key={w}
                className={'rounded-md px-4 py-1 text-sm font-medium '
                  + (n >= 2 ? 'bg-brand-red text-white' : 'bg-white text-gray-700')}>
                {w} <span className="num tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목 · 기관명 · 걸린 단어"
          aria-label="쓰레기통에서 찾기"
          className="min-w-[16rem] flex-1 rounded-sm border border-gray-200 px-5 py-3 text-lg dark:border-gray-700"
        />
        <label className="flex items-center gap-2 text-lg">
          <input type="checkbox" checked={되돌린것만}
            onChange={(e) => set되돌린것만(e.target.checked)} />
          되돌린 것만
        </label>
      </div>

      {rows === null && <p className="mt-8 text-lg text-gray-500">잠시만요…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="mt-8 text-lg text-gray-500">
          {되돌린것만 ? '되돌린 공고가 없어요' : '쓰레기통이 비었어요'}
        </p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <p className="mt-6 text-sm text-gray-500">
            <span className="num tabular-nums">{rows.length}</span>건
            {rows.length >= 500 && ' (500건까지만 보여요)'}
          </p>
          <ul className="mt-3 space-y-3">
            {rows.map((r) => (
              <li key={r.id}
                className={'rounded-sm border p-5 '
                  + (r.restored ? 'border-brand-red/40 bg-brand-red-soft/20' : 'border-gray-200 dark:border-gray-700')}>
                <p className="break-keep text-body-lg font-bold">
                  {r.restored && <span className="mr-2 text-brand-red">되돌림</span>}
                  {r.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {[r.source, r.org_name, r.id, r.trashed_at?.slice(0, 16).replace('T', ' ')]
                    .filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 break-keep text-sm font-medium text-brand-red-dark">
                  버린 이유 — {r.why}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!r.restored && (
                    <button type="button" disabled={busy === r.id} onClick={() => 되돌리기(r)}
                      className="rounded-md border border-brand-red px-5 py-2 text-sm font-bold text-brand-red disabled:opacity-40">
                      {busy === r.id ? '…' : '잘못 버림'}
                    </button>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer"
                      className="rounded-md border border-gray-200 px-5 py-2 text-sm text-gray-600 dark:border-gray-700">
                      원문 보기
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
