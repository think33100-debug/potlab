'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 관리자 화면 **역할 잠금** (2026-10-28 세중님 1번)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 마스터 계정이 역할을 학생·치료사로 바꿔 두면 **관리자 단추가 전부 막힙니다** —
 * DB 의 `is_admin()` 이 「마스터페르소나.지금역할 <> 관리자」면 거짓을 내기 때문입니다
 * (components/persona-bar.tsx 머리글 — 「90군데가 한꺼번에 막힙니다」).
 * 그런데 **화면은 그대로 열려서** 눌러 보고 나서야 「관리자만 할 수 있습니다」를 만납니다.
 * 2026-10-23 에 세중님이 공고 하나를 숨겼는데 DB 에 안 닿은 자리가 그것으로 보입니다
 * (job_state_log 에 줄이 **하나도** 없었습니다).
 *
 * ── 무엇을 하나 ─────────────────────────────────────────────
 * 역할이 관리자가 아니면 ㉠ 맨 위에 띠를 보이고 ㉡ **안쪽을 통째로 잠급니다**
 * (`pointer-events-none`). 띠는 잠금 **밖**에 있어 눌릴 수 있습니다.
 *
 * ── 조심한 것 ───────────────────────────────────────────────
 *   · **마스터가 아닌 관리자(수지 같은 계정)는 안 막습니다** — `마스터` 가 참일 때만 봅니다
 *   · 묻는 동안(`아직`)에는 **안 막습니다** — 참 관리자 화면이 깜빡하며 잠기면 안 됩니다
 *   · 띠만 **진짜 세션**으로 읽습니다 (`진짜: true`) — 비회원 보기 중에도 돌아올 길이 있어야
 *     합니다 (persona-bar.tsx 와 같은 까닭)
 */

type 페르소나 = { 마스터?: boolean; 지금역할?: string };

export function AdminRoleGate({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<페르소나 | null>(null);
  const [도는중, set도는중] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    const sb = browserSupabase({ 진짜: true });
    /* `.catch` 가 없는 PromiseLike 입니다 — persona-bar.tsx 와 같은 꼴로 `.then` 만 씁니다 */
    sb.rpc('내페르소나').then(({ data, error }) => {
      if (!살아있나) return;
      setP(!error && data ? (data as 페르소나) : {});
    }, () => { if (살아있나) setP({}); });
    return () => { 살아있나 = false; };
  }, []);

  /* 아직 못 물었거나, 마스터가 아니거나, 역할이 관리자면 — 그대로 보여 줍니다 */
  const 잠글까 = !!p?.마스터 && (p.지금역할 ?? '관리자') !== '관리자';
  if (!잠글까) return <>{children}</>;

  const 관리자로 = async () => {
    set도는중(true);
    const sb = browserSupabase({ 진짜: true });
    const { error } = await sb.rpc('페르소나바꾸기', { p_역할: '관리자' });
    if (error) { set도는중(false); alert(`바꾸지 못했어요 — ${error.message}`); return; }
    /* 역할이 **서버에서** 바뀌었습니다 — 통째로 새로 엽니다 (persona-bar 와 같은 까닭) */
    location.reload();
  };

  return (
    <>
      <div className="mx-auto mt-3 w-full max-w-5xl px-4">
        <div className="rounded-xl border border-[#F0C36D] bg-[#FFF8E6] px-4 py-3 text-[14px] text-[#6B4E00]">
          <div className="font-bold">
            지금 역할 <span className="underline">{p?.지금역할 ?? '(모름)'}</span> — 관리자로 바꿔야 처리됩니다
          </div>
          <div className="mt-1 break-keep text-[13px] text-[#7A5E12]">
            이 역할에서는 숨기기·보류함으로·회원 화면에 올리기·신고 처리가 <b>전부 막힙니다</b>
            (눌러도 「관리자만 할 수 있습니다」가 뜹니다). 그래서 아래 단추를 잠가 두었습니다.
          </div>
          <button
            type="button"
            onClick={관리자로}
            disabled={도는중}
            className="mt-2 rounded-lg bg-[#1B2025] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {도는중 ? '바꾸는 중…' : '관리자 역할로 바꾸기'}
          </button>
          <div className="mt-1 text-[12px] text-[#8A6E22]">
            아래쪽 역할 띠에서 골라도 됩니다.
          </div>
        </div>
      </div>
      {/* 안쪽을 통째로 잠급니다 — 띠는 이 바깥이라 눌립니다 */}
      <div className="pointer-events-none select-none opacity-60" aria-disabled="true">
        {children}
      </div>
    </>
  );
}
