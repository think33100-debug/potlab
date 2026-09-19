'use client';

import type { Provider } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Logo } from '@/components/logo';
import {
  readLastLogin, writeLastLogin, subscribeLastLogin, serverLastLogin, type LoginMethod,
} from '@/lib/last-login';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../auth';
import { useToast } from '../toast';

/* 카카오·네이버 색은 teamsparta.md 토큰이 아니라 각 회사가 정한 값입니다.
   저쪽 심사 기준이라 우리 팔레트로 바꾸면 안 됩니다 — 그래서 값을 그대로 씁니다.

   oauth 는 Supabase 에 적힌 이름 그대로여야 합니다. 2026-09-19 두드려 본 값:
     kakao         302 → kauth.kakao.com
     custom:naver  302 → nid.naver.com   ← 네이버는 custom 제공자로 켜져 있습니다
     naver         400 "Unsupported provider"  (이름을 이렇게 부르면 안 됩니다)
     apple         400 — 열쇠를 아직 안 받았습니다

   Provider 타입에 `custom:${string}` 가 들어 있어 그대로 넘기면 됩니다. */
type Method = {
  key: LoginMethod; label: string; cls: string; why?: string;
  /* 값이 있으면 켜진 수단입니다. 없으면 자리만 있는 것 */
  oauth?: Provider;
};

const METHODS: Method[] = [
  { key: 'kakao', label: '카카오로 시작하기', cls: 'bg-[#FEE500] text-[#191600]', oauth: 'kakao' },
  { key: 'naver', label: '네이버로 시작하기', cls: 'bg-[#03C75A] text-white', oauth: 'custom:naver' },
  {
    key: 'apple', label: 'Apple로 시작하기', cls: 'bg-black text-white',
    why: 'Apple 은 아직 열쇠를 못 받았습니다. 자리만 잡아둡니다',
  },
];

export default function Login() {
  const toast = useToast();
  const router = useRouter();
  const { session, me } = useAuth();
  const [busy, setBusy] = useState<LoginMethod | null>(null);

  /* 서버에는 localStorage 가 없습니다. 서버 그림은 null 로 두고
     브라우저에 붙은 뒤 실제 값으로 바뀝니다 — 안 그러면 두 그림이 어긋납니다 */
  const last = useSyncExternalStore(subscribeLastLogin, readLastLogin, serverLastLogin);

  if (session) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <div className="mx-auto w-full max-w-[22rem]">
          <p className="text-lg text-gray-700 dark:text-gray-300">
            이미 로그인되어 있습니다{me ? ` — ${me.nickname} 님` : ''}.
          </p>
          <button
            type="button"
            onClick={() => router.push(me ? '/' : '/welcome')}
            className="mt-6 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
          >
            {me ? '공고 보러 가기' : '가입 마저 하기'}
          </button>
        </div>
      </main>
    );
  }

  const start = async (m: Method) => {
    if (!m.oauth) return;
    writeLastLogin(m.key);
    setBusy(m.key);

    const { error } = await browserSupabase().auth.signInWithOAuth({
      provider: m.oauth,
      options: { redirectTo: `${location.origin}/auth/callback` },
      /* 지금 카카오 동의 화면이 profile_image 까지 달라고 합니다.
         우리는 그 값을 아예 안 읽지만(lib/avatar.ts), 안 쓸 것을 받아두면
         언젠가 새어 나갑니다.

         여기서는 못 뺍니다 — options.scopes 는 서버에 적힌 기본값을
         덮는 게 아니라 뒤에 덧붙입니다 (직접 확인: scope 에 두 번 실려 갔습니다).
         Supabase 대시보드 → Authentication → Providers → Kakao → Scopes 에서
         profile_image 를 지워야 합니다. */
    });

    /* 넘어가지 못하면 진짜 이유를 그대로 보여줍니다.
       「로그인에 실패했습니다」 로는 무엇을 고쳐야 할지 알 수 없습니다 */
    if (error) {
      setBusy(null);
      toast(`${m.key} 로그인을 시작하지 못했습니다 — ${error.message}`, { tone: 'danger', ms: 4000 });
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
      <div className="mx-auto w-full max-w-[22rem]">
        <Logo className="!text-h1" />
        <p className="mt-2 text-lg text-gray-500">
          작업치료사 · 물리치료사 채용공고를 한곳에서
        </p>

        <div className="mt-8 space-y-5">
          {METHODS.map((m) => {
            const isLast = last === m.key;
            return (
              <div key={m.key}>
                {/* 가입할 때 쓴 것을 잊고 다른 걸 누르면 계정이 갈라집니다.
                    그래서 버튼 위에 먼저 보이게 둡니다 */}
                {isLast && (
                  <p className="mb-1">
                    <span className="rounded-md bg-badge-teal-bg px-3 py-1 text-sm font-medium text-teal-strong">
                      최근에 이걸로 로그인했어요
                    </span>
                  </p>
                )}
                <button
                  type="button"
                  disabled={!m.oauth || busy !== null}
                  onClick={() => start(m)}
                  className={
                    'w-full rounded-md px-6 py-5 text-lg font-bold transition-colors active:scale-[0.98] ' +
                    m.cls +
                    (m.oauth ? '' : ' cursor-not-allowed opacity-40') +
                    (busy === m.key ? ' opacity-60' : '') +
                    (isLast ? ' ring-2 ring-teal-strong ring-offset-2 dark:ring-offset-gray-900' : '')
                  }
                >
                  {busy === m.key ? '넘어가는 중…' : m.label}
                </button>
                {m.why && <p className="mt-1 text-sm text-gray-400">{m.why}</p>}
              </div>
            );
          })}
        </div>

        <p className="mt-7 text-sm text-gray-400">
          마지막에 쓴 수단은 이 기계에만 기억합니다. 서버로 보내지 않습니다
        </p>
      </div>
    </main>
  );
}
