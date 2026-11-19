'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { 관, AdminBadge, AdminSection } from '@/components/rapo/rapo-admin-ui';

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
  /* ★ 2026-10-11 — 「마지막으로 보낸 알림」 한 줄 (세중님 결정).
     푸시는 GitHub Actions 가 하루 세 번 돌아서 화면에서 볼 길이 없었습니다 */
  const [알림, set알림] = useState<{
    마지막때?: string | null; 오늘보냄?: number; 모두보냄?: number;
    켜진기기?: number; 꺼진기기?: number; 왜?: string;
  } | null>(null);

  const load = useCallback(async () => {
    const sb = browserSupabase();
    const [a, b, c] = await Promise.all([
      sb.rpc('beat_health'),
      sb.rpc('수집기박동'),
      sb.rpc('admin_마지막알림'),
    ]);
    if (!c.error) set알림(c.data as typeof 알림);
    if (a.error) { setErr(a.error.message); set박동([]); } else { set박동((a.data ?? []) as 박동줄[]); }
    if (b.error) { setErr((p) => p ?? b.error!.message); set흐름([]); } else { set흐름((b.data ?? []) as 흐름줄[]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const 빨간것 = (박동 ?? []).filter((r) => r.빨간줄).length
    + (흐름 ?? []).filter((r) => r.빨간줄).length;

  return (
    <div className="max-w-[1100px]">
      {/* 2026-11-19 새 관리자 디자인(Figma 16)으로 겉모양만 다시 입힘 */}
      <RapoAdminHeader title="수집기 상태">
        <button type="button" onClick={load} className={관.btnLine}>다시 불러오기</button>
      </RapoAdminHeader>
      <p className={'-mt-[20px] mb-[24px] break-keep ' + 관.muted}>
        수집기가 <span className="font-bold text-[#112231]">돌았나</span>와 공고가{' '}
        <span className="font-bold text-[#112231]">들어왔나</span>는 다릅니다. 둘을 나란히 놓습니다.
      </p>

      {/* 마지막으로 보낸 알림 — 한 줄 */}
      {알림 && !알림.왜 && (
        <p className={'mb-[16px] break-keep ' + 관.card + ' ' + 관.body}>
          <b>마지막으로 보낸 알림</b>{' · '}
          {알림.마지막때
            ? new Date(알림.마지막때).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
            : '아직 한 번도 안 보냈어요'}
          {' · 오늘 '}<span className="num tabular-nums">{알림.오늘보냄 ?? 0}</span>건
          {' · 모두 '}<span className="num tabular-nums">{알림.모두보냄 ?? 0}</span>건
          {' · 켜 둔 기기 '}<span className="num tabular-nums">{알림.켜진기기 ?? 0}</span>대
          {(알림.꺼진기기 ?? 0) > 0 && <span className="text-[#555d6d]">{' (꺼진 것 ' + 알림.꺼진기기 + '대)'}</span>}
        </p>
      )}

      {err && <p role="alert" className={'mb-[16px] ' + 관.error}>{err}</p>}

      {박동 === null || 흐름 === null
        ? <p className={관.muted}>잠시만요…</p>
        : (
          <>
            <p className={'mb-[32px] break-keep ' + (빨간것 ? 관.error : 관.ok)}>
              {빨간것
                ? <>빨간줄 <span className="num font-bold tabular-nums">{빨간것}</span>개 — 아래에서 보십시오</>
                : <>빨간줄 없습니다. 수집기 {박동.length}곳이 제때 돌고 있습니다</>}
            </p>

            <AdminSection title="① 돌았나 — 수집기가 남긴 박동"
              sub={<>한 바퀴 돌 때마다 <span className="font-bold">collect_beat()</span> 로 남깁니다.
                박동을 안 부르는 수집기는 실제로 돌아도 빨간줄이 섭니다</>}>
              <div className={관.tableWrap}>
                <table className={관.table + ' min-w-[720px]'}>
                  <thead className={관.thead}>
                    <tr>
                      <th className={관.th}>수집기</th>
                      <th className={관.th}>마지막</th>
                      <th className={관.th + ' text-right'}>몇 시간째</th>
                      <th className={관.th + ' text-right'}>평소 간격</th>
                      <th className={관.th + ' text-right'}>기대 간격</th>
                      <th className={관.th}>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {박동.map((r) => (
                      <tr key={r.경로} className={관.tr}>
                        <td className={관.td}>
                          <span className="font-bold text-[#112231]">{r.이름}</span>
                          <span className="ml-1 text-[13px] text-[#555d6d]">{r.경로}</span>
                        </td>
                        <td className={관.td + ' whitespace-nowrap'}>{때(r.마지막)}</td>
                        <td className={관.td + ' num text-right tabular-nums text-[#112231]'}>{수(r.몇시간째)}</td>
                        <td className={관.td + ' num text-right tabular-nums'}>{수(r.평소간격시간)}</td>
                        <td className={관.td + ' num text-right tabular-nums'}>{수(r.기대간격시간)}</td>
                        <td className={관.td}>
                          {r.빨간줄
                            ? <AdminBadge tone="coral">{r.왜 || '늦었습니다'}</AdminBadge>
                            : <AdminBadge tone="ok">제때</AdminBadge>}
                          {r.마지막탈 ? <span className="ml-2 text-[13px] text-[#555d6d]">{r.마지막탈}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminSection>

            <AdminSection title="② 들어왔나 — 공고 흐름"
              sub={<><span className="font-bold">지난 24시간</span> 새 공고가 7일 하루평균의 절반보다
                적으면 빨간줄입니다. 잰 날수가 모자라면 판단을 미룹니다</>}>
              <div className={관.tableWrap}>
                <table className={관.table + ' min-w-[640px]'}>
                  <thead className={관.thead}>
                    <tr>
                      <th className={관.th}>수집기</th>
                      <th className={관.th + ' text-right'}>지난 24시간</th>
                      <th className={관.th + ' text-right'}>7일 하루평균</th>
                      <th className={관.th + ' text-right'}>알림선</th>
                      <th className={관.th + ' text-right'}>잰 날수</th>
                      <th className={관.th}>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {흐름.map((r) => (
                      <tr key={r.수집기} className={관.tr}>
                        <td className={관.td + ' font-bold text-[#112231]'}>{r.수집기}</td>
                        <td className={관.td + ' num text-right tabular-nums text-[#112231]'}>{r.지난24시간 ?? '-'}</td>
                        <td className={관.td + ' num text-right tabular-nums'}>{수(r['7일 하루평균'])}</td>
                        <td className={관.td + ' num text-right tabular-nums'}>{수(r['알림선(평균의 절반)'])}</td>
                        <td className={관.td + ' num text-right tabular-nums'}>{r['잰 날수'] ?? '-'}</td>
                        <td className={관.td}>
                          {r.빨간줄
                            ? <AdminBadge tone="coral">{r.왜 || '줄었습니다'}</AdminBadge>
                            : <AdminBadge tone="ok">{r.왜 || '보통'}</AdminBadge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          </>
        )}
    </div>
  );
}
