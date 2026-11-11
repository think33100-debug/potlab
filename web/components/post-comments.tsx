'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';
import type { CommentRow } from '@/lib/supabase';
import { shownName } from '@/lib/who';
import { Avatar } from './avatar';
import { setAfterLogin } from '@/lib/after-login';
import { ago } from './post-row';

/* 댓글은 2단까지입니다. 더 깊게 달려고 하면 DB 트리거가 막습니다
   (comment_depth_guard) — 화면에서도 대댓글에는 답글 단추를 안 답니다. */
export function PostComments({ postId }: { postId: number }) {
  const { loading, session, me } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  /* 받아오는 일과 상태에 넣는 일을 갈라둡니다.
     effect 안에서 바로 setState 하면 그릴 때마다 한 번 더 그립니다 */
  const fetchRows = useCallback(async () => {
    const { data } = await browserSupabase()
      /* ★ 2026-10-07 — 「공개댓글」 보기를 읽습니다 (세중님 결정 ㉯).
         회원번호가 화면으로 안 나가고, 「내 댓글인가」는 보기의 내글 칸이 답합니다.
         전에 쓰던 profiles(...) 묻어 읽기는 **회원에게도 실패**하고 있었습니다 —
         profiles 는 authenticated 에게 SELECT 권한이 아예 없습니다 */
      .from('공개댓글')
      .select('id,post_id,parent_id,내글,body,created_at,profiles')
      .eq('post_id', postId)
      .order('created_at');
    return (data ?? []) as unknown as CommentRow[];
  }, [postId]);

  useEffect(() => {
    let alive = true;
    fetchRows().then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [fetchRows]);

  const load = async () => setRows(await fetchRows());

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await browserSupabase().from('comments').insert({
      post_id: postId, parent_id: replyTo, author_id: me!.id, body: body.trim(),
    });
    setBusy(false);
    if (error) { toast(`달지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    setBody(''); setReplyTo(null);
    await load();
  };

  /* 확인 중에 누르면 잠깐 기다립니다 — /login 으로 보내면 회원이 튀깁니다
     (components/post-actions.tsx 의 needLogin 과 같은 꼴) */
  const needLogin = () => {
    setAfterLogin(location.pathname);
    toast('로그인하면 쓸 수 있어요');
    router.push('/login');
  };

  /* 댓글 신고 (2026-11-02 세중님) — **글 신고와 같은 표·같은 흐름**입니다.
     reports 표의 target_type 제약에 'comment' 가 이미 있어서 DB 는 손대지 않았습니다.
     같은 댓글을 두 번 신고하면 23505(겹침)로 막힙니다 */
  const report = async (id: number) => {
    if (loading) return toast('잠시만요 — 로그인을 확인하고 있어요');
    if (!me) return needLogin();
    const reason = prompt('어떤 점이 문제인가요? (비방·저격·허위사실·광고 등)');
    if (!reason?.trim()) return;
    if (!confirm('이 댓글을 신고할까요? 신고는 취소할 수 없어요')) return;

    const { error } = await browserSupabase().from('reports').insert({
      target_type: 'comment', target_id: id, reporter_id: me.id, reason: reason.trim(),
    });
    if (error) {
      toast(
        error.code === '23505' ? '이미 신고하신 댓글이에요' : `신고하지 못했어요 — ${error.message}`,
        { tone: 'danger' },
      );
      return;
    }
    toast('신고했어요. 관리자가 확인할게요');
  };

  const remove = async (id: number) => {
    if (!confirm('이 댓글을 지울까요?')) return;
    const { error } = await browserSupabase().from('comments').delete().eq('id', id);
    if (error) { toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    await load();
  };

  const roots = (rows ?? []).filter((c) => c.parent_id === null);
  const kids = (id: number) => (rows ?? []).filter((c) => c.parent_id === id);

  return (
    <section className="mt-7">
      <h2 className="text-h3 font-bold">댓글 {rows?.length ?? 0}</h2>

      {/* 공유로 들어온 분은 여기서 처음 가입을 만납니다.
          글은 이미 다 읽으신 뒤라 「왜 가입해야 하는지」가 분명한 자리입니다 */}
      {!loading && !session && (
        <div className="mt-5 rounded-sm border border-gray-100 p-6 text-center dark:border-gray-800">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            글은 누구나 읽을 수 있어요. 댓글은 회원만 달 수 있어요
          </p>
          <button
            type="button"
            onClick={() => {
              setAfterLogin(location.pathname);
              router.push('/login');
            }}
            className="mt-5 rounded-md bg-brand-red px-7 py-5 text-btn font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
          >
            가입하고 댓글 달기
          </button>
        </div>
      )}

      {session && !me && (
        <p className="mt-5 text-lg text-mute">
          가입을 마치면 댓글을 달 수 있어요 —{' '}
          <a href="/welcome" className="text-interaction-blue hover:underline">가입 마저 하기</a>
        </p>
      )}

      {me && (
        <div className="mt-5">
          {replyTo && (
            <p className="mb-1 flex items-center gap-3 text-sm text-mute">
              답글을 달고 있어요
              <button type="button" onClick={() => setReplyTo(null)}
                className="text-interaction-blue hover:underline">그만두기</button>
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
              placeholder={replyTo ? '답글 쓰기' : '댓글 쓰기'}
              aria-label="댓글"
              className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
            />
            <button type="button" onClick={send} disabled={busy || !body.trim()}
              className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-btn font-bold text-white hover:bg-brand-red-dark disabled:opacity-40">
              달기
            </button>
          </div>
        </div>
      )}

      {rows === null ? (
        <p className="mt-6 text-lg text-mute">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-lg text-mute">아직 댓글이 없어요</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 dark:divide-gray-800">
          {roots.map((c) => (
            <li key={c.id} className="py-5">
              <One c={c} mine={!!c.내글} onRemove={remove} onReport={report}
                onReply={me ? () => setReplyTo(c.id) : undefined} />
              {kids(c.id).length > 0 && (
                <ul className="mt-5 space-y-5 border-l border-gray-100 pl-6 dark:border-gray-800">
                  {kids(c.id).map((k) => (
                    <li key={k.id}>
                      <One c={k} mine={!!k.내글} onRemove={remove} onReport={report} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function One({
  c, mine, onRemove, onReply, onReport,
}: {
  c: CommentRow; mine: boolean;
  onRemove: (id: number) => void; onReply?: () => void;
  onReport?: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 text-sm text-mute">
        <Avatar value={c.profiles?.avatar} size="sm" />
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {shownName(c.profiles)}
        </span>
        <span className="text-mute">{ago(c.created_at)}</span>
        <span className="flex-1" />
        {onReply && (
          <button type="button" onClick={onReply} className="text-interaction-blue hover:underline">
            답글
          </button>
        )}
        {/* 내 댓글이면 지우기 · 남의 댓글이면 신고 — 글 단추 줄과 같은 가름입니다
            (components/post-actions.tsx) */}
        {mine ? (
          <button type="button" onClick={() => onRemove(c.id)} className="text-mute hover:text-brand-red">
            지우기
          </button>
        ) : onReport ? (
          <button type="button" onClick={() => onReport(c.id)} className="text-mute hover:text-brand-red">
            신고
          </button>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-lg text-gray-700 dark:text-gray-300">
        {c.body}
      </p>
    </div>
  );
}
