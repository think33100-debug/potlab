'use client';

import Link from 'next/link';
import { PayNote } from '@/components/pay-note';
import { tx, txLines, type Texts } from '@/lib/home-text';
import { useCountUp } from '@/lib/reveal';
import type { HomeStats } from '@/lib/home';

/* 히어로.

   맨 위가 아니라 배너·카테고리·큰배너 다음에 옵니다. 앱을 열면 늘 쓰던 홈이
   먼저 나오고, 내리면 여기서 이야기가 시작됩니다.
   그래서 한 화면을 꽉 채우지 않습니다 — 높이는 내용에 맡기고 위아래만 넉넉히.

   여기만 어둡습니다(potjob_ink). 밝은 화면 한가운데 어두운 덩어리가 들어가
   시선이 한 번 끊깁니다.

   어두운 구역이라 따뜻한 회색(--color-mute 등)을 안 씁니다.
   바탕이 잉크색이면 푸른기가 문제가 안 되고, 기존 gray-* 가 더 밝은 쪽까지
   눈금이 있어서 어두운 배경에 얹기 좋습니다. */
export function Hero({ stats, texts }: { stats: HomeStats; texts: Texts }) {
  const t = (k: string) => tx(texts, k);
  const ot = stats.joined.find((j) => j.job === '작업치료사');
  const joined = stats.joined.reduce((s, j) => s + j.n, 0);

  /* 아직 안 쌓인 칸은 아예 뺍니다. 「아직 집계 전」이 두 번 뜨면 비어 보입니다.
     자료가 쌓이면 칸이 저절로 늘어납니다 — 개수를 세어 격자를 만듭니다 */
  const cells = [
    ot?.mid != null ? { n: ot.mid, unit: '만원', label: t('hero.stat.ot') } : null,
    joined >= stats.min_n ? { n: joined, unit: '명', label: t('hero.stat.joined') } : null,
    stats.hospitals > 0 ? { n: stats.hospitals, label: t('hero.stat.hosp') } : null,
  ].filter((c) => c !== null);

  return (
    /* 밝은 바탕을 뚫고 가로로 꽉 찹니다 — 가운데 어두운 띠가 되게 */
    <section className="-mx-6 bg-gray-900 px-6 py-8 text-white md:-mx-7 md:px-7">
      <div className="mx-auto w-full max-w-3xl">
        {/* 눈썹 — 앞에 빨간 짧은 선 */}
        <p className="flex items-center gap-3">
          <span aria-hidden className="h-[2px] w-[20px] shrink-0 bg-brand-red" />
          <span className="break-keep text-sm font-bold tracking-wide text-gray-300">
            {t('hero.eyebrow')}
          </span>
        </p>

        {/* 줄로 끊어 읽힙니다. 「없습니다」에서 딱 멈추는 게 이 화면의 전부라
            줄바꿈을 브라우저에 맡기지 않고 관리자가 직접 끊습니다.
            마지막 줄과 같은 말(hero.title.red)이 있으면 그 줄만 빨갛게 씁니다 */}
        <h1
          className="mt-6 break-keep font-bold leading-[1.25] tracking-[-0.02em]"
          style={{ fontSize: 'clamp(32px, 11vw, 44px)' }}
        >
          {txLines(texts, 'hero.title').map((line, i, all) => (
            <span key={i} className={line === t('hero.title.red') ? 'text-brand-red' : undefined}>
              {line}{i < all.length - 1 && <br />}
            </span>
          ))}
        </h1>

        <p className="mt-6 whitespace-pre-line break-keep text-body-lg text-gray-300">
          {t('hero.lead')}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pay"
            className="rounded-md bg-brand-red px-7 py-5 text-center text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
          >
            {t('hero.cta1')}
          </Link>
          <Link
            href="/jobs"
            className="rounded-md border border-gray-700 px-7 py-5 text-center text-body-lg font-medium text-white hover:bg-gray-950"
          >
            {t('hero.cta2')}
          </Link>
        </div>

        {/* 쌓인 만큼만 보여줍니다. 한 칸만 남으면 가로로 꽉 찹니다 */}
        {cells.length > 0 && (
          <dl
            className="mt-8 grid gap-5 border-t border-gray-800 pt-7"
            style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
          >
            {cells.map((c) => (
              <div key={c.label}>
                <dd className="text-h2 font-bold">
                  <Count to={c.n} />{c.unit && <span className="text-h3">{c.unit}</span>}
                </dd>
                <dt className="mt-1 text-sm text-gray-400">{c.label}</dt>
              </div>
            ))}
          </dl>
        )}

        {/* 중위값만 크게 보이면 「내가 받을 돈」으로 읽힙니다 */}
        {ot?.mid != null && <PayNote className="mt-5 text-gray-400" />}
      </div>
    </section>
  );
}

/* 0 에서 세어 올라갑니다. num 클래스가 자리수를 고정해서
   세는 동안 글자가 좌우로 안 흔들립니다 */
export function Count({ to }: { to: number }) {
  const { ref, n } = useCountUp(to);
  return <span ref={ref} className="num">{Number(n).toLocaleString('ko-KR')}</span>;
}
