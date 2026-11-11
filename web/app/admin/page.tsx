'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { browserSupabase } from '@/lib/supabase-browser';

/* 관리자 홈 — 새 디자인 「관리자 홈 · PC UI」 1406:399 (2026-11-12 세중님 「관리자 페이지도 적용 시작」).
   전에 이 자리에 있던 「홈 꾸미기」는 /admin/home-blocks 로 옮겼습니다 (메뉴 「그 밖의 도구」).

   카드 셋 가운데 값이 있는 것만 진짜 숫자로 채웁니다 — 지어낸 숫자는 넣지 않습니다.
     방문자 수        admin_stats_daily 의 visits(그날 방문자 · 관리자 제외)를 기간만큼 더한 값.
                     ★ 날마다 센 방문자의 합이라 같은 사람이 이틀 오면 두 번 셉니다 — 카드 아래에 그 뜻을 적습니다
     가입 이탈률      가입을 시작한 사람을 세는 자리가 아직 없습니다 → 「아직 세지 않아요」
     공유 버튼 클릭 수 공유 누름을 세는 자리가 아직 없습니다 → 「아직 세지 않아요」
   원본의 시작일·종료일 고르기는 두 단추(최근 1일 · 최근 7일)로 정해지는 날짜를 보여 주기만 합니다. */

type Daily = { day: string; visits: number };
type 보류줄 = { id: string; title: string | null; org_name: string | null; collected_at: string | null; evidence: Record<string, unknown> | null };

const 날 = (s: string | null) => (s ? s.slice(0, 10).replaceAll('-', '.') : '—');

export default function AdminHome() {
  const [기간, set기간] = useState<1 | 7>(7);
  const [daily, setDaily] = useState<Daily[] | null>(null);
  const [보류, set보류] = useState<{ rows: 보류줄[]; count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = browserSupabase();
    sb.rpc('admin_stats_daily', { p_days: 7 }).then(({ data, error }) => {
      if (error) setErr(error.message); else setDaily((data ?? []) as Daily[]);
    });
    sb.from('admin_jobs').select('id,title,org_name,collected_at,evidence', { count: 'exact' })
      .eq('hold', true).order('collected_at', { ascending: false }).order('id').limit(5)
      .then(({ data, count, error }) => {
        if (error) setErr(error.message); else set보류({ rows: (data ?? []) as 보류줄[], count: count ?? 0 });
      });
  }, []);

  const 고른날 = daily ? daily.slice(-기간) : null;
  const 방문합 = 고른날?.reduce((a, d) => a + Number(d.visits ?? 0), 0) ?? null;

  return (
    <div className="max-w-[932px]">
      <RapoAdminHeader title="관리자 홈">
        <div role="group" aria-label="조회 기간"
          className="flex items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) border border-[#dde4e6] bg-white px-(--rapo-dimension-x2) py-[5px]">
          {([1, 7] as const).map((n) => (
            <button key={n} type="button" aria-pressed={기간 === n} onClick={() => set기간(n)}
              className={'rounded-[5px] px-(--rapo-dimension-x2) py-[5px] text-[14px] text-[#112231] '
                + (기간 === n ? 'bg-[#dde7ee] font-bold' : '')}>
              최근 {n}일
            </button>
          ))}
          {고른날 && 고른날.length > 0 && (
            <span className="flex items-center gap-(--rapo-dimension-x2) px-(--rapo-dimension-x2) text-[14px] text-[#112231]">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG */}
              <img src="/rapo/admin/calendar.svg" alt="" width={16} height={16} />
              {날(고른날[0].day)} – {날(고른날[고른날.length - 1].day)}
            </span>
          )}
        </div>
      </RapoAdminHeader>

      {err && <p role="alert" className="mb-(--rapo-dimension-x6) rounded-(--rapo-radius-r2) bg-[#fff5f3] p-(--rapo-dimension-x4) text-[14px] text-[#b42a21]">못 불러왔어요 — {err}</p>}

      <section aria-labelledby="admin-metrics" className="mb-[32px] flex flex-col gap-(--rapo-dimension-x4)">
        <h2 id="admin-metrics" className="rapo-type-t6-bold">선택 기간 주요 지표</h2>
        <div className="grid gap-(--rapo-dimension-x4) md:grid-cols-3">
          <지표카드 그림="/rapo/admin/metric-visitors.svg" 이름="방문자 수"
            값={방문합 == null ? null : 방문합.toLocaleString('ko-KR')} 단위="명"
            설명={기간 === 1 ? '오늘 방문자 (관리자 제외)' : '날마다 센 방문자의 합 (관리자 제외)'}
            그래프={고른날 && 고른날.length > 1 ? <꺾은선 값들={고른날.map((d) => Number(d.visits ?? 0))} /> : null} />
          <지표카드 그림="/rapo/admin/metric-leave.svg" 이름="가입 이탈률" 값={null} 빈말="아직 세지 않아요"
            설명="가입을 시작한 사람을 세는 자리가 아직 없어요" />
          <지표카드 그림="/rapo/admin/metric-share.svg" 이름="공유 버튼 클릭 수" 값={null} 빈말="아직 세지 않아요"
            설명="공유 단추 누름을 세는 자리가 아직 없어요" />
        </div>
      </section>

      <section aria-labelledby="admin-hold" className="flex flex-col gap-(--rapo-dimension-x4)">
        <div className="flex items-center justify-between">
          <h2 id="admin-hold" className="flex items-center gap-(--rapo-dimension-x2)">
            <span className="rapo-type-t8-bold">현재 보류 공고</span>
            {보류 && <span className="rapo-type-t6-bold text-[#b42a21]">{보류.count}건</span>}
          </h2>
          <Link href="/admin/jobs?state=hold" className="rapo-type-t4-bold flex h-(--rapo-touch-min) items-center">보류함 보기&nbsp;&nbsp;→</Link>
        </div>
        <div className="overflow-x-auto rounded-[12px] border border-[#dde4e6] bg-white">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-[#f1f5f8] text-[13px] font-bold text-[#304f65]">
              <tr>
                <th className="h-[42px] px-[18px] font-bold">공고명</th>
                <th className="px-(--rapo-dimension-x4) font-bold">기관명</th>
                <th className="px-(--rapo-dimension-x4) font-bold">보류 사유</th>
                <th className="px-(--rapo-dimension-x4) font-bold">수집일</th>
              </tr>
            </thead>
            <tbody>
              {보류 == null ? (
                <tr><td colSpan={4} className="h-[57px] px-[18px] text-[14px] text-[#304f65]">불러오는 중…</td></tr>
              ) : 보류.rows.length === 0 ? (
                <tr><td colSpan={4} className="h-[57px] px-[18px] text-[14px] text-[#304f65]">보류 공고가 없어요</td></tr>
              ) : 보류.rows.map((r) => (
                <tr key={r.id} className="border-t border-[#dde4e6]">
                  <td className="h-[57px] px-[18px] text-[16px] font-bold text-[#112231]">
                    <Link href={`/admin/jobs/${encodeURIComponent(r.id)}`} className="hover:underline">{r.title ?? '(제목 없음)'}</Link>
                  </td>
                  <td className="px-(--rapo-dimension-x4) text-[14px] text-[#304f65]">{r.org_name ?? '—'}</td>
                  <td className="px-(--rapo-dimension-x4) text-[14px] text-[#304f65]">{String(r.evidence?.['보류사유'] ?? '—')}</td>
                  <td className="whitespace-nowrap px-(--rapo-dimension-x4) text-[14px] text-[#304f65]">{날(r.collected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* 원본 「RAPO / 운영 / 지표 카드」 1406:386 — 흰 바탕 · 테두리 · radius 12 · 높이 114 */
function 지표카드({ 그림, 이름, 값, 단위, 설명, 그래프, 빈말 }: {
  그림: string; 이름: string; 값: string | null; 단위?: string; 설명: string; 그래프?: React.ReactNode; 빈말?: string;
}) {
  return (
    <div className="relative flex min-h-[114px] flex-col justify-between rounded-[12px] border border-[#dde4e6] bg-white px-[15px] py-[12px]">
      <p className="flex items-center gap-[6px] text-[16px] font-bold text-[#304f65]">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG */}
        <img src={그림} alt="" width={19} height={19} />
        {이름}
      </p>
      <div className="flex items-end justify-between gap-(--rapo-dimension-x3)">
        {값 != null
          ? <p className="flex items-baseline gap-[3px] font-bold text-[#112231]"><span className="text-[32px] leading-none">{값}</span><span className="text-[15px]">{단위}</span></p>
          : <p className="text-[16px] font-bold text-[#304f65]">{빈말 ?? '불러오는 중…'}</p>}
        {그래프}
      </div>
      <p className="text-[13px] text-[#304f65]">{설명}</p>
    </div>
  );
}

/* 방문자 꺾은선 — 원본 Vector 114×26 자리. 진짜 날별 값으로 그립니다 */
function 꺾은선({ 값들 }: { 값들: number[] }) {
  const w = 114, h = 26, 큰 = Math.max(1, ...값들);
  const 점 = 값들.map((v, i) => `${(i / (값들.length - 1)) * w},${h - (v / 큰) * h}`).join(' ');
  return (
    <svg width={w} height={h + 2} viewBox={`0 -1 ${w} ${h + 2}`} aria-hidden className="shrink-0">
      <polyline points={점} fill="none" stroke="#223d51" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
