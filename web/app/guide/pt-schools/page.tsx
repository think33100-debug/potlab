import { 색인메타 } from '@/lib/seo';
import { 그림판 } from '@/lib/site-url';
import { SchoolList, 목록제목 } from '../school-guide';

/* 전국 물리치료(학)과 대학 목록 (2026-11-13 세중님 「전국 작업치료사 물리치료사 학교 있는 곳도 찾아서 정리」).
   틀과 적는 규칙은 ../school-guide.tsx · 목록은 lib/guide-schools.ts 입니다 */

const { 제목, 설명 } = 목록제목('pt');

export const metadata = {
  title: 제목,
  description: 설명,
  robots: 색인메타,
  alternates: { canonical: '/guide/pt-schools' },
  openGraph: { type: 'article', siteName: 'RAPO', title: 제목, description: 설명, images: [`/api/og/site?v=${그림판}`] },
};

export default function PtSchoolsGuide() {
  return <SchoolList 직="pt" />;
}
