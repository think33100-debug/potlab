import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoEduFilter, RapoEduPastToggle, RapoEduTop, RapoExploreNote, RapoExploreRow } from '@/components/rapo/rapo-edu';

/* 봉사활동·청년정책 — **견본**(가짜 줄 · 실제 자료 아님). 개발 서버에서만. ?kind=youth 면 청년정책 */
export const metadata: Metadata = { title: 'RAPO · 둘러보기 미리보기', robots: { index: false } };

export default async function DesignPreviewExplore({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const 청년 = (await searchParams).kind === 'youth';
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoEduTop title={청년 ? '청년정책' : '봉사활동'} art={청년 ? '/rapo/home/graphic-youth-28.svg' : '/rapo/home/graphic-volunteer-28.svg'} />
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">
        <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x4)">
          <RapoEduFilter icon="/rapo/list/sliders-16.svg" label={청년 ? '갈래' : '분야'} 고른것={null} 선택지={[{ 글: '전체', 주소: '#a', 켜짐: true }]} />
          <RapoEduFilter icon="/rapo/list/pin-16.svg" label="지역" 고른것="서울" 선택지={[{ 글: '전국', 주소: '#b', 켜짐: false }, { 글: '서울', 주소: '#c', 켜짐: true, 수: 2 }]} />
        </div>
        <div className="flex items-center justify-between gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x2)">
          <h2 className="text-[20px] font-bold leading-[22px] text-(color:--rapo-brand-color-navy)">{청년 ? '청년정책' : '봉사활동'} 2건</h2>
          <RapoEduPastToggle on={false} href="#p" label={청년 ? '신청 끝난 것 포함' : '모집 끝난 것 포함'} />
        </div>
        <ul>
          {청년 ? (
            <>
              <li><RapoExploreRow href="#" 기관="견본 · ○○부" 그림="03" 제목="견본 · 청년 취업 지원금" 바깥말="신청하러 가기"
                설명="견본 설명입니다. 실제 정책이 아닙니다. 두 줄까지만 보이고 나머지는 줄여서 보여 줍니다." 태그={['일자리', '전국', '19~34세']} 날짜="~ 12월 31일까지" 급함 /></li>
              <li><RapoExploreRow href={null} 기관="견본 · ○○시" 그림="06" 제목="견본 · 청년 월세 지원" 바깥말="신청하러 가기" 태그={['주거', '서울']} 날짜="상시 신청" /></li>
            </>
          ) : (
            <>
              <li><RapoExploreRow href="#" 기관="견본 · ○○복지관" 그림="01" 제목="견본 · 어르신 말벗 봉사" 바깥말="VMS 에서 신청"
                설명="○○복지관 2층" 태그={['대면', '복지·보건', '청소년 가능', '3/10명 · 7자리']} 날짜="2026.11.20 ~ 2026.12.20   서울 강남구" /></li>
              <li><RapoExploreRow href="#" 기관="견본 · ○○요양원" 그림="03" 제목="견본 · 재활 운동 보조" 바깥말="VMS 에서 신청" 태그={['대면']} 날짜="서울" /></li>
            </>
          )}
        </ul>
        <RapoExploreNote><p>견본 안내 칸입니다.</p></RapoExploreNote>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/" />
    </div>
  );
}
