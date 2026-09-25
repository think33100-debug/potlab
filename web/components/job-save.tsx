'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';

/* 공고 저장(찜). 저장한 것은 /me 의 「찜한 공고」에 모입니다.

   로그인 전에 누르면 막지 않고 로그인으로 보냅니다 —
   돌아올 자리를 적어 두니 로그인하면 이 공고로 돌아옵니다. */
export function JobSave({ id, big = false }: { id: string; big?: boolean }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (error) setOn(!next);                       // 실패하면 되돌립니다
    setBusy(false);
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
