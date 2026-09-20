'use client';

import { useEffect, useRef, useState } from 'react';

/* 스크롤하다 화면에 들어오면 한 번 도는 움직임.

   규칙 두 가지를 여기서만 지킵니다. 화면마다 따로 쓰면 반드시 한쪽을 빠뜨립니다.

   ① 한 번만 돕니다. 보고 나면 관찰을 끊어서, 다시 올라갔다 내려와도 재생 안 합니다
   ② 움직임 줄이기를 켠 분에게는 처음부터 최종 상태입니다.
      CSS 만 막으면 숫자가 0 에서 멈춰 있게 됩니다 — 그래서 여기서도 봅니다 */

export const lessMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 화면에 들어왔는지. 들어온 뒤로는 계속 true 입니다 */
export function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* 움직임을 줄이는 분에게는 관찰조차 안 겁니다 */
    if (lessMotion()) { setSeen(true); return; }

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setSeen(true);
      io.disconnect();          // 되감기 없음 — 여기서 끊습니다
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, seen };
}

/* 0 에서 to 까지 세어 올라갑니다.

   requestAnimationFrame 으로 시간을 보고 값을 냅니다 —
   setInterval 로 정해진 횟수를 더하면 느린 기기에서 끝 값이 안 맞습니다.
   마지막 프레임은 반드시 to 로 찍습니다. */
export function useCountUp(to: number, ms = 1100, digits = 0) {
  const { ref, seen } = useSeen<HTMLSpanElement>();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (lessMotion()) { setN(to); return; }

    let raf = 0;
    const t0 = performance.now();
    /* 소수점 있는 값(치료사 한 명당 병상 12.1)도 자연스럽게 오르게 —
       Math.round 로만 깎으면 12.1 이 12 에서 멈춥니다 */
    const step = Math.pow(10, digits);
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      /* 끝에서 부드럽게 멈춥니다 */
      const eased = 1 - Math.pow(1 - p, 3);
      setN(p === 1 ? to : Math.round(to * eased * step) / step);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, ms, digits]);

  return { ref, n: n.toFixed(digits) };
}

/* 0% 에서 실제 값까지 차오르는 막대.
   숫자와 같은 규칙입니다 — 한 번만, 움직임 줄이기면 처음부터 최종값. */
export function useGrow(to: number, ms = 900) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (lessMotion()) { setW(to); return; }
    /* 한 프레임 뒤에 바꿔야 CSS transition 이 0 → to 를 봅니다 */
    const id = requestAnimationFrame(() => setW(to));
    return () => cancelAnimationFrame(id);
  }, [seen, to]);

  return { ref, w, ms };
}
