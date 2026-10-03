-- ════════════════════════════════════════════════════════════════
--  주인 넘기기 — **다섯 짝만** (워크넷 제외)
--  2026-10-03 · 세중님 승인
-- ════════════════════════════════════════════════════════════════
--
--  왜 다섯만인가
--    짝 대조에서 워크넷만 걸렸습니다 — 옛것만 읽은 접수 중 83건.
--    까닭은 코드에 있습니다. 옛 WN 은 여덟 갈래(직종1·면허3·낱말4)로 찾고,
--    WN2 는 직종코드 한 갈래뿐입니다 (tools/collect-worknet.mjs 233줄).
--    WN2 에 빠진 일곱 갈래를 붙인 뒤 여섯째 짝을 따로 넘깁니다.
--
--    나머지 다섯은 통과입니다 —
--      AL·CE·GJ   옛것만 0건
--      HS         접수 중 6건이 전부 **다른 직군** (총무·기능원·약제·임상병리사·방사선사)
--      ND         3건, 마감일 빈 칸. 전부 DB 에 있습니다
--
--  ★ 이 SQL 을 올리기 **전에** 다리를 먼저 손봐야 합니다
--    tools/sync_jobs.js 199줄  const 새수집기 = ['AL2'];
--    → ['AL2', 'CE2', 'GJ2', 'HS3', 'ND2'] 로
--    다리는 service_role 로 job_posts 에 **직접** upsert 하고,
--    source 를 공고ID 앞 글자로 정합니다 (copy_jobs.js sourceOf).
--    비키는 목록에 안 넣으면 넘어간 줄을 옛 이름표로 되돌립니다.
--
--  하는 일 — 규칙 하나를 바꿉니다. 일괄 수정이 아닙니다
--    collect_put 의 where 에 「내 짝인 옛 줄도 가져갈 수 있다」를 더합니다.
--    주인은 새 수집기가 그 공고를 **다시 읽을 때** 하나씩 넘어갑니다.
--
--  지우는 줄(DROP·DELETE·TRUNCATE) 하나도 없습니다.
--  옛 정의는 아래 ① 에서 함수사본에 저장합니다.
--  되돌리기 — sql/2026-10-03_주인넘기기_되돌리기.sql
-- ════════════════════════════════════════════════════════════════
begin;

-- ① 옛 정의를 먼저 사본으로 (되돌릴 수 있게)
insert into 함수사본 (이름, 때, 정의)
select 'collect_put (짝만 가져가기 전 · 2026-10-03)', now(), pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'collect_put';

-- ② 짝 표 — 새 출처 → 그 짝인 옛 출처
--    collect_source 의 note 에 적힌 짝 그대로입니다. 코드에 박지 않고 표로 둡니다.
create table if not exists 수집기짝 (
  새출처 text primary key,
  옛출처 text not null,
  이름   text not null,
  메모   text
);

insert into 수집기짝 (새출처, 옛출처, 이름, 메모) values
  ('AL2', 'AL', '알리오',        'tools/collect-alio.mjs · Lightsail'),
  ('CE2', 'CE', '클린아이',      'tools/collect-cleaneye.mjs · Lightsail'),
  ('GJ2', 'GJ', '나라일터',      'tools/collect-nara.mjs · Lightsail'),
  ('HS3', 'HS', '병원 홈페이지',  'tools/collect-hosp.mjs · Lightsail'),
  ('ND2', 'ND', '치매센터',      'tools/collect-nid.mjs · Lightsail')

on conflict (새출처) do update
  set 옛출처 = excluded.옛출처, 이름 = excluded.이름, 메모 = excluded.메모;

-- HS2(백필)·JF(JobFlex)·ALIVE 는 짝이 없습니다. 일부러 넣지 않았습니다.

-- ③ 규칙 한 줄만 바꿉니다
--    (본문 전체를 다시 쓰지만 달라지는 곳은 맨 아래 where 한 줄입니다.
--     올리기 전에 위 ① 사본과 diff 로 그것만 바뀌었는지 확인하십시오)
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
        source = case when j.source = p_source then excluded.source else j.source end,
        org_name   = case when j.source = p_source then excluded.org_name   else j.org_name end,
        title      = case when j.source = p_source then excluded.title      else j.title end,
        hire_type  = case when j.source = p_source then excluded.hire_type  else j.hire_type end,
        employ_type= case when j.source = p_source then excluded.employ_type else j.employ_type end,
        work_place = case when j.source = p_source then excluded.work_place else j.work_place end,
        sido       = case when j.source = p_source then excluded.sido       else j.sido end,
        sgg        = case when j.source = p_source then excluded.sgg        else j.sgg end,
        edu        = case when j.source = p_source then excluded.edu        else j.edu end,
        headcount  = case when j.source = p_source then excluded.headcount  else j.headcount end,
        apply_from = case when j.source = p_source then excluded.apply_from else j.apply_from end,
        apply_to   = case when j.source = p_source then excluded.apply_to   else j.apply_to end,
        posted_at  = case when j.source = p_source then excluded.posted_at  else j.posted_at end,
        url        = case when j.source = p_source then excluded.url        else j.url end,
        /* ★ 관리자가 정한 것은 그대로 둡니다 */
        job_group  = case when j.admin_locked then j.job_group
                          when j.source = p_source then excluded.job_group else j.job_group end,
        form       = case when j.source = p_source then excluded.form       else j.form end,
        org_kind   = case when j.source = p_source then excluded.org_kind   else j.org_kind end,
        hold       = case when j.admin_locked then j.hold
                          when j.hidden then false            -- 숨긴 것은 보류로 안 올립니다
                          when j.source = p_source then excluded.hold else j.hold end,
        detail     = case when j.source = p_source then excluded.detail     else j.detail end,
        evidence   = case when j.source = p_source then excluded.evidence   else j.evidence end,
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

commit;

-- ─────────────────────────────────────────────────────────────
-- 올린 바로 뒤에 확인할 것
--
-- 1) 권한이 그대로인지
--      select proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname='collect_put';
--      → anon 에 EXECUTE 가 붙어 있어야 합니다
--
-- 2) 짝 표가 여섯 줄인지
--      select * from 수집기짝 order by 새출처;
--
-- 3) 넘어가는지 — 수집기를 한 바퀴 돌리고 출처별 건수를 다시 셉니다
--      select source, count(*) from job_posts group by 1 order by 1;
--      → 옛 출처(AL·CE·GJ·HS·ND·WN) 가 줄고 새 출처가 그만큼 늘어야 합니다
--
-- 4) 회원 화면 공고 수가 10% 넘게 흔들리지 않는지
--      select * from job_totals();     -- 기준 361
