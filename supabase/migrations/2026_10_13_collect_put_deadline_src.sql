/* collect_put 이 deadline_src 를 받게 합니다 (2026-10-13 · 세중님 승인)

   ═══ 왜 ═════════════════════════════════════════════════════

   마감일 2,086건 중 **2,029건의 출처를 모릅니다.**
     deadline_src 찬 것        15건  (alive_mark · 손으로 고친 것)
     evidence.날짜출처 찬 것    51건  (수집기가 대신 적던 자리)
   까닭은 `tools/collect-hosp.mjs:450` 주석에 이미 적혀 있었습니다 —
   「job_posts.deadline_src 칸이 있지만 **collect_put 창구가 그 칸을 안 받습니다**」

   ═══ 인수를 **안** 바꿉니다 (세중님 지시) ════════════════════

   인수를 더하면 같은 이름의 함수가 둘이 되어(overload) 수집기가 헷갈립니다.
   2026-10-09 「알림넣기 두 벌」 사고와 같은 꼴입니다.
   그래서 **지금 받는 `p_rows` 줄 안의 `deadline_src` 키를 읽습니다.**
     인수  p_secret text, p_source text, p_rows jsonb   ← 그대로
     ACL   postgres · service_role                      ← 그대로 (손 안 댑니다)

   ═══ 고친 곳 **셋** ═════════════════════════════════════════

   ① insert 칸 목록에 `deadline_src` 를 더함
   ② values 에 `nullif(r->>'deadline_src','')` 를 더함
   ③ on conflict do update 에 `deadline_src` 를 더함 —
      **apply_to 가 바뀔 때만** 바꿉니다 (마감일과 출처가 늘 짝이 맞게).
      apply_to 가 그대로면 출처도 그대로 둡니다. 안 그러면 이번 실행이 읽은 출처가
      **예전에 들어온 날짜**에 붙어 거짓 기록이 됩니다.
      `admin_locked` 과 `edited_fields` 에 apply_to 가 적힌 줄은 안 건드립니다.

   나머지는 **글자까지 그대로**입니다.

   ═══ 짧은 정해진 말 ═════════════════════════════════════════

   수집기가 보낼 말입니다. 길게 쓰지 않습니다 — 세는 데 쓰려고요.

     API:워크넷 · API:알리오 · API:나라일터 · API:클린아이 ·
     API:치매센터 · API:고용24      출처 API 가 준 날짜
     목록                           병원 게시판 **목록 줄**의 날짜
     본문                           상세 **본문**의 접수기간
     제목                           **제목**에서 읽음
     첨부(kordoc)                   **첨부 공고문**에서 읽음
     정찰                           정찰이 원문을 다시 읽어 채움
     담당자                         BIZ — 담당자가 적음

   더 적고 싶으면 뒤에 ' · ' 로 붙입니다 (예: `본문 · 공고기간`).
   지금 `evidence.날짜출처` 가 쓰는 말과 앞머리를 맞췄습니다
   (「본문 · 접수기간」 35건 · 「본문 · 공고기간」 12건).

   ═══ 지난 것은 지어내지 않습니다 (세중님 지시) ═══════════════

   2,029건 중 **`evidence.날짜출처` 가 있는 51건만** 옮깁니다.
   나머지 1,978건은 **비워 둡니다.** 어디서 왔는지 모르는 것을 적을 수 없습니다.
   옮기는 SQL 은 이 파일 끝에 있습니다 (updated_at 을 안 건드립니다).

   ═══ 올린 뒤 확인할 것 (세중님 지시) ═════════════════════════

     ① pg_proc 에 collect_put 이 **하나뿐**인지
     ② 전후 담긴 줄 수가 같은지 (job_posts 전체 건수)
     ③ 수집기마다 한 바퀴 돌려 deadline_src 가 찬 것

   지우는 문장이 한 줄도 없습니다 → 승인 창이 안 뜰 것으로 봅니다. */

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
        apply_to_time, deadline_src, 뽑은값, 뽑은법, 뽑은때)        -- ① deadline_src
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
        nullif(r->>'deadline_src',''),                              -- ② values
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
        /* ③ 마감일 출처 — **apply_to 가 바뀔 때만** 바꿉니다.
              그대로면 출처도 그대로 둡니다. 안 그러면 이번 실행이 읽은 출처가
              예전에 들어온 날짜에 붙어 거짓 기록이 됩니다 (세중님 지시) */
        deadline_src = case
                          when j.admin_locked then j.deadline_src
                          when 'apply_to' = any(coalesce(j.edited_fields,'{}')) then j.deadline_src
                          when (j.source = p_source or j.source = v_짝)
                               and excluded.apply_to is distinct from j.apply_to
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

/* ACL 은 **손대지 않습니다** — 인수가 같아 그대로 유지됩니다
   (지금 postgres · service_role). 확인만 합니다. */


/* ═══ 지난 것 옮기기 — evidence.날짜출처 가 있는 51건만 ═══════

   나머지 1,978건은 **비워 둡니다.** 어디서 왔는지 모르는 것을 적지 않습니다.
   updated_at 을 안 건드립니다 (지침 9절). 아래를 따로 돌립니다. */

-- select set_config('app.누가', '날짜출처 옮기기 2026-10-13', false);
--
-- update public.job_posts j
--    set deadline_src = j.evidence->>'날짜출처'
--  where j.deadline_src is null
--    and j.evidence->>'날짜출처' is not null;
