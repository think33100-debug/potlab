import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeU01 } from '@/components/rapo/home-u01';
import { 견본공고 } from '@/components/rapo/home-u01-sample';
import './preview.css';

/* 새 디자인 홈 미리보기 (2026-11-11 · 디자인 확인용).

   ★ 개발 서버(npm run dev)에서만 열립니다. 배포(빌드)에서는 404 입니다 —
     회원에게 보이는 화면을 바꾸지 않습니다. 지금 홈(/)은 그대로입니다.
   디자인 확인이 끝나면 app/page.tsx 가 HomeU01 을 부르게 바꾸는 것이 다음 걸음이고,
   그때 견본 공고 대신 실제 공고를 잇습니다(무엇을 보일지는 진행 파일의 질문). */
export const metadata: Metadata = { title: 'RAPO · 홈 미리보기', robots: { index: false } };

export default function DesignPreviewHome() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <HomeU01 jobs={견본공고} sample />;
}
