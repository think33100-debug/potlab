import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LeaveTool from '@/app/tools/leave/page';
import PayTool from '@/app/tools/pay/page';
import SeveranceTool from '@/app/tools/severance/page';
import Unemployment from '@/app/tools/unemployment/page';

/* 계산기 넷 미리보기 (2026-11-14) — 개발 서버에서만 열립니다(배포에서는 404). 실제 화면은 /tools/<이름> (테스터 로그인 필요).
     ?t=pay(기본) · severance · leave · unemployment */
export const metadata: Metadata = { title: 'RAPO · 계산기 미리보기', robots: { index: false } };

export default async function DesignPreviewTools({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { t } = await searchParams;
  if (t === 'severance') return <SeveranceTool />;
  if (t === 'leave') return <LeaveTool />;
  if (t === 'unemployment') return <Unemployment />;
  return <PayTool />;
}
