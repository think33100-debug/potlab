import type { Metadata } from 'next';
import { 직군탭, type 직군탭값, type 커뮤니티글 } from '@/components/rapo/rapo-community';
import { StudentSpaceView } from '@/components/rapo/rapo-student-space';
import { RapoGuestPreview } from '@/components/rapo/rapo-guest-preview';
import { CHANNELS } from '@/lib/channels';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { daysAgoIso } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '학생·취준생 공간 · RAPO', robots: { index: false } };

/* 학생·취준생 공간 — 피그마 「08 · C」 U07-ST 학생·취준생 게시판 1649:5467 (2026-11-15 세중님 「피그마댓글 대로」).
   「학생·취준생 공간을 임상가 피드와 분리하고, 게시글을 작업치료사·물리치료사 탭으로 나눠 볼 수 있게」.

   글 = 학생 방(lib/channels.ts 의 for:'stu' — 국가고시·실습·학점·첫직장·학교생활·진로고민)에 올라온 글.
   보는 사람 = 학생 회원. 막는 자리는 DB 입니다(방볼수있나 · 학생 방은 학생만) — 이 화면은 안내만.
   탭은 피드와 같게 글쓴이 가입 직군으로 거릅니다.
   ★ 원본의 글 사이 「전자책 광고」는 실제 상품이 없어 넣지 않았습니다 — 상품이 생기면 광고배너 자리로 붙입니다. */

const 학생방 = CHANNELS.filter((c) => c.for === 'stu').map((c) => c.id);

type SP = { job?: string; sort?: string };

export default async function StudentSpace({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const 탭: 직군탭값 = (직군탭 as readonly string[]).includes(sp.job ?? '') ? (sp.job as 직군탭값) : '전체';
  const 정렬 = sp.sort === 'hot' ? 'hot' : 'new';
  const 주소 = (t: 직군탭값, s: 'new' | 'hot') => {
    const u = new URLSearchParams();
    if (t !== '전체') u.set('job', t);
    if (s === 'hot') u.set('sort', 'hot');
    const q = u.toString();
    return q ? `/community/student?${q}` : '/community/student';
  };

  const sb = await serverSupabase();
  if (await serverWho(sb) === '비회원') return <RapoGuestPreview 갈래="community" />;
  const { data: 나 } = await sb.rpc('내프로필');
  const 학생 = ((나 ?? []) as { role?: string | null }[])[0]?.role === '학생';

  type 줄 = { id: number; title: string | null; body: string; created_at: string; comment_count: number; channel: string;
    profiles: { nickname: string; avatar: string | null; erased_at: string | null; job_group?: string | null } | null };
  let 글들: 줄[] = [];
  let 탈 = false;
  if (학생) {
    let q = sb.from('공개글').select('id,title,body,created_at,comment_count,channel,profiles').in('channel', 학생방);
    if (탭 !== '전체') q = q.eq('profiles->>job_group', 탭);
    q = 정렬 === 'hot'
      ? q.gte('created_at', daysAgoIso(7)).order('view_count', { ascending: false }).order('created_at', { ascending: false })
      : q.order('created_at', { ascending: false });
    const { data, error } = await q.limit(20);
    글들 = (data ?? []) as unknown as 줄[];
    탈 = !!error;
  }

  const 첫댓글 = new Map<number, 커뮤니티글['댓글']>();
  const 댓글있는글 = 글들.filter((g) => g.comment_count > 0).map((g) => g.id);
  if (댓글있는글.length) {
    const { data: cs } = await sb.from('공개댓글').select('post_id,body,created_at,profiles')
      .in('post_id', 댓글있는글).is('parent_id', null).order('created_at', { ascending: true }).limit(200);
    for (const c of (cs ?? []) as unknown as { post_id: number; body: string | null; profiles: 줄['profiles'] }[]) {
      if (!첫댓글.has(c.post_id)) 첫댓글.set(c.post_id, { 글쓴이: c.profiles, body: c.body ?? '비밀 댓글입니다.' });
    }
  }
  const 방이름 = Object.fromEntries(CHANNELS.map((c) => [c.id, c.name]));
  const 보일글: 커뮤니티글[] = 글들.map((g) => ({
    id: g.id, title: g.title, body: g.body, created_at: g.created_at, comment_count: g.comment_count,
    글쓴이: g.profiles, job_group: 방이름[g.channel] ?? g.profiles?.job_group ?? null, 댓글: 첫댓글.get(g.id) ?? null,
  }));

  return <StudentSpaceView 탭={탭} 정렬={정렬} 주소={주소} 학생={학생} 탈={탈} 보일글={보일글} />;
}

