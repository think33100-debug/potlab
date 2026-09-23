/* 회원이 누구인지 — 직군과 역할.

   직군 (profiles.job_group)  공고를 거르는 기준이자 커뮤니티 표시
   역할 (profiles.role)       커뮤니티 방이 이걸로 갈립니다 (lib/channels.ts)

   역할 값은 gas/wage.js 의 chFor_ 가 보던 '학생' / 그 외 와 같아야 합니다.
   DB 쪽에도 check (role in ('현직','학생')) 가 걸려 있습니다. */

export const JOB_GROUPS = ['작업치료사', '물리치료사'] as const;
export const ROLES = ['현직', '학생'] as const;

export type JobGroup = (typeof JOB_GROUPS)[number];
export type Role = (typeof ROLES)[number];

/* 글·댓글에 붙는 글쓴이.

   erased_at 이 있으면 계정을 지운 분입니다. 글과 댓글은 남기고 이름만
   가립니다 — 글까지 지우면 남의 대화가 구멍 납니다 (댓글이 누구 글에
   달렸는지 못 알아보게 됩니다).

   이때 nickname 에는 「지운계정-…」 같은 값이 들어 있습니다. 겹치면 안 되는
   칸이라(UNIQUE · NOT NULL) 비울 수가 없어서요.
   그 값을 화면에 그대로 내보내면 안 됩니다 — 반드시 이 함수를 거치세요.

   관리자 화면은 이걸 안 씁니다. 거기서는 원래 누구였는지 보여야 해서
   erased_accounts 표를 따로 읽습니다 (app/admin/posts/page.tsx). */
export type Author = {
  nickname: string;
  avatar?: string | null;
  erased_at?: string | null;
} | null | undefined;

/** 화면에 내보낼 이름. 지운 계정과 사라진 줄은 똑같이 「알 수 없음」입니다 */
export function shownName(p: Author): string {
  if (!p || p.erased_at) return '알 수 없음';
  return p.nickname;
}

export const ROLE_DESC: Record<Role, string> = {
  현직: '임상 · 급여 · 이직 방이 보입니다',
  학생: '국가고시 · 실습 · 첫직장 방이 보입니다',
};
