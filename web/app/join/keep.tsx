'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/logo';
import { 초대코드담기 } from '@/lib/beta';
import { useAuth } from '../auth';

/* 초대 코드를 이 기기에 담아 두고 다음 자리로 보냅니다.
     로그인 안 함          → /login (카카오·네이버·애플)
     로그인했는데 가입 전    → /welcome (첫 단계에서 코드를 DB 에 넣습니다)
     이미 가입한 회원       → / (코드는 쓸 일이 없습니다) */
export function JoinKeep({ code }: { code: string | null }) {
  const router = useRouter();
  const { loading, session, me } = useAuth();

  useEffect(() => {
    if (!code || loading) return;
    초대코드담기(code);
    router.replace(!session ? '/login' : me ? '/' : '/welcome');
  }, [code, loading, session, me, router]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <div className="mx-auto w-full max-w-[22rem]">
        <Logo className="!text-h1" />
        {code ? (
          <p className="mt-5 text-lg text-mute">초대 링크를 확인하는 중이에요…</p>
        ) : (
          <>
            <h1 className="mt-5 text-h2 font-bold">초대 링크가 온전하지 않아요</h1>
            <p className="mt-3 text-lg text-gray-700 dark:text-gray-300">
              받은 링크를 처음부터 끝까지 다시 눌러 주세요.
            </p>
            <Link
              href="/beta"
              className="mt-7 block w-full rounded-md border border-gray-200 px-6 py-5 text-center text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950"
            >
              안내 보기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
