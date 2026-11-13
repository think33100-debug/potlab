import type { Metadata } from 'next';
import { Hit } from '@/components/hit';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import {
  RapoCommunityEmpty, RapoCommunityPost, RapoCommunityTop, RapoCommunityWrite, 어둠, 직군탭, type 직군탭값, type 커뮤니티글,
} from '@/components/rapo/rapo-community';
import { RapoGuestPreview } from '@/components/rapo/rapo-guest-preview';
import { 색인메타 } from '@/lib/seo';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { daysAgoIso } from '@/lib/time';

export const dynamic = 'force-dynamic';
/* 검색엔진에 올립니다 (2026-11-13 세중님 · lib/seo.ts 색인길) — 로봇은 비회원이라 아래 맛보기 화면만 봅니다 */
export const metadata: Metadata = {
  title: '물리치료사·작업치료사 커뮤니티 · RAPO',
  description: '물리치료사·작업치료사가 병원 분위기, 급여와 처우, 이직, 임상 고민을 나누는 커뮤니티. 병원별 자유토론과 근무 후기도 있어요.',
  robots: 색인메타, alternates: { canonical: '/community' },
};

/* 커뮤니티 — 새 디자인 「U06-01 · 커뮤니티 피드」 (2026-11-11 밤 · 대표: 피그마 우선).
   조각과 원본 위치는 components/rapo/rapo-community.tsx 머리에 있습니다.

   ── 자료 ─────────────────────────────────────────────────────────
   공개글 뷰(회원만 읽음 · 숨김·차단·방 권한은 뷰가 거름)에서 최신 20건.
   탭 「작업치료사」·「물리치료사」는 **글쓴이 가입 직군**으로 거릅니다 — 공개글.profiles.job_group
   (2026-11-11 밤 대표 「피그마 그대로 자동 표시」 · DB: RAPO노트/SQL_1113/G_커뮤니티_글쓴이직군.sql).
   인기순 = 최근 7일 안에 올라온 글 중 조회 많은 순(전 화면과 같은 기준).
   댓글 미리보기 = 그 글의 가장 이른 댓글 한 줄(공개댓글 뷰 · 숨김 걸러짐).

   ── 피그마에 없어 잠시 빠진 것 (대표: 하나씩 다시 넣을 예정) ──────────────
   주제방 17개(자유·임상·급여·처우 …)와 방별 글 수 · 인기 글 칸 · 맨 위 배너(home_blocks comm) ·
   「치료사끼리 묻고 답하는 곳」 소개 줄. 방 화면(/community/[ch])은 주소로는 그대로 열립니다.
   ── 원본에 있지만 아직 못 넣은 것 ─────────────────────────────────
   병원 찾기 단추(병원 탐색 기능 없음) · 글 사이 광고 배너(원본이 「예시」) · 학생 공간 */

type SP = { job?: string; sort?: string };

export default async function Community({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const 탭: 직군탭값 = (직군탭 as readonly string[]).includes(sp.job ?? '') ? (sp.job as 직군탭값) : '전체';
  const 정렬 = sp.sort === 'hot' ? 'hot' : 'new';
  const 주소 = (t: 직군탭값, s: 'new' | 'hot') => {
    const u = new URLSearchParams();
    if (t !== '전체') u.set('job', t);
    if (s === 'hot') u.set('sort', 'hot');
    const q = u.toString();
    return q ? `/community?${q}` : '/community';
  };

  const sb = await serverSupabase();
  /* 비회원 — 맛보기 화면 (2026-11-13 세중님). 글은 한 줄도 안 내려보냅니다(익명 글 · components/rapo/rapo-guest-preview.tsx) */
  if (await serverWho(sb) === '비회원') return <RapoGuestPreview 갈래="community" />;
  let q = sb.from('공개글').select('id,title,body,created_at,comment_count,profiles');
  if (탭 !== '전체') q = q.eq('profiles->>job_group', 탭);
  q = 정렬 === 'hot'
    ? q.gte('created_at', daysAgoIso(7)).order('view_count', { ascending: false }).order('created_at', { ascending: false })
    : q.order('created_at', { ascending: false });
  const { data, error } = await q.limit(20);

  type 줄 = { id: number; title: string | null; body: string; created_at: string; comment_count: number;
    profiles: { nickname: string; avatar: string | null; erased_at: string | null; job_group?: string | null } | null };
  const 글들 = (data ?? []) as unknown as 줄[];

  /* 댓글 미리보기 — 글마다 가장 이른 댓글 하나 (한 번에 받아 글별로 고름) */
  const 첫댓글 = new Map<number, 커뮤니티글['댓글']>();
  const 댓글있는글 = 글들.filter((g) => g.comment_count > 0).map((g) => g.id);
  if (댓글있는글.length) {
    const { data: cs } = await sb.from('공개댓글').select('post_id,body,created_at,profiles')
      .in('post_id', 댓글있는글).is('parent_id', null).order('created_at', { ascending: true }).limit(200);
    for (const c of (cs ?? []) as unknown as { post_id: number; body: string; profiles: 줄['profiles'] }[]) {
      if (!첫댓글.has(c.post_id)) 첫댓글.set(c.post_id, { 글쓴이: c.profiles, body: c.body });
    }
  }

  const 보일글: 커뮤니티글[] = 글들.map((g) => ({
    id: g.id, title: g.title, body: g.body, created_at: g.created_at, comment_count: g.comment_count,
    글쓴이: g.profiles, job_group: g.profiles?.job_group ?? null, 댓글: 첫댓글.get(g.id) ?? null,
  }));

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <Hit kind="community" />
      <RapoCommunityTop 탭={탭} 정렬={정렬} 주소={주소} />
      <main className="mt-[6px]">
        {error ? (
          <RapoCommunityEmpty>
            <p className="text-[14px]" style={{ color: 어둠.흐린글 }}>글을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
          </RapoCommunityEmpty>
        ) : 보일글.length === 0 ? (
          <RapoCommunityEmpty />
        ) : (
          보일글.map((p) => <RapoCommunityPost key={p.id} p={p} />)
        )}
      </main>
      {/* 글쓰기 단추·하단 탐색에 마지막 글이 가리지 않게 */}
      <div aria-hidden style={{ height: 'calc(72px + 68px + env(safe-area-inset-bottom))' }} />
      <RapoCommunityWrite href="/community/write" />
      <RapoBottomNav current="/community" dark />
    </div>
  );
}
