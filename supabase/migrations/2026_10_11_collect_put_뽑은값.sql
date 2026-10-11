/* collect_put 이 **공고문에서 뽑은 값**을 받게 합니다 (2026-10-11 세중님 1순위).
 *
 * 왜 — 수집기가 kordoc 으로 공고문을 읽어 일곱 칸을 뽑는데, collect_put 이
 * `뽑은값`·`뽑은법`·`apply_to_time` 을 **안 받아서 조용히 버려집니다.**
 * (붙이기 전에 함수 본문을 읽어 확인했습니다 — 지침 5절)
 *
 * 더하는 것 셋뿐입니다. **나머지는 글자까지 그대로**입니다 —
 *   apply_to_time   마감 시각 (「2026. 10. 18. 23:00까지」)
 *   뽑은값          공고문에서 뽑은 것 + **근거**. 기존 값과 **합칩니다**
 *   뽑은법 · 뽑은때  무엇으로 읽었나 (kordoc)
 *
 * ★ `뽑은값` 은 `공고칸채우기.mjs` 도 씁니다. 그래서 덮지 않고
 *   `coalesce(j.뽑은값,'{}') || excluded.뽑은값` 로 **합칩니다** —
 *   한쪽이 먼저 채운 것을 다른 쪽이 지우지 않게.
 *
 * ★ 인수를 안 바꿨습니다 (`p_secret text, p_source text, p_rows jsonb` · 기본값 없음).
 *   그래서 **같은 함수**이고 권한이 유지됩니다 (지침 6-2). 그래도 끝에
 *   revoke/grant 를 다시 걸어 둡니다 — 고치기 전 값은
 *   `{postgres, service_role}` 이고 PUBLIC 이 없습니다.
 */
create or replace function collect_put(p_secret text, p_source text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok int := 0; v_bad int := 0; v_나쁜 jsonb := '[]'::jsonb; r jsonb;
  v_짝 text;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  select 옛출처 into v_짝 from 수집기짝 where 새출처 = p_source;

  perform set_config('app.누가', '수집기 ' || p_source, true);

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'id', '') = '' then raise exception '공고ID 가 없습니다'; end if;
      insert into job_posts as j (
        id, source, external_id, org_name, title, hire_type, employ_type,
        work_place, sido, sgg, edu, headcount, apply_from, apply_to, posted_at,
        url, job_group, form, org_kind, tab, hidden, hold, notify,
        detail, evidence, collected_at, updated_at,
        apply_to_time, 뽑은값, 뽑은법, 뽑은때)                      -- ★ 더한 넷
      values (
        r->>'id', p_source, r->>'external_id', r->>'org_name', r->>'title',
        r->>'hire_type', r->>'employ_type', r->>'work_place', r->>'sido', r->>'sgg',
        r->>'edu', nullif(r->>'headcount','')::int,
        nullif(r->>'apply_from','')::date, nullif(r->>'apply_to','')::date,
        nullif(r->>'posted_at','')::date,
        r->>'url', r->>'job_group', r->>'form', r->>'org_kind', r->>'tab',
        coalesce((r->>'hidden')::boolean, false),
        coalesce((r->>'hold')::boolean, false),
        coalesce((r->>'notify')::boolean, false),
        coalesce(r->'detail', '{}'::jsonb), coalesce(r->'evidence', '{}'::jsonb),
        coalesce(nullif(r->>'collected_at','')::timestamptz, now()), now(),
        nullif(r->>'apply_to_time','')::time,                        -- ★
        /* ★ 뽑은값 은 not null default '{}' 입니다 — null 을 넣으면 막힙니다
           (2026-10-11 에 클린아이 3건이 그렇게 막혔습니다) */
        coalesce(r->'뽑은값', '{}'::jsonb),                                                  -- ★ 없으면 null
        nullif(r->>'뽑은법',''),                                      -- ★
        case when r ? '뽑은값' then now() else null end)              -- ★
      on conflict (id) do update set
        source = case when (j.source = p_source or j.source = v_짝) then excluded.source else j.source end,
        /* ★ 아래 칸들은 edited_fields 에 적혀 있으면 **그대로 둡니다** */
        org_name   = case when 'org_name'   = any(coalesce(j.edited_fields,'{}')) then j.org_name
                          when (j.source = p_source or j.source = v_짝) then excluded.org_name   else j.org_name end,
        title      = case when 'title'      = any(coalesce(j.edited_fields,'{}')) then j.title
                          when (j.source = p_source or j.source = v_짝) then excluded.title      else j.title end,
        hire_type  = case when 'hire_type'  = any(coalesce(j.edited_fields,'{}')) then j.hire_type
                          when (j.source = p_source or j.source = v_짝) then excluded.hire_type  else j.hire_type end,
        employ_type= case when 'employ_type'= any(coalesce(j.edited_fields,'{}')) then j.employ_type
                          when (j.source = p_source or j.source = v_짝) then excluded.employ_type else j.employ_type end,
        work_place = case when 'work_place' = any(coalesce(j.edited_fields,'{}')) then j.work_place
                          when (j.source = p_source or j.source = v_짝) then excluded.work_place else j.work_place end,
        sido       = case when 'sido'       = any(coalesce(j.edited_fields,'{}')) then j.sido
                          when (j.source = p_source or j.source = v_짝) then excluded.sido       else j.sido end,
        sgg        = case when 'sgg'        = any(coalesce(j.edited_fields,'{}')) then j.sgg
                          when (j.source = p_source or j.source = v_짝) then excluded.sgg        else j.sgg end,
        edu        = case when 'edu'        = any(coalesce(j.edited_fields,'{}')) then j.edu
                          when (j.source = p_source or j.source = v_짝) then excluded.edu        else j.edu end,
        headcount  = case when 'headcount'  = any(coalesce(j.edited_fields,'{}')) then j.headcount
                          when (j.source = p_source or j.source = v_짝) then excluded.headcount  else j.headcount end,
        apply_from = case when 'apply_from' = any(coalesce(j.edited_fields,'{}')) then j.apply_from
                          when (j.source = p_source or j.source = v_짝) then excluded.apply_from else j.apply_from end,
        apply_to   = case when 'apply_to'   = any(coalesce(j.edited_fields,'{}')) then j.apply_to
                          when (j.source = p_source or j.source = v_짝) then excluded.apply_to   else j.apply_to end,
        posted_at  = case when 'posted_at'  = any(coalesce(j.edited_fields,'{}')) then j.posted_at
                          when (j.source = p_source or j.source = v_짝) then excluded.posted_at  else j.posted_at end,
        url        = case when (j.source = p_source or j.source = v_짝) then excluded.url        else j.url end,
        job_group  = case when j.admin_locked then j.job_group
                          when 'job_group'  = any(coalesce(j.edited_fields,'{}')) then j.job_group
                          when (j.source = p_source or j.source = v_짝) then excluded.job_group else j.job_group end,
        form       = case when 'form'       = any(coalesce(j.edited_fields,'{}')) then j.form
                          when (j.source = p_source or j.source = v_짝) then excluded.form       else j.form end,
        org_kind   = case when 'org_kind'   = any(coalesce(j.edited_fields,'{}')) then j.org_kind
                          when (j.source = p_source or j.source = v_짝) then excluded.org_kind   else j.org_kind end,
        hold       = case when j.admin_locked then j.hold
                          when 'hold'       = any(coalesce(j.edited_fields,'{}')) then j.hold
                          when j.hidden then false
                          when (j.source = p_source or j.source = v_짝) then excluded.hold else j.hold end,
        detail     = case when (j.source = p_source or j.source = v_짝) then excluded.detail     else j.detail end,
        evidence   = case when (j.source = p_source or j.source = v_짝) then excluded.evidence   else j.evidence end,
        /* ★ 2026-10-11 — 공고문에서 뽑은 것.
           apply_to_time 은 다른 칸과 같은 규칙(관리자가 고쳤으면 그대로).
           뽑은값은 **합칩니다** — 공고칸채우기.mjs 가 먼저 채운 것을 안 지우게.
           새로 온 값이 없으면(= 이번에 공고문을 안 읽었으면) 건드리지 않습니다 */
        apply_to_time = case when 'apply_to_time' = any(coalesce(j.edited_fields,'{}')) then j.apply_to_time
                             when excluded.apply_to_time is null then j.apply_to_time
                             when (j.source = p_source or j.source = v_짝) then excluded.apply_to_time
                             else j.apply_to_time end,
        뽑은값 = case when j.admin_locked then j.뽑은값
                     when excluded.뽑은값 = '{}'::jsonb then j.뽑은값
                     else coalesce(j.뽑은값, '{}'::jsonb) || excluded.뽑은값 end,
        뽑은법 = coalesce(excluded.뽑은법, j.뽑은법),
        뽑은때 = case when excluded.뽑은값 = '{}'::jsonb then j.뽑은때 else now() end,
        updated_at = now()
      where j.source = p_source
         or j.source is null
         or (v_짝 is not null and j.source = v_짝);
      v_ok := v_ok + 1;
    exception when others then
      v_bad := v_bad + 1;
      if jsonb_array_length(v_나쁜) < 20 then
        v_나쁜 := v_나쁜 || jsonb_build_object('id', r->>'id', 'why', left(sqlerrm, 160));
      end if;
    end;
  end loop;

  return jsonb_build_object('담음', v_ok, '건너뜀', v_bad, '건너뛴것', v_나쁜);
end
$$;

/* 고치기 전과 똑같은 권한으로 다시 (PUBLIC 없음 · service_role 만) */
revoke execute on function collect_put(text, text, jsonb) from public, anon, authenticated;
grant  execute on function collect_put(text, text, jsonb) to service_role;
