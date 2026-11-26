'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { channelName } from '@/lib/channels';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminMetricCard, AdminSection, 관 } from '@/components/rapo/rapo-admin-ui';

/* 통계.

   숫자는 전부 DB 가 세어 줍니다 (admin_stats_* 함수).
   그 함수들은 첫 줄에서 is_admin() 으로 잠겨 있어서, 화면을 뚫어도
   관리자가 아니면 한 줄도 안 나옵니다.

   관리자가 본 것은 숫자에서 뺍니다. 옆에 따로 적어 둡니다 —
   「이 숫자에 우리가 얼마나 섞였나」를 나중에 못 가리면 안 됩니다.

   ★ 2026-11-19 새 디자인 「통계 · PC UI」 1406:720 으로 다시 그렸습니다 (「지표도 더 넣자」).
     원본 칸 가운데 **우리 DB 가 아직 못 세는 것은 지어내지 않고** 셀 수 있는 것으로 바꿨습니다 —
       평균 체류 시간        → 재방문 근사치 (머문 시간은 기록하지 않습니다)
       가입 이탈률 일별 추이  → 화면 조회 일별 추이 (가입 셈은 1일·7일 묶음만 있습니다)
       가입 퍼널 5단계       → 로그인 → 가입 완료 2단계 (약관·근무 경험·정보 입력 단계 기록이 없습니다)
       방문자 구성           → 회원 구성 (방문자는 직군을 모릅니다 · 회원 기준)
       공유 유입·커뮤니티 경로 → 화면별 조회 · 기기 (어디서 왔는지는 기록하지 않습니다)
     더한 것 — 커뮤니티 방문 수 · 광고 배너 클릭 수 · 1층 기관 커버리지(커버리지()) ·
       수집 신뢰 셋(admin_네숫자() — 아직 DB 에 없으면 그 칸만 빠집니다 · RAPO노트/SQL_1119/관리자_수집지표.sql)
     모든 숫자 옆에 분모와 날짜(기간)를 적습니다. */

type 가입칸 = { started: number; done: number };
type Now = {
  today: string;
  members: number; members_today: number; members_week: number;
  job_groups: Record<string, number>;
  roles: Record<string, number>;
  providers: Record<string, number>;
  jobs: number; jobs_open: number; jobs_today: number; jobs_hold: number;
  posts: number; posts_today: number; comments: number; comments_today: number;
  notify_on: number; orgs: number;
  signup?: { d1: 가입칸; d7: 가입칸 };
};
type Daily = { day: string; visits: number; views: number; admin_visits: number };
type Screen = { kind: string; views: number; visits: number };
type Device = { device: string; visits: number; views: number };
type TopJob = { id: string; title: string; org_name: string; views: number; outs: number };
type TopPost = { id: number; title: string; channel: string; views: number };
type Share = { day: string; shares: number; copies: number };
type Ad = { 자리: string; 이름: string; 켜짐: boolean; 오늘봄: number; 오늘누름: number; 다봄: number; 다누름: number };
type Cover = { 갈래: string; 대상: number; 들어온곳: number; 퍼센트: number; 분모인가: boolean; 어떻게: string };

const SCREEN_NAME: Record<string, string> = {
  home: '홈', jobs: '공고 목록', job: '공고 상세',
  community: '커뮤니티', post: '글 상세',
  orgs: '병원정보 찾기', org: '기관 상세', other: '그 밖에',
};

/* 기기는 2026-09-23 부터 담습니다. 그 전 자료에는 가릴 근거가 없습니다 */
const DEVICE_NAME: Record<string, string> = {
  mobile: '휴대폰', desktop: '피시', 모름: '2026-09-23 이전',
};

const PROVIDER_NAME: Record<string, string> = {
  kakao: '카카오', 'custom:naver': '네이버', apple: '애플', email: '이메일',
};

const 수 = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('ko-KR');
const 점날 = (s: string) => s.slice(5).replace('-', '.');

export default function AdminStats() {
  const [기간, set기간] = useState<1 | 7>(7);
  const [now, setNow] = useState<Now | null>(null);
  const [daily, setDaily] = useState<Daily[] | null>(null);
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [screens1, setScreens1] = useState<Screen[] | null>(null);
  const [jobs, setJobs] = useState<TopJob[] | null>(null);
  const [posts, setPosts] = useState<TopPost[] | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [cover, setCover] = useState<Cover[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const sb = browserSupabase();
    const [n, d, s, tj, tp, dv] = await Promise.all([
      sb.rpc('admin_stats_now'),
      sb.rpc('admin_stats_daily', { p_days: 30 }),
      sb.rpc('admin_stats_screens', { p_days: 7 }),
      sb.rpc('admin_stats_top_jobs', { p_days: 7, p_limit: 10 }),
      sb.rpc('admin_stats_top_posts', { p_days: 7, p_limit: 10 }),
      sb.rpc('admin_stats_devices', { p_days: 7 }),
    ]);
    const bad = [n, d, s, tj, tp, dv].find((r) => r.error);
    /* 2026-11-19 더한 것 — 실패해도 화면 전체를 막지 않고 그 칸만 「못 셌어요」 */
    const [s1, sh, ad, cv] = await Promise.all([
      sb.rpc('admin_stats_screens', { p_days: 1 }),
      sb.rpc('admin_stats_shares', { p_days: 7 }),
      sb.rpc('admin_광고배너'),
      sb.rpc('커버리지'),
    ]);
    return {
      err: bad?.error?.message ?? null,
      now: n.data as Now | null,
      daily: (d.data ?? []) as Daily[],
      screens: (s.data ?? []) as Screen[],
      jobs: (tj.data ?? []) as TopJob[],
      posts: (tp.data ?? []) as TopPost[],
      devices: (dv.data ?? []) as Device[],
      screens1: s1.error ? null : (s1.data ?? []) as Screen[],
      shares: sh.error ? [] : (sh.data ?? []) as Share[],
      ads: ad.error ? [] : (ad.data ?? []) as Ad[],
      cover: cv.error ? [] : (cv.data ?? []) as Cover[],
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      setErr(r.err); setNow(r.now); setDaily(r.daily);
      setScreens(r.screens); setJobs(r.jobs); setPosts(r.posts);
      setDevices(r.devices); setScreens1(r.screens1); setShares(r.shares);
      setAds(r.ads); setCover(r.cover);
    });
    return () => { alive = false; };
  }, [fetchAll]);

  if (err) {
    return <p role="alert" className={관.error}>통계를 못 읽었어요 — {err}</p>;
  }
  if (!now || !daily) return <p className={관.muted}>세는 중…</p>;

  const today = daily[daily.length - 1];
  const yday = daily[daily.length - 2];
  const max = Math.max(1, ...daily.map((d) => d.visits));
  const sum = (k: keyof Daily) => daily.reduce((a, d) => a + Number(d[k] ?? 0), 0);

  /* ── 기간 지표 ── */
  const 고른날 = daily.slice(-기간);
  const 방문합 = 고른날.reduce((a, d) => a + Number(d.visits ?? 0), 0);
  const 기간말 = 고른날.length > 0 ? `${점날(고른날[0].day)} – ${점날(고른날[고른날.length - 1].day)}` : '';

  const 가입 = now.signup ? (기간 === 1 ? now.signup.d1 : now.signup.d7) : null;
  const 시작 = 가입 ? Number(가입.started) : null;
  const 못마침 = 가입 ? Number(가입.started) - Number(가입.done) : 0;
  const 이탈 = 시작 == null ? null : 시작 === 0 ? '—' : String(Math.round((못마침 / 시작) * 100));

  const 공유날 = (shares ?? []).slice(-기간);
  const 공유합 = 공유날.reduce((a, d) => a + Number(d.shares ?? 0) + Number(d.copies ?? 0), 0);

  const 커뮤 = (기간 === 1 ? screens1 : screens)?.find((s) => s.kind === 'community') ?? null;
  const 커뮤방문 = (기간 === 1 ? screens1 : screens) == null ? null : Number(커뮤?.visits ?? 0);

  const 배너봄 = (ads ?? []).reduce((a, o) => a + Number(기간 === 1 ? o.오늘봄 : o.다봄), 0);
  const 배너누름 = (ads ?? []).reduce((a, o) => a + Number(기간 === 1 ? o.오늘누름 : o.다누름), 0);

  /* ── 추이(최근 7일) ── */
  const 칠일 = daily.slice(-7);
  const 공유칠일 = (shares ?? []).slice(-7);

  return (
    <div className="max-w-[932px]">
      <RapoAdminHeader title="통계">
        <기간고르기 기간={기간} set기간={set기간} 기간말={기간말} />
      </RapoAdminHeader>

      {/* ── 주요 지표 (원본 6칸) ── */}
      <AdminSection id="stats-main" title="주요 지표" sub={`${기간말} · 한국 시각 · 관리자 제외`}>
        <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
          <AdminMetricCard 그림="/rapo/admin/metric-visitors.svg" 이름="방문자 수"
            값={수(방문합)} 단위="명"
            설명={기간 === 1 ? '오늘 방문자 · 같은 분이 폰·PC로 보면 2로 세요' : '날마다 센 방문자의 합 · 이틀 오면 두 번 세요'}
            그래프={칠일.length > 1 ? <작은꺾은선 값들={칠일.map((d) => Number(d.visits ?? 0))} /> : null} />
          <AdminMetricCard 그림="/rapo/admin/metric-leave.svg" 이름="가입 이탈률"
            값={이탈 == null || 이탈 === '—' ? (이탈 ?? null) : 이탈} 단위={이탈 && 이탈 !== '—' ? '%' : ''}
            빈말={now.signup ? undefined : '못 셌어요'}
            설명={시작 == null ? '로그인까지 했는데 가입을 못 마친 비율'
              : `로그인 ${시작}명 중 ${못마침}명이 못 마침 · 로그인 전에 나간 분은 못 세요`}
            그래프={시작 ? <비율막대 비율={못마침 / 시작} /> : null} />
          <AdminMetricCard 그림="/rapo/admin/metric-share.svg" 이름="공유 버튼 클릭 수"
            값={shares == null ? null : 수(공유합)} 단위="회"
            설명="공유창 + 링크 복사 · 11/19 부터 셈"
            그래프={공유칠일.length > 1 ? <작은막대 값들={공유칠일.map((d) => Number(d.shares) + Number(d.copies))} /> : null} />
          <RevisitCard />
          <AdminMetricCard 그림="/rapo/admin/metric-community.svg" 이름="커뮤니티 방문 수"
            값={커뮤방문 == null ? null : 수(커뮤방문)} 단위="명"
            빈말={커뮤방문 == null ? '못 셌어요' : undefined}
            설명={`커뮤니티 목록을 연 사람(날마다 센 합) · 조회 ${수(커뮤?.views)}회`} />
          <AdminMetricCard 그림="/rapo/admin/metric-ad.svg" 이름="광고 배너 클릭 수"
            값={ads == null ? null : 수(배너누름)} 단위="회"
            설명={`${기간 === 1 ? '오늘' : '켠 뒤 누적'} · 보인 ${수(배너봄)}회 중`
              + (배너봄 > 0 ? ` ${((배너누름 / 배너봄) * 100).toFixed(1)}%` : '')
              + ' · 자리별은 오픈 화면 광고에서'} />
        </div>
      </AdminSection>

      {/* ── 추이 ── */}
      <AdminSection id="stats-trend" title="최근 7일 추이" sub={칠일.length ? `${점날(칠일[0].day)} – ${점날(칠일[칠일.length - 1].day)}` : ''}>
        <div className="grid gap-[12px] md:grid-cols-3">
          <추이카드 이름="방문자 수" 단위="명" 값들={칠일.map((d) => Number(d.visits ?? 0))} 날들={칠일.map((d) => d.day)} 꼴="선" />
          <추이카드 이름="화면 조회 수" 단위="회" 값들={칠일.map((d) => Number(d.views ?? 0))} 날들={칠일.map((d) => d.day)} 꼴="선" />
          <추이카드 이름="공유 버튼 클릭 수" 단위="회" 값들={공유칠일.map((d) => Number(d.shares) + Number(d.copies))} 날들={공유칠일.map((d) => d.day)} 꼴="막대" />
        </div>
      </AdminSection>

      {/* ── 가입 ── */}
      <AdminSection id="stats-signup" title="가입 흐름" sub="로그인 → 가입 완료 · 30분 안 계정은 하는 중이라 뺍니다">
        <div className={관.card}>
          {!now.signup ? <p className={관.muted}>못 셌어요</p> : (
            <div className="grid gap-[20px] sm:grid-cols-2">
              {([['오늘', now.signup.d1], ['최근 7일', now.signup.d7]] as const).map(([이름, s]) => {
                const st = Number(s.started), dn = Number(s.done);
                return (
                  <div key={이름} className="flex flex-col gap-[10px]">
                    <p className={관.h3}>{이름} <span className="ml-[6px] text-[14px] font-normal text-[#555d6d]">
                      전체 이탈률 {st ? `${Math.round(((st - dn) / st) * 100)}%` : '—'}</span></p>
                    <단계막대 이름="로그인(가입 시작)" n={st} 큰={Math.max(1, st)} />
                    <단계막대 이름="가입 완료" n={dn} 큰={Math.max(1, st)} 이탈={st - dn} />
                  </div>
                );
              })}
            </div>
          )}
          <p className={관.sub + ' mt-[16px] border-t border-[#dde4e6] pt-[12px]'}>
            약관 동의 · 근무 경험 · 정보 입력 단계별 이탈은 아직 기록하지 않아 셀 수 없어요. 로그인 단추를 누르기 전에 나간 분도 못 세요
          </p>
        </div>
      </AdminSection>

      {/* ── 회원 구성 ── */}
      <AdminSection id="stats-members" title="회원 구성" sub={`회원 ${수(now.members)}명 기준 · 이번 주 +${수(now.members_week)} · 오늘 +${수(now.members_today)}`}>
        <div className="grid gap-[12px] md:grid-cols-3">
          <구성카드 제목="직군" data={now.job_groups} />
          <구성카드 제목="사용자 구분(역할)" data={now.roles} />
          <구성카드 제목="로그인 수단" data={now.providers} rename={PROVIDER_NAME} />
        </div>
      </AdminSection>

      {/* ── 화면별 · 기기 ── */}
      <AdminSection id="stats-screens" title="어디를 보나" sub="최근 7일 · 조회는 하루·같은 사람·같은 화면 한 번">
        <div className="grid gap-[12px] md:grid-cols-2">
          <div className={관.card}>
            <p className={관.h3 + ' mb-[14px]'}>화면별 조회</p>
            {!screens || screens.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (
              <가로막대들 줄들={screens.map((s) => ({ 이름: SCREEN_NAME[s.kind] ?? s.kind, n: Number(s.views), 덧: `방문 ${수(s.visits)}` }))} 단위="회" />
            )}
          </div>
          <div className={관.card}>
            <p className={관.h3 + ' mb-[14px]'}>피시 · 휴대폰</p>
            {!devices || devices.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (() => {
              const all = devices.reduce((a, x) => a + Number(x.visits), 0) || 1;
              return <가로막대들 줄들={devices.map((d) => ({
                이름: DEVICE_NAME[d.device] ?? d.device, n: Number(d.visits),
                덧: `${Math.round((Number(d.visits) / all) * 100)}% · 조회 ${수(d.views)}` }))} 단위="명" />;
            })()}
            <p className={관.sub + ' mt-[14px]'}>
              기기는 2026-09-23 부터 담습니다. 그 전은 「2026-09-23 이전」으로 묶여요. 태블릿은 휴대폰 쪽으로 셉니다
            </p>
          </div>
        </div>
      </AdminSection>

      {/* ── 30일 ── */}
      <AdminSection id="stats-30" title="최근 30일 방문"
        sub={`방문 ${수(sum('visits'))} · 화면 조회 ${수(sum('views'))}${sum('visits') === 0 ? ' · 오늘부터 쌓기 시작했어요' : ''}`}>
        <div className={관.card}>
          <div className="flex items-baseline gap-[16px]">
            <p className="text-[32px] font-bold leading-none tabular-nums text-[#112231]">{수(today?.visits)}<span className="ml-[3px] text-[15px]">명</span></p>
            {yday && <어제견줌 v={Number(today?.visits ?? 0)} prev={Number(yday.visits)} />}
          </div>
          <p className={관.sub + ' mt-[6px]'}>오늘 방문 · 화면 조회 {수(today?.views)}
            {(today?.admin_visits ?? 0) > 0 && ` · 관리자 방문 ${today.admin_visits}은 뺐어요`}</p>
          {/* 라이브러리 없이 막대 30개. 값이 적어 이걸로 충분합니다 */}
          <div className="mt-[16px] flex h-[120px] items-end gap-[3px]" role="img"
               aria-label={`최근 30일 방문 수. 가장 많은 날 ${max}`}>
            {daily.map((d, i) => (
              <div key={d.day} className="group relative flex-1">
                <div
                  className={'w-full rounded-t-[3px] transition-colors hover:bg-[#ff4f40] ' + (i === daily.length - 1 ? 'bg-[#223d51]' : 'bg-[#c7d1d9]')}
                  style={{ height: Math.max(2, (d.visits / max) * 120) }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-[4px] hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#112231] px-[8px] py-[4px] text-[12px] text-white group-hover:block">
                  {d.day.slice(5)} · {d.visits}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-[6px] flex justify-between text-[13px] text-[#555d6d]">
            <span>{daily[0]?.day.slice(5)}</span>
            <span>{daily[daily.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      </AdminSection>

      {/* ── 재방문 근사치 (2026-11-18 · 멘토-5-2 · Q5) — DB 함수가 없으면 통째로 안 그립니다 ── */}
      <MemberRevisit />
      <Revisit />

      {/* ── 수집 (2026-11-19 더함) ── */}
      <CollectMetrics cover={cover} />

      {/* ── 쌓여 있는 것 ── */}
      <AdminSection id="stats-stock" title="쌓여 있는 것" sub={`${now.today} 기준`}>
        <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
          <작은수 이름="회원" n={now.members} 덧={`이번 주 +${수(now.members_week)}`} />
          <작은수 이름="올라간 공고" n={now.jobs} 덧={`접수 중 ${수(now.jobs_open)} · 오늘 새 ${수(now.jobs_today)}`} />
          <작은수 이름="보류함" n={now.jobs_hold} 덧="관리자 확인 기다림" href="/admin/jobs?state=hold" />
          <작은수 이름="기관 자료" n={now.orgs} />
          <작은수 이름="알림 켠 사람" n={now.notify_on} 덧={`회원 ${수(now.members)}명 중`} />
          <작은수 이름="커뮤니티 글" n={now.posts} 덧={`오늘 +${수(now.posts_today)}`} />
          <작은수 이름="댓글" n={now.comments} 덧={`오늘 +${수(now.comments_today)}`} />
        </div>
      </AdminSection>

      {/* ── 많이 본 공고 ── */}
      <AdminSection id="stats-topjobs" title="많이 본 공고" sub="최근 7일 · 「열기」는 원문 공고를 누른 수 — 광고 값을 매길 때 제일 단단해요">
        {!jobs || jobs.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[560px]'}>
              <thead className={관.thead}>
                <tr><th className={관.th}>공고명</th><th className={관.th}>기관명</th><th className={관.th + ' text-right'}>조회</th><th className={관.th + ' text-right'}>열기</th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className={관.tr}>
                    <td className={관.tdMain}><Link href={`/jobs/${j.id}`} className="hover:underline">{j.title}</Link></td>
                    <td className={관.td}>{j.org_name}</td>
                    <td className={관.td + ' text-right font-bold tabular-nums text-[#112231]'}>{수(j.views)}</td>
                    <td className={관.td + ' text-right tabular-nums'}>{수(j.outs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {/* ── 많이 본 글 ── */}
      <AdminSection id="stats-topposts" title="많이 본 글" sub="최근 7일">
        {!posts || posts.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[480px]'}>
              <thead className={관.thead}>
                <tr><th className={관.th}>글 제목</th><th className={관.th}>게시판</th><th className={관.th + ' text-right'}>조회</th></tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className={관.tr}>
                    <td className={관.tdMain}><Link href={`/post/${p.id}`} className="hover:underline">{p.title}</Link></td>
                    <td className={관.td}>{channelName(p.channel)}</td>
                    <td className={관.td + ' text-right font-bold tabular-nums text-[#112231]'}>{수(p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <p className={관.sub}>
        방문·조회는 쌓기 시작한 날부터 셉니다. 과거는 셀 수 없어요.
        업체에 보여줄 「하루 평균」은 최소 2주는 모아야 말할 수 있어요
      </p>
    </div>
  );
}

/* ─────────────────────────────────────── */

/* 원본 「운영 / 조회 기간」 — 최근 1일 · 최근 7일 + 고른 날짜 */
function 기간고르기({ 기간, set기간, 기간말 }: { 기간: 1 | 7; set기간: (n: 1 | 7) => void; 기간말: string }) {
  return (
    <div role="group" aria-label="조회 기간"
      className="flex flex-wrap items-center gap-[8px] rounded-[8px] border border-[#dde4e6] bg-white px-[8px] py-[5px]">
      {([1, 7] as const).map((n) => (
        <button key={n} type="button" aria-pressed={기간 === n} onClick={() => set기간(n)}
          className={'rounded-[5px] px-[8px] py-[5px] text-[14px] text-[#112231] ' + (기간 === n ? 'bg-[#dde7ee] font-bold' : '')}>
          최근 {n}일
        </button>
      ))}
      {기간말 && (
        <span className="flex items-center gap-[8px] px-[8px] text-[14px] text-[#112231]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG */}
          <img src="/rapo/admin/calendar.svg" alt="" width={16} height={16} />
          {기간말}
        </span>
      )}
    </div>
  );
}

/* 지표 카드 안 작은 그래프 — 원본 「운영 / 7일 추이」 78×44 자리 */
function 작은꺾은선({ 값들 }: { 값들: number[] }) {
  const w = 90, h = 26, 큰 = Math.max(1, ...값들);
  const 점 = 값들.map((v, i) => `${(i / (값들.length - 1)) * w},${h - (v / 큰) * h}`).join(' ');
  return (
    <svg width={w} height={h + 2} viewBox={`0 -1 ${w} ${h + 2}`} aria-hidden className="shrink-0">
      <polyline points={점} fill="none" stroke="#223d51" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function 작은막대({ 값들 }: { 값들: number[] }) {
  const 큰 = Math.max(1, ...값들);
  return (
    <span aria-hidden className="flex h-[28px] shrink-0 items-end gap-[3px]">
      {값들.map((v, i) => (
        <span key={i} className={'w-[7px] rounded-t-[2px] ' + (i === 값들.length - 1 ? 'bg-[#223d51]' : 'bg-[#c7d1d9]')}
          style={{ height: Math.max(2, (v / 큰) * 28) }} />
      ))}
    </span>
  );
}
function 비율막대({ 비율 }: { 비율: number }) {
  return (
    <span aria-hidden className="relative block h-[6px] w-[90px] shrink-0 overflow-hidden rounded-full bg-[#dde4e6]">
      <span className="absolute inset-y-0 left-0 rounded-full bg-[#b42a21]" style={{ width: `${Math.min(100, Math.max(4, 비율 * 100))}%` }} />
    </span>
  );
}

/* 원본 「방문자 수 일별 그래프」 300×278 — 진짜 날별 값으로 그립니다 */
function 추이카드({ 이름, 단위, 값들, 날들, 꼴 }: { 이름: string; 단위: string; 값들: number[]; 날들: string[]; 꼴: '선' | '막대' }) {
  const W = 260, H = 120;
  const 큰 = Math.max(1, ...값들);
  const 위 = Math.max(1, Math.ceil(큰 / 4) * 4);
  const 마지막 = 값들.length ? 값들[값들.length - 1] : null;
  const 차 = 값들.length > 1 ? 값들[값들.length - 1] - 값들[0] : null;
  const x = (i: number) => (값들.length <= 1 ? W / 2 : 8 + (i / (값들.length - 1)) * (W - 16));
  const y = (v: number) => H - (v / 위) * H;
  return (
    <div className={관.card + ' !p-[18px]'}>
      <div className="flex items-start justify-between gap-[8px]">
        <div>
          <p className="text-[16px] font-bold text-[#304f65]">{이름}</p>
          <p className="mt-[4px] text-[24px] font-bold leading-[30px] text-[#112231] tabular-nums">{마지막 == null ? '—' : `${마지막.toLocaleString('ko-KR')}${단위}`}</p>
        </div>
        {차 != null && <p className="mt-[30px] text-[13px] text-[#555d6d]">첫날 대비 {차 >= 0 ? '+' : '−'}{Math.abs(차).toLocaleString('ko-KR')}{단위}</p>}
      </div>
      {값들.length === 0 ? <p className={관.muted + ' mt-[16px]'}>아직 기록이 없어요</p> : (
        <svg viewBox={`-30 -8 ${W + 48} ${H + 30}`} className="mt-[12px] w-full" role="img"
          aria-label={`${이름} 일별 · ${날들.map((d, i) => `${점날(d)} ${값들[i]}`).join(', ')}`}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={0} x2={W} y1={y(위 * t)} y2={y(위 * t)} stroke="#dde4e6" strokeWidth={1} />
              <text x={-6} y={y(위 * t) + 4} textAnchor="end" fontSize={10} fill="#555d6d">{Math.round(위 * t)}</text>
            </g>
          ))}
          {꼴 === '선' ? (
            <>
              <polyline points={값들.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#b42a21" strokeWidth={2} strokeLinejoin="round" />
              <circle cx={x(0)} cy={y(값들[0])} r={3} fill="#b42a21" />
              <circle cx={x(값들.length - 1)} cy={y(값들[값들.length - 1])} r={3} fill="#b42a21" />
            </>
          ) : 값들.map((v, i) => {
            const bw = Math.min(22, (W - 16) / 값들.length - 6);
            return <rect key={i} x={x(i) - bw / 2} y={y(v)} width={bw} height={Math.max(1, H - y(v))} rx={2}
              fill={i === 값들.length - 1 ? '#223d51' : '#c7d1d9'} />;
          })}
          {[0, Math.floor((날들.length - 1) / 2), 날들.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
            <text key={i} x={x(i)} y={H + 18} textAnchor="middle" fontSize={10} fill="#555d6d">{날들[i] ? 점날(날들[i]) : ''}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* 원본 「단계별 도달 인원」 — 가로 막대로 (폰에서도 읽히게) */
function 단계막대({ 이름, n, 큰, 이탈 }: { 이름: string; n: number; 큰: number; 이탈?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-[8px] text-[14px]">
        <span className="font-bold text-[#112231]">{이름}</span>
        <span className="tabular-nums text-[#112231]"><b>{n.toLocaleString('ko-KR')}명</b>
          {이탈 != null && 이탈 > 0 && <span className="ml-[8px] font-bold text-[#b42a21]">이탈 {이탈}명</span>}</span>
      </div>
      <div className="mt-[6px] h-[12px] overflow-hidden rounded-[3px] bg-[#f1f5f8]">
        <div className="h-full rounded-[3px] bg-[#304f65]" style={{ width: `${Math.max(n > 0 ? 3 : 0, (n / 큰) * 100)}%` }} />
      </div>
    </div>
  );
}

/* 원본 「커뮤니티 진입 경로」 — 이름 · 막대 · 값 */
function 가로막대들({ 줄들, 단위 }: { 줄들: { 이름: string; n: number; 덧?: string }[]; 단위: string }) {
  const 큰 = Math.max(1, ...줄들.map((r) => r.n));
  return (
    <ul className="flex flex-col gap-[12px]">
      {줄들.map((r, i) => (
        <li key={r.이름} className="grid grid-cols-[minmax(72px,auto)_1fr_auto] items-center gap-x-[12px] gap-y-[2px]">
          <span className="truncate text-[14px] text-[#304f65]">{r.이름}</span>
          <span className="h-[8px] overflow-hidden rounded-full bg-[#f1f5f8]">
            <span className={'block h-full rounded-full ' + (i === 0 ? 'bg-[#304f65]' : 'bg-[#a1aebb]')} style={{ width: `${(r.n / 큰) * 100}%` }} />
          </span>
          <span className="text-right text-[14px] font-bold tabular-nums text-[#112231]">{r.n.toLocaleString('ko-KR')}{단위}</span>
          {r.덧 && <span className="col-span-3 text-right text-[12px] text-[#555d6d] sm:col-start-3 sm:col-span-1">{r.덧}</span>}
        </li>
      ))}
    </ul>
  );
}

/* 원본 「구성 비율」 — 제목 · 이름 n명(%) · 막대 */
function 구성카드({ 제목, data, rename }: { 제목: string; data: Record<string, number>; rename?: Record<string, string> }) {
  const rows = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const 합계 = rows.reduce((a, [, n]) => a + Number(n), 0) || 1;
  return (
    <div className={관.card}>
      <p className={관.h3 + ' mb-[14px]'}>{제목}</p>
      {rows.length === 0 ? <p className={관.muted}>없음</p> : (
        <ul className="flex flex-col gap-[10px]">
          {rows.map(([k, n], i) => {
            const pct = Math.round((Number(n) / 합계) * 100);
            return (
              <li key={k}>
                <div className="flex items-baseline justify-between gap-[8px] text-[14px]">
                  <span className="text-[#112231]">{rename?.[k] ?? k}</span>
                  <span className="tabular-nums text-[#304f65]"><b className="text-[#112231]">{Number(n).toLocaleString('ko-KR')}명</b> ({pct}%)</span>
                </div>
                <div className="mt-[4px] h-[8px] overflow-hidden rounded-full bg-[#dde4e6]">
                  <div className={'h-full rounded-full ' + (i === 0 ? 'bg-[#304f65]' : 'bg-[#728394]')} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function 작은수({ 이름, n, 덧, href }: { 이름: string; n: number; 덧?: string; href?: string }) {
  const 안 = (
    <>
      <p className="text-[14px] font-bold text-[#304f65]">{이름}</p>
      <p className="mt-[4px] text-[24px] font-bold leading-[30px] tabular-nums text-[#112231]">{Number(n ?? 0).toLocaleString('ko-KR')}</p>
      {덧 && <p className="mt-[2px] text-[13px] text-[#555d6d]">{덧}</p>}
    </>
  );
  const 꼴 = 'rounded-[12px] border border-[#dde4e6] bg-white px-[15px] py-[12px]';
  return href ? <Link href={href} className={꼴 + ' block hover:border-[#304f65]'}>{안}</Link> : <div className={꼴}>{안}</div>;
}

function 어제견줌({ v, prev }: { v: number; prev: number }) {
  const diff = v - prev;
  const pct = prev ? Math.round((diff / prev) * 100) : null;
  return (
    <p className={'text-[14px] font-bold ' + (diff > 0 ? 'text-[#065a2e]' : diff < 0 ? 'text-[#b42a21]' : 'text-[#555d6d]')}>
      {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff)}
      {pct != null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
      <span className="ml-[8px] font-normal text-[#555d6d]">어제 {prev}</span>
    </p>
  );
}

/* 재방문 근사치 — 브라우저 자기보고 (2026-11-18 · 멘토-5-2 · 질문함 Q5 · RAPO노트/수집기/지표장치_1104.md 5번).

   첫 방문일은 브라우저에만 있고(components/revisit-mark.tsx), 서버에는 「첫 방문」·「D1~D7 첫 재방문」·
   「D7 당일」 이벤트만 옵니다. 숫자는 DB 의 admin_stats_revisit() 가 셉니다(초안 sql/초안_1118/재방문_근사치.sql).
   **회원 유지율이 아닙니다** — 저장을 지우거나 기기를 바꾸면 새 사람으로 셉니다.

   따로 불러옵니다. 함수가 아직 없거나 실패하면 **이 칸만 조용히 빠집니다** */
type RevisitRow = {
  day: string; first_browsers: number; back_browsers: number; back_done: boolean;
  back_pct: number | string | null; d7_browsers: number; d7_pct: number | string | null;
};

function useRevisit() {
  const [rows, setRows] = useState<RevisitRow[] | null>(null);
  const [없음, set없음] = useState(false);
  useEffect(() => {
    let alive = true;
    browserSupabase().rpc('admin_stats_revisit', { p_days: 21 }).then(({ data, error }) => {
      if (!alive) return;
      if (error) set없음(true); else setRows((data ?? []) as RevisitRow[]);
    }, () => { if (alive) set없음(true); });
    return () => { alive = false; };
  }, []);
  return { rows, 없음 };
}

/* 회원 재방문 — 같은 아이디가 다시 들어왔나 (2026-11-24 세중님 · sql/초안_1124/회원_재방문.sql).
   회원방문일 표(회원 한 명 · 하루 한 줄)를 admin_stats_member_revisit() 가 셉니다.
   11/24 이전 날은 로그인·글·댓글 등 남은 흔적으로 채운 것(출처 '옛기록')이라 **빠진 날이 있을 수 있습니다** */
type MemberRevisitRow = {
  day: string; visit_members: number; new_members: number; back_members: number;
  back_done: boolean; back_pct: number | string | null;
};

function useMemberRevisit() {
  const [rows, setRows] = useState<MemberRevisitRow[] | null>(null);
  const [없음, set없음] = useState(false);
  useEffect(() => {
    let alive = true;
    browserSupabase().rpc('admin_stats_member_revisit', { p_days: 30 }).then(({ data, error }) => {
      if (!alive) return;
      if (error) set없음(true); else setRows((data ?? []) as MemberRevisitRow[]);
    }, () => { if (alive) set없음(true); });
    return () => { alive = false; };
  }, []);
  return { rows, 없음 };
}

/* 주요 지표 넷째 칸 — 원본은 「평균 체류 시간」이지만 머문 시간은 기록하지 않아 재방문으로 둡니다.
   ★ 11/24 — 브라우저 근사치에서 **회원(아이디) 기준**으로 바꿨습니다 */
function RevisitCard() {
  const { rows, 없음 } = useMemberRevisit();
  const 다잰 = (rows ?? []).filter((r) => r.back_done && Number(r.new_members) > 0);
  const 첫 = 다잰.reduce((a, r) => a + Number(r.new_members), 0);
  const 다시 = 다잰.reduce((a, r) => a + Number(r.back_members), 0);
  return (
    <AdminMetricCard 그림="/rapo/admin/metric-stay.svg" 이름="7일 안 재방문 (회원)"
      값={rows == null || 첫 === 0 ? null : String(Math.round((다시 / 첫) * 100))} 단위="%"
      빈말={없음 ? '못 셌어요' : rows != null && 첫 === 0 ? '셈 중' : undefined}
      설명={첫 > 0 ? `처음 들어온 회원 ${첫.toLocaleString('ko-KR')}명 중 ${다시.toLocaleString('ko-KR')}명이 7일 안에 다시 옴 · 최근 30일 · 7일이 다 지난 날만`
        : '처음 들어온 날부터 7일이 지나야 나와요 · 회원(아이디) 기준'} />
  );
}

function MemberRevisit() {
  const { rows, 없음 } = useMemberRevisit();
  if (없음) return null;
  if (!rows) return null;
  const 있는날 = rows.filter((r) => Number(r.visit_members) > 0 || Number(r.new_members) > 0);
  const pct = (r: MemberRevisitRow) => (r.back_pct == null ? (Number(r.new_members) > 0 ? '셈 중' : '—') : `${Number(r.back_pct)}%`);

  return (
    <AdminSection id="stats-member-revisit" title="회원 재방문" sub="회원(아이디) 기준 · 최근 30일">
      <p className={관.sub}>
        같은 아이디가 다른 날 다시 들어왔는지 세요. 폰·PC 를 바꿔도 같은 회원이면 한 명이에요.
        하루에 여러 번 와도 그날은 한 번으로 세요
      </p>
      {있는날.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (
        <div className={관.tableWrap}>
          <table className={관.table + ' min-w-[420px] tabular-nums'}>
            <thead className={관.thead}>
              <tr>
                <th className={관.th}>날</th>
                <th className={관.th + ' text-right'}>들어온 회원</th>
                <th className={관.th + ' text-right'}>처음 온 회원</th>
                <th className={관.th + ' text-right'}>7일 안 재방문</th>
              </tr>
            </thead>
            <tbody>
              {[...있는날].reverse().map((r) => (
                <tr key={r.day} className={관.tr}>
                  <td className={관.td}>{r.day.slice(5)}</td>
                  <td className={관.td + ' text-right font-bold text-[#112231]'}>{Number(r.visit_members)}</td>
                  <td className={관.td + ' text-right'}>{Number(r.new_members)}</td>
                  <td className={관.td + ' text-right'}>
                    {pct(r)}
                    {Number(r.new_members) > 0 && (
                      <span className="ml-[8px] text-[13px] text-[#555d6d]">{Number(r.back_members)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={관.sub}>
        「7일 안 재방문」은 그날 처음 들어온 회원 가운데 1~7일째에 한 번이라도 다시 들어온 비율이에요.
        7일이 다 지나야 비율이 나오고, 그 전에는 「셈 중」이에요. 작은 회색 숫자는 다시 온 회원 수예요.
        11/24 전 날은 로그인·글·댓글 같은 남은 흔적으로 채워서, 둘러보기만 한 날은 빠져 있을 수 있어요(실제보다 낮게 나와요).
        관리자는 빼고 세요
      </p>
    </AdminSection>
  );
}

function Revisit() {
  const { rows } = useRevisit();
  if (!rows) return null;
  const 있는날 = rows.filter((r) => Number(r.first_browsers) > 0);
  const pct = (v: number | string | null) => (v == null ? '셈 중' : `${Number(v)}%`);

  return (
    <AdminSection id="stats-revisit" title="재방문 근사치" sub="브라우저 자기보고 · 최근 21일">
      <p className={관.sub}>
        그날 처음 온 브라우저 가운데 다음 7일 안에 다시 온 비율이에요.
        정확한 회원 유지율이 아니에요 — 저장을 지우거나 기기를 바꾸면 새로 온 것으로 세요
      </p>
      {있는날.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (
        <div className={관.tableWrap}>
          <table className={관.table + ' min-w-[420px] tabular-nums'}>
            <thead className={관.thead}>
              <tr>
                <th className={관.th}>첫 방문</th>
                <th className={관.th + ' text-right'}>브라우저</th>
                <th className={관.th + ' text-right'}>7일 안 재방문</th>
                <th className={관.th + ' text-right'}>7일째</th>
              </tr>
            </thead>
            <tbody>
              {[...있는날].reverse().map((r) => (
                <tr key={r.day} className={관.tr}>
                  <td className={관.td}>{r.day.slice(5)}</td>
                  <td className={관.td + ' text-right font-bold text-[#112231]'}>{Number(r.first_browsers)}</td>
                  <td className={관.td + ' text-right'}>
                    {pct(r.back_pct)}
                    <span className="ml-[8px] text-[13px] text-[#555d6d]">{Number(r.back_browsers)}</span>
                  </td>
                  <td className={관.td + ' text-right'}>
                    {pct(r.d7_pct)}
                    <span className="ml-[8px] text-[13px] text-[#555d6d]">{Number(r.d7_browsers)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={관.sub}>
        「7일 안 재방문」은 1~7일째 중 한 번이라도 다시 온 것, 「7일째」는 딱 7일째 날에 온 것이에요.
        첫 방문 뒤 7일이 다 지나야 비율이 나오고, 그 전에는 「셈 중」이에요. 작은 회색 숫자는 브라우저 수예요.
        이 장치를 켠 첫날 묶음에는 그 전부터 오던 분이 섞여 있어요
      </p>
    </AdminSection>
  );
}

/* 수집 — 1층 기관 커버리지(커버리지()) + 신뢰 셋(admin_네숫자()).
   신뢰 셋 창구는 아직 DB 에 없을 수 있습니다(초안 RAPO노트/SQL_1119/관리자_수집지표.sql · 권한을 바꾸는 일이라 승인 자리).
   없으면 그 카드만 빠지고 커버리지 표는 그대로 나옵니다 */
type 네숫자꼴 = {
  잰때?: string; 회원화면?: number;
  신뢰셋?: Record<string, unknown>;
  '③일곱칸'?: Record<string, unknown>;
  '①놓친공고'?: { 대상_1층기관?: number; 안긁는_1층기관?: number };
};

function CollectMetrics({ cover }: { cover: Cover[] | null }) {
  const [넷, set넷] = useState<네숫자꼴 | null>(null);
  useEffect(() => {
    let alive = true;
    browserSupabase().rpc('admin_네숫자').then(({ data, error }) => {
      if (alive && !error && data) set넷(data as 네숫자꼴);
    }, () => { /* 창구가 없으면 조용히 빠집니다 */ });
    return () => { alive = false; };
  }, []);

  const 분모 = (cover ?? []).filter((c) => c.분모인가);
  const 대상 = 분모.reduce((a, c) => a + Number(c.대상), 0);
  const 들어옴 = 분모.reduce((a, c) => a + Number(c.들어온곳), 0);
  if ((!cover || cover.length === 0) && !넷) return null;

  const 셋 = 넷?.신뢰셋 ?? {};
  const 칸 = 넷?.['③일곱칸'] ?? {};
  const n = (k: string, o: Record<string, unknown> = 셋) => (o[k] == null ? null : Number(o[k]));
  const 회원화면 = 넷?.회원화면 ?? null;

  return (
    <AdminSection id="stats-collect" title="수집" sub="공공·종합·대학 공고를 빠짐없이 — 아침 메일과 같은 자리에서 셉니다">
      {넷 && (
        <div className="grid gap-[12px] sm:grid-cols-3">
          <신뢰칸 이름="① 마감 지난 공고가 보임" v={n('①마감지난공고가보임')} 분모={회원화면} />
          <신뢰칸 이름="② 회원 화면에 틀린 값" v={n('②회원화면에틀린값')} 분모={null}
            덧={셋['②잰날'] ? `${String(셋['②잰날'])} 표본 · ${String(셋['②표본'] ?? '')}` : '주 1회 손으로 잼'} />
          <신뢰칸 이름="③ 직군 빈칸·의심·겹침" v={(n('③직군빈칸') ?? 0) + (n('③직군의심') ?? 0) + (n('③겹친것') ?? 0)} 분모={회원화면}
            덧={`빈칸 ${n('③직군빈칸') ?? '—'} · 의심 ${n('③직군의심') ?? '—'} · 겹침 ${n('③겹친것') ?? '—'}`} />
        </div>
      )}
      {넷 && (
        <div className={관.card}>
          <p className={관.h3 + ' mb-[12px]'}>공고 칸 채움률 <span className="ml-[6px] text-[13px] font-normal text-[#555d6d]">회원 화면 공고 {회원화면 ?? '—'}건 중 · {넷.잰때 ? new Date(넷.잰때).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} 잼</span></p>
          <가로막대들 단위="%" 줄들={['접수마감', '근무지', '지원자격', '모집인원', '예상연봉', '마감시각', '바쁜정도', '병원뜯어보기']
            .filter((k) => n(k, 칸) != null).map((k) => ({ 이름: k, n: n(k, 칸) as number }))} />
          {n('마감시각_분모', 칸) != null && (
            <p className={관.sub + ' mt-[12px]'}>마감시각은 시각을 주는 출처 공고 {n('마감시각_분모', 칸)}건 중 {n('마감시각_찬것', 칸)}건 · 예상연봉은 금액이 적힌 비율(「내규에 따름」은 안 셈)</p>
          )}
        </div>
      )}
      {cover && cover.length > 0 && (
        <>
          <p className={관.muted}>1층 대상 기관 <b className="text-[#112231]">{대상.toLocaleString('ko-KR')}곳</b> 중 최근 30일 공고가 들어온 곳 <b className="text-[#112231]">{들어옴.toLocaleString('ko-KR')}곳</b>
            {대상 > 0 && ` (${Math.round((들어옴 / 대상) * 100)}%)`}</p>
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[520px]'}>
              <thead className={관.thead}>
                <tr><th className={관.th}>갈래</th><th className={관.th + ' text-right'}>대상</th><th className={관.th + ' text-right'}>30일 안 들어옴</th><th className={관.th}>비율</th></tr>
              </thead>
              <tbody>
                {cover.map((c) => (
                  <tr key={c.갈래} className={관.tr}>
                    <td className={관.tdMain}>{c.갈래}
                      {!c.분모인가 && <span className="mt-[2px] block text-[12px] font-normal text-[#555d6d]">{c.어떻게}</span>}</td>
                    <td className={관.td + ' text-right tabular-nums'}>{Number(c.대상).toLocaleString('ko-KR')}</td>
                    <td className={관.td + ' text-right tabular-nums font-bold text-[#112231]'}>{Number(c.들어온곳).toLocaleString('ko-KR')}</td>
                    <td className={관.td}>
                      <span className="flex items-center gap-[8px]">
                        <span className="h-[8px] w-[80px] overflow-hidden rounded-full bg-[#f1f5f8]">
                          <span className={'block h-full rounded-full ' + (c.분모인가 ? 'bg-[#304f65]' : 'bg-[#a1aebb]')} style={{ width: `${Math.min(100, Number(c.퍼센트))}%` }} />
                        </span>
                        <span className="tabular-nums">{c.퍼센트}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={관.sub}>기관 이름으로 견줘 셉니다(같은 이름을 쓰는 다른 기관이 섞일 수 있어요). 치매센터처럼 중앙 게시판으로 모이는 갈래는 기관 수로 세지 않아요</p>
        </>
      )}
    </AdminSection>
  );
}

function 신뢰칸({ 이름, v, 분모, 덧 }: { 이름: string; v: number | null; 분모: number | null; 덧?: ReactNode }) {
  const 좋음 = v === 0;
  return (
    <div className={'rounded-[12px] border px-[15px] py-[12px] ' + (v == null ? 'border-[#dde4e6] bg-white' : 좋음 ? 'border-[#b9e9d2] bg-[#ebfdf2]' : 'border-[#ffd4cf] bg-[#fff5f3]')}>
      <p className="text-[14px] font-bold text-[#304f65]">{이름}</p>
      <p className={'mt-[4px] text-[28px] font-bold leading-none tabular-nums ' + (v == null ? 'text-[#304f65]' : 좋음 ? 'text-[#065a2e]' : 'text-[#b42a21]')}>
        {v == null ? '—' : `${v}건`}
      </p>
      <p className="mt-[6px] text-[13px] text-[#555d6d]">목표 0{분모 != null ? ` · 회원 화면 ${분모}건 중` : ''}{덧 ? <> · {덧}</> : null}</p>
    </div>
  );
}
