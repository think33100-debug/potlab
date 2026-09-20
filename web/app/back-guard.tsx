'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createBackExit, EXIT_WINDOW_MS } from '@/lib/back-exit';
import { useToast } from './toast';

/* 홈에서 뒤로가기를 누르면 바로 안 꺼지게 합니다.

   웹에는 「앱 종료」가 없어서 history 한 칸을 미리 쌓아두고 그걸 씁니다.

     들어옴        [이전, 홈+칸]        ← 칸을 쌓음
     뒤로 1회      [이전, 홈]           ← popstate. 안내 + 칸을 다시 쌓음
     뒤로 2회      [이전]               ← 2초 안이면 history.back() 으로 진짜 나감

   세션 4 에서 못 찾았던 자리가 「안내 뒤에 칸을 다시 안 쌓은 것」이었습니다.
   다시 안 쌓으면 세 번째 뒤로가기에서 그냥 나가버립니다. ensureGuard() 가 그 자리입니다.

   홈이 아니면 아무것도 안 합니다 — 브라우저 기본 뒤로가기가 이전 화면으로 갑니다. */

const GUARD = 'potjobBackGuard';

/* 이번 방문에서 **처음 열린 자리**를 한 번만 적어둡니다.

   공고 상세가 「카톡으로 받은 링크인지 · 목록에서 눌러 들어온 것인지」를
   가르는 데 씁니다 (components/job-veil.tsx).
   공고 화면에서만 적으면 언제나 그 공고가 되어버려서, 모든 화면에 붙는
   여기서 적습니다. */
export function markEntry() {
  try {
    if (!sessionStorage.getItem('entry_path')) {
      sessionStorage.setItem('entry_path', location.pathname);
    }
  } catch { /* 사파리 비공개 */ }
}

export function BackGuard({ home = '/' }: { home?: string }) {
  const pathname = usePathname();
  const toast = useToast();
  const exit = useRef(createBackExit());

  /* 그리는 중에 부르면 서버에서도 돌려다 걸립니다. 붙은 뒤에 한 번만 */
  useEffect(() => { markEntry(); }, []);

  useEffect(() => {
    if (pathname !== home) return;
    const back = exit.current;
    back.reset();

    /* Next 가 history.state 에 제 것을 넣어둡니다 — 덮으면 라우터가 길을 잃습니다.
       그래서 펼쳐서 얹습니다 */
    const ensureGuard = () => {
      if (!(window.history.state as Record<string, unknown>)?.[GUARD]) {
        window.history.pushState({ ...window.history.state, [GUARD]: true }, '');
      }
    };

    ensureGuard();

    const onPop = () => {
      if (back.press() === 'exit') {
        window.history.back();   // 쌓아둔 칸 너머로 — 여기서 사이트를 벗어납니다
        return;
      }
      toast('한 번 더 누르면 나가요', { ms: EXIT_WINDOW_MS });
      ensureGuard();             // ← 자리를 다시 쌓습니다
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [pathname, home, toast]);

  return null;
}
