'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 페르소나 띠 — 마스터 계정에게만 보입니다 (2026-10-09).
 *
 * ── 화면만 바꾸는 것이 아닙니다 ──────────────────────────────
 * 누르면 DB 의 profiles.role · job_group · survey_at · 회원자격 이 **진짜로**
 * 바뀝니다. 그래야 RLS 와 창구 권한까지 그 역할로 겪어 볼 수 있습니다.
 * 화면만 흉내 내면 「회원에게는 막히나」를 못 봅니다.
 *
 * ── 페르소나 중에는 관리자 힘이 꺼집니다 ─────────────────────
 * DB 의 is_admin() 이 「마스터페르소나.지금역할 <> 관리자」면 false 를 냅니다.
 * 그래서 90군데가 한꺼번에 막힙니다. 이 띠만 마스터인가() 로 따로 삽니다.
 *
 * ── 「비회원」 은 로그아웃입니다 ──────────────────────────────
 * 흉내가 아니라 진짜로 나갑니다. 다시 보려면 /master 로 들어옵니다.
 */

type 페르소나 = { 마스터: boolean; 지금역할?: string; 고를수있는것?: string[] };

export function PersonaBar() {
  const { session, reload } = useAuth();
  const [p, setP] = useState<페르소나 | null>(null);
  const [도는중, set도는중] = useState(false);
  const [접음, set접음] = useState(false);

  /* 로그인 전에는 아예 안 묻습니다. 「없음」을 state 에 넣지 않는 까닭 —
     effect 안에서 바로 setState 하면 한 번 더 그려집니다 (eslint 가 막습니다).
     세션이 없으면 아래에서 그냥 안 그립니다 */
  const 읽기 = useCallback(async () => {
    const { data, error } = await browserSupabase().rpc('내페르소나');
    setP(error ? { 마스터: false } : (data as 페르소나));
  }, []);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    browserSupabase().rpc('내페르소나').then(({ data, error }) => {
      if (!살아있나) return;
      setP(error ? { 마스터: false } : (data as 페르소나));
    });
    return () => { 살아있나 = false; };
  }, [session]);

  if (!session || !p?.마스터) return null;

  const 바꾸기 = async (역할: string) => {
    set도는중(true);
    if (역할 === '비회원') {
      await browserSupabase().auth.signOut();
      /* router.push 가 아니라 **통째로 새로** 엽니다. 역할이 서버에서 바뀌었으니
         서버가 그린 화면과 화면이 쥔 내 프로필을 둘 다 버려야 합니다 */
      window.location.assign(window.location.origin + '/');
      return;
    }
    const { error } = await browserSupabase().rpc('페르소나바꾸기', { p_역할: 역할 });
    set도는중(false);
    if (error) { alert('못 바꿨습니다 — ' + error.message); return; }
    await 읽기();
    /* 화면이 쥐고 있는 내 프로필도 다시 읽습니다 — 안 그러면 옛 역할로 그려집니다 */
    try { await reload?.(); } catch { /* 무시 */ }
    window.location.reload();
  };

  const 것들 = [...(p.고를수있는것 ?? []), '비회원'];

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-brand-red bg-[#14181C] px-4 py-2">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => set접음((v) => !v)}
          className="rounded-md bg-brand-red px-3 py-1 text-sm font-bold text-white">
          운영진 · {p.지금역할}
        </button>
        {!접음 && 것들.map((r) => (
          <button
            key={r} type="button" disabled={도는중 || r === p.지금역할}
            onClick={() => 바꾸기(r)}
            className={'rounded-full px-3 py-1 text-sm ' +
              (r === p.지금역할
                ? 'bg-white font-bold text-[#14181C]'
                : 'border border-gray-600 text-gray-200 hover:bg-gray-800')}>
            {r}
          </button>
        ))}
        {접음 && <span className="text-sm text-gray-400">눌러서 펴기</span>}
      </div>
    </div>
  );
}
