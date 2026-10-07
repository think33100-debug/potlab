'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 추천 올린 공고 (2026-10-07).
 *
 * ── 왜 기록이 남는가 ────────────────────────────────────────
 * 나중에 유료 광고 상품으로 이어질 자리입니다. 「누가 언제 왜」 가 남아야
 * 나중에 「이 공고는 돈을 받고 올린 것인가」를 답할 수 있습니다.
 * 그래서 DB 의 공고올림 표는 **줄을 지우지 않습니다** — 내릴 때
 * 「까지」를 어제로 바꾸고 끝낸 까닭·사람·때를 적습니다.
 *
 * ── 올리고 내리는 것은 여기서 안 합니다 ─────────────────────
 * 공고 화면(/jobs/[id])의 관리자 줄에서 합니다. 그 공고를 보면서
 * 정하는 일이라서요. 여기는 「무엇이 올라가 있나」를 보는 곳입니다.
 */

type 줄 = {
  id: number; job_id: string; 기관: string | null; 제목: string | null;
  순서: number; 부터: string; 까지: string | null; 왜: string;
  올린사람: string; 만든때: string;
  끝낸까닭: string | null; 끝낸사람: string | null; 끝낸때: string | null;
  지금도는가: boolean;
};

const 날 = (s: string | null) => (s ? s.slice(0, 10) : '끝 없음');
const 때 = (s: string | null) =>
  s ? new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '-';

export default function AdminBoost() {
  const toast = useToast();
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [지난것, set지난것] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [왜, set왜] = useState<Record<string, string>>({});

  const load = useCallback(async (과거: boolean) => {
    const { data, error } = await browserSupabase()
      .rpc('admin_올린공고목록', { p_지난것: 과거 });
    if (error) { setErr(error.message); setRows([]); return; }
    setErr(null);
    setRows((data ?? []) as 줄[]);
  }, []);

  useEffect(() => { load(지난것); }, [load, 지난것]);

  const 내리기 = async (job_id: string) => {
    const 글 = (왜[job_id] ?? '').trim();
    if (글.length < 2) { toast('왜 내리는지 적어 주세요', { tone: 'danger', ms: 3000 }); return; }
    setBusy(job_id);
    const { error } = await browserSupabase()
      .rpc('admin_공고내리기', { p_job: job_id, p_왜: 글 });
    setBusy(null);
    if (error) { toast(`내리지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast('추천에서 내렸어요', { ms: 3000 });
    load(지난것);
  };

  const 도는것 = (rows ?? []).filter((r) => r.지금도는가).length;

  return (
    <div>
      <h2 className="text-h3 font-bold">추천 올린 공고</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        공고 목록의 「추천순」 맨 위에 올라가는 공고입니다. 올리고 내리는 것은
        공고 화면의 관리자 줄에서 합니다 — 여기는 무엇이 올라가 있는지 보는 곳입니다.
        회원 화면에는 「추천」 이라고 표시됩니다.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-lg">
          <input type="checkbox" checked={지난것} onChange={(e) => set지난것(e.target.checked)} />
          지난 것도 보기
        </label>
        {rows && <span className="text-lg text-mute">지금 올라가 있는 것 {도는것}건</span>}
      </div>

      {err && (
        <p className="mt-5 break-keep text-lg text-brand-red">불러오지 못했어요 — {err}</p>
      )}
      {rows === null && !err && <p className="mt-5 text-lg text-mute">불러오는 중…</p>}
      {rows && rows.length === 0 && !err && (
        <p className="mt-5 break-keep text-lg text-mute">
          아직 올린 공고가 없습니다. 공고 화면의 관리자 줄에서 「추천순 올리기」 를 눌러 주세요
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="rounded-sm border border-line bg-card p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              {r.지금도는가
                ? <span className="text-sm font-bold text-interaction-blue">지금 올라가 있음</span>
                : <span className="text-sm text-mute">끝났음</span>}
              <span className="text-sm text-mute">· 순서 {r.순서}</span>
              <span className="text-sm text-mute">· {날(r.부터)} ~ {날(r.까지)}</span>
            </div>

            <p className="mt-2 break-keep text-body-lg font-medium">
              {r.기관 ?? '(지워진 공고)'} — {r.제목 ?? r.job_id}
            </p>
            <p className="mt-2 break-keep text-lg">왜 — {r.왜}</p>
            <p className="mt-1 break-keep text-sm text-mute">
              올린 사람 {r.올린사람} · {때(r.만든때)}
              {r.끝낸때 && (
                <span className="block">
                  끝낸 사람 {r.끝낸사람} · {때(r.끝낸때)}
                  {r.끝낸까닭 && ` · ${r.끝낸까닭}`}
                </span>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/jobs/${r.job_id}`} className="text-interaction-blue hover:underline">
                공고 보기
              </Link>
            </div>

            {r.지금도는가 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={왜[r.job_id] ?? ''}
                  onChange={(e) => set왜((m) => ({ ...m, [r.job_id]: e.target.value }))}
                  placeholder="왜 내리나요? (꼭 적습니다)"
                  className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-4 py-3 text-lg
                             dark:border-gray-700 dark:bg-gray-950"
                />
                <button
                  type="button" onClick={() => 내리기(r.job_id)} disabled={busy === r.job_id}
                  className="shrink-0 rounded-md bg-gray-900 px-6 py-3 text-btn font-bold text-white
                             disabled:opacity-50"
                >
                  {busy === r.job_id ? '내리는 중…' : '내리기'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
