/* ⏸ 아직 안 돌렸습니다 — **승인 창이 뜨는 SQL** 입니다. 세중님 승인 뒤 올립니다
 *   (지침 8-8 — 창을 띄우기 전에 전문을 대화에 먼저 적습니다)
 *
 * 무엇 — 목록 창구 `job_list` 가 `조교연구` 칸을 함께 내주게 합니다.
 *        그러면 **목록 카드에도 「조교」·「연구」 배지**가 뜹니다.
 *        지금은 상세 화면에만 뜹니다 (`job_one` 은 `detail` jsonb 에 실어서
 *        모양이 안 바뀌어 승인 창 없이 올라갔습니다).
 *
 * 왜 창이 뜨나 — `returns table(...)` 에 칸을 하나 더하면 `create or replace` 가
 *        `42P13 cannot change return type of existing function` 으로 막힙니다.
 *        그래서 `drop function` 이 필요하고, Supabase 는 `drop` 글자에서
 *        승인 창을 띄웁니다 (지침 6-2 · 8-7).
 *
 * ── ★ 2026-10-14 — 앞 판을 세중님이 올리기 전에 잡아 주셨습니다 ──────────
 *
 * 앞 판 끝에 이렇게 적었습니다 —
 *     revoke execute … from public, anon;
 *     grant  execute … to authenticated;
 * `drop` 은 ACL 을 **통째로 지웁니다.** 그래서 저 두 줄만 걸면
 * **`service_role` 이 빠집니다** — 전에 있던 것이 사라집니다.
 * 권한을 **새로 정하면 안 되고**, 전 ACL 을 찍어 **그대로 되돌려야** 합니다
 * (지침 6-2a 로 적었습니다).
 *
 * ── 1. 올리기 전에 찍은 ACL 원문 (2026-10-14 21:0x) ─────────────────
 *
 *   select p.oid::regprocedure::text, pg_get_function_identity_arguments(p.oid),
 *          p.proacl::text, p.prosecdef, p.provolatile, pg_get_userbyid(p.proowner)
 *     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 *    where n.nspname = 'public' and p.proname in ('job_list', 'job_one');
 *
 *   시그니처   job_list(text,text,text,text,boolean,text,integer)
 *   인수       p_job text, p_sido text, p_tab text, p_q text,
 *              p_all boolean, p_sort text, p_page integer
 *   ACL원문    {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
 *   주인       postgres · security definer · stable
 *
 *   몇 벌인가  **1벌**  (select count(*) … proname='job_list'  →  1)
 *              → `drop` 할 시그니처가 정확히 하나입니다
 *
 * ── ★ 제가 틀리게 알고 있던 것 ───────────────────────────────────
 *
 * 「job_list 는 비회원 화면이 부르니 anon 이 열려 있다」고 알고 있었는데,
 * **ACL 에 `anon` 이 없습니다.** 함수 본문도 첫 줄에서
 *     if auth.uid() is null then raise exception '로그인해야 공고 목록을…'
 * 라고 거절합니다. **비회원 목록은 `공개공고()` 가 냅니다** —
 *     "공개공고"()      {postgres=X,service_role=X,anon=X,authenticated=X}
 *     "공개공고하나"(text) {postgres=X,service_role=X,anon=X,authenticated=X}
 *     job_one(text)     {postgres=X,service_role=X,anon=X,authenticated=X}
 * 이 셋은 이 마이그레이션이 **건드리지 않습니다.** 그래서 비회원 화면은
 * 이 변경과 무관합니다. (그래도 올린 뒤 실제로 열어 확인합니다 — 아래 4번)
 *
 * ── 2. 되돌리는 권한 — 찍어 둔 ACL 과 **글자까지 같게** ──────────────
 *
 *   `create` 직후 ACL 은 `{postgres=X/postgres,=X/postgres}` 입니다
 *   (`=X/` 가 PUBLIC 입니다 — PostgreSQL 이 새 함수를 PUBLIC 에 엽니다).
 *   그래서 PUBLIC 을 걷고 `service_role`·`authenticated` 를 줍니다.
 *   그러면 `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`
 *   — 찍어 둔 것과 같습니다. **anon 은 주지 않습니다** (원래 없었습니다).
 *
 * ── 3. 한 트랜잭션 ───────────────────────────────────────────────
 *
 *   drop · create · revoke · grant 가 **이 파일 하나**에 있고 한 번에 돕니다.
 *   중간에 실패하면 통째로 되돌아갑니다 — 권한이 빈 채로 남지 않습니다.
 *
 * ── 4. 올린 뒤 확인할 것 (네 가지) ────────────────────────────────
 *
 *   ① ACL 전후 글자까지 같은지
 *      select proacl::text from pg_proc where proname='job_list';
 *      → {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
 *   ② 비회원(anon)으로 비회원 목록이 나오는지
 *      set local role anon; select count(*) from "공개공고"();
 *   ③ 회원으로 「조교연구」 칸에 호원대 1건
 *      select id, title, "조교연구" from job_list(null,null,null,null,true,null,0)
 *       where "조교연구" is not null;
 *   ④ web 의 **비회원 공고 화면을 실제로 열어** 빈 화면이 아닌지 캡처
 *
 * ── 되돌리기 ─────────────────────────────────────────────────────
 *
 *   아래에서 `조교연구` 가 든 세 줄만 빼고 같은 꼴로 다시 올리면 전과 같습니다
 *   (돌려주는 칸 선언 · 거른것 CTE · 돌려주는 select). 권한 줄은 그대로 둡니다.
 *   화면은 칸이 없으면 배지를 안 그립니다 — 깨지지 않습니다.
 */
drop function if exists public.job_list(text, text, text, text, boolean, text, integer);

create function public.job_list(
  p_job text, p_sido text, p_tab text, p_q text,
  p_all boolean, p_sort text, p_page integer)
returns table(id text, org_name text, title text, employ_type text, work_place text,
              sido text, job_group text, org_kind text, tab text,
              apply_from date, apply_to date, posted_at date, headcount integer,
              is_intern boolean, "지역보임" text, "올림" boolean, "마감표시" text,
              apply_to_time time without time zone,
              "조교연구" text,                      -- ★ 더한 칸 (2026-10-14)
              total bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  /* 한 번에 20건. 부르는 쪽이 더 달라고 해도 여기서 끊습니다 */
  v_size integer := 20;
begin
  if auth.uid() is null then
    raise exception '로그인해야 공고 목록을 볼 수 있습니다' using errcode = '42501';
  end if;

  return query
  with 거른것 as (
    select j.id, j.org_name, j.title, j.employ_type, j.work_place,
           j.sido, j.job_group, j.org_kind, j.tab,
           j.apply_from, j.apply_to, j.posted_at, j.headcount, j.is_intern,
           j."지역보임", j.apply_to_time,
           j."조교연구",                              -- ★ 더한 칸
           b.순서 as 올림순서,
           마감표시(j.apply_to, j.id, j.tab, j.org_name,
                    coalesce(j."원문제목", j.title), j."접수문장") as 마감표시
      from job_posts_pub j
      left join 공고올림_도는것 b on b.job_id = j.id
     where (p_job  is null or p_job  = '' or j.job_group = p_job)
       and sido_has(j.sido, p_sido)
       /* ★ tab 이 NULL 인 공고는 모든 탭에 보입니다 (2026-10-07 · 임시) */
       and (p_tab  is null or p_tab  = '' or j.tab like p_tab or j.tab is null)
       /* ★ 2026-10-08 — 마감 판정은 아직산공고인가() 한 곳에서만 합니다.
          마감일이 오늘이고 시각이 지났으면 여기서 빠집니다 */
       and (p_all or 아직산공고인가(j.apply_to, j.apply_to_time))
       and (p_q is null or p_q = ''
            or j.title ilike '%' || p_q || '%'
            or j.org_name ilike '%' || p_q || '%')
       /* 마감순은 마감일 있는 것만 — 없는 것을 섞으면 순서가 뜻이 없습니다 */
       and (p_sort is distinct from 'deadline'
            or (j.apply_to is not null and 아직산공고인가(j.apply_to, j.apply_to_time)))
  )
  select f.id, f.org_name, f.title, f.employ_type, f.work_place,
         f.sido, f.job_group, f.org_kind, f.tab,
         f.apply_from, f.apply_to, f.posted_at, f.headcount, f.is_intern,
         f."지역보임", (f.올림순서 is not null) as "올림",
         f.마감표시, f.apply_to_time,
         f."조교연구",                                -- ★ 더한 칸
         (select count(*) from 거른것) as total
    from 거른것 f
   order by
     case when p_sort is null or p_sort in ('top', 'views') then f.올림순서 end asc nulls last,
     case when p_sort = 'deadline' then f.apply_to end asc nulls last,
     case when p_sort = 'views'    then 공고조회수(f.id) end desc nulls last,
     /* ★ 추천순 기본 계산 (2026-10-07 세중님 적용).
          ① 1층(공공·대학·종합) +2  ② 최근 7일 +1  ③ 마감이 7일 안 +1 */
     case when p_sort is null or p_sort = 'top' then
            (case when f.tab like '공공기관·대학·종합%' then 2 else 0 end)
          + (case when f.posted_at >= v_today - 7 then 1 else 0 end)
          + (case when f.apply_to between v_today and v_today + 7 then 1 else 0 end)
          end desc nulls last,
     f.posted_at desc nulls last,
     f.id
   limit v_size
  offset greatest(0, coalesce(p_page, 0)) * v_size;
end
$$;

alter function public.job_list(text, text, text, text, boolean, text, integer)
  owner to postgres;

/* ★ 찍어 둔 ACL 과 **글자까지 같게** 되돌립니다 (지침 6-2a).
   create 직후에는 PUBLIC(`=X/`)이 붙어 있으니 그것만 걷고,
   전에 있던 service_role · authenticated 를 그대로 줍니다.
   **anon 은 주지 않습니다 — 원래 없었습니다.**
   ★ 2026-10-14 세중님 — `from public` 만으로는 모자랍니다. Supabase 는 새 함수에
     **기본 권한(default privileges)으로 `anon` 을 붙일 수 있습니다.** 전 ACL 에
     anon 이 없으니 `from public, anon` 으로 **명시해서** 뺍니다. */
revoke execute on function
  public.job_list(text, text, text, text, boolean, text, integer) from public, anon;
grant  execute on function
  public.job_list(text, text, text, text, boolean, text, integer)
  to service_role, authenticated;
