'use client';

import { useSyncExternalStore } from 'react';
import { Logo } from '@/components/logo';
import {
  readLastLogin, writeLastLogin, subscribeLastLogin, serverLastLogin, type LoginMethod,
} from '@/lib/last-login';
import { useToast } from '../toast';

/* 카카오·네이버 색은 teamsparta.md 토큰이 아니라 각 회사가 정한 값입니다.
   저쪽 심사 기준이라 우리 팔레트로 바꾸면 안 됩니다 — 그래서 값을 그대로 씁니다 */
const METHODS: {
  key: LoginMethod; label: string; cls: string; ready: boolean;
}[] = [
  { key: 'kakao', label: '카카오로 시작하기', cls: 'bg-[#FEE500] text-[#191600]', ready: true },
  { key: 'naver', label: '네이버로 시작하기', cls: 'bg-[#03C75A] text-white', ready: true },
  { key: 'apple', label: 'Apple로 시작하기', cls: 'bg-black text-white', ready: false },
];

export default function Login() {
  const toast = useToast();

  /* 서버에는 localStorage 가 없습니다. 서버 그림은 null 로 두고
     브라우저에 붙은 뒤 실제 값으로 바뀝니다 — 안 그러면 두 그림이 어긋납니다 */
  const last = useSyncExternalStore(subscribeLastLogin, readLastLogin, serverLastLogin);

  const pick = (m: LoginMethod) => {
    writeLastLogin(m);
    toast(`${METHODS.find((x) => x.key === m)!.label.replace('로 시작하기', '')} 선택 — 아직 연결 전입니다`);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-6 py-8 md:px-7">
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
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium text-teal-strong">
                    <span className="rounded-md bg-badge-teal-bg px-3 py-1">
                      최근에 이걸로 로그인했어요
                    </span>
                  </p>
                )}
                <button
                  type="button"
                  disabled={!m.ready}
                  onClick={() => pick(m.key)}
                  className={
                    'w-full rounded-md px-6 py-5 text-lg font-bold transition-colors active:scale-[0.98] ' +
                    m.cls +
                    (m.ready ? '' : ' cursor-not-allowed opacity-40') +
                    (isLast ? ' ring-2 ring-teal-strong ring-offset-2 dark:ring-offset-gray-900' : '')
                  }
                >
                  {m.label}
                </button>
                {!m.ready && (
                  <p className="mt-1 text-sm text-gray-400">
                    Apple 은 아직 열쇠를 못 받았습니다. 자리만 잡아둡니다
                  </p>
                )}
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
