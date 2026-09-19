'use client';

import Link from 'next/link';
import { useAuth } from '@/app/auth';
import { Avatar } from './avatar';

/* 탑바 오른쪽. 로그인 전에는 단추, 로그인 뒤에는 아바타와 닉네임입니다.
   여기에도 이메일은 안 씁니다 — 커뮤니티에 보이는 것은 닉네임과 아바타뿐입니다 */
export function TopbarUser() {
  const { loading, session, me, isAdmin } = useAuth();

  if (loading) return <span className="text-sm text-gray-400">…</span>;

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-gray-200 px-4 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950"
      >
        로그인
      </Link>
    );
  }

  /* 로그인은 됐는데 가입을 안 마친 상태입니다.
     예전에는 여기에 「가입 마저 하기」만 뒀는데, 그러면 카카오로 하다 튕긴 분이
     네이버로 넘어갈 길이 없었습니다. 로그인 화면으로 보내면 거기에
     이어서 할 길과 다른 수단으로 갈 길이 둘 다 있습니다 */
  if (!me) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-gray-200 px-4 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950"
      >
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-5">
      {/* 관리자에게만 보입니다. 다만 막는 자리는 여기가 아니라 DB 입니다 */}
      {isAdmin && (
        <Link
          href="/admin"
          className="rounded-md border border-brand-red px-4 py-1 text-sm font-bold text-brand-red hover:bg-brand-red-soft"
        >
          관리자
        </Link>
      )}
      <Link href="/me" className="flex items-center gap-3">
        <Avatar value={me.avatar} size="sm" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{me.nickname}</span>
      </Link>
    </div>
  );
}
