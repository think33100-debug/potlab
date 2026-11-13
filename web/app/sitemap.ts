import type { MetadataRoute } from 'next';
import { 대표주소 } from '@/lib/site-url';
import { 색인길, 안내글길 } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import { TERMS } from '@/lib/terms';

/* 검색엔진에 알려 주는 쪽 목록 (2026-11-13 세중님 「검색 가능하게」).
   lib/seo.ts 의 색인길 · 안내 글(안내글길) · 약관 세 장 · **마감 전 공고 전부**(세중님 「공고 글도 검색되게」).
   구글 서치 콘솔·네이버 서치어드바이저에 이 주소를 냅니다 — https://www.rapojob.co.kr/sitemap.xml

   공고 목록은 DB 창구 sitemap_jobs() 가 줍니다 — 공고 번호와 올린 날 두 칸뿐입니다
   (비회원 열쇠로 부릅니다 · RAPO노트/SQL_1113/ZA_사이트맵공고.sql). 창구가 실패하면 공고 없이 냅니다 */
export const revalidate = 3600; // 한 시간마다 새로 — 새 공고가 늦어도 한 시간 안에 실립니다

/* 창구가 한 번에 100줄까지만 줍니다(DB 응답 한도) — 쪽을 나눠 받습니다.
   차례는 창구가 정합니다(올린 날 · 번호 순 · 지침 8-20). 창구 안 한도 5000 까지 */
async function 공고번호들() {
  const 쪽 = 100;
  const 모두: { id: string; posted_at: string | null }[] = [];
  for (let 앞 = 0; 앞 < 5000; 앞 += 쪽) {
    const { data, error } = await supabase.rpc('sitemap_jobs').range(앞, 앞 + 쪽 - 1);
    if (error || !data) break;
    모두.push(...(data as typeof 모두));
    if (data.length < 쪽) break;
  }
  return 모두;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const 공고 = (await 공고번호들()).map((j) => ({
    url: `${대표주소}/jobs/${encodeURIComponent(j.id)}`,
    ...(j.posted_at ? { lastModified: j.posted_at } : {}),
  }));
  return [
    ...색인길.map((p) => ({ url: 대표주소 + p })),
    ...안내글길.map((p) => ({ url: 대표주소 + p })),
    ...Object.keys(TERMS).map((doc) => ({ url: `${대표주소}/terms/${doc}` })),
    ...공고,
  ];
}
