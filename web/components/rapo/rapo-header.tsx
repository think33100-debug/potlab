import Link from 'next/link';
import type { Who } from '@/lib/supabase-server';

/* RAPO 새 디자인의 위쪽 줄 (2026-11-11).
   Figma 「RAPO / Home / 헤더 / 비회원」 954:961 · 「… / 회원」 954:976 · 64px · 좌우 20px.
   둘은 오른쪽 단추 글자만 다릅니다 — 비회원 「로그인」(/login) · 회원 「내 정보」(/me).
   로고는 「RAPO / 라포 / 승인 로고」 1415:48484 의 원본 SVG 두 조각을 그 자리에 둡니다
   (심볼 32.25×31.5 · 워드마크는 원본 비율 그대로 120×31.5 상자 안 자리).
   「모름」(로그인 상태를 못 물어봄)이면 단추를 그리지 않습니다. */
export function RapoHeader({ who }: { who: Who }) {
  const 단추 = who === '회원' ? { href: '/me', label: '내 정보' }
    : who === '비회원' ? { href: '/login', label: '로그인' } : null;
  return (
    <header className="flex h-[64px] items-center gap-(--rapo-dimension-x2_5) px-(--rapo-dimension-x5) py-[10px]">
      <Link href="/" aria-label="RAPO 홈" className="relative block h-[31.5px] w-[120px] shrink-0">
        {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/home/logo-symbol.svg" alt="" className="absolute left-0 top-0 h-[31.5px] w-[32.25px]" />
        <img src="/rapo/home/logo-wordmark.svg" alt=""
          className="absolute bottom-[24.37%] left-[34.21%] right-[0.04%] top-[24.67%]" />
        {/* eslint-enable @next/next/no-img-element */}
      </Link>
      <div className="flex min-w-0 flex-1 items-center justify-end">
        {단추 && (
          <Link
            href={단추.href}
            className="rapo-type-t4-medium flex h-[40px] w-[72px] items-center justify-center rounded-(--rapo-radius-r2)
                       bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral)
                       active:bg-(--rapo-color-bg-deep-coral-pressed)"
          >
            {단추.label}
          </Link>
        )}
      </div>
    </header>
  );
}
