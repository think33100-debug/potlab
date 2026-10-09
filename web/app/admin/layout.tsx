'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { RouteHealth } from '@/components/route-health';
import { browserSupabase } from '@/lib/supabase-browser';

/* 관리자 화면의 껍데기입니다.

   여기서 막는 것은 「보이지 않게」 하는 것뿐입니다.
   진짜로 막는 자리는 DB 입니다 — home_blocks·site_settings 의 쓰기 규칙이
   is_admin() 이고, 출처 칸은 권한 자체가 없습니다.
   브라우저에서 isAdmin 을 true 로 바꿔도 서버가 안 해줍니다. */

const MENU = [
  { href: '/admin', label: '홈 꾸미기' },
  { href: '/admin/texts', label: '홈 글' },
  { href: '/admin/jobs', label: '공고' },
  /* 상세 일곱 칸 중 비어 있는 칸이 있는 공고 (2026-10-09).
     못 찾은 칸은 회원 화면에 안 그리고 여기로 모읍니다 */
  { href: '/admin/blanks', label: '빈칸 공고' },
  { href: '/admin/trash', label: '쓰레기통' },
  /* 추천순 맨 위로 올린 공고 (2026-10-07). 나중에 유료 광고와 이어질 자리입니다 */
  { href: '/admin/boost', label: '추천 올린 공고' },
  { href: '/admin/posts', label: '커뮤니티 글' },
  { href: '/admin/icons', label: '아이콘' },
  { href: '/admin/stats', label: '통계' },
  { href: '/admin/compete', label: '경쟁률' },
  { href: '/admin/hand', label: '손으로 확인할 곳' },
  { href: '/admin/edu-orgs', label: '교육기관' },
  { href: '/admin/ads', label: '오픈 화면 광고' },
  /* 수집기가 돌았나 / 공고가 들어왔나 — collect_beat 을 읽는 화면이 없어서
     「돌았는데 안 들어온다」를 못 가렸습니다 (2026-10-02 에 만들었습니다) */
  { href: '/admin/beat', label: '수집기 상태' },
  /* 만들어 놓고 메뉴에 안 걸려 있던 것들 (2026-10-01 에 걸었습니다) */
  { href: '/admin/rival', label: '경쟁사 비교' },
  { href: '/admin/members', label: '회원' },
  /* 직원과 권한 (2026-10-09). 보는 것은 운영진 누구나, 고치는 것은 대표만 */
  { href: '/admin/staff', label: '직원과 권한' },
  /* 마스터가 페르소나로 쓴 글 모아보기 (2026-10-09) */
  { href: '/admin/ops', label: '운영진 글' },
  /* 채용·교육 담당자 승인 (2026-10-09 · 권한 「기관승인」) */
  { href: '/admin/partners', label: '담당자 승인' },
  /* 치료사 재직 확인 — 확인하면 파일을 바로 지웁니다 (2026-10-09) */
  { href: '/admin/verify', label: '재직 확인' },
  { href: '/admin/reports', label: '신고' },
  { href: '/admin/access', label: '개인정보 접속기록' },
  { href: '/admin/reset', label: '내 계정 초기화' },
];

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { loading, session, isAdmin } = useAuth();
  const pathname = usePathname();

  /* ★ 2026-10-05 — 거절하기 **전에 한 번 더** 물어봅니다.
     is_admin() 은 비로그인도 부를 수 있고 그때 **거짓**을 돌려줍니다.
     로그인 토큰이 잠깐 끊긴 사이에 그 판정이 돌면, 관리자인데도
     「관리자가 아니에요」가 뜹니다 (2026-10-05 에 실제로 겪었고
     새로고침 한 번으로 돌아왔습니다).
     그래서 토큰을 새로 받아 다시 묻고, 그래도 아니면 그때 거절합니다. */
  const [다시물음, set다시물음] = useState<'아직' | '하는중' | '끝'>('아직');
  const [다시본결과, set다시본결과] = useState(false);

  useEffect(() => {
    if (loading || !session || isAdmin || 다시물음 !== '아직') return;
    set다시물음('하는중');
    const sb = browserSupabase();
    (async () => {
      try {
        await sb.auth.refreshSession();
        const { data, error } = await sb.rpc('is_admin');
        set다시본결과(!error && data === true);
      } catch { set다시본결과(false); }
      set다시물음('끝');
    })();
  }, [loading, session, isAdmin, 다시물음]);

  const 관리자인가 = isAdmin || 다시본결과;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
        <p className="text-lg text-mute">잠시만요…</p>
      </main>
    );
  }

  /* 다시 묻는 동안에는 거절하지 않습니다 — 깜빡였다 사라지면 더 헷갈립니다 */
  if (session && !관리자인가 && 다시물음 !== '끝') {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
        <p className="text-lg text-mute">로그인을 확인하고 있어요…</p>
      </main>
    );
  }

  if (!session || !관리자인가) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-7">
        <h1 className="text-h2 font-bold">관리자만 볼 수 있어요</h1>
        <p className="mt-2 text-lg text-mute">
          {session ? '이 계정은 관리자가 아니에요' : '먼저 로그인해 주세요'}
        </p>
        <Link
          href={session ? '/' : '/login'}
          className="mt-6 inline-block rounded-md bg-brand-red px-7 py-5 text-btn font-bold text-white hover:bg-brand-red-dark"
        >
          {session ? '홈으로' : '로그인하기'}
        </Link>
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      {/* 공고가 안 들어오는 경로가 있으면 여기 빨간 줄이 뜹니다 (2026-09-25).
          조용한 실패를 우연히 발견하는 일이 없게 하려고 맨 위에 둡니다 */}
      <RouteHealth />

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
