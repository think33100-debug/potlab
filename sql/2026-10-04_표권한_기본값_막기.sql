-- ════════════════════════════════════════════════════════════════
--  표 권한 거두기 ② — **앞으로 만드는 표**
--  2026-10-04 · ⚠ 세중님이 「올려라」 하신 뒤에만 실행합니다.
--  짝: sql/2026-10-04_표권한_거두기.sql (지금 있는 표 몫)
-- ════════════════════════════════════════════════════════════════
--
--  ── 왜 따로 필요한가 ────────────────────────────────────────
--  ①번 파일은 **지금 있는 95개 표**만 고칩니다. 내일 새 표를 만들면
--  TRUNCATE 가 **다시 붙습니다.** 붙이는 자리가 따로 있기 때문입니다 —
--  「기본 권한(default privileges)」입니다.
--
--  ── 지금 걸려 있는 것 (pg_default_acl 을 읽어서 확인) ────────
--
--    postgres 가 public 에 표를 만들면
--      anon=Dxtm/postgres  ·  authenticated=Dxtm/postgres
--      (D=TRUNCATE  x=REFERENCES  t=TRIGGER  m=MAINTAIN)
--
--    supabase_admin 이 public 에 표를 만들면
--      anon=arwdDxtm  ·  authenticated=arwdDxtm   ← **전부** 붙습니다
--
--  우리 표 95개는 **전부 postgres 가 주인**입니다 (pg_tables 로 확인).
--  마이그레이션도 postgres 로 돕니다. 그래서 첫 줄이 알맹이입니다.
--
--  ── 두 번째 줄은 실패해도 괜찮습니다 ────────────────────────
--  `for role supabase_admin` 은 그 역할의 **구성원이어야** 바꿀 수 있습니다.
--  postgres 가 구성원이 아니면 이렇게 납니다 —
--      ERROR: permission denied to change default privileges
--  그러면 **그 줄만 빼고** 첫 줄만 올리십시오. 우리가 만드는 표는
--  전부 postgres 가 만들기 때문에 막는 데 지장이 없습니다.
--  그래서 begin/commit 으로 묶지 않았습니다 — 한 줄씩 따로 돕니다.
--
--  ⚠ 이 파일은 **이미 있는 표를 건드리지 않습니다.** 앞으로 만들 표에만
--    걸립니다. 그래서 올린 직후에는 화면이 하나도 안 바뀝니다.
-- ════════════════════════════════════════════════════════════════

-- ── 알맹이 — postgres 가 만드는 새 표 ──────────────────────────
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables
  from anon, authenticated;

-- ── 덤 — supabase_admin 이 만드는 새 표 (실패하면 건너뛰십시오) ─
alter default privileges for role supabase_admin in schema public
  revoke truncate, trigger, references, maintain on tables
  from anon, authenticated;

-- ── 올린 뒤 확인 ───────────────────────────────────────────────
--   ① 기본 권한에서 Dxtm 이 빠졌는지
--      select pg_get_userbyid(d.defaclrole) 누가만들때,
--             array_to_string(d.defaclacl, ' | ') 기본권한
--        from pg_default_acl d
--        join pg_namespace n on n.oid = d.defaclnamespace
--       where n.nspname='public' and d.defaclobjtype='r';
--      → anon·authenticated 줄에 D·x·t·m 이 없어야 합니다
--        (첫 줄만 올렸으면 postgres 줄만 깨끗하면 맞습니다)
--
--   ② 진짜로 막히는지 — 표 하나를 만들어 권한을 보고 **그대로 둡니다**
--      (지우려면 승인 창이 또 뜹니다. 작은 빈 표 하나는 해롭지 않습니다)
--
--      create table if not exists 권한시험_2026_10_04 (a int);
--      select grantee, privilege_type
--        from information_schema.role_table_grants
--       where table_name='권한시험_2026_10_04'
--         and grantee in ('anon','authenticated');
--      → 한 줄도 안 나오면 막힌 것입니다

-- ── 되돌리기 ───────────────────────────────────────────────────
--   alter default privileges for role postgres in schema public
--     grant truncate, trigger, references, maintain on tables
--     to anon, authenticated;
