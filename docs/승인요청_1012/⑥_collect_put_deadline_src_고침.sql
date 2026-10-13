/* collect_put — deadline_src 규칙 한 줄 고침 (2026-10-13 · 세중님 지시)

   ═══ 왜 고치나 ═══════════════════════════════════════════════

   어제 올린 규칙은 「**apply_to 가 바뀔 때만** 출처를 바꾼다」 였습니다.
   그래서 **이미 담긴 2,033건은 마감일이 실제로 바뀔 때까지 출처가 안 찹니다.**
   세중님이 「제가 정한 것이 너무 빡빡했습니다」 라고 하셔서 고칩니다.

   ═══ 새 규칙 ═══════════════════════════════════════════════

     deadline_src 가 **비어 있으면**
       수집기가 출처를 보내면 **채웁니다** — 날짜가 같아도 됩니다.
       날짜가 같으니 그 출처가 맞습니다.

     deadline_src 가 **이미 차 있으면**
       **apply_to 가 바뀔 때만** 바꿉니다 (어제 규칙 그대로).
       마감일과 출처가 늘 짝이 맞게.

   손으로 정한 것은 그대로 비킵니다 —
     admin_locked 인 줄
     edited_fields 에 apply_to 가 적힌 줄
   그리고 **남의 출처 줄**(j.source 가 이번 출처도 짝도 아닌 줄)은 안 건드립니다.

   ═══ 고친 곳 — `deadline_src` case 블록 **하나**뿐입니다 ══════

   앞 (2026-10-13 아침에 올린 것)
     deadline_src = case
                       when j.admin_locked then j.deadline_src
                       when 'apply_to' = any(coalesce(j.edited_fields,'{}')) then j.deadline_src
                       when (j.source = p_source or j.source = v_짝)
                            and excluded.apply_to is distinct from j.apply_to
                         then excluded.deadline_src
                       else j.deadline_src end,

   뒤 (이 파일)
     deadline_src = case
                       when j.admin_locked then j.deadline_src
                       when 'apply_to' = any(coalesce(j.edited_fields,'{}')) then j.deadline_src
                       when not (j.source = p_source or j.source = v_짝) then j.deadline_src
                       when j.deadline_src is null
                         then coalesce(excluded.deadline_src, j.deadline_src)
                       when excluded.apply_to is distinct from j.apply_to
                         then excluded.deadline_src
                       else j.deadline_src end,

   나머지는 **글자까지 그대로**입니다.
   인수도 그대로 — p_secret text, p_source text, p_rows jsonb.
   ACL 도 손대지 않습니다 (postgres · service_role).

   ═══ 올린 뒤 확인할 것 ═════════════════════════════════════

     ① pg_proc 에 collect_put 이 하나뿐 · 인수 그대로
     ② tools/창구_deadline_src시험.mjs 에 ④ 갈래를 더해 쏘고 되돌리기
        ④ 「deadline_src 가 null + 같은 날짜 + 출처를 보냄」 → **채워져야** 합니다
     ③ 다음 한 바퀴 뒤 「마감일은 있는데 출처 없음」 2,033 → 몇 건인지 출처별로

   지우는 문장이 한 줄도 없습니다. */

create or replace function public.collect_put(p_secret text, p_source text, p_rows jsonb)
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
        apply_to_time, deadline_src, "뽑은값", "뽑은법", "뽑은때")
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
        nullif(r->>'apply_to_time','')::time,
        nullif(r->>'deadline_src',''),
        /* ★ 뽑은값 은 not null default '{}' 입니다 — null 을 넣으면 막힙니다
           (2026-10-11 에 클린아이 3건이 그렇게 막혔습니다) */
        coalesce(r->'뽑은값', '{}'::jsonb),
        nullif(r->>'뽑은법',''),
        case when r ? '뽑은값' then now() else null end)
      on conflict (id) do update set
        source = case when (j.source = p_source or j.source = v_짝) then excluded.source else j.source end,
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
        /* ★ 2026-10-13 고침 — 비어 있으면 같은 날짜라도 채우고,
              차 있으면 마감일이 바뀔 때만 바꿉니다 (세중님 지시) */
        deadline_src = case
                          when j.admin_locked then j.deadline_src
                          when 'apply_to' = any(coalesce(j.edited_fields,'{}')) then j.deadline_src
                          when not (j.source = p_source or j.source = v_짝) then j.deadline_src
                          when j.deadline_src is null
                            then coalesce(excluded.deadline_src, j.deadline_src)
                          when excluded.apply_to is distinct from j.apply_to
                            then excluded.deadline_src
                          else j.deadline_src end,
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
        apply_to_time = case when 'apply_to_time' = any(coalesce(j.edited_fields,'{}')) then j.apply_to_time
                             when excluded.apply_to_time is null then j.apply_to_time
                             when (j.source = p_source or j.source = v_짝) then excluded.apply_to_time
                             else j.apply_to_time end,
        /* 빈 객체면 「이번에 공고문을 안 읽었다」는 뜻 — 건드리지 않습니다 */
        "뽑은값" = case when j.admin_locked then j."뽑은값"
                     when excluded."뽑은값" = '{}'::jsonb then j."뽑은값"
                     else coalesce(j."뽑은값", '{}'::jsonb) || excluded."뽑은값" end,
        "뽑은법" = coalesce(excluded."뽑은법", j."뽑은법"),
        "뽑은때" = case when excluded."뽑은값" = '{}'::jsonb then j."뽑은때" else now() end,
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
