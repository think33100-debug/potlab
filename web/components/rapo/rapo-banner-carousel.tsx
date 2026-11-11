'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 홈 배너 — 좌우로 미는 틀과 **자리에 고정된** 점 표시 (2026-11-11 디자이너 요청).

   전에는 점을 장마다 그려서 배너와 함께 밀려 다녔습니다. 이제 점은 틀 위에 한 번만
   그리고, 배너만 그 밑에서 움직입니다. 점은 「페이지 인디케이터 · 1/3」(8px · 사이 8px ·
   꺼진 점 35%) 모양이고, 색은 지금 보이는 배너의 글자색을 따릅니다(tones).

   배너는 스크롤 스냅으로 밉니다 — 손가락·트랙패드·방향키로 넘어가고,
   마우스만 쓰는 분은 점을 눌러 넘깁니다.

   ── 혼자 넘어가기 (2026-11-12 세중님 「제일 위 배너도 혼자 넘어가야 해 · 관리자에서 조절」) ──
   몇 초마다 넘길지는 관리자 「홈 꾸미기」의 「넘어가는 속도」(site_settings.top_banner_seconds)를 읽습니다.
   옛 홈 배너가 쓰던 그 칸 그대로입니다. 못 읽으면 5초, 2~60초 밖이면 그 끝으로 맞춥니다.
   마지막 장 다음은 첫 장으로 돌아갑니다. 손가락이 닿아 있거나(누르는 중) 마우스를 올렸거나
   키보드로 들어와 있으면 멈추고, 앱이 뒤로 가 있으면(화면 숨김) 넘기지 않습니다.
   기기에서 「움직임 줄이기」를 켠 분에게는 혼자 넘기지 않습니다. */
const 기본초 = 5;
function 초로(v: unknown): number {
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return 기본초;
  return Math.min(60, Math.max(2, n));
}
/* 훅 이름은 영어여야 검사(rules-of-hooks)가 훅으로 알아봅니다 */
function useBannerSeconds(): number {
  const [초, set초] = useState(기본초);
  useEffect(() => {
    let 살아있음 = true;
    browserSupabase().from('site_settings').select('value').eq('key', 'top_banner_seconds').maybeSingle()
      .then(({ data }) => { if (살아있음 && data) set초(초로(data.value)); }, () => {});
    return () => { 살아있음 = false; };
  }, []);
  return 초;
}
export function RapoBannerCarousel({ children, tones, label }: {
  children: ReactNode;
  tones: ('white' | 'navy')[];
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const 초 = useBannerSeconds();
  const 멈춤 = useRef(false);

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

  /* 혼자 넘기기 — 지금 자리(at)에서 다음 장으로. at 이 바뀌면 시계를 새로 겁니다(손으로 넘긴 뒤 바로 또 넘어가지 않게) */
  useEffect(() => {
    if (tones.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => {
      if (멈춤.current || document.hidden) return;
      const el = box.current;
      if (el) el.scrollTo({ left: ((at + 1) % tones.length) * el.clientWidth, behavior: 'smooth' });
    }, 초 * 1000);
    return () => clearTimeout(t);
  }, [at, 초, tones.length]);

  const 색 = tones[at] === 'navy' ? 'bg-(--rapo-brand-color-navy)' : 'bg-(--rapo-brand-color-white)';

  return (
    <section aria-roledescription="carousel" aria-label={label} className="relative"
      onPointerEnter={() => { 멈춤.current = true; }} onPointerLeave={() => { 멈춤.current = false; }}
      onPointerDown={() => { 멈춤.current = true; }} onPointerUp={(e) => { if (e.pointerType !== 'mouse') 멈춤.current = false; }}
      onFocus={() => { 멈춤.current = true; }} onBlur={() => { 멈춤.current = false; }}>
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
