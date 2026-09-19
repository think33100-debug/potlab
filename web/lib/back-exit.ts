/* 뒤로가기 두 번으로 나가기 — 판정만 합니다.

   화면도 history 도 BackHandler 도 모릅니다. 그래서 웹과 앱이 같은 파일을 씁니다.
   앱(React Native)에서 붙일 때:

     const exit = createBackExit();
     BackHandler.addEventListener('hardwareBackPress', () => {
       if (!isHome) return false;                    // 홈이 아니면 기본 동작
       if (exit.press() === 'exit') { BackHandler.exitApp(); return true; }
       toast('한 번 더 누르면 종료됩니다');
       return true;
     });

   웹은 app/back-guard.tsx 가 붙입니다. */

export const EXIT_WINDOW_MS = 2000;

export type BackPress = 'warn' | 'exit';

export function createBackExit(
  windowMs: number = EXIT_WINDOW_MS,
  now: () => number = Date.now,
) {
  let armedAt = 0;

  return {
    /** 뒤로가기가 눌렸을 때 부릅니다. 'warn' 이면 안내만, 'exit' 이면 나갑니다 */
    press(): BackPress {
      const t = now();
      if (armedAt !== 0 && t - armedAt <= windowMs) {
        armedAt = 0;
        return 'exit';
      }
      armedAt = t;
      return 'warn';
    },

    /** 홈에 새로 들어왔을 때처럼 처음부터 다시 세는 자리 */
    reset() {
      armedAt = 0;
    },
  };
}
