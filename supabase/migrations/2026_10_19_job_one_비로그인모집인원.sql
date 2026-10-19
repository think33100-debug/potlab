-- `job_one` — **비로그인에게도 모집인원**을 줍니다 (2026-10-19 세중님 ㉢ⓑ 승인)
--
-- ── 왜 이 길인가 ─────────────────────────────────────────────────
-- 모집인원은 두 자리에 나뉘어 있습니다 —
--   「0명」         `headcount`(숫자 칸) → `job_one` 이 내므로 **누구나 봅니다**
--   「○명」·「00명」  `뽑은값` 칸        → `공고뽑은값` 이 내는데 그 함수 ACL 에
--                                        **`anon` 이 없어** 비로그인은 못 부릅니다
-- 같은 「모집 인원」인데 보는 사람이 달랐습니다.
--
-- `공고뽑은값` 에 `anon` 을 더하는 길(ⓐ)은 **권한을 늘리는 것**이라 지침 6-2a 가
-- 막는 자리입니다. 세중님이 **ⓑ** 를 고르셨습니다 — `job_one` 은 이미 비로그인에게
-- `detail` 을 주므로 **새 권한이 필요 없습니다.**
--
-- ── 고치는 것 ────────────────────────────────────────────────────
-- 비로그인 갈래의 `jsonb_build_object` 에 **`모집인원` 한 칸**을 더합니다.
-- `job_posts_pub` 에 `뽑은값` 칸이 **없어서**(찍어 확인했습니다) 함수 안에서
-- `job_posts` 를 따로 읽습니다 — `job_one` 은 `security definer` 라 됩니다.
-- 값이 없으면 `jsonb_strip_nulls` 가 걷어 내므로 전과 같습니다.
--
-- ★ 로그인 갈래는 **글자 하나 안 바꿉니다** (거기는 `detail` 전체가 갑니다).
-- ★ 지원자격·예상연봉은 **그대로 회원만** 봅니다 — 이 칸만 더합니다.
-- ★ 돌려주는 칸 수·이름·인수가 그대로라 `drop` 이 필요 없고 ACL 도 안 바뀝니다.
--   전 ACL 을 찍어 두었습니다 —
--     job_one(text)  {postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}

do $한자리$
declare
  v_전 text; v_센것 int;
  v_옛 text := $옛$              then jsonb_strip_nulls(jsonb_build_object('조교연구', j."조교연구"))$옛$;
  v_새 text := $새$              /* ★ 2026-10-19 세중님 ㉢ⓑ — **모집인원은 비로그인도 봅니다.**
                 「0명」은 headcount 로 이미 누구나 보므로 「○명」·「00명」도
                 같이 보여야 앞뒤가 맞습니다. 원문에 적힌 글 그대로 줍니다.
                 뷰에 「뽑은값」 칸이 없어 job_posts 를 따로 읽습니다
                 (이 함수는 security definer 라 됩니다).
                 지원자격·예상연봉은 **안 줍니다** — 회원 자료입니다 */
              then jsonb_strip_nulls(jsonb_build_object(
                     '조교연구', j."조교연구",
                     '모집인원', (select x."뽑은값"->>'모집인원'
                                    from job_posts x where x.id = j.id)))$새$;
begin
  select pg_get_functiondef(p.oid) into v_전 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'job_one';
  if v_전 is null then raise exception 'job_one 이 없습니다'; end if;
  if position(v_옛 in v_전) = 0 then
    raise exception '바꿀 비로그인 갈래를 못 찾았습니다 — 멈춥니다';
  end if;
  v_센것 := (length(v_전) - length(replace(v_전, v_옛, ''))) / length(v_옛);
  if v_센것 <> 1 then
    raise exception '그 글자가 %개입니다 (로그인 갈래까지 바꿀 뻔했습니다) — 멈춥니다', v_센것;
  end if;
  execute replace(v_전, v_옛, v_새);
  raise notice 'job_one 의 비로그인 갈래 한 자리를 바꿨습니다';
end
$한자리$;

-- 권한을 **찍어 둔 전 ACL 그대로** 되돌립니다 (anon 을 새로 더하지 않습니다)
revoke execute on function job_one(text) from public;
grant  execute on function job_one(text) to anon, authenticated, service_role;

-- ── 스스로 하는 검사 ────────────────────────────────────────────
-- psql 로 부르면 `auth.uid()` 가 null 이라 **비로그인 갈래가 그대로 돕니다.**
do $chk$
declare d jsonb;
begin
  /* ★ 「0명」 공고 — 비로그인이 봐야 합니다 (headcount 쪽이라 전에도 보였습니다) */
  select (job_one('HS1650428387')).detail into d;
  if d is null then raise exception '자기점검 ① 광주씨티 공고를 못 받았습니다'; end if;

  /* ★★ 지원자격·예상연봉은 **비로그인에게 안 나가야** 합니다 ★★ */
  if d ? '지원자격' then raise exception '자기점검 ② 비로그인에게 지원자격이 나갑니다 — %', d; end if;
  if d ? '예상연봉' then raise exception '자기점검 ③ 비로그인에게 예상연봉이 나갑니다 — %', d; end if;
  if d ? '연봉'     then raise exception '자기점검 ④ 비로그인에게 연봉이 나갑니다 — %', d; end if;

  /* ★ 글자 인원(○명·00명)이 든 공고가 회원 화면에 있으면 그 값이 와야 합니다.
     지금은 셋 다 숨김이라, **값이 있는 공고를 찾아** 봅니다 */
  if exists (select 1 from job_posts_pub v
              join job_posts x on x.id = v.id
             where x."뽑은값" ? '모집인원') then
    select (job_one(v.id)).detail into d
      from job_posts_pub v join job_posts x on x.id = v.id
     where x."뽑은값" ? '모집인원' limit 1;
    if not (d ? '모집인원') then
      raise exception '자기점검 ⑤ 글자 인원이 있는데 비로그인에게 안 갑니다 — %', d;
    end if;
    raise notice '※ 글자 인원 견본 — %', d->>'모집인원';
  else
    raise notice '※ 지금 회원 화면에 글자 인원(○명·00명)이 든 공고가 없습니다 (셋 다 숨김)';
  end if;

  /* 모집인원이 없는 공고는 그 열쇠가 **없어야** 합니다 (strip_nulls) */
  select (job_one(v.id)).detail into d
    from job_posts_pub v join job_posts x on x.id = v.id
   where not (coalesce(x."뽑은값", '{}'::jsonb) ? '모집인원') limit 1;
  if d ? '모집인원' then
    raise exception '자기점검 ⑥ 값이 없는데 모집인원 열쇠가 있습니다 — %', d;
  end if;

  raise notice 'job_one 비로그인 모집인원 자기점검 통과';
end
$chk$;
