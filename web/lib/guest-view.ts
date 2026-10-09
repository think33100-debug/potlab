/* 「비회원 보기」 — 마스터가 로그인을 **유지한 채** 비회원 화면을 겪어 보는 길
   (2026-10-09).

   ── 왜 쿠키인가 ──────────────────────────────────────────────
   화면만 비회원처럼 그리면 **자료가 샙니다.** 회원 전용 창구가 그대로
   JWT 를 받아 답을 주기 때문입니다. 그래서 서버와 브라우저 **둘 다**
   JWT 를 안 보내게 해야 하는데, 서버가 「지금 비회원 보기인가」를 알 길은
   요청에 실려 오는 것뿐입니다. localStorage 는 서버가 못 봅니다.

   ── 쿠키 하나로 정해도 안전한 까닭 ───────────────────────────
   이 쿠키가 하는 일은 **권한을 버리는 것**뿐입니다. 누가 손으로 넣어도
   로그아웃한 화면을 볼 뿐이고, 더 볼 수 있게 되는 것은 하나도 없습니다.
   올리는 쪽이 아니라 내리는 쪽이라 확인이 필요 없습니다.

   DB 의 마스터페르소나.지금역할 에도 '비회원' 을 적어 둡니다 — 그건
   **기록**이고, 실제로 권한을 떼는 것은 이 쿠키입니다.

   ── 이름을 영문으로 지은 까닭 ────────────────────────────────
   쿠키 이름에 한글을 넣으면 Set-Cookie 헤더에서 퍼센트 인코딩됩니다.
   헤더 값은 latin-1 이라 그렇습니다 (작업지침 12절 — 다리가 1시간 53분
   멈춘 그 자리와 같은 함정입니다). */

export const GUEST_COOKIE = 'potjob_guest_view';

/** 브라우저에서 — 지금 비회원 보기인가. 서버 렌더 때는 늘 false 입니다 */
export function 비회원보기중(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === `${GUEST_COOKIE}=1`);
}

/** 브라우저에서 — 켜고 끕니다. 부른 쪽이 화면을 통째로 새로 열어야 합니다 */
export function 비회원보기(켤까: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = 켤까
    ? `${GUEST_COOKIE}=1; path=/; max-age=86400; samesite=lax`
    : `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
