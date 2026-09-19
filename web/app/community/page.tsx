import Link from 'next/link';
import { PostItem } from '@/components/post-row';
import { CHANNELS, GROUPS } from '@/lib/channels';
import { supabase, POST_LIST_COLS, type PostRow } from '@/lib/supabase';
import { daysAgoIso } from '@/lib/time';

export const dynamic = 'force-dynamic';

/* 인기 글은 「최근 7일 안에 올라온 것 중 조회수 높은 순」입니다.
   기간을 안 자르면 한 번 뜬 글이 영영 맨 위에 눌러앉습니다. */
const HOT_DAYS = 7;

export default async function Community() {
  const since = daysAgoIso(HOT_DAYS);

  const [hot, fresh, counts] = await Promise.all([
    supabase.from('posts').select(POST_LIST_COLS)
      .gte('created_at', since)
      .order('view_count', { ascending: false })
      .limit(5),
    supabase.from('posts').select(POST_LIST_COLS)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('posts').select('channel'),
  ]);

  const hotRows = (hot.data ?? []) as unknown as PostRow[];
  const freshRows = (fresh.data ?? []) as unknown as PostRow[];

  const n: Record<string, number> = {};
  ((counts.data ?? []) as { channel: string }[]).forEach((r) => {
    n[r.channel] = (n[r.channel] ?? 0) + 1;
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <header className="mb-7">
        <h1 className="text-h1 font-bold">커뮤니티</h1>
        <p className="mt-1 text-lg text-gray-500">치료사끼리 묻고 답하는 곳</p>
      </header>

      {hotRows.length > 0 && (
        <section className="mb-8 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
          <h2 className="text-h3 font-bold">
            지금 많이 본 글
            <span className="ml-2 text-sm font-medium text-gray-400">최근 {HOT_DAYS}일</span>
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {hotRows.map((p) => <PostItem key={p.id} p={p} showChannel />)}
          </ul>
        </section>
      )}

      <nav className="mb-8" aria-label="방">
        {GROUPS.map((g) => (
          <section key={g.for} className="mb-6">
            <h2 className="text-sm font-bold text-gray-400">{g.title}</h2>
            <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {CHANNELS.filter((c) => c.for === g.for).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/community/${c.id}`}
                    className="block rounded-sm border border-gray-100 px-6 py-5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                  >
                    <p className="text-body-lg font-medium">
                      {c.name}
                      <span className="ml-2 text-sm font-medium text-gray-400">{n[c.id] ?? 0}</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{c.desc}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <section>
        <h2 className="text-h3 font-bold">새 글</h2>
        {freshRows.length === 0 ? (
          <p className="py-8 text-center text-lg text-gray-500">아직 글이 없어요. 첫 글을 써보세요</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {freshRows.map((p) => <PostItem key={p.id} p={p} showChannel />)}
          </ul>
        )}
      </section>
    </main>
  );
}
