'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';

/* 공고 숨기기 (2026-11-14 세중님 「채용시까지 공고는 보기 싫을 수 있어서 저장하기 옆에 숨기기 · 숨긴 건 내 정보에 쌓이게」).

   숨기면 내 공고 목록·홈에서 그 공고가 빠지고(DB job_list 가 숨긴공고 표를 봅니다), 내 정보 「숨긴 공고」에 모입니다.
   나만 그렇습니다 — 다른 회원 화면은 그대로입니다. 풀기는 같은 단추(「숨김 해제」)나 내 정보에서.
   저장 단추(RapoSaveBar · components/job-save.tsx)와 같은 면·같은 높이입니다 */
export function JobHide({ id }: { id?: string }) {
  const { session } = useAuth();
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !session) { setOn(false); return; }
    browserSupabase().from('숨긴공고').select('숨김').eq('공고', id).maybeSingle()
      .then(({ data }) => setOn(!!(data as { 숨김?: boolean } | null)?.숨김));
  }, [id, session]);

  async function toggle() {
    if (!id || !session || busy || on === null) return;
    setBusy(true);
    const 다음 = !on;
    const { error } = await browserSupabase().rpc('공고숨기기', { p_공고: id, p_숨길까: 다음 });
    setBusy(false);
    if (error) { toast(`${다음 ? '숨기' : '숨김 해제하'}지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    setOn(다음);
    /* 2026-11-14 세중님이 정한 글 그대로 */
    toast(다음 ? '공고를 숨겼어요! 내 정보에서 언제든지 해제할 수 있어요' : '숨김을 풀었어요', { ms: 3500 });
  }

  const 보임 = !!on;
  return (
    <button type="button" onClick={toggle} disabled={!id || !session || busy || on === null}
      aria-pressed={보임} aria-busy={busy || undefined}
      className="rapo-type-t2-medium flex h-(--rapo-dimension-x10) min-w-0 flex-1 items-center justify-center
                 gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r2) border border-(--rapo-color-stroke-neutral-weak)
                 bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)
                 enabled:active:bg-(--rapo-color-bg-transparent-pressed) disabled:opacity-40">
      {/* eslint-disable-next-line @next/next/no-img-element -- 같은 선 규칙(1.35 · 둥근 끝)으로 그린 눈 모양 */}
      <img src="/rapo/detail/eye-off-18.svg" alt="" width={13} height={13} />
      {busy ? '처리 중' : 보임 ? '숨김 해제' : '숨기기'}
    </button>
  );
}
