import Image from 'next/image';
import Link from 'next/link';
import { RapoBannerCarousel } from './rapo-banner-carousel';
import { RapoShell } from './rapo-shell';
import { RapoSectionTitle } from './rapo-ui';
import type { ReactNode } from 'react';
import type { Who } from '@/lib/supabase-server';

/* RAPO 새 디자인 · 홈 · 비회원 · 기본 (2026-11-11)
   Figma 「U01 · 홈 · 비회원 · 기본」 701:1644 (414 × 2872) — 섹션 차례 그대로입니다.

     헤더 → 구분선 → 배너 셋(좌우로 밀기) → 라포에서 시작하기 → 익명 질문과 답변
     → 6px 틈 → 조건으로 공고 찾기 → 6px 틈 → 채용 공고 → 라포 더 둘러보기 → 아래 탐색

   폭 — 원본은 414 고정이지만 여기는 화면 폭을 따릅니다(360~768). 지금 앱의
   최대 폭 규칙(max-w-3xl)을 그대로 씁니다. 그림처럼 줄이지 않고, 원본에서 오른쪽에
   붙은 것은 오른쪽 기준으로, 왼쪽에 붙은 것은 왼쪽 기준으로 둡니다.

   색·간격·글자는 app/rapo-tokens.css 의 이름으로만 씁니다. 원본이 지운 컬렉션
   (Archive · Wireframe review)에 묶여 있던 자리는 같은 값의 현행 토큰으로 옮겼고,
   현행에 같은 값이 없는 둘(#3F4C57 · #8E241E)만 값 그대로 둡니다 — docs/rapo-design 참고.

   회원이면 「U01 · 홈 · 회원 · 기본」 795:15922 과 다른 글자만 바꿉니다 —
   헤더 단추 「내 정보」 · 배너1 「공고 둘러보기 →」 · 배너3 제목 「다음 배움을 찾아보세요」.
   (회원 배너의 그림이 비회원과 같은지는 글자만 대조해 아직 확인 못 했습니다)

   who 가 「모름」이면 로그인도 내 정보도 그리지 않습니다 (lib/supabase-server.ts 규칙).
   jobs 는 「채용 공고」 칸입니다 — 받는 중·줄 있음·없음·오류를 부르는 쪽이 골라 넣습니다
   (app/page.tsx · rapo-job-list.tsx). sample 은 미리보기 전용 띠입니다.

   옛 위쪽 줄·옛 탭바는 이 화면에서 그려지지 않습니다 (lib/nav.ts 새틀화면 ·
   components/chrome-switch.tsx). 전에 쓰던 CSS 가리기(rapo-home.css)는 없앴습니다.
   키보드 포커스 테두리는 이 틀 안에서만 새 토큰 색을 씁니다 (app/globals.css). */
export function HomeU01({ jobs, who, sample = false, 관리덮기 }: {
  jobs: ReactNode; who: Who; sample?: boolean;
  관리덮기?: { 채용관리: boolean; 교육관리: boolean };   // 미리보기 전용 (rapo-bottom-nav.tsx)
}) {
  return (
    <RapoShell who={who} current="/" 관리덮기={관리덮기}>
        <h1 className="sr-only">RAPO 홈</h1>
        <Banners member={who === '회원'} />
        <StartHere />
        <AnonymousTalk />
        <div aria-hidden className="h-[6px] bg-(--rapo-color-bg-layer-default)" />
        <JobCurations />
        <div aria-hidden className="h-[6px] bg-(--rapo-color-bg-layer-default)" />
        {sample && (
          <p className="rapo-type-t2-bold bg-(--rapo-color-bg-warning-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x2)
                        text-(color:--rapo-color-fg-warning-contrast)">
            미리보기 · 아래 공고는 디자인 원본의 견본입니다 (실제 공고 아님)
          </p>
        )}
        {jobs}
        <MoreServices />
    </RapoShell>
  );
}

/* ── 배너 셋 · 「02 · 배너 캐러셀 · 좌우 스크롤」 956:17786 ────────────────
   미는 틀과 점 표시는 rapo-banner-carousel.tsx 가 그립니다 — 점은 배너와 따로 자리에 고정입니다.
   폭이 늘어도 깨지지 않게: 글자·단추는 왼쪽 기준, 화살표·사진은 오른쪽 기준으로 두고,
   네모 틀은 늘이는 그림이 아니라 4px 선 네 줄로 그립니다(Frame). */
function Banners({ member }: { member: boolean }) {
  return (
    <RapoBannerCarousel label="라포 소개" tones={['white', 'white', 'navy']}>
      {/* 1 · 그라데이션 + 치료사 사진 */}
      <div role="group" aria-roledescription="slide" aria-label="1 / 3"
        className="relative h-[246px] w-full shrink-0 snap-start overflow-hidden"
        style={{ backgroundImage: 'linear-gradient(124.8deg, #FF4F40 0%, #FF3524 101.03%)' }}>
        {/* 원본(414)에서 사진은 162×172 · 오른쪽 31px · 아래 27px 로 네모 틀 **안**에 있습니다.
            전에는 좁은 화면에서 왼쪽 자리(221px)만 지켜서 사진이 틀 오른쪽 밖으로 나갔습니다
            (390 폭 휴대폰에서 보임 · 2026-11-11 대표 지적). 이제 오른쪽·아래를 틀에 붙여 두고,
            화면이 좁으면 사진을 같은 비율로 줄입니다 — 왼쪽 끝은 원본과 같은 221px 에 머뭅니다.
            414 이상에서는 원본 크기 그대로입니다. */}
        <div className="absolute bottom-[27px] right-[31px] aspect-[162/172] w-[clamp(110px,calc(100%-252px),162px)]">
          {/* 첫 화면에 바로 보이는 그림이라 늦게 받지 않습니다 (Next 16 문서 — loading="eager") */}
          <Image src="/rapo/home/banner1-therapist.png" alt="" fill sizes="162px" loading="eager"
            className="object-cover object-bottom" />
        </div>
        <Frame tone="white" />
        <Arrow right={20} top={25} /><Arrow right={20} top={52} /><Arrow right={48} top={25} />
        <p className="absolute left-[40px] top-[57px] w-[239px] text-[23px] font-bold leading-[28px] text-(color:--rapo-brand-color-white)">
          궁금한 병원 이야기부터<br />내가 찾던 일자리까지
        </p>
        <Link href={member ? '/jobs' : '/login'}
          className="absolute left-[40px] top-[168px] flex h-[36px] w-[180px] items-center
                     rounded-(--rapo-radius-r1) whitespace-pre text-[14px] font-bold leading-[1.45] text-(color:--rapo-brand-color-white)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          {member ? '공고 둘러보기  →' : '회원가입하기  →'}
        </Link>
      </div>

      {/* 2 · 실사 · 내 스펙.
          ★ 2026-11-12 세중님 「2번 3번 그림이 나가버림 · 첫 번째처럼 조절」 — 전에는 틀 전체를 사진으로 덮어서(cover)
            좁은 휴대폰에서는 오른쪽 사람이, 넓은 화면에서는 얼굴 위아래가 잘렸습니다.
            두 사진은 배경이 한 가지 색이라, 사진은 <배너사진> 으로 옆이 안 잘리게 놓고 남는 자리는 그 배경색으로 채웁니다 */}
      <div role="group" aria-roledescription="slide" aria-label="2 / 3"
        className="relative h-[246px] w-full shrink-0 snap-start overflow-hidden bg-[#102233]">
        <배너사진 src="/rapo/home/banner2.png" />
        <Frame tone="white" />
        <p className="absolute left-[36px] top-[65px] w-[240px] text-[23px] font-bold leading-[30px] text-(color:--rapo-brand-color-white)">
          내 경력과 스펙을<br />한눈에 확인해요
        </p>
        <Link href="/me/soon?k=spec"
          className="absolute left-[36px] top-[185px] w-[220px] rounded-(--rapo-radius-r1) text-[14px] font-bold leading-[24px] text-(color:--rapo-brand-color-white)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          입사 스펙 비교하기 →
        </Link>
      </div>

      {/* 3 · 실사 · 교육학술 */}
      <div role="group" aria-roledescription="slide" aria-label="3 / 3"
        className="relative h-[246px] w-full shrink-0 snap-start overflow-hidden bg-[#edf6f0]">
        <배너사진 src="/rapo/home/banner3.png" />
        <Frame tone="navy" />
        <p className="absolute left-[36px] top-[65px] w-[240px] text-[23px] font-bold leading-[30px] text-(color:--rapo-brand-color-navy)">
          {member ? <>다음 배움을<br />찾아보세요</> : <>내 직군에 맞는<br />교육·학술 일정</>}
        </p>
        <Link href="/edu"
          className="absolute left-[36px] top-[185px] w-[220px] rounded-(--rapo-radius-r1) text-[14px] font-bold leading-[24px] text-(color:--rapo-brand-color-navy)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          교육학술 보기 →
        </Link>
      </div>
    </RapoBannerCarousel>
  );
}

/* 실사 배너 사진(1536×1024 · 3:2) — 원본 414 폭에서는 폭에 맞춰 414×276 으로 놓고 위아래 15px 씩 잘립니다(FILL).
   그 모양을 어느 폭에서나 지킵니다: 사진 폭 = min(배너 폭, 414) · 오른쪽에 붙임 · 위아래 가운데.
     414 보다 좁으면  옆은 안 잘리고 위아래에 배경색이 몇 px 보입니다(사진 배경과 같은 색)
     414 보다 넓으면  사진은 414 그대로 오른쪽에 두고 왼쪽(글자 자리)은 배경색입니다 — 얼굴이 안 잘립니다 */
function 배너사진({ src }: { src: string }) {
  return (
    <div className="absolute right-0 top-1/2 aspect-[3/2] w-[min(100%,414px)] -translate-y-1/2">
      <Image src={src} alt="" fill sizes="414px" className="object-cover" />
    </div>
  );
}

/* 「RAPO / 열린 네모 프레임 / 벡터」 — 원본 374×196 · 좌우 20 · 위 25 · 선 4px.
   원본은 오른쪽 위 모서리가 열린 네모입니다(위 선은 오른쪽 94px 앞에서 끝나고,
   오른쪽 선은 위에서 66px 아래부터 시작 — 그 빈 자리에 화살표 셋이 놓입니다).
   SVG 를 폭에 맞춰 늘이면 세로 선만 굵어져서(디자이너 지적 2026-11-11) 선 네 줄로 그립니다.
   폭이 얼마든 선은 4px, 열린 자리는 94×66 그대로입니다. */
function Frame({ tone }: { tone: 'white' | 'navy' }) {
  const 색 = tone === 'navy' ? 'bg-(--rapo-brand-color-navy)' : 'bg-(--rapo-brand-color-white)';
  return (
    <span aria-hidden className="pointer-events-none absolute left-[20px] right-[20px] top-[25px] h-[196px]">
      <span className={`absolute left-0 right-[94px] top-0 h-[4px] ${색}`} />
      <span className={`absolute bottom-0 left-0 top-0 w-[4px] ${색}`} />
      <span className={`absolute bottom-0 left-0 right-0 h-[4px] ${색}`} />
      <span className={`absolute bottom-0 right-0 top-[66px] w-[4px] ${색}`} />
    </span>
  );
}

/* 「RAPO / 안으로 향하는 화살표」 — 21×21 을 -90° 돌려 씁니다(원본 그대로) */
function Arrow({ right, top }: { right: number; top: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */
    <img src="/rapo/home/banner-arrow.svg" alt="" width={21} height={21}
      className="pointer-events-none absolute -rotate-90" style={{ right, top }} />
  );
}

/* ── 라포에서 시작하기 · 「RAPO / Home / 주요 서비스 영역」 1210:1139 ──────── */
function StartHere() {
  return (
    <section aria-labelledby="rapo-home-start"
      className="flex flex-col gap-(--rapo-dimension-x4) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)">
      <RapoSectionTitle id="rapo-home-start">라포에서 시작하기</RapoSectionTitle>
      <div className="grid h-[216px] grid-cols-2 gap-(--rapo-dimension-x3)">
        <Link href="/community"
          className="relative flex flex-col gap-(--rapo-dimension-x1_5) overflow-hidden rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-navy)
                     p-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-navy-solid-pressed)">
          <span className="rapo-type-t6-bold text-(color:--rapo-brand-color-white)">커뮤니티 보기</span>
          <span className="text-[12px] leading-[17px] text-(color:--rapo-brand-color-white)">어디서도 나눌 수 없던<br />우리만의 이야기</span>
          <span aria-hidden className="absolute bottom-0 right-0 flex h-[124px] w-[160px] items-start overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_20px),linear-gradient(to_bottom,transparent,#000_20px)] [mask-composite:intersect]">
            <Image src="/rapo/home/start-community.png" alt="" width={160} height={160} className="size-[160px] shrink-0 object-contain" />
          </span>
        </Link>
        <Link href="/jobs"
          className="relative flex flex-col gap-(--rapo-dimension-x1_5) overflow-hidden rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-mist)
                     p-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-neutral-weak-pressed)">
          <span className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">공고 찾기</span>
          <span className="text-[12px] leading-[17px] text-(color:--rapo-brand-color-navy)">내게 맞는 일을 찾아요</span>
          <span aria-hidden className="absolute bottom-0 right-0 flex h-[124px] w-[160px] items-center justify-center overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_20px),linear-gradient(to_bottom,transparent,#000_20px)] [mask-composite:intersect]">
            <Image src="/rapo/home/start-jobs.png" alt="" width={160} height={160} className="size-[160px] shrink-0 object-contain" />
          </span>
        </Link>
      </div>
    </section>
  );
}

/* ── 익명 질문과 답변 · 「RAPO / Home / 익명 질문과 답변 / 기본」 955:846 ───────
   원본 설명 그대로 「기존 가상 콘텐츠 예시를 유지」한 글입니다 — 실제 회원 글이 아닙니다.
   회원 화면에 이대로 낼지는 대표 확인 자리입니다(docs/rapo-design-implementation.md). */
const 답변 = [
  { img: '/rapo/home/avatar-1.png', text: ['교육 기간과 담당 환자 수를', '면접에서 같이 물어보세요.'] },
  { img: '/rapo/home/avatar-2.png', text: ['저도 라포 지원 준비 중이에요.', '교육 담당 선생님이 계신가요?'] },
  { img: '/rapo/home/avatar-3.png', text: ['혼자 치료를 시작하는 시점도', '함께 확인하면 좋겠네요.'] },
];

function AnonymousTalk() {
  return (
    <section aria-labelledby="rapo-home-talk"
      className="flex flex-col gap-(--rapo-dimension-x5) bg-(--rapo-brand-color-navy) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)">
      <RapoSectionTitle id="rapo-home-talk" tone="inverse">어디서도 나눌 수 없던<br />우리만의 이야기</RapoSectionTitle>
      <div className="flex flex-col gap-(--rapo-dimension-x3)">
        <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x4)">
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-brand-contrast)">익명의 동료가 물었어요</p>
          <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">라포재활병원 다녀보신 분,<br />신입 교육은 어떤가요?</p>
        </div>
        <ul className="flex flex-col gap-(--rapo-dimension-x2) pl-(--rapo-dimension-x6)">
          {답변.map((a) => (
            <li key={a.img} className="flex items-start gap-(--rapo-dimension-x2)">
              <Image src={a.img} alt="" width={32} height={32} className="size-(--rapo-dimension-x8) shrink-0 rounded-(--rapo-radius-full) object-contain" />
              <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x3)">
                <p className="text-[12px] font-medium leading-[19px] text-(color:--rapo-color-fg-neutral-muted)">익명</p>
                <p className="text-[14px] leading-[20px] text-(color:--rapo-color-fg-neutral)">{a.text[0]}<br />{a.text[1]}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── 조건으로 공고 찾기 · 「RAPO / Home / 조건별 공고 탐색 영역」 1210:1147 ─────
   ⚠ 지금 /jobs 에 「급여 공개」·「신입 지원」 거르기가 없습니다. 새 거르기를 만들지 않고
     둘 다 /jobs 로 보냅니다 — 거르기를 만들지는 대표 확인 자리입니다. */
const 조건카드 = [
  { title: '급여 공개 공고', text: ['급여가 표시된 공고를', '먼저 비교해보세요'], bg: 'bg-(--rapo-color-palette-coral-400)',
    art: { src: '/rapo/home/graphic-pay-48.svg', w: 44.3077, l: 1.58, t: 4.15 } },
  { title: '신입 지원 공고', text: ['경력 조건부터 확인하고', '첫 지원을 준비해보세요'], bg: 'bg-(--rapo-color-palette-navy-500)',
    art: { src: '/rapo/home/graphic-spec-48.svg', w: 43.2, l: 1.95, t: 3.3 } },
];

function JobCurations() {
  return (
    <section aria-labelledby="rapo-home-curation"
      className="flex flex-col gap-(--rapo-dimension-x4) bg-(--rapo-color-bg-neutral-weak) py-(--rapo-dimension-x5) pl-(--rapo-dimension-x5)">
      <div className="flex flex-col gap-(--rapo-dimension-x1) pr-(--rapo-dimension-x5)">
        <RapoSectionTitle id="rapo-home-curation">조건으로 공고 찾기</RapoSectionTitle>
        <p className="text-[13px] leading-[19px] text-(color:--rapo-color-fg-neutral-muted)">비교하고 싶은 조건부터 골라보세요</p>
      </div>
      <ul className="flex snap-x gap-(--rapo-dimension-x3) overflow-x-auto pr-(--rapo-dimension-x5) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {조건카드.map((c) => (
          <li key={c.title} className="w-[244px] shrink-0 [flex-grow:1] snap-start">
            <Link href="/jobs"
              className={`flex h-full flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) p-(--rapo-dimension-x4) ${c.bg}`}>
              <span className="flex items-center gap-(--rapo-dimension-x3)">
                <span className="flex size-(--rapo-dimension-x14) shrink-0 items-center justify-center rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default)">
                  <span className="relative size-(--rapo-dimension-x12) overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                    <img src={c.art.src} alt="" width={c.art.w} height={c.art.w} className="absolute" style={{ left: c.art.l, top: c.art.t }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-[17px] font-bold leading-[24px] text-(color:--rapo-brand-color-navy)">{c.title}</span>
              </span>
              <span className="text-[13px] leading-[19px] text-(color:--rapo-brand-color-navy)">{c.text[0]}<br />{c.text[1]}</span>
              <span className="text-[13px] font-medium leading-[20px] text-(color:--rapo-brand-color-navy)">공고 보기</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 라포 더 둘러보기 · 「RAPO / Home / 라포 더 둘러보기 / 통합 툴킷」 954:827 ──
   가는 곳은 지금 앱에 있는 화면만 씁니다(lib/routes.ts). 「공시 병원 급여」는
   연봉 안내 글(/guide/therapist-salary · 공공병원 60곳의 공시 보수 표)로 갑니다 (2026-11-13) —
   전에는 맞는 화면이 없어 병원 찾기(/orgs)로 보냈습니다. 병원 찾기는 그 글의 「병원별로 찾아보기」 단추로 이어집니다. */
const 서비스 = [
  { label: '공시 병원 급여', href: '/guide/therapist-salary', art: { src: '/rapo/home/graphic-pay-28.svg',       w: 25.8461, l: 0.92, t: 2.42 } },
  { label: '입사 스펙 비교', href: '/me/soon?k=spec', art: { src: '/rapo/home/graphic-cert-28.svg',      w: 28,      l: 0,    t: 0 } },
  { label: '교육·학술',      href: '/edu',       art: { src: '/rapo/home/graphic-edu-28.svg',       w: 28.0002, l: 0,    t: -0.35 } },
  { label: '계산기',         href: '/toolkit#pay',     art: { src: '/rapo/home/graphic-calc-28.svg',      w: 27.0967, l: 0.11, t: 0.11 } },
  { label: '봉사활동',       href: '/volunteer', art: { src: '/rapo/home/graphic-volunteer-28.svg', w: 24.5215, l: 1.74, t: 1.82 } },
  { label: '청년정책',       href: '/youth',     art: { src: '/rapo/home/graphic-youth-28.svg',     w: 27.3067, l: -0.34, t: -0.6 } },
];

/* 여섯 서비스 두 줄 틀 — 홈 「라포 더 둘러보기」와 툴킷 화면이 같이 씁니다 (2026-11-14 세중님 「미리 만들어 둔 저 틀을 넣자」) */
export function RapoServiceGrid() {
  return (
     <ul className="grid grid-cols-2 gap-x-(--rapo-dimension-x3) gap-y-(--rapo-dimension-x2)">
          {서비스.map((s) => (
            <li key={s.href}>
              <Link href={s.href}
                className="flex h-(--rapo-dimension-x16) items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-layer-default)
                           px-(--rapo-dimension-x3) active:bg-(--rapo-color-bg-layer-default-pressed)">
                <span className="relative size-(--rapo-dimension-x7) shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                  <img src={s.art.src} alt="" width={s.art.w} height={s.art.w} className="absolute max-w-none" style={{ left: s.art.l, top: s.art.t }} />
                </span>
                <span className="rapo-type-t4-medium min-w-0 flex-1 break-keep text-(color:--rapo-brand-color-navy)">{s.label}</span>
                {/* 320 폭에서는 셰브런을 접습니다 — 「봉사 / 활동」처럼 말 가운데가 갈렸습니다 (2026-11-14) */}
                {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                <img src="/rapo/home/chevron.svg" alt="" width={12} height={12} className="shrink-0 max-[359px]:hidden" />
              </Link>
            </li>
          ))}
        </ul>
  );
}

function MoreServices() {
  return (
    <section aria-labelledby="rapo-home-more"
      className="flex flex-col gap-(--rapo-dimension-x3) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)">
      <RapoSectionTitle id="rapo-home-more">라포 더 둘러보기</RapoSectionTitle>
      {/* 2026-11-14 — 누르면 툴킷 화면(/toolkit)으로. 전에는 누를 수 없는 카드였습니다 */}
      <Link href="/toolkit" className="flex min-h-[128px] items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4)
                                       active:opacity-90">
        <span className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
          <span className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">라포 올인원 툴킷</span>
          <span className="rapo-type-t3-regular text-[#3F4C57]">입사 준비부터 배움과 생활 정보까지<br />필요한 도구를 한곳에서 찾아보세요</span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/home/toolkit.svg" alt="" width={72} height={72} className="shrink-0" />
      </Link>
      <RapoServiceGrid />
    </section>
  );
}
