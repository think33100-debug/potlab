import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { 어둠 } from '@/components/rapo/rapo-community';

/* 커뮤니티로 넘어가는 동안 — 어두운 판 · 제목 · 글 자리 뼈대 · 하단 탐색 (2026-11-11 밤 · Next loading.js) */
export default function CommunityLoading() {
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <div className="flex h-[56px] items-center px-[22px]">
        <p className="text-[21px] font-bold leading-[30px]" style={{ color: 어둠.글 }}>커뮤니티</p>
      </div>
      <div role="status" aria-label="글을 불러오는 중" className="flex flex-col gap-[24px] px-[22px] pt-[24px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-[10px]">
            <div className="h-[32px] w-[140px] rounded-[8px]" style={{ background: 어둠.면 }} />
            <div className="h-[24px] w-[80%] rounded-[8px]" style={{ background: 어둠.면 }} />
            <div className="h-[48px] w-full rounded-[8px]" style={{ background: 어둠.면 }} />
          </div>
        ))}
      </div>
      <RapoBottomNav current="/community" dark />
    </div>
  );
}
