import Image from 'next/image';
import type { ReactNode } from 'react';

/* 홈 「라포 이야기」 — 브랜드 가치·스토리 (2026-11-18 세중님 「라포가 뭐고 라포를 써야 하는 이유」).
   자리 — 홈 「라포에서 시작하기」 바로 아래 (home-u01.tsx).

   3판 (같은 날 세중님) —
     · 「우리가 나눈 정보, 우리가 바꿀 내일」은 **첫 배너**로 올렸습니다(home-u01.tsx Banners 1).
       그래서 여기 머리는 「열고, 모으고, 연결하다」입니다
     · 세 낱말마다 작은 그림 — 로고 뜻(열린 네모 · 들어오는 움직임 · 이어짐)을 빌려 그렸습니다
     · 끝의 남색 카드는 뺐습니다(배너와 겹침)
     · 라포의 약속에 치료사 사진(Figma 사진 가이드 · public/rapo/home/promise-talk.png) · 「무엇이든 익명으로」를 크게

   글의 뿌리 — Figma 「02 · 브랜드·BI·콘텐츠 가이드 › 01 · 브랜드 소개」(32:17).
   세 줄의 제목·설명 · 약속 첫 줄은 새로 쓴 글입니다. 아직 안 열린 기능(연봉 비교)은 안 적습니다. */

/* 그림 셋 — 24px 칸, 코럴 선 2px. 색은 currentColor 로 받습니다 */
const 그림: Record<string, ReactNode> = {
  /* 열고 — 오른쪽 위가 열린 네모(로고의 열린 네모) + 밖으로 나가는 화살표 */
  열고: (
    <>
      <path d="M14 5H5v14h14v-9" />
      <path d="M12 12l8-8M15 4h5v5" />
    </>
  ),
  /* 모으고 — 세 갈래가 한 칸으로 모임 */
  모으고: (
    <>
      <path d="M5 4l5 7M19 4l-5 7M12 3v8" />
      <path d="M4 14v6h16v-6" />
    </>
  ),
  /* 연결하다 — 두 사람을 잇는 선 */
  연결하다: (
    <>
      <circle cx="6.5" cy="7.5" r="2.5" />
      <circle cx="17.5" cy="7.5" r="2.5" />
      <path d="M2.5 19c0-3 1.8-5 4-5s4 2 4 5M13.5 19c0-3 1.8-5 4-5s4 2 4 5" />
      <path d="M9 7.5h6" strokeDasharray="1.5 2" />
    </>
  ),
};

const 세줄 = [
  { 낱말: '열고', 제목: '현장의 조건을 열어 봐요', 설명: '병원별 근무 후기와 조건을 살펴봐요' },
  { 낱말: '모으고', 제목: '흩어진 공고를 한곳에', 설명: '공공기관·종합병원·대학병원 공고를 모아요' },
  { 낱말: '연결하다', 제목: '동료의 경험을 나눠요', 설명: '익명으로 묻고 답하며 서로의 선택을 도와요' },
];

const 약속 = ['정보는 정확하게 전해요', '서로 다른 경험은 존중해요'];

function CheckMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-[1px] shrink-0">
      <circle cx="10" cy="10" r="10" className="fill-(--rapo-brand-color-white)" />
      <path d="M6 10.2l2.6 2.6L14 7.4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-(--rapo-brand-color-coral)" />
    </svg>
  );
}

export function RapoBrandStory() {
  return (
    <section aria-labelledby="rapo-home-brand"
      className="flex flex-col gap-(--rapo-dimension-x6) bg-(--rapo-brand-color-white) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8)">

      {/* 머리 */}
      <header className="flex flex-col gap-(--rapo-dimension-x2)">
        <p className="rapo-type-t3-bold text-(color:--rapo-brand-color-coral)">라포 이야기</p>
        <h2 id="rapo-home-brand" className="rapo-type-t9-bold text-(color:--rapo-brand-color-navy)">열고, 모으고, 연결하다</h2>
        <p className="rapo-type-t4-regular break-keep text-[#3F4C57]">
          재활치료 현장의 일자리 정보와 경험을 나누는 곳이에요.
        </p>
      </header>

      {/* 세 낱말 */}
      <ul className="flex flex-col gap-(--rapo-dimension-x2)">
        {세줄.map((r) => (
          <li key={r.낱말} className="flex items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-mist) p-(--rapo-dimension-x4)">
            <span aria-hidden className="flex size-[48px] shrink-0 items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-white) text-(color:--rapo-brand-color-coral)">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">{그림[r.낱말]}</svg>
            </span>
            <span className="flex min-w-0 flex-col gap-(--rapo-dimension-x0_5)">
              <span className="rapo-type-t2-bold text-(color:--rapo-brand-color-coral)">{r.낱말}</span>
              <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{r.제목}</span>
              <span className="rapo-type-t3-regular break-keep text-[#3F4C57]">{r.설명}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* 라포의 약속 — 치료사 사진 · 「무엇이든 익명으로」
          사진은 세중님이 ChatGPT 로 만든 「새끼손가락 약속」(1536×1024 · Figma 사진 가이드 공통 글 · 2026-11-18 「이걸로 해보자」).
          그 전 — Figma 업무인계 사진(promise-talk.png) · 그 전 — 오린 그림(banner1-therapist.png, 세중님 「별로」) */}
      <div className="overflow-hidden rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-blush)">
        <div className="relative aspect-[16/9] w-full min-[560px]:aspect-[5/2]">
          <Image src="/rapo/home/promise-pinky.webp" alt="" fill sizes="(min-width: 768px) 728px, 100vw" aria-hidden
            className="object-cover object-[50%_45%] min-[560px]:object-[50%_48%]" />
        </div>
        <div className="px-(--rapo-dimension-x5) pt-(--rapo-dimension-x5)">
          <p className="rapo-type-t3-bold text-(color:--rapo-brand-color-coral)">라포의 약속</p>
          <h3 className="rapo-type-t8-bold mt-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">
            <span className="block text-(color:--rapo-brand-color-coral)">무엇이든 익명으로</span>
            <span className="block">물어봐요</span>
          </h3>
        </div>
        <ul className="flex flex-col gap-(--rapo-dimension-x2) px-(--rapo-dimension-x5) pb-(--rapo-dimension-x5) pt-(--rapo-dimension-x4)">
          {약속.map((t) => (
            <li key={t} className="rapo-type-t4-medium flex items-start gap-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">
              <CheckMark />{t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
