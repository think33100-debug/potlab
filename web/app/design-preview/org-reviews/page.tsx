import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoOrgBoard } from '@/components/rapo/rapo-org-board';
import { RapoOrgReviews, type 근무후기 } from '@/components/rapo/rapo-org-reviews';

/* 병원 근무 후기 미리보기 (2026-11-15 · 피그마 1328:2701) — 개발 서버에서만. 견본 후기(실제 아님).
     ?n=0 없음 · 2 집계 중 · 3(기본) 평균 공개 */
export default async function DesignPreviewOrgReviews({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const n = Number((await searchParams).n ?? 3);
  const 견본: 근무후기[] = [
    { id: 1, 기관: '견본재활병원', 별점: 4, 교육: '충분해요', 일정: '예측 가능해요', 휴게: '확보돼요', 글: '처음 한 달은 교육 담당 선생님과 같이 일했어요. 매주 금요일에 궁금했던 점을 모아서 물어볼 시간이 있어서 적응하기 편했어요.', 쓴때: '2026-11-06T03:00:00Z', 내것: false },
    { id: 2, 기관: '견본재활병원', 별점: 4, 교육: '보통이에요', 일정: '예측 가능해요', 휴게: '보통이에요', 글: '매일 인수인계 시간이 정해져 있어요. 모르는 내용을 동료에게 물어보기 편했어요.', 쓴때: '2026-11-06T02:00:00Z', 내것: true },
    { id: 3, 기관: '견본재활병원', 별점: 5, 교육: '부족해요', 일정: '자주 바뀌어요', 휴게: '어려워요', 글: null, 쓴때: '2026-11-05T02:00:00Z', 내것: false },
  ].slice(0, n);
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: '#112332' }}>
      <RapoOrgBoard name="견본재활병원" sido="서울" 탭="review" 있나
        후기={<RapoOrgReviews name="견본재활병원" sido="서울" 후기들={견본} 인증됨 />} />
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/community" dark />
    </div>
  );
}
