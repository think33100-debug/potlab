'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 수집기 상태 — 「돌고 있나」를 한 화면에서 (2026-10-02).
 *
 * ── 왜 만들었나 ───────────────────────────────────────────────
 * 수집기 여덟이 한 바퀴 돌 때마다 collect_beat() 로 기록을 남기고,
 * beat_health() 가 그걸 읽어 빨간줄을 세웁니다. **그런데 읽는 화면이
 * 없었습니다.** 함수는 있는데 아무도 안 봤습니다.
 *
 * 그래서 「수집기는 돌았는데 공고가 0건」과 「수집기가 아예 안 돌았다」를
 * 못 가렸습니다. 왼쪽 표가 그걸 가립니다.
 *
 * ── 표 둘이 보는 것이 다릅니다 ────────────────────────────────
 *   박동(beat_health)      수집기가 **돌았나**     — collector_beat 를 봅니다
 *   공고 흐름(수집기박동)    공고가 **들어왔나**    — job_posts 를 봅니다
 * 둘을 나란히 놓아야 「돌았는데 안 들어온다」가 보입니다.
 *
 * ── 빨간줄 기준 ───────────────────────────────────────────────
 * 판정은 DB 가 합니다 (beat_health 의 주석에 적혀 있습니다).
 * 여기서는 그 결과와 **근거 숫자**를 같이 보여줍니다 —
 * 숫자만 보여주고 왜인지 안 알려주면 다음 사람이 또 기준을 고칩니다.
 */

type 박동줄 = {
  경로: string;
  이름: string;
  마지막: string | null;
  몇시간째: number | null;
  평소간격시간: number | null;
  기대간격시간: number | null;
  마지막탈: string | null;
  빨간줄: boolean;
  왜: string | null;
};

type 흐름줄 = {
  수집기: string;
  지난24시간: number | null;
  '7일 하루평균': number | null;
  '알림선(평균의 절반)': number | null;
  '잰 날수': number | null;
  빨간줄: boolean;
  왜: string | null;
};

const 때 = (s: string | null) =>
  (s
    ? new Date(s).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '한 번도 없음');

const 수 = (n: number | null, 자리 = 1) => (n == null ? '-' : Number(n).toFixed(자리));

export default function AdminBeat() {
  const [박동, set박동] = useState<박동줄[] | null>(null);
  const [흐름, set흐름] = useState<흐름줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = browserSupabase();
    const [a, b] = await Promise.all([
      sb.rpc('beat_health'),
      sb.rpc('수집기박동'),
    ]);
    if (a.error) { setErr(a.error.message); set박동([]); } else { set박동((a.data ?? []) as 박동줄[]); }
    if (b.error) { setErr((p) => p ?? b.error!.message); set흐름([]); } else { set흐름((b.data ?? []) as 흐름줄[]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const 빨간것 = (박동 ?? []).filter((r) => r.빨간줄).length
    + (흐름 ?? []).filter((r) => r.빨간줄).length;

  return (
    <div>
      <h2 className="text-h3 font-bold">수집기 상태</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        수집기가 <span className="font-bold">돌았나</span>와 공고가{' '}
        <span className="font-bold">들어왔나</span>는 다릅니다. 둘을 나란히 놓습니다.
      </p>

      {err && <p className="mt-4 text-lg text-brand-red">{err}</p>}

      {박동 === null || 흐름 === null
        ? <p className="mt-6 text-lg text-mute">잠시만요…</p>
        : (
          <>
            <div className={'mt-5 rounded-sm p-5 '
              + (빨간것
                ? 'bg-brand-red-soft dark:border dark:border-brand-red/40 dark:bg-transparent'
                : 'bg-badge-green-bg dark:border dark:border-success/40 dark:bg-transparent')}>
              <p className="break-keep text-lg">
                {빨간것
                  ? <>빨간줄 <span className="num tabular-nums font-bold">{빨간것}</span>개 — 아래에서 보십시오</>
                  : <>빨간줄 없습니다. 수집기 {박동.length}곳이 제때 돌고 있습니다</>}
              </p>
            </div>

            <h3 className="mt-8 font-bold">① 돌았나 — 수집기가 남긴 박동</h3>
            <p className="mt-1 break-keep text-sm text-mute">
              한 바퀴 돌 때마다 <span className="font-bold">collect_beat()</span> 로 남깁니다.
              박동을 안 부르는 수집기는 실제로 돌아도 빨간줄이 섭니다
            </p>
            <div className="mt-3 overflow-x-auto rounded-sm border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">수집기</th>
                    <th className="px-3 py-2">마지막</th>
                    <th className="px-3 py-2 text-right">몇 시간째</th>
                    <th className="px-3 py-2 text-right">평소 간격</th>
                    <th className="px-3 py-2 text-right">기대 간격</th>
                    <th className="px-3 py-2">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {박동.map((r) => (
                    <tr key={r.경로} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-2">
                        <span className="font-bold">{r.이름}</span>
                        <span className="ml-1 text-xs text-mute">{r.경로}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{때(r.마지막)}</td>
                      <td className="num px-3 py-2 text-right tabular-nums">{수(r.몇시간째)}</td>
                      <td className="num px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{수(r.평소간격시간)}</td>
                      <td className="num px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{수(r.기대간격시간)}</td>
                      <td className="px-3 py-2">
                        {r.빨간줄
                          ? <span className="rounded px-2 py-0.5 text-xs font-bold bg-brand-red-soft text-brand-red-dark">{r.왜 || '늦었습니다'}</span>
                          : <span className="rounded bg-badge-green-bg px-2 py-0.5 text-xs text-gray-900">제때</span>}
                        {r.마지막탈 ? <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{r.마지막탈}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 font-bold">② 들어왔나 — 공고 흐름</h3>
            <p className="mt-1 break-keep text-sm text-mute">
              <span className="font-bold">지난 24시간</span> 새 공고가 7일 하루평균의 절반보다
              적으면 빨간줄입니다. 잰 날수가 모자라면 판단을 미룹니다
            </p>
            <div className="mt-3 overflow-x-auto rounded-sm border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">수집기</th>
                    <th className="px-3 py-2 text-right">지난 24시간</th>
                    <th className="px-3 py-2 text-right">7일 하루평균</th>
                    <th className="px-3 py-2 text-right">알림선</th>
                    <th className="px-3 py-2 text-right">잰 날수</th>
                    <th className="px-3 py-2">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {흐름.map((r) => (
                    <tr key={r.수집기} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-2 font-bold">{r.수집기}</td>
                      <td className="num px-3 py-2 text-right tabular-nums">{r.지난24시간 ?? '-'}</td>
                      <td className="num px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{수(r['7일 하루평균'])}</td>
                      <td className="num px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{수(r['알림선(평균의 절반)'])}</td>
                      <td className="num px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{r['잰 날수'] ?? '-'}</td>
                      <td className="px-3 py-2">
                        {r.빨간줄
                          ? <span className="rounded px-2 py-0.5 text-xs font-bold bg-brand-red-soft text-brand-red-dark">{r.왜 || '줄었습니다'}</span>
                          : <span className="rounded bg-badge-green-bg px-2 py-0.5 text-xs text-gray-900">{r.왜 || '보통'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={load}
              className="mt-6 rounded-xs border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900">
              다시 불러오기
            </button>
          </>
        )}
    </div>
  );
}
