import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoAppBar } from '@/components/rapo/rapo-me';
import { RapoMeMenu } from '@/components/rapo/rapo-me-menu';

/* 내 정보 — **견본**(가짜 회원 · 실제 값 아님). 개발 서버에서만. ?manager=1 이면 담당자 메뉴까지 · ?role=학생 이면 학생·취준생 메뉴(취업 스펙 비교) */
export const metadata: Metadata = { title: 'RAPO · 내 정보 미리보기', robots: { index: false } };

export default async function DesignPreviewMe({ searchParams }: { searchParams: Promise<{ manager?: string; role?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const m = q.manager === '1';
  const role = q.role === '학생' ? '학생' : '현직';
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      {/* 실제 /me 의 RapoMeFrame(nav) 과 같은 꼴 — PC(1040↑)는 앱 바 대신 왼쪽 큰 제목 */}
      <div data-rapo-mobile-header><RapoAppBar title="내 정보" /></div>
      <main className="px-(--rapo-dimension-x6) pb-(--rapo-dimension-x8)">
        <p aria-hidden className="rapo-type-t9-bold hidden pb-(--rapo-dimension-x4) pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral) min-[1040px]:block">내 정보</p>
        <RapoMeMenu me={{ avatar: '🦦|#FED7AA', nickname: '차분한 수달', job_group: '작업치료사', role }}
          관리={{ 채용관리: m, 교육관리: m }} 운영진={false} />
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/me" />
    </div>
  );
}
