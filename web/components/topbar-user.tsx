'use client';

import Link from 'next/link';
import { useAuth } from '@/app/auth';
import { Avatar } from './avatar';

/* 탑바 오른쪽. 로그인 전에는 단추, 로그인 뒤에는 아바타와 닉네임입니다.
   여기에도 이메일은 안 씁니다 — 커뮤니티에 보이는 것은 닉네임과 아바타뿐입니다 */
export function TopbarUser() {
  const { loading, session, me } = useAuth();

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

  if (!me) {
    return (
      <Link href="/welcome" className="rounded-md bg-brand-red px-4 py-1 text-sm font-bold text-white">
        가입 마저 하기
      </Link>
    );
  }

  return (
    <Link href="/me" className="flex items-center gap-3">
      <Avatar value={me.avatar} size="sm" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{me.nickname}</span>
    </Link>
  );
}
