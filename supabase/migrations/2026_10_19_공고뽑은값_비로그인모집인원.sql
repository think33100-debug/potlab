-- `공고뽑은값` — **비로그인에게도 모집인원만** 줍니다 (2026-10-19 세중님 ㉢ 승인)
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 지금은 비로그인에게 `{}` 를 줍니다. 그래서 —
--   「0명」    `headcount`(숫자 칸)에 있어 `job_one` 으로 와서 **누구나 봅니다**
--   「○명」·「00명」  `뽑은값` 칸에 있어 **로그인한 회원만** 봅니다
-- 같은 「모집 인원」인데 보는 사람이 다릅니다. 세중님 결정 —
-- **모집인원은 누구에게나(숫자·○명·00명 모두), 지원자격·예상연봉은 지금처럼 회원만.**
--
-- ── 고치는 것 ────────────────────────────────────────────────────
-- 비로그인 갈래에서 `{}` 대신 **`모집인원` 한 칸만** 담아 돌려줍니다.
-- 값이 없으면 `jsonb_strip_nulls` 가 걷어 내므로 전과 같이 `{}` 입니다.
-- 로그인 갈래는 **글자 하나 안 바꿉니다.**
--
-- ★ 인수가 그대로(`text`)라 **같은 함수**이고 ACL 은 안 바뀝니다 (지침 6-2).
--   그래도 끝에 `revoke … from public, anon` 을 다시 겁니다 (6-3).
--
-- ════════════════════════════════════════════════════════════════
-- ★★ **올리지 않았습니다 — 2026-10-19 20:50** ★★
--
-- 전 ACL 을 찍어 보니 제 짐작이 틀렸습니다 —
--     "공고뽑은값"(text)  {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
-- **`anon` 이 없습니다.** 즉 비로그인은 이 함수를 **아예 못 부릅니다.**
-- 그러니 본문만 고쳐도 「비로그인에게 보이게」가 안 됩니다 — `anon` 에
-- `grant` 를 **더해야** 합니다. 그것은 **권한을 늘리는 것**이고 지침 6-2a 가
-- 막는 자리입니다 («전 ACL 을 찍어 거기 없는 역할은 안 넣습니다» ·
-- 2026-10-18 에 `alive_mark` 에 없던 anon 을 더해 되돌린 일이 있습니다).
--
-- 그래서 세중님께 두 길을 묻습니다 —
--   ⓐ `공고뽑은값` 에 `anon` 을 더합니다 (권한 늘림 · 이 파일 그대로 + grant)
--   ⓑ **권한을 안 늘리는 길** — `job_one` 의 **비로그인 detail** 에
--      `모집인원글` 한 칸을 더합니다. `job_one` 은 이미 비로그인에게 detail 을
--      주므로 **새 권한이 필요 없습니다.** 돌려주는 칸 수가 그대로여서
--      `drop` 도 필요 없습니다(승인 창도 안 뜹니다). 화면은 한 줄 고칩니다.
--      → 제 생각은 **ⓑ** 입니다.
-- ════════════════════════════════════════════════════════════════

-- (아래는 ⓐ 를 고르실 때 쓸 전문입니다 — 지금은 올리지 않았습니다)
create or replace function 공고뽑은값(p_id text)
returns jsonb
language sql stable security definer set search_path to 'public' as $fn$
  /* 비회원에게는 **모집인원만** 줍니다 — 지원자격·연봉은 회원 자료입니다
     (2026-10-19 세중님 ㉢). 모집인원은 「0명」이 숫자 칸으로 이미 누구에게나
     보이므로, 「○명」·「00명」도 같이 보여야 앞뒤가 맞습니다 */
  select case when auth.uid() is null
              then jsonb_strip_nulls(jsonb_build_object(
                     '모집인원', j."뽑은값"->>'모집인원'))
              else coalesce(j."뽑은값", '{}'::jsonb) end
    from job_posts j where j.id = p_id
$fn$;

revoke execute on function 공고뽑은값(text) from public;
grant  execute on function 공고뽑은값(text) to anon, authenticated, service_role;

-- ── 스스로 하는 검사 ────────────────────────────────────────────
-- psql 로 부르면 `auth.uid()` 가 null 이라 **비로그인 갈래가 그대로 돕니다.**
-- 그래서 진짜 비로그인 응답을 여기서 확인할 수 있습니다.
do $chk$
declare
  v jsonb;
begin
  /* ★ ○명 — 비로그인도 봐야 합니다 (HS218887824 백제병원 · 원문이 영문 O) */
  v := 공고뽑은값('HS218887824');
  if (v->>'모집인원') is distinct from '○명' then
    raise exception '자기점검 ① 비로그인이 ○명을 못 봅니다 — %', v;
  end if;

  /* ★ 00명 — 뉴고려병원 (원문이 숫자 0 두 개) */
  v := 공고뽑은값('HS665496254');
  if (v->>'모집인원') is distinct from '00명' then
    raise exception '자기점검 ② 비로그인이 00명을 못 봅니다 — %', v;
  end if;

  /* ★★ 지원자격·예상연봉은 **비로그인에게 안 나가야** 합니다 ★★
     그 공고들에 지원자격이 들어 있는지 먼저 확인하고(없으면 검사가 헛돕니다),
     비로그인 응답에 없는 것을 봅니다 */
  if not exists (select 1 from job_posts j
                  where j.id = 'HS218887824' and j."뽑은값" ? '지원자격') then
    raise notice '※ HS218887824 에 지원자격이 없어 ③ 검사는 다른 공고로 봅니다';
  end if;
  if exists (
    select 1 from job_posts j
     where j."뽑은값" ? '지원자격'
       and (공고뽑은값(j.id)) ? '지원자격'
     limit 1) then
    raise exception '자기점검 ③ 비로그인에게 지원자격이 나갑니다';
  end if;
  if exists (
    select 1 from job_posts j
     where j."뽑은값" ? '예상연봉'
       and (공고뽑은값(j.id)) ? '예상연봉'
     limit 1) then
    raise exception '자기점검 ④ 비로그인에게 예상연봉이 나갑니다';
  end if;

  /* 모집인원이 없는 공고는 전과 같이 빈 것이어야 합니다 */
  if exists (
    select 1 from job_posts j
     where not (coalesce(j."뽑은값", '{}'::jsonb) ? '모집인원')
       and (공고뽑은값(j.id)) <> '{}'::jsonb
     limit 1) then
    raise exception '자기점검 ⑤ 모집인원이 없는데 빈 것이 아닙니다';
  end if;

  /* 없는 공고번호는 null (전과 같음) */
  if 공고뽑은값('없는공고번호') is not null then
    raise exception '자기점검 ⑥ 없는 공고에 값을 냅니다';
  end if;

  raise notice '공고뽑은값 자기점검 6가지 통과 (비로그인은 모집인원만)';
end
$chk$;
