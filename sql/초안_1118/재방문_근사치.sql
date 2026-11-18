-- ════════════════════════════════════════════════════════════════════════════
-- 재방문 근사치(브라우저 자기보고) — 관리자 집계 (2026-11-18 초안 · 아직 안 올림)
-- [멘토-요약-5 · 멘토-5-2] · 질문함 Q5(2026-11-04 세중님 승인) · RAPO노트/수집기/지표장치_1104.md 5번
--
-- 기록은 **DB 를 안 바꾸고** 이미 돕니다 (웹 배포만 되면) —
--   components/revisit-mark.tsx → /api/hit → page_hits 에 한 줄
--   kind = 'other' · target = 'rv:first' | 'rv:back1'~'rv:back7' | 'rv:d7' · day_key = 'revisit'(고정 글자)
--   회원 번호·첫 방문 날짜·아이피 해시는 없습니다.
--
-- 이 파일은 그 줄을 **세는 것** 둘입니다.
--   ① admin_stats_revisit(p_days) — 새 함수 · SECURITY INVOKER (멘토 지시문6)
--      INVOKER 라 관리자 본인 권한으로 page_hits 를 읽어야 합니다 →
--      page_hits 에 **칸 넷(day·kind·target·by_admin)만** 읽기 권한 + 「관리자만 읽습니다」 규칙.
--      day_key·device·id 는 열지 않습니다. 회원이 읽으면 규칙에 걸려 0줄입니다.
--   ② 기존 통계 셋에서 재방문 줄을 뺍니다 — 안 빼면 「화면 조회」가 이벤트 수만큼 늘고
--      「그 밖에」 화면과 기기 표에 섞입니다. 하루 방문 수는 고정 글자 하나라 하루 +1 이 됩니다.
--      create or replace · 인수 그대로 → 권한(ACL)·SECURITY DEFINER 그대로입니다 (지침 6-2).
--      본문은 sql/기준구조_1030.sql 618~768행에서 가져와 **조건 한 줄씩만** 더했습니다.
--
-- ①만 올려도 되고 ②만 올려도 됩니다. ②를 안 올리면 위 「섞임」이 남습니다(자가 바뀜 — 보고에 전→후·까닭).
-- 올리기 전에 ⓪ · 올린 뒤에 ④. 되돌림: sql/초안_1118/재방문_근사치_되돌림.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ⓪ 올리기 전에 찍기 (읽기만 · 결과를 대화에 붙입니다) ──────────────────────
-- 이름이 비었나 — 0 이어야 합니다
--   select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'admin_stats_revisit';
-- page_hits 의 지금 권한·규칙 (되돌림이 이 글자와 같아져야 합니다 · 지침 6-2a)
--   select relacl::text from pg_class where oid = 'public.page_hits'::regclass;
--   select attname, attacl::text from pg_attribute where attrelid = 'public.page_hits'::regclass and attacl is not null;
--   select polname, polcmd, polroles::regrole[]::text, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
--     from pg_policy where polrelid = 'public.page_hits'::regclass;
-- ②를 올리려면 — 지금 본문이 10/30 덤프와 같은지 (다르면 ②를 올리지 말고 그 본문에 한 줄을 더해 다시 씁니다)
--   select p.oid::regprocedure::text, p.prosecdef, p.proacl::text, p.prosrc
--     from pg_proc p where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('admin_stats_daily', 'admin_stats_devices', 'admin_stats_screens');
-- page_hits.kind 제약이 아직 여덟 값인지 ('other' 가 들어 있어야 기록이 들어갑니다)
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'page_hits_kind_check';


begin;

-- ① 재방문 근사치 집계 ─────────────────────────────────────────────────────

/* 관리자 화면이 page_hits 를 읽을 길 — 칸 넷만 */
grant select (day, kind, target, by_admin) on table public.page_hits to authenticated;

create policy "관리자만 읽습니다" on public.page_hits
  for select to authenticated
  using ((select public.is_admin()));

/* 묶음(첫 방문한 날 D)마다 한 줄. 관리자 표시(by_admin) 줄은 뺍니다.
     first_browsers   D 에 처음 온 브라우저 수                         ← 분모
     back_browsers    그중 D1~D7 안에 다시 온 브라우저 수 (처음 다시 온 날 하나만 셈)
     back_done        D+7 이 다 지났나 — false 면 아직 더 늘 수 있습니다
     back_pct         back_browsers / first_browsers (%) — back_done 이 false 면 비웁니다
     d7_browsers      D7 **당일**에 온 브라우저 수 (위와 따로 셉니다)
     d7_pct           d7_browsers / first_browsers (%) — D7 이 다 지나야 채웁니다
   묶음 날짜는 「받은 날 − N」 입니다. 브라우저는 날짜를 안 보냅니다 (web/app/api/hit/route.ts 재방문값) */
create function public.admin_stats_revisit(p_days integer default 21)
  returns table (
    day date, first_browsers bigint, back_browsers bigint, back_done boolean,
    back_pct numeric, d7_browsers bigint, d7_pct numeric
  )
  language plpgsql
  stable
  security invoker
  set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_days  int  := least(greatest(coalesce(p_days, 21), 1), 90);
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
    select case when h.target = 'rv:first' then h.day
                when h.target = 'rv:d7'    then h.day - 7
                else h.day - substr(h.target, 8)::int          -- 'rv:back3' → 3
           end as d,
           h.target as t
      from public.page_hits h
     where h.kind = 'other'
       and not h.by_admin
       and h.target in ('rv:first', 'rv:back1', 'rv:back2', 'rv:back3', 'rv:back4',
                        'rv:back5', 'rv:back6', 'rv:back7', 'rv:d7')
       and h.day >= v_from
  )
  select days.d,
         count(ev.t) filter (where ev.t = 'rv:first'),
         count(ev.t) filter (where ev.t like 'rv:back%'),
         (days.d + 7 < v_today),
         case when days.d + 7 < v_today and count(ev.t) filter (where ev.t = 'rv:first') > 0
              then round(100.0 * count(ev.t) filter (where ev.t like 'rv:back%')
                               / count(ev.t) filter (where ev.t = 'rv:first'), 1)
         end,
         count(ev.t) filter (where ev.t = 'rv:d7'),
         case when days.d + 7 < v_today and count(ev.t) filter (where ev.t = 'rv:first') > 0
              then round(100.0 * count(ev.t) filter (where ev.t = 'rv:d7')
                               / count(ev.t) filter (where ev.t = 'rv:first'), 1)
         end
    from days
    left join ev on ev.d = days.d
   group by days.d
   order by days.d;
end $$;

comment on function public.admin_stats_revisit(integer) is
  '재방문 근사치(브라우저 자기보고) — 첫 방문 묶음별 D1~D7 재방문·D7 당일. 회원 유지율이 아닙니다. SECURITY INVOKER · 안에서 is_admin() (2026-11-18 · 멘토-5-2 · Q5)';

/* 권한 — admin_stats_* 와 같은 꼴(public 걷고 service_role·authenticated) + anon 도 적어서 걷습니다 (지침 6-2a · 6-3) */
revoke all on function public.admin_stats_revisit(integer) from public, anon;
grant all on function public.admin_stats_revisit(integer) to service_role;
grant all on function public.admin_stats_revisit(integer) to authenticated;


-- ② 기존 통계에서 재방문 줄 빼기 (각각 조건 한 줄 · 나머지는 10/30 본문 그대로) ─────

CREATE OR REPLACE FUNCTION public.admin_stats_daily(p_days integer DEFAULT 30) RETURNS TABLE(day date, visits bigint, views bigint, admin_visits bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Seoul')::date - (p_days - 1),
      (now() at time zone 'Asia/Seoul')::date,
      interval '1 day')::date as d
  )
  select d,
         count(distinct h.day_key) filter (where not h.by_admin),
         count(h.id)               filter (where not h.by_admin),
         count(distinct h.day_key) filter (where h.by_admin)
  from days
  left join page_hits h on h.day = days.d
                       and h.day_key <> 'revisit'   -- 2026-11-18 재방문 근사치 줄은 화면 조회가 아닙니다
  group by d
  order by d;
end $$;

CREATE OR REPLACE FUNCTION public.admin_stats_devices(p_days integer DEFAULT 7) RETURNS TABLE(device text, visits bigint, views bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  select coalesce(h.device, '모름'),
         count(distinct h.day_key),
         count(h.id)
  from page_hits h
  where h.day >= (now() at time zone 'Asia/Seoul')::date - (p_days - 1)
    and not h.by_admin
    and h.day_key <> 'revisit'   -- 2026-11-18 재방문 근사치 줄은 화면 조회가 아닙니다
  group by coalesce(h.device, '모름')
  order by 3 desc;
end $$;

CREATE OR REPLACE FUNCTION public.admin_stats_screens(p_days integer DEFAULT 7) RETURNS TABLE(kind text, views bigint, visits bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  select h.kind, count(*), count(distinct h.day_key)
  from page_hits h
  where not h.by_admin
    and h.day > (now() at time zone 'Asia/Seoul')::date - p_days
    and h.day_key <> 'revisit'   -- 2026-11-18 재방문 근사치 줄은 화면 조회가 아닙니다
  group by h.kind
  order by 2 desc;
end $$;

commit;


-- ④ 올린 뒤 확인 (읽기만) ─────────────────────────────────────────────────────
--   select has_function_privilege('anon', 'public.admin_stats_revisit(integer)', 'execute')        as anon_fn,      -- false
--          has_column_privilege('anon', 'public.page_hits', 'target', 'select')                    as anon_col,     -- false
--          has_column_privilege('authenticated', 'public.page_hits', 'day_key', 'select')          as auth_daykey,  -- false
--          has_function_privilege('authenticated', 'public.admin_stats_revisit(integer)', 'execute') as auth_fn;    -- true
--   select proname, prosecdef, proconfig, proacl::text from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('admin_stats_revisit', 'admin_stats_daily', 'admin_stats_devices', 'admin_stats_screens');
--      -- admin_stats_revisit 만 prosecdef=false · 나머지 셋은 ⓪ 과 proacl 글자까지 같아야 합니다
--   관리자로 /admin/stats 를 열어 「재방문 근사치」 표와 기존 표가 다 뜨는지 봅니다
