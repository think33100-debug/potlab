'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';
import { SOURCE_NAME, type JobMeta } from '@/lib/supabase';

/* 관리자가 앱을 돌아다니다가 그 자리에서 공고를 손보는 줄입니다.

   회원에게는 아무것도 안 보입니다. 다만 「안 보인다」가 막는 게 아닙니다 —
   job_posts 의 UPDATE 규칙이 is_admin() 이고, 출처·수집일은 칸 단위 권한으로
   아예 안 내줍니다. 이 파일은 단추만 그립니다. */
export function AdminJobTools({ id }: { id: string }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [meta, setMeta] = useState<JobMeta | null>(null);
  const [busy, setBusy] = useState(false);

  /* job_meta 는 뷰 안에서 is_admin() 으로 잠겨 있습니다.
     관리자가 아니면 한 줄도 안 나옵니다 */
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    browserSupabase().from('job_meta').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (alive) setMeta(data as JobMeta | null); });
    return () => { alive = false; };
  }, [id, isAdmin]);

  if (!isAdmin) return null;

  const patch = async (v: Record<string, boolean>, said: string) => {
    setBusy(true);
    const { error } = await browserSupabase().from('job_posts').update(v).eq('id', id);
    setBusy(false);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast(said);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm('이 공고를 지울까요? 되돌릴 수 없어요')) return;
    setBusy(true);
    const { error } = await browserSupabase().from('job_posts').delete().eq('id', id);
    setBusy(false);
    if (error) { toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('공고를 지웠어요');
    router.push('/jobs');
  };

  return (
    <section className="mt-8 rounded-sm border border-brand-red/30 bg-brand-red-soft/40 p-6">
      <p className="text-xs text-brand-red-dark">관리자에게만 보여요</p>

      {meta && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          출처 {SOURCE_NAME[meta.source] ?? meta.source}
          {' · '}수집 {meta.collected_at?.slice(0, 10)}
          {meta.hidden ? ' · 숨김' : ''}{meta.hold ? ' · 보류' : ''}
          {/* 왜 보류인지 — 이게 없으면 관리자가 한 건씩 열어 원문을 읽어야 합니다.
              시트의 「보류사유」 칸이 evidence 에 실려 옵니다 (tools/copy_jobs.js) */}
          {meta.hold && meta.evidence?.['보류사유'] && (
            <><br /><b className="text-brand-red-dark">보류 이유 — {meta.evidence['보류사유']}</b></>
          )}
          {meta.evidence?.['탭근거'] && <><br />분류 근거 — {meta.evidence['탭근거']}</>}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Btn onClick={() => patch({ hidden: !meta?.hidden }, meta?.hidden ? '다시 보이게 했어요' : '숨겼어요')} busy={busy}>
          {meta?.hidden ? '다시 보이기' : '숨기기'}
        </Btn>
        <Btn onClick={() => patch({ hold: !meta?.hold }, meta?.hold ? '보류를 풀었어요' : '보류함으로 보냈어요')} busy={busy}>
          {meta?.hold ? '보류 풀기' : '보류로 보내기'}
        </Btn>
        <Btn onClick={() => router.push(`/admin/jobs/${id}`)} busy={busy}>수정</Btn>
        <Btn onClick={remove} busy={busy} danger>삭제</Btn>
      </div>
    </section>
  );
}

function Btn({
  onClick, busy, danger, children,
}: {
  onClick: () => void; busy: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        'rounded-md border px-6 py-4 disabled:opacity-40 ' +
        (danger
          /* 빨강 바탕 위 흰 글자는 16px 굵게여야 합니다 — 브랜드 명세서 2번 */
          ? 'text-body-lg font-bold border-brand-red bg-brand-red text-white hover:bg-brand-red-dark'
          : 'text-lg font-medium border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300')
      }
    >
      {children}
    </button>
  );
}
