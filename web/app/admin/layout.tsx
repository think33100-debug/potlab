'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { RouteHealth } from '@/components/route-health';
import { browserSupabase } from '@/lib/supabase-browser';
import { AdminRoleGate } from '@/components/admin-role-gate';
import { RapoAdminShell } from '@/components/rapo/rapo-admin';
import { MfaBanner, MfaCodeForm, useAdminMfa } from '@/components/admin-mfa-gate';

/* 관리자 화면의 껍데기입니다.

   여기서 막는 것은 「보이지 않게」 하는 것뿐입니다.
   진짜로 막는 자리는 DB 입니다 — home_blocks·site_settings 의 쓰기 규칙이
   is_admin() 이고, 출처 칸은 권한 자체가 없습니다.
   브라우저에서 isAdmin 을 true 로 바꿔도 서버가 안 해줍니다. */

/* 메뉴는 새 디자인 틀(components/rapo/rapo-admin.tsx)로 옮겼습니다 (2026-11-12).
   원본 일곱 + 「그 밖의 도구」. 전에 이 자리에 있던 메뉴 목록과 같은 화면을 모두 잇습니다 */

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { loading, session, isAdmin } = useAuth();

  /* ★ 2026-10-05 — 거절하기 **전에 한 번 더** 물어봅니다.
     is_admin() 은 비로그인도 부를 수 있고 그때 **거짓**을 돌려줍니다.
     로그인 토큰이 잠깐 끊긴 사이에 그 판정이 돌면, 관리자인데도
     「관리자가 아니에요」가 뜹니다 (2026-10-05 에 실제로 겪었고
     새로고침 한 번으로 돌아왔습니다).
     그래서 토큰을 새로 받아 다시 묻고, 그래도 아니면 그때 거절합니다. */
  const [다시물음, set다시물음] = useState<'아직' | '하는중' | '끝'>('아직');
  const [다시본결과, set다시본결과] = useState(false);

  /* ★ 2026-11-18 관리자 2단계 인증 (멘토-추가-보안5 ④ · components/admin-mfa-gate.tsx).
     **관리자인지 묻기 전에** 봅니다 — DB SQL(sql/초안_1118/관리자_2단계.sql)이 올라가면
     수단이 있는 사람의 aal1 로그인에서는 is_admin() 이 거짓이라, 순서가 뒤면
     코드 칸 대신 「관리자가 아니에요」가 뜹니다.
       확인필요  안쪽 대신 코드 칸
       없음      막지 않고 「켜 주세요」 띠만
       통과·모름 지금처럼 (모름은 막지 않습니다 — 진짜 벽은 DB) */
  const 이단계 = useAdminMfa(session);

  useEffect(() => {
    if (loading || !session || isAdmin || 다시물음 !== '아직') return;
    /* 코드를 넣기 전에는 다시 묻지 않습니다 — aal1 토큰으로 물어 「아니에요」로 굳으면 안 됩니다 */
    if (이단계.상태 === '확인중' || 이단계.상태 === '확인필요') return;
    set다시물음('하는중');
    const sb = browserSupabase();
    (async () => {
      try {
        await sb.auth.refreshSession();
        const { data, error } = await sb.rpc('is_admin');
        set다시본결과(!error && data === true);
      } catch { set다시본결과(false); }
      set다시물음('끝');
    })();
  }, [loading, session, isAdmin, 다시물음, 이단계.상태]);

  const 관리자인가 = isAdmin || 다시본결과;

  if (loading || (session && 이단계.상태 === '확인중')) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
        <p className="text-lg text-mute">잠시만요…</p>
      </main>
    );
  }

  /* 수단이 있는데 이번 로그인이 aal1 — 코드를 넣으면 aal2 가 되고, 관리자인지 다시 묻습니다 */
  if (session && 이단계.상태 === '확인필요') {
    return (
      <MfaCodeForm
        onDone={() => { 이단계.통과로(); set다시본결과(false); set다시물음('아직'); }}
      />
    );
  }

  /* 다시 묻는 동안에는 거절하지 않습니다 — 깜빡였다 사라지면 더 헷갈립니다 */
  if (session && !관리자인가 && 다시물음 !== '끝') {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
        <p className="text-lg text-mute">로그인을 확인하고 있어요…</p>
      </main>
    );
  }

  if (!session || !관리자인가) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-7">
        <h1 className="text-h2 font-bold">관리자만 볼 수 있어요</h1>
        <p className="mt-2 text-lg text-mute">
          {session ? '이 계정은 관리자가 아니에요' : '먼저 로그인해 주세요'}
        </p>
        <Link
          href={session ? '/' : '/login'}
          className="mt-6 inline-block rounded-md bg-brand-red px-7 py-5 text-btn font-bold text-white hover:bg-brand-red-dark"
        >
          {session ? '홈으로' : '로그인하기'}
        </Link>
      </main>
    );
  }

  return (
    <RapoAdminShell>
      {/* 공고가 안 들어오는 경로가 있으면 여기 빨간 줄이 뜹니다 (2026-09-25).
          조용한 실패를 우연히 발견하는 일이 없게 하려고 맨 위에 둡니다 */}
      <RouteHealth />

      {/* ★ 2026-11-18 — 2단계 인증을 아직 안 켠 관리자에게만. 막지 않습니다 */}
      {이단계.상태 === '없음' && <MfaBanner />}

      {/* ★ 2026-10-28 세중님 1번 — 역할이 관리자가 아니면 띠를 보이고 안쪽을 잠급니다.
          한 자리에 두면 관리자 화면 **전부**에 걸립니다 (지침 6절) */}
      <AdminRoleGate>{children}</AdminRoleGate>
    </RapoAdminShell>
  );
}
