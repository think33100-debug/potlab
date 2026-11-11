'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 공고 저장(찜). 저장한 것은 /me 의 「찜한 공고」에 모입니다.

   로그인 전에 누르면 막지 않고 로그인으로 보냅니다 —
   돌아올 자리를 적어 두니 로그인하면 이 공고로 돌아옵니다. */
export function JobSave({ id, big = false, look }: { id: string; big?: boolean; look?: 'rapo' }) {
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

  async function toggle() {
    /* 확인 중이면 **아무것도 안 합니다.** /login 으로 보내면 안 됩니다 —
       회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다.
       잠시 뒤 다시 누르면 됩니다 (2026-09-25) */
    if (loading) return;

    if (!session) {
      try { sessionStorage.setItem('after_login', `/jobs/${id}`); } catch { /* 사파리 비공개 */ }
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
    }
    setBusy(false);
  }

  /* RAPO 새 디자인의 저장 단추 (2026-11-11 · Figma 「RAPO / Action / 저장」 353:442).
     누르는 자리 44px · 보이는 면 32px. 하는 일은 위와 같습니다 — 모양만 다릅니다.
     저장된 모양은 원본에 아직 없어 옅은 면만 깔아 둡니다(임시 · docs/rapo-design-implementation.md) */
  if (look === 'rapo') return <RapoSaveFace on={!!on} busy={busy} onClick={toggle} />;

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

/* 견본 공고(id 없음)에도 같은 면을 쓰려고 떼어 둡니다 — 그때는 onClick 없이 비활성입니다 */
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
      className="group flex size-[44px] shrink-0 items-center justify-end disabled:cursor-not-allowed"
    >
      <span className={
        'flex size-[32px] items-center justify-center rounded-(--rapo-radius-r1) ' +
        (on ? 'bg-(--rapo-color-bg-brand-weak) ' : '') +
        'group-enabled:group-active:bg-(--rapo-color-bg-transparent-pressed) group-disabled:opacity-40'
      }>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/home/icon-save.svg" alt="" width={15.8} height={19.8} />
      </span>
      <span className="sr-only">{off ? '견본 공고라 저장할 수 없어요' : on ? '저장 취소' : '저장'}</span>
    </button>
  );
}
