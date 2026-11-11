import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoJobFilters, RapoJobSearch } from '@/components/rapo/rapo-job-filters';
import { RapoJobGuestWall } from '@/components/rapo/rapo-job-guest-wall';
import { 견본공고 } from '@/components/rapo/home-u01-sample';
import { 받는중, 목록, 못받음, 없음 } from '@/components/rapo/rapo-job-results';
import { RapoShell } from '@/components/rapo/rapo-shell';
import { RapoPagination } from '@/components/rapo/rapo-ui';

/* 새 디자인 공고 목록 — **디자인 견본으로** 상태를 보는 자리 (2026-11-11).
   개발 서버에서만 열립니다(배포에서는 404). 실제 목록은 app/jobs/page.tsx 입니다.
     ?state=loading · empty(조건 결과 없음) · none(전체 공고 없음) · error
     ?who=member    회원 헤더와 「내 직군: 작업치료사」 줄 */
export const metadata: Metadata = { title: 'RAPO · 공고 목록 미리보기', robots: { index: false } };

export default async function DesignPreviewJobs({ searchParams }: {
  searchParams: Promise<{ state?: string; who?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state, who } = await searchParams;
  const 회원 = who === 'member';
  const 지금 = { q: '', job: 회원 ? '작업치료사' : null, sido: null };
  const rows = 견본공고.new.map((j) => ({ ...j, id: undefined, deadline: j.deadline, likes: null, views: null }));
  const 결과 = state === 'loading' ? <받는중 />
    : state === 'error' ? <못받음 />
    /* ?state=guest — 비회원 맛보기 + 가입 권유 (숫자는 견본) */
    : state === 'guest' ? <><목록 rows={rows.slice(0, 2)} 제목="공고 280개" /><RapoJobGuestWall 남은={278} /></>
    : state === 'empty' ? <없음 조건있음 초기화주소="/design-preview/jobs" />
    : state === 'none' ? <없음 조건있음={false} 초기화주소="/design-preview/jobs" />
    : <목록 rows={rows} 제목={`공고 ${rows.length}개`}
        쪽={<RapoPagination page={0} pages={2} href={(p) => `/design-preview/jobs?p=${p}`} />} />;
  return (
    <RapoShell who={회원 ? '회원' : '비회원'} current="/jobs">
      <p className="rapo-type-t2-bold bg-(--rapo-color-bg-warning-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-warning-contrast)">
        미리보기 · 아래 공고는 디자인 원본의 견본입니다 (실제 공고 아님)
      </p>
      <section className="flex flex-col gap-(--rapo-dimension-x4) p-(--rapo-dimension-x5)">
        <h1 className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">채용 공고</h1>
        <RapoJobSearch 지금={지금} 회원={회원} />
      </section>
      <RapoJobFilters 지금={지금} 회원={회원} />
      {회원 && (
        <div className="flex items-center gap-(--rapo-dimension-x2) px-(--rapo-dimension-x5)">
          <p className="rapo-type-t4-medium min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">내 직군: 작업치료사</p>
          <span className="rapo-type-t2-medium flex h-(--rapo-touch-min) w-(--rapo-dimension-x16) items-center justify-end text-(color:--rapo-color-fg-neutral-muted)">초기화</span>
        </div>
      )}
      <div aria-hidden className="h-(--rapo-dimension-x1_5) bg-(--rapo-color-bg-neutral-weak)" />
      {결과}
    </RapoShell>
  );
}
