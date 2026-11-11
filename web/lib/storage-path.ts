/* 회원이 올리는 파일의 저장 경로 — 공통 규칙 한 자리 (2026-11-11).

   경로에는 **올린 사람과 이어지는 값을 하나도 안 넣습니다** — 회원 id 도,
   글 번호도, 올린 시각도 아닙니다. 「뜻 없는 앞머리 한 글자 / 무작위 uuid + 확장자」뿐입니다.
   누가 올렸는지는 DB 에만 둡니다 (storage.objects.owner_id · 그 파일을 가리키는 표의 줄).

   경로는 ASCII 만 씁니다 — Storage 열쇠는 한글을 못 받습니다 (작업지침 6-2b).

   이 규칙을 쓰는 곳 — 프로필 사진(lib/avatar-path.ts). 글 사진도 같은 꼴입니다. */

export const UUID꼴 = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** 받은 uuid 를 소문자로 다듬어 돌려줍니다. uuid 꼴이 아니면 던집니다 */
export function 무작위이름(uuid: string = crypto.randomUUID()): string {
  const u = uuid.toLowerCase();
  if (!new RegExp(`^${UUID꼴}$`).test(u)) throw new Error('uuid 꼴이 아닙니다');
  return u;
}
