'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';

/* 내 계정을 통째로 지웁니다.

   왜 필요한가 — 가입 화면(①약관 ②닉네임 ③직군·역할 ④사진)은 한 번 가입하면
   다시 못 봅니다. 고칠 때마다 확인하려면 계정을 비우고 다시 밟아야 합니다.

   지우는 일은 DB 의 reset_my_account() 가 합니다. auth.uid() 하나만 지우게
   못 박혀 있어서 남의 계정은 못 지웁니다 — 화면을 뚫어도 마찬가지입니다.

   저장소 사진은 안 따라 지워집니다 (SQL 로 못 지웁니다).
   tools/clean_orphan_files.js 로 따로 치웁니다. */

const SURE = '초기화';

export default function ResetMe() {
  const { me, session } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const sb = browserSupabase();
    const { error } = await sb.rpc('reset_my_account');

    if (error) {
      setBusy(false);
      toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 });
      return;
    }

    /* 계정이 사라졌으니 들고 있던 토큰도 버립니다 */
    await sb.auth.signOut({ scope: 'local' });
    toast('계정을 지웠어요. 다시 로그인하면 가입 화면부터 시작해요', { ms: 4000 });
    router.replace('/login');
  };

  return (
    <div>
      <h2 className="text-h3 font-bold">내 계정 초기화</h2>
      <p className="mt-2 text-lg text-gray-500">
        가입 화면을 다시 보려고 쓰는 자리입니다. 지금 로그인한 계정을 통째로 지웁니다
      </p>

      <div className="mt-6 rounded-sm bg-brand-red-soft p-6">
        <p className="text-lg font-bold text-brand-red-dark">되돌릴 수 없어요</p>
        <ul className="mt-2 space-y-1 text-lg text-brand-red-dark">
          <li>· 계정 · 프로필 · 닉네임</li>
          <li>· 내가 쓴 글과 댓글</li>
          <li>· 좋아요 · 찜한 공고 · 알림 설정</li>
          <li>· 관리자 자격</li>
        </ul>
        <p className="mt-5 text-sm text-brand-red-dark">
          공고 628건과 홈 배너 설정은 그대로 둡니다. 회원 것만 지웁니다
        </p>
      </div>

      <p className="mt-6 text-lg text-gray-700 dark:text-gray-300">
        지금 계정: <span className="font-bold">{me?.nickname ?? '(가입 전)'}</span>
        <span className="ml-2 text-sm text-gray-400">{session?.user.id.slice(0, 8)}…</span>
      </p>

      <label className="mt-6 block">
        <span className="text-sm font-bold text-gray-500">
          맞으면 「{SURE}」 라고 쳐주세요
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
        {busy ? '지우는 중…' : typed.trim() === SURE ? '내 계정 지우기' : `「${SURE}」 라고 쳐주세요`}
      </button>

      <p className="mt-5 text-sm text-gray-400">
        지운 뒤 같은 수단(카카오·네이버)으로 다시 로그인하면 가입 ①번부터 시작해요.
        올렸던 프로필 사진 파일은 저장소에 남습니다 — tools/clean_orphan_files.js 로 치웁니다
      </p>
    </div>
  );
}
