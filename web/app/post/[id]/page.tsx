import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostActions } from '@/components/post-actions';
import { PostComments } from '@/components/post-comments';
import { ViewBump } from '@/components/view-bump';
import { channelName } from '@/lib/channels';
import { supabase, POST_ONE_COLS, type PostRow } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getPost(id: string) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  const { data } = await supabase.from('posts').select(POST_ONE_COLS).eq('id', n).maybeSingle();
  return (data as unknown as PostRow) ?? null;
}

async function getImages(id: number) {
  const { data } = await supabase
    .from('post_images').select('path,thumb_path,sort').eq('post_id', id).order('sort');
  return (data ?? []) as { path: string; thumb_path: string; sort: number }[];
}

function publicUrl(bucket: string, path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/* 카톡·트위터에 뜨는 미리보기입니다.
   공유가 이 제품의 들어오는 문이라 여기가 비면 링크만 덩그러니 갑니다.
   글은 누구나 읽을 수 있으므로(RLS: not hidden) 세션 없이 서버에서 그립니다. */
export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getPost(id);
  if (!p) return { title: '없는 글이에요 · POT JOB' };

  const imgs = await getImages(p.id);
  const title = p.title || p.body.slice(0, 40);
  const desc = p.body.slice(0, 120).replace(/\s+/g, ' ');
  const image = imgs[0] ? publicUrl('post-images', imgs[0].path) : '/og.png';

  return {
    title: `${title} · ${channelName(p.channel)} · POT JOB`,
    description: desc,
    openGraph: {
      type: 'article',
      siteName: 'POT JOB',
      title,
      description: desc,
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPost(id);
  if (!p) notFound();

  const imgs = await getImages(p.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <ViewBump id={p.id} />

      <Link href={`/community/${p.channel}`} className="text-lg text-interaction-blue hover:underline">
        ← {channelName(p.channel)}
      </Link>

      <article className="mt-6">
        {p.title && <h1 className="text-h2 font-bold">{p.title}</h1>}

        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {p.profiles?.nickname ?? '알 수 없음'}
          </span>
          <span>{p.created_at.slice(0, 16).replace('T', ' ')}</span>
          <span className="text-gray-400">조회 {p.view_count}</span>
        </p>

        <p className="mt-6 whitespace-pre-wrap break-words text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          {p.body}
        </p>

        {imgs.length > 0 && (
          <ul className="mt-6 space-y-5">
            {imgs.map((im) => (
              <li key={im.path}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다 */}
                <img src={publicUrl('post-images', im.path)} alt=""
                  className="w-full rounded-sm" loading="lazy" />
              </li>
            ))}
          </ul>
        )}
      </article>

      <PostActions
        id={p.id}
        authorId={p.author_id}
        likeCount={p.like_count}
        title={p.title || p.body.slice(0, 40)}
      />

      <PostComments postId={p.id} />
    </main>
  );
}
