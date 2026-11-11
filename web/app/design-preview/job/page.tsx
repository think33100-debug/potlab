import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RapoJobDetailView } from '@/components/rapo/rapo-job-detail-view';

/* 새 디자인 공고 상세 — **디자인 견본으로** 상태를 보는 자리 (2026-11-11).
   개발 서버에서만 열립니다(배포에서는 404). 실제 상세는 app/jobs/[id]/page.tsx 입니다.
   값은 Figma 「U03 · 공고 상세 · 최종 전체 화면」 983:22146 의 견본 글 그대로입니다 (실제 공고 아님).
     ?who=member    회원 (기본은 비회원 · 원본 795:16114)
     ?state=closed  모집 마감 (원본 D-03 605:10901)
     ?state=nodate  마감일을 못 읽은 공고 (원본 D-04 「확인 필요」) */
export const metadata: Metadata = { title: 'RAPO · 공고 상세 미리보기', robots: { index: false } };

export default async function DesignPreviewJob({ searchParams }: {
  searchParams: Promise<{ who?: string; state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { who, state } = await searchParams;
  const closed = state === 'closed';
  const nodate = state === 'nodate';
  return (
    <>
      <p className="rapo-type-t2-bold mx-auto max-w-3xl bg-(--rapo-color-bg-warning-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-warning-contrast)">
        미리보기 · 디자인 원본의 견본 공고입니다 (실제 공고 아님)
      </p>
      <RapoJobDetailView
        id={null} who={who === 'member' ? '회원' : '비회원'} closed={closed}
        shareTitle="국립재활원 작업치료사 채용"
        identity={{
          org: '국립재활원', orgArt: '01', 상태: closed ? '모집 마감' : nodate ? '확인 필요' : '접수 중',
          title: '작업치료사 채용', tags: ['기간제', '휴직대체'], views: 318, 인원: '2명',
          마감: nodate ? '마감일 공고문 확인' : '10.30(금)',
        }}
        pay={{ 값: '2,458,000원', 덧말: '2026년 기준 · 원천징수 전 · 제수당 포함\n초과근무수당·명절휴가비 별도' }}
        지원자격="작업치료사 면허" url="https://example.com/"
        기간={nodate
          ? { 달: null, 날: null, 기간: '마감일 공고문 확인', 강조: null, 덧말: '접수 기간을 아직 확인하지 못했어요. 원문 공고에서 꼭 확인해 주세요.' }
          : { 달: '10월', 날: '30', 기간: '10.26(월)–10.30(금)', 강조: closed ? null : '10.30(금) 17:30 마감', 덧말: null }}
        접수방법={{ 낱말: ['방문', '등기우편'], 채용페이지: null }} 모집인원없음={false}
        기관="국립재활원" 주소="서울 강북구 삼각산로 58"
        비슷한={[{
          id: undefined, org: '라포재활병원', orgArt: '03', title: '성인 재활 작업치료사 모집',
          pay: null, tags: ['서울 마포', '정규직', '작업치료사'], deadline: '11.15 마감',
        }]}
        비슷한제목말="작업치료사 · 서울" 비슷한주소="/design-preview/jobs"
        지원주소="https://example.com/"
      />
    </>
  );
}
