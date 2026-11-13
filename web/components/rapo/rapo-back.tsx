'use client';

import { useRouter } from 'next/navigation';

/* 「뒤로」 단추 — 온 곳으로 돌아갑니다 (2026-11-13).
   약관처럼 **여러 화면에서 들어오는** 글 화면에 씁니다(가입 · 내 정보 · 꼬리말). 정해진 한 곳으로 보내면
   가입하다 약관을 읽은 분이 엉뚱한 화면으로 갑니다. 새 탭으로 바로 열어 돌아갈 곳이 없으면 fallback 으로 갑니다 */
export function RapoBackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button type="button" aria-label="뒤로"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
    </button>
  );
}
