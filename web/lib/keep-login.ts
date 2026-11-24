/* 로그인 쿠키를 **서버가 다시 구워 주는** 규칙 (2026-11-23 세중님 「사파리 아직도 해결 안 되고 있다」).

   ── 왜 ───────────────────────────────────────────────────────────
   로그인은 브라우저에서 끝납니다(/auth/callback). 그래서 로그인 쿠키를 **자바스크립트가** 씁니다.
   사파리(아이폰의 크롬·앱 안 브라우저도 같은 엔진)는 자바스크립트가 쓴 쿠키를 **7일**까지만 둡니다 —
   우리는 400일로 적지만 사파리가 7일로 줄입니다(추적 방지 규칙 ITP). 7일 안에 다시 안 오면 로그인이 풀립니다.
   **서버 응답(Set-Cookie)으로 쓴 쿠키는 안 줄입니다.** 그래서 같은 값을 서버가 한 번 더 써 줍니다.

   ── 언제 ─────────────────────────────────────────────────────────
   로그인 쿠키 값이 바뀔 때마다 한 번(로그인 직후 · 토큰 갱신 직후). 「이미 구웠다」는 표(굽기표)에
   그 값의 지문을 적어 두고, 지문이 같으면 다시 쓰지 않습니다 — 요청마다 큰 쿠키를 내려보내지 않으려고.

   쓰는 곳 — middleware.ts(굽는 자리) · lib/supabase-browser.ts(브라우저가 토큰을 갱신하면 굽는길을 한 번 부름) */

export const 굽기표 = 'rapo-keep';
/* 화면이 없는 주소입니다 — middleware 가 쿠키만 구워 204 로 답합니다 */
export const 굽는길 = '/auth/keep';

/* 진짜 세션 쿠키만 — `sb-<ref>-auth-token` 과 쪼개진 `.0` `.1`.
   로그인 도중의 임시 쪽지(`…-code-verifier`)는 아닙니다 */
export const 로그인쿠키인가 = (이름: string) => /^sb-.+-auth-token(\.\d+)?$/.test(이름);

/* 로그인 쿠키 값의 지문 (FNV-1a 32비트 · 8글자). 비밀이 아니라 「값이 바뀌었나」만 가립니다.
   빈 값은 뺍니다 — 지워지는 중인 조각(값 '')을 세면 지운 쿠키를 되살리게 됩니다 */
export function 쿠키지문(목록: readonly { name: string; value: string }[]): string | null {
  const 고른 = 목록.filter((c) => 로그인쿠키인가(c.name) && c.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (!고른.length) return null;
  let h = 0x811c9dc5;
  for (const c of 고른) {
    const 글 = `${c.name}=${c.value};`;
    for (let i = 0; i < 글.length; i++) {
      h ^= 글.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
