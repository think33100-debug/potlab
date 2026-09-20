import Link from 'next/link';
import { Hit } from '@/components/hit';
import { HomeBanner } from '@/components/home-banner';
import { getHome, metricLine } from '@/lib/home';
import { safeHref } from '@/lib/routes';
import { JoinCta } from './gate';

export const dynamic = 'force-dynamic';

/* 홈.

   여기 있는 배너·카테고리·큰배너는 전부 DB 에서 옵니다 (home_blocks).
   관리자가 /admin 에서 고칩니다 — 배포를 안 해도 바뀝니다.
   가는 곳만 lib/routes.ts 가 아는 주소로 걸러서, 없는 화면으로
   보내 404 가 나지 않게 합니다. */
export default async function Home() {
  const { top, categories, bigs, seconds, metrics } = await getHome();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6 pb-[88px] md:px-7 md:pb-8">
      <Hit kind="home" />

      {/* ① 상단 배너 */}
      <HomeBanner items={top} seconds={seconds} />

      {/* ② 큰 카테고리 */}
      {categories.length > 0 && (
        <nav className="mt-7" aria-label="바로가기">
          <ul className="grid grid-cols-5 gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={safeHref(c.href)}
                  className="flex flex-col items-center gap-2 rounded-sm px-1 py-5 text-center hover:bg-gray-50 dark:hover:bg-gray-950"
                >
                  {/* 나중에 이모지 대신 그림을 넣을 자리입니다 (image_path) */}
                  <span className="text-[26px] leading-none" aria-hidden>{c.emoji ?? '•'}</span>
                  <span className="text-sm font-medium leading-tight">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ③ 큰 배너 — 가로로 밀어서 봅니다 */}
      {bigs.length > 0 && (
        <section className="mt-7" aria-label="살펴보기">
          <ul className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 md:-mx-7 md:px-7">
            {bigs.map((b) => (
              <li key={b.id} className="w-[76%] shrink-0 snap-start sm:w-[54%]">
                <Link
                  href={safeHref(b.href)}
                  className="flex h-full flex-col justify-between rounded-sm border border-gray-100 p-6 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                >
                  <p className="text-h3 font-bold">{b.title}</p>
                  <p className="mt-5 text-lg text-gray-600 dark:text-gray-400">
                    {metricLine(b, metrics)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 홈은 배너·카테고리를 다 보여줍니다. 들어오는 문이라 가리지 않습니다 */}
      <JoinCta what="공고와 커뮤니티" />

      {/* 숫자의 출처를 밝힙니다 — 느낌이 아니라 센 값입니다 */}
      <p className="mt-7 text-sm text-gray-400">
        공고 {metrics.jobs.toLocaleString()}건 · 기관 자료 {metrics.orgs.toLocaleString()}곳을 보고 있어요
      </p>
    </main>
  );
}
