'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/* 홈 배너 — 좌우로 미는 틀과 **자리에 고정된** 점 표시 (2026-11-11 디자이너 요청).

   전에는 점을 장마다 그려서 배너와 함께 밀려 다녔습니다. 이제 점은 틀 위에 한 번만
   그리고, 배너만 그 밑에서 움직입니다. 점은 「페이지 인디케이터 · 1/3」(8px · 사이 8px ·
   꺼진 점 35%) 모양이고, 색은 지금 보이는 배너의 글자색을 따릅니다(tones).

   배너는 스크롤 스냅으로 밉니다 — 손가락·트랙패드·방향키로 넘어가고,
   마우스만 쓰는 분은 점을 눌러 넘깁니다. */
export function RapoBannerCarousel({ children, tones, label }: {
  children: ReactNode;
  tones: ('white' | 'navy')[];
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setAt(Math.min(tones.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
    el.addEventListener('scroll', read, { passive: true });
    return () => el.removeEventListener('scroll', read);
  }, [tones.length]);

  const go = (i: number) => {
    const el = box.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const 색 = tones[at] === 'navy' ? 'bg-(--rapo-brand-color-navy)' : 'bg-(--rapo-brand-color-white)';

  return (
    <section aria-roledescription="carousel" aria-label={label} className="relative">
      <div
        ref={box}
        tabIndex={0}
        className="flex h-[246px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <div className="absolute left-1/2 top-[229px] flex -translate-x-1/2 gap-(--rapo-dimension-x2)">
        {tones.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`${i + 1}번째 배너 보기`}
            aria-current={i === at ? 'true' : undefined}
            /* 보이는 점은 8px, 누르는 자리는 16px (이웃과 겹치지 않는 최대) */
            className={`relative size-[8px] rounded-full before:absolute before:-inset-[4px] ${색} ` +
              (i === at ? '' : 'opacity-35')}
          />
        ))}
      </div>
    </section>
  );
}
