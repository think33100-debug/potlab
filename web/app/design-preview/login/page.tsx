import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RapoLoginButtons, 로그인틀 } from '@/components/rapo/rapo-login';
import type { LoginMethod } from '@/lib/last-login';

/* 새 디자인 로그인 — **견본으로** 보는 자리 (2026-11-11). 개발 서버에서만 열립니다(배포에서는 404).
   실제 로그인(app/login)은 로그인 서버에 붙어야 단추가 나와서, 로컬에서 모양을 보려고 둡니다. 단추는 눌리지 않습니다.
     ?last=kakao|naver|apple   최근 로그인 말풍선 */
export const metadata: Metadata = { title: 'RAPO · 로그인 미리보기', robots: { index: false } };

export default async function DesignPreviewLogin({ searchParams }: { searchParams: Promise<{ last?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { last } = await searchParams;
  const 최근 = (['kakao', 'naver', 'apple'] as const).find((m) => m === last) ?? null;
  return (
    <로그인틀 아래={
      <>
        {!최근 && <p className="rapo-type-t4-regular text-center">처음이라면 같은 방법으로 가입할 수 있어요</p>}
        <RapoLoginButtons last={최근 as LoginMethod | null} busy={null} />
        <Link href="/design-preview/login" className="rapo-type-t4-medium w-full text-center">지금은 둘러볼게요</Link>
      </>
    } />
  );
}
