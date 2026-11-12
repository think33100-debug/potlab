import { AdminJobTools } from '@/components/admin-job-tools';
import { Hit } from '@/components/hit';
import { JobOpenLink } from '@/components/job-open-link';
import { JobSave, RapoSaveBar } from '@/components/job-save';
import { JobVeil } from '@/components/job-veil';
import { LoginFirst } from '@/components/login-first';
import { ShareButtons } from '@/components/share-buttons';
import type { Who } from '@/lib/supabase-server';
import {
  RapoDetailHeader, RapoDetailIdentity, RapoDetailSection, RapoGuideRow, RapoHospitalFacts, RapoInstitution, RapoKeyRow,
  RapoPayCard, RapoPeriodCard, RapoSectionGap, RapoStickyActions, 지원단추꼴, 잠긴단추꼴, type 경쟁률줄, type 모집상태,
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
  /* 병원 한눈에 (2026-11-12) — 회원만 값이 옵니다. 없으면 칸을 안 그립니다 */
  치료사?: { pt: number | null; ot: number | null; 기준: string | null } | null;
  바쁨?: import('@/lib/hospital').HospitalStat | null;
  경쟁률?: 경쟁률줄[];
};

export function RapoJobDetailView(p: RapoJobDetailProps) {
  const member = p.who === '회원';
  /* ★ 2026-11-12 세중님 「다 볼 수 있게 · 경쟁률이나 보수나 다 좋은 경험을」 — 공유받은 비회원도 회원과 같은 내용을 봅니다.
     보이는 값은 DB 가 정합니다(금고 SQL_1113/N · 비회원도 회원용 허용 목록). 「모름」만 비웁니다.
     회원만 남는 것: 저장(로그인으로 보냄) · 가입 덜 마친 회원 흐림(JobVeil) · 비슷한 공고(목록 창구가 회원만) */
  const 봄 = p.who !== '모름';

  const 본문 = (
    <>
      {/* 03 핵심 조건 — 보수 · 필수 자격 (근무시간 줄은 대표 결정으로 뺌) */}
      <section className="flex flex-col gap-(--rapo-dimension-x5) p-(--rapo-dimension-x5)">
        {p.who !== '모름' && <RapoPayCard 잠김={!봄} 값={p.pay.값} 덧말={p.pay.덧말} />}
        <RapoKeyRow icon="/rapo/detail/file-text-20.svg" label="필수 자격">
          {!봄 ? (
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

      {/* 04 본문 바로가기 (원본 「04 본문 바로가기」 · 52px) — 아래 세 칸으로 내려갑니다 (2026-11-12 밤 근무) */}
      <nav aria-label="본문 바로가기" className="flex h-(--rapo-dimension-x13) items-center px-(--rapo-dimension-x5)">
        {[['#d-work', '근무조건'], ['#d-duty', '업무·자격'], ['#d-apply', '지원 방법']].map(([href, label], i) => (
          <a key={href} href={href}
            className={'rapo-type-t4-bold flex h-(--rapo-touch-min) flex-1 items-center justify-center rounded-(--rapo-radius-r1) active:bg-(--rapo-color-bg-transparent-pressed) ' +
              (i === 0 ? 'text-(color:--rapo-color-fg-brand-contrast)' : 'text-(color:--rapo-color-fg-neutral)')}>
            {label}
          </a>
        ))}
      </nav>

      <RapoSectionGap />

      {/* 05 근무조건 — 원본의 계약기간 · 가입 보험. 수집하지 않는 값이라 「공고문 확인」(못 읽은 칸 규칙 그대로).
          근무시간 줄은 대표 결정(11/11)으로 안 그립니다 */}
      <div id="d-work" className="scroll-mt-[64px]">
        <RapoDetailSection title="근무조건">
          <div className="flex flex-col gap-(--rapo-dimension-x3)">
            <RapoGuideRow label="계약기간">{봄 ? <원문칸 url={p.url} /> : '로그인 후 볼 수 있어요'}</RapoGuideRow>
            <RapoGuideRow label="가입 보험">{봄 ? <원문칸 url={p.url} /> : '로그인 후 볼 수 있어요'}</RapoGuideRow>
          </div>
        </RapoDetailSection>
      </div>

      <RapoSectionGap />

      {/* 06 업무·지원 자격 — 필수 자격은 위 03 과 같은 값. 담당 업무·근무 부서·우대는 수집하지 않아 「공고문 확인」 */}
      <div id="d-duty" className="scroll-mt-[64px]">
        <RapoDetailSection title="업무·지원 자격">
          <div className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
            <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">필수 자격</p>
            {!봄 ? <p className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">로그인 후 볼 수 있어요</p>
              : p.지원자격 ? <p className="rapo-type-t5-bold whitespace-pre-wrap break-keep text-(color:--rapo-color-fg-neutral) [overflow-wrap:anywhere]">{p.지원자격}</p>
              : <원문칸 url={p.url} />}
          </div>
          <div className="flex flex-col gap-(--rapo-dimension-x3)">
            <RapoGuideRow label="담당 업무">{봄 ? <원문칸 url={p.url} /> : '로그인 후 볼 수 있어요'}</RapoGuideRow>
            <RapoGuideRow label="근무 부서">{봄 ? <원문칸 url={p.url} /> : '로그인 후 볼 수 있어요'}</RapoGuideRow>
          </div>
        </RapoDetailSection>
      </div>

      {/* 병원 한눈에 — 예전 앱처럼 지원 자격 바로 아래 (2026-11-12 세중님 「예전 앱 위치 참고」) */}
      {(p.치료사 || p.바쁨?.band || (p.경쟁률?.length ?? 0) > 0) && (
        <>
          <RapoSectionGap />
          <RapoHospitalFacts 치료사={p.치료사 ?? null} 바쁨={p.바쁨 ?? null} 경쟁률={p.경쟁률 ?? []} />
        </>
      )}

      <RapoSectionGap />

      {/* 07 지원 방법 */}
      <div id="d-apply" className="scroll-mt-[64px]" />
      <RapoDetailSection title="지원 방법">
        <RapoPeriodCard {...p.기간} />
        {봄 && (p.접수방법.낱말.length > 0 || p.모집인원없음) && (
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
        {봄 ? (
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

        {/* 이 병원 이야기 (원본 「이 병원 이야기 · 가로 후기」 983:22167) — 병원별 이야기·후기 기능이 아직 없어 빈 상태로 둡니다.
            지어낸 후기를 넣지 않습니다 (2026-11-12 밤 근무) */}
        <section className="flex flex-col gap-(--rapo-dimension-x3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
          <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{p.기관} 이야기</p>
          <h2 className="rapo-type-t10-bold break-keep text-(color:--rapo-color-fg-neutral)">이 병원에서 일한<br />동료들의 이야기</h2>
          <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">아직 이야기가 비어 있어요. 커뮤니티에서 먼저 물어보세요.</p>
          <RapoButton href="/community" tone="deep-coral" full>커뮤니티에서 물어보기</RapoButton>
        </section>

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

        {/* 공유받은 비회원에게 가입 권유 (2026-11-12 세중님 「내용이 만족스러웠나요? 1분 만에 회원가입하고 둘러보기」).
            적는 것은 회원이 실제로 보는 것만입니다. 가입하면 이 공고로 돌아옵니다(로그인 화면의 next) */}
        {p.who === '비회원' && (
          <>
            <RapoSectionGap />
            <section aria-labelledby="share-join" className="flex flex-col gap-(--rapo-dimension-x3) p-(--rapo-dimension-x5)">
              <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">내용이 만족스러웠나요?</p>
              <h2 id="share-join" className="rapo-type-t10-bold break-keep text-(color:--rapo-color-fg-neutral)">라포에서 더 많은 걸<br />볼 수 있어요</h2>
              <ul className="flex flex-col gap-(--rapo-dimension-x2) py-(--rapo-dimension-x1)">
                {['공공기관·대학병원·종합병원 공고 전체를 한곳에서', '관심 공고 저장과 마감 임박 알림', '치료사끼리 나누는 커뮤니티', '교육·학술 일정과 병원 정보'].map((t) => (
                  <li key={t} className="rapo-type-t5-regular flex items-start gap-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d8372b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-[1px] shrink-0">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                    <span className="break-keep">{t}</span>
                  </li>
                ))}
              </ul>
              <RapoButton href={`/login?next=${encodeURIComponent(p.id ? `/jobs/${p.id}` : '/jobs')}`} tone="deep-coral" full>1분 만에 가입하고 둘러보기</RapoButton>
              <p className="rapo-type-t3-regular text-center text-(color:--rapo-color-fg-neutral-muted)">가입은 무료예요 · 이미 회원이라면 같은 단추로 로그인돼요</p>
            </section>
          </>
        )}

        {p.id && <div className="px-(--rapo-dimension-x5)"><AdminJobTools id={p.id} /></div>}
      </main>

      {/* 마지막 줄이 고정 행동(112 + 안전 여백, 마감이면 안내 한 줄 더)에 가리지 않게 */}
      <div aria-hidden style={{ height: `calc(${p.closed ? 172 : 112}px + env(safe-area-inset-bottom))` }} />

      <RapoStickyActions
        안내={p.closed ? '모집이 종료됐어요. 원문과 공유는 이용할 수 있어요.' : null}
        저장={p.id ? <JobSave id={p.id} look="rapo-bar" 마감={p.closed} /> : <RapoSaveBar on={false} busy={false} disabled />}
        지원={p.closed ? (
          <button type="button" disabled className={잠긴단추꼴}>모집 마감</button>
        ) : p.who === '모름' ? null : p.지원주소 ? (
          /* 2026-11-12 — 비회원도 창구가 주소를 줍니다(금고 N). 갈 주소가 없으면 회원과 같이 아래 잠금 */
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
       className="rapo-type-t5-bold -my-[11px] inline-flex min-h-(--rapo-touch-min) items-center gap-(--rapo-dimension-x1) underline
                  decoration-(--rapo-color-stroke-neutral-weak) underline-offset-[3px]">
      {못읽은칸말}
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/detail/open-20.svg" alt="" width={16} height={16} />
    </a>
  );
}
