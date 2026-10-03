-- ════════════════════════════════════════════════════════════════
--  표 권한 거두기 — ⚠ **올리지 않았습니다.** 세중님 승인 뒤에만.
--  2026-10-04
-- ════════════════════════════════════════════════════════════════
--
--  ── 무엇을 보고 만들었나 ─────────────────────────────────────
--  information_schema.role_table_grants 를 읽기만 해서 뽑았습니다.
--  표 내용은 한 줄도 안 읽었습니다.
--
--  ── 찾은 것 ─────────────────────────────────────────────────
--  public 스키마의 표 **76개 거의 전부**에 anon·authenticated 가
--  `TRUNCATE` · `TRIGGER` · `REFERENCES` 를 가지고 있습니다.
--
--  ★ `TRUNCATE` 는 **RLS 를 거치지 않습니다.**
--    RLS 정책이 아무리 촘촘해도 TRUNCATE 권한이 있으면 표가 통째로
--    비워집니다. job_posts(2,112줄) · posts · profiles 모두 해당됩니다.
--
--  Supabase 가 처음에 깔아 주는 `grant all on all tables ... to anon,
--  authenticated` 가 그대로 남은 것으로 보입니다. 흔한 자국입니다.
--
--  ⚷ 실제로 비워지는지는 **시험하지 않았습니다** — 시험 자체가
--    파괴적이라서입니다. PostgreSQL 문서가 「TRUNCATE 는 RLS 를 적용하지
--    않는다」고 적고 있고, 권한이 있다는 것은 확인했습니다.
--
--  ── 화면이 실제로 쓰는 쓰기 권한 (grep 으로 뽑음) ────────────
--    DELETE   comments · job_posts · job_stars · org_stars · post_likes
--    INSERT   comments · job_events · job_stars · page_hits · post_images
--             · post_likes · posts · profiles · reports
--    UPDATE   home_blocks · job_posts · profiles
--  그 밖의 표는 화면이 쓰기를 하지 않습니다 (함수로만 씁니다).
--
--  ── 이 파일이 하는 일 ───────────────────────────────────────
--  ① 모든 표에서 TRUNCATE · TRIGGER · REFERENCES 를 거둡니다
--     — 셋 다 앱이 쓸 일이 없습니다 (트리거 만들기·외래키 만들기 권한)
--  ② 화면이 안 쓰는 DELETE 를 거둡니다
--
--  **SELECT 는 손대지 않습니다.** 읽기를 건드리면 화면이 바로 깨집니다.
--  INSERT·UPDATE 도 이번에는 두었습니다 — 더 봐야 합니다.
--
--  ── 올리기 전에 ─────────────────────────────────────────────
--  ⚠ 이것은 **되돌리기 어려운 작업**입니다. 맨 아래 되돌리기를 보십시오.
--  ⚠ 올린 뒤 비로그인·회원·관리자로 화면을 한 바퀴 눌러 봐야 합니다.
-- ════════════════════════════════════════════════════════════════

-- ── ① TRUNCATE · TRIGGER · REFERENCES 거두기 (모든 표) ─────────
-- 한 줄씩 적지 않고 스키마 전체에 겁니다. 표가 늘어도 빠지지 않게
-- 기본 권한(default privileges)까지 함께 손봅니다.
revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;

-- 앞으로 **새로 만드는 표**에도 안 붙게
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- ── ② 화면이 안 쓰는 DELETE 거두기 ─────────────────────────────
-- 쓰는 곳만 남깁니다: comments · job_posts · job_stars · org_stars · post_likes
revoke delete on all tables in schema public from anon, authenticated;

grant delete on comments, job_stars, org_stars, post_likes to authenticated;
-- job_posts 의 DELETE 는 **관리자 화면**이 씁니다 (관리자도 authenticated 입니다)
grant delete on job_posts to authenticated;

-- ★ profiles 의 DELETE 는 돌려주지 않았습니다.
--   화면이 profiles 를 .delete() 하는 곳이 없고, 탈퇴는
--   `reset_my_account()` 함수가 합니다. 혹시 탈퇴가 깨지면
--   `grant delete on profiles to authenticated;` 로 되돌리십시오.

-- ── 올린 뒤 확인 ───────────────────────────────────────────────
--   select table_name, grantee,
--          string_agg(privilege_type, ',' order by privilege_type)
--     from information_schema.role_table_grants
--    where table_schema='public' and grantee in ('anon','authenticated')
--    group by 1,2 order by 1,2;
--   → TRUNCATE·TRIGGER·REFERENCES 가 한 줄도 없어야 합니다.

-- ── 되돌리기 ───────────────────────────────────────────────────
-- 원래대로(Supabase 기본) 되돌리려면 —
--   grant all on all tables in schema public to anon, authenticated;
--   alter default privileges in schema public
--     grant all on tables to anon, authenticated;
-- ⚠ 그러면 TRUNCATE 구멍도 같이 돌아옵니다. 급할 때만 쓰십시오.
