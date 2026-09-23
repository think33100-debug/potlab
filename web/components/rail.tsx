'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* 옆으로 미는 카드 줄.

   홈 큰배너 · 홈 상단배너 · 커뮤니티 주제 · 공고 분류가 전부 이걸 씁니다.
   네 벌로 두면 다음에 「딱 안 멈춘다」는 말이 나올 때 한 곳만 고치게 됩니다.

   ponytail: 슬라이드 라이브러리를 안 답니다.
   손으로 미는 것과 「딱 멈추기」는 CSS scroll-snap 이 이미 해줍니다 —
   자바스크립트는 점 표시와 저절로 넘기기만 맡습니다.

   전에 쓰던 방식(transform 으로 밀기)은 손가락에 반응하지 않았습니다.
   실제로 화면이 넘어가는 게 아니라 그려진 위치만 옮기는 것이라,
   브라우저가 「밀 수 있는 것」으로 안 봤습니다. 이제 진짜로 넘깁니다.

   카드 폭 = 줄 폭 - 40px. 왼쪽 여백 15px 을 빼고 나면 오른쪽에 25px 이
   남아 다음 카드가 살짝 보입니다 — 「더 있다」가 눈에 보여야 밉니다.

   width 를 calc(100% - 40px) 로 적으면 안 됩니다. 여기서 100% 는 줄 폭이
   아니라 **안쪽 폭**(줄 폭 - 좌우 여백 30px)이라 카드가 30px 더 좁아집니다.
   처음에 그렇게 적었다가 재보니 305px(=345-40)이 나왔습니다 — 원한 건 335 입니다.

   움직임 줄이기를 켠 분에게는 저절로 안 넘기고, 점을 눌러도 안 미끄러집니다. */

const GAP = 8;             // gap-3 (--spacing-3)
const SIDE = 15;           // px-6 (--spacing-6) · 화면 좌우 여백과 같게
const PEEK = 40;           // 카드가 줄 폭보다 이만큼 좁습니다
/* 안쪽 폭 기준으로 다시 적은 값. 줄 폭 - PEEK 와 같아집니다 */
const CARD_TRIM = PEEK - SIDE * 2;

export function Rail({
  children,
  label,
  /* 몇 초마다 저절로 넘길지. 0 이면 저절로 안 넘깁니다 */
  auto = 0,
  /* 어두운 바탕 위에 놓일 때 점 색을 바꿉니다 */
  dark = false,
  className = '',
}: {
  children: React.ReactNode[];
  label: string;
  auto?: number;
  dark?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  /* 손을 대면 저절로 넘기는 것을 잠시 멈춥니다. 다시 시작할 시각을 적어둡니다 */
  const holdUntil = useRef(0);
  const n = children.length;

  /* 카드 한 칸이 몇 px 인지. 계산으로 맞추지 않고 실제 카드를 재서 씁니다 —
     계산식을 두 곳에 두면 한쪽만 고쳐져서 점이 엉뚱한 칸을 가리킵니다 */
  const step = () => {
    const first = box.current?.firstElementChild as HTMLElement | null;
    return first ? first.getBoundingClientRect().width + GAP : 0;
  };

  /* 지금 몇 번째 카드인지 */
  const onScroll = useCallback(() => {
    const el = box.current;
    const w = step();
    if (!el || w <= 0) return;
    setAt(Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / w))));
  }, [n]);

  const goTo = useCallback((i: number, smooth = true) => {
    const el = box.current;
    const w = step();
    if (!el || w <= 0) return;
    const soft = smooth
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: i * w, behavior: soft ? 'smooth' : 'auto' });
  }, []);

  /* 저절로 넘기기. 손을 댄 직후에는 건너뜁니다 */
  useEffect(() => {
    if (auto <= 0 || n < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const t = setInterval(() => {
      if (Date.now() < holdUntil.current) return;
      const el = box.current;
      const w = step();
      if (!el || w <= 0) return;
      const now = Math.round(el.scrollLeft / w);
      goTo((now + 1) % n);
    }, Math.max(2, auto) * 1000);

    return () => clearInterval(t);
  }, [auto, n, goTo]);

  /* 손을 대면 멈추고, 떼고 나서 한 바퀴 쉬었다가 다시 시작합니다 */
  const hold = () => { holdUntil.current = Date.now() + Math.max(2, auto) * 1000; };

  if (n === 0) return null;

  return (
    <section aria-label={label} className={className}>
      {/* 화면 끝까지 흘러야 다음 카드가 살짝 보입니다 — 좌우 여백을 뚫습니다 */}
      <ul
        ref={box}
        onScroll={onScroll}
        onPointerDown={hold}
        onPointerUp={hold}
        onMouseEnter={hold}
        onWheel={hold}
        className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto
                   px-6 pb-1 md:-mx-7 md:px-7 [scrollbar-width:none]
                   [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingLeft: SIDE, scrollPaddingRight: SIDE }}
      >
        {children.map((c, i) => (
          <li
            key={i}
            className="shrink-0 snap-start"
            style={{ width: `calc(100% - ${CARD_TRIM}px)` }}
          >
            {c}
          </li>
        ))}
      </ul>

      {n > 1 && (
        <div className="mt-4 flex justify-center gap-1">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 보기`}
              aria-current={i === at ? 'true' : undefined}
              onClick={() => { hold(); goTo(i); }}
              className={
                'h-1 rounded-md transition-all '
                + (i === at
                  ? (dark ? 'w-6 bg-white' : 'w-6 bg-ink')
                  : (dark ? 'w-1 bg-white/40' : 'w-1 bg-line'))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
