'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 공고 오류 신고 (2026-10-07).
 *
 * 커뮤니티 신고(reports)와 **다른 표**입니다 — 공고 id 는 text 이고,
 * 보관 규정(처리 1년 뒤 삭제·탈퇴자 닉네임 보관)도 성격이 다릅니다.
 * 화면만 같은 「신고」 메뉴에 아래위로 놓습니다.
 *
 * 신고한사람 칸은 **회원 번호 앞 8자**뿐입니다. 같은 사람이 여러 번
 * 보냈는지만 알아보려는 것이고 누구인지는 알 수 없습니다
 * (DB admin_공고신고목록 · 세중님 지시 — 신고에 필요한 만큼만).
 *
 * 공고를 고치거나 내리는 것은 여기서 안 합니다 — 「공고」 화면에서 합니다.
 * 두 곳에서 같은 일을 하면 어느 쪽이 맞는지 알 수 없게 됩니다.
 */

type 줄 = {
  id: number; job_id: string; 기관: string | null; 제목: string | null;
  주소: string | null; 내린것: boolean; 사유: string; 신고시각: string;
  신고한사람: string; 처리시각: string | null; 처리메모: string | null;
  이공고신고수: number;
};

const 때 = (s: string | null) =>
  s ? new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '-';

export function AdminJobReports() {
  const toast = useToast();
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [처리전만, set처리전만] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [메모, set메모] = useState<Record<number, string>>({});

  /* 한 번에 100줄. 커뮤니티 신고와 같은 방식으로 쪽을 이어 받습니다 */
  const load = useCallback(async (만: boolean) => {
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 < 50; 쪽++) {
      const { data, error } = await browserSupabase()
        .rpc('admin_공고신고목록', { p_처리전만: 만, p_page: 쪽 });
      if (error) { setErr(error.message); setRows(모두); return; }
      const 받은것 = (data ?? []) as 줄[];
      모두.push(...받은것);
      if (받은것.length < 100) break;
    }
    setErr(null);
    setRows(모두);
  }, []);

  useEffect(() => { load(처리전만); }, [load, 처리전만]);

  const 처리 = async (id: number) => {
    setBusy(id);
    const { error } = await browserSupabase()
      .rpc('admin_공고신고처리', { p_id: id, p_note: 메모[id]?.trim() || null });
    setBusy(null);
    if (error) { toast(`처리하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast('처리 완료로 표시했어요', { ms: 3000 });
    load(처리전만);
  };

  const 안끝난것 = (rows ?? []).filter((r) => !r.처리시각).length;

  return (
    <section className="mt-12 border-t border-line pt-10">
      <h2 className="text-h3 font-bold">공고 오류 신고</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        회원이 「이 공고에 잘못된 내용이 있어요」로 보낸 것입니다.
        공고를 고치거나 내리는 것은 「공고」 화면에서 하고, 여기서는 읽고 처리 표시만 합니다.
        처리 안 한 건수는 하루 한 번 오는 요약 메일에도 들어갑니다.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-lg">
          <input type="checkbox" checked={처리전만}
                 onChange={(e) => set처리전만(e.target.checked)} />
          처리 안 한 것만
        </label>
        {rows && <span className="text-lg text-mute">처리 안 한 것 {안끝난것}건</span>}
      </div>

      {err && (
        <p className="mt-5 break-keep text-lg text-brand-red">
          불러오지 못했어요 — {err}
        </p>
      )}
      {rows === null && !err && <p className="mt-5 text-lg text-mute">불러오는 중…</p>}
      {rows && rows.length === 0 && !err && (
        <p className="mt-5 text-lg text-mute">
          {처리전만 ? '처리할 신고가 없습니다' : '신고가 아직 없습니다'}
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="rounded-sm border border-line bg-card p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm text-mute">{때(r.신고시각)}</span>
              <span className="text-sm text-mute">· 보낸이 {r.신고한사람}</span>
              {r.이공고신고수 > 1 && (
                <span className="text-sm font-bold text-brand-red">
                  · 이 공고에 신고 {r.이공고신고수}건
                </span>
              )}
              {r.내린것 && <span className="text-sm text-mute">· 이미 내려간 공고</span>}
              {r.처리시각 && <span className="text-sm text-mute">· 처리 {때(r.처리시각)}</span>}
            </div>

            <p className="mt-2 break-keep text-body-lg font-medium">
              {r.기관 ?? '(지워진 공고)'} — {r.제목 ?? r.job_id}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-keep text-lg">{r.사유}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/jobs/${r.job_id}`} className="text-interaction-blue hover:underline">
                우리 화면에서 보기
              </Link>
              <Link href={`/admin/jobs/${r.job_id}`} className="text-interaction-blue hover:underline">
                관리자 화면에서 고치기
              </Link>
              {r.주소 && (
                <a href={r.주소} target="_blank" rel="noopener noreferrer"
                   className="text-interaction-blue hover:underline">
                  기관 원문 열기
                </a>
              )}
            </div>

            {!r.처리시각 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={메모[r.id] ?? ''}
                  onChange={(e) => set메모((m) => ({ ...m, [r.id]: e.target.value }))}
                  placeholder="처리 메모 (비워도 됩니다)"
                  className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-4 py-3 text-lg
                             dark:border-gray-700 dark:bg-gray-950"
                />
                <button
                  type="button" onClick={() => 처리(r.id)} disabled={busy === r.id}
                  className="shrink-0 rounded-md bg-gray-900 px-6 py-3 text-btn font-bold text-white
                             disabled:opacity-50"
                >
                  {busy === r.id ? '처리 중…' : '처리 완료'}
                </button>
              </div>
            )}
            {r.처리메모 && (
              <p className="mt-2 break-keep text-sm text-mute">처리 메모 — {r.처리메모}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
