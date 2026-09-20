/* 워드마크. 브랜드 명세서 8번 — 앱 안에서는 SVG 를 씁니다.

   밝은 배경과 어두운 배경에 쓰는 파일이 다릅니다 (PO·JOB 색만 다르고 T 는 둘 다 빨강).
   커뮤니티는 밝은 모드에서도 어두운 바탕이라(app/surface.tsx) 기기 설정만으로는
   못 고릅니다. 그래서 둘 다 깔아두고 CSS 로 하나만 보이게 합니다 —
   자바스크립트로 고르면 첫 그림에 잘못된 쪽이 한 번 스칩니다.

   명세서 3번: 워드마크를 코드로 다시 조판하지 말 것. 그래서 글자가 아니라 그림입니다.
   명세서 12번: 이름은 붙여쓰기 POTJOB. alt 도 붙여 씁니다. */

/* 원본 4355×730 — 높이만 정하고 비율은 그대로 둡니다 */
const RATIO = 4355 / 730;

export function Logo({ height = 20, className = '' }: { height?: number; className?: string }) {
  const style = { height, width: height * RATIO };
  return (
    <span className={'inline-block ' + className}>
      {/* eslint-disable @next/next/no-img-element -- 파일 그대로 쓰는 편이 가볍습니다 */}
      <img src="/brand/wordmark-on-light.svg" alt="POTJOB" style={style}
        className="block dark:hidden" />
      <img src="/brand/wordmark-on-dark.svg" alt="" aria-hidden style={style}
        className="hidden dark:block" />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
