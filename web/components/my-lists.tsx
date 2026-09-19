'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { channelName } from '@/lib/channels';
import { browserSupabase } from '@/lib/supabase-browser';
import { ago } from './post-row';

type Tab = 'posts' | 'comments' | 'stars';

type MyPost = { id: number; channel: string; title: string | null; body: string; created_at: string; comment_count: number; view_count: number };
type MyComment = { id: number; body: string; created_at: string; post_id: number; posts: { title: string | null; body: string } | null };
type MyStar = { job_id: string; created_at: string; job_posts: { title: string; org_name: string; apply_to: string | null } | null };

export function MyLists({ profileId }: { profileId: string }) {
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [stars, setStars] = useState<MyStar[] | null>(null);

  /* 고른 칸만 한 번 받아옵니다. 이미 받은 칸은 다시 안 받습니다.
     받아오는 일과 상태에 넣는 일을 갈라둡니다 — effect 안 setState 는 한 번 더 그립니다 */
  const need = tab === 'posts' ? posts === null
    : tab === 'comments' ? comments === null : stars === null;

  useEffect(() => {
    if (!need) return;
    const sb = browserSupabase();
    let alive = true;

    if (tab === 'posts') {
      sb.from('posts').select('id,channel,title,body,created_at,comment_count,view_count')
        .eq('author_id', profileId).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => { if (alive) setPosts((data ?? []) as MyPost[]); });
    } else if (tab === 'comments') {
      sb.from('comments').select('id,body,created_at,post_id,posts(title,body)')
        .eq('author_id', profileId).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => { if (alive) setComments((data ?? []) as unknown as MyComment[]); });
    } else {
      sb.from('job_stars').select('job_id,created_at,job_posts(title,org_name,apply_to)')
        .eq('profile_id', profileId).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => { if (alive) setStars((data ?? []) as unknown as MyStar[]); });
    }

    return () => { alive = false; };
  }, [tab, need, profileId]);

  return (
    <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
      <div className="flex gap-2">
        <T on={tab === 'posts'} go={() => setTab('posts')}>내 글</T>
        <T on={tab === 'comments'} go={() => setTab('comments')}>내 댓글</T>
        <T on={tab === 'stars'} go={() => setTab('stars')}>찜한 공고</T>
      </div>

      <div className="mt-6">
        {tab === 'posts' && (
          <List empty="아직 쓴 글이 없습니다" rows={posts}>
            {posts?.map((p) => (
              <li key={p.id} className="py-5">
                <Link href={`/post/${p.id}`} className="block hover:underline">
                  <span className="text-sm text-gray-400">{channelName(p.channel)} · {ago(p.created_at)}</span>
                  <p className="mt-1 truncate text-body-lg font-medium">{p.title || p.body.slice(0, 40)}</p>
                  <p className="mt-1 text-sm text-gray-400">조회 {p.view_count} · 댓글 {p.comment_count}</p>
                </Link>
              </li>
            ))}
          </List>
        )}

        {tab === 'comments' && (
          <List empty="아직 단 댓글이 없습니다" rows={comments}>
            {comments?.map((c) => (
              <li key={c.id} className="py-5">
                <Link href={`/post/${c.post_id}`} className="block hover:underline">
                  <p className="text-lg text-gray-700 dark:text-gray-300">{c.body}</p>
                  <p className="mt-1 truncate text-sm text-gray-400">
                    {ago(c.created_at)} · {c.posts?.title || c.posts?.body.slice(0, 30) || '지워진 글'}
                  </p>
                </Link>
              </li>
            ))}
          </List>
        )}

        {tab === 'stars' && (
          <List empty="아직 찜한 공고가 없습니다" rows={stars}>
            {stars?.map((s) => (
              <li key={s.job_id} className="py-5">
                <Link href={`/jobs/${s.job_id}`} className="block hover:underline">
                  <span className="text-sm text-gray-400">{s.job_posts?.org_name}</span>
                  <p className="mt-1 truncate text-body-lg font-medium">{s.job_posts?.title ?? '지워진 공고'}</p>
                  {s.job_posts?.apply_to && (
                    <p className="mt-1 text-sm text-gray-400">~{s.job_posts.apply_to}</p>
                  )}
                </Link>
              </li>
            ))}
          </List>
        )}
      </div>
    </section>
  );
}

function T({ on, go, children }: { on: boolean; go: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={go} aria-current={on ? 'true' : undefined}
      className={
        'rounded-md border px-6 py-4 text-lg font-medium ' +
        (on ? 'border-teal-strong bg-teal-strong text-white'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
      }>
      {children}
    </button>
  );
}

function List({ rows, empty, children }: { rows: unknown[] | null; empty: string; children: React.ReactNode }) {
  if (rows === null) return <p className="text-lg text-gray-400">불러오는 중…</p>;
  if (rows.length === 0) return <p className="py-8 text-center text-lg text-gray-500">{empty}</p>;
  return <ul className="divide-y divide-gray-100 dark:divide-gray-800">{children}</ul>;
}
