-- `출처다른중복` 이 **보정한 기관 이름**을 쓰게 합니다 (2026-10-19 세중님 ㉠)
--
-- `기관이름보정(source, org_name, title)` 이 「여러 병원을 거느린 공단·법인의
-- AL·AL2 공고는 제목의 「[OO병원]」을 기관으로」 를 한 자리에서 정합니다.
-- 중복 판정이 그 이름을 쓰면 광주보훈 짝이 묶입니다 —
--   306122[AL2]      한국보훈복지의료공단 → **광주보훈병원**
--   HS190712781[HS3] 광주보훈병원            (그대로)
--
-- ★ 본문에서 **기관열쇠 한 줄만** 바꿉니다. 인수가 그대로라 같은 함수이고
--   ACL 은 안 바뀝니다 (지침 6-2).

do $한줄$
declare
  v_전 text;
  v_후 text;
  v_옛 text := $옛$             견줄이름(p.org_name) as 기관열쇠, 제목열쇠(p.title) as 제목키,$옛$;
  v_새 text := $새$             /* ★ 2026-10-19 — **보정한 기관 이름**으로 봅니다.
                여러 병원을 거느린 공단·법인의 AL·AL2 공고는 제목의
                「[OO병원]」이 진짜 기관입니다 (기관이름보정 한 자리) */
             견줄이름(기관이름보정(p.source, p.org_name, p.title)) as 기관열쇠,
             제목열쇠(p.title) as 제목키,$새$;
begin
  select pg_get_functiondef(p.oid) into v_전
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '출처다른중복';
  if v_전 is null then raise exception '출처다른중복 이 없습니다'; end if;
  if position(v_옛 in v_전) = 0 then
    raise exception '바꿀 기관열쇠 줄을 못 찾았습니다 — 멈춥니다';
  end if;
  if (length(v_전) - length(replace(v_전, v_옛, ''))) / length(v_옛) <> 1 then
    raise exception '기관열쇠 줄이 하나가 아닙니다 — 멈춥니다';
  end if;
  v_후 := replace(v_전, v_옛, v_새);
  execute v_후;
  raise notice '출처다른중복 의 기관열쇠 한 줄을 바꿨습니다 (글자 % → %)',
    length(v_전), length(v_후);
end
$한줄$;

revoke execute on function 출처다른중복(boolean) from public, anon, authenticated;
grant  execute on function 출처다른중복(boolean) to service_role;

do $chk$
declare v text;
begin
  select pg_get_functiondef(p.oid) into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '출처다른중복';
  if position('기관이름보정' in v) = 0 then
    raise exception '자기점검 ① 보정 함수를 안 씁니다';
  end if;
  if position('제목열쇠' in v) = 0 then
    raise exception '자기점검 ② 제목열쇠가 사라졌습니다';
  end if;
  raise notice '출처다른중복 보정이름 자기점검 2가지 통과';
end
$chk$;
