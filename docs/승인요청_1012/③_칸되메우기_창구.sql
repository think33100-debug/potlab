/* ③ 칸되메우기 창구 (2026-10-12)
   ★ 아직 안 올렸습니다. 세중님 승인 뒤에 올립니다.
   지우는 문장이 한 줄도 없습니다 (표·함수를 없애는 낱말이 안 쓰였습니다) →
   승인 창이 안 뜰 것으로 봅니다. ⚠ 그 낱말은 **주석에 적어도** 창을 띄웁니다
   (지침 8-7) — 그래서 여기서도 일부러 안 적습니다.

   ═══ 무엇을 하나 ═══════════════════════════════════════════

   첨부(kordoc)에서 읽은 칸을 **이미 담긴 공고**에 되메웁니다.
   표를 직접 쓰지 않습니다 — `tools/첨부되메우기.mjs` 가 이 창구만 씁니다.

   ═══ 세중님이 고치라 하신 것 ═════════════════════════════════

   처음 안은 「apply_to 를 **안 건드립니다**」 였습니다. 그것을
   **「apply_to 가 null 일 때만 채우고, 값이 있으면 절대 안 바꿈」** 으로 바꿨습니다.

     「병원 마감 빈칸을 첨부로 채우는 것이 이번 작업의 목표입니다.
       10-08 문제는 덮어쓰기였습니다」

   맞습니다. 2026-10-08 서귀포의료원 일은 **클린아이가 준 날짜(2026-12-31)로
   공고문 날짜를 덮은 것**이 문제였습니다. 빈칸을 채우는 것은 그 반대입니다.
   그래서 `where … and j.apply_to is null` 을 걸고, 값이 있으면 손대지 않습니다.

   채울 때 **출처를 남깁니다** —
     deadline_src   '첨부(kordoc) · 2026-10-12'  처럼 (어디서 왔나)
     뽑은값.근거    { 마감일출처: '첨부' | '본문' | '목록', 읽은날: … }
   도구가 `뽑은값` 에 이미 근거를 담아 보내므로, 창구는 **합치기만** 합니다.

   ═══ 지켜야 하는 것 다섯 ═════════════════════════════════════

     ① **updated_at 을 안 적습니다.** set 목록에 아예 없습니다 (지침 9절 —
        고친 때를 바꾸면 그걸 보고 도는 것이 무엇인지 먼저 세어 봐야 합니다)
     ② `admin_locked` 인 줄은 통째로 건너뜁니다
     ③ `edited_fields` 에 그 칸이 적힌 줄은 **그 칸만** 안 건드립니다
     ④ **비어 있는 칸만** 찹니다. 값이 있으면 덮지 않습니다
     ⑤ `뽑은값` 은 `||` 로 **합칩니다** — 전에 담은 근거를 지우지 않습니다

   ═══ 받는 줄 ═══════════════════════════════════════════════

   `tools/첨부되메우기.mjs:244` 가 보내는 꼴 그대로입니다.

     { id,
       apply_to?        ← **새로 받습니다** (null 일 때만 찹니다)
       apply_to_time?,
       headcount?,
       work_place?,
       detail,          ← 통째 jsonb (도구가 기존 값과 합쳐 보냅니다)
       뽑은값,          ← 통째 jsonb (근거 포함)
       마감일출처?      ← '첨부' | '본문' | '목록'  (deadline_src 에 적습니다)
     }

   ═══ 열쇠 ═══════════════════════════════════════════════════

   도구가 service_role 로 부릅니다. `p_secret` 을 안 받으므로
   **service_role 에만** 줍니다 (지침 6-2·6-3 — 새 함수는 PUBLIC 이 붙습니다).

   ═══ 마른 실행에서 보여 드릴 것 (세중님 지시) ════════════════

     · apply_to 가 **새로 찰** 공고 수
     · 견본 5건 — 첨부 원문의 그 줄 ↔ 담을 값
     · 전후 채움률 (일곱 칸)
   그 뒤에 승인받고 `--진짜` 로 돌립니다.

   ═══ 같이 고칠 목록 (①에서 찾은 것) ═════════════════════════

   「접수 자리에 채용시까지」 인데 apply_to 에 값이 든 5건입니다. 이것은
   **덮어쓰기가 아니라 틀린 값 비우기**라 창구가 아니라 손으로 봅니다 —

     길병원        HS222980646   2099-12-31  메움값
     한도병원      HS2092702052  2023-12-31  옛 메움값
     성남시의료원  HS1021359919  2026-12-31  메움값
     더블유병원    HS516878311   2026-02-13  **시작일을 마감일로**
     이화 서울병원 HS76764334    2026-10-12  **시작일 쪽**

   다섯 다 `deadline_src` 가 null 입니다. 칸되메우기 차례에 함께 보고드립니다.
   ═══════════════════════════════════════════════════════════ */

create or replace function public."칸되메우기"(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_담음 int := 0; v_건너뜀 int := 0; v_없음 int := 0; v_마감일찬것 int := 0;
  v_잠긴칸 text[];
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

    /* ── 마감일 — **null 일 때만** 찹니다. 값이 있으면 절대 안 바꿉니다 ── */
    if (r ? 'apply_to') and not ('apply_to' = any(v_잠긴칸)) then
      update job_posts j set
        apply_to = (r->>'apply_to')::date,
        deadline_src = coalesce(r->>'마감일출처', '첨부') || '(kordoc) · '
                       || (now() at time zone 'Asia/Seoul')::date
      where j.id = r->>'id'
        and j.apply_to is null                       -- ★ 빈칸만
        and (r->>'apply_to') is not null;
      if found then v_마감일찬것 := v_마감일찬것 + 1; end if;
    end if;

    /* ── 그밖의 칸 — 비어 있을 때만 ── */
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
      /* detail — 보낸 통째를 **밑에 깔고** 지금 값을 위에 덮습니다.
         그래서 이미 있는 칸은 안 바뀌고 빈 칸만 찹니다 */
      detail = case
        when (r ? 'detail') and not ('detail' = any(v_잠긴칸))
        then coalesce(r->'detail', '{}'::jsonb) || coalesce(j.detail, '{}'::jsonb)
        else j.detail end,
      /* 뽑은값 — 근거는 합칩니다. 전에 담은 것을 지우지 않습니다 */
      뽑은값 = coalesce(j.뽑은값, '{}'::jsonb) || coalesce(r->'뽑은값', '{}'::jsonb),
      뽑은법 = coalesce(j.뽑은법, 'kordoc'),
      뽑은때 = coalesce(j.뽑은때, now())
      /* ★ updated_at 은 **여기 없습니다** — 일부러입니다 */
    where j.id = r->>'id';
    if found then v_담음 := v_담음 + 1; end if;
  end loop;

  return jsonb_build_object(
    '담음', v_담음,
    '마감일을 새로 찬 것', v_마감일찬것,
    '잠겨서 건너뜀', v_건너뜀,
    '그 공고가 없음', v_없음,
    'updated_at', '안 바꿨습니다',
    'apply_to', 'null 일 때만 찼습니다 — 값이 있으면 안 건드렸습니다');
end $$;

revoke execute on function public."칸되메우기"(jsonb) from public, anon, authenticated;
grant  execute on function public."칸되메우기"(jsonb) to service_role;

/* 올린 뒤 확인할 것

   권한이 service_role 만인지
     select coalesce(array_to_string(proacl,' | '),'(기본값 — PUBLIC)')
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='칸되메우기';

   그다음 마른 실행 — node tools/첨부되메우기.mjs
     (--진짜 없이 돌리면 아무것도 안 바꿉니다) */
