-- ════════════════════════════════════════════════════════════════
--  주인 넘기기 고침 — 짝 줄이 헛돌던 것 (2026-10-03)
--  ★ 아직 올리지 않았습니다. 세중님 승인 뒤에 올립니다.
-- ════════════════════════════════════════════════════════════════
--
--  무엇이 잘못됐나
--    15:04 에 올린 다섯 짝 SQL 은 where 를 열었지만 **아무것도 넘기지 못합니다.**
--      where j.source = p_source or j.source is null
--         or (v_짝 is not null and j.source = v_짝)      ← 열었습니다
--      source = case when j.source = p_source then excluded.source
--                                              else j.source end   ← 막습니다
--    HS3 가 HS 줄을 쓰면 j.source('HS') = p_source('HS3') 가 거짓이라
--    **모든 칸이 옛 값으로 남습니다.** source 도 안 바뀝니다.
--
--  실제로 재 봤습니다 (15:06 수집기 한 바퀴)
--    손질된 HS·HS3 줄  275건
--      아직 HS         235건
--      HS3 로 바뀐 것    0건      ← updated_at 만 움직였습니다
--
--  고치는 것 — case 조건 **20곳**에 짝을 더합니다
--      전  case when j.source = p_source then …
--      후  case when (j.source = p_source or j.source = v_짝) then …
--    v_짝 이 null 이면 `j.source = null` 이 NULL 이라 거짓입니다 — 짝 없는
--    출처는 지금과 똑같이 돕니다.
--
--  그대로 두는 것
--    · where 줄 (이미 맞습니다)
--    · admin_locked 보호 두 칸 (job_group · hold) — 관리자가 정한 것이 먼저입니다
--    · 권한·짝 표·함수사본 (15:04 에 이미 올라갔습니다)
--
--  되돌리기 — sql/2026-10-03_주인넘기기_되돌리기.sql 그대로 씁니다
--    (함수사본의 「짝만 가져가기 전」 정의로 돌립니다)
-- ════════════════════════════════════════════════════════════════

create or replace function collect_put(p_secret text, p_source text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
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

  /* 내 짝인 옛 출처. 짝이 없으면 null 이고, 그러면 옛 규칙과 똑같이 돕니다 */
  select 옛출처 into v_짝 from 수집기짝 where 새출처 = p_source;

  perform set_config('app.누가', '수집기 ' || p_source, true);

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'id', '') = '' then raise exception '공고ID 가 없습니다'; end if;
      insert into job_posts as j (
        id, source, external_id, org_name, title, hire_type, employ_type,
        work_place, sido, sgg, edu, headcount, apply_from, apply_to, posted_at,
        url, job_group, form, org_kind, tab, hidden, hold, notify,
        detail, evidence, collected_at, updated_at)
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
        coalesce(nullif(r->>'collected_at','')::timestamptz, now()), now())
      on conflict (id) do update set
        source = case when (j.source = p_source or j.source = v_짝) then excluded.source else j.source end,
        org_name   = case when (j.source = p_source or j.source = v_짝) then excluded.org_name   else j.org_name end,
        title      = case when (j.source = p_source or j.source = v_짝) then excluded.title      else j.title end,
        hire_type  = case when (j.source = p_source or j.source = v_짝) then excluded.hire_type  else j.hire_type end,
        employ_type= case when (j.source = p_source or j.source = v_짝) then excluded.employ_type else j.employ_type end,
        work_place = case when (j.source = p_source or j.source = v_짝) then excluded.work_place else j.work_place end,
        sido       = case when (j.source = p_source or j.source = v_짝) then excluded.sido       else j.sido end,
        sgg        = case when (j.source = p_source or j.source = v_짝) then excluded.sgg        else j.sgg end,
        edu        = case when (j.source = p_source or j.source = v_짝) then excluded.edu        else j.edu end,
        headcount  = case when (j.source = p_source or j.source = v_짝) then excluded.headcount  else j.headcount end,
        apply_from = case when (j.source = p_source or j.source = v_짝) then excluded.apply_from else j.apply_from end,
        apply_to   = case when (j.source = p_source or j.source = v_짝) then excluded.apply_to   else j.apply_to end,
        posted_at  = case when (j.source = p_source or j.source = v_짝) then excluded.posted_at  else j.posted_at end,
        url        = case when (j.source = p_source or j.source = v_짝) then excluded.url        else j.url end,
        /* ★ 관리자가 정한 것은 그대로 둡니다 */
        job_group  = case when j.admin_locked then j.job_group
                          when (j.source = p_source or j.source = v_짝) then excluded.job_group else j.job_group end,
        form       = case when (j.source = p_source or j.source = v_짝) then excluded.form       else j.form end,
        org_kind   = case when (j.source = p_source or j.source = v_짝) then excluded.org_kind   else j.org_kind end,
        hold       = case when j.admin_locked then j.hold
                          when j.hidden then false            -- 숨긴 것은 보류로 안 올립니다
                          when (j.source = p_source or j.source = v_짝) then excluded.hold else j.hold end,
        detail     = case when (j.source = p_source or j.source = v_짝) then excluded.detail     else j.detail end,
        evidence   = case when (j.source = p_source or j.source = v_짝) then excluded.evidence   else j.evidence end,
        updated_at = now()
      /* ★★ 여기가 바뀐 **한 줄**입니다 (2026-10-03).
         내 줄 · 임자 없는 줄 · **내 짝인 옛 줄**만 고칠 수 있습니다.
         짝이 아닌 출처끼리는 지금처럼 서로 못 가져갑니다 */
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
end $function$;