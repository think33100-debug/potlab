/* 커뮤니티 글 사진의 저장 경로 (2026-11-11).

   경로에는 **글쓴이와 이어지는 값을 하나도 안 넣습니다** — 회원 id 도, 글 번호도,
   올린 시각도 아닙니다. 무작위 uuid 하나와 확장자뿐입니다.
   누가 올렸는지는 DB 에만 있습니다 (post_images → posts.author_id ·
   storage.objects.owner_id). 둘 다 회원에게 안 나가는 칸입니다.

   경로는 ASCII 만 씁니다 — Storage 열쇠는 한글을 못 받습니다 (작업지침 6-2b).

   `i/` 앞머리는 뜻이 없는 고정 글자입니다. 옛 꼴(`<회원uuid>/<글번호>/<n>.webp`)과
   한눈에 갈리고, 정리 도구(tools/clean_orphan_files.js)의 옛 꼴 목록에
   **안 맞아서** 새 파일을 건드리지 않습니다.

   같은 꼴을 세 곳이 씁니다 — 글쓰기 화면 · 옮기기 도구(tools/글사진경로옮기기.mjs) ·
   Storage 정책 SQL(금고). 기준은 이 파일 한 자리입니다 (작업지침 6절). */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** 새 꼴 — `i/<uuid>.webp` · 작은 그림은 `i/<uuid>-t.webp` */
export const 새꼴 = new RegExp(`^i/${UUID}(-t)?\\.webp$`);

/** 옛 꼴 — `<회원uuid>/<글번호>/<n>.webp` · `<n>-t.webp` */
export const 옛꼴 = new RegExp(`^${UUID}/\\d+/\\d+(-t)?\\.webp$`);

/** 사진 한 장의 큰 것·작은 것 경로. 같은 uuid 를 나눠 씁니다 */
export function 새글사진경로(uuid: string = crypto.randomUUID()) {
  const u = uuid.toLowerCase();
  if (!new RegExp(`^${UUID}$`).test(u)) throw new Error('uuid 꼴이 아닙니다');
  return { 큰것: `i/${u}.webp`, 작은것: `i/${u}-t.webp` };
}
