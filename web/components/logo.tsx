/* 옛 위쪽 줄(app/layout.tsx 의 LegacyChrome)에 쓰는 로고.

   2026-11-28 세중님 「RAPO로 바꿔줘」 — 그림이 옛 POTJOB 워드마크였고 설명 글(alt)도 「POTJOB」이었습니다.
   새 화면과 같은 RAPO 가로형 로고(Figma 원본 SVG · components/rapo/rapo-admin.tsx 와 같은 꼴)로 바꿨습니다.
   글자 그림은 남색(#112231)이라 어두운 모드에서는 반전해 밝게 보이게 합니다.
   크기는 높이(height)만 받고 너비는 원본 비율(105.6 × 27.7)을 따릅니다. */

export function Logo({ height = 20, className = '' }: { height?: number; className?: string }) {
  const k = height / 27.7;
  return (
    <span className={'inline-flex items-center ' + className} style={{ height, gap: 8 * k }}>
      {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/home/logo-symbol.svg" alt="" aria-hidden style={{ height, width: 28.4 * k }} className="shrink-0" />
      <img src="/rapo/home/logo-wordmark.svg" alt="RAPO" style={{ height: 14 * k, width: 'auto' }} className="dark:invert" />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
