'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';

/* 마감된 공고 맨 위에 붙는 띠.

   공유 링크는 보낸 날 바로 안 눌립니다. 며칠 뒤에 열려요.
   그 사이 마감되면 받은 사람이 빈 화면을 봅니다 — 링크가 죽습니다.
   그래서 내용은 그대로 보여주고 위에 사정만 알립니다.

   목록은 지금처럼 거릅니다. 목록에서는 헛걸음이 되지만,
   상세는 이미 주소를 아는 사람이라 다릅니다.

   띠는 크되 화면을 안 가립니다. 아래 내용이 그대로 읽혀야 합니다. */
export function JobClosed({ jobId }: { jobId: string }) {
  const { loading, session, me } = useAuth();
  const toast = useToast();
  const router = useRouter();

  /* null = 아직 모름. 모르는 동안에는 단추를 안 그립니다 —
     켜둔 분에게 잠깐 보였다 사라지면 그게 더 거슬립니다 */
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) { setOn(null); return; }
    let alive = true;
    browserSupabase()
      .from('notification_settings').select('agreed').eq('profile_id', me.id).maybeSingle()
      .then(({ data }) => { if (alive) setOn(!!data?.agreed); });
    return () => { alive = false; };
  }, [me]);

  const ask = async () => {
    /* 아직 회원이 아니면 가입으로. 어디서 왔는지 들고 갑니다 —
       가입을 마치고 홈으로 떨어지면 이 공고를 다시 못 찾아 그냥 나갑니다 */
  /* 확인 중에 누르면 **잠긐 기다립니다.** /login 으로 보내면 안 됩니다 —
     회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다 (2026-09-25) */
    if (loading) { toast('잠시만요 — 로그인을 확인하고 있어요'); return; }

    if (!session || !me) {
      try { sessionStorage.setItem('potjob.after-login', `/jobs/${jobId}`); } catch { /* 사생활 보호 창 */ }
      router.push(session ? '/welcome' : '/login');
      return;
    }

    /* 이미 회원이면 그 자리에서 켭니다. 알림 설정 화면이 따로 없어서,
       설정 화면으로 보내는 대신 한 번 눌러 끝냅니다 */
    setBusy(true);
    const { error } = await browserSupabase().from('notification_settings').upsert({
      profile_id: me.id, agreed: true, agreed_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) { toast(`켜지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    setOn(true);
    toast('새 공고가 올라오면 알려드릴게요');
  };

  /* 이미 켜둔 회원에게는 권하지 않습니다. 한 걸 또 권하면 거슬리죠 */
  const showButton = !loading && on !== true;

  return (
    <section className="mt-6 rounded-sm border border-brand-red/40 bg-brand-red-soft p-6 dark:bg-transparent">
      <p className="text-h3 font-bold text-brand-red-dark">이미 마감된 공고에요</p>
      <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">
        다음엔 놓치지 않게, 새 공고가 올라오면 바로 알려드릴게요.
      </p>
      {showButton && (
        <button
          type="button"
          onClick={ask}
          disabled={busy}
          className="mt-6 rounded-md bg-brand-red px-7 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? '켜는 중…' : '알림 받기'}
        </button>
      )}
      {on === true && (
        <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
          알림은 이미 켜져 있어요
        </p>
      )}
    </section>
  );
}
