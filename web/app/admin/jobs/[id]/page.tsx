'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { EDITABLE, type AdminJob } from '@/lib/admin-jobs';
import { SOURCE_NAME, tabLabel } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../../toast';
import { AdminBadge, 관 } from '@/components/rapo/rapo-admin-ui';

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
      <div className="max-w-[932px]">
        <p className="text-[16px] text-[#555d6d]">그런 공고가 없어요. 이미 지워졌을 수 있어요</p>
        <Link href="/admin/jobs" className="mt-[16px] inline-flex text-[14px] font-bold text-[#112231] hover:underline">
          ← 공고 목록
        </Link>
      </div>
    );
  }
  if (!job) return <p className="text-[16px] text-[#555d6d]">불러오는 중…</p>;

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

  /* ★ 2026-10-12 — **창구(admin_decide)로 돌렸습니다.**
     전에는 job_posts 를 직접 update 했습니다. 그래서 둘이 어긋났습니다 —
       ① hidden_why 를 안 지웁니다 → 「hidden=false 인데 까닭이 남은 줄」이 생깁니다
       ② admin_locked 를 안 켭니다 → 관리자가 「다시 보이기」를 눌러도
          그날 23:00 밤정리·정찰이 **조용히 다시 감춥니다**
     admin_decide 가 hold·hidden·hidden_why·hidden_on·admin_locked 를 한 번에
     맞춥니다. 「살리기」에는 지금 직군을 그대로 넘깁니다 — 안 넘기면
     job_group 이 null 이 됩니다. */
  const decide = async (what: '살리기' | '숨기기' | '보류함으로', said: string) => {
    setBusy(true);
    const { error } = await browserSupabase().rpc('admin_decide', {
      p_id: job.id, p_what: what,
      p_job_group: what === '살리기' ? (job.job_group ?? null) : null,
      p_note: null,
    });
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

  /* 2026-11-19 — 새 관리자 디자인 「공고 상세」(Figma 1406:581)로 겉모양만 바꿨습니다.
     빵부스러기 · 제목 · 보류 띠 · 흰 카드(고칠 칸 · 모집인원 · 수집 본문 · 상태 관리) · 아래 저장 줄 */
  const 보류사유 = job.evidence?.['보류사유'];
  return (
    <div className="max-w-[932px]">
      {/* 공고 제목 영역 */}
      <nav aria-label="위치" className="text-[13px] leading-[18px] text-[#555d6d]">
        <Link href="/admin/jobs" className="hover:underline">공고 관리</Link>
        <span aria-hidden> / </span>
        <span>공고 상세</span>
      </nav>
      <div className="mt-[8px] flex flex-wrap items-start justify-between gap-x-[24px] gap-y-[8px]">
        <h1 className="rapo-type-t12-bold min-w-0 break-keep text-[#112231]">{job.title}</h1>
        <div className="flex shrink-0 flex-wrap items-center gap-[20px] pt-[10px]">
          <Link href={`/jobs/${job.id}`} target="_blank" className={관.btnText}>회원 화면 보기 ↗</Link>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className={관.btnText}>원문 열기 ↗</a>
        </div>
      </div>
      <div className="mt-[8px] flex flex-wrap items-center gap-x-[8px] gap-y-[6px] text-[14px] text-[#304f65]">
        {job.hold && <AdminBadge tone="warn">보류</AdminBadge>}
        {job.hidden && <AdminBadge tone="neutral">숨김</AdminBadge>}
        {!job.hold && !job.hidden && <AdminBadge tone="ok">게시 중</AdminBadge>}
        <span>{job.org_name}</span>
        <span aria-hidden className="text-[#c7d1d9]">|</span>
        <span>{SOURCE_NAME[job.source] ?? job.source}</span>
        <span aria-hidden className="text-[#c7d1d9]">|</span>
        <span>수집일 {job.collected_at?.slice(0, 10).replaceAll('-', '.')}</span>
        {job.tab && <><span aria-hidden className="text-[#c7d1d9]">|</span><span>{tabLabel(job.tab)}</span></>}
        <span aria-hidden className="text-[#c7d1d9]">|</span>
        <span className="text-[#555d6d]">{job.id}</span>
      </div>

      {job.evidence?.['탭근거'] && (
        <p className={관.sub + ' mt-[8px]'}>분류 근거 — {job.evidence['탭근거']}</p>
      )}

      {/* 보류 사유 — 원본 「보류 사유」 띠 (warning-50) */}
      {job.hold && (
        <div className="mt-[24px] flex flex-wrap items-center gap-x-[16px] gap-y-[8px] rounded-[12px] bg-[#fff8ec] px-[16px] py-[14px]">
          <AdminBadge tone="warn">보류</AdminBadge>
          <p className="min-w-0 flex-1 break-keep text-[16px] font-bold text-[#6f3807]">
            {보류사유 ? String(보류사유) : '보류함에 있는 공고예요'}
          </p>
          <button type="button" disabled={busy}
            onClick={() => decide('살리기', '보류를 풀었어요 — 결정이 잠겼습니다')}
            className={관.btnText}>
            보류 풀기
          </button>
        </div>
      )}

      {/* 고칠 칸 — 원본 「모집 정보」 카드 · 두 칸씩 */}
      <section aria-labelledby="job-edit" className={관.card + ' mt-[24px]'}>
        <h2 id="job-edit" className="rapo-type-t7-bold text-[#112231]">공고 정보</h2>
        <div className="mt-[16px] grid gap-x-[24px] gap-y-[16px] md:grid-cols-2">
          {EDITABLE.map((f) => {
            const dirty = draft[f.key] !== String(job[f.key] ?? '');
            return (
              <label key={String(f.key)} className={'block min-w-0' + (f.long ? ' md:col-span-2' : '')}>
                <span className={관.fieldLabel}>
                  {f.label}
                  {dirty && <span className="ml-[8px] text-[#b42a21]">고침</span>}
                </span>
                <input
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  className={관.input + (dirty ? ' !border-[#ff4f40]' : '')}
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* ★ 2026-10-24 세중님 2번 — **모집인원은 두 꼴**입니다. 어느 것이 회원에게
          보이는지 헷갈리기 쉬워서 **화면이 보는 순서**를 그대로 적어 둡니다
          (web/app/jobs/[id]/page.tsx:207 과 같은 순서입니다) */}
      <section aria-labelledby="job-headcount" className={관.card + ' mt-[24px]'}>
        <h2 id="job-headcount" className="rapo-type-t7-bold text-[#112231]">모집인원 — 회원 화면이 보는 순서</h2>
        <ol className="mt-[12px] list-decimal space-y-[6px] pl-[20px] text-[14px] leading-[19px] text-[#304f65]">
          <li>
            직군별 인원{' '}
            <b className="text-[#112231]">{(job.detail?.['직군인원'] as string | undefined) || '(없음)'}</b>
          </li>
          <li>
            위에서 고치는 <b className="text-[#112231]">모집인원(숫자)</b>{' '}
            <b className="text-[#112231]">{job.headcount == null ? '(빈칸)' : `${job.headcount}명`}</b>
          </li>
          <li>
            원문 그대로 글꼴(○명·0명){' '}
            <b className="text-[#112231]">
              {((job.detail?.['뽑은값'] as unknown as Record<string, string> | undefined)?.모집인원)
                || (job.detail?.['모집인원'] as string | undefined) || '(이 뷰에 없음)'}
            </b>
          </li>
        </ol>
        <p className={관.sub + ' mt-[12px]'}>
          숫자가 비면 글꼴을 보여 줍니다. 숫자를 고치면 수집기가 그 칸을 다시 덮지
          않습니다(edited_fields). 글꼴은 <code>뽑은값</code> 칸에 있고 이 화면의 뷰에는
          아직 그 칸이 없어 「(이 뷰에 없음)」으로 보일 수 있습니다 — 뷰·창구는 승인 자리입니다
        </p>
      </section>

      {/* 본문 — 보기만 합니다 (원본 「수집 본문」 · 읽기 전용) */}
      {Object.keys(job.detail ?? {}).length > 0 && (
        <section aria-labelledby="job-body" className={관.card + ' mt-[24px]'}>
          <div className="flex items-center justify-between gap-[12px]">
            <h2 id="job-body" className="rapo-type-t7-bold text-[#112231]">수집 본문</h2>
            <span className="text-[14px] font-bold text-[#555d6d]">읽기 전용</span>
          </div>
          <p className={관.sub + ' mt-[4px]'}>
            수집기가 채운 칸이에요. 여기서는 보기만 해요
          </p>
          <dl className="mt-[16px] divide-y divide-[#f1f5f8]">
            {Object.entries(job.detail).map(([k, v]) => (
              <div key={k} className="grid gap-[4px] py-[10px] md:grid-cols-[180px_1fr] md:gap-[16px]">
                <dt className="text-[14px] font-bold text-[#304f65]">{k}</dt>
                <dd className="whitespace-pre-wrap break-words text-[16px] leading-[22px] text-[#112231]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 상태 단추 — 원본 「공고 상태 관리」 카드 */}
      <section aria-labelledby="job-state" className={관.cardTight + ' mt-[24px] flex flex-wrap items-center gap-[12px] px-[20px] py-[16px] md:px-[24px]'}>
        <h2 id="job-state" className="mr-auto text-[16px] font-bold text-[#112231]">공고 상태 관리</h2>
        {!job.hold && (
          <button type="button" disabled={busy}
            onClick={() => decide('보류함으로', '보류함으로 보냈어요')}
            className={관.btnLine}>
            보류로 보내기
          </button>
        )}
        <button type="button" disabled={busy}
          onClick={() => (job.hidden ? decide('살리기', '다시 보이게 했어요 — 결정이 잠겼습니다') : decide('숨기기', '숨겼어요'))}
          className={관.btnLine}>
          {job.hidden ? '다시 보이기' : '숨기기'}
        </button>
        <button type="button" disabled={busy} onClick={remove} className={관.btnDanger}>
          삭제
        </button>
      </section>

      {/* 저장 — 아래에 붙어 따라옵니다 (원본 「공고 작업」: 목록으로 · 되돌리기 · 저장) */}
      <div className="sticky bottom-0 -mx-[20px] mt-[24px] border-t border-[#dde4e6] bg-[#f6f8f9] px-[20px] py-[12px] md:-mx-[32px] md:px-[32px]">
        <div className="flex max-w-[932px] flex-wrap items-center gap-[12px]">
          <Link href="/admin/jobs" className={관.btnText}>목록으로</Link>
          <span className="text-[14px] text-[#555d6d]">
            {changed.length === 0 ? '고친 칸이 없어요' : `${changed.length}개 칸을 고쳤어요`}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={() => setDraft(Object.fromEntries(
            EDITABLE.map((f) => [f.key, String(job[f.key] ?? '')]),
          ))} disabled={changed.length === 0}
            className={관.btnText}>
            되돌리기
          </button>
          <button type="button" onClick={save} disabled={busy || changed.length === 0}
            className={관.btn + ' min-w-[120px]'}>
            {busy ? '저장하는 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
