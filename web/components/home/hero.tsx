'use client';

import Link from 'next/link';
import { Icon } from '@/components/icon';
import { useCountUp } from '@/lib/reveal';
import type { HomeStats } from '@/lib/home';

/* 히어로 — 한 화면을 꽉 채웁니다.

   여기만 어둡습니다(potjob_ink). 나머지는 전부 밝은 종이색이라,
   첫 화면에서 대비가 한 번 세게 걸립니다.

   어두운 구역이라 따뜻한 회색(--color-mute 등)을 안 씁니다.
   바탕이 잉크색이면 푸른기가 문제가 안 되고, 기존 gray-* 가 더 밝은 쪽까지
   눈금이 있어서 어두운 배경에 얹기 좋습니다. */
export function Hero({ stats }: { stats: HomeStats }) {
  const ot = stats.joined.find((j) => j.job === '작업치료사');
  const joined = stats.joined.reduce((s, j) => s + j.n, 0);

  return (
    <section className="bg-gray-900 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-56px)] w-full max-w-3xl flex-col justify-center px-6 py-8 md:px-7">
        {/* 눈썹 — 앞에 빨간 짧은 선 */}
        <p className="flex items-center gap-3">
          <span aria-hidden className="h-[2px] w-[20px] shrink-0 bg-brand-red" />
          <span className="text-sm font-bold tracking-wide text-gray-300">
            작업치료사 · 물리치료사
          </span>
        </p>

        {/* 세 줄로 끊어 읽힙니다. 「없습니다」에서 딱 멈추는 게 이 화면의 전부라
            줄바꿈을 브라우저에 맡기지 않고 직접 끊습니다 */}
        <h1
          className="mt-6 font-bold leading-[1.25] tracking-[-0.02em]"
          style={{ fontSize: 'clamp(32px, 11vw, 44px)' }}
        >
          치료사 급여는<br />
          어느 통계에도<br />
          <span className="text-brand-red">없습니다</span>
        </h1>

        <p className="mt-6 text-body-lg text-gray-300">
          물어보기도 민망하고, 물어봐도 결국 한 사람 얘기죠.<br />
          그래서 그냥 저희가 모으기로 했어요.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pay"
            className="rounded-md bg-brand-red px-7 py-5 text-center text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
          >
            내 연봉 어디쯤인지 보기
          </Link>
          <Link
            href="/jobs"
            className="rounded-md border border-gray-700 px-7 py-5 text-center text-body-lg font-medium text-white hover:bg-gray-950"
          >
            공고부터 둘러보기
          </Link>
        </div>

        {/* 숫자 셋. 아직 안 쌓인 값은 지어내지 않고 「아직 집계 전」으로 둡니다 */}
        <dl className="mt-8 grid grid-cols-3 gap-5 border-t border-gray-800 pt-7">
          <Stat n={ot?.mid ?? null} unit="만원" label="작업치료사 중위" />
          <Stat n={joined || null} unit="명" label="지금까지 참여" />
          <Stat n={stats.hospitals} label="등록된 병원" />
        </dl>

        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400">
          아래로 내려보세요
          <Icon name="arrow-down" size={14} />
        </p>
      </div>
    </section>
  );
}

function Stat({ n, unit, label }: { n: number | null; unit?: string; label: string }) {
  return (
    <div>
      <dd className="text-h2 font-bold">
        {n === null
          ? <span className="text-h3 text-gray-400">아직 집계 전</span>
          : <><Count to={n} /><span className="text-h3">{unit}</span></>}
      </dd>
      <dt className="mt-1 text-sm text-gray-400">{label}</dt>
    </div>
  );
}

/* 0 에서 세어 올라갑니다. num 클래스가 자리수를 고정해서
   세는 동안 글자가 좌우로 안 흔들립니다 */
export function Count({ to }: { to: number }) {
  const { ref, n } = useCountUp(to);
  return <span ref={ref} className="num">{n.toLocaleString('ko-KR')}</span>;
}
