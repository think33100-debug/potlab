'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { channelName } from '@/lib/channels';
import { browserSupabase } from '@/lib/supabase-browser';
import { ago } from './post-row';
import { RapoButton, RapoDivider, RapoSortTabs } from './rapo/rapo-ui';

/* 내가 쓴 글 · 댓글 — 내 정보 「내 활동」 (2026-11-13 세중님 「내가 쓴 글 댓글 창이 옛날 느낌 · 토큰이」).
   옛 색·글꼴(teal · text-lg · gray)을 RAPO 토큰으로 바꿨습니다 — 탭은 공고 목록의 정렬 탭(RapoSortTabs),
   줄은 구분선(RapoDivider) 사이의 글 줄, 빈 화면은 저장한 공고(/me/saved)와 같은 꼴.
   「찜한 공고」 탭은 뺐습니다 — 같은 목록이 「저장한 공고」(/me/saved) 화면에 새 모양으로 있습니다. */

type Tab = 'posts' | 'comments';
const 탭들 = [{ key: 'posts', label: '내 글' }, { key: 'comments', label: '내 댓글' }] as const;

type MyPost = { id: number; channel: string; title: string | null; body: string; created_at: string; comment_count: number; view_count: number };
type MyComment = { id: number; body: string; created_at: string; post_id: number; posts: { title: string | null; body: string } | null };

export function MyLists({ profileId }: { profileId: string }) {
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);

  /* 고른 칸만 한 번 받아옵니다. 이미 받은 칸은 다시 안 받습니다.
     받아오는 일과 상태에 넣는 일을 갈라둡니다 — effect 안 setState 는 한 번 더 그립니다 */
  const need = tab === 'posts' ? posts === null : comments === null;

  useEffect(() => {
    if (!need) return;
    const sb = browserSupabase();
    let alive = true;

    if (tab === 'posts') {
      sb.from('posts').select('id,channel,title,body,created_at,comment_count,view_count')
        .eq('author_id', profileId).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => { if (alive) setPosts((data ?? []) as MyPost[]); });
    } else {
      sb.from('comments').select('id,body,created_at,post_id,posts(title,body)')
        .eq('author_id', profileId).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => { if (alive) setComments((data ?? []) as unknown as MyComment[]); });
    }

    return () => { alive = false; };
  }, [tab, need, profileId]);

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x4)">
      <RapoSortTabs label="내 활동" items={탭들} value={tab} onChange={setTab} />

      {tab === 'posts' && (
        <List rows={posts} empty="아직 쓴 글이 없어요. 커뮤니티에서 첫 글을 남겨 보세요." action={<RapoButton href="/community/write" full>글 쓰러 가기</RapoButton>}>
          {posts?.map((p) => (
            <Row key={p.id} href={`/post/${p.id}`}
              위={`${channelName(p.channel)} · ${ago(p.created_at)}`}
              글={p.title || p.body.slice(0, 40)}
              아래={`조회 ${p.view_count.toLocaleString('ko-KR')} · 댓글 ${p.comment_count.toLocaleString('ko-KR')}`} />
          ))}
        </List>
      )}

      {tab === 'comments' && (
        <List rows={comments} empty="아직 단 댓글이 없어요. 동료들의 글에 한마디 남겨 보세요." action={<RapoButton href="/community" full>커뮤니티 보러 가기</RapoButton>}>
          {comments?.map((c) => (
            <Row key={c.id} href={`/post/${c.post_id}`}
              위={ago(c.created_at)}
              글={c.body}
              아래={`원글 · ${c.posts?.title || c.posts?.body.slice(0, 30) || '지워진 글'}`} />
          ))}
        </List>
      )}
    </div>
  );
}

/* 한 줄 — 작은 윗글(방·때) · 본문 한두 줄 · 작은 아랫글. 누르는 자리는 줄 전체 */
function Row({ href, 위, 글, 아래 }: { href: string; 위: string; 글: string; 아래: string }) {
  return (
    <li>
      {/* 줄 사이 구분선 — 저장한 공고와 같은 RapoDivider (첫 줄 위에는 안 그립니다) */}
      <RapoDivider className="[li:first-child>&]:hidden" />
      <Link href={href} className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1) py-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-transparent-pressed)">
        <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{위}</span>
        <span className="rapo-type-t5-bold line-clamp-2 break-keep text-(color:--rapo-color-fg-neutral) [overflow-wrap:anywhere]">{글}</span>
        <span className="rapo-type-t3-regular truncate text-(color:--rapo-color-fg-neutral-muted)">{아래}</span>
      </Link>
    </li>
  );
}

function List({ rows, empty, action, children }: { rows: unknown[] | null; empty: string; action: React.ReactNode; children: React.ReactNode }) {
  if (rows === null) return <p role="status" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-(--rapo-dimension-x4) py-(--rapo-dimension-x6)">
        <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{empty}</p>
        {action}
      </div>
    );
  }
  return <ul className="flex flex-col">{children}</ul>;
}
