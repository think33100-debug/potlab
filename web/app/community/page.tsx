import Link from 'next/link';
import { CommBanner } from '@/components/comm-banner';
import { Hit } from '@/components/hit';
import { PostItem } from '@/components/post-row';
import { Rail } from '@/components/rail';
import { CHANNELS, GROUPS } from '@/lib/channels';
import { commBanners } from '@/lib/home';
import { supabase, POST_LIST_COLS, type PostRow } from '@/lib/supabase';
import { daysAgoIso } from '@/lib/time';

export const dynamic = 'force-dynamic';

/* 커뮤니티.

   여기만 어둡습니다 — 바탕 #14181C · 카드 #1B2025 (app/surface.tsx 가
   html 에 data-surface="dark" 를 답니다). 글을 읽는 곳이라 눈이 편해야 하고,
   들어왔을 때 「다른 공간」이라는 게 바로 보여야 합니다.

   어두운 구역에서는 보조 글자를 #9BA3AB 보다 연하게 쓰지 않습니다.
   화면마다 클래스를 바꾸지 않고 globals.css 가 그 구역의 토큰 값을
   갈아 끼웁니다 — text-gray-500 이 붙은 자리가 전부 한 번에 밝아집니다.

   맨 위 배너는 홈과 같은 표(home_blocks kind='comm')에서 옵니다.
   관리자가 /admin 에서 고칩니다 — 배포가 필요 없습니다. */

/* 인기 글은 「최근 7일 안에 올라온 것 중 조회수 높은 순」입니다.
   기간을 안 자르면 한 번 뜬 글이 영영 맨 위에 눌러앉습니다. */
const HOT_DAYS = 7;

export default async function Community() {
  const since = daysAgoIso(HOT_DAYS);

  const [hot, fresh, counts, banner] = await Promise.all([
    supabase.from('posts').select(POST_LIST_COLS)
      .gte('created_at', since)
      .order('view_count', { ascending: false })
      .limit(5),
    supabase.from('posts').select(POST_LIST_COLS)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('posts').select('channel'),
    commBanners(),
  ]);

  const hotRows = (hot.data ?? []) as unknown as PostRow[];
  const freshRows = (fresh.data ?? []) as unknown as PostRow[];

  const n: Record<string, number> = {};
  ((counts.data ?? []) as { channel: string }[]).forEach((r) => {
    n[r.channel] = (n[r.channel] ?? 0) + 1;
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="community" />

      {/* ① 배너 — DB. 제목이 비어 있는 자리는 안 나옵니다 */}
      <CommBanner items={banner.items} seconds={banner.seconds} />

      <header className={banner.items.length > 0 ? 'mb-7 mt-8' : 'mb-7'}>
        <h1 className="break-keep text-h1 font-bold">커뮤니티</h1>
        <p className="mt-1 break-keep text-lg text-gray-500">치료사끼리 묻고 답하는 곳</p>
      </header>

      {/* ② 주제 — 옆으로 밉니다. 묶음(둘 다 · 치료사 · 학생)마다 한 줄 */}
      <nav className="mb-8" aria-label="방">
        {GROUPS.map((g) => (
          <section key={g.for} className="mb-7">
            <h2 className="mb-3 text-sm font-bold text-gray-400">{g.title}</h2>
            <Rail label={`${g.title} 주제`} dark>
              {CHANNELS.filter((c) => c.for === g.for).map((c) => (
                <Link
                  key={c.id}
                  href={`/community/${c.id}`}
                  className="flex min-h-[116px] w-full flex-col justify-between rounded-sm
                             bg-gray-950 p-6 transition-transform duration-[120ms]
                             active:scale-[0.99] motion-reduce:transition-none"
                >
                  <p className="break-keep text-h3 font-bold">
                    {c.name}
                    <span className="ml-2 text-sm font-medium text-gray-400">{n[c.id] ?? 0}</span>
                  </p>
                  <p className="mt-3 break-keep text-lg text-gray-500">{c.desc}</p>
                </Link>
              ))}
            </Rail>
          </section>
        ))}
      </nav>

      {hotRows.length > 0 && (
        <section className="mb-8 rounded-sm bg-gray-950 p-6">
          <h2 className="break-keep text-h3 font-bold">
            지금 많이 본 글
            <span className="ml-2 text-sm font-medium text-gray-400">최근 {HOT_DAYS}일</span>
          </h2>
          <ul className="mt-2 divide-y divide-white/10">
            {hotRows.map((p) => <PostItem key={p.id} p={p} showChannel />)}
          </ul>
        </section>
      )}

      <section>
        <h2 className="break-keep text-h3 font-bold">새 글</h2>
        {freshRows.length === 0 ? (
          <p className="break-keep py-8 text-center text-lg text-gray-500">
            아직 글이 없어요. 첫 글을 써보세요
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-white/10">
            {freshRows.map((p) => <PostItem key={p.id} p={p} showChannel />)}
          </ul>
        )}
      </section>
    </main>
  );
}
