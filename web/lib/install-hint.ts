/* 설치 안내 토스트의 표식과 머리 스크립트 (2026-11-13 세중님 · components/rapo/rapo-install-toast.tsx).
   'use client' 파일에 두면 서버 파일(app/layout.tsx)이 글자 대신 참조를 받습니다 — 그래서 여기 따로 둡니다.
   표식은 이 기기의 localStorage 에만 둡니다(서버에 안 보냄). */

/** 가입 끝(app/welcome)에서 남기는 표식 — 다음 화면에서 토스트가 한 번 뜹니다 */
export const 설치안내표식 = 'rapo.install-hint';
/** 「나중에」·닫기·설치를 한 뒤 — 다시 안 띄웁니다 */
export const 설치안내끝 = 'rapo.install-hint-done';

/** 화면이 뜨자마자 오는 설치 신호(beforeinstallprompt · 크롬·엣지)를 미리 받아 두는 한 줄 — app/layout.tsx 머리에 넣습니다.
    브라우저의 작은 기본 안내줄은 막고(preventDefault), 우리 토스트의 「설치하기」가 그 신호로 설치 창을 엽니다 */
export const INSTALL_SCRIPT = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__rapoInstall=e;window.dispatchEvent(new Event('rapo-install-ready'))});`;

/** 가입 끝에서 부릅니다 — 다음 화면에서 한 번 뜨게 표식을 남깁니다 */
export function 설치안내남기기() {
  try { if (!localStorage.getItem(설치안내끝)) localStorage.setItem(설치안내표식, '1'); } catch { /* 사생활 보호 창 */ }
}
