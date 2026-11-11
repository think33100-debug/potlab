import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoEduFilter, RapoEduPastToggle, RapoEduRow, RapoEduTop } from '@/components/rapo/rapo-edu';

/* 교육 목록 — **견본**(가짜 줄 · 실제 교육 아님). 개발 서버에서만 */
export const metadata: Metadata = { title: 'RAPO · 교육 미리보기', robots: { index: false } };

const 견본 = [
  { 기관: '○○재활학회', 그림: '03' as const, 제목: '견본 · 아동 기본과정', 날짜: '9월 14일 게시' },
  { 기관: '○○연하재활학회', 그림: '06' as const, 제목: '견본 · 연하재활전문가 성인 기본과정', 날짜: '교육일은 학회에서 확인' },
  { 기관: '○○재활학회', 그림: '01' as const, 제목: '견본 · 성인 기본과정', 날짜: '11월 28일~29일   서울' },
];

export default function DesignPreviewEdu() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoEduTop />
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">
        <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x4)">
          <RapoEduFilter icon="/rapo/list/briefcase-16.svg" label="직군" 고른것="작업치료" 선택지={[
            { 글: '전체', 주소: '#a', 켜짐: false }, { 글: '작업치료', 주소: '#b', 켜짐: true }, { 글: '물리치료', 주소: '#c', 켜짐: false }]} />
          <RapoEduFilter icon="/rapo/edu/academy-16.svg" label="기관" 고른것={null} 선택지={[
            { 글: '학회 전체', 주소: '#d', 켜짐: true, 수: 3 }, { 글: '연하재활', 주소: '#e', 켜짐: false, 수: 1 }]} />
        </div>
        <div className="flex items-center justify-between gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x2)">
          <h2 className="text-[20px] font-bold leading-[22px] text-(color:--rapo-brand-color-navy)">교육 목록 3건</h2>
          <RapoEduPastToggle on={false} href="#past" />
        </div>
        <ul>{견본.map((r) => <li key={r.제목}><RapoEduRow href="#" 기관={r.기관} 그림={r.그림} 제목={r.제목} 날짜={r.날짜} /></li>)}</ul>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/" />
    </div>
  );
}
