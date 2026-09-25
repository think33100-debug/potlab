'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';

/* 기관 저장 + 「공고 뜨면 알려주기」. 둘 다 org_stars 한 줄입니다 —
   저장은 줄이 있는 것, 알림은 notify 칸입니다.

   로그인 전에 누르면 막지 않고 로그인으로 보냅니다. 돌아올 자리를 적어 둡니다.

   탭바(md 미만 62px) 위에 얹습니다. 둘 다 bottom-0 이면 탭바가 z-40 이라
   이 줄이 통째로 가려집니다 — 공고 상세에서 한 번 가려졌던 자리입니다. */
export function OrgSave({ name, sido }: { name: string; sido: string | null }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);

  const back = `/orgs?org=${encodeURIComponent(name)}&sido=${encodeURIComponent(sido ?? '')}`;

  useEffect(() => {
    if (!session) { setSaved(false); setNotify(false); return; }
    browserSupabase()
      .from('org_stars').select('notify').eq('org_name', name).maybeSingle()
      .then(({ data }) => {
        setSaved(!!data);
        setNotify(!!(data as { notify: boolean } | null)?.notify);
      });
  }, [session, name]);

  const toLogin = () => {
    try { sessionStorage.setItem('after_login', back); } catch { /* 사파리 비공개 */ }
    router.push('/login');
  };

  async function star() {
    /* 확인 중이면 **아무것도 안 합니다.** /login 으로 보내면 안 됩니다 —
       회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다.
       잠시 뒤 다시 누르면 됩니다 (2026-09-25) */
    if (loading) return;

    if (!session) return toLogin();
    if (busy) return;
    setBusy(true);
    const sb = browserSupabase();
    const next = !saved;
    setSaved(next);
    const { error } = next
      ? await sb.from('org_stars').upsert({ org_name: name })
      : await sb.from('org_stars').delete().eq('org_name', name);
    if (error) setSaved(!next);
    setBusy(false);
  }

  async function ring() {
    /* 확인 중이면 **아무것도 안 합니다.** /login 으로 보내면 안 됩니다 —
       회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다.
       잠시 뒤 다시 누르면 됩니다 (2026-09-25) */
    if (loading) return;

    if (!session) return toLogin();
    if (busy) return;
    setBusy(true);
    const next = !notify;
    setNotify(next);
    setSaved(true);
    const { error } = await browserSupabase()
      .from('org_stars').upsert({ org_name: name, notify: next });
    if (error) { setNotify(!next); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-[62px] z-30 border-t border-[#E3E3DE]
                    bg-white/95 px-6 py-3 backdrop-blur md:bottom-0 md:px-7">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
        <button
          type="button" onClick={star} aria-pressed={saved}
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[12px]
                     border border-[#E3E3DE] bg-white transition-transform duration-[120ms]
                     active:scale-[0.88] motion-reduce:transition-none"
        >
          <Icon name="bookmark" filled={saved} size={22}
                className={saved ? 'text-[#FF3B30]' : 'text-[#5F666C]'} />
          <span className="sr-only">{saved ? '저장 취소' : '저장'}</span>
        </button>

        <button
          type="button" onClick={ring} aria-pressed={notify}
          className={'flex h-[50px] flex-1 items-center justify-center gap-1.5 rounded-[12px] '
            + 'text-[16px] font-bold transition-transform duration-[120ms] '
            + 'active:translate-y-[2px] active:scale-[0.99] '
            + 'active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)] motion-reduce:transition-none '
            + (notify
              ? 'border border-[#E3E3DE] bg-white text-[#4A5056]'
              : 'bg-[#FF3B30] text-white')}
        >
          {notify ? '알림 끄기' : '공고 뜨면 알려주기'}
          {!notify && <Icon name="arrow-right" size={17} />}
        </button>
      </div>
    </div>
  );
}
