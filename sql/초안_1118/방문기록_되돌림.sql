-- ════════════════════════════════════════════════════════════════════════════
-- 방문기록 되돌림 — sql/초안_1118/방문기록.sql 을 올리기 전 상태로 (2026-11-18 초안)
--
-- 지우는 것   함수 둘 · member_visit_days 표(쌓인 방문 줄 전부) · job_events 에 더한 읽기 길
-- 남는 것     job_events 의 원래 넣기 규칙·권한 — 손대지 않습니다
-- ※ 「drop table」 은 쌓인 방문 기록을 되살릴 수 없게 지웁니다. 숫자를 남겨야 하면
--   먼저 select day, count(*) from public.member_visit_days group by day order by day; 를 찍어 둡니다.
-- 돌린 뒤 — 올리기 전에 찍어 둔 job_events 의 relacl·attacl·정책 목록(방문기록.sql ⓪)과 글자까지 같은지 봅니다 (지침 6-2a)
-- ════════════════════════════════════════════════════════════════════════════

begin;

drop function if exists public.admin_stats_return_visits(integer);
drop function if exists public.visit_mark();

drop policy if exists "관리자만 읽습니다" on public.job_events;
revoke select (profile_id, kind, created_at) on table public.job_events from authenticated;

drop table if exists public.member_visit_days;

commit;

-- 확인 (읽기만) — 셋 다 0 · 마지막은 false
--   select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname = 'member_visit_days';
--   select count(*) from pg_proc  where pronamespace = 'public'::regnamespace and proname in ('visit_mark', 'admin_stats_return_visits');
--   select count(*) from pg_policy where polrelid = 'public.job_events'::regclass and polname = '관리자만 읽습니다';
--   select has_column_privilege('authenticated', 'public.job_events', 'profile_id', 'select');
