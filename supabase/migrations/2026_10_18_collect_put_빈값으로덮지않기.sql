/* collect_put — **빈 값으로 덮어쓰지 않습니다** (2026-10-18 세중님 「뿌리부터」)
 *
 * ── 왜 ───────────────────────────────────────────────
 * 2026-10-18 에 1층 모집인원 채움률이 45.5% → 40.6% 로 **내려갔습니다.**
 * 분모가 33→32 로 줄은 것만으로는 설명이 안 되어 분자를 좇았습니다.
 *
 * 14:2x 에 떠 둔 스냅샷과 견주니 **되메우기가 채운 모집인원 4건이 지워져** 있었습니다 —
 *   HS190712781 광주보훈병원 1 → (빔)
 *   HS258328719 충주의료원   1 → (빔)
 *   HS726356583 성남시의료원 1 → (빔)
 *   HS882336163 경북대학교병원 1 → (빔)
 * 네 건의 `updated_at` 이 **전부 똑같이 2026-10-18 08:04:44 UTC**(17:04 KST)였습니다 —
 * **한 번의 수집기 바퀴**에서 덮인 것입니다.
 *
 * 뿌리 — `on conflict` 의 24칸 중 **「빈 값이면 기존 값 유지」가 2칸에만** 있었습니다.
 *   apply_to_time   `when excluded.apply_to_time is null then j.apply_to_time`  ← 있음
 *   deadline_src    있음
 *   headcount       **없음** → HS3 는 모집인원을 못 뽑아 null 을 보냄 → **지워짐**
 *   work_place      **없음** → 이번엔 수집기가 값을 보내서 살았을 뿐입니다
 *   detail          **없음** + **통째 교체** → 되메우기가 넣은 칸이 사라질 자리
 *   뽑은값           **병합** + admin_locked 보호 ← 이것만 제대로 되어 있었습니다
 * 그래서 **마감시각만 올랐고(27.3→31.3%) 모집인원은 내려갔습니다.** 딱 들어맞습니다.
 *
 * ── 무엇이 바뀌나 (세 자리) ───────────────────────────
 *   headcount    `excluded.headcount is null` 이면 기존 값 유지
 *   work_place   `nullif(excluded.work_place,'')` 가 null 이면 기존 값 유지
 *                (빈 글자도 빈 값으로 봅니다 — 수집기가 '' 를 보내는 자리가 있습니다)
 *   detail       **통째 교체 → 병합.** 「뽑은값」과 같은 꼴 + admin_locked 보호
 *                같은 열쇠는 새 값이 이기고, **없는 열쇠만** 지킵니다
 *
 * ── 안 바꾼 것 (일부러) ──────────────────────────────
 * `apply_to` · `title` · `org_name` · `job_group` 등 **수집기의 본값**에는 손대지
 * 않았습니다. 거기서 null 은 「기관이 지웠다」는 뜻일 수 있고, 가드를 걸면
 * 낡은 값이 영영 남습니다. **이번에 증거로 확인된 세 자리만** 고칩니다.
 * `evidence` 도 그대로 뒀습니다 — 우리가 쓴 글이라 수집기 것이 맞습니다.
 *
 * ── 권한 ───────────────────────────────────────────
 * `create or replace` 이고 인수(text,text,jsonb)가 같아 ACL 이 보존됩니다 (지침 6-2a).
 * 끝에 revoke/grant 를 전과 똑같이 다시 적습니다.
 * `delete` · `drop` 글자가 없습니다 (지침 8-7).
 *
 * ── 올린 뒤 할 일 ────────────────────────────────────
 * 지워진 4건을 되메우기로 **다시 채우고**, 다음 수집기 바퀴 뒤에 **살아 있는지** 봅니다.
 * (그것이 이 고침이 들었는지 보는 유일한 시험입니다 — 지침 12절)
 */

CREATE OR REPLACE FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
        title      = case when 'title'      = any(coalesce(j.edited_fields,'{}')) then j.title
                          when (j.source = p_source or j.source = v_짝) then excluded.title      else j.title end,
        hire_type  = case when 'hire_type'  = any(coalesce(j.edited_fields,'{}')) then j.hire_type
                          when (j.source = p_source or j.source = v_짝) then excluded.hire_type  else j.hire_type end,
        employ_type= case when 'employ_type'= any(coalesce(j.edited_fields,'{}')) then j.employ_type
                          when (j.source = p_source or j.source = v_짝) then excluded.employ_type else j.employ_type end,
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
$$;

/* 인수가 그대로라 ACL 이 유지되지만, 지침 6-2·6-3 대로 한 번 더 겁니다 */
revoke execute on function public.collect_put(text, text, jsonb) from public, anon, authenticated;
grant  execute on function public.collect_put(text, text, jsonb) to service_role;
