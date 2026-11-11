import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* 로그인 화면은 클라이언트 화면이라 탭 제목을 여기서 답니다 — 서비스 이름은 RAPO */
export const metadata: Metadata = { title: 'RAPO · 로그인' };

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
