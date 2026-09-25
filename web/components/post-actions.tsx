'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { ShareButtons } from '@/components/share-buttons';
import { browserSupabase } from '@/lib/supabase-browser';

/* 글 아래 단추 줄 — 좋아요 · 공유 · 신고 · (내 글이면) 지우기 */
export function PostActions({
  id, authorId, likeCount, title,
}: {
  id: number; authorId: string; likeCount: number; title: string;
}) {
  const { loading, session, me } = useAuth();
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

  /* 확인 중에 누르면 **잠긐 기다립니다.** /login 으로 보내면 안 됩니다 —
     회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다 (2026-09-25) */
  const needLogin = () => {
    sessionStorage.setItem('potjob.after-login', location.pathname);
    toast('로그인하면 쓸 수 있어요');
    router.push('/login');
  };

  const toggleLike = async () => {
    if (loading) return toast('잠시만요 — 로그인을 확인하고 있어요');
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

  const report = async () => {
    if (loading) return toast('잠시만요 — 로그인을 확인하고 있어요');
    if (!me) return needLogin();
    const reason = prompt('어떤 점이 문제인가요? (비방·저격·허위사실·광고 등)');
    if (!reason?.trim()) return;
    /* 같은 글은 한 번만 신고됩니다. 무르는 길이 없어서 한 번 물어봅니다 */
    if (!confirm('이 글을 신고할까요? 신고는 취소할 수 없어요')) return;

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

  /* 줄을 없애지 않고 감춥니다.

     보는 사람에게는 지운 것과 똑같습니다 — 목록에서도 상세에서도 안 보입니다.
     다만 표에는 남습니다. 분쟁이 생겼을 때 원본이 있어야 하고,
     이미 나간 공유 링크가 「지워진 글이에요」라고 말해줄 수 있어야 합니다.
     (표에서 지우면 그 링크는 「없는 글」이 되어 버립니다)

     감춘 사람·시각은 DB 함수가 박습니다. 화면이 적어 보내면 아무 이름이나
     넣을 수 있어서 hidden 칸은 권한 자체를 걷어뒀습니다. */
  const remove = async () => {
    if (!confirm('이 글을 지울까요? 되돌릴 수 없어요')) return;
    const { error } = await browserSupabase().rpc('hide_post', { p_id: id, p_hide: true });
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

      {/* 공고·병원·급여도 같은 것을 씁니다 */}
      <ShareButtons title={title} path={`/post/${id}`} />

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
