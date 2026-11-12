'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { RapoMaskIcon } from '@/components/rapo/rapo-ui';
import { 푸시살피기, 푸시켜기, type 푸시상태 } from '@/lib/push-client';
import { browserSupabase } from '@/lib/supabase-browser';

/* 공고 상세 「마감 임박 시 알림받기」 (2026-11-12 세중님 「지원 방법 날짜 아래에 · 이 기능 만들자」).

   ── 새 장치를 만들지 않았습니다 ───────────────────────────────
   마감 알림은 이미 돕니다 — DB 의 보낼알림() 「마감임박」 갈래가 **저장한 공고(job_stars)** 가운데
   마감이 오늘~3일 안인 것을, 알림을 켠 기기(알림기기)로 한 번 보냅니다 (밤 22시~아침 7시는 안 보냄).
   그래서 이 단추가 하는 일은 둘입니다 —
     ① 이 기기 알림 켜기 (lib/push-client.ts · 이미 켜져 있으면 건너뜀)
     ② 이 공고 저장 (job_stars · 아래 고정 「저장」 단추와 같은 줄)
   둘 다 되어 있으면 「받는 중」입니다. 다시 누르면 저장을 풀어 알림을 끕니다(기기 알림 자체는 그대로 — 다른 공고·기관 알림이 걸려 있습니다).

   아래 「저장」 단추(components/job-save.tsx)와 서로 맞추려고 window 에 `rapo:job-star` 를 주고받습니다.
   마감일을 모르는 공고·마감된 공고에는 이 단추를 안 그립니다(page.tsx 가 정함) — 보낼 날짜가 없습니다. */

export const 별바뀜 = 'rapo:job-star';

export function JobDeadlineNotify({ id }: { id: string }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [저장, set저장] = useState<boolean | null>(null);
  const [푸시, set푸시] = useState<푸시상태 | null>(null);
  const [busy, setBusy] = useState(false);
  const [도움, set도움] = useState<string | null>(null);

  useEffect(() => {
    let 살아있나 = true;
    푸시살피기().then((s) => { if (살아있나) set푸시(s); });
    return () => { 살아있나 = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    browserSupabase().from('job_stars').select('job_id').eq('job_id', id).maybeSingle()
      .then(({ data }) => { if (살아있나) set저장(!!data); });
    return () => { 살아있나 = false; };
  }, [session, id]);

  /* 아래 「저장」 단추가 바꾸면 여기도 따라갑니다 */
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; on: boolean }>).detail;
      if (d?.id === id) set저장(d.on);
    };
    window.addEventListener(별바뀜, h);
    return () => window.removeEventListener(별바뀜, h);
  }, [id]);

  const 받는중 = !!session && 저장 === true && 푸시 === '켜짐';

  async function 누름() {
    if (loading || busy) return;
    if (!session) {
      try { sessionStorage.setItem('after_login', `/jobs/${id}`); } catch { /* 사파리 비공개 */ }
      router.push('/login');
      return;
    }
    setBusy(true);
    set도움(null);
    try {
      const sb = browserSupabase();
      if (받는중) {
        const { error } = await sb.from('job_stars').delete().eq('job_id', id);
        if (error) { toast(`알림을 끄지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
        set저장(false);
        window.dispatchEvent(new CustomEvent(별바뀜, { detail: { id, on: false } }));
        toast('마감 알림을 껐어요. 저장도 함께 풀렸어요');
        return;
      }
      if (푸시 !== '켜짐') {
        const r = await 푸시켜기();
        set푸시(r.상태);
        if (r.상태 !== '켜짐') { set도움(r.까닭 ?? '알림을 켜지 못했어요'); return; }
      }
      if (!저장) {
        const { error } = await sb.from('job_stars').insert({ job_id: id });
        /* 23505 = 이미 저장돼 있음 (다른 탭에서 눌렀을 때) — 된 것으로 봅니다 */
        if (error && error.code !== '23505') {
          toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 });
          return;
        }
        set저장(true);
        window.dispatchEvent(new CustomEvent(별바뀜, { detail: { id, on: true } }));
      }
      toast('마감 3일 전에 알려드릴게요. 공고도 저장했어요');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <button
        type="button" onClick={누름} disabled={busy}
        aria-pressed={받는중} aria-busy={busy || undefined}
        className={'rapo-type-t6-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center gap-(--rapo-dimension-x2) '
          + 'rounded-(--rapo-radius-r3) border disabled:opacity-60 '
          + (받는중
            ? 'border-(--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-brand-contrast)'
            : 'border-(--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral) active:bg-(--rapo-color-bg-transparent-pressed)')}
      >
        <RapoMaskIcon src="/rapo/me/bell-24.svg" w={20} h={20} />
        {busy ? '잠시만요…' : 받는중 ? '마감 알림 받는 중' : '마감 임박 시 알림받기'}
      </button>
      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        {도움 ?? (받는중
          ? '마감 3일 전에 이 기기로 알려드려요. 다시 누르면 꺼져요.'
          : '누르면 이 공고를 저장하고, 마감 3일 전에 이 기기로 알려드려요.')}
      </p>
    </div>
  );
}
