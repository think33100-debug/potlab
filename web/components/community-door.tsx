'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/app/auth';
import { LoginFirst } from '@/components/login-first';
import { 문표시, type 문상태 } from '@/lib/community-access';

const 큰단추 = 'mt-6 inline-block w-full rounded-md bg-brand-red px-7 py-5 text-btn font-bold '
  + 'text-white hover:bg-brand-red-dark active:scale-[0.98]';

/* 커뮤니티 문.
   children 은 「내용」 일 때만 그립니다. 그래서 확인 중이거나 로그아웃하면
   댓글·조회수·대화 조회가 시작되지 않고, 들고 있던 글·선택 상태도 사라집니다 */
export function CommunityDoor({
  서버, children,
}: { 서버: 문상태; children?: React.ReactNode }) {
  const { who } = useAuth();
  const router = useRouter();
  const 판 = 문표시(서버, who);

  /* 같은 상태에서는 한 번만 다시 묻습니다 — 서버 답이 그대로여도 되풀이하지 않게 */
  const 물어본상태 = useRef('');
  const 지금상태 = `${서버}/${who}`;
  useEffect(() => {
    if (!판.새로고침 || 물어본상태.current === 지금상태) return;
    물어본상태.current = 지금상태;
    router.refresh();
  }, [판.새로고침, 지금상태, router]);

  if (판.표시 === '내용') return <>{children}</>;

  if (판.표시 === '로딩') {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="text-lg text-mute">잠시만요…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] text-center md:px-7">
      <section className="rounded-sm border border-gray-200 p-6 dark:border-gray-700">
        <h1 className="break-keep text-body-lg font-bold">회원만 볼 수 있어요</h1>
        {판.가는곳 === '/welcome' ? (
          <>
            <Link href="/welcome" className={큰단추}>가입 마저 하기</Link>
            <p className="mt-2 text-sm text-mute">채우던 곳에서 이어서 하실 수 있어요</p>
          </>
        ) : (
          <>
            <LoginFirst className={큰단추}>가입하고 전부 보기</LoginFirst>
            <p className="mt-2 text-sm text-mute">카카오 · 네이버로 3초 만에 시작해요</p>
          </>
        )}
      </section>
    </main>
  );
}
