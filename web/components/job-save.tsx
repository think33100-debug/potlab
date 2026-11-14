'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { setAfterLogin } from '@/lib/after-login';
import { Icon } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';
import { 별바뀜 } from '@/components/job-deadline-notify';

/* 공고 저장(찜). 저장한 것은 /me 의 「찜한 공고」에 모입니다.

   로그인 전에 누르면 막지 않고 로그인으로 보냅니다 —
   돌아올 자리를 적어 두니 로그인하면 이 공고로 돌아옵니다. */
export function JobSave({ id, big = false, look, 마감 = false }: {
  id: string; big?: boolean; look?: 'rapo' | 'rapo-bar';
  /** rapo-bar 전용 — 마감된 공고는 새로 저장하지 못합니다(원본 D-03). 이미 저장한 것은 풀 수 있습니다 */
  마감?: boolean;
}) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!session) { setOn(false); return; }
    const sb = browserSupabase();
    sb.from('job_stars').select('job_id').eq('job_id', id).maybeSingle()
      .then(({ data }) => setOn(!!data));
  }, [session, id]);

  /* 공고 상세의 「마감 임박 시 알림받기」가 저장을 바꾸면 여기도 따라갑니다 (2026-11-12) */
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; on: boolean }>).detail;
      if (d?.id === id) setOn(d.on);
    };
    window.addEventListener(별바뀜, h);
    return () => window.removeEventListener(별바뀜, h);
  }, [id]);

  async function toggle() {
    /* 확인 중이면 **아무것도 안 합니다.** /login 으로 보내면 안 됩니다 —
       회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다.
       잠시 뒤 다시 누르면 됩니다 (2026-09-25) */
    if (loading) return;

    if (!session) {
      setAfterLogin(`/jobs/${id}`);   // 로그인 뒤 이 자리로 (lib/after-login.ts · 2026-11-13 옛 이름 after_login 은 아무도 안 읽어 홈으로 떨어졌음)
      router.push('/login');
      return;
    }
    if (busy) return;
    setBusy(true);
    const sb = browserSupabase();
    const next = !on;
    setOn(next);                                   // 먼저 바꿔 보여주고
    const { error } = next
      ? await sb.from('job_stars').insert({ job_id: id })
      : await sb.from('job_stars').delete().eq('job_id', id);
    /* ★ 2026-10-05 — 전에는 **말없이 되돌렸습니다.**
       그래서 세중님이 「켜졌다가 바로 풀린다」고만 보셨고, 무엇이 잘못인지
       알 길이 없었습니다. 실패하면 까닭을 띄웁니다 (작업지침 11번 —
       「화면에 진짜 이유가 뜨게 만들 것」) */
    if (error) {
      setOn(!next);
      toast(`${next ? '저장' : '저장 취소'}하지 못했어요 — ${error.message}`,
        { tone: 'danger', ms: 4000 });
    } else {
      window.dispatchEvent(new CustomEvent(별바뀜, { detail: { id, on: next } }));
      /* 2026-11-14 세중님이 정한 글 — 저장하면 한 번 */
      if (next) toast('공고가 뜨면 알려드릴게요!', { ms: 3000 });
    }
    setBusy(false);
  }

  /* RAPO 새 디자인의 저장 단추 (2026-11-11 · Figma 「RAPO / Action / 저장」 353:442).
     누르는 자리 44px · 보이는 면 32px. 하는 일은 위와 같습니다 — 모양만 다릅니다.
     옛 모양은 먼저 바꿔 보여 주고 실패하면 되돌리지만, 새 모양은 **저장이 된 뒤에만** 채운 책갈피로
     바뀝니다(원본 설명). 받는 동안 on 은 이미 뒤집혀 있어 직전 값(!on)을 그대로 보여 줍니다 */
  if (look === 'rapo') return <RapoSaveFace on={busy ? !on : !!on} busy={busy} onClick={toggle} />;
  if (look === 'rapo-bar') {
    const 보임 = busy ? !on : !!on;
    return <RapoSaveBar on={보임} busy={busy} disabled={마감 && !보임} onClick={toggle} />;
  }

  if (big) {
    return (
      <button
        type="button" onClick={toggle} aria-pressed={!!on}
        className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[12px]
                   border border-[#E3E3DE] bg-white transition-transform duration-[120ms]
                   active:scale-[0.88] motion-reduce:transition-none"
      >
        <Icon name="bookmark" filled={!!on} size={22}
              className={on ? 'text-[#FF3B30]' : 'text-[#5F666C]'} />
        <span className="sr-only">{on ? '저장 취소' : '저장'}</span>
      </button>
    );
  }

  return (
    <button
      type="button" onClick={toggle} aria-pressed={!!on}
      /* 누르는 자리 48px — components/share-buttons.tsx 와 같은 크기 */
      className="flex h-[48px] w-[48px] items-center justify-center rounded-full transition-transform
                 duration-[120ms] active:scale-[0.88] motion-reduce:transition-none"
    >
      <Icon name="bookmark" filled={!!on} size={24}
            className={on ? 'text-[#FF3B30]' : 'text-[#4A5056]'} />
      <span className="sr-only">{on ? '저장 취소' : '저장'}</span>
    </button>
  );
}

/* 새 디자인의 저장 단추 면 — Figma 「RAPO / Action / 저장」 353:442
   (Selected=false 353:430 · Selected=true 353:436). 누르는 자리 44px(rapo/touch/min) · 보이는 면 32px.
   견본 공고(id 없음)에도 같은 면을 쓰려고 떼어 둡니다 — 그때는 onClick 없이 비활성입니다.

   상태
     기본      빈 책갈피 (icon-save.svg)
     저장됨    채운 책갈피 (icon-save-on.svg) — 원본 설명대로 **실제 저장 성공 뒤에만** 바뀝니다
     누름      면에 bg/transparent-pressed
     저장 중   눌리지 않음(disabled · aria-busy). 모양은 직전 상태 그대로 — 원본에 저장 중 모양이 없습니다
     비활성    견본 공고만. 흐리게 */
export function RapoSaveFace({ on = false, busy = false, onClick }: {
  on?: boolean; busy?: boolean; onClick?: () => void;
}) {
  const off = !onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off || busy}
      aria-pressed={off ? undefined : on}
      aria-busy={busy || undefined}
      className="group flex size-(--rapo-touch-min) shrink-0 items-center justify-end disabled:cursor-not-allowed"
    >
      <span className={
        'flex size-(--rapo-dimension-x8) items-center justify-end rounded-(--rapo-radius-r1) ' +
        'group-enabled:group-active:bg-(--rapo-color-bg-transparent-pressed) ' +
        (off ? 'opacity-40' : '')
      }>
        {/* 원본: 32 면의 오른쪽에 붙은 24 틀 안 가운데 */}
        <span className="flex size-(--rapo-dimension-x6) items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src={on ? '/rapo/home/icon-save-on.svg' : '/rapo/home/icon-save.svg'} alt="" width={15.8} height={19.8} />
        </span>
      </span>
      <span className="sr-only">
        {off ? '견본 공고라 저장할 수 없어요' : busy ? '저장하는 중' : on ? '저장 취소' : '저장'}
      </span>
    </button>
  );
}

/* 공고 상세 아래 고정 줄의 저장 단추 — Figma 「RAPO / Detail / Sticky actions / Compact two rows」 1047:1101
   의 「저장하고 알림받기」 칸 (40px). 원본의 숫자(저장한 사람 수)와 「알림받기」는 자료가 없어 뺍니다 —
   저장만 합니다. 좋아요 칸도 기능이 없어 뺐고, 그래서 이 단추가 한 줄을 다 씁니다.
   마감된 공고(D-03)는 흐리게 잠급니다. 이미 저장한 것(D-03-saved)은 풀 수 있게 둡니다 */
export function RapoSaveBar({ on, busy, disabled, onClick }: {
  on: boolean; busy: boolean; disabled: boolean; onClick?: () => void;   // 없으면 견본(미리보기)
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={busy || disabled}
      aria-pressed={on} aria-busy={busy || undefined}
      className="rapo-type-t2-medium flex h-(--rapo-dimension-x10) min-w-0 flex-1 items-center justify-center
                 gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r2) border border-(--rapo-color-stroke-neutral-weak)
                 bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)
                 enabled:active:bg-(--rapo-color-bg-transparent-pressed) disabled:opacity-40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src={on ? '/rapo/home/icon-save-on.svg' : '/rapo/detail/save-18.svg'} alt="" width={12} height={15} />
      {busy ? '저장하는 중' : on ? '저장됨' : '저장'}
    </button>
  );
}
