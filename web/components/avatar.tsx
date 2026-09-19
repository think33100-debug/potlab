'use client';

import { parseAvatar } from '@/lib/avatar';
import { browserSupabase } from '@/lib/supabase-browser';

const SIZES = { sm: 28, md: 36, lg: 72 } as const;

/* 커뮤니티에 사람이 보이는 유일한 자리입니다.
   여기서 쓰는 값은 profiles.avatar 하나뿐입니다 — 로그인 수단이 준 사진은 안 씁니다 */
export function Avatar({
  value, size = 'md', className = '',
}: {
  value: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const a = parseAvatar(value);
  const px = SIZES[size];

  if (a.kind === 'photo') {
    const url = browserSupabase().storage.from('avatars').getPublicUrl(a.path).data.publicUrl;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
      <img
        src={url}
        alt=""
        width={px}
        height={px}
        className={'shrink-0 rounded-md object-cover ' + className}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={'flex shrink-0 items-center justify-center rounded-md ' + className}
      style={{ width: px, height: px, background: a.color, fontSize: px * 0.55 }}
    >
      {a.emoji}
    </span>
  );
}
