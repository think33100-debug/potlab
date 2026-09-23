import Link from 'next/link';
import { Icon } from '@/components/icon';

/* 「여기엔 아무것도 없어요」 화면 한 벌.

   세 자리가 같이 씁니다 —
     app/not-found.tsx      없는 주소 (오타 · 내린 공고 · 없는 기관)
     app/post/[id]          없는 글
     app/post/[id]          지워진 글 (감춰진 글)

   왜 한 벌인가 — 공유 링크가 죽는 길이 여럿인데 화면이 제각각이면
   받은 사람이 「이 서비스가 고장 났나」로 읽습니다. 말만 갈라 씁니다.

   막다른 길로 두지 않습니다. 무슨 일이 있었는지 말하고 갈 곳을 놓습니다. */
export function NothingHere({
  title,
  body,
  /* 제일 큰 단추. 커뮤니티 글이면 커뮤니티로, 그 밖에는 공고로 보냅니다 */
  goHref = '/jobs',
  goLabel = '채용공고 보기',
  subHref = '/community',
  subLabel = '커뮤니티 가기',
}: {
  title: string;
  body: string;
  goHref?: string;
  goLabel?: string;
  subHref?: string;
  subLabel?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-8 text-center md:px-7">
      <span className="flex h-[56px] w-[56px] items-center justify-center rounded-sm bg-gray-100 dark:bg-gray-800">
        <Icon name="search" size={26} className="text-gray-500" />
      </span>

      <h1 className="mt-6 break-keep text-h2 font-bold">{title}</h1>

      <p className="mt-3 max-w-[22rem] break-keep text-lg leading-relaxed text-gray-500">
        {body}
      </p>

      <div className="mt-8 flex w-full max-w-[22rem] flex-col gap-2">
        <Link
          href={goHref}
          className="rounded-md bg-brand-red px-7 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
        >
          {goLabel}
        </Link>
        <Link
          href={subHref}
          className="rounded-md border border-gray-200 px-7 py-5 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950"
        >
          {subLabel}
        </Link>
        <Link href="/" className="mt-2 text-sm text-gray-400 hover:underline">
          홈으로
        </Link>
      </div>
    </main>
  );
}
