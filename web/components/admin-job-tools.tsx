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
  const [올림폼, set올림폼] = useState(false);
  const [왜, set왜] = useState('');
  const [순서, set순서] = useState('100');
  const [까지, set까지] = useState('');

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

  /* 추천순 맨 위로 올리기 (2026-10-07). 나중에 유료 광고와 이어질 자리라
     「누가 언제 왜」 가 기록으로 남습니다 — DB 의 공고올림 표입니다.
     여기서는 올리고 내리기만 하고, 쌓인 기록은 /admin/boost 에서 봅니다 */
  const 올리기 = async () => {
    const 글 = 왜.trim();
    if (글.length < 2) { toast('왜 올리는지 적어 주세요', { tone: 'danger', ms: 3000 }); return; }
    setBusy(true);
    const { error } = await browserSupabase().rpc('admin_공고올리기', {
      p_job: id, p_왜: 글,
      p_순서: Number(순서) || 100,
      p_부터: null,
      p_까지: 까지 || null,
    });
    setBusy(false);
    if (error) { toast(`올리지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    set올림폼(false); set왜('');
    toast('추천순 맨 위로 올렸어요', { ms: 3000 });
    router.refresh();
  };

  const 내리기 = async () => {
    const 글 = 왜.trim();
    if (글.length < 2) { toast('왜 내리는지 적어 주세요', { tone: 'danger', ms: 3000 }); return; }
    setBusy(true);
    const { data, error } = await browserSupabase()
      .rpc('admin_공고내리기', { p_job: id, p_왜: 글 });
    setBusy(false);
    if (error) { toast(`내리지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    set올림폼(false); set왜('');
    toast(Number(data) > 0 ? '추천에서 내렸어요' : '올려 둔 것이 없었어요', { ms: 3000 });
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
        <Btn onClick={() => set올림폼((v) => !v)} busy={busy}>추천순 올리기</Btn>
        <Btn onClick={remove} busy={busy} danger>삭제</Btn>
      </div>

      {올림폼 && (
        <div className="mt-5 rounded-sm border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="break-keep text-lg font-medium">추천순 맨 위로</p>
          <p className="mt-1 break-keep text-sm text-mute">
            왜 올리는지는 꼭 적습니다 — 나중에 유료 광고와 이어질 자리라 기록이 남아야 합니다.
            쌓인 기록은 관리자 「추천 올린 공고」 에서 봅니다.
          </p>
          <input
            value={왜} onChange={(e) => set왜(e.target.value)} maxLength={300}
            placeholder="왜 올리나요? (예: 국립재활원 단독 공고 · 10월 광고)"
            className="mt-4 w-full rounded-xs border border-gray-200 bg-gray-50 px-4 py-3 text-lg dark:border-gray-700 dark:bg-gray-950"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-lg">
              순서
              <input
                type="number" min={1} value={순서} onChange={(e) => set순서(e.target.value)}
                className="w-24 rounded-xs border border-gray-200 bg-gray-50 px-3 py-2 text-lg dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <label className="flex items-center gap-2 text-lg">
              까지
              <input
                type="date" value={까지} onChange={(e) => set까지(e.target.value)}
                className="rounded-xs border border-gray-200 bg-gray-50 px-3 py-2 text-lg dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <span className="text-sm text-mute">작은 순서가 위 · 「까지」 를 비우면 기간 끝 없음</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn onClick={올리기} busy={busy}>올리기</Btn>
            <Btn onClick={내리기} busy={busy}>내리기</Btn>
          </div>
        </div>
      )}
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
          ? 'text-btn font-bold border-brand-red bg-brand-red text-white hover:bg-brand-red-dark'
          : 'text-lg font-medium border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300')
      }
    >
      {children}
    </button>
  );
}
