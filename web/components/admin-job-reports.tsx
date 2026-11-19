'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { browserSupabase } from '@/lib/supabase-browser';
import { AdminReportDecide } from '@/components/admin-report-decide';
import { useToast } from '@/app/toast';
import { AdminBadge, AdminSection, 관 } from '@/components/rapo/rapo-admin-ui';

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
  /* 결정·안내 (2026-11-15) — 목록 창구에 없어 표에서 따로 (관리자 읽기 정책 · 금고 SQL_1113/ZR) */
  const [결정들, set결정들] = useState<Record<number, { 결정: string | null; 안내: string | null }>>({});
  useEffect(() => {
    const ids = (rows ?? []).map((r) => r.id);
    if (!ids.length) return;
    browserSupabase().from('공고신고').select('id,결정,안내').in('id', ids).then(({ data }) =>
      set결정들(Object.fromEntries(((data ?? []) as unknown as { id: number; 결정: string | null; 안내: string | null }[]).map((x) => [x.id, x]))));
  }, [rows]);

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
    /* 2026-11-19 — 새 관리자 디자인(AdminSection · 흰 목록 카드)으로 다시 입혔습니다 */
    <AdminSection title="공고 오류 신고"
      right={rows ? <span className={관.sub}>처리 안 한 것 {안끝난것}건</span> : undefined}>
      <p className={관.muted + ' -mt-[8px] break-keep'}>
        회원이 「이 공고에 잘못된 내용이 있어요」로 보낸 것입니다.
        공고를 고치거나 내리는 것은 「공고」 화면에서 하고, 여기서는 읽고 처리 표시만 합니다.
        처리 안 한 건수는 하루 한 번 오는 요약 메일에도 들어갑니다.
      </p>

      <div className="flex flex-wrap items-center gap-[16px]">
        <label className={관.body + ' flex items-center gap-[8px] font-bold'}>
          <input type="checkbox" checked={처리전만} className="size-[18px] accent-[#112231]"
                 onChange={(e) => set처리전만(e.target.checked)} />
          처리 안 한 것만
        </label>
      </div>

      {err && (
        <p className={관.error + ' break-keep'}>
          불러오지 못했어요 — {err}
        </p>
      )}
      {rows === null && !err && <p className={관.muted}>불러오는 중…</p>}
      {rows && rows.length === 0 && !err && (
        <p className={관.cardTight + ' ' + 관.empty}>
          {처리전만 ? '처리할 신고가 없습니다' : '신고가 아직 없습니다'}
        </p>
      )}

      {(rows ?? []).length > 0 && (
      <ul className={관.list}>
        {(rows ?? []).map((r) => (
          <li key={r.id} className={관.row + (r.처리시각 ? ' bg-[#f6f8f9]' : '')}>
            <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[6px]">
              {r.처리시각
                ? <AdminBadge tone="ok">처리 {때(r.처리시각)}</AdminBadge>
                : <AdminBadge tone="warn">처리 안 함</AdminBadge>}
              {r.이공고신고수 > 1 && (
                <AdminBadge tone="coral">이 공고에 신고 {r.이공고신고수}건</AdminBadge>
              )}
              {r.내린것 && <AdminBadge tone="neutral">이미 내려간 공고</AdminBadge>}
              <span className={관.sub}>{때(r.신고시각)} · 보낸이 {r.신고한사람}</span>
            </div>

            <p className={관.h3 + ' mt-[10px] break-keep'}>
              {r.기관 ?? '(지워진 공고)'} — {r.제목 ?? r.job_id}
            </p>
            <p className={관.body + ' mt-[6px] whitespace-pre-wrap break-keep'}>{r.사유}</p>

            <div className="mt-[8px] flex flex-wrap items-center gap-x-[16px]">
              <Link href={`/jobs/${r.job_id}`} className={관.btnText}>
                우리 화면에서 보기 ↗
              </Link>
              <Link href={`/admin/jobs/${r.job_id}`} className={관.btnText}>
                관리자 화면에서 고치기 →
              </Link>
              {r.주소 && (
                <a href={r.주소} target="_blank" rel="noopener noreferrer"
                   className={관.btnText}>
                  기관 원문 열기 ↗
                </a>
              )}
            </div>

            {!r.처리시각 && (
              <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
                <input
                  value={메모[r.id] ?? ''}
                  onChange={(e) => set메모((m) => ({ ...m, [r.id]: e.target.value }))}
                  placeholder="처리 메모 (비워도 됩니다)"
                  className={관.input + ' flex-1 basis-[200px]'}
                />
                <button
                  type="button" onClick={() => 처리(r.id)} disabled={busy === r.id}
                  className={관.btn}
                >
                  {busy === r.id ? '처리 중…' : '처리 완료'}
                </button>
              </div>
            )}
            {(!r.처리시각 || 결정들[r.id]?.결정) && (
              <AdminReportDecide 무엇="공고" id={r.id} 결정={결정들[r.id]?.결정} 안내={결정들[r.id]?.안내} onDone={() => load(처리전만)} />
            )}
            {r.처리메모 && (
              <p className={관.sub + ' mt-[8px] break-keep'}>처리 메모 — {r.처리메모}</p>
            )}
          </li>
        ))}
      </ul>
      )}
    </AdminSection>
  );
}
