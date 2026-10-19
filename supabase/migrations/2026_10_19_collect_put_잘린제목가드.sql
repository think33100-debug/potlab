-- `collect_put` — **잘린 제목으로 온전한 제목을 덮지 않습니다** (2026-10-19)
--
-- ── 무슨 일이 있었나 ────────────────────────────────────────────
-- 14:20 에 잘린 제목 97건을 상세 API 의 온전한 제목으로 되메웠습니다 (0건 확인).
-- 14:27 에 워크넷 수집기를 한 바퀴 돌리니 **0 → 95 로 되돌아갔습니다.**
--
-- 까닭 — 목록 API 는 제목을 30자로 자릅니다. 수집기는 상세 제목이 손에 있을
-- 때만 온전한 제목을 보내는데, 상세 기억(`log/워크넷_상세받음.json`)에 제목이
-- 없던 줄들은 **잘린 목록 제목**을 보냈고, `collect_put` 이 그것을 그대로
-- 덮었습니다.
--
-- ── 왜 창구에서 막나 ────────────────────────────────────────────
-- 수집기 쪽만 고치면 **다음 수집기가 같은 자리를 또 밟습니다.** 이미 같은 결의
-- 가드가 이 창구에 둘 있습니다 — `work_place`(빈 값으로 덮지 않기 · 10-18) ·
-- `apply_to`(빈 값으로 덮지 않기 · 10-19). 이것은 그 셋째입니다:
-- **「…」 로 끝나는 제목은 온전한 제목을 못 덮습니다.**
--
--   excluded.title 「물리치료사 모집(운전...」   ← 목록 API 가 자른 것
--   j.title        「물리치료사 모집(운전 가능자)」 ← 우리가 상세로 채운 것
--   → j.title 을 지킵니다
--
-- 새 공고(INSERT)는 그대로입니다 — 잘린 제목이라도 넣습니다(없는 것보다 낫고,
-- 정찰이 하루 한 번 온전한 것으로 바꿉니다).
-- `edited_fields` 에 title 이 있으면 전과 같이 사람 것을 지킵니다.
--
-- ★ 본문에서 **title 한 줄만** 바꿉니다. 인수가 그대로라 같은 함수이고
--   ACL 은 안 바뀝니다 (전 `{postgres=X/postgres,service_role=X/postgres}`).

do $두줄만$
declare
  v_전 text;
  v_후 text;
  v_옛 text := $옛$        title      = case when 'title'      = any(coalesce(j.edited_fields,'{}')) then j.title
                          when (j.source = p_source or j.source = v_짝) then excluded.title      else j.title end,$옛$;
  v_새 text := $새$        /* ★ 2026-10-19 — **잘린 제목으로 온전한 제목을 덮지 않습니다.**
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
                          else j.title end,$새$;
begin
  select pg_get_functiondef(p.oid) into v_전
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'collect_put';

  if v_전 is null then raise exception 'collect_put 이 없습니다'; end if;
  if position(v_옛 in v_전) = 0 then
    raise exception '바꿀 title 줄을 못 찾았습니다 — 본문이 제가 본 것과 다릅니다. 멈춥니다';
  end if;
  /* 그 글귀가 **딱 한 번**이어야 합니다 (지침 7절 — 통째로 갈아끼우지 않기) */
  if (length(v_전) - length(replace(v_전, v_옛, ''))) / length(v_옛) <> 1 then
    raise exception 'title 줄이 하나가 아닙니다 — 멈춥니다';
  end if;

  v_후 := replace(v_전, v_옛, v_새);
  execute v_후;
  raise notice 'collect_put 의 title 한 줄을 바꿨습니다 (글자 % → %)', length(v_전), length(v_후);
end
$두줄만$;

revoke execute on function collect_put(text, text, jsonb) from public, anon, authenticated;
grant  execute on function collect_put(text, text, jsonb) to service_role;

-- ── 스스로 하는 검사 ────────────────────────────────────────────
-- 표를 건드리지 않고, **본문에 그 가드가 들어갔는지**와 **정규식이 뜻대로 도는지**를 봅니다
do $chk$
declare v text;
begin
  select pg_get_functiondef(p.oid) into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'collect_put';
  if position('온전한 것을 지킵니다' in v) = 0 then
    raise exception '자기점검 ① 가드가 본문에 없습니다';
  end if;

  /* 정규식 — 「...」·「…」 로 끝나는 것만 잘린 것으로 봅니다 */
  if not ('물리치료사 모집(운전...' ~ '(\.\.\.|…)[[:space:]]*$') then
    raise exception '자기점검 ② 「...」 를 못 봅니다';
  end if;
  if not ('물리치료사 모집(운전… ' ~ '(\.\.\.|…)[[:space:]]*$') then
    raise exception '자기점검 ③ 「…」 와 뒤 공백을 못 봅니다';
  end if;
  /* ★ 가운데 점이 있는 멀쩡한 제목을 잘린 것으로 보면 안 됩니다 */
  if '2026년 제2회... 재공고' ~ '(\.\.\.|…)[[:space:]]*$' then
    raise exception '자기점검 ④ 가운데 「...」 를 끝으로 봅니다';
  end if;
  if '물리치료사 채용 재공고' ~ '(\.\.\.|…)[[:space:]]*$' then
    raise exception '자기점검 ⑤ 멀쩡한 제목을 잘린 것으로 봅니다';
  end if;

  raise notice 'collect_put 잘린제목가드 자기점검 5가지 통과';
end
$chk$;
