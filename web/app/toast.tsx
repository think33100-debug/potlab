'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

export const TOAST_MS = 2000;

type Tone = 'default' | 'danger';
type Opts = { tone?: Tone; ms?: number };
type Show = (text: string, opts?: Opts) => void;

/* 화면 아래 잠깐 떴다 사라지는 띠입니다.
   저장됨·복사됨·오류·뒤로가기 안내를 전부 이걸로 씁니다.

   쓰는 쪽:
     const toast = useToast();
     toast('저장됐어요');
     toast('불러오지 못했어요', { tone: 'danger' });

   ponytail: 한 번에 하나만 띄웁니다. 새 토스트가 앞의 것을 덮습니다.
   줄 세우기(queue)는 두 개가 동시에 뜨는 화면이 생기면 그때 만듭니다 */
const Ctx = createContext<Show>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ id: number; text: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<Show>((text, opts) => {
    if (timer.current) clearTimeout(timer.current);
    setT({ id: Date.now(), text, tone: opts?.tone ?? 'default' });
    timer.current = setTimeout(() => setT(null), opts?.ms ?? TOAST_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* 떠 있는 것이라 그림자를 씁니다 — teamsparta.md 는 카드·행·탑바에는 안 씁니다 */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-6 pb-7"
      >
        {t && (
          <p
            key={t.id}
            data-toast
            className={
              'animate-toast-in max-w-full truncate rounded-sm px-6 py-5 text-lg font-medium text-white shadow-lg ' +
              (t.tone === 'danger' ? 'bg-brand-red-dark' : 'bg-gray-900')
            }
          >
            {t.text}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}
