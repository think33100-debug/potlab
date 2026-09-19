/* 아바타는 두 가지뿐입니다.

     "🐣|#FDE68A"   이모지와 바탕색
     "u/<경로>"      회원이 직접 올린 사진 (avatars 저장소)

   카카오 프로필 사진은 가져오지 않습니다. 이메일도 어디에도 안 씁니다.
   로그인 수단이 알려주는 사진을 그대로 쓰면, 본인이 커뮤니티에 내놓을
   생각이 없던 얼굴이 올라갑니다. 그래서 값을 아예 안 읽습니다. */

export const AVATAR_EMOJIS = [
  '🐣', '🐨', '🦊', '🐼', '🐧', '🐙', '🌱', '🌻',
  '⭐', '🍀', '🫖', '🧃', '🎧', '📚', '🩺', '🧩',
];

export const AVATAR_COLORS = [
  '#FDE68A', '#BBF7D0', '#BFDBFE', '#FBCFE8',
  '#DDD6FE', '#FED7AA', '#C7D2FE', '#A7F3D0',
];

export type Avatar =
  | { kind: 'emoji'; emoji: string; color: string }
  | { kind: 'photo'; path: string };

export function parseAvatar(v: string | null | undefined): Avatar {
  if (v?.startsWith('u/')) return { kind: 'photo', path: v.slice(2) };
  const [emoji, color] = (v ?? '').split('|');
  return {
    kind: 'emoji',
    emoji: emoji || AVATAR_EMOJIS[0],
    color: color || AVATAR_COLORS[0],
  };
}

export const emojiAvatar = (emoji: string, color: string) => `${emoji}|${color}`;
export const photoAvatar = (path: string) => `u/${path}`;

/* 아무것도 안 고른 분께 하나 골라 줍니다. 같은 사람은 늘 같은 것이 나오게 */
export function defaultAvatar(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return emojiAvatar(
    AVATAR_EMOJIS[h % AVATAR_EMOJIS.length],
    AVATAR_COLORS[(h >>> 8) % AVATAR_COLORS.length],
  );
}
