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

/** 상세 조건 · 기관 분류 — 여러 개 고를 수 있습니다 (2026-11-12 밤 세중님 「대학병원 종합병원 공공기관 재활 요양병원 복지관 요양원 아동센터 · 중복 선택 · 필터해 놓으면 기본으로 유지」).
    어느 공고가 어느 분류인지는 DB 의 공고분류() 한 자리가 정합니다(기관 표 공식 값 먼저 · 금고 SQL_1113/T). job_list 의 p_kinds 로 거릅니다.
    고른 값은 쿠키(분류쿠키)에 1년 둡니다 — 다음에 /jobs 를 열어도 그대로 걸립니다(이 기기에서). 주소의 kind= 가 있으면 그것이 먼저입니다 */
export const 기관분류들 = ['대학병원', '종합병원', '공공기관', '재활', '요양병원', '복지관', '요양원', '아동센터'] as const;
export const 분류쿠키 = 'rapo_kind';

/** 「대학병원,요양원」 꼴 글 → 아는 분류만 남긴 목록 (차례는 기관분류들 차례) */
export function 분류읽기(글: string | null | undefined): string[] {
  if (!글) return [];
  let 풀린 = 글;
  try { 풀린 = decodeURIComponent(글); } catch { /* 이미 풀린 글 */ }
  const 고른 = new Set(풀린.split(','));
  return 기관분류들.filter((k) => 고른.has(k));
}
