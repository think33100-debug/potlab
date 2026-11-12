'use client';

import { useState } from 'react';
import { clearAfterLogin, peekAfterLogin } from '@/lib/after-login';
import { browserSupabase } from '@/lib/supabase-browser';

/* 아이디로 로그인 — 로그인 화면 Apple 단추 아래 작은 글씨 (2026-11-12 세중님 「애플 아래에 아이디로 로그인을 작게」).

   ── 누가 쓰나 ────────────────────────────────────────────────
   **운영진이 만들어 준 계정만** 들어옵니다 (점검용 시험 계정 등). 여기서 가입은 안 됩니다 —
   이메일 가입은 DB 훅(hook_block_email_signup)이 막고, 계정은 Supabase 대시보드에서만 만듭니다.
   카카오·네이버·Apple 로 가입한 회원은 비밀번호가 없어 이 길로 못 들어옵니다.

   ── 아이디 ───────────────────────────────────────────────────
   Supabase 는 이메일로 로그인합니다. 「@」 없이 적으면 뒤에 아래 도메인을 붙입니다 —
   대시보드에서 `아이디@rapojob.co.kr` 로 만들면 화면에서는 아이디만 적으면 됩니다.
   (받는 메일함이 없어도 됩니다 — 만들 때 「Auto Confirm User」를 켭니다)

   피그마 원본에 없는 칸입니다. 평소에는 글씨 한 줄만 보이고, 눌러야 칸이 펴집니다. */

export const 아이디도메인 = 'rapojob.co.kr';

export function 아이디를메일로(아이디: string): string {
  const s = 아이디.trim();
  return s.includes('@') ? s : `${s}@${아이디도메인}`;
}

const 칸꼴 = 'rapo-type-t4-regular h-(--rapo-dimension-x12) w-full rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-layer-default) '
  + 'px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) placeholder:text-(color:--rapo-color-fg-neutral-muted)';

export function LoginWithId() {
  const [열림, set열림] = useState(false);
  const [아이디, set아이디] = useState('');
  const [비번, set비번] = useState('');
  const [busy, setBusy] = useState(false);
  const [까닭, set까닭] = useState<string | null>(null);

  if (!열림) {
    return (
      <button type="button" onClick={() => set열림(true)}
        className="rapo-type-t3-regular mx-auto w-fit underline underline-offset-2 opacity-70">
        아이디로 로그인
      </button>
    );
  }

  const 로그인 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !아이디.trim() || !비번) return;
    setBusy(true);
    set까닭(null);
    const { error } = await browserSupabase().auth.signInWithPassword({ email: 아이디를메일로(아이디), password: 비번 });
    if (error) {
      setBusy(false);
      /* 틀린 아이디·비밀번호는 Supabase 가 한 말로 줍니다(어느 쪽이 틀렸는지 안 알림) — 우리말로만 바꿉니다 */
      set까닭(/invalid login credentials/i.test(error.message) ? '아이디나 비밀번호가 맞지 않아요' : `로그인하지 못했어요 — ${error.message}`);
      return;
    }
    /* 서버가 새 쿠키로 다시 그리게 통째로 옮깁니다. 가입을 안 마친 계정은 문지기(middleware)가 /welcome 으로 보냅니다 */
    const 갈곳 = peekAfterLogin() ?? '/';
    clearAfterLogin();
    location.assign(갈곳);
  };

  return (
    <form onSubmit={로그인} className="flex flex-col gap-(--rapo-dimension-x2)">
      <label className="sr-only" htmlFor="login-id">아이디</label>
      <input id="login-id" value={아이디} onChange={(e) => set아이디(e.target.value)} placeholder="아이디"
        autoComplete="username" autoCapitalize="none" spellCheck={false} className={칸꼴} />
      <label className="sr-only" htmlFor="login-pw">비밀번호</label>
      <input id="login-pw" type="password" value={비번} onChange={(e) => set비번(e.target.value)} placeholder="비밀번호"
        autoComplete="current-password" className={칸꼴} />
      {까닭 && <p role="alert" className="rapo-type-t3-regular">{까닭}</p>}
      <button type="submit" disabled={busy || !아이디.trim() || !비번}
        className="rapo-type-t4-bold flex h-(--rapo-dimension-x12) w-full items-center justify-center rounded-(--rapo-radius-r2)
                   border border-(--rapo-color-palette-static-white-alpha-500) disabled:opacity-50">
        {busy ? '로그인하는 중…' : '아이디로 로그인'}
      </button>
    </form>
  );
}
