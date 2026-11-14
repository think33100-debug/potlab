import Link from 'next/link';
import type { ReactNode } from 'react';
import type { HospitalStat, 시설숫자 } from '@/lib/hospital';
import { 기관로고 } from '@/lib/org-logo';
import { RapoBadge, RapoMaskIcon } from './rapo-ui';

/* 공고 상세 — 새 디자인 「U03 · 공고 상세」 조각들 (2026-11-11 대표: 피그마 우선, 없는 정보는 뺌).

   Figma 기준 화면 (04 공고 상세 614:18829)
     최종 전체 화면 983:22146 · 비회원 보수 비공개 795:16114 · 모집 마감 D-03 605:10901

   조각 차례 (원본 번호 그대로)
     01 상세 탐색 517:362     ← RapoDetailHeader
     02 공고 식별 983:22398   ← RapoDetailIdentity
     03 핵심 조건 983:22154   ← RapoPayCard · RapoKeyRow
     07 지원 방법 517:651     ← RapoApplyGuide · RapoPeriodCard · RapoGuideRow
     08 근무 기관 517:658     ← 2026-11-12 밤 세중님 「없애자」 — 근무 장소는 근무 조건 칸으로
     비슷한 공고 983:22176    ← app/jobs/[id]/page.tsx 가 공고 행(RapoJobRow)으로
     고정 행동 517:664        ← app/jobs/[id]/page.tsx (저장 · 지원)

   이 파일은 **그리기만** 합니다. 값(무엇을 「공고문 확인」으로 둘지 등)은 page.tsx 가 정해 넘깁니다. */

/* 01 상세 탐색 — 뒤로 · 로고 · 공유 (64px · 좌우 12) */
export function RapoDetailHeader({ share }: { share: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-(--rapo-dimension-x16) items-center justify-between
                       bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x3)">
      <Link href="/jobs" aria-label="공고 목록으로"
        className="flex size-(--rapo-touch-min) items-center justify-center rounded-(--rapo-radius-r2)
                   active:bg-(--rapo-color-bg-transparent-pressed)">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
      </Link>
      <Link href="/" aria-label="RAPO 홈" className="relative block h-[31.5px] w-[120px] shrink-0">
        {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 (rapo-header.tsx 와 같은 자리) */}
        <img src="/rapo/home/logo-symbol.svg" alt="" className="absolute left-0 top-0 h-[31.5px] w-[32.25px]" />
        <img src="/rapo/home/logo-wordmark.svg" alt=""
          className="absolute bottom-[24.37%] left-[34.21%] right-[0.04%] top-[24.67%]" />
        {/* eslint-enable @next/next/no-img-element */}
      </Link>
      {share}
    </header>
  );
}

export type 모집상태 = '접수 중' | '모집 마감' | '확인 필요';

/* 02 공고 식별 — 남색 판. 기관 · 모집 상태 · 제목 · 태그 · 조회 · 모집인원과 접수 마감.
   원본의 기관 공식 로고·부서 줄은 자료가 없어 기관 기본 그림을 흰 상자에 둡니다(로고는 오픈 뒤 · 11/5) */
export function RapoDetailIdentity({ org, orgArt, 상태, title, tags, views, 인원, 인원이름, 마감 }: {
  org: string; orgArt: string; 상태: 모집상태; title: string; tags: string[];
  views: number | null; 인원: string; 마감: string;
  /* 직군이 하나면 「작업치료사 모집 · 1명」처럼 직군을 이름 줄로 올립니다 — 값에 같이 쓰면 「1명」이 다음 줄로 떨어졌습니다 (11/12 세중님) */
  인원이름?: string;
}) {
  return (
    <section className="flex flex-col gap-(--rapo-dimension-x4) bg-(--rapo-color-bg-navy-solid) p-(--rapo-dimension-x5)
                        text-(color:--rapo-color-fg-on-neutral-solid)">
      <div className="flex items-center gap-(--rapo-dimension-x3)">
        <div className="flex size-[96px] shrink-0 items-center justify-center rounded-(--rapo-radius-r2)
                        bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x2)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 · 공통 로고(보건소·치매센터)가 있으면 그것 (2026-11-13) */}
          <img src={기관로고(org) ?? `/rapo/home/org-${orgArt}.svg`} alt="" className={기관로고(org) ? 'size-14 object-contain' : 'size-full object-contain'} />
        </div>
        <p className="rapo-type-t5-bold min-w-0 flex-1 break-keep">{org}</p>
        {/* 모집 상태 — 접수 중 · 모집 마감(D-03) · 확인 필요(D-04 · 마감일을 못 읽은 공고) */}
        <span className="rapo-type-t4-bold shrink-0 whitespace-nowrap rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-brand-weak)
                         px-(--rapo-dimension-x3) py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-brand-contrast)">
          {상태}
        </span>
      </div>
      <h1 className="rapo-type-t11-bold break-keep [overflow-wrap:anywhere]">{title}</h1>
      <div className="flex items-center gap-(--rapo-dimension-x2)">
        <div className="flex min-w-0 flex-1 flex-wrap gap-(--rapo-dimension-x2)">
          {tags.map((t) => (
            <span key={t} className="rapo-type-t2-medium whitespace-nowrap rounded-[4px] bg-(--rapo-color-palette-static-white-alpha-100)
                                     px-(--rapo-dimension-x2) py-(--rapo-dimension-x1)">{t}</span>
          ))}
        </div>
        {views != null && (
          <p className="rapo-type-t2-medium flex shrink-0 items-center gap-[6px] opacity-75">
            <RapoMaskIcon src="/rapo/detail/eye-18.svg" w={18} h={18} />
            조회 {views.toLocaleString('ko-KR')}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-(--rapo-dimension-x3)">
        <식별칸 icon="/rapo/detail/person-20.svg" iconW={17.8} iconH={19.8} label={인원이름 ?? '모집인원'} v={인원} />
        <식별칸 icon="/rapo/detail/calendar-20.svg" iconW={20} iconH={20} label="접수 마감" v={마감} />
      </dl>
    </section>
  );
}

function 식별칸({ icon, iconW, iconH, label, v }: { icon: string; iconW: number; iconH: number; label: string; v: string }) {
  return (
    <div className="flex min-w-0 items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r2)
                    bg-(--rapo-color-palette-static-white-alpha-200) p-(--rapo-dimension-x3)">
      <span className="flex size-(--rapo-dimension-x7) shrink-0 items-center justify-center">
        <RapoMaskIcon src={icon} w={iconW} h={iconH} />
      </span>
      <div className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
        <dt className="rapo-type-t2-regular break-keep opacity-70">{label}</dt>
        {/* 원본 20/28 Bold — 토큰 글꼴 가운데 같은 것이 t8 입니다. 긴 값(「물리치료사 3명 · 작업치료사 1명」)은 한 단계 작게 */}
        {/* 한글 다섯 자부터도 작게 — 「공고문 확인」·「채용시까지」가 t8 로는 칸(360 폭 약 90px)을 넘어 두 줄이 됐습니다 (2026-11-13) */}
        {/* 짧은 값은 한 줄로 두고 좁은 폭에서만 글씨를 줄입니다 (2026-11-14 — 320 폭에서 「10.30(금」 / 「)」로 갈렸습니다 · 화면 표시 규칙 「말 가운데 줄바꿈 금지」) */}
        {v.length > 7 || (v.match(/[가-힣]/g)?.length ?? 0) >= 5
          ? <dd className="rapo-type-t5-bold break-keep [overflow-wrap:anywhere]">{v}</dd>
          : <dd className="rapo-type-t8-bold whitespace-nowrap" style={{ fontSize: 'min(var(--rapo-font-size-t8), 5vw)' }}>{v}</dd>}
      </div>
    </div>
  );
}

/* 03 보수 — 「공고 명시 보수」 (RAPO / Detail / Pay summary 517:392 · 보수 비공개 1210:1072).
   잠김이면 비회원 원본 글 그대로입니다. 금액 글이 길면(「월급 230만원~300만원」) 한 단계 작은 글꼴 */
/* ★ 2026-11-14 세중님 「다른 곳 연봉 넣는 것처럼 그냥 넣자 · 2개로 나오는 건 그렇게」 — 공고에 금액이 없고
   이 병원 공시(알리오·공공병원 알리미)가 있으면 「내규에 따름」 대신 공시 연봉 두 칸을 크게 보입니다.
   모양은 아래 「병원 한눈에 › 이 병원 연봉」(연봉칸)과 같은 숫자 꼴입니다. 국민연금 추정은 의사 포함 전체 평균이라
   맨 위로 안 올립니다(아래 칸에 그대로). 공시를 위로 올린 공고는 아래 연봉칸을 다시 그리지 않습니다(view 가 정함) */
export type 공시한줄 = { 출처: '알리오' | '알리미'; 기준해: number | null; 칸: [string, number][] };
export function RapoPayCard({ 잠김, 값, 덧말, 공시 }: { 잠김: boolean; 값: string; 덧말: string | null; 공시?: 공시한줄 | null }) {
  /* 열 자부터 한 단계 작게 (2026-11-13) — 12 자 기준일 때 「월 350~360만원」(11자)이 360 폭에서 「월 / 350~360만원」으로 갈렸습니다.
     「약 4,900만원」「월 약 176만원」(9자)은 큰 글씨 그대로 한 줄 */
  const 긴값 = 값.length > 9;
  const 공시씀 = !잠김 && !!공시 && 공시.칸.length > 0;
  return (
    <div className="relative flex flex-col gap-(--rapo-dimension-x2) overflow-hidden rounded-(--rapo-radius-r3)
                    bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
      <p className="rapo-type-t4-bold pr-(--rapo-dimension-x16) text-(color:--rapo-color-fg-brand-contrast)">
        {공시씀 ? '이 병원 공시 연봉' : '공고 명시 보수'}
      </p>
      {공시씀 ? (
        /* 두 칸 나란히 — 지갑 그림(위 오른쪽 48)과 겹치지 않게 한 칸 내려 둡니다 */
        <dl className="mt-(--rapo-dimension-x4) grid gap-(--rapo-dimension-x3)" style={{ gridTemplateColumns: `repeat(${공시!.칸.length}, minmax(0, 1fr))` }}>
          {공시!.칸.map(([이름, v]) => (
            <div key={이름} className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
              <dt className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{이름}</dt>
              <dd className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
                <span className="rapo-type-t10-bold">{Math.round(v / 1e4).toLocaleString('ko-KR')}</span>
                <span className="rapo-type-t4-bold ml-[2px] text-(color:--rapo-color-fg-neutral-muted)">만 원</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={`${잠김 || 긴값 ? 'rapo-type-t9-bold' : 'rapo-type-t12-bold'} break-keep pr-(--rapo-dimension-x12)
                       text-(color:--rapo-color-fg-neutral) [overflow-wrap:anywhere]`}>
          {잠김 ? '이용 권한 확인 후 공개' : 값}
        </p>
      )}
      {공시씀 ? (
        /* 두 줄로 끊어 둡니다 — 이어 쓰면 320 폭에서 말 가운데가 갈렸습니다 */
        <p className="rapo-type-t3-regular whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral-muted)">
          {`${공시!.기준해 ? `${공시!.기준해}년 ` : ''}${공시!.출처 === '알리오' ? '알리오' : '공공병원 알리미'} 공시예요\n공고에는 금액이 적혀 있지 않아요`}
        </p>
      ) : (잠김 || 덧말) && (
        <p className="rapo-type-t3-regular whitespace-pre-line text-(color:--rapo-color-fg-neutral-muted)">
          {잠김 ? '로그인 후 이용 상태를 확인해 주세요.\n이용 가능한 회원에게 보수를 공개해요.' : 덧말}
        </p>
      )}
      {/* 2026-11-14 세중님 「아래 작게 세후 월급은 어느정도인지 궁금하세요? 누르면 라포 올인원 툴킷」 */}
      {!잠김 && (
        <Link href="/toolkit#pay"
          className="rapo-type-t3-medium mt-(--rapo-dimension-x1) flex w-fit items-center gap-(--rapo-dimension-x1) break-keep
                     text-(color:--rapo-color-fg-neutral) underline decoration-(--rapo-color-stroke-neutral-muted) underline-offset-4">
          세후 월급은 어느 정도인지 궁금하세요?
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/home/chevron.svg" alt="" width={12} height={12} className="shrink-0" />
        </Link>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src={잠김 ? '/rapo/detail/graphic-lock-48.svg' : '/rapo/home/graphic-pay-48.svg'} alt=""
        width={48} height={48} className="absolute right-(--rapo-dimension-x5) top-(--rapo-dimension-x5)" />
    </div>
  );
}

/* 03 핵심 조건 한 줄 (RAPO / Detail / Key conditions 517:421) — 아이콘 · 이름 · 값 */
export function RapoKeyRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-(--rapo-dimension-x3)">
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src={icon} alt="" width={20} height={20} className="mt-[9px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
        <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{label}</p>
        <div className="text-(color:--rapo-color-fg-neutral)">{children}</div>
      </div>
    </div>
  );
}

/* 영역 구분 8px (원본 「영역 구분」) */
export function RapoSectionGap() {
  return <div aria-hidden className="h-(--rapo-dimension-x2) bg-(--rapo-color-bg-neutral-weak)" />;
}

/* 07 지원 방법 / 08 근무 기관 / 비슷한 공고 — 제목 20/28 + 본문 (흰 판 · 20 여백) */
export function RapoDetailSection({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-(--rapo-dimension-x5) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)">
      <div className="flex flex-col gap-(--rapo-dimension-x1)">
        <h2 className="rapo-type-section-title text-(color:--rapo-color-fg-neutral)">{title}</h2>
        {sub && <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/* 접수 기간 카드 (RAPO / Detail / Application period 517:519).
   날짜 상자는 마감일이 있을 때만 — 없으면 글만(마감일 공고문 확인 · 수시채용) */
export function RapoPeriodCard({ 달, 날, 기간, 강조, 덧말 }: {
  달: string | null; 날: string | null; 기간: string; 강조: string | null; 덧말: string | null;
}) {
  return (
    <div className="flex items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
      {달 && 날 && (
        <div className="flex w-[72px] shrink-0 flex-col rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-layer-default)
                        p-(--rapo-dimension-x2) text-center">
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-brand-contrast)">{달}</p>
          <p className="rapo-type-t12-bold text-(color:--rapo-color-fg-neutral)">{날}</p>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x2)">
        <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-brand-contrast)">접수 기간</p>
        <p className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{기간}</p>
        {강조 && <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-brand)">{강조}</p>}
        {덧말 && <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{덧말}</p>}
      </div>
    </div>
  );
}

/* 지원 방법 안의 이름-값 줄 (원본 「방문 접수」·「접수처」 줄 · 이름 72px) */
export function RapoGuideRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-(--rapo-dimension-x4)">
      <p className="rapo-type-t4-medium w-[72px] shrink-0 pt-[2px] text-(color:--rapo-color-fg-neutral-muted)">{label}</p>
      <div className="rapo-type-article-body min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">{children}</div>
    </div>
  );
}

/* 08 근무 기관 (RAPO / Detail / Institution 517:658) — 기관 사진은 오픈 뒤(11/5)라 이름과 주소만 */
/* 고정 행동 (RAPO / Detail / Sticky actions 517:664 · 112px + 안전 여백).
   위 줄 = 저장 (좋아요는 기능이 없어 뺐습니다) · 아래 줄 = 지원. 마감이면 원본 D-03 안내를 위에 띄웁니다 */
export function RapoStickyActions({ 안내, 저장, 지원 }: { 안내: string | null; 저장: ReactNode; 지원: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-3xl">
      {안내 && (
        <p role="status" className="rapo-type-t4-medium mx-auto mb-(--rapo-dimension-x2) w-fit max-w-[calc(100%-40px)] break-keep
                                     rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x4)
                                     py-(--rapo-dimension-x3) text-center text-(color:--rapo-color-fg-neutral) shadow-(--rapo-shadow-s2)">
          {안내}
        </p>
      )}
      <div className="flex flex-col gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5)
                      pt-(--rapo-dimension-x2) pb-[calc(var(--rapo-dimension-x2)+env(safe-area-inset-bottom))]">
        <div className="flex">{저장}</div>
        {지원}
      </div>
    </div>
  );
}

/* 지원 단추 꼴 — 48px deep coral (원본 1047:1109). 마감이면 흐린 잠금 */
export const 지원단추꼴 =
  'rapo-type-t4-bold flex h-(--rapo-dimension-x12) w-full items-center justify-center gap-(--rapo-dimension-x2) ' +
  'rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-deep-coral) px-(--rapo-dimension-x5) text-(color:--rapo-color-fg-on-deep-coral) ' +
  'active:bg-(--rapo-color-bg-deep-coral-pressed)';
export const 잠긴단추꼴 =
  'rapo-type-t4-bold flex h-(--rapo-dimension-x12) w-full items-center justify-center rounded-(--rapo-radius-r3) ' +
  'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral-muted)';

/* 병원 한눈에 — 치료사 인원 · 지난 채용 경쟁률 (2026-11-12 세중님 「공고 상세에 넣어 · 지금 디자인 그대로」).
   피그마 원본에는 없는 칸이라 근무 기관 아래에 **같은 조각(섹션 · 브랜드 옅은 카드)** 으로 둡니다.
   값은 page.tsx 가 고릅니다 — 치료사는 심평원 신고 인원(hospitalStat), 경쟁률은 알리오 묶음(공고경쟁률요약 · 지점까지 맞는 것만).
   둘 다 없으면 이 칸을 그리지 않습니다. 지어낸 숫자는 넣지 않습니다 */
export type 경쟁률줄 = {
  묶음키: string; 직군?: string | null; 고용형태: string | null; 같은형태?: boolean; 회차: number; 첫해: number | null; 끝해: number | null;
  평균: number | null; 가장낮음: number | null; 가장높음: number | null;
};

/* 이 병원 연봉 (2026-11-12 세중님 「국립대는 알리오 공시 기준으로 신입사원 연봉」 · 금고 SQL_1113/P).
   알리오 — 경영공시 「직원 평균보수」의 신입사원 초임(대졸 사무직 신입 기준) · 정규직 1인당 평균 보수 · 결산 해
   국민연금 — 고지금액으로 추정한 **의사 포함 전체 직원** 평균. 가입자 수가 병상 수보다 적은 병원(사학연금 등)은 DB 가 안 줍니다 */
export type 병원보수 = {
  출처: '알리오' | '국민연금' | '알리미'; 공시기관: string | null; 신입초임: number | null; 평균보수: number | null;
  기준해: number | null; 가입자수: number | null; 상한근처: boolean;
  /* 알리미만 — 직종별 평균연봉의 「보건직」(의료기사 · 치료사 포함) */
  보건직평균?: number | null;
};
const 만원 = (v: number) => `${Math.round(v / 1e4).toLocaleString('ko-KR')}`;

function 연봉칸({ 보수 }: { 보수: 병원보수 }) {
  /* 알리미 — 지역거점공공병원 알리미(지방의료원·적십자병원) 「직원 평균보수(직종별)」 (2026-11-12 밤 세중님 「높은 평균들 빼고 보건직·신입만」 · 금고 SQL_1113/T).
     의사가 든 전체 평균은 안 그립니다 */
  const 칸 = (보수.출처 === '알리오'
    ? [['신입 초임', 보수.신입초임, false], ['직원 평균', 보수.평균보수, false]]
    : 보수.출처 === '알리미'
    ? [['신입 평균', 보수.신입초임, false], ['보건직 평균', 보수.보건직평균 ?? null, false]]
    : [['병원 전체 평균 (추정)', 보수.평균보수, 보수.상한근처]]) as [string, number | null, boolean][];
  const 보일칸 = 칸.filter(([, v]) => v != null && v > 0);
  if (보일칸.length === 0) return null;
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">이 병원 연봉</p>
      <div className="grid gap-(--rapo-dimension-x3)" style={{ gridTemplateColumns: `repeat(${보일칸.length}, minmax(0, 1fr))` }}>
        {보일칸.map(([이름, v, 이상]) => (
          <div key={이름} className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
            <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-brand-contrast)">{이름}</p>
            <p className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
              <span className="rapo-type-t10-bold">{만원(v as number)}</span>
              <span className="rapo-type-t4-bold ml-[2px] text-(color:--rapo-color-fg-neutral-muted)">만 원{이상 ? ' 이상' : ''}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        {보수.출처 === '알리오'
          ? `알리오 공시${보수.공시기관 ? ` (${보수.공시기관})` : ''}${보수.기준해 ? ` · ${보수.기준해}년 결산` : ''} · 신입 초임은 대졸 신입 기준, 직원 평균은 정규직 전체예요`
          : 보수.출처 === '알리미'
          ? `지역거점공공병원 알리미 공시${보수.공시기관 ? ` (${보수.공시기관})` : ''}${보수.기준해 ? ` · ${보수.기준해}년` : ''} · 신입은 모든 직종 신입의 평균, 보건직은 치료사·방사선사 같은 의료기사 직종의 평균이에요`
          : `국민연금 가입 자료로 추정한 의사 포함 전체 직원 평균이에요${보수.가입자수 ? ` · 가입자 ${보수.가입자수.toLocaleString('ko-KR')}명` : ''}${보수.상한근처 ? ' · 소득 상한 때문에 실제보다 낮게 나와요' : ''}`}
      </p>
    </div>
  );
}

/* 병원이 아닌 곳의 숫자를 화면 글로 — 복지관 · 치매센터 · 장기요양기관 (2026-11-12 밤 세중님 「전에 웹 참고해서」).
   옛 앱(index.html loadJobWf)과 같은 값입니다 — 복지관은 종사자 전체 수와 순위·정원, 「치료사가 몇 명인지는 따로 나오지 않습니다」.
   0·빈 값은 칸을 안 그립니다. 치료사 칸은 한 명이라도 있을 때만 그립니다 */
function 시설보임(s: 시설숫자): { 구분: string | null; 칸: 숫자칸[]; 치료사: { pt: number | null; ot: number | null } | null; 글: string } {
  const 치료사 = (s.pt ?? 0) > 0 || (s.ot ?? 0) > 0 ? { pt: s.pt ?? null, ot: s.ot ?? null } : null;
  if (s.갈래 === '복지관') {
    return {
      구분: null,
      칸: 숫자만([
        { 이름: '종사자', 수: s.종사자, 단위: '명' },
        { 이름: '정원', 수: s.정원, 단위: '명' },
        /* 「서울 1위 / 51곳」을 한 칸에 넣으면 좁은 폰에서 두 줄로 넘칩니다(2026-11-13 세중님) — 이름 「서울 51곳 중」 · 숫자 「1위」.
           곳 수를 숫자 아래 덧말로 두면 이 칸만 숫자가 위로 떠서 옆 칸과 줄이 안 맞았습니다 */
        { 이름: `${s.시도 ?? '시도'} ${(s.시도곳수 ?? 0).toLocaleString('ko-KR')}곳\u00a0중`, 수: s.시도곳수 ? s.시도순위 : null, 단위: '위' },
      ]),
      치료사: null,
      글: `${s.출처 ?? '보건복지부 장애인복지관 현황'} 기준이에요. 종사자 전체 수이고, 치료사가 몇 명인지는 따로 나오지 않아요.`,
    };
  }
  if (s.갈래 === '치매센터') {
    return {
      구분: null,
      칸: 숫자만([{ 이름: '의사', 수: s.의사, 단위: '명' }, { 이름: '간호사', 수: s.간호사, 단위: '명' }, { 이름: '사회복지사', 수: s.사회복지사, 단위: '명' }]),
      치료사,
      /* 출처 글은 360 폭에서 한 줄 (2026-11-13 세중님 「공고인원 아님 빼자 · 한 줄로」) — 기준일은 연·월만 */
      글: `센터 전체 인원 · ${s.출처 ?? '치매센터 자료'}${s.기준 ? ` · ${s.기준.slice(0, 7)}` : ''}`,
    };
  }
  return {
    구분: s.종류 ?? null,
    칸: 숫자만([{ 이름: '정원', 수: s.정원, 단위: '명' }]),
    치료사,
    글: `기관 전체 인원 · ${s.출처 ?? '장기요양기관 자료'}`,
  };
}

/* ── 숫자 칸 (2026-11-13 세중님 「숫자 다시 우리 디자인 지침에 맞게 · 서울 1위 51곳 넘어가네」) ──
   지침(RAPO노트/디자인적용_지침_1111.md) — 360·414 폭에서 넘침 0 · 작은 화면은 줄바꿈·카드·그리드로 맞춤.
   그래서 칸 안에는 **숫자 + 단위만** 둡니다. 숫자는 줄을 안 바꾸고(nowrap) **크게** — 아래 치료사 카드(숫자 t12)와 같은
   「큰 숫자 · 작은 단위」 꼴입니다(세중님 「숫자는 더 크고 강조」). 크기는 숫자크기() 한 자리가 칸 수와 글자 수로 고릅니다.
   단위는 t4 Bold muted.
   「51곳 중」 같은 기준은 이름 쪽에, 「상급종합병원」 같은 글자 값은 칸 밖의 배지(RapoBadge)로 뺍니다.
   이름(재활의학과 전문의)은 좁은 폭에서 두 줄이 될 수 있어 칸을 위아래로 벌려 숫자 줄을 맞춥니다. 0·빈 값은 칸을 안 그립니다 */
type 숫자칸 = { 이름: string; 수: number | null | undefined; 단위: string };

/* 360 폭에서 재서 정한 표 (2026-11-13 · 운영 화면에 같은 마크업을 넣어 Range 로 잼 · 넘친 칸 0).
   칸 하나 t12 · 둘 t10(「2,446」 다섯 글자까지, 넘으면 t8) · 셋 t10(「999」 세 글자까지, 넘으면 t6).
   지금 자료의 최댓값 — 병상 2,446 · 복지관 종사자 90 · 치매센터 34 · 요양원 정원 389 — 은 모두 큰 쪽입니다 */
function 숫자크기(칸: 숫자칸[]): string {
  const 글자 = Math.max(...칸.map((x) => (x.수 as number).toLocaleString('ko-KR').length));
  if (칸.length >= 3) return 글자 <= 3 ? 'rapo-type-t10-bold' : 'rapo-type-t6-bold';
  if (칸.length === 2) return 글자 <= 5 ? 'rapo-type-t10-bold' : 'rapo-type-t8-bold';
  return 'rapo-type-t12-bold';
}
const 숫자만 = (칸: 숫자칸[]) => 칸.filter((x) => x.수 != null && x.수 > 0);

function 숫자칸들({ 칸 }: { 칸: 숫자칸[] }) {
  if (칸.length === 0) return null;
  const 크기 = 숫자크기(칸);
  return (
    <dl className="grid gap-(--rapo-dimension-x2)" style={{ gridTemplateColumns: `repeat(${칸.length}, minmax(0, 1fr))` }}>
      {칸.map((x) => (
        <div key={x.이름} className="flex min-w-0 flex-col justify-between gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x3) py-(--rapo-dimension-x4)">
          <dt className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{x.이름}</dt>
          <dd>
            <span className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
              <span className={크기 + ' tabular-nums'}>{(x.수 as number).toLocaleString('ko-KR')}</span>
              <span className="rapo-type-t4-bold ml-[2px] text-(color:--rapo-color-fg-neutral-muted)">{x.단위}</span>
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* 「얼마나 바쁜 곳인지」는 일단 뺐습니다 (2026-11-12 저녁 세중님 「일단 빼자」). 계산은 lib/hospital.ts busyWord 에 그대로 있고,
   그리던 조각은 이 파일의 11/12 낮 판(커밋 5fe1f19)에 있습니다 */
export function RapoHospitalFacts({ 치료사, 바쁨, 경쟁률, 인턴 = false, 보수 = null, 시설 = null, 공고없이 = false }: {
  치료사: { pt: number | null; ot: number | null; 기준: string | null } | null;
  /* 병원이 아닌 곳 — 복지관 · 치매센터 · 요양원 (2026-11-12 밤 세중님 · 옛 앱 「이 복지관은 이런 곳입니다」) */
  시설?: 시설숫자 | null;
  보수?: 병원보수 | null;
  바쁨?: HospitalStat | null;
  경쟁률: 경쟁률줄[];
  /* 이번 공고가 인턴인가 — 인턴 경쟁률은 공개되지 않은 곳이 많아 안내 글을 바꿉니다 (11/12 세중님) */
  인턴?: boolean;
  /* 병원 게시판 「병원 정보」 탭 (2026-11-13) — 이번 공고가 없으니 「이번 공고와 같은 고용형태」 안내 줄을 안 그립니다.
     종류 배지도 안 그립니다(위 「기관 정보」 칸에 종류가 있음) */
  공고없이?: boolean;
}) {
  /* 구분·병상 — 옛 웹 공고 상세의 「종별 · 병상」을 다시 넣습니다 (2026-11-12 세중님 「병상, 구분 이런 것도 넣자」).
     자료는 치료사 인원과 같은 심평원 행(org_hospital_by_name)이라 새 창구가 없습니다. 0·빈 값은 칸을 안 그립니다 */
  const 구분 = 바쁨?.kind || null;
  const 개요 = 바쁨 ? 숫자만([
    { 이름: '병상', 수: 바쁨.bed, 단위: '개' },
    { 이름: '재활의학과 전문의', 수: 바쁨.rehab, 단위: '명' },
  ]) : [];
  const 곳 = 시설 ? 시설보임(시설) : null;
  if (!치료사 && !보수 && 경쟁률.length === 0 && 개요.length === 0 && !구분 && !곳) return null;
  const 짧은배 = (n: number | null) => (n == null ? '—' : `${Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}:1`);
  return (
    <RapoDetailSection title={곳 ? '기관 한눈에' : '병원 한눈에'} sub="공개된 자료로 모은 숫자예요">
      {곳 && (
        <div className="flex flex-col gap-(--rapo-dimension-x3)">
          {곳.구분 && !공고없이 && <div><RapoBadge>{곳.구분}</RapoBadge></div>}
          <숫자칸들 칸={곳.칸} />
          {곳.치료사 && (
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">이 기관 치료사</p>
              <div className="grid grid-cols-2 gap-(--rapo-dimension-x3)">
                {([['물리치료사', 곳.치료사.pt], ['작업치료사', 곳.치료사.ot]] as const).map(([이름, n]) => (
                  <div key={이름} className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
                    <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{이름}</p>
                    <p className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
                      <span className="rapo-type-t12-bold">{n == null ? '—' : n.toLocaleString('ko-KR')}</span>
                      {n != null && <span className="rapo-type-t5-bold ml-[2px]">명</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{곳.글}</p>
        </div>
      )}
      {/* 병원 게시판은 맨 위 「기관 정보」에 종류가 이미 있어 배지를 안 그립니다(서송병원에서 「병원」이 두 번 나왔음) */}
      {구분 && !곳 && !공고없이 && <div><RapoBadge>{구분}</RapoBadge></div>}
      <숫자칸들 칸={개요} />
      {치료사 && (
        <div className="flex flex-col gap-(--rapo-dimension-x2)">
          <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">이 병원 치료사</p>
          <div className="grid grid-cols-2 gap-(--rapo-dimension-x3)">
            {([['물리치료사', 치료사.pt], ['작업치료사', 치료사.ot]] as const).map(([이름, n]) => (
              <div key={이름} className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
                <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{이름}</p>
                <p className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
                  <span className="rapo-type-t12-bold">{n == null ? '—' : n.toLocaleString('ko-KR')}</span>
                  {n != null && <span className="rapo-type-t5-bold ml-[2px]">명</span>}
                </p>
              </div>
            ))}
          </div>
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
            {/* 360 폭에서 한 줄 (2026-11-13 세중님) — 「병원 전체 인원」은 남깁니다(공고 인원으로 읽히지 않게 · lib/hospital.ts 머리) */}
            병원 전체 인원 · 심평원 신고{치료사.기준 ? ` · ${치료사.기준} 기준` : ''}
          </p>
        </div>
      )}
      {보수 && <연봉칸 보수={보수} />}
      {/* 이번 공고와 같은 고용형태 자료가 없으면 한 줄로 밝힙니다 (11/12 세중님 — 청년인턴 공고에 공무직·기간제만 보였음) */}
      {!공고없이 && 경쟁률.length > 0 && !경쟁률.some((g) => g.같은형태) && (
        <p className="rapo-type-t3-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral-muted)">
          {인턴
            ? '인턴 채용 경쟁률은 이 병원에서 공개하지 않았어요. 같은 병원의 다른 채용을 참고로 보여 드려요.'
            : '이번 공고와 같은 고용형태의 경쟁률 자료는 아직 없어요. 같은 병원의 다른 채용을 참고로 보여 드려요.'}
        </p>
      )}
      {경쟁률.map((g) => (
        <div key={g.묶음키} className="flex flex-col gap-(--rapo-dimension-x2)">
          <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">
            지난 채용 경쟁률{g.직군 ? ` · ${g.직군}` : ''}{g.고용형태 ? ` · ${g.고용형태}` : ''}
          </p>
          <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
            <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-brand-contrast)">평균 경쟁률</p>
            <p className="whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
              <span className="rapo-type-t12-bold">{g.평균 == null ? '—' : Number(g.평균).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}</span>
              {g.평균 != null && <span className="rapo-type-t6-bold ml-[4px]">: 1</span>}
            </p>
            {/* 두 줄로 나눠 적습니다 — 한 줄에 이으면 「가장 높음 / 13 : 1」처럼 말 가운데서 줄이 바뀌었습니다 (2026-11-13 세중님) */}
            <p className="rapo-type-t3-regular flex flex-col text-(color:--rapo-color-fg-neutral-muted)">
              <span className="whitespace-nowrap">
                {g.첫해 && g.끝해 ? `${g.첫해 === g.끝해 ? `${g.첫해}년` : `${g.첫해}–${g.끝해}년`} · ` : ''}{g.회차}번 채용
              </span>
              <span className="whitespace-nowrap">가장 낮음 {짧은배(g.가장낮음)} · 가장 높음 {짧은배(g.가장높음)}</span>
            </p>
          </div>
          <Link href={`/compete?g=${encodeURIComponent(g.묶음키)}`}
             className="rapo-type-t3-regular self-end underline decoration-(--rapo-color-stroke-neutral-weak) underline-offset-2 text-(color:--rapo-color-fg-neutral-muted)">
            회차별로 보기
          </Link>
        </div>
      ))}
    </RapoDetailSection>
  );
}
