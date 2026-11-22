'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/* 앱 안 브라우저에서 나가기 — 2026-11-22 세중님 「2개 다 하자 · 만들어」.

   ── 왜 ───────────────────────────────────────────────────────
   단톡방 링크를 누르면 RAPO 가 **카카오톡 안의 작은 브라우저**에서 열립니다.
   거기서는 로그인이 다음에 이어지지 않아 「들어갈 때마다 카카오 로그인을 눌러야」 했습니다
   (2026-11-22 회원 제보). 쿠키는 400일짜리라 사파리·크롬·삼성 인터넷에서는 로그인이 유지됩니다.
   로그인 기록(auth.sessions · 하루 넘은 세션 103개)으로 보면 카톡 안 31개 중 2개 · 인스타 안 16개 중 0개만
   다시 이어졌습니다 (RAPO노트/결정.md 11/22).

   ── 무엇을 하나 ──────────────────────────────────────────────
   카카오톡 안     ① 들어오자마자 **한 번** 폰의 기본 브라우저로 넘깁니다(kakaotalk://web/openExternal)
                   ② 그래도 카톡 창이 남으므로 위에 「브라우저에서 열기」 줄을 둡니다
   안드로이드 다른 앱 안(인스타·네이버·페이스북·라인 …)   자동으로는 못 넘깁니다 → 단추(intent://)
   아이폰 다른 앱 안                                     단추로도 못 넘깁니다 → 「Safari로 열기」 안내 글만
   ★ 로그인 돌아오는 자리(/auth/…)에서는 안 넘깁니다 — 넘기면 카카오가 준 확인 값이 카톡 창에 남아 로그인이 끊깁니다
   ★ 「한 번」과 「닫기」는 이 창(sessionStorage)에만 둡니다 — 서버에 안 보냅니다
   「밖에서 열기」 주소는 설치 안내(rapo-install-toast.tsx)가 쓰던 것과 같습니다 */

type 갈래 = 'kakao' | 'android-inapp' | 'ios-inapp';

const 넘김시도 = 'rapo-inapp-tried';
const 닫음 = 'rapo-inapp-closed';

export function 앱안갈래(ua: string): 갈래 | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|everytimeApp|DaumApps|BAND\//i.test(ua)) {
    return /Android/i.test(ua) ? 'android-inapp' : 'ios-inapp';
  }
  return null;
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

/** layout 맨 위에 하나 둡니다. 앱 안 브라우저일 때만 그립니다 */
export function RapoInappEscape() {
  const [갈래, set갈래] = useState<갈래 | null>(null);
  const 경로 = usePathname() ?? '';

  useEffect(() => {
    const g = 앱안갈래(navigator.userAgent);
    if (!g || 읽기(닫음)) return;
    set갈래(g);
    /* 카톡 안이면 들어오자마자 한 번 넘깁니다. 로그인 돌아오는 자리는 건너뜁니다 */
    if (g === 'kakao' && !location.pathname.startsWith('/auth') && !읽기(넘김시도)) {
      쓰기(넘김시도);
      location.href = 카톡밖주소(location.href);
    }
  }, []);

  if (!갈래 || 경로.startsWith('/auth')) return null;
  const 닫기 = () => { 쓰기(닫음); set갈래(null); };
  return (
    <RapoInappEscapeFace 갈래={갈래} onClose={닫기}
      onOpen={() => { location.href = 갈래 === 'kakao' ? 카톡밖주소(location.href) : 안드로이드밖주소(location.href); }} />
  );
}

const 아무것도 = () => {};

/** 그리기만 — 디자인 견본도 이것을 씁니다 */
export function RapoInappEscapeFace({ 갈래, onOpen = 아무것도, onClose = 아무것도 }: {
  갈래: 갈래; onOpen?: () => void; onClose?: () => void;
}) {
  const 어디 = 갈래 === 'kakao' ? '카카오톡' : '이 앱';
  return (
    <div role="region" aria-label="브라우저에서 열기 안내"
      className="w-full shrink-0 border-b border-(--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-brand-weak)">
      {/* 폰 폭(320~)에서 글이 좁게 접히지 않게 — 글은 넓게, 단추는 그 아래, 닫기만 오른쪽 위 */}
      <div className="mx-auto flex w-full max-w-3xl items-start gap-(--rapo-dimension-x2) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3)">
        <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
          <p className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-neutral)">
            {어디} 안에서는 로그인이 유지되지 않아요
          </p>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            {/* 메뉴 이름은 한 줄로 — 「Safari로 / 열기」처럼 갈리지 않게(화면표시 규칙 1) */}
            {갈래 === 'ios-inapp'
              ? <>메뉴(⋯)의 <span className="whitespace-nowrap">「Safari로 열기」</span>를 눌러 주세요. 한 번 로그인하면 계속 유지돼요.</>
              : 갈래 === 'android-inapp'
                ? <>브라우저에서 한 번 로그인하면 계속 유지돼요. 안 열리면 메뉴(⋮)의 <span className="whitespace-nowrap">「다른 브라우저로 열기」</span>를 눌러 주세요.</>
                : '브라우저에서 한 번 로그인하면 계속 유지돼요.'}
          </p>
          {갈래 !== 'ios-inapp' && (
            <button type="button" onClick={onOpen}
              className="rapo-type-t4-bold mt-(--rapo-dimension-x1) h-(--rapo-touch-min) self-start whitespace-nowrap rounded-(--rapo-radius-r2)
                         bg-(--rapo-color-bg-brand-solid) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-on-brand-solid) active:opacity-80">
              브라우저에서 열기
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기"
          className="-mr-(--rapo-dimension-x2) -mt-(--rapo-dimension-x2) flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2)
                     text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
