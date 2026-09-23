import Link from 'next/link';
import { Hit } from '@/components/hit';
import { Icon } from '@/components/icon';
import { RATE_YEAR } from '@/lib/rates';

/* 계산기 모음.

   옛 앱에 흩어져 있던 계산기를 한 자리로 모았습니다.
   급여 화면(/pay)과 스펙쌓기(/spec)에서 여기로 들어옵니다.

   실업급여 계산기는 **일부러 안 만들었습니다** — 상·하한이 해마다 바뀌는데
   매년 확인할 사람이 정해지지 않았습니다. 틀린 금액을 보여주면 그걸 믿고
   계산한 사람이 손해를 봅니다 (lib/rates.ts 맨 아래에 적어 뒀습니다). */

export const metadata = {
  title: '계산기 · POTJOB',
  description: '세전·세후 · 퇴직금 · 연차를 한 자리에서',
};

const TOOLS = [
  {
    href: '/tools/pay',
    icon: 'calculator',
    title: '세전 · 세후 계산기',
    body: '세전을 넣으면 세후, 세후를 넣으면 세전. 공제 내역까지 하나씩',
  },
  {
    href: '/tools/severance',
    icon: 'wallet',
    title: '퇴직금 계산기',
    body: '입사일과 퇴사일, 최근 3개월 급여로. 계산 과정도 같이',
  },
  {
    href: '/tools/leave',
    icon: 'calendar',
    title: '연차 계산기',
    body: '올해 며칠 생기는지, 언제까지 쓰는지',
  },
];

export default function Tools() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="other" target="tools" />

      <h1 className="break-keep text-h1 font-bold text-[#14181C]">계산기</h1>
      <p className="mt-2 break-keep text-lg text-[#5F666C]">
        로그인 없이 쓸 수 있어요. 넣은 값은 저장하지 않습니다
      </p>

      <ul className="mt-7 flex flex-col gap-3">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="flex items-start gap-5 rounded-[14px] border border-[#E3E3DE] bg-white p-6
                         transition-transform duration-[120ms] active:scale-[0.99]
                         motion-reduce:transition-none"
            >
              <span className="flex size-[44px] shrink-0 items-center justify-center
                               rounded-[12px] bg-[#ECECE8]">
                <Icon name={t.icon} size={20} className="text-[#14181C]" />
              </span>
              <span className="min-w-0">
                <span className="block break-keep text-[17px] font-bold text-[#1B2025]">
                  {t.title}
                </span>
                <span className="mt-1 block break-keep text-[14px] leading-relaxed text-[#5F666C]">
                  {t.body}
                </span>
              </span>
              <Icon name="chevron-left" size={16}
                    className="mt-3 shrink-0 rotate-180 text-[#8A9299]" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-7 break-keep rounded-[10px] bg-[#ECECE8] p-5 text-[12px]
                    leading-relaxed text-[#5F666C]">
        {RATE_YEAR}년 기준입니다. 법이 정한 최소를 계산해요 —
        회사 규정이 법보다 좋으면 그쪽을 따릅니다.
        실제 금액은 급여명세서와 회사 규정을 확인해 주세요.
      </p>

      <p className="mt-3 break-keep text-[12px] leading-relaxed text-[#5F666C]">
        실업급여 계산기는 아직 안 만들었어요. 상한액과 하한액이 해마다 바뀌는데,
        틀린 금액을 보여드리면 그걸 믿고 계산하신 분이 손해를 봅니다.
      </p>
    </main>
  );
}
