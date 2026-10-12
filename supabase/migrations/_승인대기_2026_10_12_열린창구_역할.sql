/* ★ **아직 안 올렸습니다.** 세중님 승인 뒤에 올립니다 (지침 8-8).
   파일 이름이 `_승인대기_` 로 시작하는 까닭 — 올린 것과 섞이지 않게.

   역할을 받아 「그 역할에게 열린 창구」를 돌려줍니다 (2026-10-12).

   ── 왜 ───────────────────────────────────────────────────────
   지금 `열린창구()` 는 **anon 만** 봅니다. 그래서 `job_posts` 를 대량으로 고치는데
   열쇠도 `is_admin()` 도 없이 `authenticated` 에게 열려 있던 창구 넷을
   2026-10-12 까지 **한 번도 보지 않았습니다** —
     fill_deadline_from_title · hide_closed_by_title · hide_backfill_nodate · 시험자료치우기

   ── 옛 `열린창구()` 는 건드리지 않습니다 ─────────────────────
   인수를 더하면 **새 함수**가 되고 권한이 PUBLIC 으로 돌아갑니다 (지침 6-2).
   그래서 이름이 다른 함수를 새로 만들고, 옛것은 그대로 둡니다
   (`tools/보안_열린것.mjs` 가 새 창구를 먼저 부르고 없으면 옛것으로 물러납니다).

   ── 갈래를 넷 더했습니다 ─────────────────────────────────────
   authenticated 쪽은 「열려 있는 것이 맞는」 창구가 많습니다. 갈래로 미리
   갈라 두면 허용 목록이 짧아지고, **진짜 설명 없는 것만** 「검토」로 남습니다.
     관리자창구   안에서 is_admin() 을 봅니다        ← 관리자 화면이 부릅니다
     회원창구     안에서 auth.uid() 를 봅니다         ← 회원이 자기 것을 손봅니다
     수집기창구   안에서 collect_secret 을 봅니다
     트리거 · 순수계산 · 비회원화면               ← 지금과 같습니다
     검토         **위 어디에도 안 드는 것** ← 이것만 사람이 봅니다

   권한 — 새 함수라 PUBLIC 이 붙습니다. 끝에서 걷고 service_role 에만 줍니다.
   옛 `열린창구()` 와 같은 자리입니다.

   delete · drop 글자가 없습니다. */

create or replace function public."열린창구_역할"("p_역할" text)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  with f as (
    select p.oid, p.proname, p.prosrc, pg_get_function_result(p.oid) as 결과,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as 이름
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and has_function_privilege(p_역할, p.oid, 'execute')
  ), g as (
    select 이름, case
      when 결과 = 'trigger'                 then '트리거'
      when prosrc ilike '%collect_secret%'  then '수집기창구'
      when prosrc ~ 'is_admin\(\)'          then '관리자창구'
      when prosrc ~ 'auth\.uid\(\)'         then '회원창구'
      when prosrc !~* '\m(from|join|insert|update|delete)\M' then '순수계산'
      when proname like 'admin!_%' escape '!' then '검토'
      when proname in ('save_my_survey','닉네임쓸수있나','닉네임잡혔나','in_room') then '검토'
      when p_역할 = 'anon'                  then '비회원화면'
      else '검토' end as 갈래
      from f
  ), t as (
    select c.relname as 이름,
           case when has_table_privilege(p_역할, c.oid, 'insert')
                  or has_table_privilege(p_역할, c.oid, 'update')
                  or has_table_privilege(p_역할, c.oid, 'delete')
                then '쓰기까지' else '읽기만' end as 갈래
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v','m','p')
       and (has_table_privilege(p_역할, c.oid,'select') or has_table_privilege(p_역할, c.oid,'insert')
         or has_table_privilege(p_역할, c.oid,'update') or has_table_privilege(p_역할, c.oid,'delete'))
  )
  select jsonb_build_object(
    '역할', p_역할,
    '함수', coalesce((select jsonb_agg(jsonb_build_object('이름', 이름, '갈래', 갈래) order by 이름) from g), '[]'::jsonb),
    '표',   coalesce((select jsonb_agg(jsonb_build_object('이름', 이름, '갈래', 갈래) order by 이름) from t), '[]'::jsonb))
$$;

revoke execute on function public."열린창구_역할"(text) from public, anon, authenticated;
grant  execute on function public."열린창구_역할"(text) to service_role;
