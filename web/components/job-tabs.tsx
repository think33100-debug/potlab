'use client';

import Link from 'next/link';
import { Rail } from '@/components/rail';
import { TABS } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';

/* 공고 목록 맨 위의 분류 카드. 옆으로 밉니다.

   이름과 가는 곳은 코드에 둡니다 (lib/supabase.ts 의 TABS).
   DB 에 주소를 넣게 하면 엉뚱한 값이 들어가 404 가 납니다.
   관리자가 바꾸는 것은 그림 하나뿐입니다 (job_tab_cards.image_path).

   그림이 아직 없으면 잉크색 바탕에 글자만 올립니다 — 자리는 지금 잡아둡니다. */
export function JobTabs({
  images, hrefs, active, counts,
}: {
  /* tab_key → 저장소 경로. 관리자가 /admin/jobs 에서 올립니다 */
  images: Record<string, string | null>;
  /* tab_key → 가는 곳. 서버가 미리 만들어 넘깁니다 —
     함수를 넘기면 「Functions cannot be passed directly to Client Components」 */
  hrefs: Record<string, string>;
  active: string | null;
  /* 건수. 로그인 전에는 셀 수가 없어서 null 로 옵니다 (job_counts 가 회원만) */
  counts: number[] | null;
}) {
  return (
    <Rail label="분류" className="mb-7">
      {TABS.map((t, i) => {
        const path = images[t.key];
        const bg = path
          ? browserSupabase().storage.from('home-images').getPublicUrl(path).data.publicUrl
          : null;
        const on = active === t.key;

        return (
          <Link
            key={t.key}
            href={hrefs[t.key]}
            aria-current={on ? 'page' : undefined}
            className={
              'relative flex min-h-[132px] w-full flex-col justify-end overflow-hidden '
              + 'rounded-sm p-6 text-white transition-transform duration-[120ms] '
              + 'active:scale-[0.99] motion-reduce:transition-none '
              + (on ? 'ring-2 ring-teal-strong' : '')
            }
            style={{
              backgroundColor: '#14181C',
              ...(bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
            }}
          >
            {bg && <span aria-hidden className="absolute inset-0 bg-black/45" />}
            <span className="relative break-keep text-h3 font-bold">{t.label}</span>
            {counts && (
              <span className="relative mt-1 text-lg text-white/75">
                <span className="num tabular-nums">{counts[i]}</span>건
              </span>
            )}
          </Link>
        );
      })}
    </Rail>
  );
}
