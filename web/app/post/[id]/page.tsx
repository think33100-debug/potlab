import type { SupabaseClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NothingHere } from '@/components/nothing-here';
import { Hit } from '@/components/hit';
import { PostActions } from '@/components/post-actions';
import { PostComments } from '@/components/post-comments';
import { ViewBump } from '@/components/view-bump';
import { Avatar } from '@/components/avatar';
import { 어둠, 지난때 } from '@/components/rapo/rapo-community';
import { RapoMaskIcon } from '@/components/rapo/rapo-ui';
import { channelName } from '@/lib/channels';
import { POST_ONE_COLS, type PostRow } from '@/lib/supabase';
import { serverSupabase } from '@/lib/supabase-server';
import { siteUrl } from '@/lib/site-url';
import { shownName } from '@/lib/who';
import { Clip, JoinCta, Members } from '@/app/gate';

export const dynamic = 'force-dynamic';

/* ★ 2026-10-07 — `posts` 가 아니라 **공개글 보기**를 읽습니다 (세중님 결정 ㉯).
   글쓴이 회원번호가 화면으로 안 나갑니다. 「내 글인가」는 보기의 `내글` 칸입니다.

   그래서 **세션으로 읽어야** 합니다 — `내글` 이 `author_id = auth.uid()` 라,
   세션 없는 열쇠로 읽으면 늘 거짓이고 글쓴이에게 지우기 단추가 안 보입니다.
   미리보기(generateMetadata)는 크롤러라 세션이 없으니 공개 열쇠로 읽습니다 —
   거기서는 `내글` 을 안 씁니다. */
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
/* ★ 2026-11-11 클로즈드 베타 — 비회원에게 post_state·글사진·공개글을 닫으므로
   이 파일의 세 자리(미리보기·상태·사진 수)도 **세션으로** 읽습니다 (RAPO노트/SQL_1113).
   로봇은 middleware 가 /beta 로 보내 여기까지 안 옵니다 */
async function stateOf(id: string): Promise<'gone' | 'hidden'> {
  const n = Number(id);
  if (!Number.isFinite(n)) return 'gone';
  const sb = await serverSupabase();
  const { data } = await sb.rpc('post_state', { p_id: n });
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

/* ★ 2026-10-07 — 사진 **경로**를 화면으로 안 보냅니다 (세중님 결정 ㉯).
   저장소 경로가 `<글쓴이 회원번호>/<글번호>/0.webp` 라 회원번호가 나갑니다.
   몇 장인지만 세고, 그림은 우리 주소로 받습니다 —
   app/api/post-image/[post]/[idx]/route.ts */
async function countImages(id: number) {
  /* post_images 를 직접 안 셉니다 — 그 표의 규칙이 posts 를 보는데 비로그인은
     posts 를 못 읽어 규칙이 터집니다. DB 의 글사진() 이 감춰진 글도 걸러 줍니다 */
  const sb = await serverSupabase();
  const { data } = await sb.rpc('글사진', { p_post: id });
  return (data ?? []).length as number;
}

/* 카톡 미리보기는 절대 주소여야 합니다 */
const 사진주소 = (postId: number, i: number) => `${siteUrl()}/api/post-image/${postId}/${i}`;

/* 카톡·트위터에 뜨는 미리보기입니다.
   공유가 이 제품의 들어오는 문이라 여기가 비면 링크만 덩그러니 갑니다.
   글은 누구나 읽을 수 있으므로(RLS: not hidden) 세션 없이 서버에서 그립니다. */
export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getPost(await serverSupabase(), id);
  /* 카톡에 뜨는 제목도 갈라 적습니다 — 누르기 전에 알 수 있게 */
  if (!p) return { title: `${GONE[await stateOf(id)].title} · RAPO` };

  const 장수 = await countImages(p.id);
  const title = p.title || p.body.slice(0, 40);
  const desc = p.body.slice(0, 120).replace(/\s+/g, ' ');
  /* 사진이 없으면 커뮤니티 기본 그림 — ★ 2026-11-12 세중님: 옛 「POT LAB」 그림(/og.png)은 걷었습니다 */
  const image = 장수 > 0 ? 사진주소(p.id, 0) : '/api/og/site?k=post';

  return {
    title: `${title} · ${channelName(p.channel)} · RAPO`,
    description: desc,
    openGraph: {
      type: 'article',
      siteName: 'RAPO',
      title,
      description: desc,
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /* 쿠키에 실려 온 세션으로 읽습니다 — 그래야 「내글」 이 참이 됩니다 */
  const p = await getPost(await serverSupabase(), id);

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

  const 직군 = (p.profiles as { job_group?: string | null } | null)?.job_group ?? null;
  return (
    /* 새 디자인 「게시글 상세와 댓글」 1328:2667 (2026-11-11 밤 · 대표 「글 누르면 예전 화면」).
       어두운 판 · 앱 바(뒤로 · 게시글) · 글쓴이 직군 · 제목 26 · 글쓴이 · 본문 · 사진 · 좋아요/공유(PostActions) · 댓글(PostComments).
       좋아요·신고·지우기·댓글·답글·차단은 전 조각 그대로입니다(이 화면은 어두운 바탕 · app/surface.tsx).
       원본의 태그 · 「이 글에서 이야기하는 병원」 · 비밀 댓글은 기능이 없어 아직 */
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <Hit kind="post" target={p.id} />
      <ViewBump id={p.id} />
      <header className="sticky top-0 z-20 flex h-[56px] items-center gap-[8px] px-[8px]" style={{ background: 어둠.바탕 }}>
        <Link href="/community" aria-label="커뮤니티로" className="flex size-[44px] items-center justify-center rounded-[8px]">
          <RapoMaskIcon src="/rapo/detail/arrow-left-20.svg" w={20} h={20} className="text-[#f6f8fa]" />
        </Link>
        <h1 className="text-[18px] font-bold" style={{ color: 어둠.글 }}>게시글</h1>
      </header>

      <main className="px-[22px]">
        <article className="pt-[16px]">
          {직군 && <p className="text-[14px] font-bold leading-[20px]" style={{ color: 어둠.밑줄 }}>{직군}</p>}
          {p.title && <h2 className="mt-[8px] break-keep text-[26px] font-bold leading-[36px] [overflow-wrap:anywhere]" style={{ color: 어둠.글 }}>{p.title}</h2>}
          <div className="mt-[16px] flex items-center gap-[10px]">
            <Avatar value={p.profiles?.avatar} size="md" />
            <div>
              <p className="text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>{shownName(p.profiles)}</p>
              <p className="text-[12px] leading-[17px]" style={{ color: 어둠.흐린글 }}>{지난때(p.created_at)} · 조회 {p.view_count}</p>
            </div>
          </div>
          <div aria-hidden className="mt-[20px] h-px" style={{ background: 어둠.선 }} />
          {/* 가입 전에는 본문을 일부만 보여줍니다 — app/gate.tsx */}
          <Clip max="22rem">
            <p className="mt-[24px] whitespace-pre-wrap break-words text-[17px] leading-[30px]" style={{ color: 어둠.글 }}>{p.body}</p>
            {장수 > 0 && (
              <ul className="mt-[20px] flex flex-col gap-[12px]">
                {Array.from({ length: 장수 }, (_, i) => (
                  <li key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 바이트를 그대로 보냅니다 */}
                    <img src={`/api/post-image/${p.id}/${i}`} alt="" className="w-full rounded-[12px]" loading="lazy" />
                  </li>
                ))}
              </ul>
            )}
          </Clip>
        </article>

        <PostActions id={p.id} mine={!!p.내글} likeCount={p.like_count} title={p.title || p.body.slice(0, 40)} />

        <JoinCta what="이 글과 댓글" />

        <div aria-hidden className="-mx-[22px] mt-[24px] h-[8px]" style={{ background: '#0d1d29' }} />
        <section id="comments" className="pt-[24px]">
          <h2 className="text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>댓글 {p.comment_count}</h2>
          {/* 댓글은 가입을 마친 분에게만 */}
          <Members>
            <PostComments postId={p.id} />
          </Members>
        </section>
      </main>
    </div>
  );
}
