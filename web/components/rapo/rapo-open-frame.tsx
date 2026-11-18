/* 열린 네모 프레임 — Figma 「02 · 브랜드·BI·콘텐츠 가이드 › 03 · 그래픽 시스템 › 03 · 프레임 활용」(91:283).
   왼쪽 위 ㄱ 과 오른쪽 아래 ㄴ 두 모서리만 그리고 가운데를 엽니다(「프레임의 열린 부분이 분명히 보이게」 · 91:282).
   선 색은 코럴(로고·열린 프레임·강조 표시 · 34:143). 기준 규격(너비 1080 · 선 16)을 폰 폭에 맞춰 4px 로 줄였습니다.
   감싸는 쪽이 relative 여야 합니다. 꾸밈이라 읽는 도구에는 숨깁니다. */
export function RapoOpenFrame({ className = 'inset-(--rapo-dimension-x4)' }: { className?: string }) {
  const 선 = 'absolute rounded-(--rapo-radius-r0_5) bg-(--rapo-brand-color-coral)';
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      <span className={`${선} left-0 top-0 h-[4px] w-[64%]`} />
      <span className={`${선} left-0 top-0 h-[40%] w-[4px]`} />
      <span className={`${선} bottom-0 right-0 h-[4px] w-[64%]`} />
      <span className={`${선} bottom-0 right-0 h-[40%] w-[4px]`} />
    </span>
  );
}
