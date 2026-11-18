'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { useAuth } from '../auth';
import { MfaCodeForm, useAdminMfa } from '@/components/admin-mfa-gate';
import { 진짜, 확인된앱, 여섯자리 } from '@/lib/admin-mfa';

/* 관리자 2단계 인증 — 휴대폰 인증 앱 등록 (2026-11-18 초안)
   멘토-추가-보안5 ④ · 멘토-2차-05-1 · 멘토-4-03

   ── 왜 /admin 바깥인가 (설계 한 장 · 11/5) ─────────────────────
   /admin 껍데기 안에 두면, DB SQL 이 올라간 뒤 aal1 인 관리자가 들어오지 못할 수 있습니다.
   주소는 영어로 둡니다 (지침 6-2b).

   ── 관리자만 ─────────────────────────────────────────────────
   is_admin() 이 참일 때만 등록 단추를 보입니다. 이것은 「보이지 않게」 하는 것이고,
   등록 자체는 Supabase 인증 기능이라 누구 계정이든 **자기 계정에만** 붙습니다 —
   남의 계정에 등록하거나 관리자 권한이 생기는 길은 아닙니다.

   ── 흐름 ─────────────────────────────────────────────────────
   ① 이미 수단이 있고 이번 로그인이 aal1 이면 → 먼저 코드 확인 (두 번째 수단을 더하려면 aal2)
   ② 「등록 시작」 → 끝내지 못한 옛 등록(unverified)을 지우고 → enroll(totp) → 그림(QR)
   ③ 앱에 뜬 6자리 → challengeAndVerify → 확인됨. 이 순간 **다른 기기의 로그인은 풀립니다**
      (supabase-js 설명: 수단을 확인하면 다른 세션은 모두 로그아웃)
   비밀값(secret)·그림은 화면에만 둡니다. 콘솔·기록·서버로 따로 보내지 않습니다.

   ── 여기서 하지 않는 것 ─────────────────────────────────────
   · 확인된 수단 지우기 — 잘못 지우면 잠기거나 보호가 꺼집니다. 대시보드에서 대표 손으로
   · 복구 코드 — supabase-js 2.116 에서 아직 실험 기능(experimental)이라 넣지 않았습니다
   순서·잃어버렸을 때: docs/관리자_2단계_켜는법_1118.md */

type 단계 = '처음' | '그림' | '끝';

export default function MfaEnroll() {
  const { loading, session } = useAuth();
  const 이단계 = useAdminMfa(session);

  /* 관리자인가 — 화면 값이 아니라 지금 DB 에 한 번 묻습니다 (코드 확인 뒤 다시) */
  const [관리자, set관리자] = useState<boolean | null>(null);
  const [수단, set수단] = useState<Factor[]>([]);
  const [단계, set단계] = useState<단계>('처음');
  const [새것, set새것] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [글자보기, set글자보기] = useState(false);
  const [코드, set코드] = useState('');
  const [도는중, set도는중] = useState(false);
  const [탈, set탈] = useState<string | null>(null);
  const [다시읽기, set다시읽기] = useState(0);

  const 묻기가능 = !!session && (이단계.상태 === '없음' || 이단계.상태 === '통과' || 이단계.상태 === '모름');

  useEffect(() => {
    if (!묻기가능) return;
    let 살아있나 = true;
    const sb = 진짜();
    Promise.all([sb.rpc('is_admin'), sb.auth.mfa.listFactors()]).then(([a, f]) => {
      if (!살아있나) return;
      set관리자(!a.error && a.data === true);
      set수단(f.data ? 확인된앱(f.data.all) : []);
    }, () => { if (살아있나) set관리자(false); });
    return () => { 살아있나 = false; };
  }, [묻기가능, 다시읽기]);

  const 시작 = async () => {
    set도는중(true); set탈(null);
    const sb = 진짜();
    try {
      /* 끝내지 못한 옛 등록을 지웁니다 — 남아 있으면 같은 이름이 겹치거나 개수 한도에 걸립니다.
         확인 안 된 수단은 aal1 에서도 지울 수 있습니다. 확인된 수단은 건드리지 않습니다 */
      const 목록 = await sb.auth.mfa.listFactors();
      for (const f of 목록.data?.all ?? []) {
        if (f.factor_type === 'totp' && f.status === 'unverified') {
          await sb.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const 이름 = `RAPO 관리자 ${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)}`;
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 이름, issuer: 'RAPO' });
      if (error || !data) {
        set탈('등록을 시작하지 못했어요. 잠시 뒤 다시 해 주세요.');
        return;
      }
      set새것({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      set코드(''); set글자보기(false);
      set단계('그림');
    } finally {
      set도는중(false);
    }
  };

  const 마치기 = async () => {
    if (!새것 || 코드.length !== 6 || 도는중) return;
    set도는중(true); set탈(null);
    const { error } = await 진짜().auth.mfa.challengeAndVerify({ factorId: 새것.id, code: 코드 });
    set도는중(false);
    if (error) {
      set코드('');
      set탈(error.status === 429
        ? '너무 여러 번 시도했어요. 잠시 뒤 다시 해 주세요.'
        : '코드가 맞지 않아요. 앱에 뜬 새 코드를 넣어 주세요.');
      return;
    }
    set새것(null);
    set단계('끝');
    이단계.통과로();
    set다시읽기((n) => n + 1);
  };

  const 그만두기 = async () => {
    const id = 새것?.id;
    set새것(null); set코드(''); set단계('처음'); set탈(null);
    if (id) await 진짜().auth.mfa.unenroll({ factorId: id }).catch(() => undefined);
  };

  const 틀 = (속: React.ReactNode) => (
    <main className="mx-auto w-full max-w-md px-6 py-8 text-[#1B2025]">
      <Link href="/admin" className="text-[14px] text-[#59616A] underline underline-offset-2">← 관리자 화면</Link>
      <h1 className="mt-3 text-[22px] font-bold">관리자 2단계 인증</h1>
      {속}
    </main>
  );

  if (loading || (session && 이단계.상태 === '확인중')) {
    return 틀(<p className="mt-4 text-[15px] text-[#59616A]">잠시만요…</p>);
  }

  if (!session) {
    return 틀(
      <>
        <p className="mt-2 text-[15px] text-[#59616A]">먼저 로그인해 주세요</p>
        <Link href="/login" className="mt-6 inline-block rounded-lg bg-[#1B2025] px-5 py-3 text-[15px] font-bold text-white">로그인하기</Link>
      </>,
    );
  }

  if (이단계.상태 === '확인필요') {
    return <MfaCodeForm 제목="먼저 지금 쓰는 인증 앱 코드를 넣어 주세요" onDone={() => { 이단계.통과로(); set다시읽기((n) => n + 1); }} />;
  }

  if (관리자 === null) {
    return 틀(<p className="mt-4 text-[15px] text-[#59616A]">잠시만요…</p>);
  }

  if (!관리자) {
    return 틀(
      <>
        <p className="mt-2 text-[15px] text-[#59616A]">관리자만 쓸 수 있어요</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-[#1B2025] px-5 py-3 text-[15px] font-bold text-white">홈으로</Link>
      </>,
    );
  }

  return 틀(
    <>
      <p className="mt-2 break-keep text-[15px] text-[#59616A]">
        휴대폰 인증 앱(Google Authenticator · Microsoft Authenticator 등)에 이 계정을 등록합니다.
        등록하면 관리자 화면에 들어갈 때마다 앱에 뜬 6자리 코드를 묻습니다.
      </p>

      <section className="mt-6 rounded-xl border border-[#DCDCD6] bg-white p-4">
        <h2 className="text-[16px] font-bold">등록된 인증 앱</h2>
        {수단.length === 0 ? (
          <p className="mt-1 text-[14px] text-[#59616A]">아직 없어요</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-[14px]">
            {수단.map((f) => (
              <li key={f.id}>{f.friendly_name || '인증 앱'}</li>
            ))}
          </ul>
        )}
        {수단.length === 1 && (
          <p className="mt-2 break-keep text-[13px] text-[#6B4E00]">
            휴대폰을 잃어버릴 때를 대비해 <b>다른 기기에 하나 더</b> 등록해 두면 좋아요.
          </p>
        )}
      </section>

      {단계 === '처음' && (
        <button type="button" onClick={시작} disabled={도는중}
          className="mt-6 h-12 w-full rounded-lg bg-[#1B2025] text-[16px] font-bold text-white disabled:opacity-50">
          {도는중 ? '준비하는 중…' : 수단.length === 0 ? '등록 시작' : '다른 기기에 하나 더 등록'}
        </button>
      )}

      {단계 === '그림' && 새것 && (
        <section className="mt-6 flex flex-col gap-3">
          <ol className="list-decimal break-keep pl-5 text-[15px]">
            <li>휴대폰에서 인증 앱을 엽니다.</li>
            <li>「추가」 → 「QR 코드 스캔」으로 아래 그림을 찍습니다.</li>
            <li>앱에 뜬 6자리 숫자를 아래 칸에 넣습니다.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- supabase 가 주는 data: 주소(SVG) 그대로입니다. next/image 로 보낼 까닭이 없습니다 */}
          <img src={새것.qr} alt="인증 앱 등록 QR 코드" className="mx-auto h-48 w-48 bg-white p-2" />
          <button type="button" onClick={() => set글자보기((v) => !v)}
            className="text-left text-[13px] text-[#59616A] underline underline-offset-2">
            {글자보기 ? '글자 숨기기' : '그림을 못 찍으면 — 글자로 넣기'}
          </button>
          {글자보기 && (
            <code className="break-all rounded-lg bg-[#F4F4F1] p-3 text-[14px]">{새것.secret}</code>
          )}
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); 마치기(); }}>
            <input
              value={코드} onChange={(e) => set코드(여섯자리(e.target.value))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="6자리 숫자" aria-label="인증 앱 6자리 코드"
              className="h-14 rounded-lg border border-[#C5C8CC] bg-white px-4 text-center text-[24px] tracking-[0.3em]"
            />
            <button type="submit" disabled={코드.length !== 6 || 도는중}
              className="h-12 rounded-lg bg-[#1B2025] text-[16px] font-bold text-white disabled:opacity-50">
              {도는중 ? '확인하는 중…' : '등록 마치기'}
            </button>
            <button type="button" onClick={그만두기}
              className="text-[14px] text-[#59616A] underline underline-offset-2">
              그만두기
            </button>
          </form>
          <p className="break-keep text-[13px] text-[#59616A]">
            등록을 마치기 전에는 아무것도 바뀌지 않아요. 등록을 마치면 <b>다른 기기의 로그인은 풀립니다.</b>
          </p>
        </section>
      )}

      {단계 === '끝' && (
        <section className="mt-6 rounded-xl border border-[#B7E1C1] bg-[#EEF9F0] p-4 text-[15px]">
          <p className="font-bold">등록됐어요</p>
          <p className="mt-1 break-keep text-[14px]">
            이제 관리자 화면에 들어갈 때 이 앱의 코드를 묻습니다. 로그아웃했다가 다시 들어가 한 번 시험해 보세요.
          </p>
          <Link href="/admin" className="mt-3 inline-block rounded-lg bg-[#1B2025] px-4 py-2 text-[14px] font-bold text-white">
            관리자 화면으로
          </Link>
        </section>
      )}

      {탈 && <p role="alert" className="mt-3 break-keep text-[14px] font-bold text-[#B42318]">{탈}</p>}

      <p className="mt-8 break-keep text-[13px] text-[#59616A]">
        휴대폰을 잃어버리면 운영 책임자 본인이 확인한 뒤 등록을 지우고 다시 등록합니다. 우회 비밀번호는 없어요.
        코드와 그림은 누구에게도 보내지 마세요.
      </p>
    </>,
  );
}
