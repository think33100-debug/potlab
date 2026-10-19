-- cfg 목록 ↔ `hosp_sites` 표를 **맞추는 창구** (2026-10-19 세중님 ㉣ⓐ 승인)
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- ① 「안 긁는 1층 기관」 은 `일층병원_구멍()` 이 셉니다. 그 함수는
-- **`hosp_sites` 표**에 이름이 있나로 「사이트있음 / 사각지대」 를 가립니다
-- (110~112줄). 그런데 **그 표에 새 줄을 넣는 길이 없습니다** —
--
--   cfgs → build_sites.js → hosp_sites.js → replace_sites.js → gas/wage.js
--
-- 이 길은 **gas 파일**을 굽는 길이고 DB 표와 무관합니다. 그래서 설정(cfg)을
-- 붙여도 ① 숫자가 그대로였습니다 (2026-10-19 저녁에 찾은 뿌리).
--
-- 이미 있던 `기관사이트_옮기기()` 는 **`update` 만** 합니다 — 표에 이미 있는
-- 이름의 긁는규칙을 옮기는 함수이고, 새 이름은 「못 찾은 줄」로만 셉니다.
--
-- ── 이 창구가 하는 일 ────────────────────────────────────────────
--   · cfg 줄을 받아 **없으면 넣고, 있으면 고칩니다** (upsert)
--   · **지우지 않습니다.** 표에만 있고 cfg 에 없는 이름은 **목록으로 돌려줍니다** —
--     지우는 것은 세중님이 보고 정하십니다 (지침 8-7 — `delete` 글자는 승인 창을
--     띄워 그 사이 모든 일이 막힙니다. 그래서 이 함수에는 그 글자가 없습니다)
--   · `p_마른` 이 true(기본)면 **아무것도 쓰지 않고 셈과 목록만** 돌려줍니다
--
-- ★ 열쇠 검사는 `기관사이트_옮기기()` 와 **같은 꼴**입니다 —
--   `collect_secret` 의 HS3 열쇠, 24자 이상.
-- ★ 표를 직접 쓰지 않고 이 창구만 씁니다 (지침).

create or replace function 기관사이트_맞추기(
  p_secret text,
  p_rows   jsonb,
  p_마른   boolean default true
) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_넣음 int := 0;
  v_고침 int := 0;
  v_그대로 int := 0;
  v_표에만 jsonb := '[]'::jsonb;
  v_줄 int := 0;
begin
  if p_secret is null
     or not exists (select 1 from collect_secret s
                     where s.source = 'HS3'
                       and s.secret = p_secret
                       and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  perform set_config('app.누가', '기관 사이트 맞추기', true);
  v_줄 := coalesce(jsonb_array_length(p_rows), 0);

  /* ★ 임시 표를 쓰지 않습니다 — `create temporary` + `delete` 꼴은
     ㉠ `delete` 에 `where` 가 없어 Supabase 안전장치에 막히고
     ㉡ `delete` 글자가 승인 창을 띄울 수 있습니다 (지침 8-7)
     그래서 **CTE** 로 그때그때 만듭니다 (2026-10-19) */

  /* 표에만 있고 cfg 에 없는 이름 — **지우지 않고 알려만 줍니다** */
  with 맞출것 as (
    select r->>'name' as name
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'url', s.url)
                            order by s.name), '[]'::jsonb)
    into v_표에만
    from hosp_sites s
   where not exists (select 1 from 맞출것 c where c.name = s.name);

  /* 셈 — 마른 실행이든 아니든 같은 수를 냅니다 */
  with 맞출것 as (
    select r->>'name' as name,
           r->>'url'  as url,
           coalesce(nullif(r->>'type', ''), 'html') as kind,
           (r - 'name' - 'url' - 'base' - 'type') as 규칙
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
  )
  select count(*) filter (where s.name is null),
         count(*) filter (where s.name is not null
                           and (coalesce(s."채용주소",'') is distinct from coalesce(c.url,'')
                             or coalesce(s."갈래",'')     is distinct from coalesce(c.kind,'')
                             or coalesce(s."긁는규칙",'{}'::jsonb) is distinct from coalesce(c.규칙,'{}'::jsonb))),
         count(*) filter (where s.name is not null
                           and coalesce(s."채용주소",'') = coalesce(c.url,'')
                           and coalesce(s."갈래",'')     = coalesce(c.kind,'')
                           and coalesce(s."긁는규칙",'{}'::jsonb) = coalesce(c.규칙,'{}'::jsonb))
    into v_넣음, v_고침, v_그대로
    from 맞출것 c
    left join hosp_sites s on s.name = c.name;

  if p_마른 then
    return jsonb_build_object(
      '마른', true, '받은 줄', v_줄,
      '새로 넣을 것', v_넣음, '고칠 것', v_고침, '그대로', v_그대로,
      '표에만 있는 것', jsonb_array_length(v_표에만), '표에만 있는 목록', v_표에만,
      '※', '지우지 않습니다 — 표에만 있는 것은 세중님이 보고 정하십니다');
  end if;

  /* 있으면 고칩니다 */
  with 맞출것 as (
    select r->>'name' as name,
           r->>'url'  as url,
           coalesce(nullif(r->>'type', ''), 'html') as kind,
           (r - 'name' - 'url' - 'base' - 'type') as 규칙
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
  )
  update hosp_sites s
     set "채용주소" = c.url,
         "갈래"     = c.kind,
         "긁는규칙" = coalesce(c.규칙, '{}'::jsonb),
         "옮긴날"   = (now() at time zone 'Asia/Seoul')::date
    from 맞출것 c
   where s.name = c.name;

  /* 없으면 넣습니다 — `url_key` 는 지금 표가 쓰는 꼴(주소 그대로)을 따릅니다.
     같은 이름이 cfg 에 여럿이면 하나만 넣습니다 (`distinct on`) */
  with 맞출것 as (
    select distinct on (r->>'name')
           r->>'name' as name,
           r->>'url'  as url,
           nullif(r->>'base', '') as base,
           coalesce(nullif(r->>'type', ''), 'html') as kind,
           (r - 'name' - 'url' - 'base' - 'type') as 규칙
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
     order by r->>'name'
  )
  insert into hosp_sites
         (name, url, base, kind, loaded_on, url_key,
          "채용주소", "갈래", "긁는규칙", "끔", "집에서만", "옮긴날", note)
  select c.name, c.url, c.base, c.kind,
         (now() at time zone 'Asia/Seoul')::date, c.url,
         c.url, c.kind, coalesce(c.규칙, '{}'::jsonb), false, false,
         (now() at time zone 'Asia/Seoul')::date,
         'cfg 에서 맞춤 (기관사이트_맞추기 · ' || (now() at time zone 'Asia/Seoul')::date || ')'
    from 맞출것 c
   where not exists (select 1 from hosp_sites s where s.name = c.name)
  on conflict (name, url_key) do nothing;

  return jsonb_build_object(
    '마른', false, '받은 줄', v_줄,
    '새로 넣음', v_넣음, '고침', v_고침, '그대로', v_그대로,
    '표에만 있는 것', jsonb_array_length(v_표에만), '표에만 있는 목록', v_표에만,
    '※', '지우지 않습니다 — 표에만 있는 것은 세중님이 보고 정하십니다');
end
$fn$;

revoke execute on function 기관사이트_맞추기(text, jsonb, boolean) from public, anon, authenticated;
grant  execute on function 기관사이트_맞추기(text, jsonb, boolean) to service_role;

comment on function 기관사이트_맞추기(text, jsonb, boolean) is
  'cfg 목록을 hosp_sites 표에 맞춥니다 — 없으면 넣고 있으면 고칩니다. 지우지 않고 「표에만 있는 것」은 목록으로 돌려줍니다. p_마른 이 기본 true (2026-10-19)';

-- ── 스스로 하는 검사 — 표를 건드리지 않습니다 ──────────────────
do $chk$
declare
  v jsonb;
  v_전 int;
  v_후 int;
begin
  /* 열쇠가 틀리면 멈춰야 합니다 */
  begin
    perform 기관사이트_맞추기('짧은열쇠', '[]'::jsonb, true);
    raise exception '자기점검 ① 틀린 열쇠를 받아들입니다';
  exception when sqlstate '42501' then null;
  end;

  select count(*) into v_전 from hosp_sites;

  /* 마른 실행은 **아무것도 안 써야** 합니다 */
  v := 기관사이트_맞추기(
         (select secret from collect_secret where source = 'HS3' limit 1),
         jsonb_build_array(jsonb_build_object(
           'name', '자기점검용 없는병원', 'url', 'http://example.invalid/x', 'type', 'html')),
         true);
  select count(*) into v_후 from hosp_sites;
  if v_전 <> v_후 then raise exception '자기점검 ② 마른 실행이 표를 바꿨습니다'; end if;
  if (v->>'새로 넣을 것')::int <> 1 then
    raise exception '자기점검 ③ 새 이름을 「새로 넣을 것」으로 안 셉니다 — %', v;
  end if;
  if (v->>'마른')::boolean is not true then raise exception '자기점검 ④ 마른 표시가 없습니다'; end if;
  if (v->>'표에만 있는 것')::int < 1 then
    raise exception '자기점검 ⑤ 표에만 있는 것을 안 셉니다 (표에 288줄이 있습니다)';
  end if;

  /* 이름·주소가 없는 줄은 셈에서 빠져야 합니다 */
  v := 기관사이트_맞추기(
         (select secret from collect_secret where source = 'HS3' limit 1),
         jsonb_build_array(
           jsonb_build_object('name', '', 'url', 'http://a.invalid/'),
           jsonb_build_object('name', '이름만있음'),
           jsonb_build_object('name', '자기점검용 없는병원2', 'url', 'http://example.invalid/y')),
         true);
  if (v->>'새로 넣을 것')::int <> 1 then
    raise exception '자기점검 ⑥ 이름·주소 없는 줄을 셈에 넣습니다 — %', v;
  end if;

  /* `delete` 글자가 본문에 없어야 합니다 — 승인 창을 띄우지 않으려고 */
  if (select pg_get_functiondef(p.oid) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = '기관사이트_맞추기')
     ~* 'delete[[:space:]]+from[[:space:]]+hosp_sites' then
    raise exception '자기점검 ⑦ hosp_sites 를 지우는 글이 있습니다';
  end if;

  raise notice '기관사이트_맞추기 자기점검 7가지 통과 (표 % 줄 그대로)', v_후;
end
$chk$;
