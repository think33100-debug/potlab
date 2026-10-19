-- `칸되메우기` 에 **title 칸**을 붙입니다 (2026-10-19 세중님 3번)
--
-- `pg_get_functiondef` 로 찍은 지금 본문을 그대로 두고 **두 군데만** 더했습니다 —
--   ① 제목 블록 (고용형태 블록 바로 뒤)
--   ② 돌려주는 글에 'title' (도구가 「창구가 이 칸을 받는다」를 확인할 수 있게)
-- 인수가 그대로(`jsonb`)라 **같은 함수**이고 ACL 은 안 바뀝니다 (지침 6-2).
--
-- 제목은 함부로 안 덮습니다 — `제목바꿀만한가()` 가 ㉠ 지금 것이 잘렸는가
-- ㉡ 새 것이 그 토막으로 시작하는가 를 봅니다 (자기점검 10가지는 짝 파일에).

CREATE OR REPLACE FUNCTION public."칸되메우기"(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb;
  v_담음 int := 0; v_건너뜀 int := 0; v_없음 int := 0; v_마감일찬것 int := 0;
  v_잠긴칸 text[];
  v_고용형태 int := 0;   /* 2026-10-19 — 고용형태를 바로잡은 수 */
  v_제목 int := 0;       /* 2026-10-19 — 잘린 제목을 온전하게 한 수 */
begin
  perform set_config('app.누가', '첨부 되메우기', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    if not exists (select 1 from job_posts j where j.id = r->>'id') then
      v_없음 := v_없음 + 1; continue;
    end if;
    if exists (select 1 from job_posts j
                where j.id = r->>'id' and coalesce(j.admin_locked, false)) then
      v_건너뜀 := v_건너뜀 + 1; continue;
    end if;

    select coalesce(j.edited_fields, '{}') into v_잠긴칸
      from job_posts j where j.id = r->>'id';

    if (r ? 'apply_to') and not ('apply_to' = any(v_잠긴칸)) then
      update job_posts j set
        apply_to = (r->>'apply_to')::date,
        deadline_src = coalesce(r->>'마감일출처', '첨부') || '(kordoc) · '
                       || (now() at time zone 'Asia/Seoul')::date
      where j.id = r->>'id'
        and j.apply_to is null
        and (r->>'apply_to') is not null;
      if found then v_마감일찬것 := v_마감일찬것 + 1; end if;
    end if;

    /* ★ 2026-10-19 세중님 지시 — **고용형태는 덮습니다.**
       다른 칸은 「비어 있을 때만」 채우는데, 고용형태는 **틀린 값을
       바로잡는 것**입니다 — 「공무원」·「기간제」·「비정규직」을 「계약직」 등으로
       바꿔야 하므로 비어 있을 때만으로는 안 됩니다.
       지키는 것은 edited_fields(사람이 고친 칸)와 admin_locked 뿐이고
       updated_at 은 안 바꿉니다 (이 창구의 뜻 그대로).
       값이 **빈 글자면 안 건드립니다** — 짐작으로 지우지 않습니다 */
    if (r ? 'employ_type') and not ('employ_type' = any(v_잠긴칸))
       and nullif(r->>'employ_type', '') is not null then
      update job_posts j set employ_type = r->>'employ_type'
       where j.id = r->>'id'
         and not coalesce(j.admin_locked, false)
         and j.employ_type is distinct from (r->>'employ_type');
      if found then v_고용형태 := v_고용형태 + 1; end if;
    end if;

    /* ★ 2026-10-19 세중님 3번 — **잘린 제목**을 온전한 제목으로.
       워크넷 목록 API 가 30자로 자른 것이 회원 화면 「기관 원문 제목」에
       「…」 로 보입니다. 상세 API 의 wantedTitle 이 온전합니다.
       제목은 공고의 얼굴이라 **잘린 것만** 바꿉니다 — `제목바꿀만한가()` 가
       ㉠ 지금 것이 잘렸는가 ㉡ 새 것이 그 토막으로 시작하는가 를 봅니다.
       ㉡ 가 authNo 를 잘못 짚었을 때의 그물입니다.
       제목이 바뀌면 `제목채우기_고칠때` 트리거가 보여줄제목을 다시 만듭니다 */
    if (r ? 'title') and not ('title' = any(v_잠긴칸)) then
      update job_posts j set title = r->>'title'
       where j.id = r->>'id'
         and not coalesce(j.admin_locked, false)
         and j.title is distinct from (r->>'title')   /* 같은 글자면 트리거를 깨우지 않습니다 */
         and 제목바꿀만한가(j.title, r->>'title');
      if found then v_제목 := v_제목 + 1; end if;
    end if;

    update job_posts j set
      headcount = case
        when (r ? 'headcount') and j.headcount is null
             and not ('headcount' = any(v_잠긴칸))
        then (r->>'headcount')::int else j.headcount end,
      apply_to_time = case
        when (r ? 'apply_to_time') and j.apply_to_time is null
             and not ('apply_to_time' = any(v_잠긴칸))
        then (r->>'apply_to_time')::time else j.apply_to_time end,
      work_place = case
        when (r ? 'work_place') and coalesce(j.work_place, '') = ''
             and not ('work_place' = any(v_잠긴칸))
        then r->>'work_place' else j.work_place end,
      detail = case
        when (r ? 'detail') and not ('detail' = any(v_잠긴칸))
        then coalesce(r->'detail', '{}'::jsonb) || coalesce(j.detail, '{}'::jsonb)
        else j.detail end,
      "뽑은값" = coalesce(j."뽑은값", '{}'::jsonb) || coalesce(r->'뽑은값', '{}'::jsonb),
      "뽑은법" = coalesce(j."뽑은법", 'kordoc'),
      "뽑은때" = coalesce(j."뽑은때", now())
    where j.id = r->>'id';
    if found then v_담음 := v_담음 + 1; end if;
  end loop;

  return jsonb_build_object(
    '담음', v_담음,
    '마감일을 새로 찬 것', v_마감일찬것,
    '잠겨서 건너뜀', v_건너뜀,
    '그 공고가 없음', v_없음,
    'updated_at', '안 바꿨습니다',
    'apply_to', 'null 일 때만 찼습니다 — 값이 있으면 안 건드렸습니다',
    'employ_type', v_고용형태 || '건 바로잡았습니다 (덮습니다 · edited_fields·admin_locked 는 건너뜀)',
    'title', v_제목 || '건 — **잘린 제목만** 바꿨습니다 (제목바꿀만한가: 잘렸고 · 같은 토막으로 시작하고 · 더 긴 것)');
end $function$;

revoke execute on function "칸되메우기"(jsonb) from public, anon, authenticated;
grant  execute on function "칸되메우기"(jsonb) to service_role;
