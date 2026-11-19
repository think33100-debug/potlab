'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { 문의갈래 } from '@/lib/inquiry';
import { useToast } from '../../toast';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, 관, 칩꼴 } from '@/components/rapo/rapo-admin-ui';

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

  /* 2026-11-19 — 새 관리자 디자인(칩 · 흰 목록 카드 · 상태 배지)으로 다시 입혔습니다 */
  return (
    <div className="max-w-[1100px]">
      <RapoAdminHeader title="문의" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        앱 안 「문의하기」로 들어온 글입니다. 읽고 「끝」을 눌러주세요 —
        눌러야 1년 뒤 자동으로 지워집니다
      </p>

      <div className="flex flex-wrap gap-[8px]">
        {[
          { on: true, label: '안 끝난 것' },
          { on: false, label: '전체' },
        ].map((t) => (
          <button key={String(t.on)} type="button"
            onClick={() => set처리전만(t.on)}
            aria-pressed={처리전만 === t.on}
            className={칩꼴(처리전만 === t.on)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-[16px] flex flex-col gap-[16px]">
        {err && (
          <p role="alert" className={관.error}>
            못 불러왔어요 — {err}
            <span className="mt-[6px] block text-[13px]">
              창구(admin_문의목록)가 아직 DB 에 없으면 이 글이 맞습니다 —
              docs/승인대기_1102.md ㉠ 이 올라가면 돕니다
            </span>
          </p>
        )}
        {rows === null && <p className={관.muted}>잠시만요…</p>}

        {rows !== null && rows.length === 0 && !err && (
          <div className={관.card}>
            <p className={관.h3 + ' break-keep'}>문의가 없어요</p>
            <p className={관.muted + ' mt-[6px] break-keep'}>
              {처리전만 ? '안 끝난 문의가 없습니다' : '아직 문의가 한 건도 없습니다'}
            </p>
          </div>
        )}

        {(rows ?? []).length > 0 && (
          <>
            {안끝난것 > 0 && (
              <p className={관.error + ' font-bold'}>
                안 끝난 문의가 <span className="num tabular-nums">{안끝난것}</span>건 있어요
              </p>
            )}
            <ul className={관.list}>
              {(rows ?? []).map((r) => (
                <li key={r.id} className={관.row + (r.상태 === '끝' ? ' bg-[#f6f8f9]' : '')}>
                  <p className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
                    <AdminBadge tone="neutral">{갈래이름(r.갈래)}</AdminBadge>
                    <AdminBadge tone={r.상태 === '끝' ? 'ok' : r.상태 === '처리중' ? 'info' : 'warn'}>{r.상태}</AdminBadge>
                    <span className={관.sub + ' num tabular-nums'}>{때(r.낸때)} · 낸 사람 {r.낸사람}</span>
                  </p>

                  <p className={관.body + ' mt-[10px] whitespace-pre-wrap break-words text-[16px] leading-[22px]'}>{r.글}</p>

                  {r.공고주소 && (
                    <p className={관.muted + ' mt-[6px] break-all'}>
                      <span className="font-bold text-[#304f65]">공고 주소</span> — {r.공고주소}
                    </p>
                  )}
                  {r.답받을메일 && (
                    <p className={관.muted + ' mt-[4px] break-all'}>
                      <span className="font-bold text-[#304f65]">답 받을 메일</span> — {r.답받을메일}
                    </p>
                  )}
                  {r.처리메모 && (
                    <p className={관.sub + ' mt-[4px] break-keep'}>
                      처리 메모 — {r.처리메모}
                      {r.처리한때 && ` · ${때(r.처리한때)}`}
                    </p>
                  )}

                  <div className="mt-[12px] flex flex-wrap gap-[8px]">
                    {(['받음', '처리중', '끝'] as const)
                      .filter((s) => s !== r.상태)
                      .map((s) => (
                        <button key={s} type="button" onClick={() => 바꾸기(r.id, s)}
                          disabled={busy === r.id}
                          className={s === '끝' ? 관.btn : 관.btnLine}>
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
    </div>
  );
}
