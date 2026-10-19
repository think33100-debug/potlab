-- 화면 보정은 **원문 제목**을 봐야 합니다 (2026-10-19 · 앞 판의 실수를 고칩니다)
--
-- ── 무슨 일 ──────────────────────────────────────────────────────
-- 앞 판을 올리니 자기점검 ②가 잡았습니다 — `job_one('306122')` 이 그대로
-- 「한국보훈복지의료공단」 을 냈습니다.
--
-- 까닭 — `job_posts_pub.title` 은 **다듬은 「보여줄제목」** 입니다. 트리거
-- `제목채우기` 가 만든 것이고 **대괄호가 없습니다** —
--   job_posts.title          「[광주보훈병원] 계약직 보건직(작업치료사) …」
--   job_posts_pub.title      「한국보훈복지의료공단 광주보훈병원 작업치료사 계약직 채용공고」
-- 그래서 `제목속병원()` 이 아무것도 못 찾았습니다.
--
-- 그 뷰에 **`원문제목` 칸이 있습니다**(찍어 확인했습니다 · `job_one` 이 이미
-- `마감표시(…)` 인수로 씁니다). 그것을 보게 고칩니다.
--
-- ★ 인수·칸 수 그대로 → `drop` 없음 · ACL 그대로.

do $둘$
declare
  v_전 text; v_센것 int;
  v_옛1 text := '기관이름보정_아이디로(j.id, j.org_name, j.title)';
  v_새1 text := '기관이름보정_아이디로(j.id, j.org_name, coalesce(j."원문제목", j.title))';
begin
  foreach v_전 in array array['job_one', 'job_list'] loop
    declare v_본 text; begin
      select pg_get_functiondef(p.oid) into v_본 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_전;
      if position(v_옛1 in v_본) = 0 then
        raise exception '% — 바꿀 글자를 못 찾았습니다 (앞 판이 안 올라갔나 봅니다)', v_전;
      end if;
      v_센것 := (length(v_본) - length(replace(v_본, v_옛1, ''))) / length(v_옛1);
      if v_센것 <> 1 then raise exception '% — 그 글자가 %개입니다', v_전, v_센것; end if;
      execute replace(v_본, v_옛1, v_새1);
      raise notice '% 를 원문제목으로 고쳤습니다', v_전;
    end;
  end loop;
end
$둘$;

revoke execute on function job_one(text) from public;
grant  execute on function job_one(text) to anon, authenticated, service_role;
revoke execute on function job_list(text, text, text, text, boolean, text, integer) from public, anon;
grant  execute on function job_list(text, text, text, text, boolean, text, integer) to authenticated, service_role;

do $chk$
declare 이름 text;
begin
  select (job_one('306122')).org_name into 이름;
  if 이름 is distinct from '광주보훈병원' then
    raise exception '자기점검 ① job_one 이 「%」 를 냅니다 (광주보훈병원이어야 합니다)', 이름;
  end if;
  select (job_one('HS1313695815')).org_name into 이름;
  if 이름 is distinct from '가톨릭대학교 은평성모병원' then
    raise exception '자기점검 ② HS3 공고의 기관 이름이 바뀌었습니다 — %', 이름;
  end if;
  select (job_one('WNK180012610190008')).org_name into 이름;
  if 이름 is not null and 이름 !~ '화성' then
    raise exception '자기점검 ③ WN2 공고의 기관 이름이 바뀌었습니다 — %', 이름;
  end if;
  raise notice '화면 보정이름(원문제목) 자기점검 3가지 통과 — job_one 이 광주보훈병원을 냅니다';
end
$chk$;
