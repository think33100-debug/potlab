import Link from 'next/link';

import { 스펙비교길 } from './rapo-spec-entry';

/* 홈 「학생·취준생이라면」 — 2026-11-18 세중님 「학생들도 주 타겟이라 학생들이 이용할 수 있는 기능이랑
   학생들이 보고 이용하고 싶어지는 것도 넣어야」.
   자리 — 홈 「라포 이야기」 바로 아래 (home-u01.tsx).

   **지금 앱에 열려 있는 것만** 모았습니다 (새 기능 없음 · 새 주소 없음) —
     취업 스펙 비교   /spec/compare (학생끼리 · 20명부터 상위 % · 2026-11-17)
     신입 가능 공고   /jobs?new=1 (2026-11-14)
     지난 채용 경쟁률  /compete
     봉사활동 · 청년정책  /volunteer · /youth
     졸업 후 1년 무료  lib/school-period.ts 무료끝날 — 가입 끝 화면이 이미 보여 주는 말입니다
   안 적은 것 — 실습 후기·학생 커뮤니티(학생인증 뒤에 엶 · 아직 안 열림). */

const 칸들 = [
  { 제목: '신입 가능 공고', 설명: '경력 없이 지원해요', href: '/jobs?new=1',
    bg: 'bg-(--rapo-brand-color-mist)', 그림: '/rapo/home/graphic-hospital-28.svg' },
  { 제목: '지난 채용 경쟁률', 설명: '공공병원 공개 자료', href: '/compete',
    bg: 'bg-(--rapo-brand-color-blush)', 그림: '/rapo/home/graphic-cert-28.svg' },
  { 제목: '봉사활동', 설명: '지역별 모집 봉사', href: '/volunteer',
    bg: 'bg-(--rapo-color-palette-green-100)', 그림: '/rapo/home/graphic-volunteer-28.svg' },
  { 제목: '청년정책', 설명: '받을 수 있는 지원', href: '/youth',
    bg: 'bg-(--rapo-color-palette-blue-100)', 그림: '/rapo/home/graphic-youth-28.svg' },
];

export function RapoStudentCorner() {
  return (
    <section aria-labelledby="rapo-home-student"
      className="flex flex-col gap-(--rapo-dimension-x5) bg-(--rapo-brand-color-white) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8)">

      {/* 머리 */}
      <header className="flex flex-col gap-(--rapo-dimension-x2)">
        <p className="rapo-type-t3-bold text-(color:--rapo-brand-color-coral)">학생·취준생이라면</p>
        <h2 id="rapo-home-student" className="rapo-type-t9-bold text-(color:--rapo-brand-color-navy)">
          <span className="block">첫 직장,</span>
          <span className="block">미리 보고 준비해요</span>
        </h2>
        <p className="rapo-type-t3-bold mt-(--rapo-dimension-x1) self-start rounded-full bg-(--rapo-brand-color-blush) px-(--rapo-dimension-x3) py-(--rapo-dimension-x1) text-(color:--rapo-brand-color-coral)">
          졸업 후 1년까지 무료로 써요
        </p>
      </header>

      {/* 큰 카드 — 취업 스펙 비교 */}
      <Link href={스펙비교길}
        className="flex flex-col gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-navy) p-(--rapo-dimension-x5) active:bg-(--rapo-color-bg-navy-solid-pressed)">
        <span className="flex flex-col gap-(--rapo-dimension-x1)">
          <span className="rapo-type-t3-bold text-(color:--rapo-brand-color-coral)">취업 스펙 비교</span>
          <span className="rapo-type-t8-bold text-(color:--rapo-brand-color-white)">
            <span className="block">내 스펙,</span>
            <span className="block">준비생 중 어디쯤일까?</span>
          </span>
          {/* 줄은 뜻 단위로 직접 나눕니다 — 「봐요」만 혼자 떨어졌습니다 (2026-11-18 · 375 폭) */}
          <span className="rapo-type-t3-regular break-keep text-white/80">
            <span className="block">학점·자격·실습·어학을 넣으면</span>
            <span className="block">같은 직군 준비생과 견줘 봐요</span>
          </span>
        </span>

        {/* 꾸밈 — 막대 위 「나」 (숫자 없음 · 실제 점수 아님) */}
        <span aria-hidden className="relative block pb-(--rapo-dimension-x1) pt-(--rapo-dimension-x6)">
          <span className="absolute left-[62%] top-0 -translate-x-1/2 rounded-full bg-(--rapo-brand-color-coral) px-(--rapo-dimension-x2) text-[11px] font-bold leading-[18px] text-(color:--rapo-brand-color-white)">나</span>
          <span className="absolute left-[62%] top-[18px] h-[6px] w-[2px] -translate-x-1/2 bg-(--rapo-brand-color-coral)" />
          <span className="block h-[8px] w-full overflow-hidden rounded-full bg-white/15">
            <span className="block h-full w-[62%] rounded-full bg-gradient-to-r from-white/30 to-(--rapo-brand-color-coral)" />
          </span>
        </span>

        <span className="rapo-type-t4-bold self-start rounded-full bg-(--rapo-brand-color-white) px-(--rapo-dimension-x4) py-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">
          내 스펙 점수 보기 →
        </span>
      </Link>

      {/* 작은 칸 넷 */}
      <ul className="grid grid-cols-2 gap-(--rapo-dimension-x2)">
        {칸들.map((c) => (
          <li key={c.href}>
            <Link href={c.href}
              className={`flex h-full flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) p-(--rapo-dimension-x4) active:brightness-95 ${c.bg}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 툴킷 SVG 그림 */}
              <img aria-hidden src={c.그림} alt="" width={32} height={32} className="size-[32px]" />
              <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{c.제목}</span>
              <span className="rapo-type-t3-regular break-keep text-[#3F4C57]">{c.설명}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
