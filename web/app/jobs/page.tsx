import Link from 'next/link';
import { Hit } from '@/components/hit';
import { Icon } from '@/components/icon';
import { JobTabs } from '@/components/job-tabs';
import { MembersOnly } from '@/components/members-only';
import { jobViews } from '@/lib/job-views';
import { supabase, TABS, tabLabel, type JobListItem } from '@/lib/supabase';
import { serverSupabase } from '@/lib/supabase-server';
import { OrgCard } from '../org-card';

export const dynamic = 'force-dynamic';   // 공고는 자주 바뀝니다

/* 공고 목록·검색.

   ── 2026-09-25 에 바뀐 것 ──────────────────────────────────────────
   **회원만 봅니다. 한 번에 20건씩.**

   그 전에는 로그인 없이 요청 한 번에 100건이 나갔습니다 (총 497건).
   실제로 쏴서 확인했습니다 — Content-Range: 0-99/497.
   화면에서 흐리기만 했지 자료는 그대로 나가고 있었습니다.

   지금은 DB 의 job_list() 만 이 목록을 내줍니다. 그 함수가
     · auth.uid() 가 없으면 거절하고
     · 20건에서 끊습니다 — 부르는 쪽이 더 달라고 해도
   화면은 서버에서 **그 사람의 쿠키로** 읽습니다 (lib/supabase-server.ts).

   맛보기(Clip)는 뺐습니다. 자료가 아예 안 오기 때문에 흐릴 것이 없습니다 —
   대신 「회원만 볼 수 있어요」 카드를 놓습니다. */

const JOBS = ['작업치료사', '물리치료사'];
const SIDOS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
               '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

/** 한 쪽에 몇 건인지. DB 의 job_list() 와 같아야 합니다 */
const PAGE = 20;

function d(v: string | null) {
  return v ? v.slice(5).replace('-', '.') : '';
}
function dday(to: string | null) {
  if (!to) return null;
  const left = Math.ceil((new Date(to + 'T23:59:59+09:00').getTime() - Date.now()) / 86400000);
  if (left < 0) return { text: '마감', urgent: false, over: true };
  if (left === 0) return { text: '오늘 마감', urgent: true, over: false };
  return { text: 'D-' + left, urgent: left <= 3, over: false };
}

type SP = {
  job?: string; sido?: string; all?: string; tab?: string;
  q?: string; sort?: string; p?: string;
};

export default async function Jobs({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const searching = q.length > 0;
  const page = Math.max(0, Number(sp.p ?? 0) || 0);

  /* 검색 중에는 탭을 안 씁니다 — 전체에서 찾고, 어느 탭 공고인지 줄마다 붙입니다 */
  const active = searching ? null : (TABS.find((t) => t.key === sp.tab) ?? TABS[0]);

  /* 쿠키에 실려 온 세션으로 읽습니다. 로그인 안 했으면 job_list 가 거절합니다 */
  const sb = await serverSupabase();

  const [list, counts, cards] = await Promise.all([
    sb.rpc('job_list', {
      p_job: sp.job ?? null,
      p_sido: sp.sido ?? null,
      p_tab: active?.like ?? null,
      p_q: q || null,
      p_all: !!sp.all,
      p_sort: sp.sort ?? null,
      p_page: page,
    }),
    sb.rpc('job_counts', {
      p_job: sp.job ?? null,
      p_sido: sp.sido ?? null,
      p_q: q || null,
      p_all: !!sp.all,
      p_tabs: TABS.map((t) => t.like),
    }),
    /* 분류 카드 그림은 누구나 봅니다 (관리자가 올린 그림 경로뿐입니다) */
    supabase.from('job_tab_cards').select('tab_key,image_path'),
  ]);

  /* 42501 = 권한 없음. 로그인 안 한 분입니다 — 오류가 아니라 안내를 그립니다 */
  const locked = list.error?.code === '42501';
  const rows = (list.data ?? []) as unknown as JobListItem[];

  /* 조건에 맞는 전체 건수입니다. job_list 가 줄마다 같은 값을 붙여 보냅니다
     (org_search 와 같은 방식). 「다음 쪽이 있나」를 이걸로 가릅니다 —
     「받은 줄이 20이면 다음 쪽이 있다」로 보면, 전체가 딱 20의 배수일 때
     빈 쪽으로 가는 「다음쪽」이 생깁니다. 오늘이 정확히 그랬습니다 (320건) */
  const matched = Number((rows[0] as unknown as { total?: number })?.total ?? 0);
  const hasNext = (page + 1) * PAGE < matched;

  const tally = (counts.data ?? {}) as Record<string, number>;
  const tabCounts = TABS.map((t) => Number(tally[t.like] ?? 0));
  const total = tabCounts.reduce((a, b) => a + b, 0);

  const tabImages: Record<string, string | null> = {};
  ((cards.data ?? []) as { tab_key: string; image_path: string | null }[])
    .forEach((c) => { tabImages[c.tab_key] = c.image_path; });

  /* 지금 화면에 뜨는 것만 셉니다 (lib/job-views.ts) */
  const views = await jobViews(rows.map((r) => r.id));

  const link = (patch: Partial<Record<keyof SP, string | undefined>>) => {
    /* 조건을 바꾸면 쪽 번호는 처음으로 돌아갑니다 —
       3쪽을 보다 지역을 바꾸면 없는 쪽으로 가서 빈 화면이 납니다 */
    const next = { ...sp, p: undefined, ...patch };
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return s ? '/jobs?' + s : '/jobs';
  };

  const byDeadline = sp.sort === 'deadline';

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="jobs" />

      <header className="mb-7">
        <h1 className="break-keep text-h1 font-bold">{byDeadline ? '마감 임박 공고' : '채용공고'}</h1>
        <p className="mt-1 break-keep text-lg text-gray-500">
          {byDeadline
            ? '마감일이 가까운 순서입니다'
            : '작업치료사 · 물리치료사 · 공공기관과 병원에서 모아요'}
        </p>
        {byDeadline && (
          <Link href={link({ sort: undefined })} className="mt-2 inline-block text-sm text-interaction-blue hover:underline">
            최근 올라온 순으로 보기
          </Link>
        )}
      </header>

      {/* 검색 — 서버가 받게 GET 폼입니다. 자바스크립트 없이도 됩니다 */}
      <form action="/jobs" method="get" role="search" className="mb-6 flex gap-2">
        {sp.job && <input type="hidden" name="job" value={sp.job} />}
        {sp.sido && <input type="hidden" name="sido" value={sp.sido} />}
        {sp.all && <input type="hidden" name="all" value={sp.all} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="기관 이름이나 공고 제목으로 찾기"
          aria-label="공고 검색"
          className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white transition-colors hover:bg-brand-red-dark active:scale-[0.98]"
        >
          찾기
        </button>
      </form>

      {searching ? (
        <div className="mb-6 flex flex-wrap items-baseline gap-3">
          <p className="break-keep text-lg text-gray-700 dark:text-gray-300">
            <span className="font-bold">{q}</span>
            {locked ? ' — 회원만 볼 수 있어요' : ` — 네 탭 전체에서 ${total}건`}
          </p>
          <Link href={link({ q: undefined })} className="text-sm text-interaction-blue hover:underline">
            검색 지우기
          </Link>
        </div>
      ) : (
        /* 분류 카드. 로그인 전에는 건수를 안 붙입니다 — 셀 수가 없습니다 */
        <JobTabs
          images={tabImages}
          hrefs={Object.fromEntries(TABS.map((t) => [t.key, link({ tab: t.key })]))}
          active={active?.key ?? null}
          counts={locked ? null : tabCounts}
        />
      )}

      <nav className="mb-7 space-y-2" aria-label="거르기">
        <div className="flex flex-wrap gap-2">
          <Chip href={link({ job: undefined })} on={!sp.job}>전체 직군</Chip>
          {JOBS.map((j) => (
            <Chip key={j} href={link({ job: j })} on={sp.job === j}>{j}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip href={link({ sido: undefined })} on={!sp.sido}>전국</Chip>
          {SIDOS.map((s) => (
            <Chip key={s} href={link({ sido: s })} on={sp.sido === s}>{s}</Chip>
          ))}
        </div>
        <div>
          <Chip href={link({ all: sp.all ? undefined : '1' })} on={!!sp.all}>
            마감된 것도 보기
          </Chip>
        </div>
      </nav>

      {/* 기관 이름으로 찾으면 그 기관이 어떤 곳인지 먼저 보여줍니다 (회원만) */}
      {searching && !locked && <OrgCard name={q} />}

      {locked && (
        <MembersOnly
          title={<>공고는<br />회원만 볼 수 있어요</>}
          body="공공기관 · 대학병원 · 종합병원 공고를 하나도 안 빼고 모읍니다. 가입은 3분이면 끝나요."
        />
      )}

      {!locked && list.error && (
        <p className="break-keep rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          공고를 불러오지 못했어요 — {list.error.message}
        </p>
      )}

      {!locked && !list.error && rows.length === 0 && (
        <p className="break-keep py-8 text-center text-lg text-gray-500">
          {searching ? `「${q}」 로 찾은 공고가 없어요`
            : page > 0 ? '이 쪽에는 공고가 없어요' : '조건에 맞는 공고가 없어요'}
        </p>
      )}

      {!locked && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => {
            const dd = dday(r.apply_to);
            return (
              <li key={r.id}>
                <Link
                  href={`/jobs/${r.id}`}
                  className="-mx-4 block rounded-sm px-4 py-6 hover:bg-gray-50 dark:hover:bg-gray-950"
                >
                  <div className="flex items-baseline justify-between gap-5">
                    <span className="break-keep text-sm text-gray-500">{r.org_name}</span>
                    {dd && (
                      <span className={
                        'shrink-0 text-sm font-bold ' +
                        (dd.over ? 'text-gray-400' : dd.urgent ? 'text-brand-red' : 'text-gray-600')
                      }>
                        {dd.text}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-keep text-body-lg font-medium">{r.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                    {searching && r.tab && (
                      <span className="rounded-md bg-badge-blue-bg px-3 font-medium text-interaction-blue">
                        {tabLabel(r.tab)}
                      </span>
                    )}
                    {r.job_group && <span className="font-medium text-gray-700 dark:text-gray-300">{r.job_group}</span>}
                    {r.work_place && <span>{r.work_place}</span>}
                    {r.employ_type && <span>{r.employ_type}</span>}
                    {r.headcount ? <span>{r.headcount}명</span> : null}
                    {(r.apply_from || r.apply_to) && (
                      <span>{d(r.apply_from)}~{d(r.apply_to)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Icon name="eye" size={13} className="shrink-0" />
                      <span className="num tabular-nums">{views[r.id] ?? 0}</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* 쪽 넘기기. 한 번에 20건이라 여기가 있어야 끝까지 볼 수 있습니다 */}
      {!locked && (page > 0 || hasNext) && (
        <nav className="mt-7 flex items-center justify-between gap-3" aria-label="쪽 넘기기">
          {page > 0 ? (
            <Link
              href={link({ p: String(page - 1) || undefined })}
              className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
            >
              ← 앞쪽
            </Link>
          ) : <span />}

          <span className="break-keep text-sm text-gray-500">{page + 1}쪽</span>

          {hasNext ? (
            <Link
              href={link({ p: String(page + 1) })}
              className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
            >
              다음쪽 →
            </Link>
          ) : <span />}
        </nav>
      )}

      {!locked && (
        <p className="mt-7 break-keep text-sm text-gray-400">
          {searching
            ? `네 탭 전체에서 ${total}건 · 이 쪽에 ${rows.length}건`
            : `${active?.label} ${tabCounts[TABS.findIndex((t) => t.key === active?.key)]}건 중 이 쪽에 ${rows.length}건`}
          {' · 한 번에 '}{PAGE}{'건씩 보여드려요'}
        </p>
      )}
    </main>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'true' : undefined}
      /* 켜진 칩은 teal 입니다 — 빨강은 아이덴티티·CTA 자리라
         한 화면에서 마감 D-day 와 primary 를 두고 다투면 안 됩니다 */
      className={
        'rounded-md border px-4 py-1 text-sm font-medium transition-colors ' +
        (on
          ? 'border-teal-strong bg-teal-strong text-white'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950')
      }
    >
      {children}
    </Link>
  );
}
