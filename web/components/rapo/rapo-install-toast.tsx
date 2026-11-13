'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 설치안내끝, 설치안내표식 } from '@/lib/install-hint';
import { RapoButton } from './rapo-ui';

/* 설치 안내 토스트 — 가입을 막 마친 분에게 한 번 (2026-11-13 세중님
   「회원 가입 딱 한 사람들한테 아래에서 토스트 팝업으로 설치할 수 있게 안내 · 데스크탑에 설치」
   「어플 개발 진행 중이라 곧 어플로 만나 볼 수 있다 이 문구도 넣자」).

   ── 언제 뜨나 ────────────────────────────────────────────────
   가입 화면(app/welcome)이 끝날 때 표식(설치안내표식)을 남기고, 다음 화면에서 이 부품이 그 표식을 보고 한 번 띄웁니다.
   안 뜨는 때 — 이미 설치해서 앱 창으로 연 때 · 「나중에」/닫기를 누른 뒤 · 설치도 안내도 못 하는 브라우저(파이어폭스 등).

   ── 브라우저마다 ─────────────────────────────────────────────
   크롬·엣지(윈도우·맥·안드로이드)  브라우저가 주는 설치 창을 「설치하기」 단추로 엽니다(beforeinstallprompt).
                                  그 신호는 화면이 뜨자마자 오므로 app/layout.tsx 머리의 INSTALL_SCRIPT 가 먼저 받아 둡니다.
   맥 사파리                       단추로는 못 엽니다 — 「파일 → Dock에 추가」 안내만
   아이폰·아이패드 사파리           「공유 → 홈 화면에 추가」 안내만

   ★ 저장 · 동작 — 표식과 「다시 안 띄움」은 이 기기의 localStorage 에만 둡니다(서버에 안 보냄) · 표식·머리 스크립트는 lib/install-hint.ts */


type 설치신호 = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export type 설치갈래 = 'prompt' | 'mac-safari' | 'ios';

function 갈래읽기(): 설치갈래 | null {
  const ua = navigator.userAgent;
  if ((window as unknown as { __rapoInstall?: 설치신호 }).__rapoInstall) return 'prompt';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari';
  return null;
}
const 앱창인가 = () => window.matchMedia?.('(display-mode: standalone)').matches
  || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** layout 에 하나 둡니다. 표식이 있을 때만 그립니다 */
export function RapoInstallToast() {
  const [갈래, set갈래] = useState<설치갈래 | null>(null);
  /* 공고 상세는 아래에 저장·지원 단추 줄(112)이 있어 그 위로 올립니다. 나머지 화면은 하단 탐색(72) 위 */
  const 아래 = /^\/jobs\/[^/]+$/.test(usePathname() ?? '') ? 124 : 84;
  useEffect(() => {
    let 표식 = false;
    try { 표식 = localStorage.getItem(설치안내표식) === '1' && !localStorage.getItem(설치안내끝); } catch { /* 사생활 보호 창 */ }
    if (!표식 || 앱창인가()) return;
    /* 설치 신호는 조금 늦게 올 수 있어 한 번 더 봅니다 */
    const 보기 = () => set갈래(갈래읽기());
    const 늦게 = window.setTimeout(보기, 1200);
    window.addEventListener('rapo-install-ready', 보기);
    return () => { window.clearTimeout(늦게); window.removeEventListener('rapo-install-ready', 보기); };
  }, []);

  const 닫기 = () => {
    try { localStorage.removeItem(설치안내표식); localStorage.setItem(설치안내끝, '1'); } catch { /* 사생활 보호 창 */ }
    set갈래(null);
  };
  const 설치 = async () => {
    const e = (window as unknown as { __rapoInstall?: 설치신호 }).__rapoInstall;
    if (!e) return 닫기();
    await e.prompt();
    try { await e.userChoice; } catch { /* 창을 그냥 닫음 */ }
    (window as unknown as { __rapoInstall?: 설치신호 }).__rapoInstall = undefined;
    닫기();
  };

  if (!갈래) return null;
  /* 휴대폰(안드로이드 크롬 포함)은 「바탕화면」이 아니라 「홈 화면」 */
  const 폰 = 갈래 === 'ios' || /Android|Mobi/.test(navigator.userAgent);
  return <RapoInstallToastFace 갈래={갈래} 폰={폰} 아래={아래} onInstall={설치} onClose={닫기} />;
}

const 아무것도 = () => {};

/** 그리기만 — 디자인 견본(app/design-preview/install)도 이것을 씁니다 */
export function RapoInstallToastFace({ 갈래, 폰 = 갈래 === 'ios', 아래 = 84, onInstall = 아무것도, onClose = 아무것도, 고정 = true }: {
  갈래: 설치갈래; 폰?: boolean; 아래?: number; onInstall?: () => void; onClose?: () => void; 고정?: boolean;
}) {
  return (
    <div role="dialog" aria-labelledby="rapo-install-title"
      className={(고정 ? 'fixed inset-x-0 z-50 mx-auto ' : 'relative ') + 'w-full max-w-3xl px-(--rapo-dimension-x4)'}
      style={고정 ? { bottom: `calc(${아래}px + env(safe-area-inset-bottom))` } : undefined}>
      <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)
                      shadow-(--rapo-shadow-s2) ring-1 ring-(--rapo-color-stroke-neutral-weak)">
        <div className="flex items-start gap-(--rapo-dimension-x3)">
          <span className="flex size-(--rapo-dimension-x12) shrink-0 items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src="/rapo/home/logo-symbol.svg" alt="" width={28} height={28} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
            <p id="rapo-install-title" className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">
              {폰 ? 'RAPO를 홈 화면에 추가해 보세요' : 'RAPO를 바탕화면에 설치해 보세요'}
            </p>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
              {갈래 === 'prompt' ? '설치하면 앱처럼 아이콘 하나로 바로 열 수 있어요.'
                /* 「…」 안의 메뉴 이름은 한 줄로 — 「홈 / 화면에 추가」처럼 갈리지 않게(화면표시 규칙 1) */
                : 갈래 === 'mac-safari' ? <>사파리 위 메뉴의 <span className="whitespace-nowrap">「파일 → Dock에 추가」</span>를 누르면 앱처럼 열 수 있어요.</>
                : <>아래 공유 단추를 누르고 <span className="whitespace-nowrap">「홈 화면에 추가」</span>를 고르면 앱처럼 열 수 있어요.</>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="-mr-(--rapo-dimension-x2) -mt-(--rapo-dimension-x2) flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2)
                       text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {/* 세중님 「어플 개발 진행 중이라 곧 어플로 만나 볼 수 있다」 */}
        <p className="rapo-type-t3-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x3) py-(--rapo-dimension-x2)
                      text-(color:--rapo-color-fg-neutral)">
          {/* 두 문장을 줄로 나눕니다 — 이으면 좁은 폰에서 「만나 볼 / 수 있어요」로 갈렸습니다(화면표시 규칙 1) */}
          <span className="block">지금 RAPO 앱도 만들고 있어요.</span>
          <span className="block">곧 앱으로도 만나 볼 수 있어요!</span>
        </p>
        {갈래 === 'prompt' ? (
          <div className="flex gap-(--rapo-dimension-x2)">
            <RapoButton tone="outline" onClick={onClose} className="w-[104px] shrink-0">나중에</RapoButton>
            <RapoButton onClick={onInstall} className="min-w-0 flex-1">설치하기</RapoButton>
          </div>
        ) : (
          <RapoButton tone="outline" onClick={onClose} full>알겠어요</RapoButton>
        )}
      </div>
    </div>
  );
}
