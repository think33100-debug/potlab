'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminMetricCard } from '@/components/rapo/rapo-admin-ui';
import { browserSupabase } from '@/lib/supabase-browser';

/* 관리자 홈 — 새 디자인 「관리자 홈 · PC UI」 1406:399 (2026-11-12 세중님 「관리자 페이지도 적용 시작」).
   전에 이 자리에 있던 「홈 꾸미기」는 /admin/home-blocks 로 옮겼습니다 (메뉴 「그 밖의 도구」).

   카드 셋 가운데 값이 있는 것만 진짜 숫자로 채웁니다 — 지어낸 숫자는 넣지 않습니다.
     방문자 수        admin_stats_daily 의 visits(그날 방문자 · 관리자 제외)를 기간만큼 더한 값.
                     ★ 날마다 센 방문자의 합이라 같은 사람이 이틀 오면 두 번 셉니다 — 카드 아래에 그 뜻을 적습니다
     가입 이탈률      (2026-11-19) admin_stats_now 의 signup — 소셜 로그인까지 한 계정 중 profiles 가 없는 비율.
                     로그인 단추 전에 나간 분은 못 셉니다 · 30분 안 계정은 하는 중이라 뺍니다
     공유 버튼 클릭 수 (2026-11-19) admin_stats_shares — 공유창·링크 복사 누름 (lib/share-hit.ts). 그 전은 못 셉니다
   원본의 시작일·종료일 고르기는 두 단추(최근 1일 · 최근 7일)로 정해지는 날짜를 보여 주기만 합니다.

   ★ 2026-11-19 「처리할 일」 줄을 더했습니다 (「지표도 더 넣자」) — 머릿수만 셉니다(head: true · 줄은 안 받습니다).
     처리 전 신고   reports 의 handled_at 이 빈 것 (RLS: 관리자만 읽음) · 회원 이름·글은 안 받습니다
     오늘 새 공고   admin_jobs 의 collected_at 이 오늘(한국 시각) · 보류·숨김 포함 전부
     보류 공고     아래 표의 그 숫자 */

type Daily = { day: string; visits: number };
type 가입셈 = { d1: { started: number; done: number }; d7: { started: number; done: number } };
type 공유줄 = { day: string; shares: number; copies: number };
type 보류줄 = { id: string; title: string | null; org_name: string | null; collected_at: string | null; evidence: Record<string, unknown> | null };

const 날 = (s: string | null) => (s ? s.slice(0, 10).replaceAll('-', '.') : '—');

export default function AdminHome() {
  const [기간, set기간] = useState<1 | 7>(7);
  const [daily, setDaily] = useState<Daily[] | null>(null);
  const [보류, set보류] = useState<{ rows: 보류줄[]; count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [가입, set가입] = useState<가입셈 | null>(null);
  const [공유, set공유] = useState<공유줄[] | null>(null);
  const [할일, set할일] = useState<{ 신고: number | null; 새공고: number | null } | null>(null);

  useEffect(() => {
    const sb = browserSupabase();
    sb.rpc('admin_stats_daily', { p_days: 7 }).then(({ data, error }) => {
      if (error) setErr(error.message); else setDaily((data ?? []) as Daily[]);
    });
    /* 가입 이탈 · 공유 누름 (2026-11-19) — 실패하면 그 카드만 「못 셌어요」 */
    sb.rpc('admin_stats_now').then(({ data, error }) => {
      const s = (data as { signup?: 가입셈 } | null)?.signup;
      set가입(error || !s ? { d1: { started: -1, done: 0 }, d7: { started: -1, done: 0 } } : s);
    });
    sb.rpc('admin_stats_shares', { p_days: 7 }).then(({ data, error }) => {
      set공유(error ? [] : ((data ?? []) as 공유줄[]));
    });
    /* 처리할 일 (2026-11-19) — 머릿수만. 실패하면 그 칸만 「못 셌어요」 */
    /* 한국 시각 오늘 0시 — 'sv-SE' 는 YYYY-MM-DD 로 찍습니다 */
    const 오늘시작 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + 'T00:00:00+09:00';
    Promise.all([
      sb.from('reports').select('id', { count: 'exact', head: true }).is('handled_at', null),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).gte('collected_at', 오늘시작),
    ]).then(([r, j]) => set할일({ 신고: r.error ? null : r.count ?? 0, 새공고: j.error ? null : j.count ?? 0 }),
      () => set할일({ 신고: null, 새공고: null }));
    sb.from('admin_jobs').select('id,title,org_name,collected_at,evidence', { count: 'exact' })
      .eq('hold', true).order('collected_at', { ascending: false }).order('id').limit(5)
      .then(({ data, count, error }) => {
        if (error) setErr(error.message); else set보류({ rows: (data ?? []) as 보류줄[], count: count ?? 0 });
      });
  }, []);

  const 고른날 = daily ? daily.slice(-기간) : null;
  const 방문합 = 고른날?.reduce((a, d) => a + Number(d.visits ?? 0), 0) ?? null;

  /* 가입 이탈률 = 로그인까지 했는데 가입을 못 마친 비율 (admin_stats_now 의 signup) */
  const 가입칸 = 가입 ? (기간 === 1 ? 가입.d1 : 가입.d7) : null;
  const 시작 = 가입칸 ? Number(가입칸.started) : null;
  const 못마침 = 가입칸 ? Number(가입칸.started) - Number(가입칸.done) : 0;
  const 이탈값 = 시작 == null ? null : 시작 < 0 ? '못 셌어요' : 시작 === 0 ? '—' : `${Math.round((못마침 / 시작) * 100)}`;

  /* 공유 누름 (admin_stats_shares) — 2026-11-19 부터 셉니다 */
  const 공유날 = 공유 ? 공유.slice(-기간) : null;
  const 공유창 = 공유날?.reduce((a, d) => a + Number(d.shares ?? 0), 0) ?? 0;
  const 복사 = 공유날?.reduce((a, d) => a + Number(d.copies ?? 0), 0) ?? 0;

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
          <AdminMetricCard 그림="/rapo/admin/metric-visitors.svg" 이름="방문자 수"
            값={방문합 == null ? null : 방문합.toLocaleString('ko-KR')} 단위="명"
            설명={기간 === 1 ? '오늘 방문자 (관리자 제외)' : '날마다 센 방문자의 합 (관리자 제외)'}
            그래프={고른날 && 고른날.length > 1 ? <꺾은선 값들={고른날.map((d) => Number(d.visits ?? 0))} /> : null} />
          <AdminMetricCard 그림="/rapo/admin/metric-leave.svg" 이름="가입 이탈률"
            값={이탈값 == null || 이탈값 === '못 셌어요' ? null : 이탈값} 단위={이탈값 === '—' ? '' : '%'}
            빈말={이탈값 === '못 셌어요' ? '못 셌어요' : undefined}
            설명={시작 == null || 시작 < 0 ? '로그인까지 했는데 가입을 못 마친 비율'
              : `로그인 ${시작}명 중 ${못마침}명이 가입을 못 마침 · 로그인 전에 나간 분은 못 세요`} />
          <AdminMetricCard 그림="/rapo/admin/metric-share.svg" 이름="공유 버튼 클릭 수"
            값={공유 == null ? null : (공유창 + 복사).toLocaleString('ko-KR')} 단위="회"
            설명={`공유창 ${공유창} · 링크 복사 ${복사} · 11/19 부터 셈 (관리자 제외)`} />
        </div>
      </section>

      {/* 처리할 일 (2026-11-19) — 숫자를 누르면 그 화면으로 */}
      <section aria-labelledby="admin-todo" className="mb-[32px] flex flex-col gap-(--rapo-dimension-x4)">
        <h2 id="admin-todo" className="rapo-type-t6-bold">처리할 일</h2>
        <div className="grid gap-(--rapo-dimension-x4) sm:grid-cols-3">
          <할일칸 이름="보류 공고" n={보류 ? 보류.count : err ? null : undefined} 단위="건" 설명="관리자 확인을 기다리는 공고" href="/admin/jobs?state=hold" 급함={(보류?.count ?? 0) > 0} />
          <할일칸 이름="처리 전 신고" n={할일 ? 할일.신고 : undefined} 단위="건" 설명="커뮤니티 글·댓글 신고 중 처리 안 한 것" href="/admin/reports" 급함={(할일?.신고 ?? 0) > 0} />
          <할일칸 이름="오늘 새 공고" n={할일 ? 할일.새공고 : undefined} 단위="건" 설명="오늘(한국 시각) 수집기가 담은 공고 · 보류·숨김 포함" href="/admin/jobs" />
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
        <div className="relative overflow-x-auto rounded-[12px] border border-[#dde4e6] bg-white">
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

/* 처리할 일 한 칸 — 값이 없으면(undefined) 불러오는 중, null 이면 못 셌어요 */
function 할일칸({ 이름, n, 단위, 설명, href, 급함 }: {
  이름: string; n: number | null | undefined; 단위: string; 설명: string; href: string; 급함?: boolean;
}) {
  return (
    <Link href={href}
      className="flex min-h-[96px] flex-col justify-between gap-[6px] rounded-[12px] border border-[#dde4e6] bg-white px-[15px] py-[12px] hover:border-[#304f65]">
      <p className="flex items-center justify-between text-[16px] font-bold text-[#304f65]">{이름}<span aria-hidden>→</span></p>
      {n === undefined ? <p className="text-[16px] font-bold text-[#304f65]">불러오는 중…</p>
        : n === null ? <p className="text-[16px] font-bold text-[#304f65]">못 셌어요</p>
        : <p className={'flex items-baseline gap-[3px] font-bold ' + (급함 ? 'text-[#b42a21]' : 'text-[#112231]')}>
            <span className="text-[28px] leading-none tabular-nums">{n.toLocaleString('ko-KR')}</span><span className="text-[15px]">{단위}</span></p>}
      <p className="text-[13px] text-[#555d6d]">{설명}</p>
    </Link>
  );
}
