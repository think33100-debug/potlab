import Link from 'next/link';
import {
  supabase, LIST_COLS, TABS, tabLabel, type JobListItem,
} from '@/lib/supabase';
import { OrgCard } from '../org-card';

export const dynamic = 'force-dynamic';   // 공고는 자주 바뀝니다

const JOBS = ['작업치료사', '물리치료사'];
const SIDOS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
               '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

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

type SP = { job?: string; sido?: string; all?: string; tab?: string; q?: string; sort?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const q = (sp.q ?? '').trim();
  const searching = q.length > 0;

  /* 거르기는 탭·검색과 상관없이 늘 같게 겁니다.
     숨김·보류는 여기서 안 뺍니다 — RLS 가 이미 뺀 것만 내려줍니다 */
  const base = () => {
    let b = supabase.from('job_posts').select(LIST_COLS);
    if (sp.job) b = b.eq('job_group', sp.job);
    if (sp.sido) b = b.eq('sido', sp.sido);
    if (!sp.all) b = b.or(`apply_to.gte.${today},apply_to.is.null`);
    if (searching) b = b.or(`title.ilike.%${q}%,org_name.ilike.%${q}%`);
    return b;
  };

  /* 탭별 건수 — 줄은 안 받고 세기만 합니다 (head: true) */
  const counts = await Promise.all(
    TABS.map(async (t) => {
      let c = supabase.from('job_posts').select('id', { count: 'exact', head: true });
      if (sp.job) c = c.eq('job_group', sp.job);
      if (sp.sido) c = c.eq('sido', sp.sido);
      if (!sp.all) c = c.or(`apply_to.gte.${today},apply_to.is.null`);
      if (searching) c = c.or(`title.ilike.%${q}%,org_name.ilike.%${q}%`);
      const { count } = await c.like('tab', t.like);
      return count ?? 0;
    }),
  );
  const total = counts.reduce((a, b) => a + b, 0);

  /* 검색 중에는 탭을 안 씁니다 — 전체에서 찾고, 어느 탭 공고인지 줄마다 붙입니다 */
  const active = searching ? null : (TABS.find((t) => t.key === sp.tab) ?? TABS[0]);

  /* 마감 임박 — 홈의 큰 배너가 여기로 보냅니다.
     이미 닫힌 것과 마감일이 없는 것은 빼고 가까운 순으로 올립니다 */
  const byDeadline = sp.sort === 'deadline';

  let list = byDeadline
    ? base().not('apply_to', 'is', null).gte('apply_to', today)
        .order('apply_to', { ascending: true }).limit(100)
    : base().order('posted_at', { ascending: false, nullsFirst: false }).limit(100);

  if (active) list = list.like('tab', active.like);

  const { data, error } = await list;
  const rows = (data ?? []) as unknown as JobListItem[];

  const link = (patch: Partial<Record<keyof SP, string | undefined>>) => {
    const next = { ...sp, ...patch };
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return s ? '/jobs?' + s : '/jobs';
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <header className="mb-7">
        <h1 className="text-h1 font-bold">{byDeadline ? '마감 임박 공고' : '채용공고'}</h1>
        <p className="mt-1 text-lg text-gray-500">
          {byDeadline
            ? '마감일이 가까운 순서예요'
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
          className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-lg font-bold text-white transition-colors hover:bg-brand-red-dark active:scale-[0.98]"
        >
          찾기
        </button>
      </form>

      {searching ? (
        <div className="mb-6 flex flex-wrap items-baseline gap-3">
          <p className="text-lg text-gray-700 dark:text-gray-300">
            <span className="font-bold">{q}</span> — 네 탭 전체에서 {total}건
          </p>
          <Link href={link({ q: undefined })} className="text-sm text-interaction-blue hover:underline">
            검색 지우기
          </Link>
        </div>
      ) : (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="탭">
          {TABS.map((t, i) => (
            <Link
              key={t.key}
              href={link({ tab: t.key })}
              aria-current={active?.key === t.key ? 'page' : undefined}
              className={
                'rounded-md border px-6 py-4 text-lg font-medium transition-colors ' +
                (active?.key === t.key
                  ? 'border-teal-strong bg-teal-strong text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950')
              }
            >
              {t.label}
              <span className={'ml-2 text-sm ' + (active?.key === t.key ? 'text-white/70' : 'text-gray-400')}>
                {counts[i]}
              </span>
            </Link>
          ))}
        </nav>
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

      {/* 기관 이름으로 찾으면 그 기관이 어떤 곳인지 먼저 보여줍니다 */}
      {searching && <OrgCard name={q} />}

      {error && (
        <p className="rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          공고를 불러오지 못했어요 — {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="py-8 text-center text-lg text-gray-500">
          {searching ? `「${q}」 로 찾은 공고가 없어요` : '조건에 맞는 공고가 없어요'}
        </p>
      )}

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
                  <span className="text-sm text-gray-500">{r.org_name}</span>
                  {dd && (
                    <span className={
                      'shrink-0 text-sm font-bold ' +
                      (dd.over ? 'text-gray-400' : dd.urgent ? 'text-brand-red' : 'text-gray-600')
                    }>
                      {dd.text}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-body-lg font-medium">{r.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                  {/* 검색 결과에서는 어느 탭 공고인지 밝힙니다 */}
                  {searching && r.tab && (
                    <span className="rounded-md bg-badge-blue-bg px-3 font-medium text-interaction-blue">
                      {tabLabel(r.tab)}
                    </span>
                  )}
                  {r.job_group && <span className="font-medium text-gray-700 dark:text-gray-300">{r.job_group}</span>}
                  {r.work_place && <span>{r.work_place}</span>}
                  {r.employ_type && <span>{r.employ_type}</span>}
                  {r.headcount ? <span>{r.headcount}명</span> : null}
                  {r.apply_to && <span>~{d(r.apply_to)}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-7 text-sm text-gray-400">
        {searching
          ? `${rows.length}건 보임 · 네 탭 전체에서 찾았어요`
          : `${active?.label} ${counts[TABS.findIndex((t) => t.key === active?.key)]}건 중 ${rows.length}건 보임`}
        {' · 최근 올라온 순 · 한 번에 100건까지'}
      </p>
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
