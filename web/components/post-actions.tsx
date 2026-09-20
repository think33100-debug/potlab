'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';

/* 글 아래 단추 줄 — 좋아요 · 공유 · 신고 · (내 글이면) 지우기 */
export function PostActions({
  id, authorId, likeCount, title,
}: {
  id: number; authorId: string; likeCount: number; title: string;
}) {
  const { session, me } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [likes, setLikes] = useState(likeCount);
  const [mineLike, setMineLike] = useState(false);
  const [busy, setBusy] = useState(false);

  /* 로그아웃 상태에서는 무조건 안 누른 것으로 봅니다.
     상태를 지우지 않고 계산합니다 — effect 안 setState 는 한 번 더 그립니다 */
  const liked = me ? mineLike : false;
  const setLiked = setMineLike;

  /* 내가 이미 눌렀는지는 로그인한 사람만 알 수 있습니다 */
  useEffect(() => {
    if (!me) return;
    let alive = true;
    browserSupabase()
      .from('post_likes').select('post_id').eq('post_id', id).eq('profile_id', me.id).maybeSingle()
      .then(({ data }) => { if (alive) setMineLike(!!data); });
    return () => { alive = false; };
  }, [id, me]);

  const needLogin = () => {
    sessionStorage.setItem('potjob.after-login', location.pathname);
    toast('로그인하면 쓸 수 있어요');
    router.push('/login');
  };

  const toggleLike = async () => {
    if (!me) return needLogin();
    setBusy(true);
    const sb = browserSupabase();

    if (liked) {
      const { error } = await sb.from('post_likes').delete()
        .eq('post_id', id).eq('profile_id', me.id);
      if (!error) { setLiked(false); setLikes((v) => Math.max(0, v - 1)); }
      else toast(`좋아요를 떼지 못했어요 — ${error.message}`, { tone: 'danger' });
    } else {
      const { error } = await sb.from('post_likes').insert({ post_id: id, profile_id: me.id });
      if (!error) { setLiked(true); setLikes((v) => v + 1); }
      else toast(`좋아요를 누르지 못했어요 — ${error.message}`, { tone: 'danger' });
    }
    setBusy(false);
  };

  /* 공유 — 휴대폰에서는 기계가 주는 공유창을 씁니다.
     거기에 카카오톡이 들어 있어서 SDK 없이도 카톡으로 보낼 수 있습니다.

     카카오 SDK 로 「카카오톡」 단추를 따로 두려면 JavaScript 키가 필요합니다
     (지금 가진 것은 로그인용 REST 키라 다릅니다).
     데스크톱에는 공유창이 없어 링크 복사로 떨어집니다. */
  const share = async () => {
    const url = `${location.origin}/post/${id}`;
    const data = { title: `${title} · POTJOB`, text: title, url };

    if (navigator.share && navigator.canShare?.(data)) {
      try { await navigator.share(data); return; }
      catch { /* 취소는 잘못이 아닙니다 */ return; }
    }
    await copyLink(url);
  };

  const copyLink = async (url = `${location.origin}/post/${id}`) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('링크를 복사했어요!');
    } catch {
      /* 안전하지 않은 연결(http)에서는 clipboard 가 막힙니다 */
      toast(`복사하지 못했어요 — 주소: ${url}`, { tone: 'danger', ms: 5000 });
    }
  };

  const report = async () => {
    if (!me) return needLogin();
    const reason = prompt('어떤 점이 문제인가요? (비방·저격·허위사실·광고 등)');
    if (!reason?.trim()) return;

    const { error } = await browserSupabase().from('reports').insert({
      target_type: 'post', target_id: id, reporter_id: me.id, reason: reason.trim(),
    });
    if (error) {
      toast(
        error.code === '23505' ? '이미 신고하신 글이에요' : `신고하지 못했어요 — ${error.message}`,
        { tone: 'danger' },
      );
      return;
    }
    toast('신고했어요. 관리자가 확인할게요');
  };

  const remove = async () => {
    if (!confirm('이 글을 지울까요? 되돌릴 수 없어요')) return;
    const { error } = await browserSupabase().from('posts').delete().eq('id', id);
    if (error) { toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    toast('글을 지웠어요');
    router.push('/community');
  };

  return (
    <div className="mt-7 flex flex-wrap items-center gap-2 border-y border-gray-100 py-5 dark:border-gray-800">
      <button
        type="button"
        onClick={toggleLike}
        disabled={busy}
        aria-pressed={liked}
        className={
          'rounded-md border px-6 py-4 text-lg font-medium transition-colors ' +
          (liked
            ? 'border-brand-red bg-brand-red-soft text-brand-red-dark'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
        }
      >
        좋아요 {likes}
      </button>

      <button
        type="button"
        onClick={share}
        className="rounded-md bg-brand-red px-6 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
      >
        공유
      </button>

      <button
        type="button"
        onClick={() => copyLink()}
        className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
      >
        링크 복사
      </button>

      <span className="flex-1" />

      {session && me?.id === authorId ? (
        <button type="button" onClick={remove}
          className="rounded-md px-4 py-4 text-sm text-gray-400 hover:text-brand-red">
          지우기
        </button>
      ) : (
        <button type="button" onClick={report}
          className="rounded-md px-4 py-4 text-sm text-gray-400 hover:text-brand-red">
          신고
        </button>
      )}
    </div>
  );
}
