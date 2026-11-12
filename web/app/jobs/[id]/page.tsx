import type { SupabaseClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { 경쟁률줄, 모집상태 } from '@/components/rapo/rapo-job-detail';
import { RapoJobDetailView, 못읽은칸말 } from '@/components/rapo/rapo-job-detail-view';
import { isClosed, todayKst, 금액있나, 기관이름말, 시각말, 연봉말, 조교연구말,
  보여줄기관이름, 지원링크, 지원방법말, type 병원주소꼴 } from '@/lib/job-state';
import type { HospitalStat } from '@/lib/hospital';
import { jobViews } from '@/lib/job-views';
import { 기관그림, 목록줄, 태그 } from '@/lib/rapo-home';
import { siteUrl } from '@/lib/site-url';
import type { JobListItem, JobPost } from '@/lib/supabase';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 공고 한 건 — 새 디자인 「U03 · 공고 상세」 (2026-11-11 대표: 피그마 우선 · 들어가는 정보가 적어 많이 뺌).
   조각은 components/rapo/rapo-job-detail.tsx, 원본 위치도 그 파일 머리에 있습니다.

   ── 자료 규칙은 전과 같습니다 ─────────────────────────────────────
   **공유 링크가 살아야 하므로 이 한 건은 로그인 없이도 열립니다** (job_one).
   본문(detail)·뽑은값·원문 주소는 회원에게만 실려 옵니다 — 비회원에게는 DB 가 빈 것을 줍니다.
   그래서 비회원의 보수 칸은 원본 「보수 비공개」(이용 권한 확인 후 공개)이고, 원문·지원은 로그인으로 보냅니다.
   가입을 덜 마친 회원은 JobVeil 이 흐립니다(공유 링크로 들어온 첫 화면은 빼고 · job-veil.tsx).

   값 규칙도 그대로입니다 — 못 읽은 칸은 숨기지 않고 「공고문 확인」, 연봉은 공고 글 그대로 / 없으면 「내규에 따름」,
   모집인원은 원문 글자 그대로(0명·○명), 포털 상세의 「채용시까지」는 그 말을 보이고 게시 만료일은 작게.

   ── 원본에 있지만 자료가 없어 뺀 것 ─────────────────────────────────
   04 본문 바로가기 탭 · 05 근무조건(계약기간·근무시간·가입 보험) · 06 업무·지원 자격의 담당 업무·근무 부서·우대·
   공통 응시조건 · 07 의 방문/우편 접수·접수처·문의·첨부 상자·준비할 서류·전형 일정·공고 번호·등록일 ·
   08 의 기관 사진 · 기관 공식 로고 · 「이 병원 이야기」 · 좋아요 · 저장한 사람 수 · 「알림받기」 · 근무시간 줄(대표 결정).

   ── 예전 화면에 있었지만 피그마에 없어 잠시 빠진 것 (대표: 하나씩 다시 넣을 예정) ──────────
   병원 뜯어보기·얼마나 바쁜 곳(JobHospital·JobBusy) · 경쟁률 보러 가기 · 오류 신고(JobReport) ·
   담당자가 올린 첨부(NoticeFiles) · 기관 원문 제목 줄 · 기관 홈페이지 열기 · 같은 기관 다른 공고(OrgPanel) ·
   직군 색 배지. 담당자·마스터의 공고 도구(AdminJobTools)는 그대로 둡니다(회원 화면이 아닙니다). */

const one = async (sb: SupabaseClient, id: string) => {
  const { data } = await sb.rpc('job_one', { p_id: id }).maybeSingle();
  return (data as unknown as JobPost | null) ?? null;
};

/* 공고문에서 **읽어낸** 값 (job_posts.뽑은값 · 2026-10-09). 화면은 뽑은값을 먼저 보고 없으면 detail 을 봅니다.
   비회원에게는 DB 가 {} 를 줍니다 */
const 뽑은값받기 = async (sb: SupabaseClient, id: string) => {
  const { data } = await sb.rpc('공고뽑은값', { p_id: id });
  return (data as Record<string, string> | null) ?? {};
};

/* 포털 공고의 「지원하러 가기」는 **병원 홈페이지 안 공고**로 (2026-11-11 밤 대표).
   창구는 회원에게만 열려 있고, 아직 안 올라갔으면 오류 → null → 전 차례 그대로입니다 */
const 병원주소받기 = async (sb: SupabaseClient, id: string): Promise<병원주소꼴> => {
  const { data, error } = await sb.rpc('공고병원주소', { p_id: id });
  if (error || !data) return null;
  const v = data as { 주소?: string; 갈래?: string };
  if (!v.주소 || (v.갈래 !== '병원글' && v.갈래 !== '병원게시판' && v.갈래 !== '병원홈')) return null;
  return { 주소: v.주소, 갈래: v.갈래 };
};

/* 비슷한 공고 — 같은 직군·시도의 열린 공고 (회원 목록 창구 그대로 · 새 창구 없음).
   비회원은 창구가 거절(42501)하므로 부르지 않습니다 */
const 비슷한공고 = async (sb: SupabaseClient, j: JobPost) => {
  const { data, error } = await sb.rpc('job_list', {
    p_job: j.job_group, p_sido: j.sido, p_tab: null, p_q: null, p_all: false, p_sort: null, p_page: 0,
  });
  if (error) return [];
  return ((data ?? []) as JobListItem[]).filter((r) => r.id !== j.id).slice(0, 3).map(목록줄);
};

/* 병원 한눈에 · 지난 채용 경쟁률 (2026-11-12 세중님) — 알리오 묶음 중 **지점까지 맞는 것**만 DB 가 줍니다(회원만) */
const 경쟁률받기 = async (sb: SupabaseClient, id: string): Promise<경쟁률줄[]> => {
  const { data, error } = await sb.rpc('공고경쟁률요약', { p_공고: id });
  if (error || !Array.isArray(data)) return [];
  return data as 경쟁률줄[];
};

/* 이 병원 치료사 · 얼마나 바쁜 곳 — DB 공고병원숫자() 가 찾습니다 (2026-11-12 세중님).
   기관 이름이 본사(「근로복지공단」)인 공고는 제목의 지점([인천병원])을 붙여 다시 찾습니다. 못 찾으면 null */
const 병원숫자받기 = async (sb: SupabaseClient, id: string): Promise<HospitalStat | null> => {
  const { data, error } = await sb.rpc('공고병원숫자', { p_공고: id }).maybeSingle();
  if (error) return null;
  return (data as unknown as HospitalStat | null) ?? null;
};

export const 마감못읽은말 = '마감일 공고문 확인';

const 요일들 = ['일', '월', '화', '수', '목', '금', '토'];
/* 「2026-10-30」 → { 달:'10월', 날:'30', 짧게:'10.30(금)' }. 글자를 그대로 잘라 시간대를 안 탑니다 */
function 날짜꼴(ymd: string | null | undefined) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const 요일 = 요일들[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return { 달: `${+m[2]}월`, 날: String(+m[3]), 짧게: `${m[2]}.${m[3]}(${요일})` };
}

/* 카톡·문자에 뜨는 미리보기 */
export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  /* 제목·기관·마감일만 씁니다. ★ 2026-11-11 클로즈드 베타 — 비회원에게 공고 창구(job_one)를 닫으므로 **세션으로** 읽습니다.
     로봇은 middleware 가 /beta 로 보내 여기까지 안 옵니다 (RAPO노트/SQL_1113) */
  const j = await one(await serverSupabase(), id);
  if (!j) return { title: '없는 공고입니다 · RAPO' };

  const closed = isClosed(j.apply_to, todayKst(), j.apply_to_time);
  const when = !j.apply_to ? (j.apply_from ? `${j.apply_from} 접수 시작` : '마감일 미정')
    : closed ? `${j.apply_to} 마감됨`
    : j.apply_from ? `${j.apply_from} ~ ${j.apply_to} 접수`
    : `~${j.apply_to} 마감`;

  const title = `${기관이름말(j.org_name)} ${j.job_group ?? '치료사'} 채용`;
  const desc = [j.title, when, j.지역보임].filter(Boolean).join(' · ');
  const img = `${siteUrl()}/api/og/job/${j.id}`;

  return {
    title: `${title} · RAPO`,
    description: desc,
    openGraph: { title, description: desc, images: [img], type: 'article' },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* 회원 · 비회원 · 모름 세 값. 「모름」은 둘 다 아닙니다 — 보수 칸도 로그인 권유도 안 그립니다 */
  const sb = await serverSupabase();
  const who = await serverWho(sb);
  const member = who === '회원';
  /* 2026-11-12 세중님 「다 볼 수 있게」 — 비회원도 병원 링크·치료사 인원·경쟁률을 받습니다(금고 SQL_1113/N). 비슷한 공고만 회원 */
  const 봄 = who !== '모름';

  const j = await one(sb, id);
  if (!j) notFound();

  const closed = isClosed(j.apply_to, todayKst(), j.apply_to_time);
  const detail = j.detail ?? {};

  const [views, 뽑은값, 병원, 비슷한, 병원숫자, 경쟁률] = await Promise.all([
    jobViews([j.id]),
    뽑은값받기(sb, id),
    봄 ? 병원주소받기(sb, id) : Promise.resolve(null),
    member ? 비슷한공고(sb, j) : Promise.resolve([]),
    /* 치료사 인원 — 심평원 신고 인원. 이름으로 못 찾으면 null 이고 칸을 안 그립니다 (0 으로 안 채움) */
    봄 ? 병원숫자받기(sb, id) : Promise.resolve(null),
    봄 ? 경쟁률받기(sb, id) : Promise.resolve([]),
  ]);
  const 치료사 = 병원숫자 && (병원숫자.pt != null || 병원숫자.ot != null)
    ? { pt: 병원숫자.pt, ot: 병원숫자.ot, 기준: 병원숫자.data_version?.replace(/^심평원\s*/, '') ?? null } : null;

  /* 예상 연봉 — 공고에 적힌 **말 그대로** · 금액이 없으면 「내규에 따름」 (2026-10-09 · 10-14 대표 확정) */
  const 연봉원문: string | null =
    (뽑은값?.['예상연봉'] ?? detail['연봉'] ?? detail['예상연봉'] ?? null) || null;
  /* 워크넷(고용24) 공고 — 숫자가 1호봉 기준이라 고정 안내를 붙입니다 (2026-10-07 대표 지시) */
  const 워크넷 = j.id.startsWith('WN');
  const 연봉덧말 = 금액있나(연봉원문) && 워크넷 ? '1호봉 예정 급여예요. 호봉 인정과 경력에 따라 달라질 수 있어요.' : null;

  const 지원 = 지원링크(j.url, detail['접수방법'] as string | undefined,
    (detail['기관홈'] ?? detail['기관홈페이지']) as string | undefined,
    detail['채용게시판'] as string | undefined, j.id, 병원);
  const 지원방법 = 지원방법말(detail['접수방법'] as string | undefined);
  const 지원자격: string | null = (뽑은값?.['지원자격'] ?? detail['지원자격'] ?? null) || null;

  /* 포털 **상세** 칸이 날짜가 아닌 말이면(「채용시까지」) 그 말을 보입니다 (2026-10-22 대표 1번) */
  const 마감글: string | null =
    (뽑은값?.['접수마감글'] ?? (detail['접수마감글'] as string | undefined) ?? null) || null;

  /* 모집인원 — 직군별 인원 → headcount(관리자가 고치는 칸) → 뽑은값(회원) → detail(누구나) · 원문 글자 그대로 */
  const 직군인원 = (detail['직군인원'] ?? null) as unknown as { 물리치료사?: number; 작업치료사?: number } | null;
  const 직군인원말 = 직군인원
    ? [직군인원.물리치료사 ? `물리치료사 ${직군인원.물리치료사}명` : null,
       직군인원.작업치료사 ? `작업치료사 ${직군인원.작업치료사}명` : null].filter(Boolean).join(' · ')
    : '';
  const 모집인원: string | null = 직군인원말
    || (j.headcount != null ? `${j.headcount}명`
        : (뽑은값?.['모집인원'] ?? (detail['모집인원'] as string | undefined) ?? null)) || null;

  /* 날짜 */
  const 끝 = 날짜꼴(j.apply_to);
  const 시작 = 날짜꼴(j.apply_from);
  const 시각 = 시각말(j.apply_to_time);
  const 수시 = !j.apply_to && j.마감표시 === '수시채용';
  const 상태: 모집상태 = closed ? '모집 마감' : (!j.apply_to && !수시 && !마감글) ? '확인 필요' : '접수 중';
  const 식별마감 = 마감글 || 끝?.짧게 || j.마감표시 || 마감못읽은말;
  const 기간 = 끝
    ? (마감글 ? 마감글 : 시작 ? `${시작.짧게}–${끝.짧게}` : `${끝.짧게}까지`)
    : (마감글 || j.마감표시 || 마감못읽은말);
  const 강조 = 끝 && !closed
    ? (마감글 ? `게시 ${끝.짧게}까지` : 시각 ? `${끝.짧게} ${시각} 마감` : null)
    : null;
  const 기간덧말 = 수시
    ? '마감일이 정해져 있지 않아요. 병원에서 공고를 내리면 RAPO에서도 내려가요.'
    : !끝 && !마감글 ? '접수 기간을 아직 확인하지 못했어요. 원문 공고에서 꼭 확인해 주세요.' : null;

  const 기관 = 보여줄기관이름(j.org_name, null);
  const 주소 = j.work_place && j.work_place !== j.지역보임 ? j.work_place : j.지역보임;
  const 비슷한주소 = `/jobs?${new URLSearchParams({
    ...(j.job_group ? { job: j.job_group } : {}),
    ...(j.sido ? { sido: j.sido } : {}),
  }).toString()}`;

  return (
    <RapoJobDetailView
      id={j.id} who={who} closed={closed}
      shareTitle={`${기관이름말(j.org_name)} ${j.job_group ?? '치료사'} 채용`}
      identity={{
        org: 기관, orgArt: 기관그림(j.org_name || j.id), 상태, title: j.title,
        tags: 태그(j.employ_type || '공고문 참고', 조교연구말(detail['조교연구']), j.is_intern && '체험형 인턴', j.job_group),
        views: views[j.id] ?? null, 인원: 모집인원 || 못읽은칸말, 마감: 식별마감,
      }}
      pay={{ 값: 연봉말(연봉원문), 덧말: 연봉덧말 }}
      지원자격={지원자격} url={병원?.주소 ?? (j.url || null)}
      기간={{ 달: 끝?.달 ?? null, 날: 끝?.날 ?? null, 기간, 강조, 덧말: 기간덧말 }}
      접수방법={지원방법} 모집인원없음={모집인원 == null}
      기관={기관} 주소={주소}
      비슷한={비슷한} 비슷한주소={비슷한주소}
      비슷한제목말={[j.job_group, j.지역보임?.split(' ')[0]].filter(Boolean).join(' · ') || undefined}
      지원주소={지원.주소}
      치료사={치료사} 바쁨={병원숫자} 경쟁률={경쟁률}
      인턴={!!j.is_intern || /인턴/.test(j.employ_type ?? '')}
    />
  );
}
