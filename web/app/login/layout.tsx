import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { preload } from 'react-dom';

/* 로그인 화면은 클라이언트 화면이라 탭 제목을 여기서 답니다 — 서비스 이름은 RAPO */
export const metadata: Metadata = { title: 'RAPO · 로그인' };

export default function LoginLayout({ children }: { children: ReactNode }) {
  /* 사진 먼저 받기 (2026-11-16 세중님 테스터 점검 — 첫 화면에서 사진이 1~2초 늦게 떠 위쪽 반이 빈 남색으로 보였습니다).
     사진(359KB · components/rapo/rapo-login.tsx)은 화면 스크립트가 그려야 발견돼 늦게 받기 시작했습니다.
     서버가 보내는 <head> 에 미리 받기 줄을 넣어 HTML 을 읽자마자 받게 합니다 — 세 장이 같은 파일이라 한 번만 받습니다 */
  preload('/rapo/login/photo-colleagues.webp', { as: 'image', fetchPriority: 'high' });
  return children;
}
