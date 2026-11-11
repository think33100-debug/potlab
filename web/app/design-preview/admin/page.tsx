import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminHome from '@/app/admin/page';
import { RapoAdminShell } from '@/components/rapo/rapo-admin';

/* 관리자 홈 — **견본**. 개발 서버에서만. 이 PC 는 DB 에 못 닿아 숫자 자리는 「못 불러왔어요」로 보입니다(틀과 메뉴를 보는 자리) */
export const metadata: Metadata = { title: 'RAPO · 관리자 미리보기', robots: { index: false } };

export default function DesignPreviewAdmin() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <RapoAdminShell><AdminHome /></RapoAdminShell>;
}
