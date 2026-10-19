-- 칸기록에 **고용형태**도 남깁니다 (2026-10-19 세중님 6번 승인)
--
-- 일곱 칸만 남기게 만들었는데, 고용형태는 **회원에게 보이는 값이고 수집기가
-- 덮습니다.** 2026-10-19 에 「공무원」 120건을 바로잡으면서, 이 칸도 조용히
-- 바뀔 수 있다는 것이 드러났습니다 — 그래서 함께 남깁니다.
--
-- 바꾼 곳은 **한 자리**입니다. 나머지는 2026_10_18_칸기록_표와트리거.sql 과
-- 글자까지 같습니다 (지침 7절).

create or replace function public."칸기록남기기"() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_누가 text := coalesce(nullif(current_setting('app.누가', true), ''), '(모름)');
  v_왜   text := nullif(current_setting('app.왜', true), '');
begin
  if new.headcount is distinct from old.headcount then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'headcount', old.headcount::text, new.headcount::text, v_누가, v_왜);
  end if;
  if new.apply_to is distinct from old.apply_to then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'apply_to', old.apply_to::text, new.apply_to::text, v_누가, v_왜);
  end if;
  if new.apply_to_time is distinct from old.apply_to_time then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'apply_to_time', old.apply_to_time::text, new.apply_to_time::text, v_누가, v_왜);
  end if;
  if new.work_place is distinct from old.work_place then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'work_place', left(old.work_place, 200), left(new.work_place, 200), v_누가, v_왜);
  end if;
  /* ★ 2026-10-19 세중님 6번 — 고용형태. 일곱 칸은 아니지만 **회원에게 보이고
     수집기가 덮는** 값입니다. 「공무원」 120건을 바로잡은 날 함께 넣었습니다 */
  if new.employ_type is distinct from old.employ_type then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'employ_type', left(old.employ_type, 200), left(new.employ_type, 200), v_누가, v_왜);
  end if;
  /* 아래 셋은 detail 속입니다. **화면이 읽는 순서와 같은 순서**로 꺼냅니다
     (docs/일곱칸_대조_1014.md) — 그래야 「화면 값이 바뀐 것」이 기록됩니다 */
  if coalesce(new.detail->>'직군인원', new.detail->'뽑은값'->>'모집인원')
     is distinct from coalesce(old.detail->>'직군인원', old.detail->'뽑은값'->>'모집인원') then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'detail.모집인원',
            left(coalesce(old.detail->>'직군인원', old.detail->'뽑은값'->>'모집인원'), 200),
            left(coalesce(new.detail->>'직군인원', new.detail->'뽑은값'->>'모집인원'), 200), v_누가, v_왜);
  end if;
  if coalesce(new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격')
     is distinct from coalesce(old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격') then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'detail.지원자격',
            left(coalesce(old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격'), 200),
            left(coalesce(new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격'), 200), v_누가, v_왜);
  end if;
  if coalesce(new.detail->'뽑은값'->>'예상연봉', new.detail->>'연봉', new.detail->>'예상연봉')
     is distinct from coalesce(old.detail->'뽑은값'->>'예상연봉', old.detail->>'연봉', old.detail->>'예상연봉') then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'detail.예상연봉',
            left(coalesce(old.detail->'뽑은값'->>'예상연봉', old.detail->>'연봉', old.detail->>'예상연봉'), 200),
            left(coalesce(new.detail->'뽑은값'->>'예상연봉', new.detail->>'연봉', new.detail->>'예상연봉'), 200), v_누가, v_왜);
  end if;
  return null;          -- after 트리거의 반환값은 쓰이지 않습니다
end $fn$;

revoke execute on function public."칸기록남기기"() from public, anon, authenticated;
