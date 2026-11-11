import { AdminJobTools } from '@/components/admin-job-tools';
import { Hit } from '@/components/hit';
import { JobOpenLink } from '@/components/job-open-link';
import { JobSave, RapoSaveBar } from '@/components/job-save';
import { JobVeil } from '@/components/job-veil';
import { LoginFirst } from '@/components/login-first';
import { ShareButtons } from '@/components/share-buttons';
import type { Who } from '@/lib/supabase-server';
import {
  RapoDetailHeader, RapoDetailIdentity, RapoDetailSection, RapoGuideRow, RapoInstitution, RapoKeyRow,
  RapoPayCard, RapoPeriodCard, RapoSectionGap, RapoStickyActions, 지원단추꼴, 잠긴단추꼴, type 모집상태,
} from './rapo-job-detail';
import { RapoJobRow, type RapoJob } from './rapo-job-row';
import { RapoButton, RapoDivider } from './rapo-ui';

/* 공고 상세 한 화면을 **값만 받아** 그립니다 (2026-11-11).
   실제 공고(app/jobs/[id]/page.tsx)와 디자인 견본(app/design-preview/job)이 같이 씁니다 —
   값 고르기(공고문 확인 · 내규에 따름 · 채용시까지 …)는 page.tsx 한 자리, 여기는 그리기만.
   id 가 없으면 견본입니다 — 조회 기록·저장·담당자 도구를 그리지 않습니다. */

export const 못읽은칸말 = '공고문 확인';

export type RapoJobDetailProps = {
  id: string | null;
  who: Who;
  closed: boolean;
  shareTitle: string;
  identity: { org: string; orgArt: string; 상태: 모집상태; title: string; tags: string[]; views: number | null; 인원: string; 마감: string };
  pay: { 값: string; 덧말: string | null };
  지원자격: string | null;
  url: string | null;
  기간: { 달: string | null; 날: string | null; 기간: string; 강조: string | null; 덧말: string | null };
  접수방법: { 낱말: string[]; 채용페이지: string | null };
  모집인원없음: boolean;
  기관: string;
  주소: string | null;
  비슷한: RapoJob[];
  비슷한제목말: string | undefined;
  비슷한주소: string;
  지원주소: string | null;
};

export function RapoJobDetailView(p: RapoJobDetailProps) {
  const member = p.who === '회원';

  const 본문 = (
    <>
      {/* 03 핵심 조건 — 보수 · 필수 자격 (근무시간 줄은 대표 결정으로 뺌) */}
      <section className="flex flex-col gap-(--rapo-dimension-x5) p-(--rapo-dimension-x5)">
        {p.who !== '모름' && <RapoPayCard 잠김={!member} 값={p.pay.값} 덧말={p.pay.덧말} />}
        <RapoKeyRow icon="/rapo/detail/file-text-20.svg" label="필수 자격">
          {!member ? (
            <p className="rapo-type-t5-bold">로그인 후 볼 수 있어요</p>
          ) : p.지원자격 ? (
            <p className={`${p.지원자격.length > 40 ? 'rapo-type-article-body' : 'rapo-type-t5-bold'} whitespace-pre-wrap break-keep [overflow-wrap:anywhere]`}>
              {p.지원자격}
            </p>
          ) : (
            <원문칸 url={p.url} />
          )}
        </RapoKeyRow>
      </section>

      <RapoSectionGap />

      {/* 07 지원 방법 */}
      <RapoDetailSection title="지원 방법">
        <RapoPeriodCard {...p.기간} />
        {member && (p.접수방법.낱말.length > 0 || p.모집인원없음) && (
          <div className="flex flex-col gap-(--rapo-dimension-x3)">
            {p.접수방법.낱말.length > 0 && (
              <RapoGuideRow label="접수 방법">
                {p.접수방법.낱말.join(' · ')}
                {p.접수방법.채용페이지 && (
                  <> · <a href={p.접수방법.채용페이지} target="_blank" rel="noopener noreferrer"
                    className="underline decoration-(--rapo-color-stroke-neutral-weak) underline-offset-2">병원 채용 페이지</a></>
                )}
              </RapoGuideRow>
            )}
            {p.모집인원없음 && <RapoGuideRow label="모집인원"><원문칸 url={p.url} /></RapoGuideRow>}
          </div>
        )}
        <RapoDivider />
        <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
          기관이 올린 공고를 모아 옮긴 것이에요. 마감일·인원은 바뀔 수 있으니 지원 전에 원문을 한 번 봐 주세요.
        </p>
        {member ? (
          /* 원문은 바깥 사이트라 새 창으로 엽니다 (RapoButton 은 안쪽 길용) — 꼴은 Outline 52 그대로 */
          p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer"
               className="rapo-type-t6-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r3)
                          border border-(--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral)
                          active:bg-(--rapo-color-bg-transparent-pressed)">
              공고 원문 보기
            </a>
          )
        ) : p.who === '비회원' ? (
          <LoginFirst className="rapo-type-t6-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r3)
                                 border border-(--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral)">
            로그인하고 원문 보기
          </LoginFirst>
        ) : null}
      </RapoDetailSection>
    </>
  );

  return (
    <div data-rapo className="mx-auto w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      {p.id && <Hit kind="job" target={p.id} />}
      <RapoDetailHeader share={
        <ShareButtons look="rapo" title={p.shareTitle} text={p.identity.title} path={p.id ? `/jobs/${p.id}` : '/jobs'} />
      } />

      <main>
        <RapoDetailIdentity {...p.identity} />

        {/* 가입을 덜 마친 회원만 흐립니다. 비회원은 DB 가 본문을 안 주므로 덮을 것이 없습니다 */}
        {member && p.id ? <JobVeil>{본문}</JobVeil> : 본문}

        <RapoSectionGap />
        <RapoInstitution org={p.기관} 주소={p.주소} />

        {/* 비슷한 공고 — 회원만 줄이 옵니다. 비회원은 「전체 공고 둘러보기」만 */}
        <RapoSectionGap />
        <RapoDetailSection title="비슷한 공고" sub={p.비슷한제목말}>
          {p.비슷한.length > 0 && (
            <ul className="flex flex-col">
              {p.비슷한.map((r, i) => (
                <li key={r.id ?? i}>
                  {i > 0 && <RapoDivider />}
                  <RapoJobRow job={r} variant="list" />
                </li>
              ))}
            </ul>
          )}
          <RapoButton href={p.비슷한주소} tone="outline" full>전체 공고 둘러보기</RapoButton>
        </RapoDetailSection>

        {p.id && <div className="px-(--rapo-dimension-x5)"><AdminJobTools id={p.id} /></div>}
      </main>

      {/* 마지막 줄이 고정 행동(112 + 안전 여백, 마감이면 안내 한 줄 더)에 가리지 않게 */}
      <div aria-hidden style={{ height: `calc(${p.closed ? 172 : 112}px + env(safe-area-inset-bottom))` }} />

      <RapoStickyActions
        안내={p.closed ? '모집이 종료됐어요. 원문과 공유는 이용할 수 있어요.' : null}
        저장={p.id ? <JobSave id={p.id} look="rapo-bar" 마감={p.closed} /> : <RapoSaveBar on={false} busy={false} disabled />}
        지원={p.closed ? (
          <button type="button" disabled className={잠긴단추꼴}>모집 마감</button>
        ) : p.who === '모름' ? null : (p.지원주소 || !member) ? (
          /* 비회원은 창구가 주소를 안 주므로 JobOpenLink 가 「로그인하고 지원하러 가기」를 그립니다 */
          <JobOpenLink id={p.id ?? ''} url={p.지원주소} className={지원단추꼴}>지원하러 가기</JobOpenLink>
        ) : (
          /* 회원인데 갈 주소가 아무것도 없음 — 원문 공고문으로 확인해 달라는 잠금 */
          <button type="button" disabled className={잠긴단추꼴}>지원 방법 공고문 확인</button>
        )}
      />
    </div>
  );
}

/** 못 읽은 칸 — 원문 링크가 있으면 링크로, 없으면 글자만 (「공고문 확인」 꼴은 이 한 자리) */
function 원문칸({ url }: { url?: string | null }) {
  if (!url) return <p className="rapo-type-t5-bold">{못읽은칸말}</p>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="rapo-type-t5-bold inline-flex items-center gap-(--rapo-dimension-x1) underline
                  decoration-(--rapo-color-stroke-neutral-weak) underline-offset-[3px]">
      {못읽은칸말}
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/detail/open-20.svg" alt="" width={16} height={16} />
    </a>
  );
}
