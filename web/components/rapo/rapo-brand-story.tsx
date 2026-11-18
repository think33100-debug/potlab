/* 홈 「라포 이야기」 — 브랜드 가치·스토리 시안 (2026-11-18 세중님 「라포가 뭐고 라포를 써야 하는 이유」).

   2판 (같은 날 세중님 「위가 글이 많아 가독성이 떨어짐 · 더 세련되게 · 읽기 좋게」) —
     ① 머리: 어두운 판을 걷고, 제목 두 줄 + 한 문장만
     ② 「열고 · 모으고 · 연결하다」 세 줄: 왼쪽 낱말(코럴) · 오른쪽 제목 한 줄 + 짧은 설명
     ③ 라포의 약속 두 줄(체크)
     ④ 끝 카드 — 존재 이유 한 문장 (네이비 · 흰 로고 연하게)

   글의 뿌리 — Figma 「02 · 브랜드·BI·콘텐츠 가이드 › 01 · 브랜드 소개」(32:17):
     제목 「우리가 나눈 정보, 우리가 바꿀 내일」 · 「열고, 모으고, 연결하다.」 · 존재 이유 · 지키는 태도.
   세 줄의 제목·설명과 머리 한 문장은 이번에 새로 줄여 쓴 글입니다. 아직 안 열린 기능(연봉 비교)은 안 적습니다.
   ★ 시안입니다. 실제 홈에는 아직 안 붙였습니다 (design-preview/home?brand=1 에서만 보입니다). */

const 세줄 = [
  { 낱말: '열고', 제목: '현장의 조건을 열어 봐요', 설명: '병원별 근무 후기와 조건을 살펴봐요' },
  { 낱말: '모으고', 제목: '흩어진 공고를 한곳에', 설명: '공공기관·종합병원·대학병원 공고를 모아요' },
  { 낱말: '연결하다', 제목: '동료의 경험을 나눠요', 설명: '익명으로 묻고 답하며 서로의 선택을 도와요' },
];

const 약속 = ['정보는 정확하게 전해요', '서로 다른 경험은 존중해요'];

function CheckMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-[1px] shrink-0">
      <circle cx="10" cy="10" r="10" className="fill-(--rapo-brand-color-blush)" />
      <path d="M6 10.2l2.6 2.6L14 7.4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-(--rapo-brand-color-coral)" />
    </svg>
  );
}

export function RapoBrandStory() {
  return (
    <section aria-labelledby="rapo-home-brand"
      className="flex flex-col gap-(--rapo-dimension-x6) bg-(--rapo-brand-color-white) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8)">

      {/* ① 머리 */}
      <header className="flex flex-col gap-(--rapo-dimension-x2)">
        <p className="rapo-type-t3-bold text-(color:--rapo-brand-color-coral)">라포 이야기</p>
        <h2 id="rapo-home-brand" className="rapo-type-t9-bold text-(color:--rapo-brand-color-navy)">
          <span className="block">우리가 나눈 정보,</span>
          <span className="block">우리가 바꿀 내일</span>
        </h2>
        <p className="rapo-type-t4-regular break-keep text-[#3F4C57]">
          재활치료 현장의 일자리 정보와 경험을 나누는 곳이에요.
        </p>
      </header>

      {/* ② 열고 · 모으고 · 연결하다 */}
      <div className="flex flex-col gap-(--rapo-dimension-x3)">
        <h3 className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">열고, 모으고, 연결하다</h3>
        <ul className="divide-y divide-(--rapo-brand-color-line) rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-mist) px-(--rapo-dimension-x4)">
          {세줄.map((r) => (
            <li key={r.낱말} className="flex items-start gap-(--rapo-dimension-x3) py-(--rapo-dimension-x4)">
              <span className="rapo-type-t5-bold w-[64px] shrink-0 text-(color:--rapo-brand-color-coral)">{r.낱말}</span>
              <span className="flex min-w-0 flex-col gap-(--rapo-dimension-x0_5)">
                <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{r.제목}</span>
                <span className="rapo-type-t3-regular break-keep text-[#3F4C57]">{r.설명}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ③ 라포의 약속 */}
      <div className="flex flex-col gap-(--rapo-dimension-x3)">
        <h3 className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">라포의 약속</h3>
        <ul className="flex flex-col gap-(--rapo-dimension-x2)">
          {약속.map((t) => (
            <li key={t} className="rapo-type-t4-medium flex items-start gap-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">
              <CheckMark />{t}
            </li>
          ))}
        </ul>
      </div>

      {/* ④ 끝 카드 — 존재 이유 */}
      <div className="relative overflow-hidden rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-navy) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)">
        {/* eslint-disable-next-line @next/next/no-img-element -- 로고 심볼 SVG 를 흰색으로 연하게 */}
        <img aria-hidden src="/rapo/home/logo-symbol.svg" alt="" width={110} height={110}
          className="pointer-events-none absolute -bottom-[14px] -right-[10px] h-auto w-[110px] opacity-15 [filter:brightness(0)_invert(1)]" />
        <p className="rapo-type-t2-bold relative text-(color:--rapo-brand-color-coral)">라포가 있는 이유</p>
        <p className="rapo-type-t6-bold relative mt-(--rapo-dimension-x2) pr-[72px] text-(color:--rapo-brand-color-white)">
          <span className="block">정보와 경험을 나누어,</span>
          <span className="block">더 나은 선택과 일터를</span>
          <span className="block">함께 만들어 갑니다.</span>
        </p>
      </div>
    </section>
  );
}
