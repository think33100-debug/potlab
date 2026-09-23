'use client';

import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { channelName } from '@/lib/channels';
import { browserSupabase } from '@/lib/supabase-browser';
import type { PostRow } from '@/lib/supabase';
import { shownName } from '@/lib/who';

export function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  if (s < 604800) return Math.floor(s / 86400) + '일 전';
  return iso.slice(0, 10);
}

/* 글 한 줄. 목록 어디서나 같은 모양으로 씁니다.
   보이는 사람 정보는 닉네임과 아바타뿐입니다 */
export function PostItem({ p, showChannel = false }: { p: PostRow; showChannel?: boolean }) {
  const thumb = p.post_images?.[0]?.thumb_path;
  const thumbUrl = thumb
    ? browserSupabase().storage.from('post-images').getPublicUrl(thumb).data.publicUrl
    : null;

  return (
    <li>
      <Link
        href={`/post/${p.id}`}
        className="-mx-4 flex gap-5 rounded-sm px-4 py-6 hover:bg-gray-50 dark:hover:bg-gray-950"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {showChannel && (
              <span className="rounded-md bg-badge-blue-bg px-3 font-medium text-interaction-blue">
                {channelName(p.channel)}
              </span>
            )}
            <Avatar value={p.profiles?.avatar} size="sm" />
            <span className="truncate">{shownName(p.profiles)}</span>
            <span className="text-gray-400">{ago(p.created_at)}</span>
          </div>

          {p.title && <p className="mt-1 truncate text-body-lg font-medium">{p.title}</p>}
          <p className="mt-1 line-clamp-2 text-lg text-gray-600 dark:text-gray-400">{p.body}</p>

          <div className="mt-2 flex gap-3 text-sm text-gray-400">
            <span>조회 {p.view_count}</span>
            <span>댓글 {p.comment_count}</span>
            <span>좋아요 {p.like_count}</span>
          </div>
        </div>

        {thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
          <img src={thumbUrl} alt="" width={72} height={72}
            className="size-[72px] shrink-0 rounded-sm object-cover" />
        )}
      </Link>
    </li>
  );
}
