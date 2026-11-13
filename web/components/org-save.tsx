'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { setAfterLogin } from '@/lib/after-login';
import { Icon } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 기관 저장 + 「공고 뜨면 알려주기」. 둘 다 org_stars 한 줄입니다 —
   저장은 줄이 있는 것, 알림은 notify 칸입니다.

   로그인 전에 누르면 막지 않고 로그인으로 보냅니다. 돌아올 자리를 적어 둡니다.

   탭바(md 미만 62px) 위에 얹습니다. 둘 다 bottom-0 이면 탭바가 z-40 이라
   이 줄이 통째로 가려집니다 — 공고 상세에서 한 번 가려졌던 자리입니다. */
export function OrgSave({ name, sido, look = 'bar' }: { name: string; sido: string | null; look?: 'bar' | 'round' }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

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
    setAfterLogin(back);   // 로그인 뒤 이 자리로 (lib/after-login.ts · 2026-11-13 옛 이름 after_login 은 아무도 안 읽어 홈으로 떨어졌음)
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
    /* ★ 2026-10-05 — 말없이 되돌리지 않습니다. 까닭을 띄웁니다 */
    if (error) {
      setSaved(!next);
      toast(`${next ? '저장' : '저장 취소'}하지 못했어요 — ${error.message}`,
        { tone: 'danger', ms: 4000 });
    }
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
    /* ★ 2026-10-05 — 말없이 되돌리지 않습니다 */
    if (error) {
      setNotify(!next);
      toast(`알림을 ${next ? '켜' : '꺼'}지 못했어요 — ${error.message}`,
        { tone: 'danger', ms: 4000 });
    }
    setBusy(false);
  }

  /* 병원 게시판(새 디자인 · 1312:7741) 머리의 책갈피 — 48 동그라미 하나. 저장만 합니다(원본에 알림 단추가 없음) */
  if (look === 'round') {
    return (
      <button type="button" onClick={star} aria-pressed={saved}
        className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-[#e8f1f6]
                   transition-transform duration-[120ms] active:scale-[0.9] motion-reduce:transition-none">
        <Icon name="bookmark" filled={saved} size={22} className={saved ? 'text-[#d8372b]' : 'text-[#112231]'} />
        <span className="sr-only">{saved ? '관심 병원에서 빼기' : '관심 병원으로 저장'}</span>
      </button>
    );
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
