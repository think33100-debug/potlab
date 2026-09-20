import Link from 'next/link';
import { Hit } from '@/components/hit';
import { HomeBanner } from '@/components/home-banner';
import { Icon } from '@/components/icon';
import { Hero } from '@/components/home/hero';
import {
  Anonymous, FinalCta, HowTo, JobSection, Joined, PaySection, Reveal, Together,
} from '@/components/home/sections';
import { getHome, metricLine } from '@/lib/home';
import { safeHref } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/* 홈.

   ③ 배너 · ④ 카테고리 · ⑤ 큰배너는 전부 DB 에서 옵니다 (home_blocks).
   관리자가 /admin 에서 고칩니다 — 배포를 안 해도 바뀝니다.
   이 셋의 구조는 손대지 않았습니다. 앞뒤로 구역만 붙였습니다.
   가는 곳은 lib/routes.ts 가 아는 주소만 통과시켜 404 를 막습니다.

   화면에 뜨는 숫자는 하나도 코드에 없습니다 (home_stats()).
   박아두면 다음 분기에 틀린 화면이 됩니다.

   바탕은 밝은 종이색이고 히어로와 마지막 CTA 만 어둡습니다. */
export default async function Home() {
  const { top, categories, bigs, seconds, metrics, stats } = await getHome();

  return (
    <>
      <Hit kind="home" />

      {/* ① 히어로 — 한 화면 꽉 */}
      <Hero stats={stats} />

      <main className="bg-paper">
        <div className="mx-auto w-full max-w-3xl px-6 pb-[88px] md:px-7 md:pb-8">
          {/* ② 참여 현황 */}
          <Joined stats={stats} />

          {/* ③ 상단 배너 — DB */}
          <Reveal className="pt-8">
            <HomeBanner items={top} seconds={seconds} />
          </Reveal>

          {/* ④ 큰 카테고리 — DB */}
          {categories.length > 0 && (
            <Reveal className="pt-8">
              <nav aria-label="바로가기">
                <ul className="grid grid-cols-5 gap-2">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={safeHref(c.href)}
                        className="flex flex-col items-center gap-2 rounded-sm px-1 py-5 text-center hover:bg-card"
                      >
                        {/* 이름이 비었거나 오타면 기본 아이콘으로 떨어집니다 */}
                        <Icon name={c.icon} size={24} className="text-ink" />
                        <span className="text-sm font-medium leading-tight text-body">{c.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </Reveal>
          )}

          {/* ⑤ 큰 배너 — DB. 가로로 밀어서 봅니다 */}
          {bigs.length > 0 && (
            <Reveal className="pt-8">
              <section aria-label="살펴보기">
                <ul className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 md:-mx-7 md:px-7">
                  {bigs.map((b) => (
                    <li key={b.id} className="w-[76%] shrink-0 snap-start sm:w-[54%]">
                      <Link
                        href={safeHref(b.href)}
                        className="flex h-full flex-col justify-between rounded-sm border border-line bg-card p-6 hover:bg-paper"
                      >
                        <p className="text-h3 font-bold text-ink">{b.title}</p>
                        <p className="mt-5 text-lg text-body">{metricLine(b, metrics)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}

          {/* ⑥ 급여 01~05 */}
          <PaySection />

          {/* ⑦ 취업·이직 06~09 */}
          <JobSection stats={stats} />

          {/* ⑧ 함께 만듭니다 */}
          <Together />

          {/* ⑨ 익명 */}
          <Anonymous />

          {/* ⑩ 이용 방법 */}
          <HowTo />

          {/* ⑪ 마지막 CTA + 출처 */}
          <FinalCta stats={stats} />
        </div>
      </main>
    </>
  );
}
