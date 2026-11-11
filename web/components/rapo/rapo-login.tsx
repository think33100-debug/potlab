'use client';

import type { Provider } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LoginMethod } from '@/lib/last-login';

/* 로그인 화면 조각 — 새 디자인 「U04-01 / 로그인」 (2026-11-11).
   실제 로그인(app/login/page.tsx)과 견본(app/design-preview/login)이 같이 씁니다.
   원본 위치와 바뀐 점은 app/login/page.tsx 머리에 있습니다. */

export type Method = { key: LoginMethod; label: string; cls: string; icon: string; oauth: Provider; 이름: string };

export const METHODS: Method[] = [
  { key: 'kakao', label: '카카오로 계속하기', cls: 'bg-[#fee500] text-[#1a140d]', icon: '/rapo/login/kakao-20.svg', oauth: 'kakao', 이름: '카카오' },
  { key: 'naver', label: '네이버로 계속하기', cls: 'bg-[#03c75a] text-white', icon: '/rapo/login/naver-20.svg', oauth: 'custom:naver', 이름: '네이버' },
  { key: 'apple', label: 'Apple로 계속하기', cls: 'bg-black text-white', icon: '/rapo/login/apple-20.svg', oauth: 'apple', 이름: 'Apple' },
];
/* 소셜 단추 꼴 — 원본 「RAPO / B GUI / 소셜 로그인」 52px · radius 8 · 16/22 Bold */
export const 넓은단추 = 'rapo-type-t5-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r2)';

/* 화면 틀 — 남색 바탕 · 사진(위 120 · 높이 560) · 상하 명암 · 브랜드 메시지 · 아래 행동.
   원본은 414 폭 한 장이라 넓은 화면에서는 480 기둥 가운데에 둡니다 (사진 자르기 비율이 원본과 같게) */
/* 원본 세 장의 자르기 자리 — 왼쪽은 414 폭에 대한 %, 위는 px (사진 2 · 3 · 4) */
const 사진자리 = [
  { left: '-116.62%', top: -45.9 },
  { left: '-6.16%', top: -658.75 },
  { left: '-116.62%', top: -658.75 },
];

export function 로그인틀({ 아래 }: { 아래: ReactNode }) {
  return (
    <div data-rapo className="min-h-dvh bg-(--rapo-color-bg-navy-solid)">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden text-(color:--rapo-color-fg-on-neutral-solid)">
        {/* 사진 — 원본 「사진 2·3·4 / 커뮤니티」: 같은 사진(923.1×1230.8)을 414×560 틀에 세 군데로 잘라 번갈아 보입니다
            (2026-11-12 세중님 「그림이 더 나오지 않았나」). 폭 비율로 옮김. 움직임 줄이기를 켠 기기에서는 첫 장만 */}
        <div aria-hidden className="absolute inset-x-0 top-[120px] h-[560px] overflow-hidden">
          {/* ★ 화질 (2026-11-11 대표 「깨져」): 피그마 원본 자체가 1086×1448 뿐이라 이 자르기는 휴대폰에서 약 2.5배로 늘어납니다.
              그래서 원본 PNG 를 곱게 2배로 키우고(lanczos3 + 약한 선명하게) WebP 88 로 한 번만 담습니다. unoptimized — Next 가 품질 75 로 또 줄이지 않게.
              더 선명하려면 같은 사진의 큰 원본(가로 2600px 이상)이 있어야 합니다 */}
          {사진자리.map((p, i) => (
            <Image key={i} src="/rapo/login/photo-colleagues.webp" alt="" width={2172} height={2896} loading="eager" unoptimized
              className={'rapo-login-photo absolute max-w-none' + (i === 0 ? ' rapo-login-photo-first' : '')}
              style={{ width: '222.97%', height: 'auto', left: p.left, top: p.top, animationDelay: `${i * 5 - 1.05}s` }} />
          ))}
        </div>
        {/* 가독성 / 상하 명암 — 원본 그라디언트 그대로 (#112231 = brand navy) */}
        <div aria-hidden className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(180deg, rgb(17,34,49) 0%, rgb(17,34,49) 13.5%, rgba(17,34,49,0.35) 30%, rgba(17,34,49,0.04) 45%, rgba(17,34,49,0.8) 65%, rgb(17,34,49) 76%, rgb(17,34,49) 100%)',
        }} />

        {/* 브랜드 메시지 */}
        <div className="relative flex flex-col gap-(--rapo-dimension-x5) px-(--rapo-dimension-x6) pb-(--rapo-dimension-x6) pt-(--rapo-dimension-x16)">
          <Link href="/" aria-label="RAPO 홈" className="relative block h-[31.5px] w-[120px] shrink-0">
            {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 (흰 워드마크 「로고 / inverse」 1225:1298) */}
            <img src="/rapo/home/logo-symbol.svg" alt="" className="absolute left-0 top-0 h-[31.5px] w-[32.25px]" />
            <img src="/rapo/login/wordmark-inverse.svg" alt=""
              className="absolute bottom-[24.37%] left-[34.21%] right-[0.04%] top-[24.67%]" />
            {/* eslint-enable @next/next/no-img-element */}
          </Link>
          <h1 className="rapo-type-t12-bold">동료의 이야기를<br />더 가까이</h1>
          <p className="rapo-type-t5-regular">로그인하고 대화를 이어가세요.</p>
        </div>

        <div className="flex-1" />

        {/* 로그인 행동 — 원본 「RAPO / B / 로그인 행동 / 투명」 1232:555 (24 여백 · 16 간격) */}
        <div className="relative flex flex-col gap-(--rapo-dimension-x4) p-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x6)+env(safe-area-inset-bottom))]">
          {아래}
        </div>
      </main>
    </div>
  );
}

/* 최근 로그인 / 말풍선 — 원본 1540:6111 (흰 바탕 · radius 12 · 14/19 · 아래 왼쪽 꼬리) */
function 최근말풍선({ children }: { children: ReactNode }) {
  return (
    <p className="rapo-type-t4-regular relative w-fit rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-layer-default) px-[14px] py-[10px]
                  text-(color:--rapo-color-bg-navy-solid)">
      {children}
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/login/bubble-tail.svg" alt="" width={10.4} height={6} className="absolute left-[17px] top-full rotate-180" />
    </p>
  );
}

/* 소셜 단추 셋과 말풍선 — 원본 「간편 로그인」 1232:538. 최근 수단이 있으면 그 단추 바로 위에 말풍선 */
export function RapoLoginButtons({ last, busy, onStart }: {
  last: LoginMethod | null; busy: LoginMethod | null; onStart?: (m: Method) => void;
}) {
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x3)">
      {METHODS.map((m) => (
        <div key={m.key} className="flex flex-col gap-(--rapo-dimension-x3)">
          {last === m.key && <최근말풍선>최근에 {m.이름}로 만났어요</최근말풍선>}
          <button
            type="button" disabled={busy !== null} onClick={() => onStart?.(m)} aria-busy={busy === m.key || undefined}
            className={`${넓은단추} gap-(--rapo-dimension-x3) px-(--rapo-dimension-x5) ${m.cls} disabled:opacity-60`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src={m.icon} alt="" width={20} height={20} className="shrink-0" />
            <span className="flex-1 text-center">{busy === m.key ? '넘어가는 중…' : m.label}</span>
            {/* 원본 「중앙 정렬 여백」 20px — 글자가 단추 한가운데 오게 */}
            <span aria-hidden className="size-5 shrink-0" />
          </button>
        </div>
      ))}
    </div>
  );
}
