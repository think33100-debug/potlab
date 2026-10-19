-- `칸되메우기` 에 **마감일 뚜껑** (2026-10-19 세중님 ㉡ 승인)
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 알리오가 「상시모집」 공고에 `pbancEndYmd 20501231` 을 줍니다 —
--   201471 「공공어린이재활병원 건립사업 보조금계약직 모집공고(상시모집)」
--   → 접수마감 **2050-12-31**
-- `collect_put` 에는 뚜껑이 있는데 `칸되메우기` 에는 없어서 **도구 쪽에서**
-- 막고 있었습니다. 기준이 두 자리면 다음 도구가 또 밟습니다 (지침 6절) —
-- **창구 한 자리**로 옮깁니다.
--
-- 뚜껑 값은 `collect_put` 과 **같은 기준**입니다 — 그 함수가 쓰는
-- `오늘 + 400일` 입니다 (세중님 ㉡ — 「collect_put 과 같은 기준 한 자리」).
--
-- ★ 본문에서 **apply_to 블록 한 군데만** 바꿉니다. 인수가 그대로라 같은
--   함수이고 ACL 은 안 바뀝니다 (지침 6-2).

do $한군데$
declare
  v_전 text;
  v_후 text;
  v_옛 text := $옛$    if (r ? 'apply_to') and not ('apply_to' = any(v_잠긴칸)) then
      update job_posts j set
        apply_to = (r->>'apply_to')::date,$옛$;
  v_새 text := $새$    /* ★ 2026-10-19 — **뚜껑을 넘는 날짜는 안 넣습니다.**
       알리오가 「상시모집」 공고에 pbancEndYmd 20501231 을 줍니다.
       `collect_put` 과 같은 기준(오늘 + 400일)입니다 — 기준을 한 자리에 둡니다 */
    if (r ? 'apply_to') and not ('apply_to' = any(v_잠긴칸))
       and (nullif(r->>'apply_to', '')::date
            <= ((now() at time zone 'Asia/Seoul')::date + 400)) then
      update job_posts j set
        apply_to = (r->>'apply_to')::date,$새$;
begin
  select pg_get_functiondef(p.oid) into v_전
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '칸되메우기';
  if v_전 is null then raise exception '칸되메우기 가 없습니다'; end if;
  if position(v_옛 in v_전) = 0 then
    raise exception '바꿀 apply_to 블록을 못 찾았습니다 — 본문이 제가 본 것과 다릅니다. 멈춥니다';
  end if;
  if (length(v_전) - length(replace(v_전, v_옛, ''))) / length(v_옛) <> 1 then
    raise exception 'apply_to 블록이 하나가 아닙니다 — 멈춥니다';
  end if;
  v_후 := replace(v_전, v_옛, v_새);
  execute v_후;
  raise notice '칸되메우기 의 apply_to 블록 한 군데를 바꿨습니다 (글자 % → %)',
    length(v_전), length(v_후);
end
$한군데$;

revoke execute on function "칸되메우기"(jsonb) from public, anon, authenticated;
grant  execute on function "칸되메우기"(jsonb) to service_role;

-- ── 스스로 하는 검사 ────────────────────────────────────────────
do $chk$
declare v text;
begin
  select pg_get_functiondef(p.oid) into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '칸되메우기';
  if position('뚜껑을 넘는 날짜는 안 넣습니다' in v) = 0 then
    raise exception '자기점검 ① 뚜껑이 본문에 없습니다';
  end if;
  if position('+ 400' in v) = 0 then
    raise exception '자기점검 ② 400일 기준이 안 보입니다';
  end if;
  /* 2050-12-31 은 뚜껑을 넘고, 올해 날짜는 안 넘습니다 */
  if not ('2050-12-31'::date > ((now() at time zone 'Asia/Seoul')::date + 400)) then
    raise exception '자기점검 ③ 2050-12-31 이 뚜껑 안입니다';
  end if;
  if ((now() at time zone 'Asia/Seoul')::date + 30) > ((now() at time zone 'Asia/Seoul')::date + 400) then
    raise exception '자기점검 ④ 한 달 뒤가 뚜껑을 넘습니다';
  end if;
  raise notice '칸되메우기 마감일뚜껑 자기점검 4가지 통과';
end
$chk$;
