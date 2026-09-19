import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostItem } from '@/components/post-row';
import { CHANNEL_BY_ID } from '@/lib/channels';
import { supabase, POST_LIST_COLS, type PostRow } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ChannelPage({
  params, searchParams,
}: {
  params: Promise<{ ch: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { ch } = await params;
  const { sort } = await searchParams;
  const room = CHANNEL_BY_ID[ch];
  if (!room) notFound();

  const hot = sort === 'hot';
  const { data, error } = await supabase
    .from('posts')
    .select(POST_LIST_COLS)
    .eq('channel', ch)
    .order(hot ? 'view_count' : 'created_at', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as PostRow[];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
      <Link href="/community" className="text-lg text-interaction-blue hover:underline">← 방 고르기</Link>

      <header className="mt-6 mb-6">
        <h1 className="text-h1 font-bold">{room.name}</h1>
        <p className="mt-1 text-lg text-gray-500">{room.desc}</p>
      </header>

      <div className="mb-6 flex items-center justify-between gap-5">
        <div className="flex gap-2">
          <Sort href={`/community/${ch}`} on={!hot}>최신</Sort>
          <Sort href={`/community/${ch}?sort=hot`} on={hot}>많이 본</Sort>
        </div>
        <Link
          href={`/community/write?ch=${ch}`}
          className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
        >
          글쓰기
        </Link>
      </div>

      {error && (
        <p className="rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          글을 불러오지 못했어요 — {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="py-8 text-center text-lg text-gray-500">아직 글이 없어요. 첫 글을 써보세요</p>
      )}

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((p) => <PostItem key={p.id} p={p} />)}
      </ul>
    </main>
  );
}

function Sort({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'true' : undefined}
      className={
        'rounded-md border px-4 py-1 text-sm font-medium ' +
        (on ? 'border-teal-strong bg-teal-strong text-white'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
      }
    >
      {children}
    </Link>
  );
}
