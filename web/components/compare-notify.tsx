'use client';

import { useEffect, useRef, useState } from 'react';
import { 표없음 } from '@/lib/beta';
import { 비교알림동의, 비교창, 연락처꼴, 연봉구간 } from '@/lib/beta-compare';
import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS, type JobGroup } from '@/lib/who';

/* 「가입하기」를 누른 뒤 뜨는 창 — 「내 연봉, 다른 치료사들과 비교해 볼래요?」
   (2026-11-11 세중님 결정 · 줄 A · 문구는 lib/beta-compare.ts 의 비교창 그대로).
   ★ **꺼 둡니다 · 13일 뒤 켬** — lib/beta-compare.ts 의 비교알림켜짐 하나가 문입니다.

   ── 지킬 것 (세중님) ──────────────────────────────────────────
   · 미리 체크하지 않습니다 — 아무것도 고른 채로 시작하지 않습니다
   · [알림 받을래요] [다음에 할게요] 두 단추는 **같은 크기**입니다
   · 창을 **본 것**과 **신청한 것**을 따로 남깁니다 — 보고서의
     「가입 N명 중 창 본 M명 중 신청 K명」을 세려고요
       본 것    → `비교알림창` 표 (창이 뜰 때 한 줄)
       신청한 것 → `비교알림신청` 표 (연락처·직군·연봉 구간)
   · 실제 알림 발송은 만들지 않습니다

   ── 누가 무엇을 보나 ─────────────────────────────────────────
   두 표 모두 **본인은 자기 줄을 넣기만**, 읽기는 관리자만입니다 (RLS).
   연락처는 회원 화면 어디에도 다시 그리지 않습니다. */
export function CompareNotify({
  userId, job, email, onDone,
}: {
  userId: string;
  job: JobGroup | null;
  /** 로그인 수단이 준 이메일 — 연락처 칸을 미리 채우는 데만 씁니다 (고칠 수 있습니다) */
  email: string | null;
  onDone: () => void;
}) {
  const [단계, set단계] = useState<'묻기' | '적기' | '끝'>('묻기');
  const [연락처, set연락처] = useState(email ?? '');
  const [직군, set직군] = useState<JobGroup | null>(job);
  const [구간, set구간] = useState<string>('');
  const [자세히, set자세히] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [끝말, set끝말] = useState('신청됐어요. 서비스가 열리면 가장 먼저 알려 드릴게요.');

  /* 창을 「본 것」 — 뜰 때 한 번만 남깁니다.
     두 번 넣어도(개발 모드의 두 번 그리기 · 새로고침) 23505 로 막히고 그건 괜찮습니다 */
  const 남겼나 = useRef(false);
  useEffect(() => {
    if (남겼나.current) return;
    남겼나.current = true;
    browserSupabase().from('비교알림창').insert({ 사람: userId }).then(({ error }) => {
      if (error && error.code !== '23505' && !표없음(error)) {
        console.error('[RAPO] 비교 알림 창을 본 기록을 못 남겼습니다 ·', error.code, error.message);
      }
    });
  }, [userId]);

  const 신청 = async () => {
    if (!연락처꼴(연락처)) { setErr('이메일이나 휴대전화번호를 적어 주세요'); return; }
    if (!직군) { setErr('직군을 골라 주세요'); return; }
    if (!구간) { setErr('연봉 구간을 골라 주세요'); return; }
    setBusy(true); setErr(null);
    const { error } = await browserSupabase().from('비교알림신청').insert({
      사람: userId, 연락처: 연락처.trim(), 직군, 연봉구간: 구간,
    });
    setBusy(false);
    if (error && error.code === '23505') {
      set끝말('이미 신청하셨어요. 서비스가 열리면 알려 드릴게요.');
    } else if (error && 표없음(error)) {
      set끝말('지금은 신청을 받지 못했어요. 서비스가 열리기 전에 다시 여쭤볼게요.');
    } else if (error) {
      setErr(`저장하지 못했어요 — ${error.message}`);
      return;
    }
    set단계('끝');
  };

  const 단추 = 'w-full rounded-md px-4 py-5 text-btn font-bold active:scale-[0.98] disabled:opacity-40';
  const 상세 = 비교알림동의;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-notify-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 md:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-[26rem] overflow-y-auto rounded-sm bg-white p-6 shadow-lg dark:bg-gray-900">
        {단계 === '묻기' && (
          <>
            <h2 id="compare-notify-title" className="text-h3 font-bold break-keep">{비교창.제목}</h2>
            <p className="mt-3 text-lg text-gray-700 break-keep dark:text-gray-300">{비교창.설명}</p>
            <ul className="mt-4 space-y-2">
              {비교창.점.map((t) => (
                <li key={t} className="flex gap-2 text-lg break-keep">
                  <span aria-hidden className="font-bold text-teal-strong">✔</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-mute break-keep">{비교창.안내}</p>

            {/* 두 단추는 같은 크기입니다 (세중님) — 둘 다 grid 한 칸을 꽉 채웁니다 */}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set단계('적기')}
                className={단추 + ' bg-brand-red text-white hover:bg-brand-red-dark'}
              >
                {비교창.받기}
              </button>
              <button
                type="button"
                onClick={onDone}
                className={단추 + ' border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-950'}
              >
                {비교창.다음}
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-mute break-keep">
              {비교창.작은글}{' '}
              <button
                type="button"
                onClick={() => set자세히(!자세히)}
                aria-expanded={자세히}
                className="underline underline-offset-2"
              >
                자세히 보기 ›
              </button>
            </p>
            {자세히 && 상세 && (
              <ul className="mt-2 space-y-1 rounded-xs bg-gray-50 p-3 text-xs text-mute dark:bg-gray-950">
                {상세.lines.map((l) => <li key={l} className="break-keep">{l}</li>)}
              </ul>
            )}
          </>
        )}

        {단계 === '적기' && (
          <>
            <h2 id="compare-notify-title" className="text-h3 font-bold">알림 받을 곳을 적어 주세요</h2>
            <p className="mt-2 text-sm text-mute break-keep">
              서비스가 열릴 때 한 번 보내요. 이 밖의 일에는 쓰지 않아요.
            </p>

            <label className="mt-5 block text-sm font-bold text-mute" htmlFor="compare-contact">
              연락처 (이메일 또는 휴대전화)
            </label>
            <input
              id="compare-contact"
              value={연락처}
              onChange={(e) => { set연락처(e.target.value); setErr(null); }}
              inputMode="email"
              autoComplete="email"
              placeholder="example@email.com 또는 010-0000-0000"
              className="mt-1 w-full rounded-xs border border-gray-200 bg-gray-50 px-4 py-3 text-lg dark:border-gray-700 dark:bg-gray-950"
            />

            <p className="mt-4 text-sm font-bold text-mute">직군</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {JOB_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={직군 === g}
                  onClick={() => { set직군(g); setErr(null); }}
                  className={
                    'rounded-sm border px-4 py-3 text-lg font-bold ' +
                    (직군 === g
                      ? 'border-teal-strong bg-badge-teal-bg text-teal-strong'
                      : 'border-gray-200 dark:border-gray-700')
                  }
                >
                  {g}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-sm font-bold text-mute" htmlFor="compare-band">
              연봉 구간 (세전 · 대략)
            </label>
            <select
              id="compare-band"
              value={구간}
              onChange={(e) => { set구간(e.target.value); setErr(null); }}
              className="mt-1 w-full rounded-xs border border-gray-200 bg-gray-50 px-4 py-3 text-lg dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">골라 주세요</option>
              {연봉구간.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            {err && <p className="mt-3 text-lg text-brand-red">{err}</p>}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={신청}
                className={단추 + ' bg-brand-red text-white hover:bg-brand-red-dark'}
              >
                {busy ? '저장하는 중…' : '신청하기'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDone}
                className={단추 + ' border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-950'}
              >
                {비교창.다음}
              </button>
            </div>
          </>
        )}

        {단계 === '끝' && (
          <>
            <h2 id="compare-notify-title" className="text-h3 font-bold break-keep">{끝말}</h2>
            <button
              type="button"
              onClick={onDone}
              className={단추 + ' mt-6 bg-brand-red text-white hover:bg-brand-red-dark'}
            >
              가입 이어서 하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
