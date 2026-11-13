import { notFound } from 'next/navigation';
import { 색인메타 } from '@/lib/seo';
import { 그림판 } from '@/lib/site-url';
import { SchoolDetail, 학교제목, 학교찾기 } from '../../school-guide';

/* 물리치료(학)과 학교 한 곳 (2026-11-13 세중님 「우송대학교 물리치료학과 이렇게 검색할 때 우리도 나올 수 있게」).
   틀과 적는 규칙은 ../../school-guide.tsx 입니다. 주소의 [slug] 는 lib/guide-schools.ts 의 슬러그이고, 목록에 없는 주소는 404 입니다 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = 학교찾기('pt', slug);
  if (!s) return { title: '없는 쪽입니다 · RAPO' };
  const { 제목, 설명 } = 학교제목('pt', s);
  return {
    title: 제목,
    description: 설명,
    robots: 색인메타,
    alternates: { canonical: `/guide/pt-schools/${s.슬러그}` },
    openGraph: { type: 'article', siteName: 'RAPO', title: 제목, description: 설명, images: [`/api/og/site?v=${그림판}`] },
  };
}

export default async function PtSchoolGuide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = 학교찾기('pt', slug);
  if (!s) notFound();
  return <SchoolDetail 직="pt" s={s} />;
}
