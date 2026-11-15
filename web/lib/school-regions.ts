/* 학교(학과)별 소재 시도 — 2026-11-15 학교 공식 누리집·대학알리미에서 확인한 것만 (lib/signup-school.ts 가 씁니다).
   확인 못 한 학교는 넣지 않습니다(그 학교는 가입 화면에 학제만 보임). 확인 기록은 RAPO노트/검색노출/학교지역_확인_1115.md */

type 지역 = { 시도: string | null; 학제?: '3년제' | '4년제' | null };

export const 학교지역: { ot: Record<string, 지역>; pt: Record<string, 지역> } = { ot: {}, pt: {} };
