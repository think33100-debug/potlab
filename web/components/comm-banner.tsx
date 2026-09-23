'use client';

import Link from 'next/link';
import { Rail } from '@/components/rail';
import type { HomeBlock } from '@/lib/home';
import { safeHref } from '@/lib/routes';
import { browserSupabase } from '@/lib/supabase-browser';

/* 커뮤니티 맨 위 배너.

   홈 배너와 같은 표(home_blocks)를 씁니다 — kind 만 'comm' 입니다.
   관리자 화면·권한·그림 올리는 길이 이미 있어서 새로 만들 이유가 없었습니다.

   홈 배너와 따로 둔 것은 색뿐입니다. 어두운 바탕 위에 놓이니
   teal 바탕 대신 카드색(#1B2025)으로 깔고 점도 흰색으로 씁니다. */
export function CommBanner({ items, seconds }: { items: HomeBlock[]; seconds: number }) {
  if (items.length === 0) return null;

  return (
    <Rail label="커뮤니티 공지" auto={seconds} dark>
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
      className="relative flex min-h-[140px] w-full flex-col justify-end overflow-hidden
                 rounded-sm bg-gray-950 p-6 text-white"
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {bg && <span aria-hidden className="absolute inset-0 bg-black/45" />}
      <span className="relative break-keep text-h3 font-bold">{b.title}</span>
      {b.descr && <span className="relative mt-1 break-keep text-lg text-gray-400">{b.descr}</span>}
    </Link>
  );
}
