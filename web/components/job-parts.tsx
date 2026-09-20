'use client';

import { useSeen } from '@/lib/reveal';

/* 화면에 들어올 때 아래에서 살짝 올라오며 나타납니다.
   한 번만 돕니다. 움직임 줄이기를 켠 분에게는 처음부터 최종 상태입니다
   (규칙은 lib/reveal.ts 한 곳에 있습니다). */
export function Rise({
  children, delay = 0, className = '',
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`motion-reduce:!translate-y-0 motion-reduce:!opacity-100
                  motion-reduce:transition-none ${className}`}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? 'none' : 'translateY(14px)',
        transition: `opacity 520ms ease-out ${delay}ms, transform 520ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
