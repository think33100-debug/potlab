import type { SupabaseClient } from '@supabase/supabase-js';
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
import { JobReport } from '@/components/job-report';
import { JobSave } from '@/components/job-save';
import { LoginFirst } from '@/components/login-first';
import { NoticeFiles } from '@/components/notice-files';
import { Rise } from '@/components/job-parts';
import { OrgPanel } from '@/components/org-panel';
import { JobVeil } from '@/components/job-veil';
import { ShareButtons } from '@/components/share-buttons';
import { JOB_COLOR, JOB_COLOR_FALLBACK } from '@/lib/brand';
import { hospitalStat } from '@/lib/hospital';
import { iconMap } from '@/lib/icons';
import { isClosed, todayKst, 마감배지, 시각말 } from '@/lib/job-state';
import { jobViews } from '@/lib/job-views';
import { siteUrl } from '@/lib/site-url';
import { MembersOnly } from '@/components/members-only';
import { supabase, type JobPost } from '@/lib/supabase';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 공고 한 건.

   2026-09-25 — 공고 뷰를 통째로 읽는 길을 닫아서 이제 함수로 받습니다.
   **공유 링크가 살아야 하므로 이 한 건은 로그인 없이도 열립니다.**
   다만 본문(detail)은 회원에게만 실려 옵니다 — 비회원에게는 DB 가 빈 것을 줍니다.
   그 자리는 어차피 흐려져 있었는데, 전에는 흐리기만 하고 자료는 나갔습니다. */
const one = async (sb: SupabaseClient, id: string) => {
  const { data } = await sb.rpc('job_one', { p_id: id }).maybeSingle();
  return (data as unknown as JobPost | null) ?? null;
};

/* 기관이 쓴 원문 제목 (2026-10-05).

   화면 제목은 우리가 이어 붙인 「보여 줄 제목」입니다. 회원이 기관 공고와
   맞춰 볼 수 있어야 해서 원문을 아래에 작게 둡니다.

   왜 job_one 에 안 싣고 따로 부르나 — job_one 의 돌려주는 칸을 바꾸려면
   함수를 drop 했다가 다시 만들어야 합니다(승인 창). 작은 함수를 더하는
   쪽이 쌉니다. 보여 줄 제목과 **같으면 null** 이라 그 줄이 안 그려집니다. */
const 원문제목 = async (sb: SupabaseClient, id: string) => {
  const { data } = await sb.rpc('공고원문제목', { p_id: id });
  return (data as string | null) ?? null;
};

/* ★ 2026-10-09 — 공고문에서 **읽어낸** 값 (job_posts.뽑은값).
   detail 은 출처가 준 원문이라 덮지 않습니다. 화면은 뽑은값을 먼저 보고,
   없으면 detail 을 봅니다. 비회원에게는 DB 가 빈 것을 줍니다.
   job_one 에 안 싣는 까닭은 위 원문제목과 같습니다 (칸을 더하려면 drop) */
const 뽑은값받기 = async (sb: SupabaseClient, id: string) => {
  const { data } = await sb.rpc('공고뽑은값', { p_id: id });
  return (data as Record<string, string> | null) ?? {};
};


/* ★ 2026-10-07 — 마감일이 없을 때 쓸 말을 **화면이 정하지 않습니다.**
   DB 의 마감표시() 가 정해서 job_one 이 「마감표시」 칸으로 내려 줍니다
   (세중님 지시). 목록(app/jobs/page.tsx)의 dday 도 같은 칸을 읽습니다 */
/* 「2026-10-16」 → 「금」. 한국 날짜 글자를 그대로 읽습니다 (시간대를 안 탑니다) */
function 요일(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/* ★ 2026-10-09 — 여기 있던 dday() 를 지웠습니다.
   목록에도 같은 이름이 한 벌 있었고, 2026-10-08 에 마감 시각을 넣을 때 목록만
   고쳐서 **시각이 지난 그날 이 화면만 빨간 「오늘 마감」** 이 남았습니다.
   이제 lib/job-state.ts 의 마감배지() 한 벌만 씁니다 */

/* 카톡·문자에 뜨는 미리보기 */
export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  /* 카톡·검색 로봇에는 세션이 없습니다. 공개 열쇠꾸러미로 읽습니다 —
     제목·기관·마감일만 쓰므로 본문이 없어도 됩니다 */
  const j = await one(supabase, id);
  if (!j) return { title: '없는 공고입니다 · POTJOB' };

  const closed = isClosed(j.apply_to, todayKst(), j.apply_to_time);
  /* 받는 사람이 「언제부터 언제까지」를 미리보기에서 바로 알아야 합니다.
     시작일이 자료에 없으면 예전처럼 마감일만 적습니다 */
  const when = !j.apply_to ? (j.apply_from ? `${j.apply_from} 접수 시작` : '마감일 미정')
    : closed ? `${j.apply_to} 마감됨`
    : j.apply_from ? `${j.apply_from} ~ ${j.apply_to} 접수`
    : `~${j.apply_to} 마감`;

  const title = `${j.org_name} ${j.job_group ?? '치료사'} 채용`;
  const desc = [j.title, when, j.지역보임].filter(Boolean).join(' · ');
  const img = `${siteUrl()}/api/og/job/${j.id}`;

  return {
    title: `${title} · POTJOB`,
    description: desc,
    openGraph: { title, description: desc, images: [img], type: 'article' },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}

/* CORE_SKIP 은 2026-10-09 에 없앴습니다 — detail 의 **남은 칸을 전부 그리던**
   규칙이었는데, 이제 상세는 정해진 일곱 칸만 그립니다 (세중님 확정).
   전형방법·우대사항·결격사유·문의처·제출서류는 원문 공고에서 봅니다 */

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* 쿠키에 실려 온 세션으로 읽습니다. 로그인 안 했으면
     본문도 병원 숫자도 안 실려 옵니다 (막는 자리는 DB) */
  const sb = await serverSupabase();
  /* 회원 · 비회원 · 모름 세 값입니다.
     「모름」은 회원도 비회원도 아닙니다 — 병원 자료도, 가입 권유도 안 그립니다 */
  const who = await serverWho(sb);
  const member = who === '회원';

  const j = await one(sb, id);
  if (!j) notFound();

  /* 기관이 쓴 원문 제목. 보여 줄 제목과 같으면 null 이라 안 그려집니다 */
  const 기관원문 = await 원문제목(sb, id);

  /* 마감돼도 막지 않습니다. 이미 주소를 아는 사람이라 빈 화면을 주면 링크가 죽습니다 */
  const closed = isClosed(j.apply_to, todayKst(), j.apply_to_time);
  const detail = j.detail ?? {};

  /* 병원 자료가 없으면 null 입니다 — 그 구역을 통째로 감춥니다.
     0 으로 채우면 「치료사가 없는 병원」으로 읽혀 더 나쁩니다 */
  const [hosp, icons, views, 경쟁률있나, 뽑은값] = await Promise.all([
    /* 회원만 옵니다. 비회원에게는 null 이고 그 구역을 통째로 감춥니다 —
       0 으로 채우면 「치료사가 없는 병원」으로 읽혀서 더 나쁩니다 */
    member ? hospitalStat(sb, j.org_name) : Promise.resolve(null),
    iconMap('공고 상세'),
    jobViews([j.id]),
    /* 이 공고의 기관에 경쟁률 자료가 있나 (2026-10-09). 단추를 보일지만 정합니다.
       공고 번호만 넘깁니다 — 기관번호 찾기와 본부 잇기는 DB 가 합니다
       (알리오 경쟁률은 본부 이름으로 쌓이고 공고는 분원 이름으로 옵니다) */
    sb.rpc('공고경쟁률있나', { p_공고: j.id }),
    뽑은값받기(sb, id),
  ]);
  const 경쟁률 = 경쟁률있나.data === true;

  const d = 마감배지(j.apply_to, j.마감표시, j.apply_to_time);
  /* 마감된 공고는 회색으로 내려앉습니다 */
  const badge = closed ? '#8A9299' : (JOB_COLOR[j.job_group ?? ''] ?? JOB_COLOR_FALLBACK);

  /* ★ 2026-10-09 세중님 확정 — 「예상 연봉」은 공고에 적힌 **말 그대로** 씁니다.
     「3000만원 이상」 「월급 230만원~300만원」 「내규에 따름」 「협의」 모두
     그대로 보여줍니다. 숫자를 만들지 않습니다.
     뽑은값(공고문에서 읽어낸 것)이 있으면 먼저 봅니다 — 원문 detail 은
     그대로 두고 따로 담습니다 */
  const 연봉: string | null =
    (뽑은값?.['예상연봉'] ?? detail['연봉'] ?? detail['예상연봉'] ?? null) || null;
  const 지원자격: string | null =
    (뽑은값?.['지원자격'] ?? detail['지원자격'] ?? null) || null;

  /* 워크넷(고용24) 공고인가. id 는 수집기가 'WN' + 고용24 공고번호로 만듭니다
     (tools/collect-worknet.mjs 485줄 · 옛 WN 과 새 WN2 가 같은 규칙입니다).
     job_one 의 돌려주는 칸에 source 를 더하려면 함수를 drop 했다 다시 만들어야
     해서(승인 창), 위 「원문제목」과 같은 이유로 id 로 가립니다 */
  const 워크넷 = j.id.startsWith('WN');

  return (
    <div className={closed ? 'bg-[#F4F4F1]' : 'bg-[#F4F4F1]'}>
      {/* ★ 2026-10-09 — 아래 여백에 **안전 영역**을 더합니다.
          재 보니 휴대폰에서 아래에 겹쳐 있는 것이 둘입니다 —
            지원 띠   border 1 + py-3(12+12) + 단추 50 = 75px
            탭바                                      = 62px
          둘이 137px 인데 여백이 152px 이라 평평한 화면에서는 15px 남습니다.
          그런데 탭바는 `padding-bottom: env(safe-area-inset-bottom)` 을 더
          먹습니다(components/tab-bar.tsx). 아이폰 홈 막대가 있는 기기에서는
          34px 쯤이 더 붙어 **171px > 152px** 이 되어 마지막 줄이 가려집니다.
          그래서 여백도 같은 값을 더합니다. md 부터는 탭바가 없어 96px 그대로.

          ※ 캡처에서 본 「본문이 잘림」은 **촬영 자국**이었습니다 —
            fullPage 는 고정 띠를 한 번만 그려서 글 한가운데 얹힙니다.
            실제 기기에서는 스크롤하면 비켜납니다 (지침 1절 — 고치기 전에
            원인부터 확인했습니다) */}
      <main className="mx-auto w-full max-w-2xl px-6 pt-4
                       pb-[calc(152px+env(safe-area-inset-bottom))] md:px-7 md:pb-[96px]">
        <Hit kind="job" target={j.id} />

        {/* ① 상단바 ─────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href="/jobs"
            className="-ml-5 flex h-[48px] w-[48px] items-center justify-center rounded-full
                       text-[#4A5056] transition-transform duration-[120ms]
                       active:scale-[0.88] motion-reduce:transition-none"
          >
            <Icon name="chevron-left" size={24} />
            <span className="sr-only">목록으로</span>
          </Link>
          {/* gap-1(4px)이면 저장과 공유가 손가락 하나에 같이 눌립니다 */}
          <div className="-mr-5 flex items-center gap-3">
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
              {/* 못 가린 공고는 칸을 비우지 않고 「공고문 참고」 (2026-10-07 세중님).
                  DB 값은 비워 둔 채로 화면 표시만 바꿉니다. 목록 카드도 같은 말입니다 */}
              <span className="rounded-full border border-[#E3E3DE] bg-white px-3 py-1
                               text-[13px] text-[#4A5056]">
                {j.employ_type || '공고문 참고'}
              </span>
              <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${
                d.urgent ? 'bg-[#FF3B30] text-white' : 'bg-[#ECECE8] text-[#4A5056]'}`}>
                {d.text}
              </span>
            </div>

            <h1 className="mt-4 break-keep text-[26px] font-bold leading-[1.35] text-[#1B2025]"
                style={{ overflowWrap: 'break-word' }}>
              {j.title}
            </h1>

            {/* ★ 기관이 쓴 원문 제목 (2026-10-05).
                위 제목은 우리가 이어 붙인 것입니다. 회원이 기관 공고와
                맞춰 볼 수 있어야 해서 원문을 그대로 둡니다 */}
            {기관원문 && (
              <p className="mt-2 break-keep text-[13px] leading-[1.6] text-[#8A9199]">
                기관 원문 제목 — {기관원문}
              </p>
            )}

            {/* ★ 지역은 j.지역보임 을 읽습니다 — 카드·제목과 **같은 계산**입니다
                (2026-10-07 확정 방침). 전에는 work_place 를 그대로 써서
                순천병원이 「전남광주」로 나왔습니다 */}
            <p className="mt-3 break-keep text-[16px] text-[#4A5056]">
              {j.org_name}
              {j.지역보임 && <span className="text-[#5F666C]"> · {j.지역보임}</span>}
            </p>

            {/* 조회수 — 몇 명이나 보고 있는 자리인지 */}
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#5F666C]">
              <Icon name="eye" size={15} className="shrink-0" />
              <span className="num tabular-nums">{views[j.id] ?? 0}</span>
            </p>
          </header>

          {/* ③ 핵심 칸 ──────────────────────────────────────────
              ★ 2026-10-09 세중님 확정 — 공고 상세는 **이 일곱 칸만** 그립니다.
                모집인원 · 접수마감 · 근무지 · 지원자격 · 예상 연봉 ·
                얼마나 바쁜 곳 · 병원 뜯어보기
              전형방법 · 우대사항 · 결격사유 · 문의처 · 제출서류 · **학력**은
              그리지 않습니다. 「원문 보기」 링크는 남깁니다 (회원만).

              ★ 못 찾은 칸은 **그리지 않습니다.** 「공고에 없음」이라고 적으면
                회원이 공고문을 안 찾아봅니다 (15절과 같은 까닭).
                빈 칸은 관리자 「빈칸 공고」 목록으로 갑니다 */}
          <Rise>
            <dl className="mt-6 grid grid-cols-2 gap-3">
              {j.headcount != null && (
                <Core icon={icons['job.headcount']} label="모집 인원"
                      v={`${j.headcount}명`} />
              )}
              {/* ★ 2026-10-08 — 마감 **시각**이 있으면 함께 보여줍니다.
                  「2026-10-16 (금) 오전 9시 마감」. 전에는 날짜만 보여줘서
                  09:00 마감 공고가 그날 저녁까지 열린 것처럼 보였습니다 */}
              <Core icon={icons['job.deadline']} label="접수 마감"
                    v={j.apply_to
                        ? j.apply_to + (요일(j.apply_to) ? ` (${요일(j.apply_to)})` : '')
                          + (시각말(j.apply_to_time) ? ` ${시각말(j.apply_to_time)} 마감` : '')
                        : (j.마감표시 || '마감일 공고문 확인')}
                    sub={j.apply_from ? `${j.apply_from} 시작` : null} />
              {/* 근무지도 지역보임 을 먼저 읽습니다. 자세한 주소(work_place)는
                  다르면 아래 줄에 덧붙입니다 — 상세는 더 보여 줄 수 있습니다.
                  공고문에 없으면 기관표 주소가 들어와 있습니다 */}
              {(j.지역보임 || j.work_place) && (
                <Core icon={icons['job.place']} label="근무지"
                      v={j.지역보임 ?? j.work_place ?? ''}
                      sub={j.work_place && j.work_place.includes(' ')
                           && j.work_place !== j.지역보임 ? j.work_place : null} />
              )}
              {연봉 && (
                <Core icon={icons['job.pay'] ?? icons['job.headcount']} label="예상 연봉"
                      v={연봉} />
              )}
            </dl>
          </Rise>

          {/* ★ 2026-10-08 — 오늘이 마감일이고 **시각**이 정해져 있으면 한 줄 더.
              「오늘 오전 9시에 마감됩니다」. 아침에 보고 저녁에 넣으려다 놓치는 일을
              막습니다. 이미 지난 뒤에는 말이 바뀝니다 */}
          {j.apply_to === todayKst() && 시각말(j.apply_to_time) && (
            <Rise>
              <p className={'mt-3 break-keep rounded-[12px] border p-5 text-[14px] leading-[1.7] '
                + (closed
                    ? 'border-[#E3E3DE] bg-[#F7F7F4] text-[#5F666C]'
                    : 'border-brand-red/30 bg-brand-red/5 font-bold text-brand-red')}>
                {closed
                  ? `오늘 ${시각말(j.apply_to_time)}에 마감됐습니다.`
                  : `오늘 ${시각말(j.apply_to_time)}에 마감됩니다.`}
              </p>
            </Rise>
          )}

          {/* ③-2 수시채용 안내 (2026-10-07 확정 방침).
              문구는 세중님이 정한 그대로입니다 — 글자를 바꾸지 마십시오.
              ★ 「30일이 지나면 지난 공고로」 한 줄을 뺐습니다 (2026-10-07).
                 정찰이 원 공고가 살아 있다고 보면 **날수를 안 셉니다.**
                 30일은 「아무 신호가 없을 때」만 쓰는 뒷줄이라, 회원에게
                 「30일이면 내려간다」 고 적으면 사실과 다릅니다 */}
          {/* ★ 2026-10-07 — 안내를 **두 갈래**로 갈랐습니다 (세중님 지시).
              전에는 마감일이 없으면 무조건 「수시채용 공고입니다」 라고 했습니다.
              그런데 그중 대부분은 수시가 아니라 **우리가 접수기간을 못 읽은 것**
              이었습니다. 못 읽은 것을 「수시」 라고 하면 회원이 마감일을
              안 찾아보고 놓칩니다. 어느 쪽인지는 DB 의 마감표시() 가 정합니다 */}
          {!j.apply_to && j.마감표시 === '수시채용' && (
            <Rise>
              <p className="mt-3 break-keep rounded-[12px] border border-[#E3E3DE]
                            bg-[#F7F7F4] p-5 text-[14px] leading-[1.7] text-[#4A5056]">
                수시채용 공고입니다. 마감일이 정해져 있지 않으며,
                병원에서 공고를 내리면 POTJOB에서도 내려갑니다.
              </p>
            </Rise>
          )}
          {!j.apply_to && j.마감표시 !== '수시채용' && (
            <Rise>
              <p className="mt-3 break-keep rounded-[12px] border border-[#E3E3DE]
                            bg-[#F7F7F4] p-5 text-[14px] leading-[1.7] text-[#4A5056]">
                접수 마감일을 아직 확인하지 못했습니다. 아래 ⑨ 출처의 원 공고문에서
                접수기간을 꼭 확인해 주세요. 저희도 다시 읽어 채워 넣겠습니다.
              </p>
            </Rise>
          )}

          {/* 세 갈래입니다 (2026-09-25).
                비회원  자료가 아예 안 옵니다 (막는 자리는 DB). 안내 카드를 놓습니다
                회원    진짜 자료. 가입을 아직 안 마쳤으면 JobVeil 이 흐립니다
                모름    **아무것도 안 그립니다.** 물어봤는데 답을 못 받은 것이라
                        가입 권유를 그리면 회원에게 「가입하고 전부 보기」 가 뜹니다 */}
          {who === '모름' ? null : who === '비회원' ? (
            <MembersOnly
              title={<>이 병원이 어떤 곳인지<br />회원만 볼 수 있어요</>}
              body="치료사 인원 · 병상 · 얼마나 바쁜 곳인지와 지원 자격 · 전형 방법까지. 가입은 3분이면 끝나요."
              진단="app/jobs/[id]/page.tsx · 서버(serverWho)"
            />
          ) : (
          <JobVeil>
          {/* ④ 병원 뜯어보기 · ⑤ 얼마나 바쁜 곳인지 ─ */}
          {hosp && (
            <>
              <Rise><JobHospital h={hosp} icons={icons} /></Rise>
              {hosp.band && <Rise><JobBusy h={hosp} icons={icons} /></Rise>}
            </>
          )}

          {/* ⑥ 지원 자격 ────────────────────────
              ★ 2026-10-09 세중님 확정 — 상세에 그리는 글 칸은 **지원 자격 하나**입니다.
              전형방법 · 우대사항 · 결격사유 · 문의처 · 제출서류는 그리지 않습니다.
              그 내용은 원문 공고에 있고, 아래 「원문 보기」로 갑니다 */}
          {지원자격 && (
            <Rise>
              <Block icon={icons['job.require']} title="지원 자격">
                <p className="whitespace-pre-wrap break-keep text-[15px] leading-[1.75]
                              text-[#4A5056]" style={{ overflowWrap: 'break-word' }}>
                  {지원자격}
                </p>
              </Block>
            </Rise>
          )}

          {/* ★ 워크넷 급여란 고정 안내 (2026-10-07 세중님 지시).
              워크넷이 주는 숫자는 1호봉 기준이라 그대로 읽으면 오해합니다.
              연봉 칸을 위로 옮겼으므로 안내도 따라옵니다 */}
          {연봉 && 워크넷 && (
            <p className="mt-3 break-keep text-[12px] leading-relaxed text-[#5F666C]">
              예상 연봉은 1호봉 예정 급여이며, 호봉 인정 및 경력에 따라 상이할 수 있음
            </p>
          )}

          {/* 첨부 — 담당자가 올린 공고문·그림 (회원만 받습니다) */}
          <NoticeFiles 갈래="채용" 공고={j.id} 고칠수있나={false} />

          {!지원자격 && !연봉 && (
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

          {/* 오류 신고 (2026-10-07). 출처 안내 바로 아래입니다 —
              「우리가 옮긴 것」을 읽은 자리에서 「틀렸다」를 말할 수 있어야 합니다 */}
          <JobReport id={j.id} />

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

          <OrgPanel orgName={j.org_name} exceptJobId={j.id} jobTitle={j.title} jobUrl={j.url} />
          </JobVeil>
          )}
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

        {/* 경쟁률 보러 가기 (2026-10-09).
            **그 기관 자료가 있을 때만** 보입니다. 경쟁률은 알리오 공공기관
            19곳뿐이라, 없는 기관에 단추를 달면 눌러서 빈 화면을 봅니다.
            판정은 DB 의 경쟁률있나() 가 합니다 — 화면이 짐작하지 않습니다 */}
        {경쟁률 && (
          <section className="mt-7 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
            <p className="break-keep text-[17px] font-bold text-[#1B2025]">
              이 기관, 몇 대 일이었을까요
            </p>
            <p className="mt-2 break-keep text-[15px] text-[#5F666C]">
              {j.org_name}의 지난 채용 경쟁률을 모아 뒀어요
            </p>
            {/* ★ 2026-10-09 — 경쟁률은 **회원 자료**입니다 (방침 2026-10-01).
                비회원에게는 /compete 로 보내지 않고 로그인 안내로 바꿉니다.
                /compete 쪽도 서버에서 같은 기준으로 막습니다 — 한쪽만 막으면
                주소를 쳐서 들어옵니다 */}
            {member ? (
              <Link
                href={`/compete?${new URLSearchParams({
                  org: j.org_name,
                  ...(j.job_group && j.job_group !== '공통' ? { job: j.job_group } : {}),
                }).toString()}`}
                className="mt-5 block w-full rounded-[12px] border border-[#E3E3DE] px-7 py-4
                           text-center text-[16px] font-bold text-[#1B2025]
                           transition-transform duration-[120ms]
                           active:translate-y-[2px] active:scale-[0.99] motion-reduce:transition-none"
              >
                경쟁률 보러 가기
              </Link>
            ) : (
              <LoginFirst
                className="mt-5 block w-full rounded-[12px] border border-[#E3E3DE] px-7 py-4
                           text-center text-[16px] font-bold text-[#1B2025]"
              >
                로그인하고 경쟁률 보기
              </LoginFirst>
            )}
          </section>
        )}

        <AdminJobTools id={j.id} />
      </main>

      {/* ⑩ 하단 고정 버튼 — 마감된 공고에는 없습니다 */}
      {!closed && (
        /* 탭바(62px·md 미만에만 있음) 위에 얹습니다.
           둘 다 bottom-0 이면 탭바가 z-40 이라 이 줄이 통째로 가려집니다 */
        /* ★ 2026-10-09 — 지원 띠도 탭바가 안전 영역만큼 커지는 것을 따라갑니다.
           안 따라가면 홈 막대가 있는 기기에서 탭바가 이 띠를 밀고 올라옵니다.
           인라인 style 로 쓰면 md:bottom-0 을 이겨서 데스크톱이 어긋납니다 */
        <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))]
                        z-30 border-t border-[#E3E3DE]
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

function Core({
  icon, label, v, sub = null,
}: { icon: string; label: string; v: string; sub?: string | null }) {
  return (
    <div className="rounded-[12px] border border-[#E3E3DE] bg-white p-5">
      <dt className="flex items-center gap-1.5 text-[13px] text-[#5F666C]">
        <Icon name={icon} size={14} className="shrink-0" />
        <span className="break-keep">{label}</span>
      </dt>
      <dd className="mt-1.5 break-keep text-[17px] font-bold text-[#1B2025]"
          style={{ overflowWrap: 'break-word' }}>{v}</dd>
      {/* 마감일만 있고 시작일이 없어서 「접수가 열렸나」를 못 알아봤습니다 */}
      {sub && <p className="mt-1 break-keep text-[12px] text-[#5F666C]">{sub}</p>}
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
