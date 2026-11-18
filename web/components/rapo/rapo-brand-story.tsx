/* 홈 「라포 이야기」 — 브랜드 가치·스토리 시안 (2026-11-18 세중님 「라포가 뭐고 라포를 써야 하는 이유」).

   글은 Figma 「02 · 브랜드·BI·콘텐츠 가이드 › 01 · 브랜드 소개」(32:17) 글 그대로입니다 —
     머리 「우리가 나눈 정보, 우리가 바꿀 내일」 · 소개 문단 · 브랜드 스토리 「열고, 모으고, 연결하다.」
     · 존재 이유 · 우리가 지키는 태도.
   「라포를 쓰는 이유」 세 장만 이번에 새로 쓴 글입니다(스토리의 세 낱말에 지금 있는 기능을 붙임).
   아직 열리지 않은 기능(연봉 비교 등)은 적지 않습니다.

   색 — 브랜드 가이드의 판 색 그대로: 머리 판 navy · 이유 카드 mist · 태도 blush · 숫자 coral.
   ★ 시안입니다. 실제 홈에는 아직 안 붙였습니다 (design-preview/home?brand=1 에서만 보입니다). */

const 이유들 = [
  { 낱말: '열고', 제목: '현장의 조건을 열어 봐요', 설명: '병원별 근무 후기와 조건을 살펴보고 나에게 맞는 일을 찾아요.' },
  { 낱말: '모으고', 제목: '흩어진 공고를 한곳에', 설명: '공공기관·종합병원·대학병원 채용 공고를 모아서 보여 드려요.' },
  { 낱말: '연결하다', 제목: '동료의 경험을 나눠요', 설명: '익명으로 묻고 답하며 서로의 선택을 도와요.' },
];

export function RapoBrandStory() {
  return (
    <section aria-labelledby="rapo-home-brand" className="flex flex-col bg-(--rapo-brand-color-white)">
      {/* 머리 판 — 라포가 뭐예요 */}
      <div className="relative overflow-hidden bg-(--rapo-brand-color-navy) px-(--rapo-dimension-x5) py-(--rapo-dimension-x8)">
        {/* eslint-disable-next-line @next/next/no-img-element -- 로고 심볼 SVG 를 흰색으로 연하게 */}
        <img aria-hidden src="/rapo/home/logo-symbol.svg" alt="" width={150} height={150}
          className="pointer-events-none absolute -right-[18px] -top-[6px] h-auto w-[150px] opacity-15 [filter:brightness(0)_invert(1)]" />
        <p className="rapo-type-t3-bold relative text-(color:--rapo-brand-color-coral)">사람과 정보가 모이는 공간</p>
        <h2 id="rapo-home-brand" className="rapo-type-t10-bold relative mt-(--rapo-dimension-x2) text-(color:--rapo-brand-color-white)">
          <span className="block">우리가 나눈 정보,</span>
          <span className="block">우리가 바꿀 내일</span>
        </h2>
        <p className="rapo-type-t4-regular relative mt-(--rapo-dimension-x4) break-keep text-white/85">
          라포는 재활치료 현장에서 일하는 사람들이 일자리 정보와 경험을 나누는 공간입니다.
          내가 나눈 경험이 누군가의 선택에 도움이 되고, 이런 나눔이 쌓이면 우리가 일하는 현장도
          조금씩 나아질 수 있다고 믿습니다.
        </p>
      </div>

      {/* 브랜드 스토리 · 라포를 쓰는 이유 */}
      <div className="flex flex-col gap-(--rapo-dimension-x4) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6)">
        <div className="flex flex-col gap-(--rapo-dimension-x1)">
          <p className="rapo-type-t2-bold text-(color:--rapo-brand-color-coral)">브랜드 스토리</p>
          <p className="rapo-type-t8-bold text-(color:--rapo-brand-color-navy)">열고, 모으고, 연결하다.</p>
        </div>
        <p className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">
          같은 현장에서 일해도, 알고 있는 정보와 얻을 수 있는 기회는 사람마다 다릅니다.
        </p>

        <h3 className="rapo-type-t6-bold mt-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">라포를 쓰는 이유</h3>
        <ol className="flex flex-col gap-(--rapo-dimension-x2)">
          {이유들.map((r, i) => (
            <li key={r.낱말} className="flex items-start gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-mist) p-(--rapo-dimension-x4)">
              <span className="rapo-type-t8-bold w-[34px] shrink-0 text-(color:--rapo-brand-color-coral)">0{i + 1}</span>
              <span className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
                <span className="rapo-type-t2-bold text-(color:--rapo-brand-color-coral)">{r.낱말}</span>
                <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{r.제목}</span>
                <span className="rapo-type-t3-regular break-keep text-[#3F4C57]">{r.설명}</span>
              </span>
            </li>
          ))}
        </ol>

        <dl className="mt-(--rapo-dimension-x2) grid gap-(--rapo-dimension-x2) min-[560px]:grid-cols-2">
          <div className="rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-mist) p-(--rapo-dimension-x4)">
            <dt className="rapo-type-t4-bold text-(color:--rapo-brand-color-navy)">존재 이유</dt>
            <dd className="rapo-type-t3-regular mt-(--rapo-dimension-x1_5) break-keep text-[#3F4C57]">
              정보와 경험을 나누어, 더 나은 선택과 일터를 함께 만들어 갑니다.
            </dd>
          </div>
          <div className="rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4)">
            <dt className="rapo-type-t4-bold text-(color:--rapo-brand-color-navy)">우리가 지키는 태도</dt>
            <dd className="rapo-type-t3-regular mt-(--rapo-dimension-x1_5) break-keep text-[#3F4C57]">
              정보는 정확하게 전하고, 서로 다른 경험은 존중합니다.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
