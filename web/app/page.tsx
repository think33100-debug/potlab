import Link from 'next/link';
import { supabase, LIST_COLS, SOURCE_NAME, type JobListItem } from '@/lib/supabase';

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; sido?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase
    .from('job_posts')
    .select(LIST_COLS)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (sp.job) q = q.eq('job_group', sp.job);
  if (sp.sido) q = q.eq('sido', sp.sido);
  if (!sp.all) q = q.or(`apply_to.gte.${today},apply_to.is.null`);

  const { data, error } = await q;
  const rows = (data ?? []) as unknown as JobListItem[];

  const link = (patch: Record<string, string | undefined>) => {
    const next = { ...sp, ...patch };
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return s ? '/?' + s : '/';
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">채용공고</h1>
        <p className="mt-1 text-sm text-neutral-500">
          작업치료사 · 물리치료사 · 공공기관과 병원에서 모읍니다
        </p>
      </header>

      <nav className="mb-6 space-y-2 text-sm" aria-label="거르기">
        <div className="flex flex-wrap gap-1.5">
          <Chip href={link({ job: undefined })} on={!sp.job}>전체 직군</Chip>
          {JOBS.map((j) => (
            <Chip key={j} href={link({ job: j })} on={sp.job === j}>{j}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
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

      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          공고를 불러오지 못했습니다 — {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="py-12 text-center text-sm text-neutral-500">
          조건에 맞는 공고가 없습니다.
        </p>
      )}

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {rows.map((r) => {
          const dd = dday(r.apply_to);
          return (
            <li key={r.id}>
              <Link href={`/jobs/${r.id}`} className="block py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-neutral-500">{r.org_name}</span>
                  {dd && (
                    <span className={
                      'shrink-0 text-xs font-semibold ' +
                      (dd.over ? 'text-neutral-400' : dd.urgent ? 'text-red-600' : 'text-neutral-600')
                    }>
                      {dd.text}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-medium leading-snug">{r.title}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-neutral-500">
                  {r.job_group && <span className="font-medium text-neutral-700 dark:text-neutral-300">{r.job_group}</span>}
                  {r.work_place && <span>{r.work_place}</span>}
                  {r.employ_type && <span>{r.employ_type}</span>}
                  {r.headcount ? <span>{r.headcount}명</span> : null}
                  {r.apply_to && <span>~{d(r.apply_to)}</span>}
                  <span className="text-neutral-400">{SOURCE_NAME[r.source] ?? r.source}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-xs text-neutral-400">
        {rows.length}건 · 최근 올라온 순 · 한 번에 100건까지 보여줍니다
      </p>
    </main>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'true' : undefined}
      className={
        'rounded-full border px-2.5 py-1 text-xs transition-colors ' +
        (on
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
          : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400')
      }
    >
      {children}
    </Link>
  );
}
