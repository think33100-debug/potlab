'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, AdminSearchField, AdminSection, 관 } from '@/components/rapo/rapo-admin-ui';

/* 개인정보 접속기록 — 관리자가 회원 개인정보를 만진 기록 (2026-10-01).
 *
 * ── 왜 있나 ──────────────────────────────────────────────────
 * 「개인정보의 안전성 확보조치 기준」 제8조 —
 *   · 접속기록을 **1년 이상** 보관·관리
 *   · **월 1회 이상 점검**
 * 점검을 하려면 볼 화면이 있어야 해서 만들었습니다.
 *
 * 우리는 1년입니다. 2년이 되는 세 경우(5만명 이상 / 고유식별정보·민감정보 /
 * 기간통신사업자)에 하나도 해당하지 않습니다.
 * **회원이 5만 명을 넘으면 2년으로 바꿔야 합니다.**
 *
 * ── 기록이 남는 자리 ─────────────────────────────────────────
 *   admin_회원정보보기()  급여 · 스펙 · 어학을 봤을 때
 *   admin_탈퇴이름()      탈퇴 회원의 원래 닉네임을 열었을 때
 *   admin_신고처리()      신고를 처리 완료로 바꿨을 때
 *
 * 관리자가 급여·스펙·어학 표를 **기록 없이 바로 읽던 권한은 없앴습니다.**
 * 그래서 이 화면에 안 나오는 조회는 일어날 수 없습니다.
 *
 * ── 접속지(IP) 가 비어 있는 줄 ───────────────────────────────
 * 화면을 거쳐 부르면 들어옵니다. 데이터베이스에서 직접 SQL 로 부르면
 * 헤더가 없어 비어 있습니다. 「(모름)」 으로 보여줍니다.
 */

type 줄 = {
  언제: string;
  누가: string;
  어디서: string | null;
  무엇: string;
  어느표: string;
  누구것: string | null;
  누구: string | null;
  몇명: number | null;
};

const 때 = (s: string) =>
  new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export default function AdminAccessLog() {
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  /* ★ 한 번에 100줄만 옵니다 — Supabase 가 거기서 자릅니다.
     limit 을 키워도 안 되고 오류도 안 납니다 (2026-10-04 에 재서 찾았습니다).
     **개인정보 접속 기록**이라 잘려 보이면 안 되는 자리입니다.
     그래서 100줄씩 쪽을 넘겨 받습니다. 함수에 p_page 를 더해 뒀습니다.

     ⚠ `p_page` 를 **반드시 넘겨야** 합니다. 안 넘기면 PostgREST 가
       인자 없는 옛 함수(한 번에 500을 달라다가 100에서 잘리던 것)를
       부릅니다. 옛 함수는 아직 지우지 않았습니다 — 세중님 결정 대기. */
  const load = useCallback(async () => {
    const 쪽크기 = 100;
    const 최대 = 500;              // 전에 적어 둔 수를 그대로 지킵니다
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 * 쪽크기 < 최대; 쪽++) {
      const { data, error } = await browserSupabase().rpc('admin_접속기록', { p_page: 쪽 });
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
    return rows.filter((r) =>
      [r.누가, r.무엇, r.어느표, r.누구 ?? '', r.누구것 ?? '', r.어디서 ?? '']
        .join(' ').includes(k));
  }, [rows, q]);

  /* 이번 달에 몇 건이나 봤나 — 점검할 때 먼저 보는 숫자입니다 */
  const 이번달 = useMemo(() => {
    if (!rows) return 0;
    const 이달 = new Date().toISOString().slice(0, 7);
    return rows.filter((r) => r.언제.slice(0, 7) === 이달).length;
  }, [rows]);

  /* 2026-11-19 — 새 관리자 디자인(검색칸 · 흰 표)으로 다시 입혔습니다 */
  return (
    <div className="max-w-[1100px]">
      <RapoAdminHeader title="개인정보 접속기록" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        관리자가 회원의 급여·스펙·어학이나 탈퇴 회원의 원래 이름을 열어본 기록입니다.
        법이 <span className="font-bold text-[#112231]">월 1회 이상 점검</span>하라고 합니다
        (개인정보의 안전성 확보조치 기준 제8조)
      </p>

      <div className={관.info + ' break-keep'}>
        <p>
          이번 달 <b className="num tabular-nums text-[#112231]">{이번달}</b>건 ·
          최근 <b className="num tabular-nums text-[#112231]">{rows?.length ?? 0}</b>건을 보여줍니다
          (최대 500)
        </p>
        <p className="mt-[4px] text-[13px] text-[#555d6d]">
          보관 기간 <span className="font-bold">1년</span> — 매일 밤 11시에 1년 지난 것을 지웁니다.
          회원이 5만 명을 넘으면 2년으로 바꿔야 합니다
        </p>
      </div>

      <div className="mt-[24px]">
        <AdminSearchField value={q} onChange={setQ} label="찾기 (회원번호·닉네임·무엇·어느 표)"
          placeholder="예: 급여 · 탈퇴이름 · #00003" />
      </div>

      <AdminSection title="접속 기록" className="mt-[32px]">
        {err && (
          <p role="alert" className={관.error}>못 불러왔어요 — {err}</p>
        )}

        {rows === null && <p className={관.muted}>잠시만요…</p>}

        {rows !== null && 보일것.length === 0 && (
          <div className={관.card}>
            <p className={관.h3 + ' break-keep'}>기록이 없어요</p>
            <p className={관.muted + ' mt-[6px] break-keep'}>
              {q
                ? '찾는 말과 맞는 줄이 없어요'
                : '아직 아무도 회원 개인정보를 열어보지 않았어요. 비어 있는 것이 정상입니다'}
            </p>
          </div>
        )}

        {보일것.length > 0 && (
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[760px]'}>
              <thead className={관.thead}>
                <tr>
                  <th className={관.th}>언제</th>
                  <th className={관.th}>누가</th>
                  <th className={관.th}>무엇</th>
                  <th className={관.th}>어느 표 · 누구 것</th>
                  <th className={관.th}>접속지</th>
                </tr>
              </thead>
              <tbody>
                {보일것.map((r, i) => (
                  <tr key={r.언제 + i} className={관.tr}>
                    <td className={관.td + ' num whitespace-nowrap tabular-nums'}>{때(r.언제)}</td>
                    <td className={관.tdMain + ' text-[14px]'}>{r.누가}</td>
                    <td className={관.td}><AdminBadge tone="neutral">{r.무엇}</AdminBadge></td>
                    <td className={관.td + ' break-keep'}>
                      {r.어느표}
                      {r.누구것 && (
                        <span className="block text-[13px]">
                          누구 것 — <span className="font-bold text-[#112231]">{r.누구 ?? r.누구것}</span>
                        </span>
                      )}
                      {r.몇명 != null && r.몇명 > 1 && (
                        <span className="block text-[13px]">
                          한 번에 <span className="num tabular-nums">{r.몇명}</span>명
                        </span>
                      )}
                    </td>
                    <td className={관.td + ' text-[13px]'}>
                      {r.어디서 ?? '(모름 — 데이터베이스에서 직접 부른 것)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </div>
  );
}
