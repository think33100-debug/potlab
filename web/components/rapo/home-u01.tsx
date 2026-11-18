import Image from 'next/image';
import Link from 'next/link';
import { RapoBannerCarousel } from './rapo-banner-carousel';
import { RapoBrandStory } from './rapo-brand-story';
import { RapoStudentCorner } from './rapo-student-corner';
import { SpecEntryArt, SpecEntryLabel, 스펙비교길 } from './rapo-spec-entry';
import { RapoShell } from './rapo-shell';
import { RapoStartScroller } from './rapo-start-scroller';
import { RapoButton, RapoSectionTitle } from './rapo-ui';
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
        <div aria-hidden className="h-[6px] bg-(--rapo-color-bg-layer-default)" />
        {/* 「라포 이야기」 · 2026-11-18 세중님 「시작하기 아래에」 */}
        <RapoBrandStory />
        <div aria-hidden className="h-[6px] bg-(--rapo-color-bg-layer-default)" />
        {/* 「학생·취준생이라면」 · 2026-11-18 세중님 「학생들도 주 타겟」 */}
        <RapoStudentCorner />
        <AnonymousTalk />
        <div aria-hidden className="h-[6px] bg-(--rapo-color-bg-layer-default)" />
        {/* 「조건으로 공고 찾기」는 2026-11-18 세중님 「빼자」로 뺐습니다 */}
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
        {/* 2026-11-18 세중님 「저 여자 둘 지우고 우리 로고 흰색으로 연하게」 — 치료사 사진 대신 RAPO 로고(R 상징)를 흰색으로 옅게.
            자리는 사진이 있던 오른쪽 아래 그대로(틀 안 · 오른쪽 31 · 아래 27) · 좁은 화면에서 같은 식으로 줄어듭니다 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 로고 SVG 그대로 */}
        <img src="/rapo/home/logo-symbol.svg" alt="" aria-hidden width={150} height={146}
          className="pointer-events-none absolute bottom-[40px] right-[40px] h-auto w-[clamp(96px,calc(100%-262px),150px)] opacity-25 [filter:brightness(0)_invert(1)]" />
        <Frame tone="white" />
        <Arrow right={20} top={25} /><Arrow right={20} top={52} /><Arrow right={48} top={25} />
        {/* 2026-11-18 세중님 「첫 배너에 라포 이야기를 · 밝은 주황 배경 · 흰 글씨」 — 글은 Figma 브랜드 소개(32:17) 머리와 존재 이유.
            전 글: 「궁금한 병원 이야기부터 / 내가 찾던 일자리까지」 */}
        <p className="absolute left-[40px] top-[52px] w-[239px] text-[23px] font-bold leading-[29px] text-(color:--rapo-brand-color-white)">
          우리가 나눈 정보,<br />우리가 바꿀 내일
        </p>
        <p className="absolute left-[40px] top-[118px] w-[239px] text-[14px] font-medium leading-[20px] text-white/90">
          정보와 경험을 나누어<br />더 나은 일터를 함께 만들어요
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
        <Link href={스펙비교길}
          className="absolute left-[36px] top-[185px] w-[220px] rounded-(--rapo-radius-r1) text-[14px] font-bold leading-[24px] text-(color:--rapo-brand-color-white)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          <SpecEntryLabel 뒤="하기 →" />
        </Link>
      </div>

      {/* 3 · 실사 · 공시 병원 급여 — 2026-11-18 세중님 「겹치는 것 정리」로 교육학술에서 바꿈
          (교육은 시작하기·학생 칸에 있습니다). 가는 곳은 연봉 안내 글(공공병원이 공시한 보수 · /guide/therapist-salary).
          그림(banner3.png)은 그대로입니다 */}
      <div role="group" aria-roledescription="slide" aria-label="3 / 3"
        className="relative h-[246px] w-full shrink-0 snap-start overflow-hidden bg-[#edf6f0]">
        <배너사진 src="/rapo/home/banner3.png" />
        <Frame tone="navy" />
        <p className="absolute left-[36px] top-[65px] w-[240px] text-[23px] font-bold leading-[30px] text-(color:--rapo-brand-color-navy)">
          공공병원<br />치료사 연봉
        </p>
        <Link href="/guide/therapist-salary"
          className="absolute left-[36px] top-[185px] w-[220px] rounded-(--rapo-radius-r1) text-[14px] font-bold leading-[24px] text-(color:--rapo-brand-color-navy)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          공시된 급여 보기 →
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

/* ── 라포에서 시작하기 · 「RAPO / Home / 주요 서비스 영역」 1210:1139 ────────
   2026-11-18 세중님 「오른쪽으로 넘기는 식으로 · 경쟁률·봉사활동·청년정책 바로 갈 수 있는 창」 → 「ㄱㄱ」.
   카드 틀은 원본 그대로(높이 216 · r3 · 안쪽 x4 · 제목 t6-bold · 설명 12/17 · 그림 오른쪽 아래)이고,
   두 칸 격자를 가로 넘기기(scroll-snap)로 바꿔 카드 넷을 더했습니다. 카드 폭 44% 라 다음 카드가 살짝 보입니다.
   새 카드 그림은 3D 그림이 아직 없어 툴킷 28px 그림을 크게 씁니다 — 디자이너 그림이 오면 그림.src 만 바꿉니다. */
type 시작카드 = {
  제목: string; 설명: [string, string?]; href: string; bg: string; 글색: string; 눌림: string;
  /* 크기 — 그림 판 안에서 그림 한 변(px). 피사체가 판을 꽉 채운 3D 원본은 작게 둡니다(기본 160) */
  그림: { src: string; 큰것?: '위' | '가운데'; 크기?: number };
};
/* ★ 2026-11-18 세중님 「블랙 모드에서 이상하게 변환」 — 그림 넷 모두 **바탕이 투명한** 파일입니다.
   삼성 인터넷은 어두운 폰에서 카드 바탕색은 어둡게 바꾸고 그림은 그대로 둡니다. 그림에 바탕색이 같이 구워져 있으면
   카드 안에 밝은 네모가 떠 보였습니다(공고 찾기 · 커뮤니티). 새 그림을 넣을 때도 바탕 없는 PNG 로 넣습니다.
   바탕 빼는 코드는 금고 RAPO노트/시안_브랜드이야기_1118/바탕빼기.js */
const 시작카드들: 시작카드[] = [
  { 제목: '커뮤니티 보기', 설명: ['어디서도 나눌 수 없던', '우리만의 이야기'], href: '/community',
    bg: 'bg-(--rapo-brand-color-navy)', 글색: 'text-(color:--rapo-brand-color-white)', 눌림: 'active:bg-(--rapo-color-bg-navy-solid-pressed)',
    그림: { src: '/rapo/home/start-community-cut.png', 큰것: '위' } },
  { 제목: '공고 찾기', 설명: ['내게 맞는 일을 찾아요'], href: '/jobs',
    bg: 'bg-(--rapo-brand-color-mist)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:bg-(--rapo-color-bg-neutral-weak-pressed)',
    그림: { src: '/rapo/home/start-jobs-cut.png', 큰것: '가운데' } },
  /* 2026-11-18 세중님 「공고 찾기 다음에 교육 확인하기, 채용경쟁률 확인하기 — 총 4개」.
     봉사활동·청년정책·병원 둘러보기 카드는 뺐습니다(「라포 더 둘러보기」와 홈 「학생·취준생이라면」에 있습니다).
     색은 브랜드 가이드 다섯 색 안에서 고릅니다(네이비 · 미스트 · 블러시) */
  { 제목: '교육 확인하기', 설명: ['학회 교육 일정을', '한곳에서 봐요'], href: '/edu',
    bg: 'bg-(--rapo-brand-color-blush)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:brightness-95',
    /* 3D 그림 — Figma 「RAPO / 이미지 / 임상 실습 교재와 교육 일정」(1414:50888 · 원본 320px) */
    그림: { src: '/rapo/home/start-edu.png', 큰것: '가운데', 크기: 112 } },
  { 제목: '채용 경쟁률 확인하기', 설명: ['공공기관 경쟁률을', '정리했어요'], href: '/compete',
    bg: 'bg-(--rapo-brand-color-mist)', 글색: 'text-(color:--rapo-brand-color-navy)', 눌림: 'active:bg-(--rapo-color-bg-neutral-weak-pressed)',
    /* 3D 그래프 그림 — 2026-11-18 세중님 「경쟁률은 그래프 모양으로 다시」. 브랜드 색(코럴·네이비·미스트 계열)으로 그린 막대 셋과 오르는 화살표.
       Figma 에 맞는 원본이 없어 직접 그렸습니다(320px · 그린 코드는 금고 RAPO노트/시안_브랜드이야기_1118/경쟁률_그래프_그리기.js) */
    그림: { src: '/rapo/home/start-compete-chart.png', 큰것: '가운데', 크기: 112 } },
];
/* 큰 그림의 왼쪽·위 20px 를 흐리게 감춥니다 (원본 그대로) */
const 그림가림 = '[mask-image:linear-gradient(to_right,transparent,#000_20px),linear-gradient(to_bottom,transparent,#000_20px)] [mask-composite:intersect]';

function StartHere() {
  return (
    <section aria-labelledby="rapo-home-start" className="flex flex-col gap-(--rapo-dimension-x4) py-(--rapo-dimension-x6)">
      <div className="flex items-end justify-between gap-(--rapo-dimension-x3) px-(--rapo-dimension-x5)">
        <RapoSectionTitle id="rapo-home-start">라포에서 시작하기</RapoSectionTitle>
        <span className="rapo-type-t3-regular shrink-0 whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">옆으로 넘겨 보세요 ›</span>
      </div>
      {/* 마우스 기기에는 양옆에 흰 화살표가 뜹니다 (rapo-start-scroller.tsx · 2026-11-18) */}
      <RapoStartScroller className="flex snap-x snap-mandatory gap-(--rapo-dimension-x3) overflow-x-auto scroll-px-(--rapo-dimension-x5) px-(--rapo-dimension-x5)
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {시작카드들.map((c) => (
          <li key={c.href} className="w-[44%] min-w-[150px] max-w-[200px] shrink-0 snap-start">
            <Link href={c.href}
              className={`relative flex h-[216px] flex-col gap-(--rapo-dimension-x1_5) overflow-hidden rounded-(--rapo-radius-r3) p-(--rapo-dimension-x4) ${c.bg} ${c.눌림}`}>
              <span className={`rapo-type-t6-bold break-keep ${c.글색}`}>{c.제목}</span>
              <span className={`text-[12px] leading-[17px] ${c.글색}`}>
                <span className="block">{c.설명[0]}</span>
                {c.설명[1] && <span className="block">{c.설명[1]}</span>}
              </span>
              {c.그림.큰것 ? (
                <span aria-hidden className={`absolute bottom-0 right-0 flex h-[124px] w-[160px] overflow-hidden ${c.그림.큰것 === '위' ? 'items-start' : 'items-center justify-center'} ${그림가림}`}>
                  <Image src={c.그림.src} alt="" width={c.그림.크기 ?? 160} height={c.그림.크기 ?? 160} className="shrink-0 object-contain"
                    style={{ width: c.그림.크기 ?? 160, height: c.그림.크기 ?? 160 }} />
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- 툴킷 SVG 그림을 크게 */
                <img aria-hidden src={c.그림.src} alt="" width={84} height={84}
                  className="absolute bottom-(--rapo-dimension-x4) right-(--rapo-dimension-x4) size-[84px]" />
              )}
            </Link>
          </li>
        ))}
      </RapoStartScroller>
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

/* ── 라포 더 둘러보기 · 「RAPO / Home / 라포 더 둘러보기 / 통합 툴킷」 954:827 ──
   가는 곳은 지금 앱에 있는 화면만 씁니다(lib/routes.ts). 「공시 병원 급여」는
   연봉 안내 글(/guide/therapist-salary · 공공병원 60곳의 공시 보수 표)로 갑니다 (2026-11-13) —
   전에는 맞는 화면이 없어 병원 찾기(/orgs)로 보냈습니다. 병원 찾기는 그 글의 「병원별로 찾아보기」 단추로 이어집니다. */
const 서비스 = [
  { label: '공시 병원 급여', href: '/guide/therapist-salary', art: { src: '/rapo/home/graphic-pay-28.svg',       w: 25.8461, l: 0.92, t: 2.42 } },
  { label: '입사 스펙 비교', href: 스펙비교길, 스펙: true, art: { src: '/rapo/home/graphic-cert-28.svg',      w: 28,      l: 0,    t: 0 } },
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
                  {'스펙' in s && s.스펙
                    ? <SpecEntryArt size={s.art.w} 기본={s.art.src} className="absolute max-w-none" style={{ left: s.art.l, top: s.art.t }} />
                    : <img src={s.art.src} alt="" width={s.art.w} height={s.art.w} className="absolute max-w-none" style={{ left: s.art.l, top: s.art.t }} />}
                </span>
                {/* 2026-11-16 세중님 테스터 점검 — 툴킷 화면(바깥 회색 틀 안이라 칸이 더 좁음)에서 「공시 병원 급여」·「입사 스펙 비교」가
                    375 폭에 두 줄이 됐습니다. 400 폭 아래에서는 셰브런(12+8)을 접어 글자 자리를 넓히고(360·375·390 한 줄),
                    360 아래(320·344)에서는 글자를 한 단계(t3) 줄입니다(화면표시 규칙 1 · 그래도 넘치면 낱말 사이에서만 나뉨 — break-keep) */}
                <span className="rapo-type-t4-medium min-w-0 flex-1 break-keep text-(color:--rapo-brand-color-navy) max-[359px]:text-(length:--rapo-font-size-t3)">{'스펙' in s && s.스펙 ? <SpecEntryLabel /> : s.label}</span>
                {/* 320 폭에서는 셰브런을 접습니다 — 「봉사 / 활동」처럼 말 가운데가 갈렸습니다 (2026-11-14 · 11/16 에 400 아래로 넓힘) */}
                {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                <img src="/rapo/home/chevron.svg" alt="" width={12} height={12} className="shrink-0 max-[399px]:hidden" />
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
      {/* 여섯 칸(RapoServiceGrid)은 홈에서 뺐습니다 — 2026-11-18 세중님 「겹치는 것 정리 · 둘 다 고쳐」.
          스펙·교육·봉사·청년정책이 위(시작하기·학생 칸)에 이미 있었습니다. 공시 병원 급여는 세 번째 배너로 옮겼고,
          여섯 칸은 툴킷 화면(rapo-toolkit.tsx)에 그대로 있습니다 */}
      {/* 2026-11-14 세중님 「더 둘러보기 아래 버튼 CTA · 누르면 올인원 툴킷」 */}
      <RapoButton href="/toolkit" tone="navy" size={52} full>라포 올인원 툴킷 둘러보기</RapoButton>
    </section>
  );
}
