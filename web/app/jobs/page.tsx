import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { 색인메타 } from '@/lib/seo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { Hit } from '@/components/hit';
import { RapoJobFilters, RapoJobSearch, RapoKindRemember, type 조건 } from '@/components/rapo/rapo-job-filters';
import { RapoJobGuestWall } from '@/components/rapo/rapo-job-guest-wall';
import { 고용형태들, 공고정렬들, 기본정렬, 분류읽기, 분류쿠키, type 공고정렬 } from '@/lib/rapo-job-options';
import type { RapoJob } from '@/components/rapo/rapo-job-row';
import { 받는중, 목록, 못받음, 없음 } from '@/components/rapo/rapo-job-results';
import { RapoShell } from '@/components/rapo/rapo-shell';
import { RapoPagination, RapoSortLinks } from '@/components/rapo/rapo-ui';
import { 기관이름말, 마감배지 } from '@/lib/job-state';
import { 기관그림, 목록줄, 태그 } from '@/lib/rapo-home';
import { supabase, type JobListItem, type 맛보기공고 } from '@/lib/supabase';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';   // 공고는 자주 바뀝니다

/* 탭 제목 — 서비스 이름은 RAPO 입니다 */
/* 검색엔진에 올리는 쪽입니다 (2026-11-13 세중님 「검색 가능하게」 · lib/seo.ts 색인길과 짝) */
export const metadata: Metadata = { title: 'RAPO · 채용 공고', robots: 색인메타, alternates: { canonical: '/jobs' } };

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
   기관 갈래 탭(공공·대학·종합 등 넷) · 정렬 「추천순」(인기·최신·마감 임박은 11/12 다시 넣음) · 지난 공고 보기 · 검색 때 기관 카드 ·
   조회수 · 맛보기 아래 「로그인하면 다 볼 수 있어요」 카드.
   갈래 탭이 빠져 기본 목록이 「공공기관·대학·종합」 갈래만이 아니라 **모든 갈래**가 됐습니다.
   예전 주소의 tab · past · all 값은 읽지 않습니다(깨지지는 않습니다). sort 는 views · new · deadline 만 받습니다.

   ── 원본에 있지만 넣지 않은 것 ───────────────────────────────────
   근무시간 줄(수집하지 않는 값) · 상세의 지원 경력·근무일(대표 결정) ·
   급여 조건(오픈 전 안내).
   고용형태 조건은 2026-11-11 밤 DB 에 p_employ 를 더해 열었습니다 (주소 type= · RAPO노트/SQL_1113/F_고용형태_조건.sql). */

type SP = { job?: string; sido?: string; q?: string; p?: string; type?: string; sort?: string; kind?: string };

const PAGE = 20;   // DB 의 job_list() 와 같아야 합니다
const 맛보기수 = 5;  // 비회원에게 보이는 공고 수 (2026-11-12 밤 · 세중님이 정할 값)

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
  /* 정렬 — 정해 둔 셋만 받고 나머지(옛 주소의 top 등)는 기본(인기순)으로 */
  const 고른정렬: 공고정렬 = 공고정렬들.find((s) => s.key === sp.sort)?.key ?? 기본정렬;
  /* 기관 분류(여러 개) — 주소의 kind= 가 먼저, 없으면 이 기기에 기억해 둔 값(쿠키) (2026-11-12 밤 세중님 「필터해 놓으면 기본으로 유지」) */
  const 주소에분류 = sp.kind !== undefined;
  const 고른분류 = 주소에분류 ? 분류읽기(sp.kind) : 분류읽기((await cookies()).get(분류쿠키)?.value);
  const 지금: 조건 = { q, job: 고른직군, sido: 고른시도, type: 고른고용, sort: 고른정렬, kinds: 고른분류 };

  /* 적용 조건 줄 (RAPO / List / 적용 조건 506:107) — 실제로 건 조건만 씁니다 */
  const 조건말 = [고른직군, 고른시도, 고른고용, ...고른분류].filter(Boolean).join(' · ');
  const 적용줄 = !회원 ? null
    : 기본직군 && !고른시도 && !고른고용 && !고른분류.length ? `내 직군: ${고른직군}`
    : 조건말 ? `적용 조건: ${조건말}` : null;
  /* 초기화 = 조건을 모두 뺀 목록. 회원은 job=전체 로 적어야 가입 직군이 다시 안 걸립니다 */
  /* 「kind=」(빈 값)는 기억해 둔 기관 분류도 지우라는 뜻입니다 (RapoKindRemember) */
  const 초기화주소 = 회원 ? (q ? `/jobs?q=${encodeURIComponent(q)}&job=전체&kind=` : '/jobs?job=전체&kind=') : '/jobs';

  const 쪽주소 = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (sp.job) u.set('job', sp.job);
    if (고른시도) u.set('sido', 고른시도);
    if (고른고용) u.set('type', 고른고용);
    if (고른정렬 !== 기본정렬) u.set('sort', 고른정렬);
    if (고른분류.length) u.set('kind', 고른분류.join(','));
    if (p > 0) u.set('p', String(p));
    const s = u.toString();
    return s ? `/jobs?${s}` : '/jobs';
  };

  return (
    <RapoShell who={who} current="/jobs">
      <Hit kind="jobs" />
      {주소에분류 && 회원 && <RapoKindRemember kinds={고른분류} />}

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

      {/* 정렬 — 홈과 같은 단추(「RAPO / Home 11-04 / 정렬」 942:584·586). 비회원은 맛보기라 정렬이 뜻이 없어 뺍니다.
          정렬을 바꾸면 첫 쪽으로 갑니다 */}
      {회원 && (
        <div className="px-(--rapo-dimension-x5) pt-(--rapo-dimension-x4)">
          <RapoSortLinks label="공고 정렬" items={공고정렬들} value={고른정렬}
            href={(k) => { const u = new URL(쪽주소(0), 'http://x'); if (k === 기본정렬) u.searchParams.delete('sort'); else u.searchParams.set('sort', k); return u.pathname + u.search; }} />
        </div>
      )}

      {/* 공고 칸만 늦게 채웁니다 — 받는 동안 위쪽(검색·조건)은 먼저 보입니다 */}
      <Suspense key={`${q}|${sp.job ?? ''}|${고른시도 ?? ''}|${고른고용 ?? ''}|${고른분류.join(',')}|${고른정렬}|${page}`} fallback={<받는중 />}>
        <결과 sb={sb} 고른직군={고른직군} 고른시도={고른시도} 고른고용={고른고용} 고른분류={고른분류} 고른정렬={고른정렬} q={q} page={page}
          조건있음={!!(q || 고른시도 || 고른직군 || 고른고용 || 고른분류.length)} 초기화주소={초기화주소} 쪽주소={쪽주소} />
      </Suspense>
    </RapoShell>
  );
}

async function 결과({ sb, 고른직군, 고른시도, 고른고용, 고른분류, 고른정렬, q, page, 조건있음, 초기화주소, 쪽주소 }: {
  sb: SupabaseClient; 고른직군: string | null; 고른시도: string | null; 고른고용: string | null; 고른분류: string[]; 고른정렬: 공고정렬; q: string; page: number;
  조건있음: boolean; 초기화주소: string; 쪽주소: (p: number) => string;
}) {
  const list = await sb.rpc('job_list', {
    p_job: 고른직군, p_sido: 고른시도, p_tab: null, p_q: q || null, p_all: false, p_sort: 고른정렬, p_page: page,
    p_employ: 고른고용,
    /* 기관 분류 — 고른 게 없으면 null(전체) · 금고 SQL_1113/T */
    p_kinds: 고른분류.length ? 고른분류 : null,
  });

  /* 42501 = 권한 없음 = 로그인 안 한 분 → 맛보기 몇 건 + 가입 권유 (2026-11-12 밤 세중님).
     ★ 비회원에게 가는 칸은 공개공고() 가 주는 목록 칸뿐입니다 — id · 제목 · 기관 · 시도 · 직군 · 마감일 · 인턴 여부.
       원문 주소(url)는 창구가 비회원에게 null 로 줍니다. 급여·자격·본문은 안 갑니다.
       건수는 창구가 자르고(보여주는수), 여기서도 한 번 더 맛보기수 로 자릅니다.
     ★ 그 창구가 지금(11/11 클로즈드 베타)은 비회원에게 닫혀 있습니다(42501). 그때는 맛보기 없이 가입 권유만 보입니다.
       다시 여는 SQL 은 금고 초안(RAPO노트/SQL_1113/H_비회원_공고맛보기.sql) — 올리는 것은 세중님 */
  if (list.error?.code === '42501') {
    const 맛 = await supabase.rpc('공개공고');
    if (맛.error?.code === '42501') return <RapoJobGuestWall 남은={null} />;
    if (맛.error) return <못받음 />;
    const 받은 = (맛.data ?? []) as (맛보기공고 & { 전체건수?: number | null })[];
    const 줄 = 받은.slice(0, 맛보기수);
    const 전체 = Number(받은[0]?.전체건수 ?? 0) || null;
    const rows: RapoJob[] = 줄.map((r) => ({
      id: r.id, org: 기관이름말(r.org_name), orgArt: 기관그림(r.org_name || r.id), title: r.title,
      pay: { text: '이용 권한 확인 후 공개', kind: 'value' },   // 원본 비회원 문구
      tags: 태그(r.sido, r.job_group, r.is_intern && '체험형 인턴'),
      deadline: 마감배지(r.apply_to).text,
    }));
    if (rows.length === 0) return <없음 조건있음={false} 초기화주소={초기화주소} />;
    return (
      <>
        <목록 rows={rows} 제목={전체 ? `공고 ${전체.toLocaleString('ko-KR')}개` : `공고 ${rows.length}개`} />
        <RapoJobGuestWall 남은={전체 ? Math.max(0, 전체 - rows.length) : null} />
      </>
    );
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
