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
/* 로그인 도중에 쓰는 임시 쪽지를 치웁니다 (2026-09-25).

   ── 왜 쌓였나 ────────────────────────────────────────────────
   쪽지 이름은 `sb-<ref>-auth-token-flow-<흐름번호>-code-verifier` 로,
   **로그인을 누를 때마다 다른 이름**이 하나씩 생깁니다.
   @supabase/ssr 는 **끝까지 마친 흐름의 쪽지만** 지웁니다
   (node_modules/@supabase/auth-js … removePKCEVerifier). 카카오 화면에서
   뒤로 가거나 그만둔 흐름의 쪽지는 그대로 남습니다.
   2026-09-25 에 로그인한 적 없는 브라우저에 일곱 개가 쌓여 있었습니다.

   ── 여기서 지워도 되는 까닭 ──────────────────────────────────
   이 자리는 **세션을 이미 받은 뒤**입니다. 진행 중인 로그인이 없으므로
   남은 쪽지는 전부 버린 것입니다. 흐름 목록(`-flows-code-verifier`)도
   같이 지웁니다 — 가리킬 쪽지가 없으니까요.

   ?진단=1 의 「로그인도중쪽지」 가 0 이 되는지로 확인합니다. */
function 쪽지치우기() {
  try {
    const 안전 = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie.split(';')
      .map((c) => c.split('=')[0].trim())
      .filter((n) => n.startsWith('sb-') && n.includes('code-verifier'))
      .forEach((n) => {
        document.cookie = `${n}=; Max-Age=0; path=/; SameSite=Lax${안전}`;
      });
  } catch { /* 쿠키를 막아둔 브라우저 — 로그인은 이미 끝났으니 그냥 넘어갑니다 */ }
}

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

      쪽지치우기();

      const { data: prof } = await sb
        .from('profiles').select('id').eq('id', data.session.user.id).maybeSingle();

      const back = sessionStorage.getItem('potjob.after-login');
      /* 이미 가입한 분은 여기서 바로 보내고 자리를 지웁니다.
         처음 오신 분은 /welcome 을 거치므로 자리를 남겨 둡니다 —
         지워버리면 가입을 마친 뒤 홈으로 떨어져서, 보러 왔던 공고를
         다시 못 찾고 그냥 나갑니다 */
      if (prof) sessionStorage.removeItem('potjob.after-login');
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
