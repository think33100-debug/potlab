import Link from 'next/link';
import { Hit } from '@/components/hit';
import { RapoBottomNav } from './rapo-bottom-nav';
import { RapoServiceGrid } from './home-u01';
import { RapoEduTop } from './rapo-edu';
import { RapoDivider, RapoSectionTitle } from './rapo-ui';

/* 라포 올인원 툴킷 (2026-11-14 세중님 「아래 핫키에 · 누르면 올인원 툴킷 페이지가 따로 나오고
   툴킷에 있는 내용들을 설명하는 페이지 · 선택도 쉽게」).

   하단 탐색 「툴킷」 칸 · 홈 「라포 더 둘러보기」 카드 · 공고 상세 보수 칸 「세후 월급은 어느 정도인지 궁금하세요?」가 여기로 옵니다.
   피그마 원본이 없어 홈 「라포 더 둘러보기 / 통합 툴킷」 954:827 조각(블러시 카드 · 28 그림 · 셰브런)과 토큰만 씁니다.
   가는 곳은 지금 앱에 있는 화면만 씁니다 — 새 기능을 여기서 약속하지 않습니다.
   로그인 없이 봅니다(안내 글이고 개인정보가 없습니다). 각 도구의 로그인 규칙은 그 화면이 정합니다. */

type 도구 = { 이름: string; 설명: string; href: string; 그림: string };
type 묶음 = { id: string; 제목: string; 덧말: string; 도구: 도구[] };

const 계산그림 = '/rapo/home/graphic-calc-28.svg';
const 묶음들: 묶음[] = [
  {
    id: 'grow', 제목: '배움과 활동', 덧말: '교육 일정과 봉사, 청년 지원을 한곳에서',
    도구: [
      { 이름: '교육 · 학술', 설명: '학회와 협회의 교육 일정을 직군별로 모았어요', href: '/edu', 그림: '/rapo/home/graphic-edu-28.svg' },
      { 이름: '봉사활동', 설명: '지역과 분야로 지금 모집 중인 봉사를 찾아요', href: '/volunteer', 그림: '/rapo/home/graphic-volunteer-28.svg' },
      { 이름: '청년정책', 설명: '일자리·주거·금융 등 받을 수 있는 청년 지원을 지역별로', href: '/youth', 그림: '/rapo/home/graphic-youth-28.svg' },
    ],
  },
  {
    id: 'career', 제목: '입사 준비', 덧말: '지원하기 전에 병원과 나를 견줘 봐요',
    도구: [
      { 이름: '공시 병원 급여', 설명: '공공병원이 공개한 신입 연봉과 평균 연봉을 병원별로', href: '/guide/therapist-salary', 그림: '/rapo/home/graphic-pay-28.svg' },
      { 이름: '입사 스펙 비교', 설명: '관심 병원 입사자와 내 스펙을 견주는 기능이에요. 준비 중이라 오픈 알림을 받을 수 있어요', href: '/me/soon?k=spec', 그림: '/rapo/home/graphic-spec-48.svg' },
      { 이름: '지난 채용 경쟁률', 설명: '공공기관이 공개한 회차별 경쟁률을 병원별로 봐요', href: '/compete', 그림: '/rapo/home/graphic-cert-28.svg' },
    ],
  },
  {
    id: 'pay', 제목: '돈 계산', 덧말: '받을 돈을 미리 셈해 봐요. 넣은 값은 저장하지 않아요',
    도구: [
      { 이름: '세전 · 세후 계산기', 설명: '연봉이나 월급을 넣으면 실제로 받는 월급과 공제 내역을 보여 줘요', href: '/tools/pay', 그림: 계산그림 },
      { 이름: '퇴직금 계산기', 설명: '입사일·퇴사일과 최근 3개월 급여로 계산 과정까지', href: '/tools/severance', 그림: 계산그림 },
      { 이름: '연차 계산기', 설명: '올해 연차가 며칠 생기는지, 언제까지 쓰는지', href: '/tools/leave', 그림: 계산그림 },
      { 이름: '실업급여 계산기', 설명: '하루에 얼마씩, 며칠 동안 받는지 알아봐요', href: '/tools/unemployment', 그림: 계산그림 },
    ],
  },
];

export function RapoToolkit() {
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <Hit kind="other" target="toolkit" />
      <RapoEduTop title="라포 올인원 툴킷" art="/rapo/home/toolkit.svg" />
      <main className="flex flex-col gap-(--rapo-dimension-x8) px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8) pt-(--rapo-dimension-x2)">
        {/* 맨 위 — 홈 「라포 더 둘러보기」의 여섯 칸 틀 그대로 (2026-11-14 세중님 「미리 만들어 둔 저 틀을 넣자」) */}
        <section aria-label="서비스 바로 가기" className="rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x3)">
          <RapoServiceGrid />
        </section>

        {묶음들.map((m) => (
          <section key={m.id} id={m.id} aria-labelledby={'toolkit-' + m.id} className="flex scroll-mt-(--rapo-dimension-x4) flex-col gap-(--rapo-dimension-x1)">
            <RapoSectionTitle id={'toolkit-' + m.id}>{m.제목}</RapoSectionTitle>
            <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{m.덧말}</p>
            <ul className="mt-(--rapo-dimension-x2)">
              {m.도구.map((d, i) => (
                <li key={d.href}>
                  {i > 0 && <RapoDivider />}
                  <Link href={d.href}
                    className="flex min-h-(--rapo-dimension-x16) items-center gap-(--rapo-dimension-x3) py-(--rapo-dimension-x3)
                               active:bg-(--rapo-color-bg-transparent-pressed)">
                    <span className="flex size-(--rapo-dimension-x12) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak)">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                      <img src={d.그림} alt="" width={28} height={28} className="size-(--rapo-dimension-x7)" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{d.이름}</span>
                      <span className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{d.설명}</span>
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                    <img src="/rapo/home/chevron.svg" alt="" width={12} height={12} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section id="notify" aria-labelledby="toolkit-notify" className="flex scroll-mt-(--rapo-dimension-x4) flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
          <RapoSectionTitle id="toolkit-notify">알림 받기</RapoSectionTitle>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
            관심 학회의 새 교육, 우리 지역 봉사활동과 청년정책이 올라오면 알려 드려요
          </p>
          <Link href="/me/notify"
            className="rapo-type-t4-bold flex h-(--rapo-dimension-x12) items-center justify-center rounded-(--rapo-radius-r3)
                       bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral) active:bg-(--rapo-color-bg-deep-coral-pressed)">
            알림 고르기
          </Link>
        </section>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/toolkit" />
    </div>
  );
}
