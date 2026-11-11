import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoCommunityPost, RapoCommunityTop, RapoCommunityWrite, 어둠, type 커뮤니티글 } from '@/components/rapo/rapo-community';

/* 커뮤니티 피드 — **견본**(Figma 1328:2659 의 글 그대로 · 실제 글 아님). 개발 서버에서만 열립니다 */
export const metadata: Metadata = { title: 'RAPO · 커뮤니티 미리보기', robots: { index: false } };

const 지금 = Date.now();
const 견본: 커뮤니티글[] = [
  { id: 1, title: '푸른재활병원 첫 출근, 교육은 어떻게 진행되나요?', created_at: new Date(지금 - 3 * 60e3).toISOString(), comment_count: 2,
    body: '첫 직장이라 교육 일정과 준비물이 궁금해요. 첫날부터 바로 환자를 보게 되는지, 선생님을 따라다니며 배울 시간이 있는지도 알고 싶어요.',
    글쓴이: { nickname: '다정한 곰', avatar: '🐨|#FDE68A', erased_at: null }, job_group: '작업치료사',
    댓글: { 글쓴이: { nickname: '차분한 수달', avatar: '🦦|#BFDBFE', erased_at: null }, body: '저는 첫날 선생님 따라다니면서 배웠어요.' } },
  { id: 2, title: '점심시간에 차팅하는 곳, 다들 어떻게 하고 계세요?', created_at: new Date(지금 - 10 * 60e3).toISOString(), comment_count: 2,
    body: '밥 먹고 남은 시간에 기록하라는데 고민이에요. 오후 첫 타임 전에 끝내려면 점심을 급하게 먹게 되더라고요. 다른 곳은 차팅 시간을 따로 주나요?',
    글쓴이: { nickname: '오후한시', avatar: '🐰|#FBCFE8', erased_at: null }, job_group: '물리치료사',
    댓글: { 글쓴이: { nickname: '씩씩한 여우', avatar: '🦊|#FED7AA', erased_at: null }, body: '저희도 점심 먹고 바로 올라가요.' } },
];

export default function DesignPreviewCommunity() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <RapoCommunityTop 탭="전체" 정렬="new" 주소={() => '/design-preview/community'} />
      <main className="mt-[6px]">{견본.map((p) => <RapoCommunityPost key={p.id} p={p} />)}</main>
      <div aria-hidden style={{ height: 'calc(72px + 68px + env(safe-area-inset-bottom))' }} />
      <RapoCommunityWrite href="/design-preview/community" />
      <RapoBottomNav current="/community" dark />
    </div>
  );
}
