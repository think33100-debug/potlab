import Link from 'next/link';

import { RapoOpenFrame } from './rapo-open-frame';
import { 스펙비교길 } from './rapo-spec-entry';
import { RapoButton, RapoSectionTitle } from './rapo-ui';

/* 홈 「학생·취준생이라면」 — 2026-11-18 세중님 「학생들도 주 타겟이라 학생들이 이용할 수 있는 기능이랑
   학생들이 보고 이용하고 싶어지는 것도 넣어야」. 자리 — 홈 「라포 이야기」 바로 아래 (home-u01.tsx).

   2판 (같은 날 세중님 「디자인 지침에 맞게 · 피그마 디자인 요소 확인」) — Figma 「02 · 브랜드·BI·콘텐츠 가이드」를 따릅니다.
     · 스펙 비교  「프레임 활용 C · 질문 둘레에 배치」(91:283) — 네이비 바탕 + 코럴 열린 프레임 + 질문 하나.
                 단추는 공통 「RAPO / Button / Filled · BI coral · 40」(172:18). 전의 그라데이션 막대는 가이드에 없어 뺐습니다
     · 네 줄     「06 · 콘텐츠 적용 › 정보형」(102:1876) 꼴 — 01·02·… 번호와 한 줄 설명. 전의 연두·하늘색 칸과 3D 그림은
                 브랜드 색(코럴·네이비·화이트·블러시·미스트) 밖이라 뺐습니다
     · 무료 안내  블러시 = 「강조 문구의 배경」(34:159)
     · 말투      브랜드 보이스(32:21) — 막연한 장점 대신 확인할 수 있는 것을 짚습니다

   **지금 앱에 열려 있는 것만** 이었습니다 (새 기능 · 새 주소 없음) —
     취업 스펙 비교 /spec/compare · 병원 둘러보기 /orgs · 지난 채용 경쟁률 /compete ·
     봉사활동 /volunteer · 청년정책 /youth · 졸업 후 1년 무료(lib/school-period.ts — 가입 끝 화면이 이미 보여 주는 말)
   안 적은 것 — 실습 후기·학생 커뮤니티(학생인증 뒤에 엶 · 아직 안 열림). */

const 줄들 = [
  /* 2026-11-18 세중님 「1번 신입 가능 공고를 병원 둘러보기로 · 경쟁률 설명은 「공공기관 경쟁률을 정리했어요」」 */
  { 번호: '01', 제목: '병원 둘러보기', 설명: '병원 규모와 치료사 수를 살펴봐요.', href: '/orgs' },
  { 번호: '02', 제목: '지난 채용 경쟁률', 설명: '공공기관 경쟁률을 정리했어요.', href: '/compete' },
  { 번호: '03', 제목: '봉사활동', 설명: '지역별 모집 중인 봉사를 찾아요.', href: '/volunteer' },
  { 번호: '04', 제목: '청년정책', 설명: '받을 수 있는 청년 지원을 봐요.', href: '/youth' },
];

export function RapoStudentCorner() {
  return (
    <section aria-labelledby="rapo-home-student"
      className="flex flex-col gap-(--rapo-dimension-x6) bg-(--rapo-brand-color-white) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8)">

      {/* 머리 — 2026-11-18 세중님 「학생·취준생이라면 단어를 더 키워서 학생·취준생도 이용할 수 있게 이끌기」
          작은 표제였던 「학생·취준생이라면」을 섹션 제목으로 올리고, 「학생·취준생」을 코럴(강조 표시)로 둡니다 */}
      <header className="flex flex-col gap-(--rapo-dimension-x2)">
        <RapoSectionTitle id="rapo-home-student">
          <span className="text-(color:--rapo-brand-color-coral)">학생·취준생</span>이라면
        </RapoSectionTitle>
        <p className="rapo-type-t5-regular break-keep text-(color:--rapo-brand-color-navy)">
          <span className="block">첫 직장 준비,</span>
          <span className="block">라포에서 함께 시작해요.</span>
        </p>
        <p className="rapo-type-t4-medium mt-(--rapo-dimension-x1) break-keep rounded-(--rapo-radius-r1) bg-(--rapo-brand-color-blush) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-(color:--rapo-brand-color-navy)">
          학생·취준생은 <b className="font-bold text-(color:--rapo-brand-color-coral)">졸업 후 1년까지 무료</b>로 써요.
        </p>
      </header>

      {/* 취업 스펙 비교 — 프레임 활용 C (질문 둘레에 배치) */}
      <div className="relative rounded-(--rapo-radius-r1) bg-(--rapo-brand-color-navy) px-(--rapo-dimension-x8) pb-(--rapo-dimension-x10) pt-(--rapo-dimension-x10)">
        <RapoOpenFrame className="inset-(--rapo-dimension-x4)" />
        <div className="relative flex flex-col gap-(--rapo-dimension-x3)">
          <p className="rapo-type-t2-regular text-(color:--rapo-brand-color-white) opacity-80">라포 취업 스펙 비교</p>
          <h3 className="rapo-type-t8-bold text-(color:--rapo-brand-color-white)">
            <span className="block">내 스펙은</span>
            <span className="block">준비생 중 어디쯤일까요?</span>
          </h3>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-brand-color-white)">
            <span className="block">학점·자격·실습·어학을 넣으면</span>
            <span className="block">같은 직군 준비생과 견줘 볼 수 있어요.</span>
          </p>
          <RapoButton href={스펙비교길} tone="coral" size={40} className="mt-(--rapo-dimension-x2) self-start">
            내 스펙 점수 보기
          </RapoButton>
        </div>
      </div>

      {/* 정보형 — 번호와 한 줄 설명 (102:1876 꼴) */}
      <ol className="flex flex-col rounded-(--rapo-radius-r1) bg-(--rapo-brand-color-mist) px-(--rapo-dimension-x5) py-(--rapo-dimension-x2)">
        {줄들.map((r, i) => (
          <li key={r.href} className={i > 0 ? 'border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak)' : ''}>
            <Link href={r.href} className="flex items-center gap-(--rapo-dimension-x3) py-(--rapo-dimension-x4) active:opacity-70">
              <span className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
                <span className="rapo-type-t6-bold flex gap-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">
                  <span>{r.번호}</span><span>{r.제목}</span>
                </span>
                <span className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{r.설명}</span>
              </span>
              <span aria-hidden className="rapo-type-t8-regular shrink-0 text-(color:--rapo-brand-color-navy)">›</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
