-- 2026-10-22 — collect_put: **수집기가 고용형태를 되돌리지 못하게** 합니다
--                (세중님 1번 승인 · ⓐ 빈 값으로 안 덮음 · ⓑ 셋만 받음)
--
-- ── 무슨 일이 있었나 (칸기록으로 확인했습니다) ───────────────────────
-- 11:23 에 `고용형태_바로잡기 --전부 --진짜` 로 175건을 바로잡았습니다.
-- 그런데 **다음 수집 바퀴가 되돌렸습니다** —
--   12:01 KST  수집기 HS3   제가 채운 **168건을 다시 비웠습니다** (값 → 빈칸)
--   11:42 KST  수집기 WN2   육아휴직 대체 공고 **둘에 「정규직」을 다시 넣었습니다**
--                            WNK130112610120035 (느티나무안심노인요양시설 · 물리치료사)
--                            WNK131412609230013 (온요양병원 · 물리치료사)
--                            **회원이 보는 값입니다.**
--
-- ── 세중님 확인 요청: 일곱 칸의 나머지도 같은 꼴인가 ─────────────────
-- **아닙니다. 고용형태만 가드가 없었습니다.** 함수 본문을 찍어 하나씩 봤습니다 —
--
--   모집인원  headcount      ○  when excluded.headcount is null then j.headcount
--   접수마감  apply_to       ○  when excluded.apply_to is null then j.apply_to
--   마감시각  apply_to_time  ○  when excluded.apply_to_time is null then j.apply_to_time
--   근무지    work_place     ○  when nullif(excluded.work_place,'') is null then j.work_place
--   지원자격·예상연봉 (detail) ○  병합입니다 — j.detail || excluded.detail,
--                                 `{}` 면 아예 안 건드립니다 (admin_locked 도 지킵니다)
--   뽑은값                   ○  병합, `{}` 면 안 건드립니다
--   **고용형태 employ_type   ✗  가드가 없었습니다** ← 이 파일이 고치는 자리
--   (곁들여 apply_from 도 ○ 입니다)
--
-- 그래서 **이 파일은 employ_type 한 자리만** 고칩니다. 나머지는 손대지 않습니다.
-- 한 가지 남는 결 — detail 은 병합이라 **같은 열쇠로 빈 글자가 오면 그 열쇠는
-- 덮입니다**(「같은 열쇠가 오면 새 값이 이깁니다」로 적혀 있는 꼴입니다).
-- 지금 그렇게 보내는 수집기는 없습니다. 바꾸려면 따로 정해 주십시오.
--
-- ── 무엇을 바꾸나 ────────────────────────────────────────────────────
--   ① `뽑은값->>'고용형태근거'` 가 있으면 = **본문에서 읽어 정한 값**이라
--      수집기가 안 덮습니다 (`edited_fields` 는 「사람이 고친 칸」이라 안 씁니다)
--   ⓐ 수집기는 **빈 값·널로 덮지 못합니다** — `nullif(…,'') is null`
--   ⓑ 창구는 **셋(정규직·계약직·무기계약직) 중 하나만** 받습니다
--
-- ⓑ 를 SQL 로 **옮겨 적지 않았습니다.** 코드·낱말 → 셋 규칙은
-- `공고문읽기.mjs` 의 `고용형태코드()`·`고용형태판정()` **한 자리**이고 수집기가
-- 이미 그것을 지납니다 — 찍어서 확인했습니다 —
--   워크넷   고용형태(r.empTpCd)        = 고용형태코드() 한 줄 감싼 것
--   나라일터  고용형태(x.type01|type02)  = 같음
--   클린아이  (고용형태코드(o.JOB_TYPE)||{}).값
--   알리오   (고용형태코드(de(r.hireTypeNmLst))||{}).값
--   병원(HS3) **빈 글자를 보내고 있었습니다** → 같은 커밋에서 본문으로 정해 보냅니다
--   고용24(JF) `고용형태낱말` 목록을 쉼표로 이어 보냈습니다 → 같은 커밋에서 고용형태코드() 를 지납니다
-- 같은 규칙을 SQL 로 또 쓰면 **기준이 두 벌**이 됩니다 (지침 6절). 그래서 창구에는
-- **울타리만** 둡니다 — 규칙이 아니라 「셋 밖은 안 받는다」입니다.
--
-- 지금 DB 에 셋 밖의 값이 **46건** 있습니다 (공무원 21 · 쉼표로 섞인 것 23 ·
-- 시간선택제 2 · 출처 AL2 20 · GJ2 23 · AL 3). **전부 숨김·보류라 회원 화면에는
-- 0건입니다.** 이 파일은 그 값을 **지우지 않습니다** — 앞으로 새로 들어오는 것만 막습니다.
--
-- ── 바뀌는 범위 ──────────────────────────────────────────────────────
-- 함수 191줄 가운데 **employ_type 한 자리(1줄 → 23줄)**뿐입니다.
-- **앞 84줄과 뒤 106줄은 `pg_get_functiondef()` 가 낸 글과 글자까지 같습니다**
-- (옮겨 적지 않고 찍은 것을 그대로 썼습니다 · 지침 7절).
--
-- 인수가 그대로라 `create or replace` 이고 **권한은 그대로 남습니다** (지침 6-2).
--   올리기 전 ACL — collect_put(text,text,jsonb)
--                   {postgres=X/postgres,service_role=X/postgres}
--   벌 수(overload) — 1 (지울 것이 없습니다)
--
-- ── 짝 ───────────────────────────────────────────────────────────────
-- `tools/고용형태_바로잡기.mjs` 가 채울 때 `뽑은값.고용형태근거` 에 판정 근거를
-- 함께 남깁니다. `칸되메우기` 는 뽑은값을 **합치므로**(`||`) 다른 칸을 안 지웁니다
-- — 함수 본문을 찍어 확인했습니다.
-- 올린 뒤 `고용형태_바로잡기 --전부 --진짜` 로 오늘 지워진 168건 + 되돌려진 2건을
-- 다시 채웁니다.
--
-- ★ 읽고 고치기만 합니다 — 줄을 지우는 낱말이 없습니다 (지침 8-7).
-- ★ 수집기가 쓰는 창구라 **바퀴가 안 도는 시각**에 올립니다 (매시 :46~:49).

CREATE OR REPLACE FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ok int := 0; v_bad int := 0; v_나쁜 jsonb := '[]'::jsonb; r jsonb;
  v_짝 text;
  /* ★ 2026-10-14 — **두 해 뚜껑** (세중님 승인).
     병원·기관이 「채용시까지」 를 2099-12-31 · 2400-03-19 같은 먼 날짜로 적습니다.
     수집기 쪽에도 뚜껑이 있지만(hs_dates 의 너무먼날) 수집기가 일곱이라
     하나만 빼먹으면 되돌아갑니다 — 2026-10-14 에 CE49038(서산의료원)이
     클린아이 바퀴에 2400-03-19 로 되돌아간 것을 찾았습니다 (지침 6절 · 9절).
     그래서 **모든 수집기가 지나는 이 창구**에 마지막 그물을 둡니다. */
  v_뚜껑 date := ((now() at time zone 'Asia/Seoul')::date + 730);
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
        nullif(r->>'apply_from','')::date,
        /* 두 해 넘는 날짜는 안 믿습니다 — 비우고, 아래 deadline_src 에 원문을 적습니다 */
        (case when nullif(r->>'apply_to','')::date > v_뚜껑 then null
              else nullif(r->>'apply_to','')::date end),
        nullif(r->>'posted_at','')::date,
        r->>'url', r->>'job_group', r->>'form', r->>'org_kind', r->>'tab',
        coalesce((r->>'hidden')::boolean, false),
        coalesce((r->>'hold')::boolean, false),
        coalesce((r->>'notify')::boolean, false),
        coalesce(r->'detail', '{}'::jsonb), coalesce(r->'evidence', '{}'::jsonb),
        coalesce(nullif(r->>'collected_at','')::timestamptz, now()), now(),
        nullif(r->>'apply_to_time','')::time,
        (case when nullif(r->>'apply_to','')::date > v_뚜껑
              then '원문 날짜 ' || (r->>'apply_to') || ' → 채용시까지로 봄 (창구)'
              else nullif(r->>'deadline_src','') end),
        /* ★ 뽑은값 은 not null default '{}' 입니다 — null 을 넣으면 막힙니다
           (2026-10-11 에 클린아이 3건이 그렇게 막혔습니다) */
        coalesce(r->'뽑은값', '{}'::jsonb),
        nullif(r->>'뽑은법',''),
        case when r ? '뽑은값' then now() else null end)
      on conflict (id) do update set
        source = case when (j.source = p_source or j.source = v_짝) then excluded.source else j.source end,
        org_name   = case when 'org_name'   = any(coalesce(j.edited_fields,'{}')) then j.org_name
                          when (j.source = p_source or j.source = v_짝) then excluded.org_name   else j.org_name end,
        /* ★ 2026-10-19 — **잘린 제목으로 온전한 제목을 덮지 않습니다.**
           워크넷 목록 API 가 제목을 30자로 자릅니다. 14:20 에 97건을 상세 API 의
           온전한 제목으로 되메웠는데 14:27 수집기 한 바퀴에 95건이 되돌아갔습니다.
           work_place·apply_to 의 「빈 값으로 덮지 않기」와 같은 결입니다 */
        title      = case when 'title'      = any(coalesce(j.edited_fields,'{}')) then j.title
                          when (j.source = p_source or j.source = v_짝) then
                            case when excluded.title ~ '(\.\.\.|…)[[:space:]]*$'
                                  and j.title is not null
                                  and j.title !~ '(\.\.\.|…)[[:space:]]*$'
                                 then j.title              /* 온전한 것을 지킵니다 */
                                 else excluded.title end
                          else j.title end,
        hire_type  = case when 'hire_type'  = any(coalesce(j.edited_fields,'{}')) then j.hire_type
                          when (j.source = p_source or j.source = v_짝) then excluded.hire_type  else j.hire_type end,
        employ_type= case when 'employ_type'= any(coalesce(j.edited_fields,'{}')) then j.employ_type
                          /* ★ 2026-10-22 세중님 1번 — **본문에서 읽어 정한 값은 수집기가
                             안 덮습니다.** 규칙은 「고용형태는 공고 본문(·첨부)에서 읽어
                             정한다」(10-19)인데 이 한 줄에 져 있었습니다 —
                             10-22 12:01 수집기 HS3 가 되메운 168건을 다시 비웠고,
                             11:42 수집기 WN2 가 육아휴직 대체 공고 둘에 「정규직」을
                             다시 넣었습니다 (칸기록). 표시는 `뽑은값.고용형태근거` 입니다.
                             `edited_fields` 는 「**사람이** 고친 칸」이라 안 씁니다 */
                          when (j."뽑은값" ? '고용형태근거') then j.employ_type
                          /* ⓐ 수집기는 **빈 값으로 덮지 못합니다** — 모르는 것이 적힌
                             것을 지우면 안 됩니다. headcount·apply_to·apply_to_time·
                             work_place 에는 이미 같은 가드가 있습니다 */
                          when nullif(excluded.employ_type, '') is null then j.employ_type
                          /* ⓑ 창구는 **셋 중 하나만** 받습니다. 코드·낱말을 셋으로
                             옮기는 규칙은 `공고문읽기.mjs` 의 고용형태코드()·
                             고용형태판정() 한 자리이고 수집기가 이미 지납니다 —
                             여기서 규칙을 또 쓰면 기준이 두 벌이 됩니다 (지침 6절).
                             그래서 **울타리만** 둡니다. 「공무원」·「시간선택제」·
                             쉼표로 섞인 글자는 고용형태가 아니라서 **안 받습니다**
                             (지금 값은 그대로 둡니다 — 여기서 지우지 않습니다) */
                          when excluded.employ_type not in ('정규직', '계약직', '무기계약직')
                            then j.employ_type
                          when (j.source = p_source or j.source = v_짝) then excluded.employ_type
                          else j.employ_type end,
        /* ★ 2026-10-18 — headcount 와 같은 자리입니다. 되메우기·공고문읽기가 채운
           근무지를 수집기가 못 뽑으면 지워집니다. 이번에는 수집기가 값을 보내서
           살았을 뿐입니다 (운이 좋았던 것이고 구조는 뚫려 있었습니다) */
        work_place = case when 'work_place' = any(coalesce(j.edited_fields,'{}')) then j.work_place
                          when nullif(excluded.work_place, '') is null then j.work_place
                          when (j.source = p_source or j.source = v_짝) then excluded.work_place else j.work_place end,
        sido       = case when 'sido'       = any(coalesce(j.edited_fields,'{}')) then j.sido
                          when (j.source = p_source or j.source = v_짝) then excluded.sido       else j.sido end,
        sgg        = case when 'sgg'        = any(coalesce(j.edited_fields,'{}')) then j.sgg
                          when (j.source = p_source or j.source = v_짝) then excluded.sgg        else j.sgg end,
        edu        = case when 'edu'        = any(coalesce(j.edited_fields,'{}')) then j.edu
                          when (j.source = p_source or j.source = v_짝) then excluded.edu        else j.edu end,
        /* ★ 2026-10-18 — **빈 값으로 덮지 않습니다** (세중님 「뿌리부터」).
           2026-10-18 17:04 바퀴에서 되메우기가 채운 모집인원 4건이 통째로 지워졌습니다
           (광주보훈·충주의료원·성남시의료원·경북대병원). HS3 수집기는 모집인원을
           못 뽑아 null 을 보내는데, 여기에 null 가드가 없어 그대로 덮었습니다.
           바로 아래 apply_to_time 에는 그 가드가 **있어서** 마감시각은 살아남았습니다 —
           같은 자리인데 한쪽만 막혀 있었습니다 (지침 6절) */
        headcount  = case when 'headcount'  = any(coalesce(j.edited_fields,'{}')) then j.headcount
                          when excluded.headcount is null then j.headcount
                          when (j.source = p_source or j.source = v_짝) then excluded.headcount  else j.headcount end,
        /* ★ 2026-10-19 — headcount·work_place·apply_to_time 과 **같은 자리**입니다.
           수집기가 접수시작일을 못 뽑으면 null 을 보내는데 가드가 없어 지워졌습니다.
           새 값이 **있으면** 그대로 덮으니 기간 변경은 따라갑니다 */
        apply_from = case when 'apply_from' = any(coalesce(j.edited_fields,'{}')) then j.apply_from
                          when excluded.apply_from is null then j.apply_from
                          when (j.source = p_source or j.source = v_짝) then excluded.apply_from else j.apply_from end,
        /* ★★ 2026-10-19 세중님 ② 승인 — **빈 값으로 덮지 않습니다.**
           2026-10-18 에 headcount 를 고치면서 **이 칸을 일부러 뺐습니다. 그것이
           틀렸습니다.** 칸기록을 켠 첫 바퀴(10-19 08:00)에 5건이 지워졌고 그중
           경기도의료원 수원병원 공고는 마감 2026-10-22(사흘 뒤)가 지워진 채
           **회원 화면에 마감일 없이 보였습니다.** 원문에는 「○ 모집기간 :
           2026. 10. 12.(월) ~ 2026. 10. 22.(목) 12:00」 이 그대로 있었습니다 —
           「기관이 지운 것」이 아니라 **수집기가 못 읽은 것**이었습니다.
           바로 아래 apply_to_time 에는 가드가 있어 마감시각 12:00 은 살아남았고,
           그래서 **마감시각은 있는데 마감일이 없는** 꼴이 됐습니다.
           새 값이 **있으면** 그대로 덮으니 마감일 연장·단축은 따라갑니다 */
        apply_to   = case when 'apply_to'   = any(coalesce(j.edited_fields,'{}')) then j.apply_to
                          when excluded.apply_to is null then j.apply_to
                          when (j.source = p_source or j.source = v_짝) then excluded.apply_to   else j.apply_to end,
        /* ★ 2026-10-13 고침 — 비어 있으면 같은 날짜라도 채우고,
              차 있으면 마감일이 바뀔 때만 바꿉니다 (세중님 지시) */
        deadline_src = case
                          when j.admin_locked then j.deadline_src
                          when 'apply_to' = any(coalesce(j.edited_fields,'{}')) then j.deadline_src
                          when not (j.source = p_source or j.source = v_짝) then j.deadline_src
                          when nullif(r->>'apply_to','')::date > v_뚜껑
                            then '원문 날짜 ' || (r->>'apply_to') || ' → 채용시까지로 봄 (창구)'
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
        /* ★ 2026-10-18 — **통째 교체에서 병합으로** 바꿉니다.
           되메우기가 detail.지원자격 · detail.연봉 을 채우는데, 수집기 detail 로
           통째 덮으면 그 칸이 **사라집니다.** 바로 아래 「뽑은값」 은 이미 병합이고
           admin_locked 도 지킵니다 — 그 꼴을 그대로 가져옵니다 (지침 6절).
           같은 열쇠가 오면 새 값이 이깁니다. 없는 열쇠만 지킵니다 */
        detail     = case when j.admin_locked then j.detail
                          when excluded.detail is null or excluded.detail = '{}'::jsonb then j.detail
                          when (j.source = p_source or j.source = v_짝)
                               then coalesce(j.detail, '{}'::jsonb) || excluded.detail
                          else j.detail end,
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
$function$

;

-- 올린 뒤 권한 확인 (지침 6-2a)
select p.oid::regprocedure::text, p.proacl::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'collect_put';
