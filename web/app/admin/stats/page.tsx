'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { channelName } from '@/lib/channels';
import { browserSupabase } from '@/lib/supabase-browser';

/* 통계.

   숫자는 전부 DB 가 세어 줍니다 (admin_stats_* 함수).
   그 함수들은 첫 줄에서 is_admin() 으로 잠겨 있어서, 화면을 뚫어도
   관리자가 아니면 한 줄도 안 나옵니다.

   관리자가 본 것은 숫자에서 뺍니다. 옆에 따로 적어 둡니다 —
   「이 숫자에 우리가 얼마나 섞였나」를 나중에 못 가리면 안 됩니다. */

type Now = {
  today: string;
  members: number; members_today: number; members_week: number;
  job_groups: Record<string, number>;
  roles: Record<string, number>;
  providers: Record<string, number>;
  jobs: number; jobs_open: number; jobs_today: number; jobs_hold: number;
  posts: number; posts_today: number; comments: number; comments_today: number;
  notify_on: number; orgs: number;
};
type Daily = { day: string; visits: number; views: number; admin_visits: number };
type Screen = { kind: string; views: number; visits: number };
type TopJob = { id: string; title: string; org_name: string; views: number; outs: number };
type TopPost = { id: number; title: string; channel: string; views: number };

const SCREEN_NAME: Record<string, string> = {
  home: '홈', jobs: '공고 목록', job: '공고 상세',
  community: '커뮤니티', post: '글 상세', other: '그 밖에',
};

const PROVIDER_NAME: Record<string, string> = {
  kakao: '카카오', 'custom:naver': '네이버', apple: '애플', email: '이메일',
};

export default function AdminStats() {
  const [now, setNow] = useState<Now | null>(null);
  const [daily, setDaily] = useState<Daily[] | null>(null);
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [jobs, setJobs] = useState<TopJob[] | null>(null);
  const [posts, setPosts] = useState<TopPost[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const sb = browserSupabase();
    const [n, d, s, tj, tp] = await Promise.all([
      sb.rpc('admin_stats_now'),
      sb.rpc('admin_stats_daily', { p_days: 30 }),
      sb.rpc('admin_stats_screens', { p_days: 7 }),
      sb.rpc('admin_stats_top_jobs', { p_days: 7, p_limit: 10 }),
      sb.rpc('admin_stats_top_posts', { p_days: 7, p_limit: 10 }),
    ]);
    const bad = [n, d, s, tj, tp].find((r) => r.error);
    return {
      err: bad?.error?.message ?? null,
      now: n.data as Now | null,
      daily: (d.data ?? []) as Daily[],
      screens: (s.data ?? []) as Screen[],
      jobs: (tj.data ?? []) as TopJob[],
      posts: (tp.data ?? []) as TopPost[],
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      setErr(r.err); setNow(r.now); setDaily(r.daily);
      setScreens(r.screens); setJobs(r.jobs); setPosts(r.posts);
    });
    return () => { alive = false; };
  }, [fetchAll]);

  if (err) {
    return (
      <p className="rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
        통계를 못 읽었어요 — {err}
      </p>
    );
  }
  if (!now || !daily) return <p className="text-lg text-gray-400">세는 중…</p>;

  const today = daily[daily.length - 1];
  const yday = daily[daily.length - 2];
  const max = Math.max(1, ...daily.map((d) => d.visits));
  const sum = (k: keyof Daily) => daily.reduce((a, d) => a + Number(d[k] ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* ── 오늘 ── */}
      <section>
        <h2 className="text-h3 font-bold">오늘</h2>
        <p className="mt-1 text-sm text-gray-500">{now.today} · 한국 시각 기준</p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Big label="방문 수" v={today?.visits ?? 0} prev={yday?.visits}
               note="같은 분이 폰·PC로 보면 2로 세요" />
          <Big label="화면 조회" v={today?.views ?? 0} prev={yday?.views} />
          <Big label="가입" v={now.members_today} />
          <Big label="새 글·댓글" v={now.posts_today + now.comments_today} />
        </div>

        {(today?.admin_visits ?? 0) > 0 && (
          <p className="mt-3 text-sm text-gray-400">
            관리자 방문 {today.admin_visits}은 위 숫자에서 뺐어요
          </p>
        )}
      </section>

      {/* ── 30일 ── */}
      <section>
        <h2 className="text-h3 font-bold">최근 30일</h2>
        <p className="mt-1 text-sm text-gray-500">
          방문 {sum('visits').toLocaleString()} · 화면 조회 {sum('views').toLocaleString()}
          {sum('visits') === 0 && ' · 오늘부터 쌓기 시작했어요'}
        </p>

        {/* 라이브러리 없이 막대 30개. 값이 적어 이걸로 충분합니다 */}
        <div className="mt-5 flex h-[120px] items-end gap-1" role="img"
             aria-label={`최근 30일 방문 수. 가장 많은 날 ${max}`}>
          {daily.map((d) => (
            <div key={d.day} className="group relative flex-1">
              <div
                className="w-full rounded-t-xs bg-teal-strong transition-all hover:bg-brand-red"
                style={{ height: Math.max(2, (d.visits / max) * 120) }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-xs bg-gray-900 px-3 py-1 text-xs text-white group-hover:block">
                {d.day.slice(5)} · {d.visits}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-sm text-gray-400">
          <span>{daily[0]?.day.slice(5)}</span>
          <span>{daily[daily.length - 1]?.day.slice(5)}</span>
        </div>
      </section>

      {/* ── 화면별 ── */}
      <section>
        <h2 className="text-h3 font-bold">화면별 <span className="text-sm font-medium text-gray-400">최근 7일</span></h2>
        {!screens || screens.length === 0 ? (
          <p className="mt-5 text-lg text-gray-500">아직 기록이 없어요</p>
        ) : (
          <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-800">
            {screens.map((s) => (
              <li key={s.kind} className="flex items-baseline gap-5 py-4">
                <span className="text-lg font-medium">{SCREEN_NAME[s.kind] ?? s.kind}</span>
                <span className="flex-1" />
                <span className="text-body-lg font-bold">{s.views.toLocaleString()}</span>
                <span className="text-sm text-gray-400">방문 {s.visits}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 쌓여 있는 것 ── */}
      <section>
        <h2 className="text-h3 font-bold">쌓여 있는 것</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Big label="회원" v={now.members} sub={`이번 주 +${now.members_week}`} />
          <Big label="올라간 공고" v={now.jobs} sub={`접수 중 ${now.jobs_open}`} />
          <Big label="기관 자료" v={now.orgs} />
          <Big label="알림 켠 사람" v={now.notify_on} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Split title="직군" data={now.job_groups} />
          <Split title="역할" data={now.roles} />
          <Split title="로그인 수단" data={now.providers} rename={PROVIDER_NAME} />
        </div>

        <p className="mt-5 text-sm text-gray-400">
          커뮤니티 글 {now.posts} · 댓글 {now.comments} · 오늘 새 공고 {now.jobs_today} · 보류함 {now.jobs_hold}
        </p>
      </section>

      {/* ── 많이 본 공고 ── */}
      <section>
        <h2 className="text-h3 font-bold">
          많이 본 공고 <span className="text-sm font-medium text-gray-400">최근 7일</span>
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          「열기」는 원문 공고를 누른 수예요. 광고 값을 매길 때 이 숫자가 제일 단단해요
        </p>
        {!jobs || jobs.length === 0 ? (
          <p className="mt-5 text-lg text-gray-500">아직 기록이 없어요</p>
        ) : (
          <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-800">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-baseline gap-5 py-4">
                <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  <span className="text-sm text-gray-400">{j.org_name}</span>
                  <span className="ml-3 text-lg">{j.title}</span>
                </Link>
                <span className="shrink-0 text-body-lg font-bold">{j.views}</span>
                <span className="shrink-0 text-sm text-interaction-blue">열기 {j.outs}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 많이 본 글 ── */}
      <section>
        <h2 className="text-h3 font-bold">
          많이 본 글 <span className="text-sm font-medium text-gray-400">최근 7일</span>
        </h2>
        {!posts || posts.length === 0 ? (
          <p className="mt-5 text-lg text-gray-500">아직 기록이 없어요</p>
        ) : (
          <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-800">
            {posts.map((p) => (
              <li key={p.id} className="flex items-baseline gap-5 py-4">
                <Link href={`/post/${p.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  <span className="text-sm text-gray-400">{channelName(p.channel)}</span>
                  <span className="ml-3 text-lg">{p.title}</span>
                </Link>
                <span className="shrink-0 text-body-lg font-bold">{p.views}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-gray-400">
        방문·조회는 오늘부터 쌓습니다. 과거는 셀 수 없어요.
        업체에 보여줄 「하루 평균」은 최소 2주는 모아야 말할 수 있어요
      </p>
    </div>
  );
}

/* ─────────────────────────────────────── */

function Big({
  label, v, prev, sub, note,
}: { label: string; v: number; prev?: number; sub?: string; note?: string }) {
  const diff = prev == null ? null : v - prev;
  const pct = prev ? Math.round((diff! / prev) * 100) : null;

  return (
    <div className="rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-h1 font-bold tabular-nums">{v.toLocaleString()}</p>

      {diff != null && (
        <p className={'mt-1 text-sm font-medium ' +
          (diff > 0 ? 'text-teal-strong' : diff < 0 ? 'text-brand-red' : 'text-gray-400')}>
          {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff)}
          {pct != null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
          <span className="ml-2 font-normal text-gray-400">어제 {prev}</span>
        </p>
      )}
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
      {note && <p className="mt-2 text-xs leading-normal text-gray-400">{note}</p>}
    </div>
  );
}

function Split({
  title, data, rename,
}: { title: string; data: Record<string, number>; rename?: Record<string, string> }) {
  const rows = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <p className="text-sm font-bold text-gray-500">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-lg text-gray-400">없음</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map(([k, n]) => (
            <li key={k} className="flex items-baseline gap-3 text-lg">
              <span>{rename?.[k] ?? k}</span>
              <span className="flex-1 border-b border-dotted border-gray-200 dark:border-gray-700" />
              <span className="font-bold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
