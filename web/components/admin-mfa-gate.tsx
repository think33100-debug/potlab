'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Factor, Session } from '@supabase/supabase-js';
import { useAuth } from '@/app/auth';
import { 이단계상태읽기, 진짜, 확인된앱, 여섯자리, type 이단계상태 } from '@/lib/admin-mfa';

/* 관리자 2단계 인증 — 코드 묻는 칸 · 「켜 주세요」 띠 (2026-11-18 초안)
   멘토-추가-보안5 ④ · 멘토-2차-05-1 · 멘토-4-03 · 설계: RAPO노트 작업보존 1105_2300_MFA 한 장

   ── 쓰는 자리 ────────────────────────────────────────────────
     /admin 껍데기 (app/admin/layout.tsx)   수단이 있고 aal1 이면 안쪽 대신 이 칸
     /master 로그인 (app/master/page.tsx)   비밀번호가 맞은 뒤 수단이 있으면 이 칸
     /mfa 등록 화면 (app/mfa/page.tsx)       두 번째 수단을 더하기 전에 이 칸

   ── 여기는 「보이지 않게」 하는 벽입니다 ────────────────────────
   진짜 벽은 DB 의 is_admin()·대표인가()·권한있나() 입니다 (sql/초안_1118/관리자_2단계.sql).
   그 SQL 이 올라가기 전에는 이 칸을 건너뛰고 RPC 를 직접 불러도 막히지 않습니다.

   ── 지키는 것 (설계 한 장) ──────────────────────────────────
   · 수단이 없는 사람은 **막지 않습니다** — 띠만 보입니다. 켜는 때는 대표가 정합니다
   · 영구 우회·공용 우회 비밀번호는 없습니다. 잃어버리면 운영 책임자 본인이 대시보드에서 지웁니다
   · 코드·비밀값은 화면 밖(콘솔·기록)으로 내보내지 않습니다 */

/* 지금 로그인의 2단계 상태. 토큰이 바뀌면(코드 확인·한 시간마다 갱신) 다시 읽습니다.
   다시 읽는 동안에는 **전 값을 그대로 둡니다** — 한 시간마다 「잠시만요」가 깜빡이면 안 됩니다 */
export function useAdminMfa(session: Session | null) {
  const [상태, set상태] = useState<이단계상태 | '확인중'>('확인중');
  const 토큰 = session?.access_token ?? null;

  useEffect(() => {
    let 살아있나 = true;
    if (!토큰) {
      /* 로그인 전 — 이 값은 쓰이지 않습니다(화면이 먼저 「로그인해 주세요」를 냅니다) */
      Promise.resolve().then(() => { if (살아있나) set상태('모름'); });
      return () => { 살아있나 = false; };
    }
    이단계상태읽기().then((s) => { if (살아있나) set상태(s); });
    return () => { 살아있나 = false; };
  }, [토큰]);

  return { 상태, 통과로: () => set상태('통과') };
}

/* 「2단계 인증을 켜 주세요」 띠 — 막지 않습니다 */
export function MfaBanner() {
  return (
    <div className="mx-auto mt-3 w-full max-w-5xl px-4">
      <div className="rounded-xl border border-[#F0C36D] bg-[#FFF8E6] px-4 py-3 text-[14px] text-[#6B4E00]">
        <div className="font-bold">2단계 인증을 켜 주세요</div>
        <div className="mt-1 break-keep text-[13px] text-[#7A5E12]">
          휴대폰 인증 앱에 이 계정을 한 번 등록하면, 다음부터 관리자 화면에 들어갈 때 6자리 코드를 묻습니다.
          지금은 막지 않아요.
        </div>
        <Link href="/mfa" className="mt-2 inline-block rounded-lg bg-[#1B2025] px-3 py-2 text-[13px] font-bold text-white">
          2단계 인증 켜기
        </Link>
      </div>
    </div>
  );
}

/* 6자리 코드를 묻는 칸. 맞으면 이번 로그인이 aal2 가 되고 onDone 을 부릅니다.
   (supabase-js 가 새 세션을 저장하고 MFA_CHALLENGE_VERIFIED 를 알립니다 →
    app/auth.tsx 가 받아 is_admin 을 다시 묻습니다) */
export function MfaCodeForm({ onDone, 제목 = '인증 앱의 코드를 넣어 주세요' }: {
  onDone: () => void; 제목?: string;
}) {
  const { signOut } = useAuth();
  const [앱, set앱] = useState<Factor[] | null>(null);
  const [고른, set고른] = useState('');
  const [코드, set코드] = useState('');
  const [도는중, set도는중] = useState(false);
  const [탈, set탈] = useState<string | null>(null);
  const [잃음, set잃음] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    진짜().auth.mfa.listFactors().then(({ data, error }) => {
      if (!살아있나) return;
      if (error || !data) { set앱([]); set탈('등록된 인증 앱을 읽지 못했어요. 새로고침해 주세요.'); return; }
      const 목록 = 확인된앱(data.all);
      set앱(목록);
      set고른(목록[0]?.id ?? '');
    }, () => { if (살아있나) { set앱([]); set탈('등록된 인증 앱을 읽지 못했어요. 새로고침해 주세요.'); } });
    return () => { 살아있나 = false; };
  }, []);

  const 확인 = async () => {
    if (코드.length !== 6 || !고른 || 도는중) return;
    set도는중(true); set탈(null);
    const { error } = await 진짜().auth.mfa.challengeAndVerify({ factorId: 고른, code: 코드 });
    set도는중(false);
    if (error) {
      set코드('');
      set탈(error.status === 429
        ? '너무 여러 번 시도했어요. 잠시 뒤 다시 해 주세요.'
        : error.code === 'mfa_verification_failed'
          ? '코드가 맞지 않아요. 앱에 뜬 새 코드를 넣어 주세요.'
          : '확인하지 못했어요. 잠시 뒤 다시 해 주세요.');
      return;
    }
    onDone();
  };

  return (
    <main className="mx-auto w-full max-w-md px-6 py-8">
      <h1 className="text-[22px] font-bold text-[#1B2025]">{제목}</h1>
      <p className="mt-2 break-keep text-[15px] text-[#59616A]">
        관리 화면에 들어가기 전에 한 번 더 확인합니다. 휴대폰 인증 앱에 뜬 6자리 숫자를 넣어 주세요.
      </p>

      {앱 === null ? (
        <p className="mt-6 text-[15px] text-[#59616A]">잠시만요…</p>
      ) : 앱.length === 0 && !탈 ? (
        <p className="mt-6 break-keep text-[15px] text-[#6B4E00]">
          이 계정의 2단계 수단은 인증 앱 코드가 아니에요. 운영 책임자에게 알려 주세요.
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); 확인(); }}>
          {앱.length > 1 && (
            <select value={고른} onChange={(e) => set고른(e.target.value)} aria-label="인증 앱 고르기"
              className="h-12 rounded-lg border border-[#C5C8CC] bg-white px-3 text-[15px]">
              {앱.map((f) => (
                <option key={f.id} value={f.id}>{f.friendly_name || '인증 앱'}</option>
              ))}
            </select>
          )}
          <input
            value={코드} onChange={(e) => set코드(여섯자리(e.target.value))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="6자리 숫자" aria-label="인증 앱 6자리 코드" autoFocus
            className="h-14 rounded-lg border border-[#C5C8CC] bg-white px-4 text-center text-[24px] tracking-[0.3em] text-[#1B2025]"
          />
          <button type="submit" disabled={코드.length !== 6 || 도는중 || !고른}
            className="h-12 rounded-lg bg-[#1B2025] text-[16px] font-bold text-white disabled:opacity-50">
            {도는중 ? '확인하는 중…' : '확인'}
          </button>
        </form>
      )}

      {탈 && <p role="alert" className="mt-3 break-keep text-[14px] font-bold text-[#B42318]">{탈}</p>}

      <div className="mt-8 flex flex-col gap-2 border-t border-[#DCDCD6] pt-4">
        <button type="button" onClick={() => set잃음((v) => !v)}
          className="text-left text-[14px] font-bold text-[#59616A] underline underline-offset-2">
          휴대폰을 잃어버렸어요
        </button>
        {잃음 && (
          <p className="break-keep text-[14px] text-[#59616A]">
            복구는 <b>운영 책임자 본인</b>만 합니다. 운영 책임자가 본인을 확인한 뒤 등록을 지우면,
            다시 로그인해 새 휴대폰에 등록합니다. 우회 비밀번호는 없어요.
            코드와 비밀번호는 누구에게도 보내지 마세요.
          </p>
        )}
        <button type="button" onClick={() => signOut()}
          className="text-left text-[14px] text-[#59616A] underline underline-offset-2">
          로그아웃
        </button>
      </div>
    </main>
  );
}
