/* ③ 예상연봉을 「금액 있음 %」로 셉니다 (2026-10-14 세중님 확정)
 *
 * 전에는 **글자가 있으면** 채운 것으로 셌습니다. 그래서 「내규에 따름」·「협의」·
 * 공고문에서 통째로 긁혀 들어온 보수 안내 문단까지 채운 것으로 잡혀 88.2% 였습니다.
 * 회원이 실제로 얻는 것은 **금액**이므로 금액만 셉니다.
 *
 * 금액을 가리는 꼴은 화면(web/lib/job-state.ts 의 금액꼴)과 **같습니다** —
 * 숫자(쉼표·점 허용) 뒤에 「원」이 붙은 것. 「2년」·「9급」·「2026. 11월」·
 * 「(단위: 천원)」은 금액이 아닙니다.
 *
 * 인수·반환 모양 그대로입니다 (create or replace · 지우는 문장 없음 · 지침 6-2).
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
  칸 as (
    select p.id,
           (l.k is not null) as 일층인가,
           /* ★ 2026-10-14 — 「금액이 적혀 있나」. 글자가 있는지가 아닙니다 */
           coalesce(nullif(p."뽑은값"->>'예상연봉', ''), nullif(p.detail->>'연봉', ''),
                    nullif(p.detail->>'예상연봉', ''))
             ~ '[0-9][0-9,.[:space:]]*(만|천|억)?[[:space:]]*원' as 연봉있나,
           (h.band is not null) as 병원자료있나,
           "org_key"(p.org_name) as 기관키
      from job_posts p
      left join 일층 l on l.k = "견줄이름"(p.org_name)
      left join org_hospital_stat h on h.key = "org_key"(p.org_name)
     where p.id in (select id from v)
  )
  select jsonb_build_object(
    '잰때', now(),
    '회원화면', (select count(*) from v),
    '①놓친공고', jsonb_build_object(
        '안긁는_1층기관', (select (j->>'사각지대')::int from 구멍),
        '대상_1층기관', (select (j->>'대상')::int from 구멍),
        '공공', (select j->'공공' from 구멍),
        '민간', (select j->'민간' from 구멍),
        '안긁는_상급종합', (select jsonb_array_length(j->'사각_상급종합') from 구멍),
        '경쟁사기준', null),
    '②마감인데보임', (select count(*) from v, 오늘 where v.apply_to < 오늘.d),
    '③일곱칸', jsonb_build_object(
        '모집인원', (select round(100.0 * count(*) filter (where headcount is not null)
                                 / nullif(count(*), 0), 1) from v),
        '접수마감', (select round(100.0 * count(*) filter (where apply_to is not null)
                                 / nullif(count(*), 0), 1) from v),
        /* 분모가 다릅니다 — 시각을 주는 출처만 (collect_source.마감시각줌) */
        '마감시각', (select round(100.0 * 찬것 / nullif(분모, 0), 1) from 시각),
        '마감시각_분모', (select 분모 from 시각),
        '마감시각_찬것', (select 찬것 from 시각),
        '마감시각_전체참고', (select round(100.0 * count(*) filter (where apply_to_time is not null)
                                          / nullif(count(*), 0), 1) from v),
        '근무지', (select round(100.0 * count(*) filter (where coalesce(work_place, '') <> '')
                               / nullif(count(*), 0), 1) from v),
        '지원자격', (select round(100.0 * count(*) filter (where coalesce(edu, '') <> '')
                                 / nullif(count(*), 0), 1) from v),
        '예상연봉', (select round(100.0 * count(*) filter (where 연봉있나) / nullif(count(*), 0), 1) from 칸),
        '예상연봉_1층', (select round(100.0 * count(*) filter (where 연봉있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉_1층분모', (select count(*) from 칸 where 일층인가),
        /* 바쁜정도와 병원뜯어보기는 **같은 자료**(org_hospital_stat)에서 옵니다 */
        '바쁜정도_병원뜯어보기', (select round(100.0 * count(*) filter (where 병원자료있나)
                                               / nullif(count(*), 0), 1) from 칸),
        '바쁜정도_1층', (select round(100.0 * count(*) filter (where 병원자료있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '병원자료있는기관', (select count(distinct 기관키) from 칸 where 병원자료있나),
        '회원화면기관', (select count(distinct 기관키) from 칸),
        '※예상연봉', '금액이 적힌 공고 비율입니다 — 금액이 없으면 화면에 「내규에 따름」으로 그립니다 (2026-10-14)'),
    '④먼저올린비율', null
  )
$$;

revoke execute on function public."네숫자"() from public, anon, authenticated;
grant  execute on function public."네숫자"() to service_role;
