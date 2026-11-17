import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RapoSectionTitle } from '@/components/rapo/rapo-ui';

/* 홈 「라포에서 시작하기」 옆으로 넘기기 시안 (2026-11-18 세중님 「오른쪽으로 넘기는 식으로 · 경쟁률 · 봉사활동 · 청년정책 바로 갈 수 있는 창 ·
   지금 커뮤·공고 토큰 참고해서 비슷한 느낌으로 먼저 제안」). 개발 서버에서만(배포 404) · 저장 없음.

   틀은 지금 카드(home-u01 StartHere · 피그마 1210:1139) 그대로 — 높이 216 · 모서리 r3 · 안쪽 x4 · 제목 t6-bold · 설명 12/17 · 그림은 오른쪽 아래.
   바뀐 것은 둘: ① 한 줄 가로 넘기기(scroll-snap) · 셋째 카드가 살짝 보여 「넘길 수 있다」를 알림 ② 카드 넷을 더함.
   새 카드 그림은 3D 그림이 아직 없어 툴킷의 28px 그림을 크게 씁니다 — 디자이너가 커뮤·공고처럼 3D 그림을 만들면 그 자리에 바꿔 끼웁니다.
   색은 토큰만: 커뮤 navy · 공고 mist(지금 그대로) · 경쟁률 blush · 봉사 green-100 · 청년 blue-100 · 병원 coral-100. */

type 카드 = {
  제목: string; 설명: [string, string?]; href: string; bg: string; 글색: string; 눌림: string;
  그림: { src: string; 큰것?: boolean };
};

const 카드들: 카드[] = [
  { 제목: '커뮤니티 보기', 설명: ['어디서도 나눌 수 없던', '우리만의 이야기'], href: '/community',
    bg: 'bg-(--rapo-brand-color-navy)', 글색: 'text-(color:--rapo-brand-color-white)', 눌림: 'active:bg-(--rapo-color-bg-navy-solid-pressed)',
    그림: { src: '/rapo/home/start-community.png', 큰것: true } },
  { 제목: '공고 찾기', 설명: ['내게 맞는 일을 찾아요'], href: '/jobs',
    bg: 'bg-(--rapo-brand-color-mist)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:bg-(--rapo-color-bg-neutral-weak-pressed)',
    그림: { src: '/rapo/home/start-jobs.png', 큰것: true } },
  { 제목: '지난 채용 경쟁률', 설명: ['공공병원이 공개한', '회차별 경쟁률'], href: '/compete',
    bg: 'bg-(--rapo-brand-color-blush)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:brightness-95',
    그림: { src: '/rapo/home/graphic-cert-28.svg' } },
  { 제목: '봉사활동', 설명: ['지역별로 모집 중인', '봉사를 찾아요'], href: '/volunteer',
    bg: 'bg-(--rapo-color-palette-green-100)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:brightness-95',
    그림: { src: '/rapo/home/graphic-volunteer-28.svg' } },
  { 제목: '청년정책', 설명: ['받을 수 있는 청년 지원', '지역별로 한눈에'], href: '/youth',
    bg: 'bg-(--rapo-color-palette-blue-100)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:brightness-95',
    그림: { src: '/rapo/home/graphic-youth-28.svg' } },
  { 제목: '병원 둘러보기', 설명: ['병원 규모와 치료사 수,', '근무 후기까지'], href: '/orgs',
    bg: 'bg-(--rapo-color-palette-coral-100)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:brightness-95',
    그림: { src: '/rapo/home/graphic-hospital-28.svg' } },
];

/* 지금 카드의 그림 자리 — 왼쪽·위를 20px 흐리게 감춥니다(home-u01 그대로) */
const 그림가림 = '[mask-image:linear-gradient(to_right,transparent,#000_20px),linear-gradient(to_bottom,transparent,#000_20px)] [mask-composite:intersect]';

function StartCarousel() {
  return (
    <section aria-labelledby="rapo-home-start" className="flex flex-col gap-(--rapo-dimension-x4) py-(--rapo-dimension-x6)">
      <div className="flex items-end justify-between px-(--rapo-dimension-x5)">
        <RapoSectionTitle id="rapo-home-start">라포에서 시작하기</RapoSectionTitle>
        <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">옆으로 넘겨 보세요 ›</span>
      </div>
      {/* 가로 넘기기 — 화면 끝까지 닿고, 첫 카드는 안쪽 여백(x5)에 맞춰 멈춥니다. 카드 폭 44% 라 셋째 카드가 살짝 보입니다 */}
      <ul className="flex snap-x snap-mandatory gap-(--rapo-dimension-x3) overflow-x-auto scroll-px-(--rapo-dimension-x5) px-(--rapo-dimension-x5)
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {카드들.map((c) => (
          <li key={c.href} className="w-[44%] min-w-[150px] max-w-[200px] shrink-0 snap-start">
            <Link href={c.href}
              className={`relative flex h-[216px] flex-col gap-(--rapo-dimension-x1_5) overflow-hidden rounded-(--rapo-radius-r3) p-(--rapo-dimension-x4) ${c.bg} ${c.눌림}`}>
              <span className={`rapo-type-t6-bold break-keep ${c.글색}`}>{c.제목}</span>
              <span className={`text-[12px] leading-[17px] ${c.글색}`}>
                <span className="block">{c.설명[0]}</span>
                {c.설명[1] && <span className="block">{c.설명[1]}</span>}
              </span>
              {c.그림.큰것 ? (
                <span aria-hidden className={`absolute bottom-0 right-0 flex h-[124px] w-[160px] items-start overflow-hidden ${그림가림}`}>
                  <Image src={c.그림.src} alt="" width={160} height={160} className="size-[160px] shrink-0 object-contain" />
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- 툴킷 SVG 그림을 크게 */
                <img aria-hidden src={c.그림.src} alt="" width={84} height={84}
                  className="absolute bottom-(--rapo-dimension-x4) right-(--rapo-dimension-x4) size-[84px]" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DesignPreviewHomeStart() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <p className="rapo-type-t3-bold bg-(--rapo-color-bg-brand-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-brand-contrast)">
        시안 · 홈 「라포에서 시작하기」 옆으로 넘기기
      </p>
      <StartCarousel />
    </div>
  );
}
