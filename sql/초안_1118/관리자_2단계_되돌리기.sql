-- ═════════════════════════════════════════════════════════════
-- 관리자 2단계 인증(aal2) **되돌리기** — 초안 2026-11-18 · 일꾼 Claude
-- 짝: 같은 폴더 관리자_2단계.sql
--
-- 돌리는 사람은 대표뿐입니다.
-- 이것을 돌리면 관리자 판정이 **2단계 없이** 예전처럼 돌아갑니다.
--   · 휴대폰을 잃어버렸는데 대시보드에서 수단을 지우기 어려울 때
--   · 올린 뒤 관리자 화면에서 이상한 일이 생겼을 때
-- 휴대폰의 인증 앱 등록(auth.mfa_factors 줄)은 **안 지웁니다** — 그건 대시보드에서 따로 합니다.
--
-- 본문은 sql/기준구조_1030.sql 의 것 그대로입니다. 올리는 파일이 「운영 본문 = 이 본문」을
-- 확인한 뒤에만 바꾸므로, 여기로 되돌리면 올리기 전과 같아집니다.
--
-- ACL: create or replace 는 ACL 을 안 건드립니다. 그래도 전과 글자까지 같은지
--      아래 ③ 에서 스스로 확인하고, 다르면 통째로 취소합니다 (지침 6-2a).
--      돌리기 전에 찍어 둘 것 (대화에 붙입니다):
--
--   select p.oid::regprocedure::text as 함수, p.proacl::text as acl,
--          p.prosecdef as definer, p.proconfig::text as 설정
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname in ('is_admin', '대표인가', '권한있나', '관리자2단계통과')
--    order by 1;
--
-- 바뀌는 것: 함수 셋 되돌림 · 함수 하나(관리자2단계통과) 지움. 표의 줄은 0줄.
-- ═════════════════════════════════════════════════════════════

begin;

create temp table _전acl on commit drop as
select p.oid::regprocedure::text as 함수, p.proacl::text as acl,
       p.prosecdef as definer, p.proconfig::text as 설정, p.proowner as 주인
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('is_admin', '대표인가', '권한있나');

-- ① 세 판정을 먼저 예전 본문으로 (그래야 ② 에서 새 함수를 지울 때 부르는 곳이 없습니다)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from admins where profile_id = auth.uid() and 끈때 is null)
     and not exists (select 1 from 마스터페르소나
                      where auth_id = auth.uid() and 지금역할 <> '관리자')
$$;

create or replace function public.대표인가()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from admins
                  where profile_id = auth.uid() and 갈래 = '대표' and 끈때 is null)
$$;

create or replace function public.권한있나(p_코드 text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select 대표인가()
      or exists (select 1 from 권한
                  where profile_id = auth.uid() and 권한코드 = p_코드 and 끈때 is null)
$$;

-- ② 새로 만들었던 조건 함수를 지웁니다 (if exists — 올리지 않은 상태에서 돌려도 멈추지 않습니다)
drop function if exists public.관리자2단계통과();

-- ③ ACL · definer · search_path · 주인이 글자까지 같은지
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
    raise exception '되돌린 뒤 ACL/설정이 달라졌습니다: % — 통째로 취소합니다', v_다른것;
  end if;
end
$chk$;

-- ④ 비회원·회원 자리에서 오류 없이 거짓
set local role anon;
select public.is_admin() as 비회원_is_admin;            -- false
reset role;
set local role authenticated;
select public.is_admin() as 토큰없는_회원_is_admin;      -- false
reset role;

commit;

-- 확인: 위 「돌리기 전에 찍어 둘 것」을 다시 돌려 관리자2단계통과 줄이 0줄이고,
--       나머지 셋의 acl 이 전과 같은지 봅니다.
