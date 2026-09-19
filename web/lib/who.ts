/* 회원이 누구인지 — 직군과 역할.

   직군 (profiles.job_group)  공고를 거르는 기준이자 커뮤니티 표시
   역할 (profiles.role)       커뮤니티 방이 이걸로 갈립니다 (lib/channels.ts)

   역할 값은 gas/wage.js 의 chFor_ 가 보던 '학생' / 그 외 와 같아야 합니다.
   DB 쪽에도 check (role in ('현직','학생')) 가 걸려 있습니다. */

export const JOB_GROUPS = ['작업치료사', '물리치료사'] as const;
export const ROLES = ['현직', '학생'] as const;

export type JobGroup = (typeof JOB_GROUPS)[number];
export type Role = (typeof ROLES)[number];

export const ROLE_DESC: Record<Role, string> = {
  현직: '임상 · 급여 · 이직 방이 보입니다',
  학생: '국가고시 · 실습 · 첫직장 방이 보입니다',
};
