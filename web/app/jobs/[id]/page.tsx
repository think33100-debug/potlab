import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminJobTools } from '@/components/admin-job-tools';
import { Hit } from '@/components/hit';
import { Icon } from '@/components/icon';
import { JobBusy } from '@/components/job-busy';
import { JobClosed } from '@/components/job-closed';
import { JobHospital } from '@/components/job-hospital';
import { JobOpenLink } from '@/components/job-open-link';
import { JobSave } from '@/components/job-save';
import { Rise } from '@/components/job-parts';
import { OrgPanel } from '@/components/org-panel';
import { JobVeil } from '@/components/job-veil';
import { ShareButtons } from '@/components/share-buttons';
import { JOB_COLOR, JOB_COLOR_FALLBACK } from '@/lib/brand';
import { hospitalStat } from '@/lib/hospital';
import { iconMap } from '@/lib/icons';
import { isClosed, todayKst } from '@/lib/job-state';
import { siteUrl } from '@/lib/site-url';
import { supabase, JOB_ONE_COLS, type JobPost } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const one = async (id: string) => {
  const { data } = await supabase
    .from('job_posts_pub').select(JOB_ONE_COLS).eq('id', id).maybeSingle();
  return (data as unknown as JobPost | null) ?? null;
};


function dday(to: string | null): { text: string; urgent: boolean } | null {
  if (!to) return null;
  const left = Math.ceil(
    (new Date(to + 'T23:59:59+09:00').getTime()
     - new Date(todayKst() + 'T00:00:00+09:00').getTime()) / 86400000,
  ) - 1;
  if (left < 0) return { text: '마감', urgent: false };
  if (left === 0) return { text: '오늘 마감', urgent: true };
  return { text: `D-${left}`, urgent: left <= 3 };
}

/* 카톡·문자에 뜨는 미리보기 */
export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const j = await one(id);
  if (!j) return { title: '없는 공고에요 · POTJOB' };

  const closed = isClosed(j.apply_to);
  const when = !j.apply_to ? '마감일 미정'
    : closed ? `${j.apply_to} 마감됨`
    : `~${j.apply_to} 마감`;

  const title = `${j.org_name} ${j.job_group ?? '치료사'} 채용`;
  const desc = [j.title, when, j.work_place].filter(Boolean).join(' · ');
  const img = `${siteUrl()}/api/og/job/${j.id}`;

  return {
    title: `${title} · POTJOB`,
    description: desc,
    openGraph: { title, description: desc, images: [img], type: 'article' },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}

const CORE_SKIP = ['지원자격', '전형방법', '제출서류', '접수방법', '기관홈'];

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await one(id);
  if (!j) notFound();

  /* 마감돼도 막지 않습니다. 이미 주소를 아는 사람이라 빈 화면을 주면 링크가 죽습니다 */
  const closed = isClosed(j.apply_to);
  const detail = j.detail ?? {};

  /* 병원 자료가 없으면 null 입니다 — 그 구역을 통째로 감춥니다.
     0 으로 채우면 「치료사가 없는 병원」으로 읽혀 더 나쁩니다 */
  const [hosp, icons] = await Promise.all([
    hospitalStat(j.org_name),
    iconMap('공고 상세'),
  ]);

  const d = dday(j.apply_to);
  /* 마감된 공고는 회색으로 내려앉습니다 */
  const badge = closed ? '#8A9299' : (JOB_COLOR[j.job_group ?? ''] ?? JOB_COLOR_FALLBACK);

  /* 「01 02 03」으로 끊어 보여줄 수 있는 모양인지 봅니다.
     못 끊으면 통째로 한 덩어리로 보여줍니다 — 억지로 자르면 뜻이 깨집니다 */
  const steps = (detail['전형방법'] ?? '')
    .split(/\s*(?:→|->|\n|\r|·\s(?=\d))\s*/)
    .map((x) => x.replace(/^\s*[0-9]+\s*[.)]\s*/, '').trim())
    .filter((x) => x.length > 1);
  const stepped = steps.length >= 2 && steps.length <= 8;

  const rest = Object.keys(detail).filter((k) => !CORE_SKIP.includes(k) && detail[k]);

  return (
    <div className={closed ? 'bg-[#F4F4F1]' : 'bg-[#F4F4F1]'}>
      <main className="mx-auto w-full max-w-2xl px-6 pb-[152px] pt-4 md:px-7 md:pb-[96px]">
        <Hit kind="job" target={j.id} />

        {/* ① 상단바 ─────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href="/jobs"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full
                       text-[#4A5056] transition-transform duration-[120ms]
                       active:scale-[0.88] motion-reduce:transition-none"
          >
            <Icon name="chevron-left" size={22} />
            <span className="sr-only">목록으로</span>
          </Link>
          <div className="flex items-center gap-1">
            <JobSave id={j.id} />
            <ShareButtons
              title={`${j.org_name} ${j.job_group ?? '치료사'} 채용`}
              text={j.title}
              path={`/jobs/${j.id}`}
              compact
            />
          </div>
        </div>

        {/* ⑤ 마감 띠 — 제일 위 ─────────────────── */}
        {closed && <JobClosed jobId={j.id} />}

        <div className={closed ? 'opacity-[0.55]' : ''}>
          {/* ② 공고 머리 ───────────────────────── */}
          <header className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-[13px] font-bold text-white"
                style={{ backgroundColor: badge }}
              >
                {j.job_group ?? '치료사'}
              </span>
              {j.employ_type && (
                <span className="rounded-full border border-[#E3E3DE] bg-white px-3 py-1
                                 text-[13px] text-[#4A5056]">
                  {j.employ_type}
                </span>
              )}
              {d && (
                <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${
                  d.urgent ? 'bg-[#FF3B30] text-white' : 'bg-[#ECECE8] text-[#4A5056]'}`}>
                  {d.text}
                </span>
              )}
            </div>

            <h1 className="mt-4 break-keep text-[26px] font-bold leading-[1.35] text-[#1B2025]"
                style={{ overflowWrap: 'break-word' }}>
              {j.title}
            </h1>

            <p className="mt-3 break-keep text-[16px] text-[#4A5056]">
              {j.org_name}
              {j.work_place && <span className="text-[#5F666C]"> · {j.work_place}</span>}
            </p>
          </header>

          {/* ③ 핵심 네 칸 ──────────────────────── */}
          <Rise>
            <dl className="mt-6 grid grid-cols-2 gap-3">
              <Core icon={icons['job.headcount']} label="모집 인원"
                    v={j.headcount ? `${j.headcount}명` : '공고 참조'} />
              <Core icon={icons['job.deadline']} label="접수 마감"
                    v={j.apply_to ?? '수시'} />
              <Core icon={icons['job.edu']} label="학력" v={j.edu ?? '제한 없음'} />
              <Core icon={icons['job.place']} label="근무지"
                    v={j.work_place ?? j.sido ?? '공고 참조'} />
            </dl>
          </Rise>

          {/* 가입 안 한 사람은 여기부터 흐립니다 (components/job-veil.tsx).
              공유 링크로 들어온 사람에게는 안 겁니다 */}
          <JobVeil>
          {/* ④ 병원 뜯어보기 · ⑤ 얼마나 바쁜 곳인지 ─ */}
          {hosp && (
            <>
              <Rise><JobHospital h={hosp} icons={icons} /></Rise>
              {hosp.band && <Rise><JobBusy h={hosp} icons={icons} /></Rise>}
            </>
          )}

          {/* ⑥ 지원 자격 ──────────────────────── */}
          <>
            {detail['지원자격'] && (
              <Rise>
                <Block icon={icons['job.require']} title="지원 자격">
                  <p className="whitespace-pre-wrap break-keep text-[15px] leading-[1.75]
                                text-[#4A5056]" style={{ overflowWrap: 'break-word' }}>
                    {detail['지원자격']}
                  </p>
                </Block>
              </Rise>
            )}

            {/* ⑦ 전형 방법 ────────────────────── */}
            {detail['전형방법'] && (
              <Rise>
                <Block icon={icons['job.steps']} title="전형 방법">
                  {stepped ? (
                    <ol className="space-y-4">
                      {steps.map((s, i) => (
                        <li key={s} className="flex gap-4">
                          <span className="num shrink-0 text-[18px] leading-[1.5] text-[#FF3B30]">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="break-keep text-[15px] leading-[1.6] text-[#4A5056]"
                                style={{ overflowWrap: 'break-word' }}>{s}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="whitespace-pre-wrap break-keep text-[15px] leading-[1.75]
                                  text-[#4A5056]" style={{ overflowWrap: 'break-word' }}>
                      {detail['전형방법']}
                    </p>
                  )}
                </Block>
              </Rise>
            )}

            {/* ⑧ 첨부·서류 ────────────────────── */}
            {(detail['제출서류'] || detail['접수방법']) && (
              <Rise>
                <Block icon={icons['job.files']} title="내야 하는 것">
                  {detail['제출서류'] && (
                    <p className="whitespace-pre-wrap break-keep text-[15px] leading-[1.75]
                                  text-[#4A5056]" style={{ overflowWrap: 'break-word' }}>
                      {detail['제출서류']}
                    </p>
                  )}
                  {detail['접수방법'] && (
                    <p className="mt-4 whitespace-pre-wrap break-keep text-[15px] leading-[1.75]
                                  text-[#4A5056]" style={{ overflowWrap: 'break-word' }}>
                      {detail['접수방법']}
                    </p>
                  )}
                  <p className="mt-4 break-keep text-[12px] text-[#5F666C]">
                    첨부 파일은 원문 공고에 있어요. 아래 단추로 열어 주세요
                  </p>
                </Block>
              </Rise>
            )}

            {rest.map((k) => (
              <Rise key={k}>
                <Block icon={icons['job.require']} title={k}>
                  <p className="whitespace-pre-wrap break-keep text-[15px] leading-[1.75]
                                text-[#4A5056]" style={{ overflowWrap: 'break-word' }}>
                    {detail[k]}
                  </p>
                </Block>
              </Rise>
            ))}
          </>

          {!detail['지원자격'] && !detail['전형방법'] && rest.length === 0 && (
            <p className="mt-7 break-keep text-[15px] text-[#5F666C]">
              이 공고는 본문을 못 받아왔어요. 아래 단추로 원문을 열어 주세요
            </p>
          )}

          {/* ⑨ 출처 ───────────────────────────── */}
          <Rise>
            <div className="mt-7 flex items-start gap-2 rounded-[10px] bg-[#ECECE8] p-5">
              <Icon name={icons['job.source']} size={15}
                    className="mt-0.5 shrink-0 text-[#5F666C]" />
              <p className="break-keep text-[12px] leading-relaxed text-[#5F666C]">
                기관이 올린 공고를 모아 옮긴 것입니다. 마감일·인원은 바뀔 수 있으니
                지원 전에 원문을 한 번 봐 주세요
              </p>
            </div>
          </Rise>

          {detail['기관홈'] && (
            <Rise>
              <a
                href={detail['기관홈']}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-between gap-3 rounded-[12px]
                           border border-[#E3E3DE] bg-white px-6 py-5
                           transition-transform duration-[120ms] active:scale-[0.99]
                           motion-reduce:transition-none"
              >
                <span className="break-keep text-[15px] font-medium text-[#4A5056]">
                  기관 홈페이지 열기
                </span>
                <Icon name="arrow-up-right" size={16} className="shrink-0 text-[#5F666C]" />
              </a>
            </Rise>
          )}

          <OrgPanel orgName={j.org_name} exceptJobId={j.id} />
          </JobVeil>
        </div>

        {/* ⑤ 마감이면 하단 고정 버튼 대신 「지금 열려 있는 비슷한 공고」 */}
        {closed && (
          <section className="mt-7 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
            <p className="break-keep text-[17px] font-bold text-[#1B2025]">
              지금 열려 있는 비슷한 공고
            </p>
            <p className="mt-2 break-keep text-[15px] text-[#5F666C]">
              {[j.job_group, j.sido].filter(Boolean).join(' · ') || '전체'} 조건으로 찾아드려요
            </p>
            <Link
              href={`/jobs?${new URLSearchParams({
                ...(j.job_group ? { job: j.job_group } : {}),
                ...(j.sido ? { sido: j.sido } : {}),
              }).toString()}`}
              className="mt-5 block w-full rounded-[12px] bg-[#FF3B30] px-7 py-4 text-center
                         text-[16px] font-bold text-white transition-transform duration-[120ms]
                         active:translate-y-[2px] active:scale-[0.99]
                         active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]
                         motion-reduce:transition-none"
            >
              비슷한 공고 보기
            </Link>
          </section>
        )}

        <AdminJobTools id={j.id} />
      </main>

      {/* ⑩ 하단 고정 버튼 — 마감된 공고에는 없습니다 */}
      {!closed && (
        /* 탭바(62px·md 미만에만 있음) 위에 얹습니다.
           둘 다 bottom-0 이면 탭바가 z-40 이라 이 줄이 통째로 가려집니다 */
        <div className="fixed inset-x-0 bottom-[62px] z-30 border-t border-[#E3E3DE]
                        bg-white/95 px-6 py-3 backdrop-blur md:bottom-0 md:px-7">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
            <JobSave id={j.id} big />
            <JobOpenLink
              id={j.id}
              url={j.url}
              className="flex h-[50px] flex-1 items-center justify-center gap-1.5
                         rounded-[12px] bg-[#FF3B30] text-[16px] font-bold text-white
                         transition-transform duration-[120ms] active:translate-y-[2px]
                         active:scale-[0.99]
                         active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]
                         motion-reduce:transition-none"
            >
              지원하러 가기
              <Icon name="arrow-up-right" size={17} />
            </JobOpenLink>
          </div>
        </div>
      )}
    </div>
  );
}

function Core({ icon, label, v }: { icon: string; label: string; v: string }) {
  return (
    <div className="rounded-[12px] border border-[#E3E3DE] bg-white p-5">
      <dt className="flex items-center gap-1.5 text-[13px] text-[#5F666C]">
        <Icon name={icon} size={14} className="shrink-0" />
        <span className="break-keep">{label}</span>
      </dt>
      <dd className="mt-1.5 break-keep text-[17px] font-bold text-[#1B2025]"
          style={{ overflowWrap: 'break-word' }}>{v}</dd>
    </div>
  );
}

function Block({
  icon, title, children,
}: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1B2025]">
        <Icon name={icon} size={18} className="shrink-0 text-[#5F666C]" />
        <span className="break-keep">{title}</span>
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
