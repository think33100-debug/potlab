/* 네 숫자를 한 자리에서 세는 창구 (2026-10-14 · 올렸습니다)
 * 까닭과 승인 요청 전문은 docs/승인요청_1013/②_네숫자.sql 에 있습니다.
 * 올린 것은 jsonb_to_record 대신 ->> 로 집는 꼴입니다 (아래가 실제로 돈 전문).
 * 2026-10-14 첫 값 — 회원화면 348 · ② 0건 · ③ 모집인원 77 · 접수마감 94.5 ·
 *   마감시각 1.1 · 근무지 90.8 · 지원자격 88.5 · ① 236/549(상급종합 2) · ④ null */

create or replace function public."네숫자"()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with v as (select * from job_posts_pub),
  구멍 as (select "일층병원_구멍셈"() as j),
  오늘 as (select (now() at time zone 'Asia/Seoul')::date as d)
  select jsonb_build_object(
    '잰때', now(),
    '회원화면', (select count(*) from v),
    '①놓친공고', jsonb_build_object(
        '안긁는_1층병원', (select (j->>'사각지대')::int from 구멍),
        '대상_1층병원',   (select (j->>'대상')::int from 구멍),
        '안긁는_상급종합', (select jsonb_array_length(j->'사각_상급종합') from 구멍),
        '경쟁사기준', null),
    '②마감인데보임', (select count(*) from v, 오늘 where v.apply_to < 오늘.d),
    '③일곱칸', jsonb_build_object(
        '모집인원', (select round(100.0 * count(*) filter (where headcount is not null)
                                 / nullif(count(*), 0), 1) from v),
        '접수마감', (select round(100.0 * count(*) filter (where apply_to is not null)
                                 / nullif(count(*), 0), 1) from v),
        '마감시각', (select round(100.0 * count(*) filter (where apply_to_time is not null)
                                 / nullif(count(*), 0), 1) from v),
        '근무지', (select round(100.0 * count(*) filter (where coalesce(work_place, '') <> '')
                               / nullif(count(*), 0), 1) from v),
        '지원자격', (select round(100.0 * count(*) filter (where coalesce(edu, '') <> '')
                                 / nullif(count(*), 0), 1) from v),
        '예상연봉', '아직 칸이 없습니다',
        '바쁜정도', '아직 칸이 없습니다',
        '병원뜯어보기', '아직 칸이 없습니다'),
    '④먼저올린비율', null
  )
$$;

revoke execute on function public."네숫자"() from public, anon, authenticated;
grant  execute on function public."네숫자"() to service_role;
