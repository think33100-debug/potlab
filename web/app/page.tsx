import Link from 'next/link';
import { Hit } from '@/components/hit';
import { HomeBanner } from '@/components/home-banner';
import { Icon } from '@/components/icon';
import { Rail } from '@/components/rail';
import { Hero } from '@/components/home/hero';
import {
  Anonymous, FinalCta, HowTo, JobSection, Joined, PaySection, Together,
} from '@/components/home/sections';
import { getHome, metricLine } from '@/lib/home';
import { safeHref } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/* 홈.

   앱을 열면 늘 쓰던 홈(배너·카테고리·큰배너)이 먼저 나오고,
   내리면 랜딩이 이어집니다. 매일 들어오는 분이 첫 화면에서
   긴 소개글부터 만나면 안 됩니다.

   ① 배너 · ② 카테고리 · ③ 큰배너는 전부 DB 에서 옵니다 (home_blocks).
   관리자가 /admin 에서 고칩니다 — 배포를 안 해도 바뀝니다.
   이 셋의 구조는 손대지 않았습니다. 뒤에 구역만 붙였습니다.
   가는 곳은 lib/routes.ts 가 아는 주소만 통과시켜 404 를 막습니다.

   화면에 뜨는 숫자는 하나도 코드에 없습니다 (home_stats()).
   박아두면 다음 분기에 틀린 화면이 됩니다.

   바탕은 밝은 종이색이고 히어로와 마지막 CTA 만 어둡습니다. */
export default async function Home() {
  const { top, categories, bigs, seconds, metrics, stats, texts } = await getHome();

  return (
    <>
      <Hit kind="home" />

      <main className="bg-paper">
        <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-[88px] md:px-7 md:pb-8">
          {/* ① 상단 배너 — DB */}
          <HomeBanner items={top} seconds={seconds} />

          {/* ② 큰 카테고리 — DB */}
          {categories.length > 0 && (
            <div className="pt-8">
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
            </div>
          )}

          {/* ③ 큰 배너 — DB.

              한 번 세로로 쌓았다가(카드가 76% 라 옆 카드가 반씩 잘려
              「우리가 보고 있…」 처럼 글이 끊겼습니다) 다시 옆으로 밉니다.
              이번엔 카드가 줄 폭에서 40px 만 모자라서 글이 안 잘리고,
              다음 카드가 25px 만 보여 「더 있다」만 알립니다.
              손으로 밀면 scroll-snap 이 딱 멈춰 줍니다 (components/rail.tsx) */}
          {bigs.length > 0 && (
            <div className="pt-8">
              <Rail label="살펴보기">
                {bigs.map((b) => (
                  <Link
                    key={b.id}
                    href={safeHref(b.href)}
                    className="flex min-h-[200px] w-full flex-col justify-between rounded-sm
                               border border-line bg-card p-7 hover:bg-paper"
                  >
                    <p className="break-keep text-h2 font-bold text-ink">{b.title}</p>
                    <p className="mt-5 break-keep text-body-lg text-body">{metricLine(b, metrics)}</p>
                  </Link>
                ))}
              </Rail>
            </div>
          )}

          {/* ④ 히어로 — 여기서 이야기가 시작됩니다 */}
          <div className="pt-8">
            <Hero stats={stats} texts={texts} />
          </div>

          {/* ⑤ 참여 현황 */}
          <Joined stats={stats} texts={texts} />

          {/* ⑥ 급여 01~05 */}
          <PaySection texts={texts} />

          {/* ⑦ 취업·이직 06~09 */}
          <JobSection stats={stats} texts={texts} />

          {/* ⑧ 함께 만듭니다 */}
          <Together texts={texts} />

          {/* ⑨ 익명 */}
          <Anonymous texts={texts} />

          {/* ⑩ 이용 방법 */}
          <HowTo texts={texts} />

          {/* ⑪ 마지막 CTA + 출처 */}
          <FinalCta stats={stats} texts={texts} />
        </div>
      </main>
    </>
  );
}
