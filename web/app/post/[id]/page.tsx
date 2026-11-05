import type { SupabaseClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CommunityDoor } from '@/components/community-door';
import { NothingHere } from '@/components/nothing-here';
import { Hit } from '@/components/hit';
import { PostActions } from '@/components/post-actions';
import { PostComments } from '@/components/post-comments';
import { ViewBump } from '@/components/view-bump';
import { channelName } from '@/lib/channels';
import { 커뮤니티문확인 } from '@/lib/community-access';
import { supabase, POST_ONE_COLS, type PostRow } from '@/lib/supabase';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { shownName } from '@/lib/who';
import { Clip, JoinCta, Members } from '@/app/gate';

export const dynamic = 'force-dynamic';

/* ★ 2026-10-07 — `posts` 가 아니라 **공개글 보기**를 읽습니다 (세중님 결정 ㉯).
   글쓴이 회원번호가 화면으로 안 나갑니다. 「내 글인가」는 보기의 `내글` 칸입니다.

   그래서 **세션으로 읽어야** 합니다 — `내글` 이 `author_id = auth.uid()` 라,
   세션 없는 열쇠로 읽으면 늘 거짓이고 글쓴이에게 지우기 단추가 안 보입니다. */
async function getPost(sb: SupabaseClient, id: string) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  const { data } = await sb.from('공개글').select(POST_ONE_COLS).eq('id', n).maybeSingle();
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

/* 두 경우의 말 */
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

/* ★ 2026-10-07 — 사진 **경로**를 화면으로 안 보냅니다 (세중님 결정 ㉯).
   저장소 경로가 `<글쓴이 회원번호>/<글번호>/0.webp` 라 회원번호가 나갑니다.
   몇 장인지만 세고, 그림은 우리 주소로 받습니다 —
   app/api/post-image/[post]/[idx]/route.ts */
async function countImages(id: number) {
  /* post_images 를 직접 안 셉니다 — 그 표의 규칙이 posts 를 보는데 비로그인은
     posts 를 못 읽어 규칙이 터집니다. DB 의 글사진() 이 감춰진 글도 걸러 줍니다 */
  const { data } = await supabase.rpc('글사진', { p_post: id });
  return (data ?? []).length as number;
}

/* 미리보기에는 글 내용을 안 넣습니다 (2026-11-05).
   크롤러·카톡은 세션이 없어서, 여기서 읽으면 비회원에게 제목과 본문이 나갑니다 */
export const metadata: Metadata = {
  title: '커뮤니티 · POTJOB',
  robots: { index: false, follow: false },
};

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /* 쿠키에 실려 온 세션으로 읽습니다 — 그래야 「내글」 이 참이 됩니다 */
  const sb = await serverSupabase();

  /* 비회원·확인 중이면 글·상태·사진 조회를 아예 안 보냅니다 (2026-11-05) */
  const 문 = await 커뮤니티문확인(sb, await serverWho(sb));
  if (문.상태 !== '열림') return <CommunityDoor 서버={문.상태} />;

  const p = await getPost(sb, id);

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

  const 장수 = await countImages(p.id);

  return (
    <CommunityDoor 서버="열림">
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="post" target={p.id} />
      <ViewBump id={p.id} />

      <Link href={`/community/${p.channel}`} className="text-lg text-interaction-blue hover:underline">
        ← {channelName(p.channel)}
      </Link>

      <article className="mt-6">
        {p.title && <h1 className="text-h2 font-bold">{p.title}</h1>}

        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-mute">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {shownName(p.profiles)}
          </span>
          <span>{p.created_at.slice(0, 16).replace('T', ' ')}</span>
          <span className="text-mute">조회 {p.view_count}</span>
        </p>

        {/* 가입 전에는 본문을 일부만 보여줍니다 — app/gate.tsx */}
        <Clip max="22rem">
          <p className="mt-6 whitespace-pre-wrap break-words text-lg leading-relaxed text-gray-700 dark:text-gray-300">
            {p.body}
          </p>

          {장수 > 0 && (
            <ul className="mt-6 space-y-5">
              {Array.from({ length: 장수 }, (_, i) => (
                <li key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 바이트를 그대로 보냅니다 */}
                  <img src={`/api/post-image/${p.id}/${i}`} alt=""
                    className="w-full rounded-sm" loading="lazy" />
                </li>
              ))}
            </ul>
          )}
        </Clip>
      </article>

      <PostActions
        id={p.id}
        mine={!!p.내글}
        likeCount={p.like_count}
        title={p.title || p.body.slice(0, 40)}
      />

      <JoinCta what="이 글과 댓글" />

      {/* 댓글은 가입을 마친 분에게만 */}
      <Members>
        <PostComments postId={p.id} />
      </Members>
    </main>
    </CommunityDoor>
  );
}
