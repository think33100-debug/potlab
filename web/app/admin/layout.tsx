'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth';

/* 관리자 화면의 껍데기입니다.

   여기서 막는 것은 「보이지 않게」 하는 것뿐입니다.
   진짜로 막는 자리는 DB 입니다 — home_blocks·site_settings 의 쓰기 규칙이
   is_admin() 이고, 출처 칸은 권한 자체가 없습니다.
   브라우저에서 isAdmin 을 true 로 바꿔도 서버가 안 해줍니다. */

const MENU = [
  { href: '/admin', label: '홈 꾸미기' },
  { href: '/admin/jobs', label: '공고' },
  { href: '/admin/posts', label: '커뮤니티 글' },
  { href: '/admin/icons', label: '아이콘' },
  { href: '/admin/stats', label: '통계' },
  { href: '/admin/reset', label: '내 계정 초기화' },
];

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { loading, session, isAdmin } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
        <p className="text-lg text-gray-500">잠시만요…</p>
      </main>
    );
  }

  if (!session || !isAdmin) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-7">
        <h1 className="text-h2 font-bold">관리자만 볼 수 있어요</h1>
        <p className="mt-2 text-lg text-gray-500">
          {session ? '이 계정은 관리자가 아니에요' : '먼저 로그인해 주세요'}
        </p>
        <Link
          href={session ? '/' : '/login'}
          className="mt-6 inline-block rounded-md bg-brand-red px-7 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark"
        >
          {session ? '홈으로' : '로그인하기'}
        </Link>
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <header className="mb-7">
        <h1 className="text-h1 font-bold">관리자</h1>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="관리자 메뉴">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              aria-current={m.href === '/admin' ? (pathname === '/admin' ? 'page' : undefined) : (pathname.startsWith(m.href) ? 'page' : undefined)}
              className={
                'rounded-md border px-6 py-4 text-lg font-medium ' +
                ((m.href === '/admin' ? pathname === '/admin' : pathname.startsWith(m.href))
                  ? 'border-teal-strong bg-teal-strong text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
              }
            >
              {m.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
