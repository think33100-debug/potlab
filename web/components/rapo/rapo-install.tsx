'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/app/toast';
import { RapoButton } from './rapo-ui';

/* 핸드폰에 설치하기 — 내 정보 (2026-11-14 세중님 「내 정보에서 핸드폰에 설치하기 · 바로가기 설치 안 한 사람들이 할 수 있게 유도 ·
   페이지도 만들고 누르면 바로 만들 수 있게」).

   가입 직후 한 번 뜨는 설치 안내 토스트(rapo-install-toast.tsx)와 같은 길을 씁니다 — 브라우저가 준 설치 신호(window.__rapoInstall ·
   app/layout.tsx 머리의 INSTALL_SCRIPT 가 받아 둠)로 설치 창을 엽니다. 저장하는 것은 없습니다.

   브라우저마다 할 수 있는 일이 다릅니다 (우리가 못 바꾸는 것)
     크롬·엣지·삼성 인터넷(안드로이드·PC)  「지금 설치하기」 단추 한 번 → 브라우저 설치 창
     아이폰·아이패드 사파리               단추로는 못 엽니다(애플이 막음) → 「공유 → 홈 화면에 추가」 세 걸음 안내
     카카오톡·네이버 앱 안 브라우저        설치가 안 됩니다 → 크롬·사파리로 열라는 안내
     이미 앱 창으로 연 때                 「이미 설치돼 있어요」 */

type 설치신호 = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export type 설치상태 = '모름' | '설치됨' | '단추' | '아이폰' | '앱안' | '맥사파리' | '안내만';

const 신호 = () => (window as unknown as { __rapoInstall?: 설치신호 }).__rapoInstall;
const 앱창인가 = () => window.matchMedia?.('(display-mode: standalone)').matches
  || (navigator as unknown as { standalone?: boolean }).standalone === true;

function 상태읽기(): 설치상태 {
  const ua = navigator.userAgent;
  if (앱창인가()) return '설치됨';
  if (신호()) return '단추';
  if (/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua)) return '앱안';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return '아이폰';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return '맥사파리';
  return '안내만';
}

/** 지금 이 기기의 설치 상태 — 처음에는 「모름」, 확인되면 바뀝니다 */
export function useInstallState(): 설치상태 {
  const [g, setG] = useState<설치상태>('모름');
  useEffect(() => {
    const 보기 = () => setG(상태읽기());
    보기();
    const 늦게 = window.setTimeout(보기, 1200);   // 설치 신호는 조금 늦게 올 수 있습니다
    window.addEventListener('rapo-install-ready', 보기);
    window.addEventListener('appinstalled', 보기);
    return () => {
      window.clearTimeout(늦게);
      window.removeEventListener('rapo-install-ready', 보기);
      window.removeEventListener('appinstalled', 보기);
    };
  }, []);
  return g;
}

/** 내 정보 맨 위의 유도 카드 — 이미 설치한 분에게는 안 보입니다 */
export function RapoInstallCard() {
  const g = useInstallState();
  if (g === '모름' || g === '설치됨') return null;
  return (
    <Link href="/me/install"
      className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4)
                 active:bg-(--rapo-color-bg-transparent-pressed)">
      <span className="flex size-(--rapo-dimension-x12) shrink-0 items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-layer-default)">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/home/logo-symbol.svg" alt="" width={28} height={28} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">핸드폰에 RAPO 설치하기</span>
        <span className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">홈 화면 아이콘으로 바로 열어요</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
      <img src="/rapo/me/chevron-18.svg" alt="" width={18} height={18} className="shrink-0" />
    </Link>
  );
}

function 걸음({ n, children, 그림 }: { n: number; children: React.ReactNode; 그림?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-(--rapo-dimension-x3)">
      <span className="rapo-type-t4-bold flex size-(--rapo-dimension-x7) shrink-0 items-center justify-center rounded-full bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)">{n}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x2)">
        <span className="rapo-type-t5-regular break-keep pt-[2px] text-(color:--rapo-color-fg-neutral)">{children}</span>
        {그림}
      </span>
    </li>
  );
}

/* ── 아이폰 설치 그림 (2026-11-14 세중님 「아이폰은 이미지를 추가해서 더 자세히」) ─────────────
   실제 화면을 찍은 것이 아니라 **모양을 따라 그린 그림**입니다(아이폰 화면을 우리가 찍어 올 길이 없고, iOS 판마다 조금씩 달라서).
   누를 곳만 코랄 테두리로 짚습니다. 글자는 사파리에 실제로 적힌 말 그대로 — 「공유」 「홈 화면에 추가」 「추가」 */
const 폰틀 = 'overflow-hidden rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) bg-(--rapo-color-bg-neutral-weak)';
const 짚음 = 'rounded-(--rapo-radius-r2) outline-2 outline-offset-2 outline-(--rapo-color-bg-deep-coral)';
const 선 = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 공유 단추 모양 — 네모에서 화살표가 위로 */
function 공유그림({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...선}>
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M7 11H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18 11h-1" />
    </svg>
  );
}

/** ① 사파리 아래 줄 — 가운데 공유 단추를 짚음 */
function 그림_공유() {
  return (
    <span role="img" aria-label="사파리 화면 아래 줄 가운데에 있는 공유 단추를 짚은 그림" className={폰틀 + ' flex flex-col'}>
      <span className="flex h-[56px] items-center justify-center px-(--rapo-dimension-x4)">
        <span className="rapo-type-t3-regular flex h-[32px] w-full items-center justify-center rounded-full bg-(--rapo-color-bg-layer-default) text-(color:--rapo-color-fg-neutral-muted)">rapojob.co.kr</span>
      </span>
      <span className="flex h-[52px] items-center justify-around border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) text-(color:--rapo-color-fg-neutral-muted)">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...선}><path d="M15 5l-7 7 7 7" /></svg>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...선}><path d="M9 5l7 7-7 7" /></svg>
        <span className={짚음 + ' flex size-[36px] items-center justify-center text-(color:--rapo-color-bg-deep-coral)'}><공유그림 /></span>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...선}><path d="M12 6c-2-1.3-4.5-2-8-2v14c3.5 0 6 .7 8 2 2-1.300 4.5-2 8-2V4c-3.5 0-6 .7-8 2Zm0 0v14" /></svg>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden {...선}><rect x="8" y="4" width="12" height="12" rx="2" /><path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2" /></svg>
      </span>
    </span>
  );
}

/** ② 공유 목록 — 「홈 화면에 추가」 줄을 짚음 */
function 그림_목록() {
  const 줄 = 'flex h-[44px] items-center justify-between px-(--rapo-dimension-x4) rapo-type-t4-regular text-(color:--rapo-color-fg-neutral)';
  return (
    <span role="img" aria-label="공유 목록에서 홈 화면에 추가 줄을 짚은 그림" className={폰틀 + ' flex flex-col p-(--rapo-dimension-x3)'}>
      <span className="flex flex-col overflow-hidden rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-layer-default)">
        <span className={줄 + ' text-(color:--rapo-color-fg-neutral-muted)'}>
          복사
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...선}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>
        </span>
        <span className={줄 + ' border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) text-(color:--rapo-color-fg-neutral-muted)'}>
          읽기 목록에 추가
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...선}><circle cx="8" cy="12" r="4" /><circle cx="16" cy="12" r="4" /></svg>
        </span>
        <span className={줄 + ' rapo-type-t4-bold border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) outline-2 -outline-offset-2 outline-(--rapo-color-bg-deep-coral)'}>
          홈 화면에 추가
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...선}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg>
        </span>
      </span>
    </span>
  );
}

/** ③ 「홈 화면에 추가」 창 — 오른쪽 위 「추가」를 짚음 */
function 그림_추가() {
  return (
    <span role="img" aria-label="홈 화면에 추가 창의 오른쪽 위 추가 단추를 짚은 그림" className={폰틀 + ' flex flex-col'}>
      <span className="flex h-[48px] items-center justify-between px-(--rapo-dimension-x4)">
        <span className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">취소</span>
        <span className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">홈 화면에 추가</span>
        <span className={짚음 + ' rapo-type-t4-bold px-(--rapo-dimension-x2) py-[2px] text-(color:--rapo-color-bg-deep-coral)'}>추가</span>
      </span>
      <span className="m-(--rapo-dimension-x3) mt-0 flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x3)">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[10px] bg-(--rapo-color-bg-brand-weak)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/home/logo-symbol.svg" alt="" width={26} height={26} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">RAPO</span>
          <span className="rapo-type-t3-regular truncate text-(color:--rapo-color-fg-neutral-muted)">rapojob.co.kr</span>
        </span>
      </span>
    </span>
  );
}
const 메뉴 = ({ children }: { children: React.ReactNode }) => <b className="whitespace-nowrap">「{children}」</b>;
const 걸음제목 = 'rapo-type-t6-bold text-(color:--rapo-brand-color-navy)';
const 덧말 = 'rapo-type-t3-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral-muted)';

/** 설치 화면의 몸 — app/me/install 과 견본(app/design-preview/install-page)이 같이 씁니다. 견본은 상태를 정해 넘깁니다 */
export function RapoInstallBody({ 견본 }: { 견본?: 설치상태 }) {
  const 실제 = useInstallState();
  const g = 견본 ?? 실제;
  const toast = useToast();
  const [바쁨, set바쁨] = useState(false);

  const 설치 = async () => {
    const e = 신호();
    if (!e) { toast('지금은 설치 창을 열 수 없어요. 브라우저 메뉴의 「홈 화면에 추가」를 눌러 주세요', { ms: 4000 }); return; }
    set바쁨(true);
    try {
      await e.prompt();
      const r = await e.userChoice;
      (window as unknown as { __rapoInstall?: 설치신호 }).__rapoInstall = undefined;
      if (r.outcome === 'accepted') toast('설치했어요. 홈 화면에서 RAPO 아이콘을 찾아보세요');
    } catch { /* 창을 그냥 닫음 */ }
    set바쁨(false);
  };

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x6) pt-(--rapo-dimension-x4)">
      <section className="flex flex-col items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x7) text-center">
        <span className="flex size-[72px] items-center justify-center rounded-[20px] bg-(--rapo-color-bg-layer-default) shadow-(--rapo-shadow-s1)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/home/logo-symbol.svg" alt="" width={44} height={44} />
        </span>
        <h2 className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-neutral)">
          {g === '설치됨' ? 'RAPO가 이미 설치돼 있어요' : 'RAPO를 홈 화면에 두세요'}
        </h2>
        <p className="rapo-type-t4-regular whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral-muted)">
          {g === '설치됨' ? '지금 앱 창으로 보고 계세요.' : '아이콘 하나로 바로 열고\n새 공고 알림도 받을 수 있어요'}
        </p>
      </section>

      {g === '모름' && <p role="status" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">확인하는 중…</p>}

      {g === '단추' && (
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <RapoButton tone="deep-coral" size={52} full loading={바쁨} onClick={설치}>지금 설치하기</RapoButton>
          <p className="rapo-type-t3-regular whitespace-pre-line break-keep text-center text-(color:--rapo-color-fg-neutral-muted)">
            {'누르면 설치할지 묻는 창이 떠요\n거기서 「설치」를 누르면 끝이에요'}
          </p>
        </section>
      )}

      {g === '아이폰' && (
        <section className="flex flex-col gap-(--rapo-dimension-x4)">
          <h3 className={걸음제목}>아이폰은 세 걸음이에요</h3>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">사파리에서 이 화면을 연 채로 따라 해 보세요. 1분이면 돼요.</p>
          <ol className="flex flex-col gap-(--rapo-dimension-x6)">
            <걸음 n={1} 그림={<그림_공유 />}>
              화면 맨 아래 가운데 <메뉴>공유</메뉴> 단추를 눌러요.
              <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block text-(color:--rapo-color-fg-neutral-muted)">네모에서 화살표가 위로 나가는 모양이에요. 안 보이면 화면을 살짝 내려 보거나, 주소창 옆 「⋯」를 먼저 눌러요</span>
            </걸음>
            <걸음 n={2} 그림={<그림_목록 />}>
              올라온 목록을 위로 밀어 <메뉴>홈 화면에 추가</메뉴>를 눌러요.
              <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block text-(color:--rapo-color-fg-neutral-muted)">네모 안에 + 가 있는 줄이에요. 목록 아래쪽에 있어요</span>
            </걸음>
            <걸음 n={3} 그림={<그림_추가 />}>
              오른쪽 위 <메뉴>추가</메뉴>를 누르면 끝이에요.
              <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block text-(color:--rapo-color-fg-neutral-muted)">홈 화면에 RAPO 아이콘이 생겨요. 다음부터는 그 아이콘으로 열어요</span>
            </걸음>
          </ol>
          <p className={덧말}>그림은 이해를 돕는 예시예요. 아이폰 판에 따라 모양이 조금 다를 수 있어요. 아이폰은 단추 하나로 설치할 수 없게 되어 있고, 사파리에서 열었을 때만 돼요</p>
        </section>
      )}

      {g === '앱안' && (
        <section className="flex flex-col gap-(--rapo-dimension-x4)">
          <h3 className={걸음제목}>먼저 다른 브라우저로 열어 주세요</h3>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">카카오톡·네이버 같은 앱 안에서는 설치가 안 돼요.</p>
          <ol className="flex flex-col gap-(--rapo-dimension-x4)">
            <걸음 n={1}>화면 구석의 <메뉴>⋮</메뉴> 메뉴를 눌러요</걸음>
            <걸음 n={2}><메뉴>다른 브라우저로 열기</메뉴>를 골라 크롬이나 사파리로 열어요</걸음>
            <걸음 n={3}>내 정보의 <메뉴>핸드폰에 설치하기</메뉴>로 다시 들어와요</걸음>
          </ol>
        </section>
      )}

      {g === '맥사파리' && (
        <section className="flex flex-col gap-(--rapo-dimension-x4)">
          <h3 className={걸음제목}>맥 사파리에서는</h3>
          <ol className="flex flex-col gap-(--rapo-dimension-x4)">
            <걸음 n={1}>화면 맨 위 메뉴의 <메뉴>파일</메뉴>을 눌러요</걸음>
            <걸음 n={2}><메뉴>Dock에 추가</메뉴>를 누르면 끝이에요</걸음>
          </ol>
        </section>
      )}

      {g === '안내만' && (
        <section className="flex flex-col gap-(--rapo-dimension-x4)">
          <h3 className={걸음제목}>브라우저 메뉴에서 추가해요</h3>
          <ol className="flex flex-col gap-(--rapo-dimension-x4)">
            <걸음 n={1}>브라우저의 <메뉴>⋮</메뉴> 메뉴를 눌러요</걸음>
            <걸음 n={2}><메뉴>홈 화면에 추가</메뉴> 또는 <메뉴>앱 설치</메뉴>를 눌러요</걸음>
          </ol>
          <p className={덧말}>메뉴에 없으면 크롬으로 열어 주세요. 이미 설치했다면 이 안내가 보일 수 있어요</p>
        </section>
      )}

      {/* 세중님 11/13 「어플 개발 진행 중이라 곧 어플로 만나 볼 수 있다」 — 토스트와 같은 말 */}
      <p className="rapo-type-t3-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x3) py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
        <span className="block">지금 RAPO 앱도 만들고 있어요.</span>
        <span className="block">곧 앱으로도 만나 볼 수 있어요!</span>
      </p>
    </div>
  );
}
