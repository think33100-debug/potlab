/* 아바타는 두 가지뿐입니다.

     "🐣|#FDE68A"        이모지와 바탕색
     "u/<경로>|#FDE68A"   직접 올린 사진과 바탕색

   바탕색은 둘 다 붙습니다. 사진이 투명하거나 정사각형이 아닐 때
   빈자리를 채우고, 테두리처럼도 보입니다.

   카카오 프로필 사진은 가져오지 않습니다. 이메일도 어디에도 안 씁니다.
   로그인 수단이 주는 사진을 그대로 쓰면, 본인이 커뮤니티에 내놓을
   생각이 없던 얼굴이 올라갑니다. 그래서 값을 아예 안 읽습니다. */

/* 위 두 줄은 처음부터 있던 것입니다 — 동물·식물·소품.
   아래 두 줄은 병원과 치료 쪽입니다. 치료사가 쓰는 앱인데 고를 게
   병아리와 여우뿐이면 남의 앱처럼 보입니다.
   작업치료 쪽(소근육 활동)은 🧩 🖍️ 🧶, 물리치료 쪽은 🦴 🧘 🏃 가 맡습니다. */
export const AVATAR_EMOJIS = [
  '🐣', '🐨', '🦊', '🐼', '🐧', '🐙', '🌱', '🌻',
  '⭐', '🍀', '🫖', '🧃', '🎧', '📚', '🩺', '🧩',
  '🏥', '🚑', '💊', '💉', '🩹', '🦴', '🧠', '🫀',
  '🧑‍⚕️', '🦽', '🩼', '🤲', '🧘', '🏃', '🖍️', '🧶',
];

export const AVATAR_COLORS = [
  '#FDE68A', '#BBF7D0', '#BFDBFE', '#FBCFE8',
  '#DDD6FE', '#FED7AA', '#C7D2FE', '#A7F3D0',
];

export type Avatar =
  | { kind: 'emoji'; emoji: string; color: string }
  | { kind: 'photo'; path: string; color: string };

/* 값 하나를 쪼갭니다. 사진 경로에 | 가 들어갈 일은 없지만,
   색은 늘 맨 뒤 한 조각이라 뒤에서부터 떼어냅니다 */
function split(v: string): { head: string; color: string } {
  const at = v.lastIndexOf('|');
  if (at < 0) return { head: v, color: AVATAR_COLORS[0] };
  return { head: v.slice(0, at), color: v.slice(at + 1) || AVATAR_COLORS[0] };
}

export function parseAvatar(v: string | null | undefined): Avatar {
  const { head, color } = split(v ?? '');
  if (head.startsWith('u/')) return { kind: 'photo', path: head.slice(2), color };
  return { kind: 'emoji', emoji: head || AVATAR_EMOJIS[0], color };
}

/* 한 조각만 바꾸고 나머지는 그대로 둡니다.
   예전에는 색을 누르면 사진 경로가 통째로 이모지 자리로 밀려 들어가
   주소가 깨졌습니다 — 그래서 바꾸는 길을 셋으로 갈라 뒀어요 */
export function withColor(v: string | null | undefined, color: string) {
  const { head } = split(v ?? '');
  return `${head || AVATAR_EMOJIS[0]}|${color}`;
}

export function withEmoji(v: string | null | undefined, emoji: string) {
  const { color } = split(v ?? '');
  return `${emoji}|${color}`;
}

/* 지금 올려둔 사진이 있는지.

   이모지를 누르거나 새 사진을 올리면 이 사진이 덮입니다 — 화면에서
   되찾을 길이 없어서, 이 값이 참이면 먼저 물어봅니다
   (components/avatar-picker.tsx). 바탕색은 묻지 않습니다 —
   withColor 가 사진 경로를 그대로 두고 색만 갈아 끼웁니다. */
export function isPhoto(v: string | null | undefined): boolean {
  return parseAvatar(v).kind === 'photo';
}

export function withPhoto(v: string | null | undefined, path: string) {
  const { color } = split(v ?? '');
  return `u/${path}|${color}`;
}

/* 아무것도 안 고른 분께 하나 골라 줍니다. 같은 사람은 늘 같은 것이 나오게 */
export function defaultAvatar(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${AVATAR_EMOJIS[h % AVATAR_EMOJIS.length]}|${AVATAR_COLORS[(h >>> 8) % AVATAR_COLORS.length]}`;
}
