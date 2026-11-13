'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { RapoSheet } from '@/components/rapo/rapo-sheet';
import { setAfterLogin } from '@/lib/after-login';
import { 공유주소 } from '@/lib/site-url';
import { browserSupabase } from '@/lib/supabase-browser';

/* 글 화면의 행동 — 좋아요(본문 아래) · 메뉴(앱 바 오른쪽 「•••」) 둘로 나눕니다.
   ★ 2026-11-12 세중님 「커뮤니티 느낌이 너무 예전 버전」 — 피그마 「게시글 상세와 댓글」 1328:2667 · 「내 게시글 메뉴」 1308:9012.
     전에는 본문 아래에 좋아요 · 빨간 공유 · 링크 복사 · 차단 · 신고 단추가 한 줄로 있었습니다(옛 모양).
     원본은 본문 아래 「♡ 좋아요 N」 한 줄이고, 나머지는 앱 바의 「•••」 메뉴(아래에서 올라오는 시트)에 있습니다.
     좋아요 · 공유 · 신고 · 차단 · 지우기 동작은 전 그대로입니다. */

/* 확인 중에 누르면 **잠깐 기다립니다.** /login 으로 보내면 안 됩니다 —
   회원인데 들어오자마자 누르면 로그인 화면으로 튀깁니다 (2026-09-25) */
function useNeedLogin() {
  const toast = useToast();
  const router = useRouter();
  return useCallback(() => {
    setAfterLogin(location.pathname);
    toast('로그인하면 쓸 수 있어요');
    router.push('/login');
  }, [toast, router]);
}

/* 본문 아래 「♡ 좋아요 N」 — 원본 RAPO / heart 18 · 14 Regular #afbfca. 누른 뒤에는 하트를 산호색으로 채웁니다 */
export function PostLike({ id, likeCount }: { id: number; likeCount: number }) {
  const { loading, me } = useAuth();
  const toast = useToast();
  const needLogin = useNeedLogin();

  const [likes, setLikes] = useState(likeCount);
  const [mineLike, setMineLike] = useState(false);
  const [busy, setBusy] = useState(false);

  /* 로그아웃 상태에서는 무조건 안 누른 것으로 봅니다.
     상태를 지우지 않고 계산합니다 — effect 안 setState 는 한 번 더 그립니다 */
  const liked = me ? mineLike : false;

  /* 내가 이미 눌렀는지는 로그인한 사람만 알 수 있습니다 */
  useEffect(() => {
    if (!me) return;
    let alive = true;
    browserSupabase()
      .from('post_likes').select('post_id').eq('post_id', id).eq('profile_id', me.id).maybeSingle()
      .then(({ data }) => { if (alive) setMineLike(!!data); });
    return () => { alive = false; };
  }, [id, me]);

  const toggleLike = async () => {
    if (loading) return toast('잠시만요 — 로그인을 확인하고 있어요');
    if (!me) return needLogin();
    setBusy(true);
    const sb = browserSupabase();

    if (liked) {
      const { error } = await sb.from('post_likes').delete()
        .eq('post_id', id).eq('profile_id', me.id);
      if (!error) { setMineLike(false); setLikes((v) => Math.max(0, v - 1)); }
      else toast(`좋아요를 떼지 못했어요 — ${error.message}`, { tone: 'danger' });
    } else {
      const { error } = await sb.from('post_likes').insert({ post_id: id, profile_id: me.id });
      if (!error) { setMineLike(true); setLikes((v) => v + 1); }
      else toast(`좋아요를 누르지 못했어요 — ${error.message}`, { tone: 'danger' });
    }
    setBusy(false);
  };

  return (
    <button type="button" onClick={toggleLike} disabled={busy} aria-pressed={liked}
      className="-ml-[6px] mt-[20px] flex h-[44px] items-center gap-[7px] px-[6px] text-[14px] leading-[20px]"
      style={{ color: liked ? '#ffa691' : '#afbfca' }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path d="M9 15C9 15 1.5 10.5 1.5 6C1.5 2.25 6.75 0.75 9 5.25C11.25 0.75 16.5 2.25 16.5 6C16.5 10.5 9 15 9 15Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          fill={liked ? 'currentColor' : 'none'} />
      </svg>
      좋아요 {likes}
    </button>
  );
}

/* 앱 바 오른쪽 「•••」 — 원본 16 Bold #afbfca. 누르면 행동 메뉴 시트.
   내 글   「내 게시글」 — 공유하기 · 링크 복사 · 삭제하기(산호색)
   남의 글 「게시글」   — 공유하기 · 링크 복사 · 신고하기 · 차단하기(산호색)
   원본의 「수정하기」는 글 고치기 기능이 아직 없어 뺐습니다 */
export function PostMenu({ id, mine, title }: {
  /* ★ 2026-10-07 — 회원번호(authorId) 대신 「내 글인가」만 받습니다.
     판정은 DB 의 공개글 보기가 합니다 (세중님 결정 ㉯) */
  id: number; mine: boolean; title: string;
}) {
  const { loading, session, me, isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const needLogin = useNeedLogin();
  const [열림, set열림] = useState(false);
  const 닫기 = useCallback(() => set열림(false), []);

  /* 늘 RAPO 대표 주소로 (lib/site-url.ts 공유주소) */
  const url = () => 공유주소(`/post/${id}`);

  const copyLink = async () => {
    const u = url();
    try {
      await navigator.clipboard.writeText(u);
      toast('링크를 복사했어요!');
    } catch {
      /* 안전하지 않은 연결(http)에서는 clipboard 가 막힙니다 */
      toast(`복사하지 못했어요 — 주소: ${u}`, { tone: 'danger', ms: 5000 });
    }
  };

  /* 휴대폰은 기계의 공유창(카카오톡이 들어 있음) · 공유창이 없는 기기는 링크 복사로 떨어집니다 (components/share-buttons.tsx 와 같은 꼴) */
  const share = async () => {
    const data = { title: `${title} · RAPO`, text: title, url: url() };
    if (navigator.share && navigator.canShare?.(data)) {
      try { await navigator.share(data); } catch { /* 취소는 잘못이 아닙니다 */ }
      return;
    }
    await copyLink();
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

  /* 차단 — 그 사람 글·댓글이 안 보입니다 (2026-10-11 · 애플 심사 1.2).
     **글 번호로** 겁니다. 글쓴이 회원번호는 화면으로 안 나갑니다 —
     창구(차단하기)가 서버에서 글쓴이를 찾습니다 */
  const block = async () => {
    if (loading) return toast('잠시만요 — 로그인을 확인하고 있어요');
    if (!me) return needLogin();
    if (!confirm('이 분을 차단할까요? 이 분의 글과 댓글이 안 보이게 돼요.\n내 정보 화면에서 다시 풀 수 있어요')) return;
    const { error } = await browserSupabase().rpc('차단하기', { p_글: id });
    if (error) { toast(`차단하지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    toast('차단했어요. 이 분의 글은 이제 안 보여요');
    router.push('/community');
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

  const 내것 = !!session && mine;
  const 항목 = 내것
    ? [{ 글: '공유하기', 할일: share }, { 글: '링크 복사', 할일: copyLink }, { 글: '삭제하기', 할일: remove, 붉게: true }]
    : [{ 글: '공유하기', 할일: share }, { 글: '링크 복사', 할일: copyLink }, { 글: '신고하기', 할일: report }, { 글: '차단하기', 할일: block, 붉게: true },
       /* ★ 2026-11-13 세중님 「커뮤니티 글 지울 수 없나 마스터가」 — 관리자(마스터 계정이 「관리자」 역할일 때 포함)에게 남의 글 삭제.
          막는 자리는 DB 입니다(hide_post 가 글쓴이 또는 is_admin() 만 받음). 지운 글은 /admin/posts 에서 되살릴 수 있습니다 */
       ...(isAdmin ? [{ 글: '삭제하기 (관리자)', 할일: remove, 붉게: true }] : [])];

  return (
    <>
      <button type="button" onClick={() => set열림(true)} aria-haspopup="dialog" aria-expanded={열림} aria-label="게시글 메뉴"
        className="ml-auto flex h-[44px] min-w-[44px] items-center justify-center rounded-[8px] px-[7px] text-[16px] font-bold leading-[23px] tracking-[1px] text-[#afbfca]">
        •••
      </button>
      {열림 && <RapoSheet 제목={내것 ? '내 게시글' : '게시글'} 항목={항목} 닫기={닫기} />}
    </>
  );
}
