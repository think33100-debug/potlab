'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 오픈 화면의 광고 배너 한 자리 (2026-10-04).

   ── 어떻게 맞물리나 ─────────────────────────────────────────
   짧은 오픈 화면(components/splash.tsx + globals.css 의 #splash)은 그대로
   있습니다. 그것은 **자바스크립트가 없어야** 리액트 붙기 전에 떠 있을 수
   있어서, 단추를 달 수 없습니다. 그래서 배너는 그 위에 덮는 **딴 겹**입니다.

     배너가 없거나 꺼져 있으면   짧은 오픈 화면만 (지금 그대로)
     배너가 있으면              그 위에 덮고, 건너뛰기나 시간이 지나면 둘 다 치웁니다

   ── 몇 번 보여줄까 ──────────────────────────────────────────
   띄울지 말지는 <head> 의 짧은 스크립트가 이미 정했습니다 —
   html 에 data-splash-slot="앱"|"커뮤니티" 가 붙어 있을 때만 뜹니다.
   그 스크립트가 sessionStorage 로 **이번 방문에 한 번**만 허락합니다.

   ── 세는 것 ────────────────────────────────────────────────
   ⚷ 표시 수·누른 수를 **개인 식별 정보 없이** 셉니다. 광고셈올리기() 가
     받는 것은 자리와 「눌렀나」 둘뿐이고, 표에는 자리·날·숫자만 남습니다.
     회원id·기기·아이피·때각을 보내지도 남기지도 않습니다. */

type 광고 = { 자리: string; 그림: string; 링크: string | null; 표시초: number };

export function SplashAd() {
  const [ad, setAd] = useState<광고 | null>(null);
  const [감춤, set감춤] = useState(false);
  const 센적있나 = useRef(false);

  /* 배너를 치울 때 **짧은 오픈 화면까지** 같이 치웁니다.
     안 치우면 배너가 사라진 뒤 브랜드 화면이 다시 보여 어색합니다 */
  const 치우기 = useCallback(() => {
    set감춤(true);
    try { document.documentElement.removeAttribute('data-splash'); } catch { /* 무시 */ }
  }, []);

  useEffect(() => {
    const 자리 = document.documentElement.dataset.splashSlot;
    if (!자리) return;                       // 오픈 화면을 띄울 자리가 아닙니다
    let 살아있나 = true;
    browserSupabase().rpc('지금광고', { p_자리: 자리 }).then(({ data }) => {
      if (!살아있나) return;
      const b = ((data ?? []) as 광고[])[0];
      if (!b || !b.그림) return;             // 꺼졌거나 기간 밖 → 짧은 화면만
      setAd(b);
    });
    return () => { 살아있나 = false; };
  }, []);

  /* ★ 2026-10-05 — supabase-js 의 rpc() 는 **.then() 을 불러야 보냅니다.**
     전에는 부르기만 하고 기다리지 않아서 **요청이 아예 안 나갔습니다** —
     배너는 떴는데 광고셈이 0줄이었습니다. 같은 자리인 job-open-link.tsx 는
     .then() 을 달고 있어 멀쩡했습니다.
     세는 일로 화면을 막지 않으려고 기다리지는 않고, 탈만 적어 둡니다 */
  const 세기 = (자리: string, 눌렀나: boolean) => {
    browserSupabase().rpc('광고셈올리기', { p_자리: 자리, p_누름: 눌렀나 })
      .then(({ error }) => {
        if (error) console.warn('[POTJOB] 광고 세기 실패:', error.message);
      }, (e: unknown) => console.warn('[POTJOB] 광고 세기 실패:', e));
  };

  /* 보여준 것을 한 번만 셉니다. 자동으로 치우는 시계도 여기서 겁니다 */
  useEffect(() => {
    if (!ad || 센적있나.current) return;
    센적있나.current = true;
    세기(ad.자리, false);
    const t = setTimeout(치우기, Math.min(Math.max(ad.표시초, 1), 5) * 1000);
    return () => clearTimeout(t);
  }, [ad, 치우기]);

  if (!ad || 감춤) return null;

  const 누름 = () => {
    세기(ad.자리, true);
    if (ad.링크) window.open(ad.링크, '_blank', 'noopener,noreferrer');
    치우기();
  };

  /* 커뮤니티는 어두운 구역입니다 — 흰 겹을 덮으면 눈이 찔립니다.
     dark: 는 html[data-surface="dark"] 을 뜻합니다 (app/surface.tsx) */
  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-white dark:bg-gray-900"
      role="dialog"
      aria-label="광고"
    >
      {/* 「광고」라고 작게라도 반드시 밝힙니다 — 표시광고 고지 의무입니다 */}
      <span className="absolute left-6 top-6 rounded-xs bg-gray-100 px-3 py-1 text-sm text-gray-600
                       dark:bg-gray-800 dark:text-gray-400">
        광고
      </span>

      <button
        type="button"
        onClick={치우기}
        className="absolute right-6 top-6 rounded-xs border border-line bg-white px-4 py-2 text-lg font-medium text-mute
                   dark:bg-gray-900"
      >
        건너뛰기
      </button>

      {ad.링크 ? (
        <button type="button" onClick={누름} className="max-h-[70vh] max-w-full px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다 */}
          <img src={ad.그림} alt="광고" className="max-h-[70vh] w-auto max-w-full object-contain" />
        </button>
      ) : (
        <div className="max-h-[70vh] max-w-full px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같습니다 */}
          <img src={ad.그림} alt="광고" className="max-h-[70vh] w-auto max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
