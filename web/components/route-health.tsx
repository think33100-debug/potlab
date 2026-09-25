'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 조용한 실패를 잡는 빨간 줄 (2026-09-25).

   ── 기준을 경로마다 다르게 (2026-09-25 밤) ───────────────────
   전에는 「사흘 연속 0건」 하나로 모든 경로를 봤습니다. 그래서 나라일터·
   클린아이에 빨간 줄이 떴는데, 현직자 확인 결과 **고장이 아니라 원래
   공고가 드문 것**이었습니다. 시끄러우면 아무도 안 봅니다.

   지금은 경로마다 「지금까지 가장 오래 쉰 것의 두 배」를 기준으로 삼고,
   그 경로를 5번 넘게 못 봤으면 판단을 미룹니다. 자세한 것은 DB 의
   route_health() 주석에 적었습니다 — **판정은 거기서 합니다.**

   ── 왜 ────────────────────────────────────────────────────────
   2026-09-25 하루에 네 가지를 우연히 발견했습니다 —
   clasp 로그인 만료(9/20부터 올리기가 조용히 실패) · 병원 홈페이지 47곳이
   9/17에 통째로 꺼짐 · 나라일터가 본문을 주는데 「안 준다」고 적혀 있던 주석 ·
   결과발표 공고가 회원 화면에 노출.
   전부 누가 우연히 볼 때까지 몰랐습니다. 매일 스스로 재게 합니다.

   ── 근거를 같이 보여줍니다 ───────────────────────────────────
   「평소 ○일에 한 번 · 가장 오래 쉰 것 ○일 · 지금 ○일째」
   숫자만 보여주고 왜인지 안 알려주면 다음 사람이 또 기준을 고칩니다.

   ── 불러오는 동안은 아무것도 안 그립니다 ─────────────────────
   0.2초 사이에 「이상 없음」이나 「이상 있음」을 잘못 보여주면 안 됩니다.
   다 받은 뒤에만 그립니다. */

type Row = {
  경로: string;
  마지막: string | null;
  며칠째: number | null;
  평소간격: number | null;   // 공고가 온 날 사이 틈의 중앙값
  가장긴틈: number | null;
  본틈: number | null;       // 틈을 몇 번 봤나. 5 미만이면 판단을 미룹니다
  기준일: number | null;
  빨간줄: boolean;
  왜: string;
};

export function RouteHealth() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let 살아있나 = true;
    browserSupabase()
      .rpc('route_health')
      .then(({ data, error }) => {
        if (!살아있나) return;
        setRows(error ? [] : ((data ?? []) as Row[]));
      });
    return () => { 살아있나 = false; };
  }, []);

  /* 확인 중에는 아무것도 안 그립니다 */
  if (rows === null) return null;

  const 빨간것 = rows.filter((r) => r.빨간줄);
  if (!빨간것.length) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-[14px] border-2 border-[#FF3B30] bg-[#FFF1F0] p-5"
    >
      <p className="break-keep text-[15px] font-bold text-[#FF3B30]">
        공고가 안 들어오는 경로가 {빨간것.length}곳 있어요
      </p>

      <ul className="mt-3 space-y-2">
        {빨간것.map((r) => (
          <li key={r.경로} className="break-keep text-[14px] text-[#1B2025]">
            <span className="font-bold">{r.경로}</span>
            {' — '}
            <span className="num tabular-nums">{r.며칠째}</span>
            일째 안 옵니다
            {r.마지막 && (
              <>
                {' · 마지막 '}
                <span className="num tabular-nums">{r.마지막}</span>
              </>
            )}
            {/* 왜 빨간지 — 근거를 같이 보여줘야 다음 사람이 기준을 안 고칩니다 */}
            {r.평소간격 != null && r.평소간격 > 0 && (
              <span className="block text-[13px] text-[#5F666C]">
                {'평소 '}
                <span className="num tabular-nums">{r.평소간격}</span>
                {'일에 한 번'}
                {r.가장긴틈 != null && (
                  <>
                    {' · 가장 오래 쉰 것 '}
                    <span className="num tabular-nums">{r.가장긴틈}</span>
                    {'일'}
                  </>
                )}
                {r.기준일 != null && (
                  <>
                    {' · 기준 '}
                    <span className="num tabular-nums">{r.기준일}</span>
                    {'일'}
                  </>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* 어디를 봐야 하는지 한 줄. 이게 없으면 빨간 줄만 보고 무엇을 할지 모릅니다 */}
      <p className="mt-3 break-keep text-[13px] leading-relaxed text-[#5F666C]">
        수집기가 멈췄는지, 그 API 열쇠가 만료됐는지, 사이트가 막혔는지 봐야 해요.
        Apps Script 실행 기록과 GitHub Actions 를 먼저 확인해 주세요.
      </p>
    </div>
  );
}
