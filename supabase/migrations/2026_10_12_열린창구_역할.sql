/* 역할을 받아 「그 역할에게 열린 창구」를 돌려줍니다 (2026-10-12 · 세중님 승인).

   ── 왜 ───────────────────────────────────────────────────────
   지금 `열린창구()` 는 **anon 만** 봅니다. 그래서 job_posts 를 대량으로 고치는데
   열쇠도 is_admin() 도 없이 authenticated 에게 열려 있던 창구 넷을
   2026-10-12 까지 **한 번도 보지 않았습니다**.

   ── 옛 `열린창구()` 는 건드리지 않습니다 ─────────────────────
   인수를 더하면 **새 함수**가 되고 권한이 PUBLIC 으로 돌아갑니다 (지침 6-2).
   이름이 다른 함수를 새로 만들고 옛것은 그대로 둡니다.

   ── ★ 「갈래」는 **참고일 뿐입니다** (2026-10-12 세중님 지적) ──
   허용 목록은 **갈래와 상관없이 이름 전부**로 둡니다. 목록에 없는 이름이
   하나라도 생기면 갈래가 무엇이든 하루 요약 메일에 뜹니다.

   갈래를 믿으면 안 되는 까닭 — 글자만 보기 때문입니다.
     · `prosrc ilike '%collect_secret%'` 는 **주석에 그 낱말이 있어도** 걸립니다.
       열쇠를 **검사하지 않고** 이름만 적어 둔 함수가 「수집기창구」로 빠집니다
     · `is_admin()` 도 같습니다 — 주석이나 딴 용도로 쓰여도 「관리자창구」가 됩니다
     · 「순수계산」이 제일 위험했습니다. plpgsql 이
         `perform 어떤함수(...);`
       로 job_posts 를 고쳐도 본문에 `from·insert·update` 글자가 없어
       「표를 안 읽는다」로 통과합니다. 오늘 찾은 「검사 없는 창구 넷」 같은 것이
       그렇게 다시 숨을 수 있습니다

   그래서 갈래는 **사람이 볼 순서**를 정하는 데만 쓰고, 판정에는 안 씁니다
   (지침 10-3 과 같은 결 — 이름·낱말로 성격을 짐작하지 않습니다).
   대신 줄마다 **세 가지 낌새**를 같이 돌려줍니다.

     검사글자   collect_secret · is_admin · auth.uid · 없음
                → 「글자가 있다」는 뜻일 뿐입니다. **막는다는 뜻이 아닙니다**
     쓰기낌새   insert·update·delete **또는 `perform`** 이 있나
                → perform 을 넣은 까닭이 위의 「순수계산」 구멍입니다
     닿는표     job_posts · profiles 를 글에서 말하나

   `검사글자 = 없음` 이고 `쓰기낌새 = true` 인 줄이 **가장 먼저 볼 것**입니다.

   권한 — 새 함수라 PUBLIC 이 붙습니다. 끝에서 걷고 service_role 에만 줍니다.

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
    select 이름,
      /* ── 갈래: 사람이 볼 순서를 정하는 **참고**입니다. 판정에 안 씁니다 ── */
      case
        when 결과 = 'trigger'                 then '트리거'
        when prosrc ilike '%collect_secret%'  then '수집기창구'
        when prosrc ~ 'is_admin\(\)'          then '관리자창구'
        when prosrc ~ 'auth\.uid\(\)'         then '회원창구'
        when prosrc !~* '\m(from|join|insert|update|delete|perform)\M' then '순수계산'
        when proname like 'admin!_%' escape '!' then '검토'
        when proname in ('save_my_survey','닉네임쓸수있나','닉네임잡혔나','in_room') then '검토'
        when p_역할 = 'anon'                  then '비회원화면'
        else '검토'
      end as 갈래,
      /* ── 낌새 셋: 「글자가 있나」입니다. 「막는다」는 뜻이 아닙니다 ── */
      case
        when prosrc ilike '%collect_secret%' then 'collect_secret'
        when prosrc ~ 'is_admin\(\)'         then 'is_admin'
        when prosrc ~ 'auth\.uid\(\)'        then 'auth.uid'
        else '없음'
      end as 검사글자,
      (prosrc ~* '\m(insert|update|delete|perform)\M') as 쓰기낌새,
      nullif(concat_ws(' · ',
        case when prosrc ~ '\mjob_posts\M' then 'job_posts' end,
        case when prosrc ~ '\mprofiles\M'  then 'profiles'  end), '') as 닿는표
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
    '갈래는참고일뿐', '허용 목록은 갈래와 상관없이 이름 전부로 둡니다. '
      || '검사글자는 「글자가 있다」는 뜻이고 막는다는 뜻이 아닙니다',
    '함수', coalesce((select jsonb_agg(jsonb_build_object(
              '이름', 이름, '갈래', 갈래, '검사글자', 검사글자,
              '쓰기낌새', 쓰기낌새, '닿는표', 닿는표) order by 이름) from g), '[]'::jsonb),
    '먼저볼것', coalesce((select jsonb_agg(이름 order by 이름) from g
                 where 검사글자 = '없음' and 쓰기낌새 and 갈래 <> '트리거'), '[]'::jsonb),
    '표',   coalesce((select jsonb_agg(jsonb_build_object('이름', 이름, '갈래', 갈래) order by 이름) from t), '[]'::jsonb))
$$;

revoke execute on function public."열린창구_역할"(text) from public, anon, authenticated;
grant  execute on function public."열린창구_역할"(text) to service_role;
