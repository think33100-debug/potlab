import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminJobTools } from '@/components/admin-job-tools';
import { Hit } from '@/components/hit';
import { JobOpenLink } from '@/components/job-open-link';
import { OrgPanel } from '@/components/org-panel';
import { supabase, JOB_ONE_COLS, type JobPost } from '@/lib/supabase';
import { Clip, JoinCta } from '@/app/gate';

export const dynamic = 'force-dynamic';

/* 시트의 본문 칸들이 detail jsonb 로 들어와 있습니다. 보여줄 순서를 정합니다. */
const DETAIL_ORDER = ['지원자격', '우대사항', '자격증', '전형방법', '일정',
                      '제출서류', '접수방법', '결격사유', '문의처', '연봉', '기관홈'];

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('job_posts')
    /* select('*') 를 쓰면 안 됩니다 — 출처·수집일 칸은 회원에게 권한이 없어
       통째로 거절당합니다. 볼 수 있는 칸만 적습니다 */
    .select(JOB_ONE_COLS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
        <p className="rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          공고를 불러오지 못했어요 — {error.message}
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
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="job" target={j.id} />

      {/* 링크·보조 이동은 interaction blue 입니다 */}
      <Link href="/jobs" className="text-lg text-interaction-blue hover:underline">← 목록</Link>

      <header className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-800">
        <p className="text-lg text-gray-500">{j.org_name}</p>
        <h1 className="mt-1 text-h2 font-bold">{j.title}</h1>
        <dl className="mt-6 grid grid-cols-[5.5rem_1fr] gap-y-2 text-lg">
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

        {/* 누른 것을 셉니다 — 「본 사람」보다 「지원하러 간 사람」이 값을 매기는 근거입니다.
            primary CTA — Sparta red · 50px 알약 · 700 */}
        <JobOpenLink
          id={j.id}
          url={j.url}
          className="mt-6 inline-block rounded-md bg-brand-red px-7 py-5 text-lg font-bold text-white transition-colors hover:bg-brand-red-dark active:scale-[0.98]"
        >
          원문 공고 열기
        </JobOpenLink>
      </header>

      {keys.length > 0 ? (
        /* 가입 전에는 본문을 일부만 보여줍니다 — app/gate.tsx */
        <Clip max="24rem">
          <div className="mt-7 space-y-6">
            {keys.map((k) => (
              <section key={k}>
                <h2 className="text-lg font-bold">{k}</h2>
                <p className="mt-1 whitespace-pre-wrap break-words text-lg text-gray-700 dark:text-gray-300">
                  {detail[k]}
                </p>
              </section>
            ))}
          </div>
        </Clip>
      ) : (
        <p className="mt-7 text-lg text-gray-500">
          이 공고는 본문을 못 받아왔어요. 위 「원문 공고 열기」를 눌러 주세요
        </p>
      )}

      <JoinCta what="이 공고" />

      {/* 이 기관이 어떤 곳인지 · 같은 기관의 다른 공고 */}
      <OrgPanel orgName={j.org_name} exceptJobId={j.id} />

      {/* 출처·수집일·분류근거와 편집 단추. 관리자에게만 보입니다 */}
      <AdminJobTools id={j.id} />
    </main>
  );
}

function Row({ label, v }: { label: string; v: string | null }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-words">{v}</dd>
    </>
  );
}
