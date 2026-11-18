-- ═════════════════════════════════════════════════════════════
-- 관리자 2단계 인증(aal2) — **초안** 2026-11-18 · 일꾼 Claude
-- 멘토-추가-보안5 ④ · 멘토-2차-05-1 · 멘토-4-03
--
-- 운영에 올리는 사람은 대표뿐입니다. 이 파일은 운영에서 한 번도 안 돌았습니다.
-- 되돌리기: 같은 폴더 관리자_2단계_되돌리기.sql
-- 순서·잃어버렸을 때: docs/관리자_2단계_켜는법_1118.md
-- ═════════════════════════════════════════════════════════════
--
-- ── 무엇이 바뀌나 ────────────────────────────────────────────
-- 관리자 판정 셋의 끝에 **조건 하나**를 더합니다.
--
--     「확인된 2단계 수단(auth.mfa_factors · status = verified)이 **있는** 사람은
--       이번 로그인이 aal2(코드까지 넣은 로그인)여야 한다」
--
--   수단이 **없는** 사람은 지금과 글자까지 같은 답을 받습니다.
--   → 대표가 휴대폰에 등록하기 **전에** 올려도 아무것도 안 바뀝니다.
--   → 등록을 시작만 하고 코드 확인을 안 마친 수단(unverified)도 안 셉니다.
--
--   is_admin()          관리자 화면·관리 함수·RLS 규칙 전부의 기준
--   대표인가()           직원 넣고 빼기 · 권한 주기 (is_admin 을 안 거칩니다)
--   권한있나(text)       직원이 받은 권한 (대표인가 또는 권한 표)
--
-- ── 왜 is_admin() 을 고치나 (is_admin_aal2() 를 새로 만들지 않은 까닭) ──
--   is_admin() 을 부르는 곳 (sql/기준구조_1030.sql 에서 119줄):
--     관리 함수 약 69 · RLS 규칙 약 45 · 뷰 4 (admin_jobs · job_meta · 공개글 · 공개댓글)
--   새 함수로 갈아 끼우면 이 백여 곳을 다 고쳐야 하고, **하나라도 빠지면 그 길은
--   aal1 로 열린 채 남습니다.** 기준 한 자리(is_admin)를 고치면 전부 따라옵니다.
--   인수가 같아 `create or replace` 로 됩니다 — `drop` 이 없으니
--   ACL · 주석 · 주인 · 규칙과 뷰의 연결이 **그대로** 남습니다 (지침 6-2).
--
--   뷰 admin_jobs · job_meta 는 `where public.is_admin()` 으로 거릅니다.
--   aal1 + 수단 있음이면 **오류가 아니라 0줄**이 나옵니다. 관리자 화면은
--   그 전에 코드 입력 창을 띄우므로(web/components/admin-mfa-gate.tsx) 빈 표를 볼 일은 없습니다.
--   공개글·공개댓글 뷰는 `방볼수있나() or is_admin()` 이라 회원 쪽 답은 그대로입니다.
--
-- ── 새 함수 하나: 관리자2단계통과() ─────────────────────────
--   조건을 세 곳에 따로 적지 않으려고 한 자리에 둡니다 (지침 6절 — 기준은 한 자리).
--   **SECURITY INVOKER** 입니다 (11/11 멘토 기준 「새 DB 함수는 SECURITY INVOKER」).
--   auth.mfa_factors 를 읽어야 하는데 회원 권한으로는 못 읽습니다 —
--   그래서 **security definer 인 세 판정 안에서만** 부릅니다. 그 안에서는 주인(postgres)
--   권한으로 돕니다. 회원·비회원은 직접 부를 수 없게 EXECUTE 를 걷습니다.
--
-- ── 올리기 전에 찍어 둘 것 (지침 6-2a — 권한은 전 ACL 그대로) ──
--   아래 결과를 대화에 붙여 둡니다. 이 파일은 같은 값을 임시표에 담아
--   바꾼 뒤 **글자까지 같은지** 스스로 확인하고, 다르면 통째로 취소합니다.
--
--   select p.oid::regprocedure::text as 함수, p.proacl::text as acl,
--          p.prosecdef as definer, p.proconfig::text as 설정,
--          pg_get_userbyid(p.proowner) as 주인
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname in ('is_admin', '대표인가', '권한있나', '관리자2단계통과')
--    order by 1;
--
--   기준구조_1030 덤프로 본 값(운영 확인 아님):
--     is_admin()        GRANT 는 service_role 하나만 적혀 있고 REVOKE FROM PUBLIC 이 없습니다
--                       → PUBLIC 실행이 살아 있는 상태입니다. 주석에 「RLS 규칙이 부릅니다.
--                       EXECUTE 를 빼면 규칙이 막힙니다 — 그래서 anon 에도 열려 있습니다」.
--                       **그대로 둡니다.** (create or replace 는 ACL 을 안 건드립니다)
--     대표인가()        REVOKE FROM PUBLIC · service_role · authenticated
--     권한있나(text)    REVOKE FROM PUBLIC · service_role · authenticated
--     관리자2단계통과() 없음 (0줄이어야 합니다)
--
-- ── 쓰는 법 ─────────────────────────────────────────────────
--   Supabase SQL 편집기에 **통째로** 붙여 한 번에 돌립니다.
--   중간에 하나라도 어긋나면 오류로 멈추고 맨 끝 commit 은 rollback 이 됩니다 —
--   **반쯤 바뀐 채로 남지 않습니다.**
--   바뀌는 것: 함수 넷(새로 하나 · 고침 셋). 표의 줄은 0줄 바뀝니다.
-- ═════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────
-- ⓪ 미리 확인 — 어긋나면 아무것도 안 바꾸고 멈춥니다
-- ─────────────────────────────────────────────────────────────
do $chk$
declare
  v_벌수 int;
  v_본문 text;
begin
  /* 같은 이름이 몇 벌인지 — 정확히 한 벌씩이어야 합니다 (지침 6-2a) */
  select count(*) into v_벌수 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'is_admin';
  if v_벌수 <> 1 then raise exception 'is_admin 이 % 벌입니다 — 멈춥니다', v_벌수; end if;
  select count(*) into v_벌수 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '대표인가';
  if v_벌수 <> 1 then raise exception '대표인가 가 % 벌입니다 — 멈춥니다', v_벌수; end if;
  select count(*) into v_벌수 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '권한있나';
  if v_벌수 <> 1 then raise exception '권한있나 가 % 벌입니다 — 멈춥니다', v_벌수; end if;
  select count(*) into v_벌수 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '관리자2단계통과';
  if v_벌수 <> 0 then raise exception '관리자2단계통과 가 벌써 있습니다 — 이미 올렸는지 먼저 봅니다'; end if;

  /* 운영 본문이 이 초안이 아는 본문(기준구조_1030)과 같은지 — 빈칸만 무시하고 견줍니다.
     다르면 그사이 누가 고친 것입니다. 되돌리기 파일이 **틀린 본문**으로 되돌리게 되므로 멈춥니다 */
  select regexp_replace(btrim(prosrc), '\s+', ' ', 'g') into v_본문
    from pg_proc where oid = 'public.is_admin()'::regprocedure;
  if v_본문 <> regexp_replace(btrim($e$
  select exists (select 1 from admins where profile_id = auth.uid() and 끈때 is null)
     and not exists (select 1 from 마스터페르소나
                      where auth_id = auth.uid() and 지금역할 <> '관리자')
$e$), '\s+', ' ', 'g') then
    raise exception 'is_admin() 본문이 초안이 아는 것과 다릅니다 — 초안을 지금 본문에 맞춰 다시 씁니다';
  end if;

  select regexp_replace(btrim(prosrc), '\s+', ' ', 'g') into v_본문
    from pg_proc where oid = 'public.대표인가()'::regprocedure;
  if v_본문 <> regexp_replace(btrim($e$
  select exists (select 1 from admins
                  where profile_id = auth.uid() and 갈래 = '대표' and 끈때 is null)
$e$), '\s+', ' ', 'g') then
    raise exception '대표인가() 본문이 초안이 아는 것과 다릅니다 — 초안을 지금 본문에 맞춰 다시 씁니다';
  end if;

  select regexp_replace(btrim(prosrc), '\s+', ' ', 'g') into v_본문
    from pg_proc where oid = 'public.권한있나(text)'::regprocedure;
  if v_본문 <> regexp_replace(btrim($e$
  select 대표인가()
      or exists (select 1 from 권한
                  where profile_id = auth.uid() and 권한코드 = p_코드 and 끈때 is null)
$e$), '\s+', ' ', 'g') then
    raise exception '권한있나(text) 본문이 초안이 아는 것과 다릅니다 — 초안을 지금 본문에 맞춰 다시 씁니다';
  end if;

  /* auth.mfa_factors 를 이 자리(= 함수 주인)에서 읽을 수 있는지.
     못 읽으면 is_admin() 이 **오류**를 내고, is_admin() 을 쓰는 RLS 규칙(공고 읽기 포함)이
     전부 오류가 됩니다 — 사이트가 멈춥니다. 그래서 여기서 먼저 막습니다 */
  perform 1 from auth.mfa_factors limit 1;
end
$chk$;

-- ─────────────────────────────────────────────────────────────
-- ① 바꾸기 전 ACL 을 임시표에 담습니다 (끝나면 저절로 사라집니다)
-- ─────────────────────────────────────────────────────────────
create temp table _전acl on commit drop as
select p.oid::regprocedure::text as 함수, p.proacl::text as acl,
       p.prosecdef as definer, p.proconfig::text as 설정, p.proowner as 주인
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('is_admin', '대표인가', '권한있나');

-- ─────────────────────────────────────────────────────────────
-- ② 조건 한 자리 — 관리자2단계통과()
-- ─────────────────────────────────────────────────────────────
/* 참이 되는 때
     ㉠ 이번 로그인이 aal2 (코드까지 넣음)
     ㉡ 확인된 2단계 수단이 하나도 없음 — 아직 안 켠 사람은 지금처럼 둡니다
   비회원·크론(auth.uid() 가 비어 있음)은 ㉡ 로 참이 되지만, 세 판정의 앞쪽(admins 줄)이
   이미 거짓이라 답은 그대로 거짓입니다.
   search_path 를 비우고 이름을 전부 auth. 로 적습니다 — 주인 권한으로 도는 자리에서
   다른 스키마의 같은 이름을 잘못 잡지 않게 합니다 */
create function public.관리자2단계통과()
returns boolean
language sql stable security invoker
set search_path to ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                      where f.user_id = auth.uid() and f.status = 'verified')
$$;

comment on function public.관리자2단계통과() is
  '관리자 판정(is_admin·대표인가·권한있나) 안에서만 부릅니다. 확인된 2단계 수단이 있으면 aal2 를 요구합니다. 2026-11-18 초안 · sql/초안_1118/관리자_2단계.sql';

/* 새 함수는 PUBLIC 에 열려 태어납니다 (지침 6-2 · 6-3). anon 도 적어서 걷습니다.
   authenticated 도 걷습니다 — 회원이 직접 부를 일이 없습니다.
   세 판정은 security definer 라 주인(postgres) 권한으로 부릅니다 — 주인은 늘 부를 수 있습니다 */
revoke all on function public.관리자2단계통과() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- ③ 세 판정 — 본문 끝에 `and 관리자2단계통과()` 하나씩만 더합니다
--    인수·stable·security definer·search_path 는 전과 같게 적습니다
--    (create or replace 는 적은 값으로 덮어씁니다 — 빠뜨리면 invoker 로 바뀝니다)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from admins where profile_id = auth.uid() and 끈때 is null)
     and not exists (select 1 from 마스터페르소나
                      where auth_id = auth.uid() and 지금역할 <> '관리자')
     and 관리자2단계통과()
$$;

create or replace function public.대표인가()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from admins
                  where profile_id = auth.uid() and 갈래 = '대표' and 끈때 is null)
     and 관리자2단계통과()
$$;

/* 대표인가() 가 이미 조건을 보지만, 권한 표 쪽(직원)도 같은 조건을 받게 바깥에 겁니다 */
create or replace function public.권한있나(p_코드 text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select (대표인가()
          or exists (select 1 from 권한
                      where profile_id = auth.uid() and 권한코드 = p_코드 and 끈때 is null))
     and 관리자2단계통과()
$$;

-- ─────────────────────────────────────────────────────────────
-- ④ ACL · definer · search_path · 주인이 글자까지 같은지 — 다르면 통째로 취소
-- ─────────────────────────────────────────────────────────────
do $chk$
declare
  v_다른것 text;
begin
  select string_agg(b.함수, ', ') into v_다른것
    from _전acl b
    join pg_proc p on p.oid = b.함수::regprocedure
   where p.proacl::text is distinct from b.acl
      or p.prosecdef is distinct from b.definer
      or p.proconfig::text is distinct from b.설정
      or p.proowner is distinct from b.주인;
  if v_다른것 is not null then
    raise exception '바꾼 뒤 ACL/설정이 달라졌습니다: % — 통째로 취소합니다', v_다른것;
  end if;

  /* 새 함수에 PUBLIC·anon·authenticated 가 남아 있지 않은지 */
  if has_function_privilege('anon', 'public.관리자2단계통과()', 'execute')
     or has_function_privilege('authenticated', 'public.관리자2단계통과()', 'execute') then
    raise exception '관리자2단계통과() 가 회원·비회원에게 열려 있습니다 — 통째로 취소합니다';
  end if;
end
$chk$;

-- ─────────────────────────────────────────────────────────────
-- ⑤ 비회원·회원 자리에서 **오류 없이** 거짓이 나오는지
--    여기서 오류가 나면 RLS 규칙이 전부 멈춘다는 뜻입니다 → 맨 끝 commit 이 rollback 이 됩니다
-- ─────────────────────────────────────────────────────────────
set local role anon;
select public.is_admin() as 비회원_is_admin;            -- false
reset role;

set local role authenticated;
select public.is_admin() as 토큰없는_회원_is_admin;      -- false
select public.대표인가() as 토큰없는_회원_대표인가;      -- false
reset role;

commit;

-- ═════════════════════════════════════════════════════════════
-- 올린 뒤 확인 (읽기만 · 붙여서 따로 돌립니다)
-- ═════════════════════════════════════════════════════════════
--
-- ⑥ 위 「올리기 전에 찍어 둘 것」 쿼리를 다시 돌려 acl 이 전과 글자까지 같은지 봅니다.
--    관리자2단계통과() 는 {postgres=X/postgres} 한 칸이어야 합니다
--    (service_role 이 따라 붙어 있으면 Supabase 기본 권한입니다 — 부르는 곳이 없어 해는 없지만 적어 둡니다).
--
-- ⑦ 흉내 시험 — **대표 계정 번호(uuid)는 파일에 적지 않고 편집기에서만 넣습니다.**
--    본인 uuid 는 Authentication → Users 에서 봅니다. 맨 끝이 rollback 이라 아무것도 안 남습니다.
--
--   begin;
--   select set_config('request.jwt.claims',
--     json_build_object('sub', '<본인 uuid>', 'role', 'authenticated', 'aal', 'aal1')::text, true);
--   set local role authenticated;
--   select public.is_admin() as aal1_판정;   -- 수단 등록 전: true · 등록(확인) 뒤: false
--   reset role;
--   select set_config('request.jwt.claims',
--     json_build_object('sub', '<본인 uuid>', 'role', 'authenticated', 'aal', 'aal2')::text, true);
--   set local role authenticated;
--   select public.is_admin() as aal2_판정;   -- 늘 true
--   reset role;
--   rollback;
--
-- ⑧ 수단 몇 개인지 (본인 것만 · 비밀값 칸은 안 읽습니다)
--   select factor_type, status, created_at from auth.mfa_factors where user_id = '<본인 uuid>';
