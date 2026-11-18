import Image from 'next/image';

import { RapoOpenFrame } from './rapo-open-frame';
import { RapoSectionTitle } from './rapo-ui';

/* 홈 「라포 이야기」 — 브랜드 가치·스토리 (2026-11-18 세중님 「라포가 뭐고 라포를 써야 하는 이유」).
   자리 — 홈 「라포에서 시작하기」 바로 아래 (home-u01.tsx).

   4판 (같은 날 세중님 「디자인 지침에 맞게 · 피그마 디자인 요소 확인」) — Figma 「02 · 브랜드·BI·콘텐츠 가이드」를 따릅니다.
     · 글     「01 · 브랜드 소개 › 브랜드 스토리」(33:29) 원문 — 제목 「열고, 모으고, 연결하다.」 · 첫 줄 · 「우리가 지키는 태도」
     · 세 줄  「로고의 구성과 의미」(33:43) 꼴 — 미스트 카드 + 코럴 숫자 01·02·03. 전에 그린 작은 그림 셋은 뺐습니다
              (가이드에 없는 그림이었고, 「열고」 화살표가 네모 **밖**을 향했습니다 — 가이드는 「화살표의 머리는 네모 안」)
     · 약속   「03 · 그래픽 시스템 › 프레임 활용 A · 사진 둘레에 배치」(91:283) — 사진을 크게, 제목은 단색 바탕에 따로,
              코럴 열린 프레임. 사진 설명 자리 바탕은 **미스트**(34:159 「사진 설명 영역의 배경」 · 전에는 블러시였음)
     · 글자   섹션 제목은 앱 공통 RapoSectionTitle, 카드 제목 t6-bold, 본문 t5·t4. 모서리는 가이드 4px(r1)
     · 색     코럴(강조·프레임) · 네이비(제목·본문) · 화이트(바탕) · 미스트·블러시만 */

const 세줄 = [
  { 번호: '01', 낱말: '열고', 제목: '현장의 조건을 열어 봐요', 설명: '병원별 근무 후기와 조건을 살펴봐요.' },
  { 번호: '02', 낱말: '모으고', 제목: '흩어진 공고를 한곳에', 설명: '공공기관·종합병원·대학병원 공고를 모아요.' },
  { 번호: '03', 낱말: '연결하다', 제목: '동료의 경험을 나눠요', 설명: '익명으로 묻고 답하며 서로의 선택을 도와요.' },
];

const 흐림 = 'text-(color:--rapo-color-fg-neutral-muted)';

export function RapoBrandStory() {
  return (
    <section aria-labelledby="rapo-home-brand"
      className="flex flex-col gap-(--rapo-dimension-x6) bg-(--rapo-brand-color-white) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8)">

      {/* 머리 — 작은 코럴 표제 + 섹션 제목 + 브랜드 스토리 첫 줄(33:30 원문) */}
      <header className="flex flex-col gap-(--rapo-dimension-x2)">
        <p className="rapo-type-t2-bold text-(color:--rapo-brand-color-coral)">라포 이야기</p>
        <RapoSectionTitle id="rapo-home-brand">열고, 모으고, 연결하다.</RapoSectionTitle>
        <p className="rapo-type-t5-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-brand-color-navy)">
          <span className="block">같은 현장에서 일해도,</span>
          <span className="block">알고 있는 정보와 얻을 수 있는 기회는</span>
          <span className="block">사람마다 다릅니다.</span>
        </p>
      </header>

      {/* 세 낱말 — 미스트 카드 · 코럴 숫자 (33:43 꼴) */}
      <ol className="flex flex-col gap-(--rapo-dimension-x2)">
        {세줄.map((r) => (
          <li key={r.번호}
            className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1) bg-(--rapo-brand-color-mist) p-(--rapo-dimension-x5)">
            <p className="flex items-baseline gap-(--rapo-dimension-x2)">
              <span className="rapo-type-t9-bold text-(color:--rapo-brand-color-coral)">{r.번호}</span>
              <span className="rapo-type-t4-bold text-(color:--rapo-brand-color-coral)">{r.낱말}</span>
            </p>
            <p className="rapo-type-t6-bold mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-brand-color-navy)">{r.제목}</p>
            <p className={`rapo-type-t4-regular break-keep ${흐림}`}>{r.설명}</p>
          </li>
        ))}
      </ol>

      {/* 라포의 약속 — 프레임 활용 A(사진 둘레에 배치) · 「무엇이든 익명으로」
          사진은 세중님이 ChatGPT 로 만든 「새끼손가락 약속」(1536×1024 · 사진 가이드 공통 글 · 2026-11-18 「이걸로 해보자」)
          unoptimized — 2026-11-18 세중님 「폰으로 보니 화질이 구리다」. 원본이 이미 압축된 webp(144KB)인데 Next 이미지 변환이
          품질 75 로 한 번 더 눌러 얼굴이 뭉갰습니다. 원본 그대로 보냅니다(폰 3배 화면에 필요한 폭 ~1000px 보다 원본 1536px 이 큼) */}
      <div className="relative overflow-hidden rounded-(--rapo-radius-r1) bg-(--rapo-brand-color-mist)">
        <div className="relative aspect-[16/9] w-full min-[560px]:aspect-[5/2]">
          <Image src="/rapo/home/promise-pinky.webp" alt="" fill unoptimized aria-hidden
            className="object-cover object-[50%_45%] min-[560px]:object-[50%_48%]" />
        </div>
        <div className="flex flex-col gap-(--rapo-dimension-x2) px-(--rapo-dimension-x8) pb-(--rapo-dimension-x10) pt-(--rapo-dimension-x6)">
          <p className="rapo-type-t2-bold text-(color:--rapo-brand-color-coral)">라포의 약속</p>
          <h3 className="rapo-type-t8-bold text-(color:--rapo-brand-color-navy)">
            <span className="block">무엇이든</span>
            <span className="block"><span className="text-(color:--rapo-brand-color-coral)">익명</span>으로 물어봐요</span>
          </h3>
          {/* 「우리가 지키는 태도」(33:33) 원문 */}
          <p className={`rapo-type-t4-regular break-keep ${흐림}`}>
            <span className="block">정보는 정확하게 전하고,</span>
            <span className="block">서로 다른 경험은 존중합니다.</span>
          </p>
        </div>
        <RapoOpenFrame className="inset-(--rapo-dimension-x4)" />
      </div>
    </section>
  );
}
