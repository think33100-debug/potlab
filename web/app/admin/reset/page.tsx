'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { 관 } from '@/components/rapo/rapo-admin-ui';

/* 내 계정의 개인정보를 지웁니다.

   왜 필요한가 — 가입 화면(①약관 ②닉네임 ③직군·역할 ④사진)은 한 번 가입하면
   다시 못 봅니다. 고칠 때마다 확인하려면 계정을 비우고 다시 밟아야 합니다.

   글과 댓글은 남깁니다 (2026-09-23 에 바꿨습니다).
   전에는 auth.users 한 줄을 지우면 profiles → posts · comments 로 연쇄가
   내려가 글이 통째로 사라졌습니다. 그러면 이미 나간 공유 링크가 죽고,
   남의 대화에 구멍이 납니다 — 댓글이 누구 글에 달렸는지 못 알아봅니다.
   글은 남기고 글쓴이만 「알 수 없음」으로 바꿉니다.

   지우는 일은 DB 의 reset_my_account() 가 합니다. auth.uid() 하나만 건드리게
   못 박혀 있어서 남의 계정은 못 지웁니다 — 화면을 뚫어도 마찬가지입니다.

   원래 누구였는지는 erased_accounts 표에 남습니다. 관리자만 읽습니다 —
   나중에 분쟁이 생기면 누구 글인지 가려야 합니다.

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
    toast('개인정보를 지웠어요. 글은 「알 수 없음」으로 남아요', { ms: 4000 });
    router.replace('/login');
  };

  /* 2026-11-19 — 새 관리자 디자인(흰 카드 · coral 경고 띠 · 단추)으로 다시 입혔습니다 */
  return (
    <div className="max-w-[720px]">
      <RapoAdminHeader title="내 계정 초기화" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        가입 화면을 다시 보려고 쓰는 자리입니다. 지금 로그인한 계정의 개인정보를 지웁니다
      </p>

      <div className="rounded-[12px] border border-[#ffd4cf] bg-[#fff5f3] p-[20px] md:p-[24px]">
        <p className="text-[16px] font-bold text-[#b42a21]">지워지는 것 — 되돌릴 수 없어요</p>
        <ul className="mt-[8px] space-y-[4px] text-[14px] text-[#b42a21]">
          <li>· 로그인 수단 (카카오 · 네이버 연결)</li>
          <li>· 닉네임 · 프로필 사진</li>
          <li>· 급여 · 스펙</li>
          <li>· 알림 설정 · 푸시 기기</li>
        </ul>
      </div>

      <div className={관.card + ' mt-[12px]'}>
        <p className={관.h3}>남는 것</p>
        <ul className={관.muted + ' mt-[8px] space-y-[4px] break-keep'}>
          <li>· 내가 쓴 글과 댓글 — 글쓴이만 「알 수 없음」이 돼요</li>
          <li>· 원래 누구였는지 (관리자만 볼 수 있어요)</li>
        </ul>
        <p className={관.sub + ' mt-[16px] break-keep'}>
          글까지 지우면 남이 받아 둔 공유 링크가 죽고, 그 글에 달린 남의 댓글이
          누구한테 한 말인지 알 수 없게 됩니다. 그래서 글은 남깁니다
        </p>
      </div>

      <p className={관.body + ' mt-[24px]'}>
        지금 계정: <span className="font-bold">{me?.nickname ?? '(가입 전)'}</span>
        <span className={관.sub + ' ml-[8px]'}>{session?.user.id.slice(0, 8)}…</span>
      </p>

      <label className="mt-[16px] block">
        <span className={관.fieldLabel}>
          맞으면 「{SURE}」 라고 쳐주세요
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={SURE}
          aria-label="확인 글자"
          className={관.input}
        />
      </label>

      <button
        type="button"
        onClick={run}
        disabled={busy || typed.trim() !== SURE}
        className="mt-[16px] inline-flex h-[48px] w-full items-center justify-center rounded-[8px] bg-[#b42a21] px-[18px] text-[16px] font-bold text-white hover:bg-[#9a231b] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? '지우는 중…' : typed.trim() === SURE ? '내 개인정보 지우기' : `「${SURE}」 라고 쳐주세요`}
      </button>

      <p className={관.sub + ' mt-[16px]'}>
        지운 뒤 같은 수단(카카오·네이버)으로 다시 로그인하면 새 계정으로 가입 ①번부터 시작해요.
        올렸던 프로필 사진 파일은 저장소에 남습니다 — tools/clean_orphan_files.js 로 치웁니다
      </p>
    </div>
  );
}
