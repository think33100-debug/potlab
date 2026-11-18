-- ════════════════════════════════════════════════════════════════════════════
-- 재방문 근사치 되돌림 — sql/초안_1118/재방문_근사치.sql 을 올리기 전으로 (2026-11-18 초안)
--
-- ①을 되돌림   함수 지우기 · page_hits 에 더한 읽기 길(칸 넷 + 「관리자만 읽습니다」 규칙) 걷기
-- ②를 되돌림   기존 통계 셋을 10/30 본문 그대로 (sql/기준구조_1030.sql 618~768행) — 인수 그대로라 권한 그대로
-- 쌓인 재방문 줄(page_hits 의 target 'rv:%')은 **지우지 않습니다** — 이 파일은 셈만 되돌립니다.
--   기록 자체를 멈추려면 웹에서 components/revisit-mark.tsx 를 빼는 커밋을 되돌립니다.
-- 돌린 뒤 — 올리기 전에 찍어 둔 page_hits relacl·attacl·정책 목록, 세 함수의 proacl 과 글자까지 같은지 봅니다 (지침 6-2a)
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ① ─────────────────────────────────────────────────────────────────────────
drop function if exists public.admin_stats_revisit(integer);
drop policy if exists "관리자만 읽습니다" on public.page_hits;
revoke select (day, kind, target, by_admin) on table public.page_hits from authenticated;

-- ② ─────────────────────────────────────────────────────────────────────────
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
  group by h.kind
  order by 2 desc;
end $$;

commit;

-- 확인 (읽기만)
--   select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'admin_stats_revisit';   -- 0
--   select count(*) from pg_policy where polrelid = 'public.page_hits'::regclass and polname = '관리자만 읽습니다';    -- 0
--   select has_column_privilege('authenticated', 'public.page_hits', 'target', 'select');                          -- false
