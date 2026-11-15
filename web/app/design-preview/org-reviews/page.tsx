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
    { id: 1, 기관: '견본재활병원', 별점: 4, 복지: '다양하고 완전 만족해요', 신입교육: '교육이 다양하고 좋아요', 시설: '신축은 아니지만 괜찮아요', 치료타임: '6~10타임', 연차: '2주에서 1주', 식당: '맛있어요', 분위기: '서로서로 사이가 좋아요', 글: '처음 한 달은 교육 담당 선생님과 같이 일했어요. 매주 금요일에 궁금했던 점을 모아서 물어볼 시간이 있어서 적응하기 편했어요.', 쓴때: '2026-11-06T03:00:00Z', 내것: false, 닉네임: '다정한 곰', 그림: null },
    { id: 2, 기관: '견본재활병원', 별점: 4, 복지: '특별한 건 없지만 있을 건 다 있어요', 신입교육: '근무하기에 어려움은 없을 정도에요', 시설: '신축 건물이라 좋아요', 치료타임: '11타임 이상', 연차: '자유롭게 사용 가능', 식당: '보통이에요', 분위기: '나쁘지 않아요', 글: '매일 인수인계 시간이 정해져 있어요. 모르는 내용을 동료에게 물어보기 편했어요.', 쓴때: '2026-11-06T02:00:00Z', 내것: true, 닉네임: '차분한 수달', 그림: null },
    { id: 3, 기관: '견본재활병원', 별점: 5, 복지: '아직은 부족한 거 같아요', 신입교육: '아직은 부족한 거 같아요', 시설: '오래된 거 같아요', 치료타임: '5타임 이하', 연차: '한달에서 2주', 식당: '아직 부족해요', 분위기: '좋지 않은 거 같아요', 글: null, 쓴때: '2026-11-05T02:00:00Z', 내것: false, 닉네임: '다정한 곰', 그림: null },
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
