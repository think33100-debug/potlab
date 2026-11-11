import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 클로즈드 베타 「테스터 전용」 안내 (2026-11-11 세중님 결정 · 줄 A).

   로그인 안 한 사람은 어느 주소로 오든 여기로 옵니다 (middleware.ts).
   보여 줄 것은 둘뿐입니다 — 이미 가입한 분의 로그인 길, 처음 오신 분께
   「초대 링크로 들어와 주세요」. 공고·커뮤니티 자료는 한 줄도 안 그립니다.

   ?r=1 — 로그인 여부를 **못 물어본** 때(연결 끊김)입니다. 회원일 수도 있으니
   「가입하세요」가 아니라 「다시 시도」를 보입니다 (web/회원여부_읽는_법.md).
   그때 middleware 는 주소를 안 바꾸고 이 화면을 보여 주므로, 새로고침하면
   원래 가려던 화면으로 다시 갑니다.

   ★ 디자인 시안(줄 B)이 오면 이 화면 꼴을 바꿉니다. 글은 세중님 결정 그대로입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RAPO 클로즈드 베타 · 테스터 전용',
  robots: { index: false, follow: false },
};

export default async function Beta({
  searchParams,
}: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const 다시 = r === '1';

  /* 이미 회원인 분이 이 주소를 직접 열었으면 첫 화면으로 보냅니다 */
  if (!다시) {
    const who = await serverWho(await serverSupabase());
    if (who === '회원') redirect('/');
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <div className="mx-auto w-full max-w-[22rem]">
        <Logo className="!text-h1" />
        <p className="mt-5 inline-block rounded-md bg-badge-teal-bg px-3 py-1 text-sm font-bold text-teal-strong">
          클로즈드 베타
        </p>
        <h1 className="mt-3 text-h2 font-bold">RAPO 클로즈드 베타 · 테스터 전용</h1>

        {다시 ? (
          <>
            <p className="mt-3 text-lg text-gray-700 dark:text-gray-300">
              로그인 상태를 확인하지 못했어요. 잠시 뒤 새로고침해 주세요.
            </p>
            <p className="mt-2 text-sm text-mute">연결이 잠깐 끊겼을 수 있어요</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-lg text-gray-700 dark:text-gray-300">
              지금은 초대받은 테스터만 쓸 수 있어요.
            </p>
            <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">
              처음 오셨다면 <b>초대 링크로 들어와 주세요.</b>
            </p>
          </>
        )}

        <Link
          href="/login"
          className="mt-7 block w-full rounded-md bg-brand-red px-6 py-5 text-center text-btn font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
        >
          이미 가입했어요 · 로그인
        </Link>

        <p className="mt-7 text-sm text-mute">
          초대 링크를 받으셨는데 이 화면이 보이면, 받은 링크를 다시 눌러 주세요.
        </p>
        <p className="mt-2 text-sm text-mute">
          궁금한 점은{' '}
          <Link href="/contact" className="underline underline-offset-2">문의하기</Link>
          로 남겨 주세요.
        </p>
      </div>
    </main>
  );
}
