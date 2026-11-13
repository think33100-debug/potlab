import type { MetadataRoute } from 'next';
import { 대표주소 } from '@/lib/site-url';
import { 색인길 } from '@/lib/seo';
import { TERMS } from '@/lib/terms';

/* 검색엔진에 알려 주는 쪽 목록 (2026-11-13 세중님 「검색 가능하게」).
   lib/seo.ts 의 색인길과 약관 세 장입니다. 구글 서치 콘솔·네이버 서치어드바이저에 이 주소를 냅니다 —
   https://www.rapojob.co.kr/sitemap.xml */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...색인길.map((p) => ({ url: 대표주소 + p })),
    ...Object.keys(TERMS).map((doc) => ({ url: `${대표주소}/terms/${doc}` })),
  ];
}
