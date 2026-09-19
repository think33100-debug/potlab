/* 마지막에 쓴 로그인 수단을 이 기계에만 기억합니다.

   왜 — 카카오로 가입한 분이 다음에 네이버를 누르면 계정이 갈라집니다.
   갈라진 뒤에는 되돌리기가 번거로워서, 누르기 전에 표시로 막는 것이 목적입니다.

   서버에 안 보냅니다. 회원이 누구인지 모르는 화면이라 보낼 곳도 없습니다.

   앱(React Native)에서는 AsyncStorage 로 바꾸면 됩니다. 부르는 쪽은 그대로입니다
   (다만 그쪽은 비동기라 read 가 Promise 가 됩니다). */

export type LoginMethod = 'kakao' | 'naver' | 'apple';

const KEY = 'potjob.last-login';

/* 시크릿 창·사이트 데이터 차단에서는 읽기만 해도 예외가 납니다.
   못 읽으면 표시를 안 하면 그만이라 조용히 넘깁니다 */
export function readLastLogin(): LoginMethod | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'kakao' || v === 'naver' || v === 'apple' ? v : null;
  } catch {
    return null;
  }
}

export function writeLastLogin(m: LoginMethod) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* 기억 못 해도 로그인 자체는 되어야 합니다 */
  }
  listeners.forEach((l) => l());
}

/* useSyncExternalStore 로 읽으려고 붙입니다.
   effect 안에서 setState 하는 것보다 이쪽이 맞습니다 — 바깥 저장소를 구독하는 일이니까요.
   서버에는 localStorage 가 없어 serverLastLogin() 이 null 을 줍니다 */
const listeners = new Set<() => void>();

export function subscribeLastLogin(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export const serverLastLogin = (): LoginMethod | null => null;
