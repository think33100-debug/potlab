import Link from 'next/link';

/* 공통 상태 화면 — 새 디자인 「14 · 공통 상태」 (2026-11-12 세중님 「다 피그마 기준」).
   원본 틀(모두 같음): 위 144 비움 · 표식 76.8(#fff0eb 바탕 · 둥근 16 · 그림 38.4) · 제목 t11 Bold #182e40 ·
   설명 t5 Regular #536475 · 맨 아래 남색 큰 단추(RAPO / Button / Filled · Large 52 · 둥근 12).
   쓰는 곳 — 없는 주소(app/not-found.tsx · 「공유 목적지 없음」 1383:1490),
            화면 오류(app/error.tsx · 「전체 조회 실패」 1383:1451 / 「오프라인」 1383:1438).
   색은 원본 값 그대로입니다(같은 이름의 현행 토큰이 없음 · 남색 단추만 토큰). */

export function RapoStatePage({ 그림, 둥글기 = 16, 제목, 설명, 단추 }: {
  그림: string; 둥글기?: number; 제목: string; 설명: string;
  단추: { 글: string; href?: string; onClick?: () => void };
}) {
  const 단추모양 = 'rapo-type-t6-bold flex h-[52px] w-full items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-navy-solid) px-(--rapo-dimension-x5) text-(color:--rapo-color-fg-on-navy-solid) active:bg-(--rapo-color-bg-navy-solid-pressed)';
  return (
    <main data-rapo className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-3xl flex-col gap-(--rapo-dimension-x4) bg-(--rapo-color-bg-layer-default) px-[28px] pb-[48px] pt-[144px]">
      <span className="flex size-[76.8px] shrink-0 items-center justify-center bg-[#fff0eb]" style={{ borderRadius: 둥글기 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src={그림} alt="" width={38} height={38} />
      </span>
      <h1 className="rapo-type-t11-bold break-keep text-[#182e40]">{제목}</h1>
      <p className="rapo-type-t5-regular break-keep text-[#536475]">{설명}</p>
      <div aria-hidden className="min-h-(--rapo-dimension-x8) flex-1" />
      {단추.href
        ? <Link href={단추.href} className={단추모양}>{단추.글}</Link>
        : <button type="button" onClick={단추.onClick} className={단추모양}>{단추.글}</button>}
    </main>
  );
}
