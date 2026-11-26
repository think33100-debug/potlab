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
       가입 퍼널 5단계       → 로그인 → 가입 완료 2단계 (약관·근무 경험·정보 입력 단계 기록이 없습니다)
       방문자 구성           → 회원 구성 (방문자는 직군을 모릅니다 · 회원 기준)
       공유 유입·커뮤니티 경로 → 화면별 조회 · 기기 (어디서 왔는지는 기록하지 않습니다)
     더한 것 — 커뮤니티 방문 수 · 광고 배너 클릭 수 · 1층 기관 커버리지(커버리지()) ·
       수집 신뢰 셋(admin_네숫자() — 아직 DB 에 없으면 그 칸만 빠집니다 · RAPO노트/SQL_1119/관리자_수집지표.sql)
     모든 숫자 옆에 분모와 날짜(기간)를 적습니다.

   ★ 2026-11-27 세중님 「날짜 선택이 안 된다 · 월별 일별 연별 · 기간 선택 · 하루에 몇 명 들어오나 ·
     회원별 조회에 라포툴킷도 · 학생 임상가들 다르게 움직이나」
     기간 — 최근 1일 · 7일 · 30일 · 직접(시작~끝) · 묶음 — 일별 · 월별 · 연별.
     기간을 따르는 숫자는 DB admin_stats_period() 한 자리가 셉니다 (RAPO노트/SQL_261127/통계_기간_회원갈래.sql).
     ★ 자가 바뀌었습니다 — 전 「방문자 수」는 본 자리마다 따로 센 키라 한 사람이 공고 다섯을 보면 다섯이었습니다
       (11/19~26 에 목록 화면 키의 약 2배). 이제 「방문 기기」는 본 자리를 뺀 사람키(11/27 부터)로 세고,
       그 전 날은 목록 화면을 연 기기 수로 어림합니다. 회원은 회원방문일(아이디)로 정확히 셉니다.
     회원 갈래(학생·현직·비회원)별 화면 조회는 11/27 부터 쌓입니다 — 그 전 기록에는 갈래가 없습니다. */

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
type TopJob = { id: string; title: string; org_name: string; views: number; outs: number };
type TopPost = { id: number; title: string; channel: string; views: number };
type Share = { day: string; shares: number; copies: number };
type Ad = { 자리: string; 이름: string; 켜짐: boolean; 오늘봄: number; 오늘누름: number; 다봄: number; 다누름: number };
type Cover = { 갈래: string; 대상: number; 들어온곳: number; 퍼센트: number; 분모인가: boolean; 어떻게: string };

type 단위 = 'day' | 'month' | 'year';
type 기간칸 = 1 | 7 | 30 | '직접';
type 묶음줄 = { at: string; visits: number; views: number; members: number; member_days: number; exact: boolean };
type Period = {
  from: string; to: string; unit: 단위; 사람키시작: string | null; who_since: string | null;
  series: 묶음줄[];
  total: { visits: number; views: number; members: number; member_days: number };
  screens: { screen: string; views: number; visits: number }[];
  devices: { device: string; views: number; visits: number }[];
  who: { who: string; screen: string; views: number; visits: number }[];
};

const SCREEN_NAME: Record<string, string> = {
  home: '홈', jobs: '공고 목록', job: '공고 상세',
  community: '커뮤니티', post: '글 상세',
  orgs: '병원정보 찾기', org: '기관 상세', other: '그 밖에',
  toolkit: '툴킷',
  'tool:tools/pay': '툴킷 · 실수령액', 'tool:tools/severance': '툴킷 · 퇴직금',
  'tool:tools/leave': '툴킷 · 연차', 'tool:tools-unemployment': '툴킷 · 실업급여',
  'tool:tools': '툴킷 · 옛 도구 목록',
};
const 화면이름 = (k: string) => SCREEN_NAME[k] ?? (k.startsWith('tool:') ? `툴킷 · ${k.slice(5)}` : k);

/* 기기는 2026-09-23 부터 담습니다. 그 전 자료에는 가릴 근거가 없습니다 */
const DEVICE_NAME: Record<string, string> = {
  mobile: '휴대폰', desktop: '피시', 모름: '2026-09-23 이전',
};

const PROVIDER_NAME: Record<string, string> = {
  kakao: '카카오', 'custom:naver': '네이버', apple: '애플', email: '이메일',
};

const 갈래차례 = ['학생', '현직', '비회원', '미정'] as const;
const 갈래말: Record<string, string> = { 학생: '학생', 현직: '현직(임상가)', 비회원: '비회원', 미정: '가입 덜 함' };

const 수 = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('ko-KR');
const 점날 = (s: string) => s.slice(5).replace('-', '.');
/* 기록 첫날 — 이 앞은 고를 수 없습니다 */
const 첫날 = '2026-09-19';
const 오늘날 = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const 날더하기 = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const 날차 = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/* 묶음 이름 — 2026-11-27 · 2026-11 · 2026 */
const 묶음말 = (at: string, u: 단위) =>
  u === 'day' ? `${Number(at.slice(5, 7))}.${Number(at.slice(8, 10))}` : u === 'month' ? `${at.slice(0, 4)}.${at.slice(5, 7)}` : `${at}년`;

export default function AdminStats() {
  const [오늘] = useState(오늘날);
  const [고름, set고름] = useState<기간칸>(7);
  const [직접, set직접] = useState({ from: 날더하기(오늘날(), -29), to: 오늘날() });
  const [단위, set단위] = useState<단위>('day');
  const 범위 = 고름 === '직접' ? 직접 : { from: 날더하기(오늘, -(고름 - 1)), to: 오늘 };

  const [now, setNow] = useState<Now | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [cover, setCover] = useState<Cover[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [기간자료, set기간자료] = useState<Period | null>(null);
  const [기간오류, set기간오류] = useState<string | null>(null);
  const [jobs, setJobs] = useState<TopJob[] | null>(null);
  const [posts, setPosts] = useState<TopPost[] | null>(null);
  const [shares, setShares] = useState<Share[] | null>(null);

  /* 기간과 상관없는 것 — 한 번만 */
  const fetchFixed = useCallback(async () => {
    const sb = browserSupabase();
    const [n, ad, cv] = await Promise.all([
      sb.rpc('admin_stats_now'),
      sb.rpc('admin_광고배너'),
      sb.rpc('커버리지'),
    ]);
    return {
      err: n.error?.message ?? null,
      now: n.data as Now | null,
      ads: ad.error ? [] : (ad.data ?? []) as Ad[],
      cover: cv.error ? [] : (cv.data ?? []) as Cover[],
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchFixed().then((r) => {
      if (!alive) return;
      setErr(r.err); setNow(r.now); setAds(r.ads); setCover(r.cover);
    });
    return () => { alive = false; };
  }, [fetchFixed]);

  /* 기간을 따르는 것 — 고를 때마다.
     많이 본 공고·글과 공유는 「며칠 전부터 오늘까지」만 받는 옛 창구라 시작일부터 오늘까지로 셉니다 */
  const { from, to } = 범위;
  useEffect(() => {
    let alive = true;
    const sb = browserSupabase();
    const 며칠 = Math.max(1, 날차(from, 오늘) + 1);
    Promise.all([
      sb.rpc('admin_stats_period', { p_from: from, p_to: to, p_unit: 단위 }),
      sb.rpc('admin_stats_top_jobs', { p_days: 며칠, p_limit: 10 }),
      sb.rpc('admin_stats_top_posts', { p_days: 며칠, p_limit: 10 }),
      sb.rpc('admin_stats_shares', { p_days: Math.min(90, 며칠) }),
    ]).then(([p, tj, tp, sh]) => {
      if (!alive) return;
      set기간오류(p.error ? p.error.message : null);
      if (!p.error) set기간자료(p.data as Period);
      setJobs(tj.error ? [] : (tj.data ?? []) as TopJob[]);
      setPosts(tp.error ? [] : (tp.data ?? []) as TopPost[]);
      setShares(sh.error ? null : (sh.data ?? []) as Share[]);
    }, (e: unknown) => { if (alive) set기간오류(String(e)); });
    return () => { alive = false; };
  }, [from, to, 단위, 오늘]);

  if (err) {
    return <p role="alert" className={관.error}>통계를 못 읽었어요 — {err}</p>;
  }
  if (!now) return <p className={관.muted}>세는 중…</p>;

  const 기간말 = `${점날(from)} – ${점날(to)}`;
  const 끝이오늘 = to === 오늘;
  const p = 기간자료;
  const 어림있음 = (p?.series ?? []).some((s) => !s.exact);

  /* ── 기간 지표 ── */
  const 가입 = now.signup ? (고름 === 1 ? now.signup.d1 : now.signup.d7) : null;
  const 시작 = 가입 ? Number(가입.started) : null;
  const 못마침 = 가입 ? Number(가입.started) - Number(가입.done) : 0;
  const 이탈 = 시작 == null ? null : 시작 === 0 ? '—' : String(Math.round((못마침 / 시작) * 100));

  const 공유날 = (shares ?? []).filter((d) => d.day >= from && d.day <= to);
  const 공유합 = 공유날.reduce((a, d) => a + Number(d.shares ?? 0) + Number(d.copies ?? 0), 0);

  const 커뮤 = p?.screens.find((s) => s.screen === 'community') ?? null;

  const 하루 = 고름 === 1;
  const 배너봄 = (ads ?? []).reduce((a, o) => a + Number(하루 ? o.오늘봄 : o.다봄), 0);
  const 배너누름 = (ads ?? []).reduce((a, o) => a + Number(하루 ? o.오늘누름 : o.다누름), 0);

  const 작은추이 = (p?.series ?? []).slice(-14);

  return (
    <div className="max-w-[932px]">
      <RapoAdminHeader title="통계">
        <div className="flex flex-col items-start gap-[8px]">
          <기간고르기 고름={고름} set고름={set고름} 직접={직접} set직접={set직접} 오늘={오늘} 기간말={기간말} />
          <CSV단추 받기={() => 통계CSV({ from, to, now, ads, cover, jobs, posts, shares })} />
        </div>
      </RapoAdminHeader>

      {기간오류 && <p role="alert" className={관.error}>기간 숫자를 못 읽었어요 — {기간오류}</p>}

      {/* ── 주요 지표 ── */}
      <AdminSection id="stats-main" title="주요 지표" sub={`${기간말} · 한국 시각 · 관리자 제외`}>
        <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
          <AdminMetricCard 그림="/rapo/admin/metric-visitors.svg" 이름="방문 기기"
            값={p ? 수(p.total.visits) : null} 단위="대"
            빈말={p ? undefined : '세는 중'}
            설명={`날마다 센 기기의 합 · 이틀 오면 두 번 세요${어림있음 ? ' · 11/27 전 날은 목록 화면을 연 기기로 어림' : ''}`}
            그래프={작은추이.length > 1 ? <작은꺾은선 값들={작은추이.map((d) => Number(d.visits ?? 0))} /> : null} />
          <AdminMetricCard 그림="/rapo/admin/metric-visitors.svg" 이름="들어온 회원"
            값={p ? 수(p.total.members) : null} 단위="명"
            빈말={p ? undefined : '세는 중'}
            설명={p ? `아이디 기준 · 기간 안 겹침 없이 · 날마다 센 합 ${수(p.total.member_days)}` : '아이디 기준'}
            그래프={작은추이.length > 1 ? <작은꺾은선 값들={작은추이.map((d) => Number(d.members ?? 0))} /> : null} />
          <AdminMetricCard 그림="/rapo/admin/metric-leave.svg" 이름="가입 이탈률"
            값={이탈 == null || 이탈 === '—' ? (이탈 ?? null) : 이탈} 단위={이탈 && 이탈 !== '—' ? '%' : ''}
            빈말={now.signup ? undefined : '못 셌어요'}
            설명={(시작 == null ? '로그인까지 했는데 가입을 못 마친 비율'
              : `로그인 ${시작}명 중 ${못마침}명이 못 마침 · 로그인 전에 나간 분은 못 세요`)
              + (고름 === 1 ? '' : ' · 가입 셈은 오늘·최근 7일만 있어 최근 7일로 보여요')}
            그래프={시작 ? <비율막대 비율={못마침 / 시작} /> : null} />
          <AdminMetricCard 그림="/rapo/admin/metric-share.svg" 이름="공유 버튼 클릭 수"
            값={shares == null ? null : 수(공유합)} 단위="회"
            빈말={shares == null ? '못 셌어요' : undefined}
            설명="공유창 + 링크 복사 · 11/19 부터 셈"
            그래프={공유날.length > 1 ? <작은막대 값들={공유날.slice(-14).map((d) => Number(d.shares) + Number(d.copies))} /> : null} />
          <RevisitCard />
          <AdminMetricCard 그림="/rapo/admin/metric-community.svg" 이름="커뮤니티 조회 수"
            값={p ? 수(커뮤?.views) : null} 단위="회"
            빈말={p ? undefined : '세는 중'}
            설명="커뮤니티 목록을 연 횟수 · 하루·같은 기기 한 번" />
          <AdminMetricCard 그림="/rapo/admin/metric-ad.svg" 이름="광고 배너 클릭 수"
            값={ads == null ? null : 수(배너누름)} 단위="회"
            설명={`${하루 ? '오늘' : '켠 뒤 누적(기간과 따로)'} · 보인 ${수(배너봄)}회 중`
              + (배너봄 > 0 ? ` ${((배너누름 / 배너봄) * 100).toFixed(1)}%` : '')
              + ' · 자리별은 오픈 화면 광고에서'} />
        </div>
      </AdminSection>

      {/* ── 방문 추이 — 하루(달·해)마다 몇 명 ── */}
      <방문추이 p={p} 단위={단위} set단위={set단위} 끝이오늘={끝이오늘} 기간말={기간말} />

      {/* ── 회원 갈래별 ── */}
      <갈래별 p={p} 기간말={기간말} />

      {/* ── 가입 ── */}
      <AdminSection id="stats-signup" title="가입 흐름" sub="로그인 → 가입 완료 · 30분 안 계정은 하는 중이라 뺍니다 · 기간 고르기와 따로">
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
      <AdminSection id="stats-screens" title="어디를 보나" sub={`${기간말} · 조회는 하루·같은 기기·같은 화면 한 번`}>
        <div className="grid gap-[12px] md:grid-cols-2">
          <div className={관.card}>
            <p className={관.h3 + ' mb-[14px]'}>화면별 조회</p>
            {!p ? <p className={관.muted}>세는 중…</p> : p.screens.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (
              <가로막대들 줄들={p.screens.map((s) => ({ 이름: 화면이름(s.screen), n: Number(s.views) }))} 단위="회" />
            )}
            <p className={관.sub + ' mt-[14px]'}>툴킷은 첫 화면(툴킷)과 도구별(실수령액·퇴직금·연차·실업급여)로 나눠 세요</p>
          </div>
          <div className={관.card}>
            <p className={관.h3 + ' mb-[14px]'}>피시 · 휴대폰</p>
            {!p ? <p className={관.muted}>세는 중…</p> : p.devices.length === 0 ? <p className={관.muted}>아직 기록이 없어요</p> : (() => {
              const all = p.devices.reduce((a, x) => a + Number(x.views), 0) || 1;
              return <가로막대들 줄들={p.devices.map((d) => ({
                이름: DEVICE_NAME[d.device] ?? d.device, n: Number(d.views),
                덧: `${Math.round((Number(d.views) / all) * 100)}%` }))} 단위="회" />;
            })()}
            <p className={관.sub + ' mt-[14px]'}>
              화면 조회 수로 나눠요. 기기는 2026-09-23 부터 담습니다. 그 전은 「2026-09-23 이전」으로 묶여요. 태블릿은 휴대폰 쪽으로 셉니다
            </p>
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
      <AdminSection id="stats-topjobs" title="많이 본 공고" sub={`${점날(from)} – 오늘 · 「열기」는 원문 공고를 누른 수 — 광고 값을 매길 때 제일 단단해요`}>
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
      <AdminSection id="stats-topposts" title="많이 본 글" sub={`${점날(from)} – 오늘`}>
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

/* 원본 「운영 / 조회 기간」 — 최근 1일 · 7일 · 30일 + 직접(시작~끝) (2026-11-27 세중님 「기간 선택도 있어야」) */
function 기간고르기({ 고름, set고름, 직접, set직접, 오늘, 기간말 }: {
  고름: 기간칸; set고름: (n: 기간칸) => void;
  직접: { from: string; to: string }; set직접: (v: { from: string; to: string }) => void;
  오늘: string; 기간말: string;
}) {
  const 단추 = (on: boolean) => 'rounded-[5px] px-[8px] py-[5px] text-[14px] text-[#112231] ' + (on ? 'bg-[#dde7ee] font-bold' : '');
  /* 시작이 끝보다 늦으면 다른 쪽을 따라 옮깁니다 — 거꾸로 된 기간을 만들지 않습니다 */
  const 시작바꿈 = (v: string) => { if (v) set직접({ from: v, to: v > 직접.to ? v : 직접.to }); };
  const 끝바꿈 = (v: string) => { if (v) set직접({ from: v < 직접.from ? v : 직접.from, to: v }); };
  return (
    <div className="flex flex-col items-start gap-[8px]">
      <div role="group" aria-label="조회 기간"
        className="flex flex-wrap items-center gap-[6px] rounded-[8px] border border-[#dde4e6] bg-white px-[8px] py-[5px]">
        {([1, 7, 30] as const).map((n) => (
          <button key={n} type="button" aria-pressed={고름 === n} onClick={() => set고름(n)} className={단추(고름 === n)}>
            최근 {n}일
          </button>
        ))}
        <button type="button" aria-pressed={고름 === '직접'} onClick={() => set고름('직접')} className={단추(고름 === '직접')}>
          기간 고르기
        </button>
        <span className="flex items-center gap-[8px] px-[6px] text-[14px] text-[#112231]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG */}
          <img src="/rapo/admin/calendar.svg" alt="" width={16} height={16} />
          <span className="whitespace-nowrap">{기간말}</span>
        </span>
      </div>
      {고름 === '직접' && (
        <div className="flex flex-wrap items-center gap-[8px] text-[14px] text-[#112231]">
          <label className="flex items-center gap-[6px]">
            <span>시작</span>
            <input type="date" value={직접.from} min={첫날} max={오늘} onChange={(e) => 시작바꿈(e.target.value)}
              className="rounded-[6px] border border-[#dde4e6] bg-white px-[8px] py-[4px] tabular-nums" />
          </label>
          <label className="flex items-center gap-[6px]">
            <span>끝</span>
            <input type="date" value={직접.to} min={첫날} max={오늘} onChange={(e) => 끝바꿈(e.target.value)}
              className="rounded-[6px] border border-[#dde4e6] bg-white px-[8px] py-[4px] tabular-nums" />
          </label>
          <span className="text-[13px] text-[#555d6d]">기록은 {점날(첫날)}부터 있어요</span>
        </div>
      )}
    </div>
  );
}

/* ── CSV 내려받기 (2026-11-27 세중님 「csv 도 만들어서 누르면 통계데이터가 싹 다」) ──
   고른 기간의 통계를 한 파일에 구역별로 담습니다. 엑셀에서 한글이 안 깨지게 BOM 을 붙입니다.
   일별·월별·연별 추이와 회원 재방문은 누를 때 DB 에 다시 물어 담습니다(화면에 안 펼친 묶음까지).
   **모두 센 숫자뿐입니다** — 회원 한 명 한 명의 기록이나 회원 번호는 들어가지 않습니다 */
const csv칸 = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv줄 = (...vs: unknown[]) => vs.map(csv칸).join(',');

async function 통계CSV(c: {
  from: string; to: string; now: Now; ads: Ad[] | null; cover: Cover[] | null;
  jobs: TopJob[] | null; posts: TopPost[] | null; shares: Share[] | null;
}) {
  const sb = browserSupabase();
  const [d, m, y, mr] = await Promise.all([
    sb.rpc('admin_stats_period', { p_from: c.from, p_to: c.to, p_unit: 'day' }),
    sb.rpc('admin_stats_period', { p_from: c.from, p_to: c.to, p_unit: 'month' }),
    sb.rpc('admin_stats_period', { p_from: c.from, p_to: c.to, p_unit: 'year' }),
    sb.rpc('admin_stats_member_revisit', { p_days: 90 }),
  ]);
  const err = [d, m, y].find((r) => r.error)?.error;
  if (err) throw new Error(err.message);
  const 일 = d.data as Period, 월 = m.data as Period, 연 = y.data as Period;
  const L: string[] = [];
  const 구역 = (이름: string, 머리: string[]) => { if (L.length) L.push(''); L.push(csv줄(`[${이름}]`)); L.push(csv줄(...머리)); };

  구역('정보', ['항목', '값']);
  L.push(csv줄('기간', `${일.from} ~ ${일.to}`));
  L.push(csv줄('만든 때', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })));
  L.push(csv줄('기준', '한국 시각 · 관리자 제외 · 조회는 하루·같은 기기·같은 화면 한 번'));
  L.push(csv줄('방문 기기', '같은 기기 하루 한 번 · 달·해 묶음은 날마다 센 것의 합 · 「어림」=11/27 전(목록 화면을 연 기기로 어림)'));
  L.push(csv줄('회원', '아이디 기준 · 달·해 묶음은 그 기간에 한 번이라도 들어온 회원(겹침 없이)'));
  L.push(csv줄('회원 갈래별', `${일.who_since ?? '아직 없음'} 부터 쌓임`));

  const t = 일.total;
  const 공유 = (c.shares ?? []).filter((s) => s.day >= c.from && s.day <= c.to);
  구역('요약', ['항목', '값', '설명']);
  L.push(csv줄('방문 기기(날마다 센 합)', t.visits, '대'));
  L.push(csv줄('들어온 회원(겹침 없이)', t.members, '명'));
  L.push(csv줄('들어온 회원(날마다 센 합)', t.member_days, '명'));
  L.push(csv줄('화면 조회', t.views, '회'));
  L.push(csv줄('공유 버튼 클릭', 공유.reduce((a, s) => a + Number(s.shares) + Number(s.copies), 0), '공유창+링크 복사 · 11/19 부터'));
  if (c.now.signup) {
    L.push(csv줄('가입 시작(오늘)', c.now.signup.d1.started, '로그인'));
    L.push(csv줄('가입 완료(오늘)', c.now.signup.d1.done, ''));
    L.push(csv줄('가입 시작(최근 7일)', c.now.signup.d7.started, '로그인'));
    L.push(csv줄('가입 완료(최근 7일)', c.now.signup.d7.done, ''));
  }

  for (const [이름, P] of [['일별', 일], ['월별', 월], ['연별', 연]] as const) {
    구역(`${이름} 방문`, ['때', '방문 기기', '회원', '회원(날마다 센 합)', '화면 조회', '어림']);
    for (const s of P.series) L.push(csv줄(s.at, s.visits, s.members, s.member_days, s.views, s.exact ? '' : '어림'));
  }

  구역('화면별 조회', ['화면', '조회']);
  for (const s of 일.screens) L.push(csv줄(화면이름(s.screen), s.views));

  구역('기기별 조회', ['기기', '조회']);
  for (const s of 일.devices) L.push(csv줄(DEVICE_NAME[s.device] ?? s.device, s.views));

  구역('회원 갈래별 화면 조회', ['갈래', '화면', '조회', '그 갈래 안 비율(%)']);
  const 갈래합: Record<string, number> = {};
  for (const r of 일.who) 갈래합[r.who] = (갈래합[r.who] ?? 0) + Number(r.views);
  for (const r of [...일.who].sort((a, b) => a.who.localeCompare(b.who) || Number(b.views) - Number(a.views))) {
    L.push(csv줄(갈래말[r.who] ?? r.who, 화면이름(r.screen), r.views, Math.round((Number(r.views) / (갈래합[r.who] || 1)) * 1000) / 10));
  }

  구역(`많이 본 공고 (${c.from} ~ 오늘)`, ['공고명', '기관명', '조회', '열기(원문 누름)', '공고 번호']);
  for (const j of c.jobs ?? []) L.push(csv줄(j.title, j.org_name, j.views, j.outs, j.id));

  구역(`많이 본 글 (${c.from} ~ 오늘)`, ['글 제목', '게시판', '조회', '글 번호']);
  for (const p of c.posts ?? []) L.push(csv줄(p.title, channelName(p.channel), p.views, p.id));

  구역('공유 버튼 일별', ['날', '공유창', '링크 복사']);
  for (const s of 공유) L.push(csv줄(s.day, s.shares, s.copies));

  구역('회원 재방문 (최근 90일 · 아이디 기준)', ['날', '들어온 회원', '처음 온 회원', '7일 안 다시 온 회원', '7일 안 재방문(%)']);
  if (!mr.error) {
    for (const r of (mr.data ?? []) as MemberRevisitRow[]) {
      if (Number(r.visit_members) > 0 || Number(r.new_members) > 0) {
        L.push(csv줄(r.day, r.visit_members, r.new_members, r.back_members, r.back_pct ?? (Number(r.new_members) > 0 ? '셈 중' : '')));
      }
    }
  }

  구역(`회원 구성 (${c.now.today} 기준)`, ['갈래', '이름', '회원']);
  for (const [k, n] of Object.entries(c.now.job_groups ?? {})) L.push(csv줄('직군', k, n));
  for (const [k, n] of Object.entries(c.now.roles ?? {})) L.push(csv줄('사용자 구분', k, n));
  for (const [k, n] of Object.entries(c.now.providers ?? {})) L.push(csv줄('로그인 수단', PROVIDER_NAME[k] ?? k, n));

  구역(`쌓여 있는 것 (${c.now.today} 기준)`, ['항목', '값']);
  L.push(csv줄('회원', c.now.members), csv줄('이번 주 가입', c.now.members_week), csv줄('오늘 가입', c.now.members_today),
    csv줄('올라간 공고', c.now.jobs), csv줄('접수 중 공고', c.now.jobs_open), csv줄('오늘 새 공고', c.now.jobs_today),
    csv줄('보류함', c.now.jobs_hold), csv줄('기관 자료', c.now.orgs), csv줄('알림 켠 사람', c.now.notify_on),
    csv줄('커뮤니티 글', c.now.posts), csv줄('댓글', c.now.comments));

  구역('광고 배너 (기간과 따로)', ['자리', '이름', '켜짐', '오늘 보임', '오늘 누름', '누적 보임', '누적 누름']);
  for (const a of c.ads ?? []) L.push(csv줄(a.자리, a.이름, a.켜짐 ? '켬' : '끔', a.오늘봄, a.오늘누름, a.다봄, a.다누름));

  구역('수집 · 1층 기관 커버리지 (최근 30일)', ['갈래', '대상', '30일 안 들어옴', '비율(%)', '분모에 넣나']);
  for (const v of c.cover ?? []) L.push(csv줄(v.갈래, v.대상, v.들어온곳, v.퍼센트, v.분모인가 ? '넣음' : `뺌 · ${v.어떻게}`));

  const blob = new Blob(['﻿' + L.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RAPO_통계_${일.from}_${일.to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CSV단추({ 받기 }: { 받기: () => Promise<void> }) {
  const [상태, set상태] = useState<'쉼' | '만드는 중' | string>('쉼');
  return (
    <div className="flex items-center gap-[8px]">
      <button type="button" disabled={상태 === '만드는 중'}
        onClick={() => { set상태('만드는 중'); 받기().then(() => set상태('쉼'), (e: unknown) => set상태(`못 만들었어요 — ${e instanceof Error ? e.message : String(e)}`)); }}
        className="rounded-[8px] border border-[#304f65] bg-white px-[12px] py-[6px] text-[14px] font-bold text-[#304f65] hover:bg-[#f1f5f8] disabled:opacity-60">
        {상태 === '만드는 중' ? 'CSV 만드는 중…' : '고른 기간 CSV 내려받기'}
      </button>
      {상태 !== '쉼' && 상태 !== '만드는 중' && <span role="alert" className="text-[13px] text-[#b42a21]">{상태}</span>}
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

/* 방문 추이 — 날(달·해)마다 몇 대·몇 명 (2026-11-27 세중님 「하루에 몇 명 들어오나 · 월별 일별 연별」).
   전 「최근 30일 방문」 칸을 대신합니다. 그 칸의 큰 숫자는 「오늘 지금까지」였고 기간을 못 골랐습니다 */
const 단위말: Record<단위, string> = { day: '일별', month: '월별', year: '연별' };
function 방문추이({ p, 단위, set단위, 끝이오늘, 기간말 }: {
  p: Period | null; 단위: 단위; set단위: (u: 단위) => void; 끝이오늘: boolean; 기간말: string;
}) {
  const 줄 = p?.series ?? [];
  const 큰 = Math.max(1, ...줄.map((d) => Number(d.visits)));
  const 마지막 = 줄.length ? 줄[줄.length - 1] : null;
  const 앞 = 줄.length > 1 ? 줄[줄.length - 2] : null;
  const 칸이름 = 단위 === 'day' ? '날' : 단위 === 'month' ? '달' : '해';
  const 앞말 = 단위 === 'day' ? '전날' : 단위 === 'month' ? '전달' : '전해';
  const 어림 = 줄.some((d) => !d.exact);
  return (
    <AdminSection id="stats-trend" title="방문 추이" sub={`${기간말} · ${단위말[단위]} · 관리자 제외`}>
      <div className={관.card}>
        <div role="group" aria-label="묶음 단위" className="mb-[16px] inline-flex gap-[4px] rounded-[8px] border border-[#dde4e6] bg-white p-[3px]">
          {(['day', 'month', 'year'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={단위 === u} onClick={() => set단위(u)}
              className={'rounded-[5px] px-[10px] py-[4px] text-[14px] text-[#112231] ' + (단위 === u ? 'bg-[#dde7ee] font-bold' : '')}>
              {단위말[u]}
            </button>
          ))}
        </div>
        {!p ? <p className={관.muted}>세는 중…</p> : 줄.length === 0 || !마지막 ? <p className={관.muted}>아직 기록이 없어요</p> : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-[16px] gap-y-[4px]">
              <p className="text-[32px] font-bold leading-none tabular-nums text-[#112231]">{수(마지막.visits)}<span className="ml-[3px] text-[15px]">대</span></p>
              {앞 && <어제견줌 v={Number(마지막.visits)} prev={Number(앞.visits)} 앞말={앞말} 진행중={끝이오늘} />}
            </div>
            <p className={관.sub + ' mt-[6px]'}>
              {끝이오늘 ? (단위 === 'day' ? '오늘(지금까지)' : `${묶음말(마지막.at, 단위)}(지금까지)`) : 묶음말(마지막.at, 단위)} 방문 기기
              {' · '}회원 {수(마지막.members)}명 · 화면 조회 {수(마지막.views)}
            </p>
            {/* 라이브러리 없이 막대. 날이 많으면 막대가 가늘어집니다 */}
            <div className="mt-[16px] flex h-[120px] items-end gap-[2px]" role="img"
                 aria-label={`${단위말[단위]} 방문 기기 · ${줄.map((d) => `${묶음말(d.at, 단위)} ${d.visits}`).join(', ')}`}>
              {줄.map((d, i) => (
                <div key={d.at} className="group relative min-w-0 flex-1">
                  <div
                    className={'w-full rounded-t-[3px] transition-colors hover:bg-[#ff4f40] ' + (i === 줄.length - 1 ? 'bg-[#223d51]' : 'bg-[#c7d1d9]')}
                    style={{ height: Math.max(2, (Number(d.visits) / 큰) * 120) }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-[4px] hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#112231] px-[8px] py-[4px] text-[12px] text-white group-hover:block">
                    {묶음말(d.at, 단위)} · {d.visits}대 · 회원 {d.members}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-[6px] flex justify-between text-[13px] text-[#555d6d]">
              <span>{묶음말(줄[0].at, 단위)}</span>
              <span>{묶음말(마지막.at, 단위)}</span>
            </div>
            <div className={관.tableWrap + ' mt-[16px] max-h-[360px] overflow-y-auto'}>
              <table className={관.table + ' min-w-[360px] tabular-nums'}>
                <thead className={관.thead}>
                  <tr>
                    <th className={관.th}>{칸이름}</th>
                    <th className={관.th + ' text-right'}>방문 기기</th>
                    <th className={관.th + ' text-right'}>회원</th>
                    <th className={관.th + ' text-right'}>화면 조회</th>
                  </tr>
                </thead>
                <tbody>
                  {[...줄].reverse().map((d) => (
                    <tr key={d.at} className={관.tr}>
                      <td className={관.td}>{묶음말(d.at, 단위)}{!d.exact && <span className="ml-[4px] text-[12px] text-[#555d6d]">어림</span>}</td>
                      <td className={관.td + ' text-right font-bold text-[#112231]'}>{수(d.visits)}</td>
                      <td className={관.td + ' text-right'}>{수(d.members)}</td>
                      <td className={관.td + ' text-right'}>{수(d.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className={관.sub + ' mt-[14px]'}>
          방문 기기 — 같은 기기는 하루 한 번 세요(폰·PC 로 보면 둘). 달·해로 묶으면 날마다 센 것을 더해요(이틀 오면 두 번).
          회원 — 아이디 기준이에요. 달·해로 묶으면 그 기간에 한 번이라도 들어온 회원 수예요(겹침 없이).
          {어림 && ' 「어림」 표시가 있는 날(11/27 전)은 목록 화면(홈·공고 목록 등)을 연 기기로 어림했어요 — 공고 상세만 바로 연 분은 빠져요. 전에 이 자리의 「방문자 수」는 본 화면마다 따로 세어 실제보다 약 2배 컸어요.'}
        </p>
      </div>
    </AdminSection>
  );
}

/* 회원 갈래별로 어디를 보나 (2026-11-27 세중님 「학생 임상가들 다르게 움직이나 · 라포툴킷도」).
   갈래는 page_hits.회원갈래 — 11/27 부터 쌓입니다. % 는 **그 갈래가 본 화면 가운데** 몇 % 인지라
   사람 수가 달라도 「어디를 더 보나」를 견줄 수 있습니다 */
function 갈래별({ p, 기간말 }: { p: Period | null; 기간말: string }) {
  const 줄 = p?.who ?? [];
  const 합: Record<string, number> = {};
  const 화면합: Record<string, number> = {};
  const 칸: Record<string, number> = {};
  for (const r of 줄) {
    합[r.who] = (합[r.who] ?? 0) + Number(r.views);
    화면합[r.screen] = (화면합[r.screen] ?? 0) + Number(r.views);
    칸[`${r.who}|${r.screen}`] = Number(r.views);
  }
  const 갈래들 = 갈래차례.filter((g) => (합[g] ?? 0) > 0);
  const 화면들 = Object.keys(화면합).sort((a, b) => 화면합[b] - 화면합[a]);
  return (
    <AdminSection id="stats-who" title="회원 갈래별로 어디를 보나" sub={`${기간말} · 화면 조회 · 관리자 제외`}>
      {!p ? <p className={관.muted}>세는 중…</p> : 갈래들.length === 0 ? (
        <p className={관.muted}>아직 기록이 없어요 — 11/27 부터 쌓아요</p>
      ) : (
        <div className={관.tableWrap}>
          <table className={관.table + ' min-w-[480px] tabular-nums'}>
            <thead className={관.thead}>
              <tr>
                <th className={관.th}>화면</th>
                {갈래들.map((g) => <th key={g} className={관.th + ' text-right'}>{갈래말[g]}</th>)}
              </tr>
            </thead>
            <tbody>
              {화면들.map((s) => (
                <tr key={s} className={관.tr}>
                  <td className={관.tdMain}>{화면이름(s)}</td>
                  {갈래들.map((g) => {
                    const n = 칸[`${g}|${s}`] ?? 0;
                    return (
                      <td key={g} className={관.td + ' text-right'}>
                        <b className="text-[#112231]">{수(n)}</b>
                        <span className="ml-[6px] text-[12px] text-[#555d6d]">{Math.round((n / 합[g]) * 100)}%</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className={관.tr}>
                <td className={관.tdMain}>합계</td>
                {갈래들.map((g) => <td key={g} className={관.td + ' text-right font-bold text-[#112231]'}>{수(합[g])}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className={관.sub}>
        % 는 그 갈래가 본 화면 가운데 몇 % 인지예요 — 사람 수가 달라도 학생과 현직이 어디를 더 보는지 견줄 수 있어요.
        {p?.who_since ? ` ${점날(p.who_since)}부터 쌓기 시작했어요 — 그 전 조회에는 갈래가 없어요.` : ' 11/27 부터 쌓아요 — 그 전 조회에는 갈래가 없어요.'}
        {' '}「가입 덜 함」은 로그인했지만 학생·현직을 아직 안 고른 분이에요. 관리자가 「학생」 등으로 바꿔 본 화면은 빼요
      </p>
    </AdminSection>
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

/* 앞 칸과 견줌. ★ 2026-11-27 — 마지막 칸이 「지금까지」(오늘·이번 달)면 화살표를 안 그립니다.
   새벽에 「오늘 12 ▼194(−94%) 어제 206」처럼 보여 줄어든 것으로 읽혔습니다 — 하루가 안 끝난 것입니다 */
function 어제견줌({ v, prev, 앞말 = '어제', 진행중 = false }: { v: number; prev: number; 앞말?: string; 진행중?: boolean }) {
  if (진행중) {
    return <p className="text-[14px] text-[#555d6d]">{앞말} {prev.toLocaleString('ko-KR')} · 아직 안 끝나 견주지 않아요</p>;
  }
  const diff = v - prev;
  const pct = prev ? Math.round((diff / prev) * 100) : null;
  return (
    <p className={'text-[14px] font-bold ' + (diff > 0 ? 'text-[#065a2e]' : diff < 0 ? 'text-[#b42a21]' : 'text-[#555d6d]')}>
      {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff).toLocaleString('ko-KR')}
      {pct != null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
      <span className="ml-[8px] font-normal text-[#555d6d]">{앞말} {prev.toLocaleString('ko-KR')}</span>
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
