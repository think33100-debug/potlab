'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { 문의갈래 } from '@/lib/inquiry';
import { useToast } from '../../toast';

/* 문의 (2026-11-02 세중님 · 앱 안 문의 폼의 관리자 쪽).
 *
 * ── 창구가 아직 없습니다 ────────────────────────────────────
 * `admin_문의목록()` · `admin_문의처리()` 는 docs/승인대기_1102.md ㉠ 에
 * 전문이 올라가 있고 **승인을 기다립니다.** 그래서 지금 이 화면을 열면
 * 「못 불러왔어요 — … does not exist」가 뜹니다. 그게 맞는 상태입니다.
 *
 * ── 상태 셋 ─────────────────────────────────────────────────
 * 받음 → 처리중 → 끝. 「끝」을 눌러야 처리한때가 찍히고, 그때부터
 * 1년 뒤에 치우는 시계가 돕니다 (처리방침 「문의 메일 → 답을 드린 뒤 1년」).
 * 신고 화면과 같은 꼴입니다 (app/admin/reports/page.tsx).
 */

type 줄 = {
  id: number; 갈래: string; 글: string; 공고주소: string | null; 답받을메일: string | null;
  상태: string; 처리메모: string | null; 처리한때: string | null;
  낸때: string; 낸사람: string;
};

const 때 = (s: string | null) =>
  s ? new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '-';

const 갈래이름 = (v: string) => 문의갈래.find((x) => x.값 === v)?.이름 ?? v;

export default function AdminInquiries() {
  const toast = useToast();
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [처리전만, set처리전만] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  /* 한 번에 50줄씩 옵니다 — 쪽을 넘겨 다 받습니다 (지침 8-20 ③) */
  const load = useCallback(async (만: boolean) => {
    const 쪽크기 = 50;
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 < 50; 쪽++) {
      const { data, error } = await browserSupabase()
        .rpc('admin_문의목록', { p_처리전만: 만, p_page: 쪽 });
      if (error) { setErr(error.message); setRows(모두); return; }
      const 받은것 = (data ?? []) as 줄[];
      모두.push(...받은것);
      if (받은것.length < 쪽크기) break;
    }
    setErr(null);
    setRows(모두);
  }, []);

  useEffect(() => { load(처리전만); }, [load, 처리전만]);

  const 바꾸기 = async (id: number, 상태: '받음' | '처리중' | '끝') => {
    const 메모 = 상태 === '끝'
      ? (prompt('처리 메모를 남기시겠어요? (비워도 됩니다)') ?? undefined)
      : undefined;
    setBusy(id);
    const { error } = await browserSupabase()
      .rpc('admin_문의처리', { p_id: id, p_상태: 상태, p_메모: 메모 || null });
    setBusy(null);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast(상태 === '끝' ? '끝으로 표시했어요. 1년 뒤 자동으로 지워집니다' : `${상태}으로 바꿨어요`,
      { ms: 4000 });
    load(처리전만);
  };

  const 안끝난것 = (rows ?? []).filter((r) => r.상태 !== '끝').length;

  return (
    <div>
      <h2 className="text-h3 font-bold">문의</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        앱 안 「문의하기」로 들어온 글입니다. 읽고 「끝」을 눌러주세요 —
        눌러야 1년 뒤 자동으로 지워집니다
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { on: true, label: '안 끝난 것' },
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
          <span className="mt-2 block text-sm">
            창구(admin_문의목록)가 아직 DB 에 없으면 이 글이 맞습니다 —
            docs/승인대기_1102.md ㉠ 이 올라가면 돕니다
          </span>
        </p>
      )}
      {rows === null && <p className="mt-6 text-lg text-mute">잠시만요…</p>}

      {rows !== null && rows.length === 0 && !err && (
        <div className="mt-6 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
          <p className="break-keep text-lg font-bold">문의가 없어요</p>
          <p className="mt-2 break-keep text-lg text-mute">
            {처리전만 ? '안 끝난 문의가 없습니다' : '아직 문의가 한 건도 없습니다'}
          </p>
        </div>
      )}

      {(rows ?? []).length > 0 && (
        <>
          {안끝난것 > 0 && (
            <p className="mt-6 rounded-sm bg-brand-red-soft p-5 text-lg font-bold text-brand-red-dark">
              안 끝난 문의가 <span className="num tabular-nums">{안끝난것}</span>건 있어요
            </p>
          )}
          <ul className="mt-6 space-y-3">
            {(rows ?? []).map((r) => (
              <li key={r.id}
                className={'rounded-sm border p-5 '
                  + (r.상태 === '끝'
                    ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'
                    : 'border-brand-red/40')}>
                <p className="flex flex-wrap items-baseline gap-x-3 text-lg">
                  <span className="rounded-xs bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                    {갈래이름(r.갈래)}
                  </span>
                  <span className="num tabular-nums text-mute">{때(r.낸때)}</span>
                  <span className={'text-sm font-bold '
                    + (r.상태 === '끝' ? 'text-mute' : 'text-brand-red')}>
                    {r.상태}
                  </span>
                  <span className="text-sm text-mute">낸 사람 {r.낸사람}</span>
                </p>

                <p className="mt-2 whitespace-pre-wrap break-words text-lg">{r.글}</p>

                {r.공고주소 && (
                  <p className="mt-2 break-all text-lg text-gray-600 dark:text-gray-400">
                    <span className="font-bold">공고 주소</span> — {r.공고주소}
                  </p>
                )}
                {r.답받을메일 && (
                  <p className="mt-1 break-all text-lg text-gray-600 dark:text-gray-400">
                    <span className="font-bold">답 받을 메일</span> — {r.답받을메일}
                  </p>
                )}
                {r.처리메모 && (
                  <p className="mt-1 break-keep text-sm text-mute">
                    처리 메모 — {r.처리메모}
                    {r.처리한때 && ` · ${때(r.처리한때)}`}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {(['받음', '처리중', '끝'] as const)
                    .filter((s) => s !== r.상태)
                    .map((s) => (
                      <button key={s} type="button" onClick={() => 바꾸기(r.id, s)}
                        disabled={busy === r.id}
                        className={'rounded-md px-6 py-4 text-lg font-bold disabled:opacity-40 '
                          + (s === '끝'
                            ? 'bg-teal-strong text-white hover:opacity-90'
                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')}>
                        {busy === r.id ? '바꾸는 중…' : `${s}으로`}
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
