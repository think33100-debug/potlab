import Link from 'next/link';
import { Hit } from '@/components/hit';
import { notFound } from 'next/navigation';
import { PostItem } from '@/components/post-row';
import { CHANNEL_BY_ID } from '@/lib/channels';
import { POST_LIST_COLS, type PostRow } from '@/lib/supabase';
/* ★ 2026-10-09 — 세션 없는 열쇠꾸러미로 읽으면 **학생이 학생 방을 못 봅니다.**
   공개글 보기가 방볼수있나() 로 가리는데, 그 함수가 auth.uid() 를 봅니다.
   쿠키를 읽는 꾸러미로 바꿉니다 (lib/supabase-server.ts) */
import { serverSupabase } from '@/lib/supabase-server';

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
  const sb = await serverSupabase();

  /* 이 방에 글을 쓸 수 있나 (2026-10-09). 막는 자리는 표의 정책이고,
     여기서는 못 쓸 단추를 안 보일 뿐입니다 —
     학생에게 치료사 방은 보이되 글쓰기가 없습니다 */
  const { data: 쓸수있나 } = await sb.rpc('방에쓸수있나', { p_방: ch });
  const { data, error } = await sb
    .from('공개글')
    .select(POST_LIST_COLS)
    .eq('channel', ch)
    .order(hot ? 'view_count' : 'created_at', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as PostRow[];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="community" />
      <Link href="/community" className="text-lg text-interaction-blue hover:underline">← 방 고르기</Link>

      <header className="mt-6 mb-6">
        <h1 className="text-h1 font-bold">{room.name}</h1>
        <p className="mt-1 text-lg text-mute">{room.desc}</p>
      </header>

      {/* 중고거래는 돈이 오가는 자리라 책임을 먼저 적습니다 (2026-10-09).
          POTJOB 은 가운데 서지 않습니다 — 서면 책임도 우리에게 옵니다 */}
      {ch === 'used' && (
        <section className="mb-7 rounded-sm border border-warning p-5">
          <p className="break-keep text-lg font-bold">거래는 두 분 사이의 일이에요</p>
          <p className="mt-2 break-keep text-lg text-mute">
            POTJOB 은 돈이나 물건을 맡아 두지 않고, 거래에 끼지 않아요.
            먼저 보내 달라고 하거나 이상하면 <b>글 아래 신고</b>를 눌러 주세요.
          </p>
        </section>
      )}

      <div className="mb-6 flex items-center justify-between gap-5">
        <div className="flex gap-2">
          <Sort href={`/community/${ch}`} on={!hot}>최신</Sort>
          <Sort href={`/community/${ch}?sort=hot`} on={hot}>많이 본</Sort>
        </div>
        {쓸수있나 === true && (
          <Link
            href={`/community/write?ch=${ch}`}
            className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-btn font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
          >
            글쓰기
          </Link>
        )}
      </div>

      {error && (
        <p className="rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          글을 불러오지 못했어요 — {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="py-8 text-center text-lg text-mute">아직 글이 없어요. 첫 글을 써보세요</p>
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
