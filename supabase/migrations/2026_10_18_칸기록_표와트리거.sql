-- 일곱 칸 값 기록 (2026-10-18 세중님 6번 승인)
--   「일곱 칸만 · after update 트리거 · 30일 보관 · 낮에 적용 ·
--    8-14 사고 교훈대로 다른 트리거·on conflict 와 겹치는지 시험(마른 실행 표에서 먼저)」
--
-- ★ 이 파일은 **낮에** 올립니다. 설계는 docs/칸값기록_안_1018.md 입니다.
-- ★ 30일 지우기는 **딴 파일**입니다 — `delete` 글자가 승인 창을 띄웁니다 (지침 8-7).
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 2026-10-18 에 되메우기가 채운 모집인원 4건이 지워졌습니다. 짚을 수 있었던 까닭은
-- 제가 우연히 409건을 떠 두었기 때문입니다. `job_state_log` 는 hold·hidden·직군만
-- 적고 **칸 값은 아무 데도 안 남습니다** — `updated_at` 만 바뀝니다.
--
-- ── 마른 실행 표에서 먼저 본 것 (임시 표 · 2026-10-18) ──────────
--   ① insert 때는 기록이 안 남습니다 (after **update** 만)              ✓
--   ② `insert … on conflict do update` 에서 **한 번만** 남습니다        ✓
--   ③ 값이 안 바뀌는 update 에서는 안 남습니다 (is distinct from)       ✓
--   ④ 값이 **지워지는** 것도 남습니다 (옛값 5 → 새값 빈값)              ✓
--   ⑤ 되돌려지는 트랜잭션에서는 기록도 함께 사라집니다                  ✓
--   ⑥ `누가` 가 들어갑니다 — `set_config('app.누가', …, true)` 는
--      **같은 트랜잭션 안에서만** 삽니다. `collect_put` 등이 함수 안에서
--      넣으므로 실제로는 들어갑니다. psql 에서 문장을 따로 돌리면 (모름) 입니다
--   ⑦ 하루 몇 줄 — 최근 24시간에 `updated_at` 이 바뀐 공고가 **702건**.
--      칸이 실제로 바뀐 것은 그보다 훨씬 적습니다 (빈 값 덮어쓰기를 고친 뒤)
--
-- ★ ②에서 **8-14 사고가 그대로 재현됐습니다** — 같은 표에 `before insert` 트리거가
--   있으면 그것이 켠 값이 `excluded` 를 타고 기존 줄에 들어갑니다. 이 기록
--   트리거는 `after update` 이고 `return null` 이라 그 자리가 아닙니다.

create table if not exists public."칸기록" (
  id        bigserial primary key,
  job_id    text not null references job_posts(id) on delete cascade,
  "칸"      text not null,
  "옛값"    text,
  "새값"    text,
  "누가"    text not null,
  "왜"      text,
  "바뀐때"  timestamptz not null default now()
);
create index if not exists "칸기록_공고_때" on public."칸기록" (job_id, "바뀐때" desc);
create index if not exists "칸기록_때"      on public."칸기록" ("바뀐때" desc);

comment on table public."칸기록" is
  '일곱 칸 값이 바뀐 기록 (전→후·누가·왜·언제). 30일 보관. job_state_log 의 칸 짝 (2026-10-18)';

-- ── 권한 (지침 6-2 · 6-3 · 8-13) ────────────────────────────────
-- ★ bigserial 이 시퀀스를 만듭니다. 넣는 것은 **트리거(definer)뿐**이라
--   회원·authenticated 에게 usage 를 줄 필요가 없습니다 (8-13 회원번호_seq 사고와
--   같은 자리지만, 이쪽은 회원이 직접 넣지 않으므로 안 줍니다).
revoke all on table public."칸기록" from public, anon, authenticated;
revoke all on sequence public."칸기록_id_seq" from public, anon, authenticated;
grant select on table public."칸기록" to service_role;

create or replace function public."칸기록남기기"() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_누가 text := coalesce(nullif(current_setting('app.누가', true), ''), '(모름)');
  v_왜   text := nullif(current_setting('app.왜', true), '');
  /* 일곱 칸 중 **바쁜정도는 여기 없습니다** — 그것은 공고 칸이 아니라
     기관 자료(org_hospital_stat.band)입니다. 공고가 바뀌어도 안 바뀝니다 */
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

-- ★ `after update` 입니다. `before` 가 아닙니다 — NEW 를 못 고치니 8-14 사고가
--   날 수 없습니다. 그리고 `return null` 이라 줄을 바꾸지도 않습니다.
drop trigger if exists "칸기록_after" on public.job_posts;
create trigger "칸기록_after" after update on public.job_posts
  for each row execute function public."칸기록남기기"();
