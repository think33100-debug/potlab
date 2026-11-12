'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { useToast } from '@/app/toast';

/* 공유 · 링크 복사.

   커뮤니티 글에 있던 것을 그대로 떼어냈습니다 (components/post-actions.tsx).
   공고·병원·급여가 같은 것을 쓰게 하려고 뺐습니다 — 두 벌이 되면
   다음에 문구를 고칠 때 한쪽만 고치게 됩니다.

   휴대폰에서는 기계가 주는 공유창을 씁니다. 거기에 카카오톡이 들어 있어서
   SDK 없이도 카톡으로 보낼 수 있습니다.
   카카오 SDK 로 「카카오톡」 단추를 따로 두려면 JavaScript 키가 필요합니다
   (지금 가진 것은 로그인용 REST 키라 다릅니다).
   데스크톱에는 공유창이 없어 링크 복사로 떨어집니다. */
export function ShareButtons({
  title, text, path, compact = false, look,
}: {
  /* 'rapo' — 새 디자인 상세 헤더의 공유 단추 (Figma 「RAPO / Detail / Header」 517:354 · 44px) */
  look?: 'rapo';
  /* 공유창에 뜨는 제목. 뒤에 · RAPO 가 붙습니다 */
  title: string;
  /* 한 줄 설명. 안 주면 제목을 그대로 씁니다 */
  text?: string;
  /* 이 사이트 안의 주소 (/post/12 · /jobs/abc). 앞의 주소는 브라우저에서 붙입니다 */
  path: string;
  /* 상단바처럼 자리가 좁은 곳에서는 아이콘 하나로 줄입니다.
     누르면 공유창이 뜨고, 공유창이 없는 컴퓨터에서는 링크 복사로 떨어집니다 */
  compact?: boolean;
}) {
  const toast = useToast();

  const url = () => `${location.origin}${path}`;

  const share = async () => {
    const data = { title: `${title} · RAPO`, text: text ?? title, url: url() };

    if (navigator.share && navigator.canShare?.(data)) {
      try { await navigator.share(data); return; }
      catch { /* 취소는 잘못이 아닙니다 */ return; }
    }
    await copyLink();
  };

  const copyLink = async () => {
    const u = url();
    try {
      await navigator.clipboard.writeText(u);
      toast('링크를 복사했어요!');
    } catch {
      /* 안전하지 않은 연결(http)에서는 clipboard 가 막힙니다 */
      toast(`복사하지 못했어요 — 주소: ${u}`, { tone: 'danger', ms: 5000 });
    }
  };

  if (look === 'rapo') return <RapoShare share={share} url={url} />;

  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        /* 누르는 자리 48px — 손가락에 맞춥니다.
           눈금(--spacing)이 지워져 있어 h-9 는 CSS 가 안 나옵니다 */
        className="flex h-[48px] w-[48px] items-center justify-center rounded-full text-[#4A5056]
                   transition-transform duration-[120ms] active:scale-[0.88]
                   motion-reduce:transition-none"
      >
        <Icon name="share" size={24} />
        <span className="sr-only">공유</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="rounded-md bg-brand-red px-6 py-4 text-btn font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
      >
        공유
      </button>

      <button
        type="button"
        onClick={copyLink}
        className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
      >
        링크 복사
      </button>
    </>
  );
}

/* 새 디자인 공고 상세의 공유 — 「U03-S · 공유 수단 선택」 589:5105 · 「링크 복사 완료」 589:5140 ·
   「S-06 · 링크 복사 실패」 605:13261 · 「S-07 · 카카오톡 미지원」 605:13327 (2026-11-12 세중님 「다 피그마 기준」).
   공유 단추를 누르면 오른쪽 위에 작은 창(카카오톡 · 링크 복사)이 열립니다.
   ★ 카카오톡 — 카카오 공유 SDK 는 JavaScript 키가 있어야 해서(지금은 로그인용 REST 키뿐), 휴대폰의 공유창으로 보냅니다.
     공유창에 카카오톡이 들어 있습니다. 공유창이 없는 기기(대개 PC)에서는 원본 S-07 안내를 띄웁니다.
   ★ 결과 안내는 원본처럼 아래 고정 행동(저장·지원 112) 바로 위에 남색 띠로 2.5초 띄웁니다 */
function RapoShare({ share, url }: { share: () => Promise<void>; url: () => string }) {
  const [열림, set열림] = useState(false);
  const [알림, set알림] = useState<{ 글: string; 잘됨: boolean } | null>(null);
  const 시계 = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (시계.current) clearTimeout(시계.current); }, []);
  const 띄우기 = (글: string, 잘됨: boolean) => {
    set알림({ 글, 잘됨 });
    if (시계.current) clearTimeout(시계.current);
    시계.current = setTimeout(() => set알림(null), 2500);
  };

  const 카톡 = async () => {
    set열림(false);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') { await share(); return; }
    띄우기('이 기기에서는 카카오톡으로 바로 보낼 수 없어요. 링크를 복사해 보내 주세요', false);
  };
  const 복사 = async () => {
    set열림(false);
    try { await navigator.clipboard.writeText(url()); 띄우기('링크를 복사했어요', true); }
    catch { 띄우기('링크를 복사하지 못했어요. 잠시 뒤 다시 눌러 주세요', false); }
  };

  return (
    <span className="relative flex shrink-0">
      <button type="button" onClick={() => set열림((v) => !v)} aria-expanded={열림} aria-haspopup="menu"
        className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2)
                   active:bg-(--rapo-color-bg-transparent-pressed)">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/detail/share-20.svg" alt="" width={20} height={20} />
        <span className="sr-only">공유</span>
      </button>
      {열림 && (
        <>
          {/* 바깥을 누르면 닫힙니다 */}
          <button type="button" aria-label="공유 닫기" onClick={() => set열림(false)} className="fixed inset-0 z-40 cursor-default" />
          <span role="menu" className="absolute right-0 top-[52px] z-50 flex w-[192px] rounded-[16px] bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x3) shadow-(--rapo-shadow-s2)">
            <button type="button" role="menuitem" onClick={카톡}
              className="flex flex-1 flex-col items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) py-(--rapo-dimension-x2) active:bg-(--rapo-color-bg-transparent-pressed)">
              <span className="flex size-[44px] items-center justify-center rounded-[12px] bg-[#FEE500]">
                {/* eslint-disable-next-line @next/next/no-img-element -- 카카오 말풍선 원본 SVG (로그인 단추와 같은 것) */}
                <img src="/rapo/login/kakao-20.svg" alt="" width={24} height={24} />
              </span>
              <span className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">카카오톡</span>
            </button>
            <button type="button" role="menuitem" onClick={복사}
              className="flex flex-1 flex-col items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) py-(--rapo-dimension-x2) active:bg-(--rapo-color-bg-transparent-pressed)">
              <span className="flex size-[44px] items-center justify-center rounded-full bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
              <span className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">링크 복사</span>
            </button>
          </span>
        </>
      )}
      {알림 && (
        <span role="status" className="pointer-events-none fixed inset-x-0 z-50 mx-auto flex w-full max-w-3xl px-(--rapo-dimension-x5)"
          style={{ bottom: 'calc(112px + 12px + env(safe-area-inset-bottom))' }}>
          <span className="rapo-type-t5-bold flex min-h-[52px] w-full items-center justify-center gap-(--rapo-dimension-x2) break-keep rounded-[12px] bg-[#112231] px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-center text-white">
            {알림.잘됨 && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
            )}
            {알림.글}
          </span>
        </span>
      )}
    </span>
  );
}
