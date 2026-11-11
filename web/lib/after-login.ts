/* 로그인 뒤 돌아올 자리 (2026-11-11 밤 · 대표 「커뮤니티에서 로그인하면 홈으로 가버림」).

   전에는 sessionStorage('potjob.after-login') 하나에만 적었습니다. sessionStorage 는 **탭 하나**에만 삽니다 —
   휴대폰에서 카카오·네이버 앱으로 로그인하고 돌아오면 **새 탭**이 열려 그 쪽지가 없고, 그래서 홈으로 떨어졌습니다.
   이제 localStorage 에도 시각과 함께 적고(30분까지만 믿음), 읽을 때는 sessionStorage → localStorage 차례로 봅니다.
   우리 사이트 안 주소(/ 로 시작 · // 아님)만 받습니다. 쪽지를 적는 다른 자리(sessionStorage 직접)도 그대로 읽힙니다. */

const KEY = 'potjob.after-login';
const 유효 = 30 * 60 * 1000;

const 안주소 = (p: string | null | undefined): p is string => !!p && p.startsWith('/') && !p.startsWith('//');

export function setAfterLogin(path: string) {
  if (!안주소(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* 사파리 비공개 */ }
  try { localStorage.setItem(KEY, JSON.stringify({ p: path, t: Date.now() })); } catch { /* 저장 막힘 */ }
}

export function peekAfterLogin(): string | null {
  try {
    const s = sessionStorage.getItem(KEY);
    if (안주소(s)) return s;
  } catch { /* 무시 */ }
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { p?: string; t?: number } | null;
    if (v && 안주소(v.p) && typeof v.t === 'number' && Date.now() - v.t < 유효) return v.p;
  } catch { /* 무시 */ }
  return null;
}

export function clearAfterLogin() {
  try { sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/* 로그인 「시도」한 수단 — 누른 순간이 아니라 **로그인이 끝난 뒤**에야 「최근에 ○○로 만났어요」로 기억합니다 */
const TRY = 'potjob.login-try';
export function setLoginTry(m: string) {
  try { localStorage.setItem(TRY, JSON.stringify({ m, t: Date.now() })); } catch { /* 무시 */ }
}
export function takeLoginTry(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(TRY) ?? 'null') as { m?: string; t?: number } | null;
    localStorage.removeItem(TRY);
    if (v?.m && typeof v.t === 'number' && Date.now() - v.t < 유효) return v.m;
  } catch { /* 무시 */ }
  return null;
}
