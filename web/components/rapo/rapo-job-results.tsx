import type { ReactNode } from 'react';
import { RapoJobRow, type RapoJob } from './rapo-job-row';
import { RapoRetryButton } from './rapo-retry';
import { RapoButton, RapoDivider, RapoSkeleton, RapoStatusPanel } from './rapo-ui';

/* 공고 목록의 결과 칸 — 줄 있음 · 받는 중 · 없음(조건/전체) · 못 받음 (2026-11-11).
   app/jobs/page.tsx 와 미리보기(app/design-preview/jobs)가 같이 씁니다. */

/* ── 결과 칸 (03 공고 결과) ──────────────────────────────────── */
export function 결과칸({ 제목, children, busy }: { 제목: string; children: ReactNode; busy?: boolean }) {
  return (
    <section aria-labelledby="rapo-jobs-result" aria-busy={busy || undefined}
      className="flex flex-col gap-(--rapo-dimension-x4) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)">
      <h2 id="rapo-jobs-result" className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">{제목}</h2>
      {children}
    </section>
  );
}

/* 불러오는 중 · RAPO / List / Loading results 510:334 — 카드 셋 · 높이 180 · 막대 넷 */
export function 받는중() {
  return (
    <결과칸 제목="공고 불러오는 중" busy>
      <p className="sr-only" role="status">공고를 불러오는 중이에요</p>
      <ul aria-hidden className="flex flex-col gap-(--rapo-dimension-x4)">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex h-[180px] flex-col justify-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3)
                                 bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
            <RapoSkeleton className="h-[14px] w-[120px] max-w-full" />
            <RapoSkeleton className="h-[20px] w-[270px] max-w-full" />
            <RapoSkeleton className="h-[14px] w-[220px] max-w-full" />
            <RapoSkeleton className="h-[12px] w-[170px] max-w-full" />
          </li>
        ))}
      </ul>
    </결과칸>
  );
}


export function 목록({ rows, 제목, 쪽 }: { rows: RapoJob[]; 제목: string; 쪽?: ReactNode }) {
  return (
    <결과칸 제목={제목}>
      <ul className="flex flex-col">
        {rows.map((j, i) => (
          <li key={j.id ?? `${j.org}-${j.title}-${i}`}>
            {i > 0 && <RapoDivider />}
            <RapoJobRow job={j} variant="list" />
          </li>
        ))}
      </ul>
      {쪽}
    </결과칸>
  );
}

/* 조건 결과 없음 509:4911 · 전체 공고 없음 509:5024 */
export function 없음({ 조건있음, 초기화주소 }: { 조건있음: boolean; 초기화주소: string }) {
  return (
    <결과칸 제목="공고 0개">
      {조건있음 ? (
        <RapoStatusPanel role="status" icon="jobs" title="조건에 맞는 공고가 없어요" text="조건을 바꾸거나 초기화해 보세요."
          action={<RapoButton href={초기화주소} full>조건 초기화</RapoButton>} />
      ) : (
        <RapoStatusPanel role="status" icon="jobs" title="지금 등록된 공고가 없어요" text="새 공고가 올라오면 이곳에서 확인할 수 있어요."
          action={<RapoRetryButton>다시 불러오기</RapoRetryButton>} />
      )}
    </결과칸>
  );
}

/* 조건 조회 오류 509:5135 — 같은 조건으로 이 칸만 다시 받습니다 */
export function 못받음() {
  return (
    <결과칸 제목="조회 오류">
      <RapoStatusPanel role="alert" icon="error" title="공고를 불러오지 못했어요" text="같은 조건으로 다시 불러와 주세요."
        action={<RapoRetryButton>다시 불러오기</RapoRetryButton>} />
    </결과칸>
  );
}
