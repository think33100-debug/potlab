import Link from 'next/link';
import { Hit } from '@/components/hit';
import { notFound } from 'next/navigation';
import { PostItem } from '@/components/post-row';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoCommunityEmpty, 어둠 } from '@/components/rapo/rapo-community';
import { RapoShell } from '@/components/rapo/rapo-shell';
import { RapoStudentCommunityNotice } from '@/components/rapo/rapo-student-community';
import { CHANNEL_BY_ID } from '@/lib/channels';
import { POST_LIST_COLS, type PostRow } from '@/lib/supabase';
/* ★ 2026-10-09 — 세션 없는 열쇠꾸러미로 읽으면 **학생이 학생 방을 못 봅니다.**
   공개글 보기가 방볼수있나() 로 가리는데, 그 함수가 auth.uid() 를 봅니다.
   쿠키를 읽는 꾸러미로 바꿉니다 (lib/supabase-server.ts) */
import { serverSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 탭 제목 — 방 이름 (2026-11-16 · 기본값 「RAPO · 채용공고」가 보였습니다) */
export async function generateMetadata({ params }: { params: Promise<{ ch: string }> }) {
  const { ch } = await params;
  const room = CHANNEL_BY_ID[ch];
  return { title: (room ? room.name + ' · 커뮤니티' : '커뮤니티') + ' · RAPO' };
}

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
  /* 학생·취준생은 커뮤니티 대신 「학생인증을 준비하고 있어요」 안내와 알림 신청 (2026-11-17 세중님 · components/rapo/rapo-student-community.tsx).
     막는 자리는 DB 입니다(방볼수있나 — 금고 SQL_1113/ZZB). 여기는 빈 화면 대신 까닭을 보여 줍니다 */
  const { data: 볼수 } = await sb.rpc('방볼수있나', { p_방: ch });
  if (볼수 === false) return <RapoShell who="회원" current="/community"><RapoStudentCommunityNotice /></RapoShell>;

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

  /* 2026-11-16 — 새 커뮤니티 피드는 방을 나누지 않아 여기로 오는 길은 없지만, 주소로 열려서 옛 위쪽 줄(POTJOB 로고) 대신
     커뮤니티 피드와 같은 어두운 판(색은 components/rapo/rapo-community.tsx 「어둠」)으로 옮겼습니다.
     읽는 길(방에쓸수있나 · 공개글)과 정렬 주소는 그대로입니다 */
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <Hit kind="community" />
      <header className="sticky top-0 z-20 flex h-[56px] items-center gap-(--rapo-dimension-x1) px-(--rapo-dimension-x2)" style={{ background: 어둠.아래탐색 }}>
        <Link href="/community" aria-label="커뮤니티로"
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/orgs/back-20.svg" alt="" width={20} height={20} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold leading-[26px]" style={{ color: 어둠.글 }}>{room.name}</h1>
      </header>

      <main className="pb-(--rapo-dimension-x8)">
        <p className="px-[22px] pt-(--rapo-dimension-x4) text-[15px] leading-[23px]" style={{ color: 어둠.흐린글 }}>{room.desc}</p>

        {/* 중고거래는 돈이 오가는 자리라 책임을 먼저 적습니다 (2026-10-09).
            RAPO 는 가운데 서지 않습니다 — 서면 책임도 우리에게 옵니다 */}
        {ch === 'used' && (
          <section className="mx-[22px] mt-(--rapo-dimension-x4) flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) p-(--rapo-dimension-x4)" style={{ background: 어둠.면 }}>
            <p className="break-keep text-[15px] font-bold leading-[22px]" style={{ color: 어둠.글 }}>거래는 두 분 사이의 일이에요</p>
            <p className="break-keep text-[14px] leading-[22px]" style={{ color: 어둠.흐린글 }}>
              RAPO 는 돈이나 물건을 맡아 두지 않고, 거래에 끼지 않아요.
              먼저 보내 달라고 하거나 이상하면 <b>글 아래 신고</b>를 눌러 주세요.
            </p>
          </section>
        )}

        <div className="flex items-center justify-between gap-(--rapo-dimension-x4) px-[22px] pt-(--rapo-dimension-x4)">
          <div className="flex gap-(--rapo-dimension-x2)">
            <Sort href={`/community/${ch}`} on={!hot}>최신</Sort>
            <Sort href={`/community/${ch}?sort=hot`} on={hot}>많이 본</Sort>
          </div>
          {쓸수있나 === true && (
            <Link
              href={`/community/write?ch=${ch}`}
              className="flex h-[44px] shrink-0 items-center gap-[7px] rounded-[22px] pl-[12px] pr-[16px] text-[14px] font-bold leading-[20px]"
              style={{ background: 어둠.쓰기, color: 어둠.글 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src="/rapo/community/pen-17.svg" alt="" width={17} height={17} />
              글쓰기
            </Link>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-[22px] mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) p-(--rapo-dimension-x4) text-[14px] leading-[22px]" style={{ background: 어둠.면, color: 어둠.밑줄 }}>
            글을 불러오지 못했어요 — {error.message}
          </p>
        )}

        {!error && rows.length === 0 && <RapoCommunityEmpty />}

        <ul className="mt-(--rapo-dimension-x2)">
          {rows.map((p) => <PostItem key={p.id} p={p} />)}
        </ul>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/community" dark />
    </div>
  );
}

function Sort({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'true' : undefined}
      className="flex h-(--rapo-touch-min) items-center whitespace-nowrap border-b-2 px-(--rapo-dimension-x1) text-[15px] font-bold leading-[22px]"
      style={on ? { color: 어둠.글, borderColor: 어둠.밑줄 } : { color: 어둠.흐린글, borderColor: 'transparent' }}
    >
      {children}
    </Link>
  );
}
