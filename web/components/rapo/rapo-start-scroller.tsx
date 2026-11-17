'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/* 홈 「라포에서 시작하기」 가로 넘기기 틀 (2026-11-18).
   2026-11-18 세중님 「데스크탑에서는 못 넘겨 · 흰색 연한 화살표 만들어서 넘길 수 있게」 —
   마우스로는 가로 스크롤을 못 하니, 마우스가 있는 기기(hover)에만 양쪽에 흰 동그라미 화살표를 띄웁니다.
   한 번 누르면 카드 한 장만큼 넘어갑니다. 더 갈 곳이 없는 쪽 화살표는 숨깁니다.
   손가락 기기에서는 지금처럼 밀어서 넘기고 화살표는 안 보입니다. */
export function RapoStartScroller({ children, className }: { children: ReactNode; className: string }) {
  const 줄 = useRef<HTMLUListElement>(null);
  const [끝, set끝] = useState({ 왼: false, 오: true });

  useEffect(() => {
    const u = 줄.current;
    if (!u) return;
    const 재기 = () => set끝({ 왼: u.scrollLeft > 4, 오: u.scrollLeft + u.clientWidth < u.scrollWidth - 4 });
    재기();
    u.addEventListener('scroll', 재기, { passive: true });
    const ro = new ResizeObserver(재기);
    ro.observe(u);
    return () => { u.removeEventListener('scroll', 재기); ro.disconnect(); };
  }, []);

  const 넘기기 = (방향: 1 | -1) => {
    const u = 줄.current;
    const 첫 = u?.firstElementChild as HTMLElement | null;
    if (!u || !첫) return;
    const 간격 = parseFloat(getComputedStyle(u).columnGap) || 0;
    u.scrollBy({ left: 방향 * (첫.offsetWidth + 간격), behavior: 'smooth' });
  };

  const 단추 = (방향: 1 | -1, 보임: boolean) => (
    <button type="button" onClick={() => 넘기기(방향)} aria-label={방향 > 0 ? '다음 카드' : '이전 카드'} tabIndex={보임 ? 0 : -1}
      className={`absolute top-1/2 z-10 hidden size-(--rapo-dimension-x10) -translate-y-1/2 items-center justify-center rounded-(--rapo-radius-full)
                  bg-white/75 shadow-(--rapo-shadow-s1) backdrop-blur-sm transition-opacity hover:bg-white/90 [@media(hover:hover)]:flex
                  ${방향 > 0 ? 'right-(--rapo-dimension-x2)' : 'left-(--rapo-dimension-x2)'} ${보임 ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className={방향 > 0 ? '' : 'rotate-180'}>
        <path d="M7.5 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-(color:--rapo-brand-color-navy)" />
      </svg>
    </button>
  );

  return (
    <div className="relative">
      {단추(-1, 끝.왼)}
      <ul ref={줄} className={className}>{children}</ul>
      {단추(1, 끝.오)}
    </div>
  );
}
