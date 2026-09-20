/* 화면 코드가 글자로 써야 하는 브랜드 색을 한 곳에 모읍니다.

   왜 CSS 토큰(app/globals.css)이 아니라 여기인가 —
   카톡 미리보기 그림(app/api/og)은 satori 가 그리는데, 그쪽은 CSS 변수를
   못 읽습니다. 값이 필요한 자리가 CSS 밖에도 있어서 글자로도 한 벌 둡니다.
   두 벌이 되지 않게, **글자로 쓰는 자리는 전부 여기서 가져다 씁니다.**
   실제로 #16704A 가 두 파일에 따로 적혀 있던 것을 여기로 모았습니다 (2026-09-20). */

/* 직군 배지 */
export const JOB_COLOR: Record<string, string> = {
  작업치료사: '#22505E',   // potjob teal
  물리치료사: '#16704A',   // potjob green
  공통: '#FF3B30',         // potjob red
};
export const JOB_COLOR_FALLBACK = '#4A4D54';

/* 얼마나 바쁜 곳인지 — 세 단계.

   회색은 안 씁니다. 회색으로 두면 「아직 자료가 없어요」로 읽힙니다.
   여유로운 곳에 빨강을 쓰면 경고로 읽혀서, 물리치료사 배지에 쓰는
   초록을 그대로 씁니다 — 새 색을 만들지 않습니다. */
export const BUSY_COLOR = {
  busy: '#FF3B30',   // 빨강
  mid: '#14181C',    // 먹색
  easy: '#16704A',   // 초록
} as const;
