/* 공고 목록 조건의 고를 거리 — 서버 화면(app/jobs/page.tsx)과 조건 시트(components/rapo/rapo-job-filters.tsx)가 같이 씁니다.

   ★ 2026-11-11 밤 — 이 목록을 'use client' 파일에서 내보내 서버 화면이 가져다 썼더니,
     서버에서는 배열이 아니라 「클라이언트 참조」가 와서 `.includes` 가 없다며 화면이 멈췄습니다
     (상세 → 「정규직」 → 조건 적용 · 오류 2607662640). 서버도 쓰는 값은 이렇게 'use client' 없는 파일에 둡니다. */

/** 상세 조건 · 고용형태 (원본 차례 그대로 · DB job_list 의 p_employ 로 거름) */
export const 고용형태들 = ['전체', '정규직', '계약직', '시간제'] as const;

/** 공고 정렬 — 홈과 공고 목록이 같이 씁니다. 첫 줄이 기본입니다 (2026-11-12 세중님 「인기순이 기본 · 마감 임박순도」).
    key 는 DB job_list(p_sort) 값 그대로 — views = 조회 많은 순 · new = 올라온 날 최신 · deadline = 마감일 가까운 순
    ★ 마감 임박순은 DB 가 **마감일이 적힌 공고만** 냅니다(수시·「공고문 확인」은 빠집니다 — 섞으면 순서가 뜻이 없어서) */
export const 공고정렬들 = [
  { key: 'views',    label: '인기순' },
  { key: 'new',      label: '최신순' },
  { key: 'deadline', label: '마감 임박순' },
] as const;
export type 공고정렬 = (typeof 공고정렬들)[number]['key'];
export const 기본정렬: 공고정렬 = 'views';
