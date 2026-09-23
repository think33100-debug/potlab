'use client';

import Link from 'next/link';
import { Rail } from '@/components/rail';
import type { HomeBlock } from '@/lib/home';
import { safeHref } from '@/lib/routes';
import { browserSupabase } from '@/lib/supabase-browser';

/* 상단 배너. 몇 초마다 넘길지는 관리자가 정합니다 (site_settings.top_banner_seconds).

   2026-09-23 — 손으로 안 넘어가던 것을 고쳤습니다.
   전에는 transform 으로 안쪽 줄을 옆으로 밀었습니다. 그림은 움직이는데
   실제로 넘기는 게 아니라, 브라우저가 「밀 수 있는 것」으로 안 봤습니다.
   이제 진짜 가로 스크롤이고 scroll-snap 이 딱 멈춰 줍니다 (components/rail.tsx).
   손으로 밀면 저절로 넘어가는 것은 한 바퀴 쉬었다가 다시 시작합니다. */
export function HomeBanner({ items, seconds }: { items: HomeBlock[]; seconds: number }) {
  if (items.length === 0) return null;

  return (
    <Rail label="공지" auto={seconds}>
      {items.map((b) => <Slide key={b.id} b={b} />)}
    </Rail>
  );
}

function Slide({ b }: { b: HomeBlock }) {
  const bg = b.image_path
    ? browserSupabase().storage.from('home-images').getPublicUrl(b.image_path).data.publicUrl
    : null;

  return (
    <Link
      href={safeHref(b.href)}
      className="relative flex min-h-[160px] w-full flex-col justify-end overflow-hidden
                 rounded-sm bg-teal-strong p-6 text-white"
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* 그림 위에 글씨를 얹으면 안 읽힙니다 — 어둡게 한 겹 깝니다 */}
      {bg && <span aria-hidden className="absolute inset-0 bg-black/35" />}
      <span className="relative break-keep text-h3 font-bold">{b.title}</span>
      {b.descr && <span className="relative mt-1 break-keep text-lg text-white/85">{b.descr}</span>}
    </Link>
  );
}
