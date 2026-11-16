import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* 탭 제목 (2026-11-16 세중님 테스터 점검 — 기본값 「RAPO · 채용공고」가 그대로 보였습니다).
   화면이 클라이언트 화면이라 app/login/layout.tsx 처럼 여기서 답니다 — 그리는 것은 없습니다 */
export const metadata: Metadata = { title: '알림 · RAPO' };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
