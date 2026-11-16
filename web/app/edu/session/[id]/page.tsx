import type { Metadata } from 'next';
import { EduSessionView } from '@/components/rapo/rapo-edu-session';

/* 탭 제목 (2026-11-16 · 기본값 「RAPO · 채용공고」가 보였습니다). 회차 이름은 화면이 브라우저에서 읽어서 여기서는 묶음 이름만 답니다 */
export const metadata: Metadata = { title: '교육 신청 · RAPO' };

/* 교육 회차 한 건 — 그리기와 흐름은 components/rapo/rapo-edu-session.tsx (2026-11-15 · 미리보기가 같이 씀) */
export default function EduSession() {
  return <EduSessionView />;
}
