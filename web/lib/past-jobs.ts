import type { SupabaseClient } from '@supabase/supabase-js';
import type { 지난공고줄 } from '@/components/rapo/rapo-past-jobs';

/* 지난 공고 — DB 지난공고() 한 자리 (2026-11-22 세중님 · 설계 RAPO노트/설계/지난공고_1122.md).
   회원만 실행됩니다(비회원·오류는 빈 목록 → 칸을 안 그림). 공고와 병원은 **기관번호**로 잇습니다.
     공고 상세  { 공고: id }        — 지금 공고는 빼고
     병원 화면  { 이름, 시도 }      — 기관 표의 이름이 하나로 안 가려지면 0줄 */
export type 지난공고묶음 = { 줄: 지난공고줄[]; 전체: number; 기관이름: string | null };

const 빈묶음: 지난공고묶음 = { 줄: [], 전체: 0, 기관이름: null };

export async function 지난공고받기(
  sb: SupabaseClient,
  q: { 공고: string; n: number } | { 이름: string; 시도: string | null; n: number },
): Promise<지난공고묶음> {
  const 인수 = '공고' in q
    ? { p_공고: q.공고, p_n: q.n }
    : { p_이름: q.이름, p_시도: q.시도, p_n: q.n };
  const { data, error } = await sb.rpc('지난공고', 인수);
  if (error || !Array.isArray(data) || data.length === 0) return 빈묶음;
  const 줄 = data as (지난공고줄 & { 전체: number; 기관이름: string | null })[];
  return {
    줄: 줄.map(({ id, 마감, 직군, 고용형태, 인원, 제목 }) => ({ id, 마감, 직군, 고용형태, 인원, 제목 })),
    전체: 줄[0].전체 ?? 줄.length,
    기관이름: 줄[0].기관이름 ?? null,
  };
}

/* 병원 화면 주소 — 「병원 정보」 탭의 지난 공고 자리로 바로 갑니다 */
export const 지난공고주소 = (기관이름: string, 시도?: string | null) =>
  `/orgs?org=${encodeURIComponent(기관이름)}${시도 ? `&sido=${encodeURIComponent(시도)}` : ''}&past=all#past-jobs`;
