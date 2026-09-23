import type { Metadata } from 'next';
import Link from 'next/link';
import { NothingHere } from '@/components/nothing-here';
import { Hit } from '@/components/hit';
import { PostActions } from '@/components/post-actions';
import { PostComments } from '@/components/post-comments';
import { ViewBump } from '@/components/view-bump';
import { channelName } from '@/lib/channels';
import { supabase, POST_ONE_COLS, type PostRow } from '@/lib/supabase';
import { shownName } from '@/lib/who';
import { Clip, JoinCta, Members } from '@/app/gate';

export const dynamic = 'force-dynamic';

async function getPost(id: string) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  const { data } = await supabase.from('posts').select(POST_ONE_COLS).eq('id', n).maybeSingle();
  return (data as unknown as PostRow) ?? null;
}

/* 못 읽었을 때 왜 못 읽었는지.

   RLS 가 감춘 글을 안 내려주므로 위 질의만으로는 「없는 글」과
   「지워진 글」이 똑같이 빈손으로 옵니다. 그런데 링크를 받은 분에게는
   그 둘이 전혀 다른 얘기입니다 — 하나는 주소가 틀린 것이고
   하나는 글쓴이가 지운 것입니다.

   그래서 상태 한 낱말만 물어봅니다. 본문은 한 글자도 안 나갑니다
   (DB 의 post_state 함수). */
async function stateOf(id: string): Promise<'gone' | 'hidden'> {
  const n = Number(id);
  if (!Number.isFinite(n)) return 'gone';
  const { data } = await supabase.rpc('post_state', { p_id: n });
  return data === 'hidden' ? 'hidden' : 'gone';
}

/* 두 경우의 말. 미리보기 제목과 화면이 같은 말을 쓰게 한 곳에 둡니다 */
const GONE = {
  gone: {
    title: '찾는 글이 없어요',
    body: '주소가 잘못됐거나, 처음부터 없던 글이에요.',
  },
  hidden: {
    title: '지워진 글이에요',
    body: '글쓴이가 지웠거나 관리자가 내린 글이에요. 링크를 받으셨다면 그 사이에 지워졌어요.',
  },
} as const;

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
  /* 카톡에 뜨는 제목도 갈라 적습니다 — 누르기 전에 알 수 있게 */
  if (!p) return { title: `${GONE[await stateOf(id)].title} · POTJOB` };

  const imgs = await getImages(p.id);
  const title = p.title || p.body.slice(0, 40);
  const desc = p.body.slice(0, 120).replace(/\s+/g, ' ');
  const image = imgs[0] ? publicUrl('post-images', imgs[0].path) : '/og.png';

  return {
    title: `${title} · ${channelName(p.channel)} · POTJOB`,
    description: desc,
    openGraph: {
      type: 'article',
      siteName: 'POTJOB',
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

  /* 404 를 내는 대신 화면을 보여줍니다. 받은 사람이 왜 안 보이는지는
     알게 해야 합니다 — 빈 화면은 「서비스가 고장 났다」로 읽힙니다 */
  if (!p) {
    const g = GONE[await stateOf(id)];
    return (
      <NothingHere
        title={g.title} body={g.body}
        goHref="/community" goLabel="커뮤니티 가기"
        subHref="/jobs" subLabel="채용공고 보기"
      />
    );
  }

  const imgs = await getImages(p.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="post" target={p.id} />
      <ViewBump id={p.id} />

      <Link href={`/community/${p.channel}`} className="text-lg text-interaction-blue hover:underline">
        ← {channelName(p.channel)}
      </Link>

      <article className="mt-6">
        {p.title && <h1 className="text-h2 font-bold">{p.title}</h1>}

        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {shownName(p.profiles)}
          </span>
          <span>{p.created_at.slice(0, 16).replace('T', ' ')}</span>
          <span className="text-gray-400">조회 {p.view_count}</span>
        </p>

        {/* 가입 전에는 본문을 일부만 보여줍니다 — app/gate.tsx */}
        <Clip max="22rem">
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
        </Clip>
      </article>

      <PostActions
        id={p.id}
        authorId={p.author_id}
        likeCount={p.like_count}
        title={p.title || p.body.slice(0, 40)}
      />

      <JoinCta what="이 글과 댓글" />

      {/* 댓글은 가입을 마친 분에게만 */}
      <Members>
        <PostComments postId={p.id} />
      </Members>
    </main>
  );
}
