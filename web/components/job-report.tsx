'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 공고 오류 신고 (2026-10-07).

   ── 왜 화면 안에서 받나 ──────────────────────────────────────
   브라우저 prompt() 를 쓰면 「취소」와 「빈 칸」을 못 가리고, 사파리에서는
   창이 아예 안 뜨기도 합니다. 보류함 「한 번에 치우기」와 같은 방식으로
   화면 안에 칸을 펼칩니다 (세중님 지시 — 알림창 말고 화면 안 단추).

   ── 남기는 것 ────────────────────────────────────────────────
   공고 id · 회원 번호 · 사유 · 보낸 때. 그것뿐입니다.
   관리자 화면에는 회원 번호 **앞 8자**만 갑니다 (DB admin_공고신고목록).
   탈퇴하면 회원 번호 칸이 비워집니다.

   로그인 전에 누르면 막지 않고 로그인으로 보냅니다 — 돌아올 자리를
   적어 두니 로그인하면 이 공고로 돌아옵니다 (job-save.tsx 와 같습니다). */
export function JobReport({ id }: { id: string }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [열림, set열림] = useState(false);
  const [사유, set사유] = useState('');
  const [busy, setBusy] = useState(false);
  const [보냈나, set보냈나] = useState(false);

  function 열기() {
    /* 확인 중이면 아무것도 안 합니다 — 회원인데 로그인 화면으로 튀면 안 됩니다 */
    if (loading) return;
    if (!session) {
      try { sessionStorage.setItem('after_login', `/jobs/${id}`); } catch { /* 사파리 비공개 */ }
      router.push('/login');
      return;
    }
    set열림(true);
  }

  async function 보내기() {
    const 글 = 사유.trim();
    if (글.length < 2) {
      toast('어디가 잘못됐는지 두 글자 이상 적어 주세요', { tone: 'danger', ms: 3000 });
      return;
    }
    setBusy(true);
    const { error } = await browserSupabase()
      .rpc('공고오류신고', { p_job: id, p_reason: 글 });
    setBusy(false);
    /* 실패하면 까닭을 띄웁니다 — 작업지침 11번 (화면에 진짜 이유가 뜨게) */
    if (error) {
      toast(`보내지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 });
      return;
    }
    set보냈나(true);
    set열림(false);
    set사유('');
    toast('고맙습니다. 관리자가 확인하고 고칩니다', { ms: 4000 });
  }

  if (보냈나) {
    return (
      <p className="mt-4 flex items-center gap-1.5 break-keep text-[12px] text-[#5F666C]">
        <Icon name="check" size={14} className="shrink-0" />
        신고를 보냈어요. 관리자가 확인하고 고칩니다
      </p>
    );
  }

  if (!열림) {
    return (
      <button
        type="button"
        onClick={열기}
        className="mt-4 flex items-center gap-1.5 break-keep text-[12px] text-[#5F666C]
                   underline underline-offset-2"
      >
        <Icon name="flag" size={14} className="shrink-0" />
        이 공고에 잘못된 내용이 있어요
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-[12px] border border-[#E3E3DE] bg-white p-5">
      <label htmlFor="신고사유" className="block break-keep text-[13px] font-medium text-[#4A5056]">
        어디가 잘못됐는지 적어 주세요
      </label>
      <p className="mt-1 break-keep text-[12px] text-[#5F666C]">
        마감일 · 직군 · 기관 이름 · 원문 링크처럼 틀린 곳을 적어 주시면 빠릅니다
      </p>
      <textarea
        id="신고사유"
        value={사유}
        onChange={(e) => set사유(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="예: 원문을 열어 보니 이미 마감된 공고입니다"
        className="mt-3 w-full rounded-[10px] border border-[#E3E3DE] bg-[#FAFAF8] px-4 py-3
                   text-[15px] placeholder:text-[#8A9299]"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={보내기}
          disabled={busy}
          className="rounded-[10px] bg-[#1B2025] px-6 py-3 text-[14px] font-bold text-white
                     transition-transform duration-[120ms] active:scale-[0.98]
                     disabled:opacity-50 motion-reduce:transition-none"
        >
          {busy ? '보내는 중…' : '보내기'}
        </button>
        <button
          type="button"
          onClick={() => { set열림(false); set사유(''); }}
          className="rounded-[10px] px-5 py-3 text-[14px] text-[#5F666C]"
        >
          그만두기
        </button>
      </div>
    </div>
  );
}
