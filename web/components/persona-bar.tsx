'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { 비회원보기, 비회원보기중 } from '@/lib/guest-view';

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
 * ── 「비회원」은 로그아웃이 아닙니다 (2026-10-09 바뀜) ────────
 * 전에는 정말 로그아웃했고, 돌아오는 길이 /master 하나뿐이었습니다.
 * 지금은 **로그인을 유지한 채** 쿠키(potjob_guest_view) 하나로
 * 브라우저와 서버가 둘 다 JWT 를 안 보냅니다 — 자료까지 비회원이 됩니다
 * (lib/guest-view.ts · lib/supabase-browser.ts · lib/supabase-server.ts).
 * 그래서 확인 창도, 「/master 로 다시 들어오세요」 안내도 없앴습니다.
 *
 * ── 이 띠만 진짜 세션으로 읽습니다 ───────────────────────────
 * 비회원 보기 중에는 useAuth() 가 「로그인 안 함」이라고 답합니다 — 그게
 * 이 기능의 핵심입니다. 띠가 그 값을 보면 띠까지 사라져서 돌아올 길이
 * 없어집니다. 그래서 browserSupabase({ 진짜: true }) 로 직접 묻습니다.
 *
 * ── 바꾼 뒤에는 통째로 새로 엽니다 ───────────────────────────
 * 역할이 **서버에서** 바뀌었습니다. 서버가 그려 둔 화면과 브라우저가 쥔
 * 내 프로필을 둘 다 버려야 해서 location.reload() 를 씁니다.
 */

type 페르소나 = { 마스터: boolean; 지금역할?: string; 고를수있는것?: string[] };

export function PersonaBar() {
  const [p, setP] = useState<페르소나 | null>(null);
  const [도는중, set도는중] = useState(false);
  const [접음, set접음] = useState(false);
  const 손님 = 비회원보기중();

  useEffect(() => {
    let 살아있나 = true;
    const sb = browserSupabase({ 진짜: true });
    sb.auth.getSession().then(({ data }) => {
      if (!살아있나) return;
      if (!data.session) { setP({ 마스터: false }); return; }
      sb.rpc('내페르소나').then(({ data: d, error }) => {
        if (!살아있나) return;
        setP(error ? { 마스터: false } : (d as 페르소나));
      });
    });
    return () => { 살아있나 = false; };
  }, []);

  if (!p?.마스터) return null;

  const 바꾸기 = async (역할: string) => {
    set도는중(true);
    /* 창구는 **진짜 세션으로** 불러야 합니다. 비회원 보기 중에는
       기본 열쇠꾸러미에 토큰이 없어서 42501 이 납니다 */
    const { error } = await browserSupabase({ 진짜: true })
      .rpc('페르소나바꾸기', { p_역할: 역할 });
    if (error) { set도는중(false); alert('못 바꿨습니다 — ' + error.message); return; }
    /* 쿠키는 창구가 성공한 뒤에 바꿉니다 — 실패했는데 보기가 바뀌면
       DB 기록과 화면이 어긋납니다 */
    비회원보기(역할 === '비회원');
    window.location.reload();
  };

  const 지금 = 손님 ? '비회원' : p.지금역할;

  return (
    <div className="fixed inset-x-0 bottom-[62px] z-[60] border-y-2 border-brand-red bg-[#14181C] px-4 py-2 md:bottom-0">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => set접음((v) => !v)}
          className="rounded-md bg-brand-red px-3 py-1 text-sm font-bold text-white">
          운영진 · {지금}
        </button>

        {접음
          ? <span className="text-sm text-gray-400">눌러서 펴기</span>
          : (
            <>
              {(p.고를수있는것 ?? []).map((r) => (
                <button
                  key={r} type="button" disabled={도는중 || r === 지금}
                  onClick={() => 바꾸기(r)}
                  className={'rounded-full px-3 py-1 text-sm disabled:opacity-60 ' +
                    (r === 지금
                      ? 'bg-white font-bold text-[#14181C]'
                      : 'border border-gray-600 text-gray-200 hover:bg-gray-800')}>
                  {r}
                </button>
              ))}
              <span className="w-full text-sm text-gray-400">
                {손님
                  ? '지금 비회원 화면이에요 — 로그인은 그대로 있어요. 「관리자」를 누르면 돌아옵니다.'
                  : '「비회원」은 로그아웃이 아니라 비회원 화면으로 보는 것이에요.'}
              </span>
            </>
          )}
      </div>
    </div>
  );
}
