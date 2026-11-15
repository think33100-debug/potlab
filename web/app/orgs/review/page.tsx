'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { 어둠 } from '@/components/rapo/rapo-community';
import { 별줄, 후기쓴이, type 근무후기 } from '@/components/rapo/rapo-org-reviews';
import { 후기질문 } from '@/lib/work-review';
import { browserSupabase } from '@/lib/supabase-browser';

/* 근무 후기 상세 — 피그마 「근무 후기 · 상세」 1328:2703 · 「학생 / 오늘 후기 열람 완료」 1496:4464 (2026-11-15).
   전문은 DB 함수 근무후기보기() 로만 받습니다 — 학생·취준생이면 함수가 오늘 본 후기를 세고, 서로 다른 후기 3개가 넘으면 막습니다
   (같은 후기를 다시 보면 안 줄어듦 · 한국 시간 자정에 다시 3개 · 금고 SQL_1113/ZO · 세중님 허락 DEFINER). */

const 하루 = 3;
type 받음 = 근무후기 & { 학생?: boolean; 오늘?: number | null; 막힘?: boolean; 없음?: boolean };

function Body() {
  const id = Number(useSearchParams().get('id'));
  const { session } = useAuth();
  const [h, setH] = useState<받음 | undefined>(undefined);

  useEffect(() => {
    if (!session || !id) return;
    browserSupabase().rpc('근무후기보기', { p_id: id }).then(({ data, error }) => {
      setH(error ? { 없음: true } as 받음 : (data as 받음));
    });
  }, [session, id]);

  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col" style={{ background: 어둠.바탕 }}>
      <header className="sticky top-0 z-20 flex h-[56px] items-center gap-[4px] px-[8px]" style={{ background: 어둠.아래탐색 }}>
        <button type="button" onClick={() => history.back()} aria-label="뒤로" className="flex size-[44px] items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4l-6 6 6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="text-[18px] font-bold leading-[26px]" style={{ color: 어둠.글 }}>근무 후기</p>
      </header>

      <main className="flex flex-1 flex-col gap-[16px] px-[22px] pb-[24px] pt-[28px]">
        {h === undefined ? (
          <p role="status" className="text-[15px]" style={{ color: 어둠.흐린글 }}>불러오는 중…</p>
        ) : h.막힘 ? (
          <section className="flex flex-col gap-[16px] pt-[80px]">
            <h1 className="text-[24px] font-bold leading-[34px]" style={{ color: 어둠.글 }}>오늘의 후기를 모두 읽었어요</h1>
            <p className="break-keep text-[15px] leading-[23px]" style={{ color: 어둠.흐린글 }}>
              학생·취준생은 하루에 서로 다른 후기 {하루}개를 볼 수 있어요. 오늘 읽은 후기는 다시 볼 수 있어요.
            </p>
            <Link href="/community" className="mt-[24px] flex items-center gap-[8px] text-[15px] font-bold" style={{ color: '#ffa691' }}>커뮤니티로 ›</Link>
          </section>
        ) : h.없음 ? (
          <p className="text-[15px]" style={{ color: 어둠.흐린글 }}>후기를 찾지 못했어요. 지워졌거나 숨겨졌을 수 있어요.</p>
        ) : (
          <>
            <div className="flex items-start gap-[8px]">
              <h1 className="min-w-0 flex-1 break-keep text-[24px] font-bold leading-[34px]" style={{ color: 어둠.글 }}>{h.기관}</h1>
              {h.내것 && (
                <Link href={`/orgs/review/write?org=${encodeURIComponent(h.기관)}`} className="mt-[6px] shrink-0 whitespace-nowrap text-[14px] font-bold" style={{ color: 어둠.글 }}>내 후기 관리 ›</Link>
              )}
            </div>
            {h.학생 && h.오늘 != null && (
              <p className="break-keep rounded-[8px] px-[12px] py-[10px] text-[13px] leading-[19px]" style={{ background: 어둠.면, color: 어둠.흐린글 }}>
                학생·취준생 · 오늘 {h.오늘}/{하루}개 열람 · 같은 후기를 다시 읽어도 횟수는 줄지 않아요.
              </p>
            )}
            <section className="flex flex-col gap-[12px] rounded-[16px] p-[16px]" style={{ background: 어둠.면 }}>
              <후기쓴이 h={h} />
              <p className="flex items-center gap-[8px] text-[15px] font-bold" style={{ color: '#ffa691' }} aria-label={`별점 ${h.별점}점`}>
                <별줄 n={h.별점} 크기={18} />{h.별점}점
              </p>
              {h.글 && <p className="whitespace-pre-wrap break-keep text-[15px] leading-[23px]" style={{ color: 어둠.글 }}>{h.글}</p>}
            </section>
            <section className="flex flex-col gap-[10px] rounded-[16px] p-[16px]" style={{ background: 어둠.면 }}>
              <h2 className="text-[17px] font-bold leading-[24px]" style={{ color: 어둠.글 }}>작성자의 근무 환경 평가</h2>
              {후기질문.map((q) => (
                <p key={q.칸} className="flex gap-[16px] text-[14px] leading-[20px]">
                  <span className="w-[92px] shrink-0 break-keep" style={{ color: 어둠.흐린글 }}>{q.짧게}</span>
                  <span className="min-w-0 break-keep font-bold" style={{ color: 어둠.글 }}>{h[q.칸] ?? '—'}</span>
                </p>
              ))}
            </section>
            <div className="flex-1" />
            <Link href={`/orgs?org=${encodeURIComponent(h.기관)}&tab=talk`} className="flex h-[48px] items-center justify-center rounded-[12px] text-[16px] font-bold"
              style={{ background: 어둠.쓰기, color: '#fff' }}>
              이 병원 자유토론 보기
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

export default function ReviewDetail() {
  return <Suspense><Body /></Suspense>;
}
