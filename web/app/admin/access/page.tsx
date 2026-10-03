'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

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

  return (
    <div>
      <h2 className="text-h3 font-bold">개인정보 접속기록</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        관리자가 회원의 급여·스펙·어학이나 탈퇴 회원의 원래 이름을 열어본 기록입니다.
        법이 <span className="font-bold">월 1회 이상 점검</span>하라고 합니다
        (개인정보의 안전성 확보조치 기준 제8조)
      </p>

      <div className="mt-5 rounded-sm bg-badge-teal-bg p-5 dark:border dark:border-teal-strong/40 dark:bg-transparent">
        <p className="break-keep text-lg">
          이번 달 <span className="num tabular-nums font-bold">{이번달}</span>건 ·
          최근 <span className="num tabular-nums font-bold">{rows?.length ?? 0}</span>건을 보여줍니다
          (최대 500)
        </p>
        <p className="mt-2 break-keep text-sm text-mute">
          보관 기간 <span className="font-bold">1년</span> — 매일 밤 11시에 1년 지난 것을 지웁니다.
          회원이 5만 명을 넘으면 2년으로 바꿔야 합니다
        </p>
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-bold text-mute">찾기 (회원번호·닉네임·무엇·어느 표)</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: 급여 · 탈퇴이름 · #00003"
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

      {rows !== null && 보일것.length === 0 && (
        <div className="mt-6 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
          <p className="break-keep text-lg font-bold">기록이 없어요</p>
          <p className="mt-2 break-keep text-lg text-mute">
            {q
              ? '찾는 말과 맞는 줄이 없어요'
              : '아직 아무도 회원 개인정보를 열어보지 않았어요. 비어 있는 것이 정상입니다'}
          </p>
        </div>
      )}

      {보일것.length > 0 && (
        <ul className="mt-6 space-y-3">
          {보일것.map((r, i) => (
            <li key={r.언제 + i}
              className="rounded-sm border border-gray-200 p-5 dark:border-gray-700">
              <p className="flex flex-wrap items-baseline gap-x-3 text-lg">
                <span className="num tabular-nums text-mute">{때(r.언제)}</span>
                <span className="font-bold">{r.누가}</span>
                <span className="rounded-xs bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                  {r.무엇}
                </span>
              </p>
              <p className="mt-2 break-keep text-lg text-gray-600 dark:text-gray-400">
                {r.어느표}
                {r.누구것 && (
                  <span className="block text-sm">
                    누구 것 — <span className="font-bold">{r.누구 ?? r.누구것}</span>
                  </span>
                )}
                {r.몇명 != null && r.몇명 > 1 && (
                  <span className="block text-sm">
                    한 번에 <span className="num tabular-nums">{r.몇명}</span>명
                  </span>
                )}
                <span className="block text-sm text-mute">
                  접속지 {r.어디서 ?? '(모름 — 데이터베이스에서 직접 부른 것)'}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
