'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { RapoButton, RapoMaskIcon } from '@/components/rapo/rapo-ui';
import { 푸시살피기, 푸시켜기, type 푸시상태 } from '@/lib/push-client';
import { browserSupabase } from '@/lib/supabase-browser';

/* 공고 상세 「마감 임박 시 알림받기」 (2026-11-12 세중님 「지원 방법 날짜 아래에 · 이 기능 만들자」).

   ── 새 장치를 만들지 않았습니다 ───────────────────────────────
   마감 알림은 이미 돕니다 — DB 의 보낼알림() 이 **저장한 공고(job_stars)** 가운데 마감이 가까운 것을
   알림을 켠 기기(알림기기)로 한 번씩 보냅니다 (밤 22시~아침 7시는 안 보냄).
     「마감임박」   job_stars.마감알림 에 3 — 마감 3일 안
     「마감하루전」 job_stars.마감알림 에 1 — 마감 1일 안   (금고 SQL_1113/R · 2026-11-12 밤)

   ★ 2026-11-12 밤 세중님 「누르면 라포 전체 알림 동의를 하려고 해 · 동의가 들어가야 · 3일 전 1일 전 둘 중 선택 · 둘 다 가능」 —
     누르면 바로 브라우저 알림 허용을 묻지 않고, 먼저 이 창을 띄웁니다:
       ① 언제 받을지 (3일 전 · 1일 전 · 둘 다) — 미리 3일 전만 골라 둡니다(지금까지 동작과 같음)
       ② [필수] RAPO 알림 수신 동의 — notification_settings.agreed 로 남깁니다
     「알림 받기」를 누르면 → 이 기기 알림 켜기 → 동의 남기기 → 이 공고 저장(고른 날 함께)

   아래 「저장」 단추(components/job-save.tsx)와 서로 맞추려고 window 에 `rapo:job-star` 를 주고받습니다.
   마감일을 모르는 공고·마감된 공고에는 이 단추를 안 그립니다(page.tsx 가 정함) — 보낼 날짜가 없습니다. */

export const 별바뀜 = 'rapo:job-star';

const 날말 = (날: number[]) => [...날].sort((a, b) => b - a).map((n) => `${n}일 전`).join(' · ');

export function JobDeadlineNotify({ id }: { id: string }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [저장, set저장] = useState<boolean | null>(null);
  /* 저장된 줄의 마감알림 — 없으면(저장 안 함) 창의 기본값 [3] */
  const [저장된날, set저장된날] = useState<number[]>([3]);
  const [푸시, set푸시] = useState<푸시상태 | null>(null);
  const [busy, setBusy] = useState(false);
  const [도움, set도움] = useState<string | null>(null);
  const [창, set창] = useState(false);
  const [고른날, set고른날] = useState<number[]>([3]);
  const [동의, set동의] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    푸시살피기().then((s) => { if (살아있나) set푸시(s); });
    return () => { 살아있나 = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    browserSupabase().from('job_stars').select('job_id, 마감알림').eq('job_id', id).maybeSingle()
      .then(({ data }) => {
        if (!살아있나) return;
        set저장(!!data);
        const 날 = (data as { 마감알림?: number[] } | null)?.마감알림;
        if (Array.isArray(날)) set저장된날(날);
      });
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

  const 받는중 = !!session && 저장 === true && 푸시 === '켜짐' && 저장된날.length > 0;

  function 열기() {
    if (loading || busy) return;
    if (!session) {
      try { sessionStorage.setItem('after_login', `/jobs/${id}`); } catch { /* 사파리 비공개 */ }
      router.push('/login');
      return;
    }
    set고른날(받는중 ? 저장된날 : [3]);
    /* 이미 받는 중이면 동의는 이미 한 것입니다 */
    set동의(받는중);
    set도움(null);
    set창(true);
  }

  const 날바꾸기 = (n: number) =>
    set고른날((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n]));

  async function 받기() {
    if (busy || 고른날.length === 0 || !동의 || !session) return;
    setBusy(true);
    set도움(null);
    try {
      const sb = browserSupabase();
      if (푸시 !== '켜짐') {
        const r = await 푸시켜기();
        set푸시(r.상태);
        if (r.상태 !== '켜짐') { set도움(r.까닭 ?? '알림을 켜지 못했어요'); return; }
      }
      /* [필수] RAPO 알림 수신 동의 — 공고 마감 화면의 「새 공고 알림」과 같은 자리입니다 */
      const 동의줄 = await sb.from('notification_settings').upsert({
        profile_id: session.user.id, agreed: true, agreed_at: new Date().toISOString(),
      });
      if (동의줄.error) console.error('[RAPO] 알림 동의를 못 남겼습니다 ·', 동의줄.error.message);

      const 날 = [...고른날].sort((a, b) => a - b);
      if (저장) {
        const { error } = await sb.from('job_stars').update({ 마감알림: 날 }).eq('job_id', id);
        if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
      } else {
        const { error } = await sb.from('job_stars').insert({ job_id: id, 마감알림: 날 });
        /* 23505 = 이미 저장돼 있음 (다른 탭에서 눌렀을 때) — 날만 다시 적습니다 */
        if (error && error.code === '23505') {
          await sb.from('job_stars').update({ 마감알림: 날 }).eq('job_id', id);
        } else if (error) {
          toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 });
          return;
        }
        set저장(true);
        window.dispatchEvent(new CustomEvent(별바뀜, { detail: { id, on: true } }));
      }
      set저장된날(날);
      set창(false);
      toast(`마감 ${날말(날)}에 알려드릴게요. 공고도 저장했어요`);
    } finally { setBusy(false); }
  }

  async function 끄기() {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await browserSupabase().from('job_stars').delete().eq('job_id', id);
      if (error) { toast(`알림을 끄지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
      set저장(false);
      set저장된날([3]);
      window.dispatchEvent(new CustomEvent(별바뀜, { detail: { id, on: false } }));
      set창(false);
      toast('마감 알림을 껐어요. 저장도 함께 풀렸어요');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <button
        type="button" onClick={열기} disabled={busy}
        aria-pressed={받는중} aria-haspopup="dialog"
        className={'rapo-type-t6-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center gap-(--rapo-dimension-x2) '
          + 'rounded-(--rapo-radius-r3) border disabled:opacity-60 '
          + (받는중
            ? 'border-(--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-brand-contrast)'
            : 'border-(--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral) active:bg-(--rapo-color-bg-transparent-pressed)')}
      >
        <RapoMaskIcon src="/rapo/me/bell-24.svg" w={20} h={20} />
        {받는중 ? `마감 알림 받는 중 · ${날말(저장된날)}` : '마감 임박 시 알림받기'}
      </button>
      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        {받는중
          ? '누르면 알림 날짜를 바꾸거나 끌 수 있어요.'
          : '누르면 알림 받을 날(3일 전 · 1일 전)을 고르고, 이 공고를 저장해요.'}
      </p>

      {창 && (
        <div data-rapo role="dialog" aria-modal="true" aria-labelledby="deadline-notify-title"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-(--rapo-color-bg-overlay) md:items-center md:p-(--rapo-dimension-x4)"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) set창(false); }}>
          <div className="max-h-[90dvh] w-full max-w-[26rem] overflow-y-auto rounded-t-(--rapo-radius-r5) bg-(--rapo-color-bg-layer-default)
                          px-(--rapo-dimension-x5) pt-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x5)+env(safe-area-inset-bottom))] md:rounded-(--rapo-radius-r5)">
            <h2 id="deadline-notify-title" className="rapo-type-t9-bold text-(color:--rapo-color-fg-neutral)">마감 알림 받기</h2>
            <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">
              언제 알려 드릴까요? 둘 다 고를 수 있어요.
            </p>

            <div className="mt-(--rapo-dimension-x4) grid grid-cols-2 gap-(--rapo-dimension-x2)">
              {[3, 1].map((n) => {
                const 켬 = 고른날.includes(n);
                return (
                  <button key={n} type="button" aria-pressed={켬} onClick={() => 날바꾸기(n)}
                    className={'flex h-(--rapo-dimension-x13) items-center justify-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) ' +
                      (켬 ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak)'
                          : 'border-(color:--rapo-color-stroke-neutral-weak) active:bg-(--rapo-color-bg-transparent-pressed)')}>
                    <체크 on={켬} />
                    <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">마감 {n}일 전</span>
                  </button>
                );
              })}
            </div>
            {고른날.length === 0 && (
              <p className="rapo-type-t3-regular mt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-critical)">하나 이상 골라 주세요</p>
            )}

            {/* [필수] RAPO 알림 수신 동의 — 이미 받는 중이면 다시 묻지 않습니다 */}
            {!받는중 && (
              <label className="mt-(--rapo-dimension-x5) flex cursor-pointer gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
                <input type="checkbox" className="sr-only" checked={동의} onChange={(e) => set동의(e.target.checked)} />
                <체크 on={동의} />
                <span className="min-w-0">
                  <span className="rapo-type-t5-bold block text-(color:--rapo-color-fg-neutral)">
                    <span className="text-(color:--rapo-color-fg-brand-contrast)">[필수]</span> RAPO 알림 수신 동의
                  </span>
                  <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">
                    이 기기로 RAPO 알림(저장한 공고의 마감 알림 등)을 받아요. 다음 화면에서 브라우저가 알림 허용을 물으면 「허용」을 눌러 주세요.
                    밤 10시부터 아침 7시까지는 보내지 않아요. 내 정보에서 언제든 끌 수 있어요.
                  </span>
                </span>
              </label>
            )}

            {도움 && <p role="alert" className="rapo-type-t4-medium mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-critical)">{도움}</p>}

            <div className="mt-(--rapo-dimension-x5) grid grid-cols-2 gap-(--rapo-dimension-x2)">
              {받는중
                ? <RapoButton tone="outline" full disabled={busy} onClick={끄기}>알림 끄기</RapoButton>
                : <RapoButton tone="outline" full disabled={busy} onClick={() => set창(false)}>닫기</RapoButton>}
              <RapoButton full loading={busy} disabled={고른날.length === 0 || !동의} onClick={받기}>
                {받는중 ? '이대로 바꾸기' : '알림 받기'}
              </RapoButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* 체크 네모 — 가입 화면과 같은 꼴 (켜지면 navy 바탕에 흰 체크) */
function 체크({ on }: { on: boolean }) {
  return (
    <span aria-hidden
      className={'flex size-[22px] shrink-0 items-center justify-center rounded-(--rapo-radius-r1) border-(length:--rapo-border-default) text-[14px] font-bold leading-none ' +
        (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)'
            : 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default)')}>
      {on ? '✓' : ''}
    </span>
  );
}
