import { RapoJobRow, type RapoJob } from './rapo-job-row';
import { RapoButton, RapoDivider } from './rapo-ui';

/* 비회원 공고 목록의 가입 권유 (2026-11-12 밤 · 세중님: 「공고 리스트가 어느 정도 보이고 블러 느낌 되면서
   가입하면 모든 정보를 무료로 볼 수 있어요! 이런 식으로」).
   11/12 세중님: 「블라 처리는 아래 진짜 공고가 있는 것처럼 해줘 사람들이 가입하려고 하게」 → 빈 틀 대신 공고 줄 모양.

   ★ 흐린 자리에는 **진짜 공고를 내려보내지 않습니다.** 아래 줄은 진짜 공고 줄과 같은 부품(RapoJobRow)에
     「○○」로 가린 견본 글자를 넣은 것입니다 — 화면 소스를 열어도 나올 공고가 없고, 링크도 없습니다.
     비회원에게 실제로 가는 것은 이 위의 맛보기 몇 건뿐이고, 건수는 DB 창구(공개공고)가 자릅니다.
   남은 건수(전체 − 맛보기)는 창구가 주는 「전체건수」로 적습니다. 못 받았으면 숫자 없이 씁니다. */
const 가린줄: RapoJob[] = [
  { org: '○○대학교병원', orgArt: '01', title: '○○○○ 물리치료사 정규직 채용 공고', pay: { text: '연봉 ○,○○○만원', kind: 'value' }, tags: ['서울', '물리치료사', '정규직'], deadline: 'D-○' },
  { org: '○○○○의료원', orgArt: '03', title: '○○○ 작업치료사 계약직 채용', pay: { text: '월 ○○○만원', kind: 'value' }, tags: ['경기', '작업치료사', '계약직'], deadline: 'D-○○' },
  { org: '○○종합병원', orgArt: '06', title: '○○○○ 임상병리사 신규 채용 공고', pay: { text: '연봉 ○,○○○만원', kind: 'value' }, tags: ['부산', '임상병리사', '정규직'], deadline: 'D-○' },
  { org: '○○○ 공단', orgArt: '01', title: '○○○○ 방사선사 공개 채용', pay: { text: '연봉 ○,○○○만원', kind: 'value' }, tags: ['대전', '방사선사', '정규직'], deadline: 'D-○○' },
];

export function RapoJobGuestWall({ 남은 }: { 남은: number | null }) {
  return (
    <section aria-labelledby="rapo-guest-wall" className="relative overflow-hidden px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6)">
      {/* 흐린 공고 줄 — 읽는 도구에는 숨기고, 누를 수 없습니다 */}
      <ul aria-hidden className="pointer-events-none flex select-none flex-col blur-[4px]">
        {가린줄.map((j, i) => (
          <li key={i}>
            <RapoDivider />
            <RapoJobRow job={j} variant="list" />
          </li>
        ))}
      </ul>
      {/* 아래로 갈수록 흐려지게 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-40% to-(--rapo-color-bg-layer-default)" />

      {/* 가입 권유 — 흐린 줄 한두 개가 위로 보이게 조금 내려 둡니다 */}
      <div className="absolute inset-x-(--rapo-dimension-x5) top-[180px] flex flex-col gap-(--rapo-dimension-x3)
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
