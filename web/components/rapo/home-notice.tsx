'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { HELP_EMAIL, KAKAO_CHANNEL } from '@/lib/contact';

/* 홈 안내 팝업 — 「RAPO 는 순차적으로 오픈 중입니다」 (2026-11-12 세중님 「우리 로고 넣어서 홈 화면 가면 팝업 · 다시 보지 않기」).

   ── 언제 뜨나 ────────────────────────────────────────────────
   홈(/)을 열 때. 닫으면 **이 탭을 쓰는 동안**은 다시 안 뜹니다(홈을 누를 때마다 뜨면 귀찮습니다 — sessionStorage).
   「다시 보지 않기」에 체크하고 닫으면 **이 기기에서는 아예** 안 뜹니다(localStorage).
   기억은 기기마다 따로입니다 — 회원 계정에 묶지 않았습니다(DB 칸이 없습니다). 다른 기기·브라우저에서는 한 번 더 뜹니다.
   저장소를 못 쓰는 브라우저(비공개 창 등)에서는 기억을 못 해 홈을 열 때마다 뜹니다.

   글은 세중님이 주신 그대로입니다(2026-11-13 브랜드 소개 두 문단 더함 — 「모두의 창업」 지원 · 의료기사 통합 앱 · 연봉 비교·합격 스펙). 문의 길은 lib/contact.ts 한 자리(카카오톡 채널 · help 메일).
   피그마 원본에 없는 조각이라 새 디자인 토큰만으로 그렸습니다(흰 카드 · radius r3 · navy 단추). */

const 숨김 = 'rapo.home-notice.hide';     // localStorage — 다시 보지 않기
const 봤음 = 'rapo.home-notice.seen';     // sessionStorage — 이번 탭에서는 닫음

const 볼까 = () => {
  try {
    if (localStorage.getItem(숨김) === '1') return false;
    if (sessionStorage.getItem(봤음) === '1') return false;
  } catch { /* 저장소가 막힌 브라우저 — 기억 없이 보여 줍니다 */ }
  return true;
};
const 구독없음 = () => () => {};

export function RapoHomeNotice() {
  /* 서버 그림에는 저장소가 없습니다 — 서버는 「안 띄움」, 브라우저에 붙은 뒤 실제 값으로 */
  const 띄움 = useSyncExternalStore(구독없음, 볼까, () => false);
  const [닫음, set닫음] = useState(false);
  const [다시안봄, set다시안봄] = useState(false);
  const 열림 = 띄움 && !닫음;

  const 닫기 = () => {
    try { sessionStorage.setItem(봤음, '1'); } catch { /* 무시 */ }
    if (다시안봄) { try { localStorage.setItem(숨김, '1'); } catch { /* 무시 */ } }
    set닫음(true);
  };

  /* Esc 로도 닫습니다 */
  useEffect(() => {
    if (!열림) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try { sessionStorage.setItem(봤음, '1'); } catch { /* 무시 */ }
      set닫음(true);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [열림]);

  if (!열림) return null;

  return (
    <div data-rapo role="dialog" aria-modal="true" aria-labelledby="home-notice-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-(--rapo-dimension-x5)"
      onClick={(e) => { if (e.target === e.currentTarget) 닫기(); }}>
      {/* 글이 길어져 작은 폰(높이 640)에서도 닫기 단추까지 닿게 — 넘치면 카드 안에서 굴립니다 */}
      <div className="flex max-h-[calc(100dvh-40px)] w-full max-w-[340px] flex-col gap-(--rapo-dimension-x5) overflow-y-auto rounded-(--rapo-radius-r3)
                      bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral) shadow-lg">
        <div className="relative mx-auto h-[31.5px] w-[120px] shrink-0">
          {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 (가로형 로고 · components/rapo/rapo-header.tsx 와 같은 자리) */}
          <img src="/rapo/home/logo-symbol.svg" alt="" className="absolute left-0 top-0 h-[31.5px] w-[32.25px]" />
          <img src="/rapo/home/logo-wordmark.svg" alt="RAPO" className="absolute bottom-[24.37%] left-[34.21%] right-[0.04%] top-[24.67%]" />
          {/* eslint-enable @next/next/no-img-element */}
        </div>

        {/* ★ 2026-11-13 세중님 「우리 팝업창에도 우리 브랜드 글을 좀 넣자」 — 세중님이 주신 뜻을 세 문단으로 다듬었습니다 */}
        <div className="flex flex-col gap-(--rapo-dimension-x3) text-center">
          <h2 id="home-notice-title" className="rapo-type-t6-bold break-keep">RAPO 는 순차적으로 오픈 중입니다</h2>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
            RAPO는 <span className="whitespace-nowrap">「모두의 창업」</span>의 지원을 받아 만들고 있는 채용·커뮤니티 통합 앱입니다.
            <span className="whitespace-nowrap">작업치료사·물리치료사를</span> 넘어 모든 의료기사가 함께 쓰는 곳을 만들고 있습니다.
          </p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
            기능은 순차적으로 열리고 있으며, 앞으로 투명한 연봉 비교와 합격 스펙까지 함께 나누는 의료기사를 위한 앱으로 거듭나겠습니다. <span className="whitespace-nowrap">지켜봐 주세요!</span>
          </p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            개선할 점이나 오류는 카카오톡 문의하기나 메일로 알려 주시면 바로 고쳐 놓겠습니다. 감사합니다.
          </p>
        </div>

        <div className="flex flex-col gap-(--rapo-dimension-x2)">
          <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer"
            className="rapo-type-t4-bold flex h-(--rapo-dimension-x12) w-full items-center justify-center rounded-(--rapo-radius-r2)
                       border border-(--rapo-color-stroke-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)">
            카카오톡 문의하기
          </a>
          <a href={`mailto:${HELP_EMAIL}`}
            className="rapo-type-t3-regular text-center underline underline-offset-2 text-(color:--rapo-color-fg-neutral-muted)">
            {HELP_EMAIL}
          </a>
        </div>

        <div className="flex flex-col gap-(--rapo-dimension-x3)">
          <label className="rapo-type-t4-regular flex min-h-(--rapo-touch-min) cursor-pointer items-center gap-(--rapo-dimension-x2)">
            <input type="checkbox" checked={다시안봄} onChange={(e) => set다시안봄(e.target.checked)}
              className="size-5 accent-(--rapo-color-bg-navy-solid)" />
            다시 보지 않기
          </label>
          <button type="button" onClick={닫기}
            className="rapo-type-t5-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r2)
                       bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-neutral-solid)">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
