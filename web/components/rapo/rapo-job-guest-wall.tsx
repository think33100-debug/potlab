import { RapoButton, RapoDivider, RapoSkeleton } from './rapo-ui';

/* 비회원 공고 목록의 가입 권유 (2026-11-12 밤 · 세중님: 「공고 리스트가 어느 정도 보이고 블러 느낌 되면서
   가입하면 모든 정보를 무료로 볼 수 있어요! 이런 식으로」).

   ★ 흐린 자리에는 **진짜 공고를 내려보내지 않습니다.** 아래 카드들은 글자가 없는 빈 틀(RapoSkeleton)이고,
     그 위를 흐리게 덮은 것은 꾸밈입니다 — 화면 소스를 열어도 나올 공고가 없습니다.
     비회원에게 실제로 가는 것은 이 위의 맛보기 몇 건뿐이고, 건수는 DB 창구(공개공고)가 자릅니다.
   남은 건수(전체 − 맛보기)는 창구가 주는 「전체건수」로 적습니다. 못 받았으면 숫자 없이 씁니다.
   「세중님이 말한 라포 md」 파일은 금고·저장소에서 못 찾아 피그마 토큰과 공통 UI 로 만들었습니다. */
export function RapoJobGuestWall({ 남은 }: { 남은: number | null }) {
  return (
    <section aria-labelledby="rapo-guest-wall" className="relative px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6)">
      {/* 흐린 빈 틀 — 읽는 도구에는 숨깁니다 */}
      <div aria-hidden className="pointer-events-none flex select-none flex-col blur-[5px]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-(--rapo-dimension-x3) py-(--rapo-dimension-x4)">
            {i > 0 && <RapoDivider />}
            <div className="flex items-center gap-(--rapo-dimension-x3)">
              <RapoSkeleton className="size-(--rapo-dimension-x8)" />
              <RapoSkeleton className="h-[14px] w-[104px]" />
            </div>
            <RapoSkeleton className="h-[20px] w-[72%]" />
            <RapoSkeleton className="h-[16px] w-[44%]" />
            <div className="flex gap-(--rapo-dimension-x2)">
              <RapoSkeleton className="h-[24px] w-[70px]" />
              <RapoSkeleton className="h-[24px] w-[110px]" />
            </div>
          </div>
        ))}
      </div>

      {/* 가입 권유 — 흐린 틀 위 가운데 */}
      <div className="absolute inset-x-(--rapo-dimension-x5) top-(--rapo-dimension-x10) flex flex-col gap-(--rapo-dimension-x3)
                      rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x6) text-center shadow-(--rapo-shadow-s2)">
        <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">
          {남은 != null && 남은 > 0 ? `공고 ${남은.toLocaleString('ko-KR')}개가 더 있어요` : '공고가 더 있어요'}
        </p>
        <h2 id="rapo-guest-wall" className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-neutral)">
          가입하면 모든 정보를<br />무료로 볼 수 있어요!
        </h2>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          공공기관·대학병원·종합병원 공고의 급여, 지원 자격, 원문까지 한곳에서 확인하세요. 가입은 1분이면 끝나요.
        </p>
        <RapoButton href="/login?next=%2Fjobs" tone="deep-coral" full>무료로 가입하기</RapoButton>
        <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">이미 회원이라면 같은 단추로 로그인돼요</p>
      </div>
    </section>
  );
}
