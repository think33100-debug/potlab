-- 칸기록 30일 보관 (2026-10-18 세중님 6번 — 「30일 보관」)
--
-- ★★ 이 파일은 **세중님이 자리에 있을 때** 올립니다. `delete` 글자가 Supabase
--     승인 창을 띄웁니다 (지침 8-7 — 2026-10-04 에 그 창이 8시간 떠 있었습니다).
--     그래서 표·트리거(2026_10_18_칸기록_표와트리거.sql)와 **따로** 뗐습니다.
--
-- 부르는 자리 — `밤정리.mjs` (23:00). 지금은 함수만 둡니다.

create or replace function public."칸기록_오래된것지우기"(p_days int default 30)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  v int;
begin
  if p_days < 7 then
    raise exception '칸기록을 7일보다 짧게 두지 않습니다 — 받은 값 %', p_days;
  end if;
  delete from "칸기록" where "바뀐때" < now() - make_interval(days => p_days);
  get diagnostics v = row_count;
  return v;
end $fn$;

revoke execute on function public."칸기록_오래된것지우기"(int) from public, anon, authenticated;
grant  execute on function public."칸기록_오래된것지우기"(int) to service_role;

comment on function public."칸기록_오래된것지우기"(int) is
  '칸기록을 30일만 둡니다. 밤정리가 부릅니다. 7일보다 짧은 값은 거부합니다 (2026-10-18)';
