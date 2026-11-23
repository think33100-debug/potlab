'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 설치넘김표, 앱안갈래, type 앱안 } from '@/lib/install-hint';
import { RapoButton } from './rapo-ui';

/* 앱 안 브라우저에서 나가기 + 설치 유도 — 2026-11-22 세중님
   「2개 다 · 만들어」 → 「위에서 뜨지 말고 아래에서 위로 올라오는 팝업으로 아예 설치를 유도」.

   ── 왜 ───────────────────────────────────────────────────────
   단톡방 링크를 누르면 RAPO 가 **카카오톡 안의 작은 브라우저**에서 열립니다.
   거기서는 로그인이 다음에 이어지지 않아 「들어갈 때마다 카카오 로그인을 눌러야」 했습니다
   (2026-11-22 회원 제보). 쿠키는 400일짜리라 사파리·크롬·삼성 인터넷에서는 로그인이 유지됩니다.
   로그인 기록(auth.sessions · 하루 넘은 세션 103개)으로 보면 카톡 안 31개 중 2개 · 인스타 안 16개 중 0개만
   다시 이어졌습니다 (RAPO노트/결정.md 11/22). 앱 안에서는 「홈 화면에 추가」(설치)도 안 됩니다.

   ── 무엇을 하나 ──────────────────────────────────────────────
   카카오톡 안     ① 들어오자마자 **한 번** 폰의 기본 브라우저로 넘깁니다(kakaotalk://web/openExternal)
                   ② 카톡 창이 남으므로 **아래에서 올라오는 팝업**으로 「브라우저에서 열기」
   안드로이드 다른 앱 안(인스타·네이버·페이스북·라인 …)   자동으로는 못 넘깁니다 → 팝업 단추(intent://)
   아이폰 다른 앱 안                                     단추로도 못 넘깁니다 → 「Safari로 열기 → 홈 화면에 추가」 안내만
   넘길 때 주소에 설치넘김표(install-hint)를 붙입니다 → 넘어간 브라우저에서 **설치 안내 토스트**(rapo-install-toast)가
   이어서 뜹니다(크롬 「설치하기」 · 사파리 「공유 → 홈 화면에 추가」). 앱 안에서는 그 토스트가 안 뜹니다(겹치지 않게).
   ★ 로그인 돌아오는 자리(/auth/…)에서는 안 넘기고 안 그립니다 — 넘기면 카카오가 준 확인 값이 카톡 창에 남아 로그인이 끊깁니다
   ★ 「한 번」과 「닫기」는 이 창(sessionStorage)에만 둡니다 — 서버에 안 보냅니다 */

const 넘김시도 = 'rapo-inapp-tried';
const 닫음 = 'rapo-inapp-closed';

/** 넘어간 브라우저에서 설치 안내가 이어서 뜨게 표를 붙인 지금 주소 */
function 넘길주소() {
  const u = new URL(location.href);
  u.searchParams.set(설치넘김표, '1');
  return u.toString();
}

/** 카톡이 폰의 기본 브라우저로 같은 화면을 엽니다 */
export function 카톡밖주소(지금: string) {
  return 'kakaotalk://web/openExternal?url=' + encodeURIComponent(지금);
}

/** 안드로이드 — 폰의 기본 브라우저(크롬·삼성 인터넷 …)로 같은 화면을 엽니다. 앱마다 막을 수 있어 안내 글을 같이 둡니다 */
export function 안드로이드밖주소(지금: string) {
  const u = new URL(지금);
  return 'intent://' + u.host + u.pathname + u.search + u.hash + '#Intent;scheme=' + u.protocol.replace(':', '') + ';end';
}

const 읽기 = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const 쓰기 = (k: string) => { try { sessionStorage.setItem(k, '1'); } catch { /* 사생활 보호 창 */ } };

/** layout 에 하나 둡니다. 앱 안 브라우저일 때만 그립니다 */
export function RapoInappEscape() {
  const [갈래, set갈래] = useState<앱안 | null>(null);
  const [올라옴, set올라옴] = useState(false);
  const 경로 = usePathname() ?? '';
  /* 공고 상세는 아래에 저장·지원 단추 줄(112)이 있어 그 위로 올립니다. 나머지 화면은 하단 탐색(72) 위 — 설치 토스트와 같은 자리 */
  const 아래 = /^\/jobs\/[^/]+$/.test(경로) ? 124 : 84;

  useEffect(() => {
    const g = 앱안갈래(navigator.userAgent);
    if (!g || 읽기(닫음)) return;
    set갈래(g);
    /* 그린 뒤 한 박자 늦게 올립니다 — 아래에서 위로 올라오는 움직임 */
    const 늦게 = window.setTimeout(() => set올라옴(true), 50);
    /* 카톡 안이면 들어오자마자 한 번 넘깁니다. 로그인 돌아오는 자리는 건너뜁니다 */
    if (g === 'kakao' && !location.pathname.startsWith('/auth') && !읽기(넘김시도)) {
      쓰기(넘김시도);
      location.href = 카톡밖주소(넘길주소());
    }
    return () => window.clearTimeout(늦게);
  }, []);

  if (!갈래 || 경로.startsWith('/auth')) return null;
  const 닫기 = () => { 쓰기(닫음); set갈래(null); };
  return (
    <RapoInappEscapeFace 갈래={갈래} 아래={아래} 올라옴={올라옴} onClose={닫기}
      onOpen={() => { location.href = 갈래 === 'kakao' ? 카톡밖주소(넘길주소()) : 안드로이드밖주소(넘길주소()); }} />
  );
}

const 아무것도 = () => {};

/** 그리기만 — 설치 안내 토스트(RapoInstallToastFace)와 같은 꼴입니다 */
export function RapoInappEscapeFace({ 갈래, 아래 = 84, 올라옴 = true, onOpen = 아무것도, onClose = 아무것도 }: {
  갈래: 앱안; 아래?: number; 올라옴?: boolean; onOpen?: () => void; onClose?: () => void;
}) {
  const 어디 = 갈래 === 'kakao' ? '카카오톡' : '이 앱';
  return (
    <div role="dialog" aria-labelledby="rapo-inapp-title"
      className={'fixed inset-x-0 z-50 mx-auto w-full max-w-3xl px-(--rapo-dimension-x4) transition-[transform,opacity] duration-300 ease-out '
        + (올라옴 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0')}
      style={{ bottom: `calc(${아래}px + env(safe-area-inset-bottom))` }}>
      <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5)
                      shadow-(--rapo-shadow-s2) ring-1 ring-(--rapo-color-stroke-neutral-weak)">
        <div className="flex items-start gap-(--rapo-dimension-x3)">
          <span className="flex size-(--rapo-dimension-x12) shrink-0 items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 (설치 토스트와 같은 그림) */}
            <img src="/rapo/home/logo-symbol.svg" alt="" width={28} height={28} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
            <p id="rapo-inapp-title" className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">
              RAPO를 홈 화면에 추가해 보세요
            </p>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
              {/* 메뉴 이름은 한 줄로 — 「Safari로 / 열기」처럼 갈리지 않게(화면표시 규칙 1) */}
              {어디} 안에서는 설치도, 로그인 유지도 안 돼요.{' '}
              {갈래 === 'ios-inapp'
                ? <>메뉴(⋯)의 <span className="whitespace-nowrap">「Safari로 열기」</span>를 누른 뒤 공유 단추에서 <span className="whitespace-nowrap">「홈 화면에 추가」</span>를 골라 주세요.</>
                : 갈래 === 'android-inapp'
                  ? <>브라우저에서 열면 앱처럼 설치하고 로그인도 계속 유지돼요. 안 열리면 메뉴(⋮)의 <span className="whitespace-nowrap">「다른 브라우저로 열기」</span>를 눌러 주세요.</>
                  : '브라우저에서 열면 앱처럼 설치하고 로그인도 계속 유지돼요.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="-mr-(--rapo-dimension-x2) -mt-(--rapo-dimension-x2) flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2)
                       text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {갈래 === 'ios-inapp' ? (
          <RapoButton tone="outline" onClick={onClose} full>알겠어요</RapoButton>
        ) : (
          <div className="flex gap-(--rapo-dimension-x2)">
            <RapoButton tone="outline" onClick={onClose} className="w-[104px] shrink-0">닫기</RapoButton>
            <RapoButton onClick={onOpen} className="min-w-0 flex-1">브라우저에서 열기</RapoButton>
          </div>
        )}
      </div>
    </div>
  );
}
