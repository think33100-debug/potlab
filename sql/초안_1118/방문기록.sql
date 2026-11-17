-- ════════════════════════════════════════════════════════════════════════════
-- 방문기록 — 회원이 「어느 날 왔나」만 하루 한 줄 (2026-11-18 초안 · 아직 안 올림)
--
-- 왜     사업계획서(12/1)에 「재방문율」·「하루 방문 회원」·「공고 원문 누른 비율」이
--        필요합니다 [멘토-요약-5 · 멘토-5-2]. 지금 DB 에는 원문 누름(job_events
--        kind='out')만 있고 「그 회원이 다시 왔나」를 잴 자리가 없습니다.
--        page_hits 의 하루번호는 일부러 날마다 바뀌어서(개인 추적 안 함) 날을 넘어 못 잇습니다.
--
-- 담는 것   회원 번호(auth.uid) · 한국 날짜. **그 밖은 없습니다**
--           (IP·브라우저·화면 주소·시각 없음 · 하루에 몇 번 왔는지도 안 셈)
--
-- 멘토 규칙(11/11 지시문6) — 새 함수는 SECURITY INVOKER · search_path 고정 ·
--   비로그인 실행권 없음. 그래서 표에 RLS 규칙을 직접 겁니다:
--     회원     자기 줄을 「오늘 날짜로만」 넣습니다. 남의 줄도, 자기 줄도 못 읽습니다
--     관리자   읽기만 합니다 (is_admin())
--   관리자 읽기 함수도 INVOKER 라 job_events 를 읽을 길이 필요합니다 →
--   job_events 에 **칸 셋(profile_id·kind·created_at)만** 읽기 권한 + 「관리자만」 규칙을 더합니다.
--   (지금은 job_events 를 아무도 못 읽습니다 — 관리자 통계 함수(DEFINER)로만 셉니다)
--
-- 올리기 전에 (지침 6 · 6-2a) — 아래 ⓪ 의 찍기 쿼리를 먼저 돌려 결과를 대화에 남깁니다.
-- 올린 뒤에   (지침 6-3 · 8-13) — 맨 아래 ④ 확인 쿼리 · 새 회원으로 첫 화면 한 번.
-- ※ 이 파일에 「on delete cascade」 글자가 있어 Supabase 승인 창이 뜰 수 있습니다 (지침 8-7).
-- 되돌림: sql/초안_1118/방문기록_되돌림.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ⓪ 올리기 전에 찍기 (읽기만 · 결과를 대화에 붙입니다) ──────────────────────
-- 이름이 비었나 — 셋 다 0 이어야 합니다
--   select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname = 'member_visit_days';
--   select count(*) from pg_proc  where pronamespace = 'public'::regnamespace and proname in ('visit_mark', 'admin_stats_return_visits');
-- job_events 의 지금 권한·규칙 (되돌림이 이 글자와 같아져야 합니다)
--   select relacl::text from pg_class where oid = 'public.job_events'::regclass;
--   select attname, attacl::text from pg_attribute where attrelid = 'public.job_events'::regclass and attacl is not null;
--   select polname, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
--     from pg_policy where polrelid = 'public.job_events'::regclass;
-- is_admin() 을 회원이 부를 수 있나 (규칙이 부릅니다 — true 여야 합니다)
--   select has_function_privilege('authenticated', 'public.is_admin()', 'execute');


begin;

-- ① 표 ──────────────────────────────────────────────────────────────────────
create table public.member_visit_days (
  /* 회원이 탈퇴하면(reset_my_account → auth.users 지움 → profiles 지움) 이 줄도 같이 지워집니다 */
  profile_id uuid not null references public.profiles(id) on delete cascade,
  /* 한국 날짜. 시각은 담지 않습니다 */
  day        date not null,
  primary key (profile_id, day)
);

/* 날짜로 훑는 통계용 (기본키는 회원 먼저라 날짜 범위에 못 씁니다) */
create index member_visit_days_day on public.member_visit_days (day);

comment on table public.member_visit_days is
  '회원이 온 날. 회원·날짜 한 쌍에 한 줄. IP·브라우저·화면·시각은 안 담습니다. 재방문율·하루 방문 회원 계산용 (2026-11-18 · 멘토-5-2)';

alter table public.member_visit_days enable row level security;

/* 회원은 **자기 줄을 오늘 날짜로만** 넣습니다 — 지난날·남의 줄을 꾸며 넣을 수 없습니다 */
create policy "회원은 자기 오늘 줄만 넣습니다" on public.member_visit_days
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and day = (now() at time zone 'Asia/Seoul')::date
  );

/* 읽기는 관리자만. 회원은 자기 줄도 못 읽습니다 (읽을 일이 없습니다) */
create policy "관리자만 읽습니다" on public.member_visit_days
  for select to authenticated
  using ((select public.is_admin()));

/* Supabase 는 새 표에 anon·authenticated 전부를 기본으로 붙입니다 — 먼저 다 걷고 필요한 것만 줍니다 (지침 6-3) */
revoke all on table public.member_visit_days from public, anon, authenticated;
grant insert (profile_id, day) on table public.member_visit_days to authenticated;
grant select on table public.member_visit_days to authenticated;   -- 위 「관리자만 읽습니다」 규칙이 거릅니다
grant all on table public.member_visit_days to service_role;


-- ② job_events — 관리자 읽기 길 (칸 셋만) ───────────────────────────────────
/* 관리자 읽기 함수가 INVOKER 라 관리자 본인 권한으로 job_events 를 읽어야 합니다.
   **칸 셋만** 엽니다 — job_id·value 는 안 엽니다. 회원이 읽으면 규칙에 걸려 0줄입니다 */
grant select (profile_id, kind, created_at) on table public.job_events to authenticated;

create policy "관리자만 읽습니다" on public.job_events
  for select to authenticated
  using ((select public.is_admin()));


-- ③ 함수 둘 ─────────────────────────────────────────────────────────────────

/* 화면이 하루 한 번(브라우저 탭마다) 부릅니다 — web/components/visit-mark.tsx.
   이미 오늘 줄이 있으면 아무 일도 안 합니다.
   관리자는 안 넣습니다 — 기존 통계(page_hits.by_admin)처럼 우리 방문을 숫자에서 뺍니다.
   ※ on conflict 에 대상 칸을 안 적습니다 — 적으면 그 칸을 읽을 권한(select)을 따로 봅니다 */
create function public.visit_mark()
  returns void
  language sql
  volatile
  security invoker
  set search_path to 'public'
as $$
  insert into public.member_visit_days (profile_id, day)
  select auth.uid(), (now() at time zone 'Asia/Seoul')::date
   where auth.uid() is not null
     and not public.is_admin()
  on conflict do nothing;
$$;

comment on function public.visit_mark() is
  '회원이 오늘 왔다고 한 줄 넣습니다(하루 한 줄). SECURITY INVOKER — 표의 RLS 규칙이 자기 줄·오늘 날짜만 받습니다 (2026-11-18)';

/* 관리자 통계 — 최근 p_days 일(한국 날짜), 하루 한 줄.
     visitors       그날 온 회원 수 (관리자 뺌)
     returned       그중 D+1 ~ D+7 사이에 한 번이라도 다시 온 회원 수
     return_done    D+7 이 다 지났나 — false 면 returned 는 아직 더 늘 수 있습니다
     return_pct     returned / visitors (%) — return_done 이 false 면 비웁니다
     out_members    그날 온 회원 중 그날 「공고 원문」을 누른 회원 수 (job_events kind='out')
     out_pct        out_members / visitors (%)
   분모(visitors)를 같이 냅니다 — 숫자는 분모와 날짜를 붙여 씁니다 (RAPO 판단 순서 4) */
create function public.admin_stats_return_visits(p_days integer default 14)
  returns table (
    day date, visitors bigint, returned bigint, return_done boolean,
    return_pct numeric, out_members bigint, out_pct numeric
  )
  language plpgsql
  stable
  security invoker
  set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_days  int  := least(greatest(coalesce(p_days, 14), 1), 90);
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
  v as (
    select m.profile_id, m.day as d
      from public.member_visit_days m
     where m.day between v_from and v_today
  ),
  per as (
    select v.d,
           v.profile_id,
           exists (select 1 from public.member_visit_days m2
                    where m2.profile_id = v.profile_id
                      and m2.day between v.d + 1 and v.d + 7) as came_back,
           exists (select 1 from public.job_events e
                    where e.profile_id = v.profile_id
                      and e.kind = 'out'
                      and e.created_at >= (v.d::timestamp at time zone 'Asia/Seoul')
                      and e.created_at <  ((v.d + 1)::timestamp at time zone 'Asia/Seoul')) as went_out
      from v
  )
  select days.d,
         count(per.profile_id),
         count(per.profile_id) filter (where per.came_back),
         (days.d + 7 < v_today),
         case when days.d + 7 < v_today and count(per.profile_id) > 0
              then round(100.0 * count(per.profile_id) filter (where per.came_back) / count(per.profile_id), 1)
         end,
         count(per.profile_id) filter (where per.went_out),
         case when count(per.profile_id) > 0
              then round(100.0 * count(per.profile_id) filter (where per.went_out) / count(per.profile_id), 1)
         end
    from days
    left join per on per.d = days.d
   group by days.d
   order by days.d;
end $$;

comment on function public.admin_stats_return_visits(integer) is
  '관리자 통계 — 하루 방문 회원·7일 안 재방문·원문 누른 회원. SECURITY INVOKER · 안에서 is_admin() (2026-11-18 · 멘토-5-2)';

/* 권한 — admin_stats_* 와 같은 꼴(public 걷고 service_role·authenticated) + anon 도 적어서 걷습니다 (지침 6-2a · 6-3) */
revoke all on function public.visit_mark() from public, anon;
grant all on function public.visit_mark() to service_role;
grant all on function public.visit_mark() to authenticated;

revoke all on function public.admin_stats_return_visits(integer) from public, anon;
grant all on function public.admin_stats_return_visits(integer) to service_role;
grant all on function public.admin_stats_return_visits(integer) to authenticated;

commit;


-- ④ 올린 뒤 확인 (읽기만) ─────────────────────────────────────────────────────
-- 비로그인은 다 false · 로그인은 함수 true 여야 합니다
--   select has_function_privilege('anon', 'public.visit_mark()', 'execute')                         as anon_mark,      -- false
--          has_function_privilege('anon', 'public.admin_stats_return_visits(integer)', 'execute')  as anon_stats,     -- false
--          has_table_privilege('anon', 'public.member_visit_days', 'insert')                       as anon_ins,       -- false
--          has_table_privilege('anon', 'public.member_visit_days', 'select')                       as anon_sel,       -- false
--          has_function_privilege('authenticated', 'public.visit_mark()', 'execute')                as auth_mark,      -- true
--          has_column_privilege('authenticated', 'public.job_events', 'job_id', 'select')          as auth_jobid;     -- false
-- 보안 설정 — prosecdef 가 둘 다 false, proconfig 에 search_path
--   select proname, prosecdef, proconfig from pg_proc
--    where pronamespace = 'public'::regnamespace and proname in ('visit_mark', 'admin_stats_return_visits');
-- 남은 것 — 이 초안에 **없는** 것 (세중님 몫)
--   · 보관 기간: job_events 처럼 3개월이 지나면 지우기 — 밤정리 함수에 한 줄을 더해야 합니다(크론이 부르는 함수)
--   · 개인정보처리방침 3.5 에 이 기록이 안 적혀 있습니다 (지금 방침은 「하루 단위 식별값」만 말합니다)
