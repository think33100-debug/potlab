import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase, SOURCE_NAME, type JobPost } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/* 시트의 본문 칸들이 detail jsonb 로 들어와 있습니다. 보여줄 순서를 정합니다. */
const DETAIL_ORDER = ['지원자격', '우대사항', '자격증', '전형방법', '일정',
                      '제출서류', '접수방법', '결격사유', '문의처', '연봉', '기관홈'];

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('job_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          공고를 불러오지 못했습니다 — {error.message}
        </p>
      </main>
    );
  }
  if (!data) notFound();
  const j = data as unknown as JobPost;

  const detail = j.detail ?? {};
  const keys = [
    ...DETAIL_ORDER.filter((k) => detail[k]),
    ...Object.keys(detail).filter((k) => !DETAIL_ORDER.includes(k)),
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← 목록</Link>

      <header className="mt-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <p className="text-sm text-neutral-500">{j.org_name}</p>
        <h1 className="mt-1 text-xl font-bold leading-snug">{j.title}</h1>
        <dl className="mt-4 grid grid-cols-[5.5rem_1fr] gap-y-1.5 text-sm">
          <Row label="직군" v={j.job_group} />
          <Row label="근무지" v={j.work_place} />
          <Row label="고용형태" v={j.employ_type} />
          <Row label="채용구분" v={j.hire_type} />
          <Row label="학력" v={j.edu} />
          <Row label="인원" v={j.headcount ? j.headcount + '명' : null} />
          <Row label="접수" v={j.apply_from || j.apply_to
            ? `${j.apply_from ?? '?'} ~ ${j.apply_to ?? '?'}` : null} />
          <Row label="공고일" v={j.posted_at} />
          <Row label="기관종별" v={j.org_kind} />
        </dl>

        <a
          href={j.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
        >
          원문 공고 열기
        </a>
      </header>

      {keys.length > 0 ? (
        <div className="mt-6 space-y-5">
          {keys.map((k) => (
            <section key={k}>
              <h2 className="text-sm font-semibold">{k}</h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {detail[k]}
              </p>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-neutral-500">
          이 공고는 본문을 못 받아왔습니다. 위 「원문 공고 열기」 를 눌러 주세요.
        </p>
      )}

      <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800">
        <p>출처 {SOURCE_NAME[j.source] ?? j.source} · 수집 {j.collected_at?.slice(0, 10)}</p>
        {j.evidence?.['탭근거'] && <p className="mt-1">분류 근거 — {j.evidence['탭근거']}</p>}
      </footer>
    </main>
  );
}

function Row({ label, v }: { label: string; v: string | null }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="break-words">{v}</dd>
    </>
  );
}
