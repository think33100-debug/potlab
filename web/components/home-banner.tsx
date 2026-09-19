'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HomeBlock } from '@/lib/home';
import { safeHref } from '@/lib/routes';
import { browserSupabase } from '@/lib/supabase-browser';

/* 상단 배너. 몇 초마다 넘길지는 관리자가 정합니다 (site_settings.top_banner_seconds).

   ponytail: 슬라이드 라이브러리를 안 답니다. 칸을 옆으로 미는 것뿐이라
   transform 한 줄이면 됩니다. 손가락으로 넘기기는 CSS scroll-snap 이
   해주므로 자바스크립트로 안 만듭니다. */
export function HomeBanner({ items, seconds }: { items: HomeBlock[]; seconds: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    /* 움직임 줄이기를 켠 분에게는 자동으로 안 넘깁니다 */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const t = setInterval(() => setI((v) => (v + 1) % items.length), Math.max(2, seconds) * 1000);
    return () => clearInterval(t);
  }, [items.length, seconds, paused]);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="공지"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-sm"
    >
      <div
        className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {items.map((b) => (
          <Slide key={b.id} b={b} />
        ))}
      </div>

      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 pb-5">
          {items.map((b, n) => (
            <button
              key={b.id}
              type="button"
              aria-label={`${n + 1}번째 배너 보기`}
              aria-current={n === i ? 'true' : undefined}
              onClick={() => setI(n)}
              className={
                'h-1 rounded-md transition-all ' +
                (n === i ? 'w-6 bg-white' : 'w-1 bg-white/50')
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({ b }: { b: HomeBlock }) {
  const bg = b.image_path
    ? browserSupabase().storage.from('home-images').getPublicUrl(b.image_path).data.publicUrl
    : null;

  return (
    <Link
      href={safeHref(b.href)}
      className="relative flex min-h-[160px] w-full shrink-0 flex-col justify-end overflow-hidden rounded-sm bg-teal-strong p-6 pb-8 text-white"
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* 그림 위에 글씨를 얹으면 안 읽힙니다 — 어둡게 한 겹 깝니다 */}
      {bg && <span aria-hidden className="absolute inset-0 bg-black/35" />}
      <span className="relative text-h3 font-bold">{b.title}</span>
      {b.descr && <span className="relative mt-1 text-lg text-white/85">{b.descr}</span>}
    </Link>
  );
}
