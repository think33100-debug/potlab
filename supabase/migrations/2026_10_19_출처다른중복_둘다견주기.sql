-- 중복은 **앞 이름·전체 이름 둘 다**로 견줍니다 (2026-10-19 세중님 ㉤)
--
-- 「[인천병원(서울의원)]」 처럼 괄호가 든 이름은 화면에 **전체**를 쓰지만,
-- 다른 출처는 「인천병원」으로만 적을 수 있습니다. 그래서 짝을 찾을 때는
-- **둘 다** 봅니다 — 하나라도 맞으면 같은 기관으로 봅니다.
--
-- ★ 본문에서 **기관열쇠 줄과 그것을 견주는 줄**만 바꿉니다. 인수가 그대로라
--   같은 함수이고 ACL 은 안 바뀝니다.

do $둘다$
declare
  v_전 text; v_센것 int;
  v_옛1 text := $옛1$             견줄이름(기관이름보정(p.source, p.org_name, p.title)) as 기관열쇠,$옛1$;
  v_새1 text := $새1$             견줄이름(기관이름보정(p.source, p.org_name, p.title)) as 기관열쇠,
             /* ★ 2026-10-19 세중님 ㉤ — 괄호가 든 이름은 **앞 이름으로도** 견줍니다.
                화면에는 전체(「인천병원(서울의원)」)를 쓰지만 다른 출처는
                「인천병원」으로만 적을 수 있습니다 */
             견줄이름(coalesce(제목속병원_앞(p.title),
                               기관이름보정(p.source, p.org_name, p.title))) as 기관열쇠앞,$새1$;
  v_옛2 text := $옛2$        on a.기관열쇠 = b.기관열쇠$옛2$;
  v_새2 text := $새2$        on (a.기관열쇠 = b.기관열쇠
            or a.기관열쇠앞 = b.기관열쇠앞
            or a.기관열쇠   = b.기관열쇠앞
            or a.기관열쇠앞 = b.기관열쇠)$새2$;
begin
  select pg_get_functiondef(p.oid) into v_전 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '출처다른중복';
  if v_전 is null then raise exception '출처다른중복 이 없습니다'; end if;

  if position(v_옛1 in v_전) = 0 then raise exception '기관열쇠 줄을 못 찾았습니다'; end if;
  v_센것 := (length(v_전) - length(replace(v_전, v_옛1, ''))) / length(v_옛1);
  if v_센것 <> 1 then raise exception '기관열쇠 줄이 %개입니다', v_센것; end if;
  v_전 := replace(v_전, v_옛1, v_새1);

  if position(v_옛2 in v_전) = 0 then raise exception '견주는 줄을 못 찾았습니다'; end if;
  v_센것 := (length(v_전) - length(replace(v_전, v_옛2, ''))) / length(v_옛2);
  if v_센것 <> 1 then raise exception '견주는 줄이 %개입니다', v_센것; end if;
  v_전 := replace(v_전, v_옛2, v_새2);

  execute v_전;
  raise notice '출처다른중복 — 기관열쇠를 둘로 늘리고 견주기를 네 갈래로 했습니다';
end
$둘다$;

revoke execute on function 출처다른중복(boolean) from public, anon, authenticated;
grant  execute on function 출처다른중복(boolean) to service_role;

do $chk$
declare v text;
begin
  select pg_get_functiondef(p.oid) into v from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '출처다른중복';
  if position('기관열쇠앞' in v) = 0 then raise exception '자기점검 ① 앞 이름 열쇠가 없습니다'; end if;
  if position('a.기관열쇠앞 = b.기관열쇠' in v) = 0 then
    raise exception '자기점검 ② 엇갈려 견주는 갈래가 없습니다';
  end if;
  raise notice '출처다른중복 둘다견주기 자기점검 2가지 통과';
end
$chk$;
