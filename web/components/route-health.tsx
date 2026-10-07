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

/* 회원 화면에 있으면 안 될 공고가 새는지 — pub_leak() 이 셉니다.
   2026-09-28 에 마감 지난 공고 192건이 회원 화면에 떠 있었습니다.
   가장 오래된 것은 173일째였고 **아무도 몰랐습니다.**
   감추는 규칙을 고치는 것만으로는 부족해서 셈을 따로 보여줍니다. */
type Leak = {
  '마감 지남': number;
  '신호 없이 30일 넘음': number;
  '정찰이 살아있다고 보는 중': number;
  '마감 지남 · 물리치료사': number;
  '마감 지남 · 작업치료사': number;
  '가장 오래전 마감': string | null;
  '며칠째': number;
  '회원 화면 전체': number;
  샘: boolean;
};

function 샘경보({ leak }: { leak: Leak }) {
  const 칸 = [
    { 이름: '마감이 지났는데 보임', 수: leak['마감 지남'],
      덧: `물리치료사 ${leak['마감 지남 · 물리치료사']} · 작업치료사 ${leak['마감 지남 · 작업치료사']}`
        + (leak['가장 오래전 마감'] ? ` · 가장 오래된 것 ${leak['가장 오래전 마감']} 마감 (${leak['며칠째']}일째)` : '') },
    { 이름: '신호 없이 30일 넘었는데 보임', 수: leak['신호 없이 30일 넘음'], 덧: '' },

  ].filter((x) => x.수 > 0);

  return (
    <div role="alert" className="mb-6 rounded-[14px] border-2 border-[#FF3B30] bg-[#FFF1F0] p-5">
      <p className="break-keep text-[15px] font-bold text-[#FF3B30]">
        회원 화면에 있으면 안 될 공고가 {칸.reduce((a, x) => a + x.수, 0)}건 있어요
      </p>
      <ul className="mt-3 space-y-2">
        {칸.map((x) => (
          <li key={x.이름} className="break-keep text-[14px] text-[#1B2025]">
            <span className="font-bold">{x.이름}</span>
            {' — '}
            <span className="num tabular-nums">{x.수}</span>
            건
            {x.덧 && <span className="block text-[13px] text-[#5F666C]">{x.덧}</span>}
          </li>
        ))}
      </ul>
      {/* 무엇을 해야 하는지 한 줄 — 빨간 줄만 보고 무엇을 할지 모르면 소용없습니다 */}
      <p className="mt-3 break-keep text-[13px] leading-relaxed text-[#5F666C]">
        감추는 규칙(hide_stale_posts)이 안 돌았거나 다리가 숨김을 되돌린 것이에요.
        다리를 한 번 더 돌려 보고, 그래도 남으면 규칙을 봐야 해요.
        회원 화면 전체 <span className="num tabular-nums">{leak['회원 화면 전체']}</span>건 중입니다.
      </p>
    </div>
  );
}

/* 수집기가 제때 돌았나 — beat_health() 가 셉니다 (2026-09-28).
   GitHub Actions 예약 실행이 3~6시간씩 밀려도 아무도 몰랐습니다.
   그래서 수집기를 서울 서버 cron 으로 옮기면서, 한 바퀴 돌 때마다 박동을 남기고
   **화면이 밖에서** 그걸 봅니다. 서버 안에서 보는 감시는 서버가 죽으면 같이 죽습니다. */
type Beat = {
  경로: string; 이름: string; 마지막: string | null;
  몇시간째: number | null; 평소간격시간: number | null; 기대간격시간: number | null;
  마지막탈: string; 빨간줄: boolean; 왜: string;
};

function 박동경보({ beats }: { beats: Beat[] }) {
  return (
    <div role="alert" className="mb-6 rounded-[14px] border-2 border-[#FF3B30] bg-[#FFF1F0] p-5">
      <p className="break-keep text-[15px] font-bold text-[#FF3B30]">
        수집기가 제때 안 돈 곳이 {beats.length}곳 있어요
      </p>
      <ul className="mt-3 space-y-2">
        {beats.map((b) => (
          <li key={b.경로} className="break-keep text-[14px] text-[#1B2025]">
            <span className="font-bold">{b.이름}</span>
            {' — '}
            {b.왜}
            {b.몇시간째 != null && (
              <>
                {' · '}
                <span className="num tabular-nums">{b.몇시간째}</span>
                시간째
              </>
            )}
            {/* 왜 빨간지 — 근거를 같이 보여줘야 다음 사람이 기준을 안 고칩니다 */}
            <span className="block text-[13px] text-[#5F666C]">
              {b.평소간격시간 != null && b.평소간격시간 > 0 && (
                <>
                  {'평소 '}
                  <span className="num tabular-nums">{b.평소간격시간}</span>
                  {'시간에 한 번 · 기준 '}
                  <span className="num tabular-nums">{b.기대간격시간}</span>
                  {'시간'}
                </>
              )}
              {b.마지막탈 && <span className="block">{'마지막 탈 — ' + b.마지막탈}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 break-keep text-[13px] leading-relaxed text-[#5F666C]">
        서버가 멈췄거나 cron 이 안 돈 것이에요. 서울 서버에 들어가
        <span className="font-bold">{' journalctl -u potjob-hosp -n 50 '}</span>
        을 봐 주세요.
      </p>
    </div>
  );
}

/* 처음 보는 코드 값 (2026-10-07 세중님).
   회원 화면에는 「공고문 참고」 로 나가고 **여기서만** 영문을 보여 줍니다.
   워크넷 10·20 이 90건 샜던 자리라, 다음에는 새기 전에 보이게 둡니다 */
type 모르는코드 = {
  있나: boolean; 가짓수: number; 공고수: number; 회원화면에보이는것: number;
  줄: { 칸: string; 출처: string; 값: string; 공고수: number; 살아있음: number }[];
};

function 코드경보({ 코드 }: { 코드: 모르는코드 }) {
  return (
    <div role="alert" className="mb-6 rounded-[14px] border-2 border-[#FF9500] bg-[#FFF8EF] p-5">
      <p className="break-keep text-[15px] font-bold text-[#B36200]">
        처음 보는 코드 값이 {코드.가짓수}가지 있어요 (공고 {코드.공고수}건)
      </p>
      <ul className="mt-3 space-y-2">
        {코드.줄.map((x) => (
          <li key={x.칸 + x.출처 + x.값} className="break-keep text-[14px] text-[#1B2025]">
            <span className="font-bold">{x.값}</span>
            {' — '}{x.출처}{' · '}{x.칸}{' · 공고 '}
            <span className="num tabular-nums">{x.공고수}</span>{'건'}
            {x.살아있음 > 0 && (
              <span className="block text-[13px] text-[#B36200]">
                {'그중 '}<span className="num tabular-nums">{x.살아있음}</span>
                {'건이 회원 화면에 있어요 (「공고문 참고」 로 보입니다)'}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 break-keep text-[13px] leading-relaxed text-[#5F666C]">
        회원 화면에는 영문이 안 나갑니다 — 한글이 없는 값은 비워서 「공고문 참고」 로
        보입니다. 뜻을 알아내면 수집기의 코드표(예: tools/hosp/jobflex.mjs 의
        경력조건)와 DB 의 고용형태보임() 에 한 줄씩 더해 주세요.
      </p>
    </div>
  );
}

export function RouteHealth() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [leak, setLeak] = useState<Leak | null>(null);
  const [beats, setBeats] = useState<Beat[] | null>(null);
  const [코드, set코드] = useState<모르는코드 | null>(null);

  useEffect(() => {
    let 살아있나 = true;
    browserSupabase()
      .rpc('route_health')
      .then(({ data, error }) => {
        if (!살아있나) return;
        setRows(error ? [] : ((data ?? []) as Row[]));
      });
    browserSupabase()
      .rpc('pub_leak')
      .then(({ data, error }) => {
        if (!살아있나) return;
        setLeak(error ? null : (data as Leak));
      });
    browserSupabase()
      .rpc('beat_health')
      .then(({ data, error }) => {
        if (!살아있나) return;
        setBeats(error ? [] : ((data ?? []) as Beat[]));
      });
    browserSupabase()
      .rpc('모르는코드')
      .then(({ data, error }) => {
        if (!살아있나) return;
        set코드(error ? null : (data as 모르는코드));
      });
    return () => { 살아있나 = false; };
  }, []);

  /* 확인 중에는 아무것도 안 그립니다 */
  if (rows === null) return null;

  const 샘 = leak && leak.샘 ? <샘경보 leak={leak} /> : null;
  const 늦은것 = (beats || []).filter((b) => b.빨간줄);
  const 박동 = 늦은것.length ? <박동경보 beats={늦은것} /> : null;
  const 코드띠 = 코드 && 코드.있나 ? <코드경보 코드={코드} /> : null;
  const 빨간것 = rows.filter((r) => r.빨간줄);
  if (!빨간것.length) {
    return (박동 || 샘 || 코드띠) ? <>{박동}{샘}{코드띠}</> : null;
  }

  return (
    <>
    {박동}
    {샘}
    {코드띠}
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
    </>
  );
}
