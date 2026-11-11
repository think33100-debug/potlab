import type { Metadata } from 'next';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { Hit } from '@/components/hit';
import { RapoJobFilters, RapoJobSearch, 고용형태들, type 조건 } from '@/components/rapo/rapo-job-filters';
import type { RapoJob } from '@/components/rapo/rapo-job-row';
import { 받는중, 목록, 못받음, 없음 } from '@/components/rapo/rapo-job-results';
import { RapoShell } from '@/components/rapo/rapo-shell';
import { RapoPagination } from '@/components/rapo/rapo-ui';
import { 기관이름말, 마감배지 } from '@/lib/job-state';
import { 기관그림, 목록줄, 태그 } from '@/lib/rapo-home';
import { supabase, type JobListItem, type 맛보기공고 } from '@/lib/supabase';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';   // 공고는 자주 바뀝니다

/* 탭 제목 — 서비스 이름은 RAPO 입니다 */
export const metadata: Metadata = { title: 'RAPO · 채용 공고' };

/* 공고 목록 — 새 디자인 「U02 · 공고 목록」 (2026-11-11 대표 지시: 피그마 우선).

   Figma 기준 화면 (06 · A 공고 탐색과 공유 → 02 공고 목록)
     비회원 795:16046 · 회원 795:16079 · 쪽 넘기기 606:14291 · 검색 606:14511
     불러오는 중 509:4787 · 조건 결과 없음 509:4911 · 전체 공고 없음 509:5024 · 조회 오류 509:5135

   ── 자료 규칙은 전과 같습니다 ─────────────────────────────────────
   **회원만 목록 창구(job_list)를 씁니다. 한 번에 20건씩.** auth.uid() 가 없으면 DB 가 거절하고(42501)
   그때는 최신 몇 건만 주는 맛보기(공개공고)로 그립니다 — 근거·상세·급여는 비회원에게 안 나갑니다.
   검색·조건·쪽 넘기기는 그대로 로그인이 필요합니다(비회원이 누르면 로그인으로 · rapo-job-filters.tsx).
   직군 기본값 = 회원이 가입 때 고른 직군. 주소에 job 이 있으면 그것이 먼저, 「전체」는 job=전체.

   ── 피그마에 없어 잠시 빠진 것 (대표: 하나씩 다시 넣을 예정) ────────────
   기관 갈래 탭(공공·대학·종합 등 넷) · 정렬(추천·최신·마감·조회) · 지난 공고 보기 · 검색 때 기관 카드 ·
   조회수 · 맛보기 아래 「로그인하면 다 볼 수 있어요」 카드.
   갈래 탭이 빠져 기본 목록이 「공공기관·대학·종합」 갈래만이 아니라 **모든 갈래**가 됐습니다.
   예전 주소의 tab · sort · past · all 값은 읽지 않습니다(깨지지는 않습니다).

   ── 원본에 있지만 넣지 않은 것 ───────────────────────────────────
   근무시간 줄(수집하지 않는 값) · 상세의 지원 경력·근무일(대표 결정) ·
   급여 조건(오픈 전 안내).
   고용형태 조건은 2026-11-11 밤 DB 에 p_employ 를 더해 열었습니다 (주소 type= · RAPO노트/SQL_1113/F_고용형태_조건.sql). */

type SP = { job?: string; sido?: string; q?: string; p?: string; type?: string };

const PAGE = 20;   // DB 의 job_list() 와 같아야 합니다

export default async function Jobs({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(0, Number(sp.p ?? 0) || 0);

  /* 쿠키에 실려 온 세션으로 읽습니다. 로그인 안 했으면 job_list 가 거절합니다 */
  const sb = await serverSupabase();
  const who = await serverWho(sb);
  const 회원 = who === '회원';

  /* 가입 직군 — profiles 를 직접 읽지 않고 내프로필() 창구로 (전과 같음) */
  let 내직군: string | null = null;
  if (회원) {
    const { data } = await sb.rpc('내프로필');
    내직군 = ((data ?? []) as { job_group?: string | null }[])[0]?.job_group ?? null;
  }
  const 고른직군 = sp.job === '전체' ? null : (sp.job ?? 내직군);
  const 기본직군 = !sp.job && !!내직군;           // 「내 직군: …」 줄로 보일지
  const 고른시도 = sp.sido || null;
  /* 고용형태 — 시트의 칩 값만 받습니다 (다른 글자는 무시) */
  const 고른고용 = sp.type && sp.type !== '전체' && (고용형태들 as readonly string[]).includes(sp.type) ? sp.type : null;
  const 지금: 조건 = { q, job: 고른직군, sido: 고른시도, type: 고른고용 };

  /* 적용 조건 줄 (RAPO / List / 적용 조건 506:107) — 실제로 건 조건만 씁니다 */
  const 조건말 = [고른직군, 고른시도, 고른고용].filter(Boolean).join(' · ');
  const 적용줄 = !회원 ? null
    : 기본직군 && !고른시도 && !고른고용 ? `내 직군: ${고른직군}`
    : 조건말 ? `적용 조건: ${조건말}` : null;
  /* 초기화 = 조건을 모두 뺀 목록. 회원은 job=전체 로 적어야 가입 직군이 다시 안 걸립니다 */
  const 초기화주소 = 회원 ? (q ? `/jobs?q=${encodeURIComponent(q)}&job=전체` : '/jobs?job=전체') : '/jobs';

  const 쪽주소 = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (sp.job) u.set('job', sp.job);
    if (고른시도) u.set('sido', 고른시도);
    if (고른고용) u.set('type', 고른고용);
    if (p > 0) u.set('p', String(p));
    const s = u.toString();
    return s ? `/jobs?${s}` : '/jobs';
  };

  return (
    <RapoShell who={who} current="/jobs">
      <Hit kind="jobs" />

      {/* 제목과 검색 · RAPO / List / 제목과 검색 1210:1178 */}
      <section className="flex flex-col gap-(--rapo-dimension-x4) p-(--rapo-dimension-x5)">
        <h1 className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">채용 공고</h1>
        <RapoJobSearch 지금={지금} 회원={회원} />
      </section>

      <RapoJobFilters 지금={지금} 회원={회원} />

      {적용줄 && (
        <div className="flex items-center gap-(--rapo-dimension-x2) px-(--rapo-dimension-x5)">
          <p className="rapo-type-t4-medium min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">{적용줄}</p>
          <Link href={초기화주소}
            className="rapo-type-t2-medium flex h-(--rapo-touch-min) w-(--rapo-dimension-x16) items-center justify-end
                       rounded-(--rapo-radius-r1) text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)">
            초기화
          </Link>
        </div>
      )}

      {/* 영역 구분 6px · 공통 표면 / Divider (bg/neutral-weak) */}
      <div aria-hidden className="h-(--rapo-dimension-x1_5) bg-(--rapo-color-bg-neutral-weak)" />

      {/* 공고 칸만 늦게 채웁니다 — 받는 동안 위쪽(검색·조건)은 먼저 보입니다 */}
      <Suspense key={`${q}|${sp.job ?? ''}|${고른시도 ?? ''}|${고른고용 ?? ''}|${page}`} fallback={<받는중 />}>
        <결과 sb={sb} 고른직군={고른직군} 고른시도={고른시도} 고른고용={고른고용} q={q} page={page}
          조건있음={!!(q || 고른시도 || 고른직군 || 고른고용)} 초기화주소={초기화주소} 쪽주소={쪽주소} />
      </Suspense>
    </RapoShell>
  );
}

async function 결과({ sb, 고른직군, 고른시도, 고른고용, q, page, 조건있음, 초기화주소, 쪽주소 }: {
  sb: SupabaseClient; 고른직군: string | null; 고른시도: string | null; 고른고용: string | null; q: string; page: number;
  조건있음: boolean; 초기화주소: string; 쪽주소: (p: number) => string;
}) {
  const list = await sb.rpc('job_list', {
    p_job: 고른직군, p_sido: 고른시도, p_tab: null, p_q: q || null, p_all: false, p_sort: null, p_page: page,
    p_employ: 고른고용,
  });

  /* 42501 = 권한 없음 = 로그인 안 한 분 → 맛보기 */
  if (list.error?.code === '42501') {
    const 맛 = await supabase.rpc('공개공고');
    if (맛.error) return <못받음 />;
    const 줄 = (맛.data ?? []) as 맛보기공고[];
    const rows: RapoJob[] = 줄.map((r) => ({
      id: r.id, org: 기관이름말(r.org_name), orgArt: 기관그림(r.org_name || r.id), title: r.title,
      pay: { text: '이용 권한 확인 후 공개', kind: 'value' },   // 원본 비회원 문구
      tags: 태그(r.sido, r.job_group, r.is_intern && '체험형 인턴'),
      deadline: 마감배지(r.apply_to).text,
    }));
    return rows.length ? <목록 rows={rows} 제목={`공고 ${rows.length}개`} /> : <없음 조건있음={false} 초기화주소={초기화주소} />;
  }
  if (list.error) return <못받음 />;

  const 줄 = (list.data ?? []) as JobListItem[];
  const 전체 = Number((줄[0] as unknown as { total?: number })?.total ?? 0);
  if (줄.length === 0) return <없음 조건있음={조건있음 || page > 0} 초기화주소={초기화주소} />;

  const rows = 줄.map(목록줄);
  return (
    <목록 rows={rows} 제목={q ? `검색 결과 ${전체}개` : `공고 ${전체}개`}
      쪽={<RapoPagination page={page} pages={Math.ceil(전체 / PAGE)} href={쪽주소} />} />
  );
}
