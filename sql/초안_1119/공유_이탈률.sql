-- 관리자 홈 「가입 이탈률」·「공유 버튼 클릭 수」 두 칸 (2026-11-19 세중님 「관리자 모드 통계에서 안 뜨는 것」)
-- 짝 화면: web/app/admin/page.tsx · 공유 누름 기록: web/lib/share-hit.ts → web/app/api/hit/route.ts ('sh:…')
--
-- ① admin_stats_shares(p_days) — 새 함수 · SECURITY INVOKER (멘토 11/9) · admin_stats_revisit 와 같은 꼴
--    page_hits 의 kind 'other' · target 'sh:%' 를 날마다 셉니다 (관리자 누름 뺌).
-- ② admin_stats_now() — 이미 있는 함수(SECURITY DEFINER · 인수 없음 그대로 → ACL 그대로)에 'signup' 하나를 더합니다.
--    가입 시작 = 소셜 로그인까지 한 계정(auth.users) · 가입 끝 = profiles 줄이 있음.
--    auth.users 는 회원 권한으로 못 읽어서 새 INVOKER 함수로는 못 셉니다 — 그래서 새 함수를 만들지 않고 있던 것에 더합니다.
--    ★ 로그인 단추를 누르기 전에 나간 사람은 못 셉니다 · 30분 안에 시작한 계정은 「아직 하는 중」으로 빼고 셉니다.
--
-- 되돌림: drop function public.admin_stats_shares(integer);
--         + sql/초안_1119/admin_stats_now_되돌림.sql (11/19 고치기 전 본문 그대로)

create or replace function public.admin_stats_shares(p_days integer default 7)
returns table(day date, shares bigint, copies bigint)
language plpgsql
stable
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_days  int  := least(greatest(coalesce(p_days, 7), 1), 90);
  v_from  date;
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  v_from := v_today - (v_days - 1);

  return query
  with days as (
    select g::date as d from generate_series(v_from, v_today, interval '1 day') g
  ),
  ev as materialized (
    select h.day as d, h.target as t
      from public.page_hits h
     where h.kind = 'other'
       and not h.by_admin
       and h.target like 'sh:%'
       and h.day >= v_from
  )
  select days.d,
         count(ev.t) filter (where ev.t like 'sh:share:%'),
         count(ev.t) filter (where ev.t like 'sh:copy:%')
    from days
    left join ev on ev.d = days.d
   group by days.d
   order by days.d;
end $function$;

revoke execute on function public.admin_stats_shares(integer) from public, anon;
grant  execute on function public.admin_stats_shares(integer) to authenticated, service_role;

create or replace function public.admin_stats_now()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return jsonb_build_object(
    'today', today,
    'members',        (select count(*) from profiles where not excluded),
    'members_today',  (select count(*) from profiles
                       where not excluded
                         and (created_at at time zone 'Asia/Seoul')::date = today),
    'members_week',   (select count(*) from profiles
                       where not excluded and created_at >= now() - interval '7 days'),
    'job_groups', (select coalesce(jsonb_object_agg(coalesce(job_group, '안 정함'), n), '{}'::jsonb)
                   from (select job_group, count(*) n from profiles
                          where not excluded group by job_group) t),
    'roles',      (select coalesce(jsonb_object_agg(coalesce(role, '안 정함'), n), '{}'::jsonb)
                   from (select role, count(*) n from profiles
                          where not excluded group by role) t),
    'providers',  (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb)
                   from (select coalesce(u.raw_app_meta_data->>'provider', '알 수 없음') p,
                                count(*) n
                         from profiles pr join auth.users u on u.id = pr.id
                         where not pr.excluded
                         group by 1) t),
    'jobs',         (select count(*) from job_posts where not hidden and not hold),
    'jobs_open',    (select count(*) from job_posts
                     where not hidden and not hold
                       and (apply_to is null or apply_to >= today)),
    'jobs_today',   (select count(*) from job_posts
                     where (collected_at at time zone 'Asia/Seoul')::date = today),
    'jobs_hold',    (select count(*) from job_posts where hold),

    /* ★ 2026-10-09 — 예시 글은 안 셉니다 */
    'posts',        (select count(*) from posts where not hidden and not 시험자료),
    'posts_today',  (select count(*) from posts
                     where not 시험자료
                       and (created_at at time zone 'Asia/Seoul')::date = today),
    'comments',     (select count(*) from comments c where not c.hidden
                       and not exists (select 1 from posts p
                                        where p.id = c.post_id and p.시험자료)),
    'comments_today',(select count(*) from comments c
                     where (c.created_at at time zone 'Asia/Seoul')::date = today
                       and not exists (select 1 from posts p
                                        where p.id = c.post_id and p.시험자료)),

    'notify_on',    (select count(*) from notification_settings where agreed),
    'orgs',         (select count(*) from org_directory),

    /* ★ 2026-11-19 — 가입 이탈 (관리자 홈 카드). 오늘(d1)·최근 7일(d7), 한국 날짜 0시부터.
       started = 그 기간에 소셜 로그인까지 한 계정 (30분 안 것은 하는 중이라 뺌 · 익명 계정 뺌)
       done    = 그 가운데 profiles 줄이 있는 것 (가입 끝) · 운영진 표시(excluded) 계정은 양쪽에서 뺌 */
    'signup', (select jsonb_build_object(
                 'd1', jsonb_build_object('started', count(*) filter (where u.created_at >= (today::timestamp at time zone 'Asia/Seoul')),
                                          'done',    count(pr.id) filter (where u.created_at >= (today::timestamp at time zone 'Asia/Seoul'))),
                 'd7', jsonb_build_object('started', count(*),
                                          'done',    count(pr.id)))
                 from auth.users u
                 left join profiles pr on pr.id = u.id
                where u.created_at >= ((today - 6)::timestamp at time zone 'Asia/Seoul')
                  and u.created_at <  now() - interval '30 minutes'
                  and not coalesce(u.is_anonymous, false)
                  and not coalesce(pr.excluded, false))
  );
end $function$;
