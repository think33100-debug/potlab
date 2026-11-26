'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { 올라가는수 } from '@/components/rapo/rapo-spec-score';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { tierOf } from '@/lib/spec';

/* 취업 스펙 비교 — 그리는 쪽 (자료는 app/spec/compare/page.tsx 가 DB 창구 「취업스펙비교」에서 받아 넘깁니다).
   화면 미리보기(/design-preview/student?v=compare&s=none|few|open)가 가짜 값으로 같은 것을 그립니다.

   모양은 피그마 「10 · E 입사 스펙 비교」의 두 화면을 따릅니다 (2026-11-26 세중님 「피그마 모양으로만」):
     머리      「입사 스펙 비교 홈」 hero-dashboard (1354:2331 · 1334:283) — 민트 바탕 · t11 제목 · t5 설명 · 오른쪽 그림
     본문      dashboard-body (1334:297) — 위 36 · 사이 32 · 아래 40
     수치 카드  「E / 대시보드 / 핵심 수치」(1338:314) — 회색 바탕 · 옅은 선 · 둥글기 20 · 안쪽 16
     아래 단추  「내 정보에서 스펙 수정하기」 보조 단추 (1315:8430)
   기능은 그대로입니다 — 학생끼리 비교 · 20명부터 상위 %. 병원 검색·입사자 TOP 3·공유처럼 자료가 없는 칸은 안 그립니다.
   점수는 **총점 하나**와 등급 글만 — 항목별 점수·배점은 화면에 내보내지 않습니다. */

export type 스펙비교값 = { 있음: boolean; 점수: number | null; 사람: number; 최소: number; 상위: number | null };

/* 「E / 대시보드 / 핵심 수치」 카드 바탕 */
const 카드 = 'rounded-(--rapo-radius-r5) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default-pressed) p-(--rapo-dimension-x4)';
/* 두 카드가 한 줄에 서다가, 좁으면(카드 136px 아래) 위아래로 내려섭니다 */
const 반카드 = `${카드} flex min-w-[136px] flex-[1_0_0] flex-col gap-(--rapo-dimension-x1_5)`;

function 수치({ 앞, 값, 단위, 읽기 }: { 앞?: string; 값: ReactNode; 단위: string; 읽기: string }) {
  return (
    <p aria-label={읽기} className="flex items-baseline gap-(--rapo-dimension-x1) whitespace-nowrap text-(color:--rapo-color-fg-neutral)">
      {앞 && <span aria-hidden className="rapo-type-t5-medium">{앞}</span>}
      <span aria-hidden className="rapo-type-t13-bold">{값}</span>
      <span aria-hidden className="rapo-type-t5-medium">{단위}</span>
    </p>
  );
}

export function RapoSpecCompareBody({ v, 못읽음 }: { v: 스펙비교값 | null; 못읽음: boolean }) {
  return (
    <div className="flex flex-col">
      <section className="-mx-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x2) bg-(--rapo-brand-color-mist) px-(--rapo-dimension-x6) pb-(--rapo-dimension-x6) pt-(--rapo-dimension-x7)">
        <h2 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">취업을 준비하는 사람들과<br />내 스펙을 견줘 봐요</h2>
        <div className="flex items-start justify-between gap-(--rapo-dimension-x4)">
          <p className="rapo-type-t5-regular max-w-[255px] break-keep text-(color:--rapo-color-fg-neutral-muted)">학점·자격·교육·실습·어학으로 낸 내 점수가 어디쯤인지 보여 드려요.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- 피그마 「RAPO / 이미지 / hero-graphic」(1414:50886) 원본 그대로 */}
          <img src="/rapo/spec/hero-graphic.png" alt="" width={94} height={110} className="h-[110px] w-[94px] shrink-0 object-contain" />
        </div>
      </section>

      <div className="flex flex-col gap-(--rapo-dimension-x8) pb-(--rapo-dimension-x2) pt-(--rapo-dimension-x9)">
        {못읽음 && (
          <p role="alert" className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-critical)">점수를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        )}
        {!못읽음 && !v && <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>}

        {v && !v.있음 && (
          <section className="flex flex-col gap-(--rapo-dimension-x4)">
            <div className="flex flex-col gap-(--rapo-dimension-x2_5)">
              <h3 className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-neutral)">스펙을 넣으면 점수가 나와요</h3>
              <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">학점과 자격·교육·실습을 적으면 바로 점수를 볼 수 있어요. 졸업을 앞두고 있다면 지금 넣어 보세요.</p>
            </div>
            {/* 피그마 hospital-card (1334:301) 모양 */}
            <div className="flex items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r5) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x4)">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src="/rapo/home/graphic-spec-48.svg" alt="" width={44} height={44} className="shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1_5)">
                <p className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">학점은 꼭 적어 주세요</p>
                <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-brand-contrast)">학점이 있어야 점수와 비교에 들어가요</p>
              </div>
            </div>
            <RapoButton href="/me/spec" tone="deep-coral" full>취업 스펙 입력하기</RapoButton>
          </section>
        )}

        {v && v.있음 && v.점수 != null && (() => {
          const 등급 = tierOf(v.점수);
          const 남은 = Math.max(1, v.최소 - v.사람);
          return (
            <>
              <section className="flex flex-col gap-(--rapo-dimension-x4)">
                <div className="flex flex-col gap-(--rapo-dimension-x2_5)">
                  <h3 className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-neutral)">취업 준비생끼리 비교</h3>
                  {v.상위 != null ? (
                    <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
                      같은 직군에서 스펙을 넣은 취업 준비생 <span className="whitespace-nowrap">{v.사람}명</span>과 견줬어요.
                    </p>
                  ) : (
                    <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
                      같은 직군에서 스펙을 넣은 취업 준비생이 <span className="whitespace-nowrap">{v.최소}명</span> 모이면 내가 상위 몇 %인지 보여 드려요. <span className="whitespace-nowrap">지금 {v.사람}명</span>이에요.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-(--rapo-dimension-x2)">
                  <div className="flex flex-wrap gap-(--rapo-dimension-x3)">
                    <div className={반카드}>
                      <p className="rapo-type-t5-bold whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">내 스펙 점수</p>
                      <수치 값={<올라가는수 끝={v.점수} />} 단위="점" 읽기={`${v.점수}점`} />
                      <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-brand-contrast)">{등급.headline}</p>
                    </div>
                    <div className={반카드}>
                      <p className="rapo-type-t5-bold whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">같은 직군</p>
                      {v.상위 != null ? (
                        <>
                          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-on-identity)">취업 준비생 <span className="whitespace-nowrap">{v.사람}명</span> 기준</p>
                          <수치 앞="상위" 값={v.상위} 단위="%" 읽기={`상위 ${v.상위}%`} />
                        </>
                      ) : (
                        <>
                          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-on-identity)">스펙을 넣은 취업 준비생</p>
                          <수치 값={v.사람} 단위="명" 읽기={`${v.사람}명`} />
                          <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-informative-contrast)"><span className="whitespace-nowrap">{남은}명</span> 더 모이면 열려요</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`${카드} flex flex-col gap-(--rapo-dimension-x1)`}>
                    <p className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{등급.comment}</p>
                    <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{등급.place}</p>
                  </div>
                </div>
              </section>

              <Link href="/me/spec"
                className="rapo-type-t5-bold flex h-[46px] w-full items-center justify-center rounded-(--rapo-radius-r2_5) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-spinner-track-neutral) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-on-identity) active:bg-(--rapo-color-bg-layer-default-pressed)">
                내 정보에서 스펙 수정하기
              </Link>
            </>
          );
        })()}
      </div>
    </div>
  );
}
