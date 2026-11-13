import type { MetadataRoute } from 'next';
import { 대표주소 } from '@/lib/site-url';

/* ★ 2026-11-11 — 클로즈드 베타(11/13~) 동안 검색엔진 색인을 막았습니다 (세중님 결정 · 줄 A).
   ★ 2026-11-13 세중님 「검색 가능하게」 — 로봇이 들어오게 엽니다.
     무엇을 검색에 올릴지는 robots.txt 가 아니라 **쪽마다의 noindex** 가 정합니다 (lib/seo.ts 한 자리).
     robots.txt 로 막으면 로봇이 쪽을 못 열어 noindex 도 못 보기 때문입니다.
     회원 화면은 로봇(비회원)이 열면 로그인으로 돌려보내집니다 (middleware.ts). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${대표주소}/sitemap.xml`,
  };
}
