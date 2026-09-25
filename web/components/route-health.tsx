'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 조용한 실패를 잡는 빨간 줄 (2026-09-25).

   ── 왜 ────────────────────────────────────────────────────────
   2026-09-25 하루에 네 가지를 우연히 발견했습니다 —
   clasp 로그인 만료(9/20부터 올리기가 조용히 실패) · 병원 홈페이지 47곳이
   9/17에 통째로 꺼짐 · 나라일터가 본문을 주는데 「안 준다」고 적혀 있던 주석 ·
   결과발표 공고가 회원 화면에 노출.
   전부 누가 우연히 볼 때까지 몰랐습니다. 매일 스스로 재게 합니다.

   ── 언제 뜨나 ────────────────────────────────────────────────
   지난 14일 하루 평균이 0보다 큰 경로가 **사흘 연속 0건**이면 뜹니다.
   원래 조용한 경로(평균 0)는 안 울립니다 — 시끄러우면 아무도 안 봅니다.

   판정은 DB 함수 route_health() 가 합니다. 여기서 다시 세지 않습니다.

   ── 불러오는 동안은 아무것도 안 그립니다 ─────────────────────
   0.2초 사이에 「이상 없음」이나 「이상 있음」을 잘못 보여주면 안 됩니다.
   다 받은 뒤에만 그립니다. */

type Row = {
  경로: string;
  어제: number;
  십사일평균: number | null;
  연속0일: number;
  마지막: string | null;
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
            <span className="num tabular-nums">{r.연속0일}</span>
            일째 0건
            {r.마지막 && (
              <>
                {' · 마지막 '}
                <span className="num tabular-nums">{r.마지막}</span>
              </>
            )}
            {r.십사일평균 != null && r.십사일평균 > 0 && (
              <span className="text-[#5F666C]">
                {' (평소 하루 '}
                <span className="num tabular-nums">{r.십사일평균}</span>
                {'건)'}
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
