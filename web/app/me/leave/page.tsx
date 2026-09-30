'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';

/* 회원 탈퇴 (2026-10-01).

   ── 왜 앱 안에 있어야 하나 ───────────────────────────────────
   애플 심사 기준 5.1.1(v) — 앱에서 계정을 만들 수 있으면 **앱 안에서**
   계정을 지울 수도 있어야 합니다 (2022-06-30 부터).
   메일로 요청받는 방식은 안 됩니다. 그래서 설정(내 정보)에서 바로 갑니다.

   ── 지우는 일은 DB 가 합니다 ─────────────────────────────────
   reset_my_account() 한 곳입니다. auth.uid() 하나만 건드리게 못 박혀 있어
   화면을 뚫어도 남의 계정은 못 지웁니다.
   관리자 화면(/admin/reset)도 **같은 함수**를 부릅니다 — 규칙이 한 벌입니다.

   ── 글과 댓글을 남기는 이유 ──────────────────────────────────
   글까지 지우면 이미 나간 공유 링크가 죽고, 그 글에 달린 남의 댓글이
   누구한테 한 말인지 알 수 없게 됩니다. 글은 남기고 글쓴이만 가립니다.

   ── 애플 로그인을 켜게 되면 ──────────────────────────────────
   애플은 탈퇴할 때 Sign in with Apple REST API 의 /auth/revoke 를 불러
   토큰을 거두라고 요구합니다. 지금은 카카오·네이버만 켜져 있어 해당 없습니다.
   켜는 날 reset_my_account() 옆에 그 호출을 붙여야 합니다. */

const SURE = '탈퇴';

export default function LeavePage() {
  const { me, session, loading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
      <p className="text-lg text-gray-500">잠시만요…</p>
    </main>;
  }
  if (!session) {
    return <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-7">
      <h1 className="text-h2 font-bold">로그인한 분만 쓸 수 있어요</h1>
      <Link href="/login"
        className="mt-6 inline-block rounded-md bg-brand-red px-7 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark">
        로그인하기
      </Link>
    </main>;
  }

  const run = async () => {
    setBusy(true);
    const sb = browserSupabase();
    const { error } = await sb.rpc('reset_my_account');

    if (error) {
      setBusy(false);
      toast(`탈퇴하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 });
      return;
    }

    /* 계정이 사라졌으니 들고 있던 토큰도 버립니다 */
    await sb.auth.signOut({ scope: 'local' });
    toast('탈퇴했어요. 그동안 고마웠습니다', { ms: 4000 });
    router.replace('/');
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h2 font-bold">회원 탈퇴</h1>
      <p className="mt-2 break-keep text-lg text-gray-500">
        탈퇴하면 되돌릴 수 없어요. 무엇이 지워지고 무엇이 남는지 먼저 봐주세요
      </p>

      <div className="mt-6 rounded-sm bg-brand-red-soft p-6">
        <p className="text-lg font-bold text-brand-red-dark">바로 지워지는 것</p>
        <ul className="mt-2 space-y-1 break-keep text-lg text-brand-red-dark">
          <li>· 로그인 수단 — 카카오 · 네이버 연결이 끊어져요</li>
          <li>· 닉네임 · 프로필 사진 · 직군 · 역할</li>
          <li>· 급여 · 스펙 · 어학 점수</li>
          <li>· 알림 설정 · 알림 받던 기기</li>
          <li>· 관심 공고 · 관심 기관</li>
          <li>· 내가 누른 좋아요 (글에 붙은 합계 숫자는 그대로예요)</li>
        </ul>
      </div>

      <div className="mt-3 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
        <p className="text-lg font-bold">남는 것</p>
        <ul className="mt-2 space-y-1 break-keep text-lg text-gray-600 dark:text-gray-400">
          <li>· 내가 쓴 글과 댓글 — 글쓴이가 「탈퇴한 회원」으로 바뀌어요</li>
          <li>· 채팅에 남긴 말 — 보낸 사람 표시가 가려지고, 쓴 지 1년이 되면 지워져요</li>
          <li>· 언제 가입해서 언제 탈퇴했는지</li>
          <li>
            · 원래 닉네임 — <span className="font-bold">30일 동안만</span> 암호로 잠가서 보관해요.
            분쟁이 생겼을 때 누구 글인지 가리기 위해서예요. 30일이 지나면 자동으로 지워져요
          </li>
        </ul>
        <p className="mt-4 break-keep text-sm text-gray-500">
          내 글에 신고가 걸려 있으면 그 신고 처리가 끝날 때까지 원래 닉네임을 더 보관해요.
          처리가 끝나면 바로 지워져요. 잠가 둔 닉네임은 관리자만 열어볼 수 있고,
          열어본 기록이 따로 남아요
        </p>
        <p className="mt-5 break-keep text-sm text-gray-500">
          글까지 지우면 남이 받아 둔 공유 링크가 죽고, 그 글에 달린 남의 댓글이
          누구한테 한 말인지 알 수 없게 돼요. 그래서 글은 남기고 이름만 가려요
        </p>
      </div>

      <p className="mt-6 text-lg text-gray-700 dark:text-gray-300">
        지금 계정: <span className="font-bold">{me?.nickname ?? '(가입 전)'}</span>
      </p>

      <label className="mt-6 block">
        <span className="text-sm font-bold text-gray-500">
          정말 탈퇴하시려면 「{SURE}」 라고 쳐주세요
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={SURE}
          aria-label="확인 글자"
          className="mt-1 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
        />
      </label>

      <button
        type="button"
        onClick={run}
        disabled={busy || typed.trim() !== SURE}
        className="mt-6 w-full rounded-md bg-brand-red px-6 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? '탈퇴하는 중…' : typed.trim() === SURE ? '탈퇴하기' : `「${SURE}」 라고 쳐주세요`}
      </button>

      <Link href="/me"
        className="mt-3 block w-full rounded-md border border-gray-200 px-6 py-5 text-center text-body-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950">
        그만두기
      </Link>

      <p className="mt-5 break-keep text-sm text-gray-400">
        탈퇴한 뒤 같은 카카오·네이버로 다시 로그인하면 <span className="font-bold">새 계정</span>으로
        가입 첫 화면부터 시작해요. 예전 글은 「탈퇴한 회원」이 쓴 글로 남습니다
      </p>
    </main>
  );
}
