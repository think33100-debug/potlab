'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 카카오에서 돌아오는 자리입니다.

   주소에 붙어 온 code 를 세션으로 바꾸는 일은 supabase-js 가
   detectSessionInUrl 로 알아서 합니다. 여기서는 끝나기를 기다렸다가
   가입을 마쳤는지 보고 길을 나눕니다.

     profiles 줄이 있으면   → 원래 보던 곳
     없으면                 → /welcome (약관 → 닉네임 → 사진) */
export default function AuthCallback() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = browserSupabase();
    let alive = true;

    (async () => {
      /* 주소에 error 가 실려 오는 경우가 있습니다 (동의 취소 등) */
      const hash = new URLSearchParams(location.hash.slice(1));
      const qs = new URLSearchParams(location.search);
      const oauthErr = qs.get('error_description') ?? hash.get('error_description')
        ?? qs.get('error') ?? hash.get('error');
      if (oauthErr) { if (alive) setErr(oauthErr); return; }

      const { data, error } = await sb.auth.getSession();
      if (!alive) return;
      if (error) { setErr(error.message); return; }
      if (!data.session) { setErr('로그인을 못 마쳤어요. 다시 눌러 주세요'); return; }

      const { data: prof } = await sb
        .from('profiles').select('id').eq('id', data.session.user.id).maybeSingle();

      const back = sessionStorage.getItem('potjob.after-login');
      sessionStorage.removeItem('potjob.after-login');
      router.replace(prof ? (back || '/') : '/welcome');
    })();

    return () => { alive = false; };
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      {err ? (
        <div className="rounded-sm bg-brand-red-soft p-6">
          <p className="text-lg font-bold text-brand-red-dark">로그인을 마치지 못했어요</p>
          <p className="mt-2 text-lg text-brand-red-dark">{err}</p>
          <a href="/login" className="mt-6 inline-block rounded-md bg-brand-red px-7 py-5 text-body-lg font-bold text-white">
            다시 해보기
          </a>
        </div>
      ) : (
        <p className="text-lg text-gray-500">로그인을 마치는 중이에요…</p>
      )}
    </main>
  );
}
