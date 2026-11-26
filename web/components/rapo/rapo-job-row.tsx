import Link from 'next/link';
import { JobSave, RapoSaveFace } from '@/components/job-save';
import { 기관로고 } from '@/lib/org-logo';
import { RapoBadge } from './rapo-ui';

/* 공고 한 줄 — 홈과 공고 목록이 같이 씁니다 (2026-11-11).

     home  「RAPO / Home / 공고 행 · 시간과 마감 중복 제거」 749:2258
           급여 줄 → 조건 태그 → 좋아요·조회와 마감 줄
     list  「RAPO / Home / 공고 행」 453:3337 (공고 목록 U02)
           급여와 마감이 한 줄(마감은 오른쪽) → 조건 태그.
           원본의 「근무시간」 줄은 넣지 않습니다 — 수집하지 않는 값입니다 (2026-11-11 대표) */

export type RapoJob = {
  id?: string;               // 없으면 견본 — 저장 단추가 잠기고 줄이 링크가 아닙니다
  org: string;
  orgArt: '01' | '03' | '06'; // 「기관 기본 이미지」 여섯 가운데 원본에 쓰인 셋
  title: string;
  /* 급여 칸 — 값이면 그대로, 원문 확인이면 문서 아이콘과 흐린 글씨. 모르면 줄을 뺍니다 */
  pay?: { text: string; kind: 'value' | 'check' } | null;
  tags: string[];
  likes?: number | null;
  views?: number | null;     // null 이면 조회수를 못 받은 것 — 0 으로 적지 않고 뺍니다
  deadline: string;          // 화면에 쓰는 말 그대로 (lib/job-state.ts 마감배지)
  /* PC 표(폭 1040↑)의 「지역 · 직군」 칸 — 없으면 그 줄을 비웁니다 (2026-11-26) */
  지역?: string | null;
  직군?: string | null;
};

/* PC 표 — 피그마 「17 · 1 depth UI」 「공고 비교 목록」(1936:2201 · PC 1040 · 본문 800 · 2026-11-26).
   칸: 기관 · 채용 공고(남는 폭) | 지역 · 직군 94 | 급여 126 | 마감 72 | 저장 44 · 사이 16 · 줄 위아래 12 · 왼 12 · 오 8.
   피그마 마감 칸은 46 이지만 우리 마감 말(「마감일 공고문 확인」 등)이 길어 72 로 둡니다.
   1039 이하는 지금 카드 모양 그대로입니다 — 같은 줄을 CSS 격자로만 바꿔서 저장 단추는 하나입니다(저장 여부를 두 번 묻지 않게). */
export const PC표칸 = 'min-[1040px]:grid min-[1040px]:grid-cols-[minmax(0,1fr)_94px_126px_72px_44px] min-[1040px]:items-center min-[1040px]:gap-x-(--rapo-dimension-x4) min-[1040px]:pl-(--rapo-dimension-x3) min-[1040px]:pr-(--rapo-dimension-x2)';
const PC작은글 = 'min-[1040px]:text-(length:--rapo-font-size-t3) min-[1040px]:leading-(--rapo-line-height-t3)';

/* PC 표 머리 — 회색 바탕 · 아래 선 · 위아래 8. 1039 이하에서는 안 보입니다 */
export function RapoJobTableHead() {
  const 칸 = 'rapo-type-t3-regular whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)';
  return (
    <div aria-hidden className={`hidden border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-neutral-weak) py-(--rapo-dimension-x2) ${PC표칸}`}>
      <span className={칸}>기관 · 채용 공고</span>
      <span className={칸}>지역 · 직군</span>
      <span className={칸}>급여</span>
      <span className={칸}>마감</span>
      <span className={`${칸} justify-self-end`}>저장</span>
    </div>
  );
}

export function RapoJobRow({ job, variant }: { job: RapoJob; variant: 'home' | 'list' }) {
  const 로고 = 기관로고(job.org);   // 공통 로고(보건소·치매센터)가 있으면 기본 그림 대신 (2026-11-13)
  const 제목 = (
    <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">{job.title}</span>
  );
  return (
    <article className={'flex flex-col gap-(--rapo-dimension-x2) ' + (variant === 'list' ? 'pb-(--rapo-dimension-x4) ' : '')
      + `${PC표칸} min-[1040px]:gap-y-(--rapo-dimension-x1) min-[1040px]:border-b-(length:--rapo-border-default) min-[1040px]:border-(color:--rapo-color-stroke-neutral-weak) min-[1040px]:py-(--rapo-dimension-x3)`}>
      <div className="flex flex-col gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x2) min-[1040px]:contents">
        <div className="flex items-center gap-(--rapo-dimension-x2_5) min-[1040px]:contents">
          <span className="flex size-(--rapo-dimension-x8) shrink-0 items-center justify-center rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak) min-[1040px]:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 · 로고는 우리 주소(/api/org-logo) */}
            <img src={로고 ?? `/rapo/home/org-${job.orgArt}.svg`} alt="" width={32} height={32} className={로고 ? 'size-6 object-contain' : undefined} />
          </span>
          <p className={`rapo-type-t4-medium min-w-0 flex-1 truncate text-(color:--rapo-color-fg-neutral-muted) min-[1040px]:col-start-1 min-[1040px]:row-start-1 min-[1040px]:font-normal ${PC작은글}`}>{job.org}</p>
          <span className="flex shrink-0 min-[1040px]:col-start-5 min-[1040px]:row-span-2 min-[1040px]:row-start-1 min-[1040px]:justify-self-end">
            {job.id ? <JobSave id={job.id} look="rapo" /> : <RapoSaveFace />}
          </span>
        </div>

        <h3 className="break-keep min-[1040px]:col-start-1 min-[1040px]:row-start-2 min-[1040px]:[&_span]:text-(length:--rapo-font-size-t5) min-[1040px]:[&_span]:leading-(--rapo-line-height-t5)">
          {job.id
            ? <Link href={`/jobs/${job.id}`} className="block rounded-(--rapo-radius-r1) active:bg-(--rapo-color-bg-transparent-pressed)">{제목}</Link>
            : 제목}
        </h3>

        {variant === 'list' ? (
          /* 원본 「급여와 마감」 — 급여(왼쪽) · 마감 t2 Regular(오른쪽) · 사이 4 */
          <div className="flex items-end gap-(--rapo-dimension-x1) min-[1040px]:hidden">
            <div className="min-w-0 flex-1">{job.pay && <급여 pay={job.pay} />}</div>
            <p className="rapo-type-t2-regular shrink-0 text-right text-(color:--rapo-color-fg-neutral-muted)">{job.deadline}</p>
          </div>
        ) : job.pay && <div className="min-[1040px]:hidden"><급여 pay={job.pay} /></div>}


        {job.tags.length > 0 && (
          <ul aria-label="조건" className="flex flex-wrap gap-(--rapo-dimension-x2) min-[1040px]:hidden">
            {job.tags.map((t) => <li key={t} className="flex"><RapoBadge>{t}</RapoBadge></li>)}
          </ul>
        )}
      </div>

      {/* 좋아요·조회 13/20 Medium · 마감 12/20 Regular — 원본에 글자 스타일이 없는 값입니다(원본확인 B) */}
      {/* PC 표 칸 셋 — 지역·직군 · 급여(+조회) · 마감. 1039 이하에서는 안 보입니다.
          목록 창구는 급여를 안 줘서(pay 없음) 「상세에서 확인」으로 적습니다 */}
      <div className={`hidden flex-col gap-[3px] text-(color:--rapo-color-fg-neutral-muted) min-[1040px]:col-start-2 min-[1040px]:row-span-2 min-[1040px]:row-start-1 min-[1040px]:flex ${PC작은글}`}>
        {job.지역 && <span className="truncate">{job.지역}</span>}
        {job.직군 && <span className="break-keep">{job.직군}</span>}
      </div>
      <div className={`hidden flex-col gap-[3px] text-(color:--rapo-color-fg-neutral-muted) min-[1040px]:col-start-3 min-[1040px]:row-span-2 min-[1040px]:row-start-1 min-[1040px]:flex ${PC작은글}`}>
        <span className={'break-keep ' + (job.pay?.kind === 'value' ? 'text-(color:--rapo-color-fg-neutral)' : '')}>{job.pay ? job.pay.text : '상세에서 확인'}</span>
        {job.views != null && <span>조회 {job.views}</span>}
      </div>
      <p className={`hidden break-keep text-(color:--rapo-color-fg-neutral-muted) min-[1040px]:col-start-4 min-[1040px]:row-span-2 min-[1040px]:row-start-1 min-[1040px]:block ${PC작은글}`}>{job.deadline}</p>

      {variant === 'home' && <div className="flex min-h-(--rapo-dimension-x6) items-center justify-between gap-(--rapo-dimension-x3) min-[1040px]:hidden">
        <div className="flex gap-(--rapo-dimension-x3)">
          {job.likes != null && (
            <span className="flex items-center gap-(--rapo-dimension-x1) text-[13px] font-medium leading-[20px] text-(color:--rapo-color-fg-neutral-muted)">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src="/rapo/home/icon-heart.svg" alt="" width={16} height={16} />
              좋아요 {job.likes}
            </span>
          )}
          {job.views != null && (
            <span className="flex items-center gap-(--rapo-dimension-x1) text-[13px] font-medium leading-[20px] text-(color:--rapo-color-fg-neutral-muted)">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src="/rapo/home/icon-eye.svg" alt="" width={16} height={16} />
              조회 {job.views}
            </span>
          )}
        </div>
        <p className="whitespace-nowrap text-[12px] leading-[20px] text-(color:--rapo-color-fg-neutral-muted)">{job.deadline}</p>
      </div>}
    </article>
  );
}

/* 급여 칸 — 값이면 t5 Medium, 원문 확인이면 문서 아이콘 + t4 Medium 흐린 글씨 */
function 급여({ pay }: { pay: NonNullable<RapoJob['pay']> }) {
  return (
    <div className="flex items-center gap-(--rapo-dimension-x1_5)">
      {pay.kind === 'check' && (
        <span className="flex size-(--rapo-dimension-x4) shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 (16 틀 안 9.4×13.4) */}
          <img src="/rapo/home/icon-doc.svg" alt="" width={9.4} height={13.4} />
        </span>
      )}
      <p className={
        'min-w-0 flex-1 ' + (pay.kind === 'check'
          ? 'rapo-type-t4-medium text-(color:--rapo-color-fg-neutral-muted)'
          : 'rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)')
      }>
        {pay.text}
      </p>
    </div>
  );
}
