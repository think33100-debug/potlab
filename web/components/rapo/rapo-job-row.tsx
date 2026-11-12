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
};

export function RapoJobRow({ job, variant }: { job: RapoJob; variant: 'home' | 'list' }) {
  const 로고 = 기관로고(job.org);   // 공통 로고(보건소·치매센터)가 있으면 기본 그림 대신 (2026-11-13)
  const 제목 = (
    <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">{job.title}</span>
  );
  return (
    <article className={'flex flex-col gap-(--rapo-dimension-x2) ' + (variant === 'list' ? 'pb-(--rapo-dimension-x4)' : '')}>
      <div className="flex flex-col gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x2)">
        <div className="flex items-center gap-(--rapo-dimension-x2_5)">
          <span className="flex size-(--rapo-dimension-x8) shrink-0 items-center justify-center rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 · 로고는 우리 주소(/api/org-logo) */}
            <img src={로고 ?? `/rapo/home/org-${job.orgArt}.svg`} alt="" width={32} height={32} className={로고 ? 'size-6 object-contain' : undefined} />
          </span>
          <p className="rapo-type-t4-medium min-w-0 flex-1 truncate text-(color:--rapo-color-fg-neutral-muted)">{job.org}</p>
          {job.id ? <JobSave id={job.id} look="rapo" /> : <RapoSaveFace />}
        </div>

        <h3 className="break-keep">
          {job.id
            ? <Link href={`/jobs/${job.id}`} className="block rounded-(--rapo-radius-r1) active:bg-(--rapo-color-bg-transparent-pressed)">{제목}</Link>
            : 제목}
        </h3>

        {variant === 'list' ? (
          /* 원본 「급여와 마감」 — 급여(왼쪽) · 마감 t2 Regular(오른쪽) · 사이 4 */
          <div className="flex items-end gap-(--rapo-dimension-x1)">
            <div className="min-w-0 flex-1">{job.pay && <급여 pay={job.pay} />}</div>
            <p className="rapo-type-t2-regular shrink-0 text-right text-(color:--rapo-color-fg-neutral-muted)">{job.deadline}</p>
          </div>
        ) : job.pay && <급여 pay={job.pay} />}


        {job.tags.length > 0 && (
          <ul aria-label="조건" className="flex flex-wrap gap-(--rapo-dimension-x2)">
            {job.tags.map((t) => <li key={t} className="flex"><RapoBadge>{t}</RapoBadge></li>)}
          </ul>
        )}
      </div>

      {/* 좋아요·조회 13/20 Medium · 마감 12/20 Regular — 원본에 글자 스타일이 없는 값입니다(원본확인 B) */}
      {variant === 'home' && <div className="flex min-h-(--rapo-dimension-x6) items-center justify-between gap-(--rapo-dimension-x3)">
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
