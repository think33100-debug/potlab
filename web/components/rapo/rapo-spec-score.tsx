'use client';

import { useEffect, useState } from 'react';
import { tierOf } from '@/lib/spec';

/* 취업 스펙 점수 카드 — 가입 중 「스펙 점수 확인하기」와 툴킷 「취업 스펙 비교」가 같이 씁니다
   (2026-11-17 세중님 「기입하면 바로 스펙점수가 임펙트 있게 나오는 걸로 · 우리 스펙점수 만든 거 그게 그냥 나오는 걸로」).

   점수는 DB 가 셉니다(spec_parts 한 곳 — 가입 중은 spec_preview, 저장 뒤는 취업스펙비교). 여기는 **총점 하나**와
   등급 글(lib/spec.ts 의 tierOf — 옛 스펙쌓기와 같은 글)만 그립니다. 항목별 점수·배점은 화면에 내보내지 않습니다. */

/** 0 에서 점수까지 올라가는 숫자 — 움직임 줄이기를 켠 기기에서는 바로 보여 줍니다 */
function 올라가는수({ 끝 }: { 끝: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const 바로 = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const 길이 = 바로 ? 0 : 900;
    const 처음 = Date.now();
    /* 화면 그리기 신호(requestAnimationFrame)는 창이 가려져 있으면 멈춰 0 에 머뭅니다 — 시계로 셉니다(가려져 있어도 끝 점수까지 갑니다) */
    const 틱 = () => {
      const p = 길이 === 0 ? 1 : Math.min(1, (Date.now() - 처음) / 길이);
      setN(Math.round(끝 * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) window.clearInterval(시계);
    };
    const 시계 = window.setInterval(틱, 30);
    return () => window.clearInterval(시계);
  }, [끝]);
  return <>{n}</>;
}

export function RapoSpecScoreCard({ 점수 }: { 점수: number }) {
  const 등급 = tierOf(점수);
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x3)">
      <div className="flex flex-col items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-navy-solid) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8) text-center">
        <p className="rapo-type-t5-medium text-(color:--rapo-color-fg-on-navy-solid) opacity-80">나의 취업 스펙 점수</p>
        {/* 읽는 도구에는 올라가는 중간 숫자 대신 끝 점수만 */}
        <p aria-label={`${점수}점`} className="whitespace-nowrap text-[64px] font-bold leading-[72px] text-(color:--rapo-color-fg-on-navy-solid)">
          <span aria-hidden><올라가는수 끝={점수} /><span className="text-[28px] leading-[72px]">점</span></span>
        </p>
        <p className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-on-navy-solid)">{등급.headline}</p>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-on-navy-solid) opacity-80">{등급.comment}</p>
      </div>
      <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">
        {등급.place}
      </p>
    </div>
  );
}
