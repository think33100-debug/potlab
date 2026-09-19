'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { EDITABLE, type AdminJob } from '@/lib/admin-jobs';
import { SOURCE_NAME, tabLabel } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../../toast';

/* 공고 하나 고치기.

   고친 칸 이름을 edited_fields 에 적어 둡니다. 수집기가 나중에 같은 공고를
   다시 받았을 때 손으로 고친 칸을 덮어쓰지 않게 하려는 표시입니다.
   (수집기가 아직 Apps Script 에 있어서 지금은 표시만 남깁니다) */
export default function AdminJobEdit() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [job, setJob] = useState<AdminJob | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  const fetchOne = useCallback(async () => {
    const { data } = await browserSupabase()
      .from('admin_jobs').select('*').eq('id', id).maybeSingle();
    return (data as AdminJob | null) ?? null;
  }, [id]);

  useEffect(() => {
    let alive = true;
    fetchOne().then((j) => {
      if (!alive) return;
      if (!j) { setMissing(true); return; }
      setJob(j);
      setDraft(Object.fromEntries(
        EDITABLE.map((f) => [f.key, String(j[f.key] ?? '')]),
      ));
    });
    return () => { alive = false; };
  }, [fetchOne]);

  if (missing) {
    return (
      <div>
        <p className="text-lg text-gray-500">그런 공고가 없어요. 이미 지워졌을 수 있어요</p>
        <Link href="/admin/jobs" className="mt-5 inline-block text-lg text-interaction-blue hover:underline">
          ← 공고 목록
        </Link>
      </div>
    );
  }
  if (!job) return <p className="text-lg text-gray-400">불러오는 중…</p>;

  const changed = EDITABLE.filter((f) => draft[f.key] !== String(job[f.key] ?? ''));

  const save = async () => {
    if (changed.length === 0) return;
    setBusy(true);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of changed) {
      const v = draft[f.key].trim();
      patch[f.key] = v === '' ? null : v;
    }
    /* 손으로 고친 칸을 적어 둡니다 — 겹치지 않게 합칩니다 */
    const marks = new Set<string>(changed.map((f) => String(f.key)));
    patch.edited_fields = [...marks];

    const { error } = await browserSupabase().from('job_posts').update(patch).eq('id', job.id);
    setBusy(false);

    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast(`${changed.length}개 칸을 고쳤어요`);
    const fresh = await fetchOne();
    if (fresh) { setJob(fresh); }
  };

  const flag = async (v: Record<string, boolean>, said: string) => {
    setBusy(true);
    const { error } = await browserSupabase().from('job_posts')
      .update({ ...v, updated_at: new Date().toISOString() }).eq('id', job.id);
    setBusy(false);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast(said);
    const fresh = await fetchOne();
    if (fresh) setJob(fresh);
  };

  const remove = async () => {
    if (!confirm(`「${job.title}」를 지울까요?\n되돌릴 수 없어요. 보류함으로 보내는 쪽이 안전해요`)) return;
    setBusy(true);
    const { error } = await browserSupabase().from('job_posts').delete().eq('id', job.id);
    setBusy(false);
    if (error) { toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('공고를 지웠어요');
    router.push('/admin/jobs');
  };

  return (
    <div>
      <Link href="/admin/jobs" className="text-lg text-interaction-blue hover:underline">← 공고 목록</Link>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-gray-400">
        {job.hold && <span className="rounded-md bg-brand-red-soft px-3 font-medium text-brand-red-dark">보류</span>}
        {job.hidden && <span className="rounded-md bg-gray-100 px-3 font-medium text-gray-600 dark:bg-gray-800">숨김</span>}
        <span>{job.id}</span>
        <span>· 출처 {SOURCE_NAME[job.source] ?? job.source}</span>
        <span>· 수집 {job.collected_at?.slice(0, 10)}</span>
        {job.tab && <span>· {tabLabel(job.tab)}</span>}
      </div>

      {job.evidence?.['탭근거'] && (
        <p className="mt-2 text-sm text-gray-500">분류 근거 — {job.evidence['탭근거']}</p>
      )}

      {/* 상태 단추 */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" disabled={busy}
          onClick={() => flag({ hold: !job.hold }, job.hold ? '보류를 풀었어요' : '보류함으로 보냈어요')}
          className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
          {job.hold ? '보류 풀기' : '보류로 보내기'}
        </button>
        <button type="button" disabled={busy}
          onClick={() => flag({ hidden: !job.hidden }, job.hidden ? '다시 보이게 했어요' : '숨겼어요')}
          className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
          {job.hidden ? '다시 보이기' : '숨기기'}
        </button>
        <Link href={`/jobs/${job.id}`} target="_blank"
          className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium dark:border-gray-700">
          회원 화면
        </Link>
        <a href={job.url} target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium dark:border-gray-700">
          원문 열기
        </a>
        <span className="flex-1" />
        <button type="button" disabled={busy} onClick={remove}
          className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-400 hover:border-brand-red hover:text-brand-red disabled:opacity-40 dark:border-gray-700">
          삭제
        </button>
      </div>

      {/* 고칠 칸 */}
      <div className="mt-8 space-y-5">
        {EDITABLE.map((f) => {
          const dirty = draft[f.key] !== String(job[f.key] ?? '');
          return (
            <label key={String(f.key)} className="block">
              <span className="text-sm font-bold text-gray-500">
                {f.label}
                {dirty && <span className="ml-2 font-medium text-brand-red">고침</span>}
              </span>
              <input
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                className={
                  'mt-1 w-full rounded-xs border bg-gray-50 px-5 py-4 text-lg dark:bg-gray-950 '
                  + (dirty ? 'border-brand-red' : 'border-gray-200 dark:border-gray-700')
                }
              />
            </label>
          );
        })}
      </div>

      {/* 본문 — 보기만 합니다 */}
      {Object.keys(job.detail ?? {}).length > 0 && (
        <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
          <h2 className="text-h3 font-bold">본문</h2>
          <p className="mt-1 text-sm text-gray-500">
            수집기가 채운 칸이에요. 여기서는 보기만 해요
          </p>
          <dl className="mt-5 space-y-5">
            {Object.entries(job.detail).map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-bold text-gray-500">{k}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-lg text-gray-700 dark:text-gray-300">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 저장 — 아래에 붙어 따라옵니다 */}
      <div className="sticky bottom-0 mt-8 -mx-6 border-t border-gray-100 bg-white px-6 py-5 md:-mx-7 md:px-7 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-5">
          <span className="text-lg text-gray-500">
            {changed.length === 0 ? '고친 칸이 없어요' : `${changed.length}개 칸을 고쳤어요`}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={() => setDraft(Object.fromEntries(
            EDITABLE.map((f) => [f.key, String(job[f.key] ?? '')]),
          ))} disabled={changed.length === 0}
            className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium disabled:opacity-30 dark:border-gray-700">
            되돌리기
          </button>
          <button type="button" onClick={save} disabled={busy || changed.length === 0}
            className="rounded-md bg-brand-red px-7 py-4 text-lg font-bold text-white hover:bg-brand-red-dark disabled:opacity-40">
            {busy ? '저장하는 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
