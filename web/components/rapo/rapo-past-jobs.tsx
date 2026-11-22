/* 병원 정보 탭 「지난 공고」 — 이 병원이 전에 우리 직군을 언제·어떤 형태로·몇 명 뽑았는지.
   설계: RAPO노트/설계/지난공고_1122.md (2026-11-22 세중님 「사람들도 이걸 보고싶다고 하더라」).
   ★ 지금 회원 화면에 이미 나가는 값만 씁니다(마감일·직군·고용형태·인원·제목) — 요약말·새 숫자는 만들지 않습니다.
   ★ 줄은 눌리지 않습니다 — 공고 상세 창구(job_one)가 숨긴 공고를 주지 않습니다. */

export type 지난공고줄 = {
  id: string; 마감: string | null; 직군: string | null; 고용형태: string | null; 인원: number | null; 제목: string;
};

const 직군말 = (g: string | null) => (g === '공통' ? '물리·작업치료사' : g);
const 날말 = (d: string | null) => (d ? `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)} 마감` : '마감일 모름');

/* 공고 상세용 짧은 꼴 (2026-11-22 세중님 「채용공고 상세에도 · 간략하게 언제 고용형태 몇명 직군」).
   제목은 안 씁니다 — 한 줄에 「언제 마감 | 직군 · 고용형태 · N명」. 같은 기관번호의 지난 공고만(지금 공고는 뺌) */
export function RapoPastJobsBrief({ 줄, 더보기 }: { 줄: 지난공고줄[]; 더보기?: React.ReactNode }) {
  if (줄.length === 0) return null;
  return (
    <section className="flex flex-col gap-(--rapo-dimension-x4) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)">
      <div className="flex flex-col gap-(--rapo-dimension-x1)">
        <h2 className="rapo-type-section-title text-(color:--rapo-color-fg-neutral)">이 병원 지난 공고</h2>
        <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          전에 언제, 어떻게 뽑았는지 볼 수 있어요
        </p>
      </div>
      <ul className="flex flex-col rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x4)">
        {줄.map((j, i) => (
          <li key={j.id}
            className={'flex items-start gap-(--rapo-dimension-x3) py-(--rapo-dimension-x3) '
              + (i > 0 ? 'border-t border-(--rapo-color-stroke-neutral-weak)' : '')}>
            <span className="rapo-type-t3-regular w-[92px] shrink-0 whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">
              {j.마감 ? `${j.마감.slice(0, 4)}.${j.마감.slice(5, 7)}.${j.마감.slice(8, 10)}` : '날짜 모름'}
            </span>
            <span className="rapo-type-t4-medium min-w-0 break-keep text-(color:--rapo-color-fg-neutral)">
              {[직군말(j.직군), j.고용형태, j.인원 != null ? `${j.인원}명` : null].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {더보기}
      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        날짜는 마감일이에요. RAPO가 모으기 시작한 2026년 8월 뒤의 공고만 있어요.
      </p>
    </section>
  );
}

export function RapoPastJobs({ 줄, 더보기, 더있음 }: { 줄: 지난공고줄[]; 더보기?: React.ReactNode; 더있음?: boolean }) {
  if (줄.length === 0) return null;
  return (
    <section id="past-jobs" className="scroll-mt-[64px] flex flex-col gap-(--rapo-dimension-x4) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)">
      <div className="flex flex-col gap-(--rapo-dimension-x1)">
        <h2 className="rapo-type-section-title text-(color:--rapo-color-fg-neutral)">지난 공고</h2>
        <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          이 병원이 전에 낸 물리·작업치료사 공고예요
        </p>
      </div>

      <ul className="flex flex-col">
        {줄.map((j, i) => (
          <li key={j.id}
            className={'flex flex-col gap-(--rapo-dimension-x2) py-(--rapo-dimension-x4) '
              + (i > 0 ? 'border-t border-(--rapo-color-stroke-neutral-weak)' : '')}>
            <p className="rapo-type-t3-regular whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{날말(j.마감)}</p>
            <p className="rapo-type-t4-bold truncate text-(color:--rapo-color-fg-neutral)">{j.제목}</p>
            <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
              {[직군말(j.직군), j.고용형태, j.인원 != null ? `${j.인원}명` : null].filter(Boolean).map((t) => (
                <span key={t} className="rapo-type-t2-medium whitespace-nowrap rounded-[4px] bg-(--rapo-color-bg-neutral-weak)
                                         px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">{t}</span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {더있음 && 더보기}

      <p className="rapo-type-t3-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak)
                    p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
        RAPO가 모으기 시작한 2026년 8월 뒤의 공고만 있어요. 마감된 공고라 상세는 열리지 않아요.
      </p>
    </section>
  );
}
