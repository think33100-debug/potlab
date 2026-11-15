'use client';

import Link from 'next/link';
import { RapoAppBar } from './rapo-me';
import { RapoButton } from './rapo-ui';

/* 회원 탈퇴 화면의 틀과 완료 화면 (app/me/leave · 미리보기 /design-preview/leave 가 같이 씁니다).
   피그마 「12 · 내 정보」 탈퇴 완료 1508:2517 — 남는 것 문구는 실제 동작대로(질문함 Q95) */

export function RapoLeaveDone({ onHome }: { onHome: () => void }) {
  return (
    <RapoLeaveFrame title="탈퇴 완료" 아래={<RapoButton full onClick={onHome}>공고·교육 둘러보기</RapoButton>}>
      <section className="flex flex-col items-center pt-[72px] text-center">
        <span aria-hidden className="flex size-[72px] items-center justify-center rounded-(--rapo-radius-full) bg-(--rapo-color-bg-positive-weak)">
          <svg width="34" height="26" viewBox="0 0 34 26" fill="none"><path d="M3 13l10 10L31 3" stroke="var(--rapo-color-fg-positive)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h2 className="rapo-type-t9-bold mt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral)">탈퇴가 완료됐어요</h2>
        <p className="rapo-type-t4-regular mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral-muted)">
          <span className="block">계정과 프로필 정보가 삭제됐어요.</span>
          <span className="block">이용해 주셔서 감사합니다.</span>
        </p>
      </section>
      <div className="mt-[96px] flex flex-col gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-neutral)">가입·탈퇴 기록과 30일 동안 잠가 두는 원래 닉네임만 남아 있어요.</p>
        <Link href="/contact" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-positive)">남은 데이터 삭제 요청하기 ›</Link>
      </div>
    </RapoLeaveFrame>
  );
}

export function RapoLeaveFrame({ title, back, 아래, children }: { title: string; back?: string; 아래?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title={title} back={back} />
      <main className="flex-1 px-(--rapo-dimension-x6) pb-(--rapo-dimension-x6)">{children}</main>
      {아래 && (
        <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x6) pt-(--rapo-dimension-x3) pb-[calc(var(--rapo-dimension-x4)+env(safe-area-inset-bottom))]">
          {아래}
        </div>
      )}
    </div>
  );
}
