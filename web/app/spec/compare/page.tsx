'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoSpecScoreCard } from '@/components/rapo/rapo-spec-score';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';

/* 취업 스펙 비교 — 학생·취준생끼리 (2026-11-17 세중님 「학생용으로 취업 스펙 비교 · 학생들이 넣은 점수들로 서로 비교 ·
   20명 되면 보여주자」). 툴킷 · 홈 · 내 정보 · 가입 끝 화면이 여기로 옵니다(components/rapo/rapo-spec-entry.tsx).

   자료는 DB 창구 「취업스펙비교」 하나 (금고 SQL_1113/ZZB) — 내 총점 · 같은 직군에서 스펙(학점)을 넣은 학생 수 ·
   20명부터 「상위 몇 %」. 남의 점수나 이름은 오지 않습니다.
     스펙을 아직 안 넣음(재학 중 가입은 건너뜁니다)  → 넣으라는 안내와 「취업 스펙 입력하기」(/me/spec)
     넣음 · 20명 미만                              → 내 점수 + 「○명 더 모이면 비교가 열려요」
     넣음 · 20명 이상                              → 내 점수 + 「취업 준비생 ○명 중 상위 ○%」
   임상가는 이 화면 대신 「입사 스펙 비교」(준비 중)로 넘깁니다. */

type 받은것 = { 있음: boolean; 점수: number | null; 사람: number; 최소: number; 상위: number | null };

export default function SpecCompare() {
  const router = useRouter();
  const { me } = useAuth();
  const [v, setV] = useState<받은것 | null>(null);
  const [못읽음, set못읽음] = useState(false);
  const 임상가 = me?.role === '현직';

  useEffect(() => {
    if (!me) return;
    if (임상가) { router.replace('/me/soon?k=spec'); return; }
    browserSupabase().rpc('취업스펙비교').then(({ data, error }) => {
      const d = data as Partial<받은것> | null;
      if (error || !d || typeof d.있음 !== 'boolean') { set못읽음(true); return; }
      setV({ 있음: d.있음, 점수: d.점수 ?? null, 사람: d.사람 ?? 0, 최소: d.최소 ?? 20, 상위: d.상위 ?? null });
    });
  }, [me, 임상가, router]);

  return (
    <RapoMeFrame title="취업 스펙 비교" back="/toolkit">
      {() => (
        <div className="flex flex-col gap-(--rapo-dimension-x6) pt-(--rapo-dimension-x4)">
          <div className="-mx-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x6) py-(--rapo-dimension-x5)">
            <h2 className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">취업을 준비하는 사람들과<br />내 스펙을 견줘 봐요</h2>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">학점·자격·교육·실습·어학으로 낸 내 점수가 어디쯤인지 보여 드려요.</p>
          </div>

          {못읽음 && (
            <p role="alert" className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-critical)">점수를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
          )}
          {!못읽음 && !v && <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>}

          {v && !v.있음 && (
            <section className="flex flex-col gap-(--rapo-dimension-x4)">
              <div className="flex items-start gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
                {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                <img src="/rapo/home/graphic-spec-48.svg" alt="" width={48} height={48} className="shrink-0" />
                <div className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
                  <p className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">스펙을 넣으면 취업 스펙 점수가 나와요</p>
                  <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">학점과 자격·교육·실습을 적으면 바로 점수를 볼 수 있어요. 졸업을 앞두고 있다면 지금 넣어 보세요.</p>
                </div>
              </div>
              <RapoButton href="/me/spec" full>취업 스펙 입력하기</RapoButton>
              <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">학점은 꼭 적어 주세요. 학점이 있어야 점수와 비교에 들어가요.</p>
            </section>
          )}

          {v && v.있음 && v.점수 != null && (
            <>
              <RapoSpecScoreCard 점수={v.점수} />
              <section className="flex flex-col gap-(--rapo-dimension-x3)">
                <h3 className="rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)">취업 준비생끼리 비교</h3>
                {v.상위 != null ? (
                  <div className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
                    <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">같은 직군 취업 준비생 <span className="whitespace-nowrap">{v.사람}명</span> 중</p>
                    <p className="rapo-type-t11-bold whitespace-nowrap text-(color:--rapo-color-fg-brand-contrast)">상위 {v.상위}%</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
                    <p className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">
                      <span className="whitespace-nowrap">{Math.max(1, v.최소 - v.사람)}명</span> 더 모이면 비교가 열려요
                    </p>
                    <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
                      같은 직군에서 스펙을 넣은 취업 준비생이 <span className="whitespace-nowrap">{v.최소}명</span> 모이면 내가 상위 몇 %인지 보여 드려요. <span className="whitespace-nowrap">지금 {v.사람}명</span>이에요.
                    </p>
                  </div>
                )}
              </section>
              <RapoButton href="/me/spec" tone="outline" full>내 스펙 확인·수정</RapoButton>
            </>
          )}
        </div>
      )}
    </RapoMeFrame>
  );
}
