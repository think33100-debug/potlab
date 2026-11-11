import type { MetadataRoute } from 'next';

/* ★ 2026-11-11 — 클로즈드 베타(11/13~) 동안 검색엔진 색인을 막습니다 (세중님 결정 · 줄 A).
   middleware.ts 의 X-Robots-Tag 와 layout.tsx 의 robots 메타와 한 쌍입니다.
   공개로 바꿀 때 셋을 함께 거둡니다. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
