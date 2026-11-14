'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 알림 신청 현황 (2026-11-14 세중님 「알람 신청 누른 사람들 다 한 곳에 볼 수 있나? 종류별로」 → 「현황 만들고」).

   종류마다 표가 달라(앱 출시 · 연봉 비교 · 관심 병원 · 공고 저장 · 교육 학회 · 봉사 · 청년 · 기기 알림) 한 곳에서 볼 길이 없었습니다.
   DB 의 admin_알림신청현황() 하나가 **사람 수와 마지막 신청 때만** 모아 줍니다 — 누가 신청했는지(회원 번호·연락처)는 이 화면에 안 옵니다.
   막는 자리는 DB 입니다 — 관리자가 아니면 함수가 「관리자만」만 돌려줍니다 (금고 SQL_1113/ZJ). */

type 종류 = { 이름: string; 사람: number; 최근: string | null; 덧?: string };
type 현황 = {
  왜?: string; 잰때?: string; 종류?: 종류[];
  학회별?: { 이름: string; 사람: number }[];
  지역별?: { 갈래: string; 이름: string; 사람: number }[];
};

const 때 = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '없음';

export default function AdminNotify() {
  const [값, set값] = useState<현황 | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await browserSupabase().rpc('admin_알림신청현황');
    if (error) { setErr(error.message); return; }
    setErr(null);
    set값((data ?? {}) as 현황);
  }, []);
  useEffect(() => { load(); }, [load]);

  const 종류들 = 값?.종류 ?? [];
  const 가장큰 = Math.max(1, ...종류들.map((x) => x.사람));

  return (
    <>
      <h2 className="text-h3 font-bold">알림 신청 현황</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        종류별로 알림을 신청한 사람 수예요. 누가 신청했는지는 여기에 나오지 않아요
      </p>

      {err && <p role="alert" className="mt-6 rounded-sm bg-brand-red-soft p-5 text-lg text-brand-red-dark">불러오지 못했어요 — {err}</p>}
      {값?.왜 && <p role="alert" className="mt-6 rounded-sm bg-brand-red-soft p-5 text-lg text-brand-red-dark">{값.왜} 볼 수 있어요</p>}
      {값 === null && !err && <p className="mt-6 text-lg text-mute">잠시만요…</p>}

      {종류들.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-mute">{때(값?.잰때)} 기준</p>
            <button type="button" onClick={load} className="rounded-md border border-gray-200 px-5 py-3 text-sm font-medium dark:border-gray-700">다시 세기</button>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {종류들.map((x) => (
              <li key={x.이름} className="rounded-sm border border-gray-200 p-5 dark:border-gray-700">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="min-w-0 break-keep text-lg font-bold">{x.이름}</p>
                  <p className="shrink-0 whitespace-nowrap text-h3 font-bold tabular-nums">{x.사람.toLocaleString('ko-KR')}<span className="ml-1 text-sm font-medium text-mute">명</span></p>
                </div>
                <div aria-hidden className="mt-3 h-[6px] rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-teal-strong" style={{ width: `${(x.사람 / 가장큰) * 100}%` }} />
                </div>
                <p className="mt-2 break-keep text-sm text-mute">
                  <span className="whitespace-nowrap">마지막 신청 {때(x.최근)}</span>
                  {x.덧 && <span className="whitespace-nowrap"> · {x.덧}</span>}
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mt-8 text-lg font-bold">교육 · 학회별</h3>
          {(값?.학회별 ?? []).length === 0
            ? <p className="mt-2 text-sm text-mute">아직 신청한 사람이 없어요</p>
            : (
              <ul className="mt-2">
                {(값?.학회별 ?? []).map((x) => (
                  <li key={x.이름} className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
                    <span className="min-w-0 break-keep">{x.이름}</span>
                    <span className="shrink-0 font-bold tabular-nums">{x.사람}명</span>
                  </li>
                ))}
              </ul>
            )}

          <h3 className="mt-8 text-lg font-bold">봉사 · 청년정책 지역별</h3>
          {(값?.지역별 ?? []).length === 0
            ? <p className="mt-2 text-sm text-mute">아직 신청한 사람이 없어요</p>
            : (
              <ul className="mt-2">
                {(값?.지역별 ?? []).map((x) => (
                  <li key={x.갈래 + x.이름} className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
                    <span className="min-w-0 break-keep">{x.갈래} · {x.이름 === '전남광주' ? '광주·전남' : x.이름}</span>
                    <span className="shrink-0 font-bold tabular-nums">{x.사람}명</span>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </>
  );
}
