'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 회원 목록 (2026-10-01).
 *
 * ── 급여·스펙은 「넣었나 / 안 넣었나」 만 보여줍니다 ──────────
 * 목록을 열 때마다 모두의 급여가 딸려 나오면 「필요한 만큼만 본다」가
 * 깨집니다. 값을 봐야 하면 admin_회원정보보기() 로 한 사람씩 엽니다 —
 * 그때 접속기록이 남습니다.
 *
 * ── 이 화면을 여는 것도 기록에 남습니다 ──────────────────────
 * 개인정보의 안전성 확보조치 기준 제8조. 「개인정보 접속기록」 화면에서 봅니다.
 *
 * ── 회원번호 ─────────────────────────────────────────────────
 * #00001 부터 가입 순서대로. 한 번 나간 번호는 다시 안 나옵니다.
 * 회원 화면에는 안 보입니다.
 */

type 줄 = {
  회원번호: string; 닉네임: string; 직군: string; 역할: string;
  가입일: string; 탈퇴일: string | null;
  글: number; 댓글: number;
  급여넣음: boolean; 스펙넣음: boolean; 알림받음: boolean;
  동의판: string | null; 동의시각: string | null;
  id: string;
};

const 날 = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-';

export default function AdminMembers() {
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [연사람, set연사람] = useState<string | null>(null);
  const [속내용, set속내용] = useState<Record<string, unknown> | null>(null);

  /* ★ 한 번에 100줄만 옵니다 — Supabase 가 거기서 자릅니다 (오류도 안 납니다).
     회원이 101명이 되는 날 조용히 안 보이기 시작합니다.
     그래서 100줄씩 쪽을 넘겨 받습니다.

     ⚠ `p_page` 를 **반드시 넘겨야** 합니다. 안 넘기면 PostgREST 가
       인자 없는 옛 판을 부릅니다 (2026-10-04 · 옛 판은 지웠습니다). */
  const load = useCallback(async () => {
    const 쪽크기 = 100;
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 < 50; 쪽++) {
      const { data, error } = await browserSupabase().rpc('admin_회원목록', { p_page: 쪽 });
      if (error) { setErr(error.message); setRows(모두); return; }
      const 받은것 = (data ?? []) as 줄[];
      모두.push(...받은것);
      if (받은것.length < 쪽크기) break;
    }
    setErr(null);
    setRows(모두);
  }, []);

  useEffect(() => { load(); }, [load]);

  const 보일것 = useMemo(() => {
    const k = q.trim();
    if (!k || !rows) return rows ?? [];
    return rows.filter((r) => (r.회원번호 + ' ' + r.닉네임 + ' ' + r.직군).includes(k));
  }, [rows, q]);

  const 살아있음 = (rows ?? []).filter((r) => !r.탈퇴일).length;
  const 나감 = (rows ?? []).filter((r) => r.탈퇴일).length;

  /* 한 사람의 급여·스펙을 엽니다. 여는 순간 접속기록이 남습니다 */
  const 열기 = async (id: string) => {
    if (연사람 === id) { set연사람(null); set속내용(null); return; }
    set연사람(id); set속내용(null);
    const { data, error } = await browserSupabase().rpc('admin_회원정보보기', { p_profile_id: id });
    set속내용(error ? { 오류: error.message } : (data as Record<string, unknown>));
  };

  return (
    <div>
      <h2 className="text-h3 font-bold">회원 목록</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        회원번호는 가입 순서대로 붙고 바뀌지 않아요. 회원 화면에는 안 보여요
      </p>

      <div className="mt-5 rounded-sm bg-badge-teal-bg p-5 dark:border dark:border-teal-strong/40 dark:bg-transparent">
        <p className="break-keep text-lg">
          쓰는 중 <span className="num tabular-nums font-bold">{살아있음}</span>명 ·
          탈퇴 <span className="num tabular-nums font-bold">{나감}</span>명
        </p>
        <p className="mt-2 break-keep text-sm text-mute">
          이 화면을 연 것도 「개인정보 접속기록」 에 남습니다
        </p>
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-bold text-mute">찾기 (회원번호·닉네임·직군)</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: #00004 · 나나로 · 물리치료사"
          aria-label="찾기"
          className="mt-1 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
        />
      </label>

      {err && (
        <p role="alert" className="mt-6 rounded-sm bg-brand-red-soft p-5 text-lg text-brand-red-dark">
          못 불러왔어요 — {err}
        </p>
      )}
      {rows === null && <p className="mt-6 text-lg text-mute">잠시만요…</p>}

      {보일것.length > 0 && (
        <ul className="mt-6 space-y-3">
          {보일것.map((r) => (
            <li key={r.id}
              className={'rounded-sm border p-5 '
                + (r.탈퇴일 ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'
                           : 'border-gray-200 dark:border-gray-700')}>
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="num tabular-nums text-lg font-bold">{r.회원번호}</span>
                <span className="text-lg font-bold">{r.닉네임}</span>
                {r.탈퇴일 && (
                  <span className="rounded-xs bg-gray-200 px-2 py-1 text-sm dark:bg-gray-800">
                    탈퇴 {날(r.탈퇴일)}
                  </span>
                )}
              </p>

              <p className="mt-2 break-keep text-lg text-gray-600 dark:text-gray-400">
                {r.직군} · {r.역할} · 가입 {날(r.가입일)}
                <span className="block text-sm">
                  글 <span className="num tabular-nums">{r.글}</span> ·
                  댓글 <span className="num tabular-nums">{r.댓글}</span> ·
                  급여 {r.급여넣음 ? '넣음' : '안 넣음'} ·
                  스펙 {r.스펙넣음 ? '넣음' : '안 넣음'} ·
                  알림 {r.알림받음 ? '받음' : '안 받음'}
                </span>
                <span className="block text-sm text-mute">
                  동의 {r.동의판 ?? '(기록 없음)'}
                  {r.동의시각 && ' · ' + 날(r.동의시각)}
                </span>
              </p>

              {(r.급여넣음 || r.스펙넣음) && !r.탈퇴일 && (
                <button
                  type="button"
                  onClick={() => 열기(r.id)}
                  className="mt-3 rounded-xs border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
                >
                  {연사람 === r.id ? '닫기' : '급여·스펙 열기 (기록 남아요)'}
                </button>
              )}

              {연사람 === r.id && (
                <pre className="mt-3 overflow-x-auto rounded-xs bg-gray-50 p-4 text-sm dark:bg-gray-950">
                  {속내용 ? JSON.stringify(속내용, null, 1) : '여는 중…'}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows !== null && 보일것.length === 0 && (
        <p className="mt-6 text-lg text-mute">찾는 회원이 없어요</p>
      )}
    </div>
  );
}
