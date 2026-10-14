/* ③ 은 「화면이 그리는 칸」을 셉니다 (2026-10-14 세중님 확정 · 올렸습니다)
 *
 * 대조표 docs/일곱칸_대조_1014.md. 셋이 달랐습니다 —
 *   지원자격   edu 칸        → 뽑은값.지원자격 ?? detail.지원자격    88.7 → 77.9
 *   근무지     work_place 만 → 지역보임 → work_place                 90.9 → 96.7
 *   모집인원   headcount 만  → 직군인원 → headcount → 뽑은값.모집인원  77.6 → 78.2
 * 그리고 바쁜정도(band 가 있어야 그림)와 병원뜯어보기(줄만 있으면 그림)를 나눴습니다.
 *
 * 인수·반환 모양 그대로입니다 (지우는 문장 없음 · 지침 6-2).
 */

create or replace function public."네숫자"()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with v as (select * from job_posts_pub),
  구멍 as (select "일층병원_구멍셈"() as j),
  오늘 as (select (now() at time zone 'Asia/Seoul')::date as d),
  일층 as (select "견줄이름"("기관") as k from "일층병원_구멍"()),
  시각 as (
    select count(*) as 분모,
           count(*) filter (where j.apply_to_time is not null) as 찬것
      from job_posts j
      join collect_source s on s.code = j.source
     where j.id in (select id from v) and s."마감시각줌"
  ),
  /* ★ 세는 칸은 **화면이 그리는 칸**과 같아야 합니다.
     짝은 web/app/jobs/[id]/page.tsx 이고 대조표는 docs/일곱칸_대조_1014.md 입니다 */
  칸 as (
    select v.id,
           (l.k is not null) as 일층인가,
           /* 모집 인원 — 직군인원 → headcount → 뽑은값.모집인원 (page.tsx:184) */
           (v.headcount is not null
            or coalesce((p.detail->'직군인원'->>'물리치료사')::int, 0) > 0
            or coalesce((p.detail->'직군인원'->>'작업치료사')::int, 0) > 0
            or nullif(p."뽑은값"->>'모집인원', '') is not null) as 모집있나,
           /* 근무지 — 지역보임 → work_place (page.tsx:318) */
           (coalesce(v."지역보임", '') <> '' or coalesce(v.work_place, '') <> '') as 근무지있나,
           /* 지원 자격 — 뽑은값.지원자격 → detail.지원자격 (page.tsx:167).
              edu 칸은 화면이 안 봅니다 */
           (coalesce(nullif(p."뽑은값"->>'지원자격', ''), nullif(p.detail->>'지원자격', ''))
              is not null) as 자격있나,
           /* 예상 연봉 — 글자가 아니라 **금액**. web/lib/job-state.ts 의 금액꼴과 같은 꼴 */
           coalesce(nullif(p."뽑은값"->>'예상연봉', ''), nullif(p.detail->>'연봉', ''),
                    nullif(p.detail->>'예상연봉', ''))
             ~ '[0-9][0-9,.[:space:]]*(만|천|억)?[[:space:]]*원' as 연봉있나,
           /* 병원 뜯어보기는 **줄이 있으면** 그립니다 · 바쁜정도는 band 까지 있어야 합니다
              (page.tsx:399 의 {hosp && …} 와 {hosp.band && …}) */
           (h.key is not null) as 병원자료있나,
           (h.band is not null) as 바쁜정도있나,
           "org_key"(p.org_name) as 기관키
      from v
      join job_posts p on p.id = v.id
      left join 일층 l on l.k = "견줄이름"(p.org_name)
      left join org_hospital_stat h on h.key = "org_key"(p.org_name)
  )
  select jsonb_build_object(
    '잰때', now(),
    '회원화면', (select count(*) from v),
    '①놓친공고', jsonb_build_object(
        '안긁는_1층기관', (select (j->>'사각지대')::int from 구멍),
        '대상_1층기관', (select (j->>'대상')::int from 구멍),
        '공공', (select j->'공공' from 구멍),
        '민간', (select j->'민간' from 구멍),
        '보건소', (select j->'보건소' from 구멍),
        '안긁는_상급종합', (select jsonb_array_length(j->'사각_상급종합') from 구멍),
        '경쟁사기준', null),
    '②마감인데보임', (select count(*) from v, 오늘 where v.apply_to < 오늘.d),
    '③일곱칸', jsonb_build_object(
        '모집인원', (select round(100.0 * count(*) filter (where 모집있나) / nullif(count(*), 0), 1) from 칸),
        '접수마감', (select round(100.0 * count(*) filter (where apply_to is not null)
                                 / nullif(count(*), 0), 1) from v),
        '마감시각', (select round(100.0 * 찬것 / nullif(분모, 0), 1) from 시각),
        '마감시각_분모', (select 분모 from 시각),
        '마감시각_찬것', (select 찬것 from 시각),
        '마감시각_전체참고', (select round(100.0 * count(*) filter (where apply_to_time is not null)
                                          / nullif(count(*), 0), 1) from v),
        '근무지', (select round(100.0 * count(*) filter (where 근무지있나) / nullif(count(*), 0), 1) from 칸),
        '지원자격', (select round(100.0 * count(*) filter (where 자격있나) / nullif(count(*), 0), 1) from 칸),
        '지원자격_1층', (select round(100.0 * count(*) filter (where 자격있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '모집인원_1층', (select round(100.0 * count(*) filter (where 모집있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉', (select round(100.0 * count(*) filter (where 연봉있나) / nullif(count(*), 0), 1) from 칸),
        '예상연봉_1층', (select round(100.0 * count(*) filter (where 연봉있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉_1층분모', (select count(*) from 칸 where 일층인가),
        '바쁜정도', (select round(100.0 * count(*) filter (where 바쁜정도있나) / nullif(count(*), 0), 1) from 칸),
        '병원뜯어보기', (select round(100.0 * count(*) filter (where 병원자료있나) / nullif(count(*), 0), 1) from 칸),
        '병원뜯어보기_1층', (select round(100.0 * count(*) filter (where 병원자료있나)
                                         / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '병원자료있는기관', (select count(distinct 기관키) from 칸 where 병원자료있나),
        '회원화면기관', (select count(distinct 기관키) from 칸),
        '※세는칸', '화면이 그리는 칸과 같은 칸을 셉니다 — 대조표 docs/일곱칸_대조_1014.md (2026-10-14)'),
    '④먼저올린비율', null
  )
$$;

revoke execute on function public."네숫자"() from public, anon, authenticated;
grant  execute on function public."네숫자"() to service_role;
