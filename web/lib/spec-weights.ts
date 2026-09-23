/* 배점. **화면 코드에서는 절대 불러오지 마세요.**

   불러오는 순간 브라우저 번들에 값이 그대로 실려서, 개발자도구를 열면
   누구나 읽습니다. 화면에 안 그려도 소용없습니다.

   이 값은 우리가 직접 만든 기준입니다 (2026-09-23 · 밖으로 나가면 안 됩니다).
   진짜 계산은 DB 의 spec_parts() 가 합니다 — 여기 값은 그것과 같은지
   시험으로 확인하는 용도뿐입니다 (lib/spec.test.mjs).

   쓰는 곳: lib/spec.test.mjs 하나. 늘어나면 그때 다시 생각하세요. */
export const PART_MAX = {
  gpa: 60, lang: 15, certs: 10, school: 5, courses: 5, practice: 5,
} as const;
