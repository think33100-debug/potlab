'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 신고 (2026-10-01).
 *
 * ── 왜 처리 표시가 필요한가 ──────────────────────────────────
 * 신고 기록은 **처리 완료 1년 뒤** 지웁니다. 처리 전에는 안 지웁니다.
 * 그 기준점이 reports.handled_at 이라, 여기서 눌러줘야 시계가 돕니다.
 *
 * 또 하나 — 신고가 걸린 글의 작성자가 탈퇴하면, 그 사람의 원래 닉네임을
 * **신고 처리가 끝날 때까지** 보관합니다. 처리를 안 누르면 영영 남습니다.
 *
 * ── 글을 내리는 것은 여기서 안 합니다 ────────────────────────
 * 「커뮤니티 글」 화면에서 합니다. 여기서는 신고를 읽고 처리 표시만 합니다.
 * 두 곳에서 같은 일을 하면 어느 쪽이 맞는지 알 수 없게 됩니다.
 */

type 줄 = {
  id: number; 무엇: string; 대상: number; 신고한사람: string;
  사유: string; 신고시각: string;
  처리시각: string | null; 처리한사람: string | null; 처리메모: string | null;
  대상글제목: string | null; 대상글쓴이: string | null; 대상글있나: boolean;
};

const 때 = (s: string | null) =>
  s ? new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '-';

export default function AdminReports() {
  const toast = useToast();
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [처리전만, set처리전만] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  /* ★ 한 번에 100줄만 옵니다 — Supabase 가 거기서 자릅니다 (오류도 안 납니다).
     신고가 101건이 되는 날 조용히 안 보이기 시작합니다.

     ⚠ `p_page` 를 **반드시 넘겨야** 합니다. 안 넘기면 PostgREST 가
       `p_처리전만` 만 받는 옛 판을 부릅니다 (2026-10-04 · 옛 판은 지웠습니다). */
  const load = useCallback(async (만: boolean) => {
    const 쪽크기 = 100;
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 < 50; 쪽++) {
      const { data, error } = await browserSupabase()
        .rpc('admin_신고목록', { p_처리전만: 만, p_page: 쪽 });
      if (error) { setErr(error.message); setRows(모두); return; }
      const 받은것 = (data ?? []) as 줄[];
      모두.push(...받은것);
      if (받은것.length < 쪽크기) break;
    }
    setErr(null);
    setRows(모두);
  }, []);

  useEffect(() => { load(처리전만); }, [load, 처리전만]);

  const 처리 = async (id: number) => {
    const 메모 = prompt('처리 메모를 남기시겠어요? (비워도 됩니다)') ?? undefined;
    setBusy(id);
    const { error } = await browserSupabase()
      .rpc('admin_신고처리', { p_id: id, p_note: 메모 || null });
    setBusy(null);
    if (error) { toast(`처리하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast('처리 완료로 표시했어요. 1년 뒤 자동으로 지워집니다', { ms: 4000 });
    load(처리전만);
  };

  const 안끝난것 = (rows ?? []).filter((r) => !r.처리시각).length;

  return (
    <div>
      <h2 className="text-h3 font-bold">신고</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        읽고 「처리 완료」를 눌러주세요. 눌러야 1년 뒤 자동으로 지워지고,
        신고당한 글쓴이가 탈퇴했을 때 그 사람 닉네임 보관도 끝납니다
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { on: true, label: '처리 안 한 것' },
          { on: false, label: '전체' },
        ].map((t) => (
          <button key={String(t.on)} type="button"
            onClick={() => set처리전만(t.on)}
            aria-pressed={처리전만 === t.on}
            className={'rounded-md border px-6 py-4 text-lg font-medium '
              + (처리전만 === t.on
                ? 'border-teal-strong bg-teal-strong text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')}>
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <p role="alert" className="mt-6 rounded-sm bg-brand-red-soft p-5 text-lg text-brand-red-dark">
          못 불러왔어요 — {err}
        </p>
      )}
      {rows === null && <p className="mt-6 text-lg text-mute">잠시만요…</p>}

      {rows !== null && rows.length === 0 && (
        <div className="mt-6 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
          <p className="break-keep text-lg font-bold">신고가 없어요</p>
          <p className="mt-2 break-keep text-lg text-mute">
            {처리전만 ? '처리 안 한 신고가 없습니다' : '아직 신고가 한 건도 없습니다'}
          </p>
        </div>
      )}

      {(rows ?? []).length > 0 && (
        <>
          {안끝난것 > 0 && (
            <p className="mt-6 rounded-sm bg-brand-red-soft p-5 text-lg font-bold text-brand-red-dark">
              처리 안 한 신고가 <span className="num tabular-nums">{안끝난것}</span>건 있어요
            </p>
          )}
          <ul className="mt-6 space-y-3">
            {(rows ?? []).map((r) => (
              <li key={r.id}
                className={'rounded-sm border p-5 '
                  + (r.처리시각 ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'
                               : 'border-brand-red/40')}>
                <p className="flex flex-wrap items-baseline gap-x-3 text-lg">
                  <span className="rounded-xs bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                    {r.무엇 === 'post' ? '글' : r.무엇 === 'comment' ? '댓글' : r.무엇}
                  </span>
                  <span className="num tabular-nums text-mute">{때(r.신고시각)}</span>
                  {r.처리시각
                    ? <span className="text-sm text-mute">처리 완료 {때(r.처리시각)}</span>
                    : <span className="text-sm font-bold text-brand-red">처리 안 함</span>}
                </p>

                <p className="mt-2 break-keep text-lg">
                  <span className="font-bold">사유</span> — {r.사유}
                </p>
                <p className="mt-1 break-keep text-lg text-gray-600 dark:text-gray-400">
                  신고한 사람 {r.신고한사람}
                  <span className="block">
                    신고당한 글 —{' '}
                    {r.대상글있나
                      ? <>「{r.대상글제목}」 · 쓴이 {r.대상글쓴이}</>
                      : <span className="text-mute">이미 지워진 글입니다</span>}
                  </span>
                  {r.처리한사람 && (
                    <span className="block text-sm">
                      처리 {r.처리한사람}
                      {r.처리메모 && ` · ${r.처리메모}`}
                    </span>
                  )}
                </p>

                {!r.처리시각 && (
                  <button
                    type="button"
                    onClick={() => 처리(r.id)}
                    disabled={busy === r.id}
                    className="mt-3 rounded-md bg-teal-strong px-6 py-4 text-lg font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {busy === r.id ? '표시하는 중…' : '처리 완료로 표시'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
