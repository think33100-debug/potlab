'use client';

import { useEffect, useState } from 'react';
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
 * ── 바꾼 뒤에는 통째로 새로 엽니다 ───────────────────────────
 * 역할이 **서버에서** 바뀌었습니다. 서버가 그려 둔 화면과 브라우저가 쥔
 * 내 프로필을 둘 다 버려야 해서 location.reload() 를 씁니다.
 * 그래서 여기서 따로 다시 읽을 일이 없습니다 — 새로 열리면서 다 읽습니다.
 *
 * ── 「비회원」 은 로그아웃입니다 ──────────────────────────────
 * 흉내가 아니라 진짜로 나갑니다. **돌아오는 길은 /master 하나뿐**이라
 * 누르기 전에 띠에 적어 둡니다.
 */

type 페르소나 = { 마스터: boolean; 지금역할?: string; 고를수있는것?: string[] };

export function PersonaBar() {
  const { session } = useAuth();
  const [p, setP] = useState<페르소나 | null>(null);
  const [도는중, set도는중] = useState(false);
  const [접음, set접음] = useState(false);

  /* 로그인 전에는 아예 안 묻습니다. 세션이 바뀌면 다시 묻습니다 */
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
    if (역할 === '비회원'
        && !confirm('로그아웃합니다. 다시 오시려면 /master 로 들어오셔야 해요. 할까요?')) return;

    set도는중(true);

    if (역할 === '비회원') {
      await browserSupabase().auth.signOut();
      window.location.assign(window.location.origin + '/');
      return;
    }

    const { error } = await browserSupabase().rpc('페르소나바꾸기', { p_역할: 역할 });
    if (error) { set도는중(false); alert('못 바꿨습니다 — ' + error.message); return; }
    window.location.reload();
  };

  const 것들 = [...(p.고를수있는것 ?? []), '비회원'];

  return (
    <div className="fixed inset-x-0 bottom-[62px] z-[60] border-y-2 border-brand-red bg-[#14181C] px-4 py-2 md:bottom-0">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => set접음((v) => !v)}
          className="rounded-md bg-brand-red px-3 py-1 text-sm font-bold text-white">
          운영진 · {p.지금역할}
        </button>

        {접음
          ? <span className="text-sm text-gray-400">눌러서 펴기</span>
          : (
            <>
              {것들.map((r) => (
                <button
                  key={r} type="button" disabled={도는중 || r === p.지금역할}
                  onClick={() => 바꾸기(r)}
                  className={'rounded-full px-3 py-1 text-sm disabled:opacity-60 ' +
                    (r === p.지금역할
                      ? 'bg-white font-bold text-[#14181C]'
                      : 'border border-gray-600 text-gray-200 hover:bg-gray-800')}>
                  {r}
                </button>
              ))}
              <span className="w-full text-sm text-gray-400">
                「비회원」은 로그아웃이에요 — 돌아오려면 <b className="text-gray-200">/master</b> 로 들어오세요.
              </span>
            </>
          )}
      </div>
    </div>
  );
}
