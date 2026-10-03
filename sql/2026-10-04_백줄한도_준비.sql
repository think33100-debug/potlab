-- ════════════════════════════════════════════════════════════════
--  100줄 한도 — 아직 **올리지 않은** SQL (2026-10-04 밤에 만들어 둠)
--  ⚠ 세중님 승인 전에는 올리지 마십시오. 밤에는 SQL 을 올리지 않습니다.
-- ════════════════════════════════════════════════════════════════
--
--  ── 무슨 일인가 ──────────────────────────────────────────────
--  Supabase(PostgREST)는 한 번에 **100줄만** 돌려줍니다.
--  `limit` 을 키워도 안 되고 **오류도 안 납니다.** 재 본 값 —
--
--    job_posts?select=id              → 100줄  Content-Range 0-99/2112
--    job_posts?select=id&limit=5000   → 100줄  Content-Range 0-99/2112
--    job_posts?select=id&limit=100000 → 100줄  Content-Range 0-99/2112
--
--  아래 다섯은 **지금은 100줄 아래라 멀쩡합니다.** 자료가 늘면 조용히
--  잘립니다. 언제 잘리는지 함께 적었습니다.
--
--  ── 오늘 잰 값 ───────────────────────────────────────────────
--    admin_회원목록 · admin_회원표   회원 4명      → 101명째부터 잘림
--    admin_접속기록                 기록 3줄      → 101줄째부터 (함수 안 limit 500)
--    admin_신고목록                 신고 0줄      → 101줄째부터 (함수 안 limit 300)
--    공개공고                       10줄          → 「비로그인_공고수」 가
--                                                 100을 넘거나 -1 이면 잘림
--
--  ⚷ admin_접속기록 은 **개인정보 접속 기록**입니다. 법으로 남기는 기록이
--    잘려 보이면 안 됩니다. 다섯 중 제일 급합니다.
--
--  ── 올린 뒤에 할 일 ──────────────────────────────────────────
--  화면도 같이 고쳐야 합니다. 함수만 고치면 첫 쪽만 보입니다 —
--    web/app/admin/access/page.tsx    admin_접속기록
--    web/app/admin/members/page.tsx   admin_회원목록
--    web/app/admin/posts/page.tsx     admin_회원표
--    web/app/admin/reports/page.tsx   admin_신고목록
--  (쓰레기통 web/app/admin/trash/page.tsx 은 표를 바로 읽어서
--   SQL 없이 화면만 고쳤습니다 — 가지 「백줄고침」에 있습니다)
--
--  DROP 없음 · DELETE 없음 · 칸 바꾸기 없음. 함수 본문만 바꿉니다.
--  되돌리려면 이 파일 맨 아래 「되돌리기」 를 쓰십시오.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 개인정보 접속기록 ────────────────────────────────────────
-- 한 쪽 100줄. p_page 0,1,2… 로 넘깁니다.
create or replace function admin_접속기록(p_page int default 0)
returns table (언제 timestamptz, 누가 text, 어디서 text, 무엇 text,
               어느표 text, 누구것 uuid, 누구 text, 몇명 int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  return query
    select g.언제,
           coalesce('#' || lpad(한.회원번호::text, 5, '0') || ' '
                    || case when 한.erased_at is null then 한.nickname else '탈퇴한 회원' end,
                    g.누가::text),
           g.어디서, g.무엇, g.어느표, g.누구것,
           coalesce('#' || lpad(둘.회원번호::text, 5, '0') || ' '
                    || case when 둘.erased_at is null then 둘.nickname else '탈퇴한 회원' end,
                    '(여러 명 또는 없음)'),
           g.몇명
      from 개인정보접속기록 g
      left join profiles 한 on 한.id = g.누가
      left join profiles 둘 on 둘.id = g.누구것
     order by g.언제 desc
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;

-- ── 2. 회원 목록 ────────────────────────────────────────────────
create or replace function admin_회원목록(p_page int default 0)
returns table (회원번호 text, 닉네임 text, 직군 text, 역할 text,
               가입일 date, 탈퇴일 date, 글 bigint, 댓글 bigint,
               급여넣음 boolean, 스펙넣음 boolean, 알림받음 boolean,
               동의판 text, 동의시각 timestamptz, id uuid)
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  perform 접속기록남기기('조회(목록)', 'profiles', null, (select count(*)::int from profiles));
  return query
    select '#' || lpad(p.회원번호::text, 5, '0'),
           case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           coalesce(p.job_group, '-'),
           coalesce(p.role, '-'),
           (p.created_at at time zone 'Asia/Seoul')::date,
           (p.erased_at  at time zone 'Asia/Seoul')::date,
           (select count(*) from posts    where author_id = p.id),
           (select count(*) from comments where author_id = p.id),
           exists (select 1 from salary_records where profile_id = p.id),
           exists (select 1 from student_specs  where profile_id = p.id),
           exists (select 1 from notification_settings where profile_id = p.id and agreed),
           p.terms_version,
           p.terms_agreed_at,
           p.id
      from profiles p
     order by p.회원번호
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;

-- ── 3. 회원 이름표 ──────────────────────────────────────────────
-- 커뮤니티 글쓴이 이름을 붙이는 데 씁니다.
-- ★ 여기는 쪽을 나누기보다 **쓰는 쪽이 id 를 넘기는 것**이 맞습니다.
--   글 목록에 보이는 글쓴이만 있으면 되기 때문입니다.
--   함수는 이미 p_ids 를 받습니다 — 화면이 안 넘기고 있을 뿐입니다.
--   그래서 함수는 그대로 두고, **화면을 고칩니다** (아래 안내만 남깁니다).
--
--   web/app/admin/posts/page.tsx:78
--     전  sb.rpc('admin_회원표')
--     후  sb.rpc('admin_회원표', { p_ids: [...new Set(글목록.map(g => g.author_id))] })
--
--   그래도 한 쪽에 글이 100개를 넘으면 글쓴이도 100명을 넘을 수 있으니,
--   울타리로 함수에도 쪽을 답니다.
create or replace function admin_회원표(p_ids uuid[] default null, p_page int default 0)
returns table (id uuid, 이름표 text, 회원번호 text, 닉네임 text, 탈퇴 boolean)
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  return query
    select p.id,
           '#' || lpad(p.회원번호::text, 5, '0') || ' '
             || case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           '#' || lpad(p.회원번호::text, 5, '0'),
           case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           (p.erased_at is not null)
      from profiles p
     where p_ids is null or p.id = any(p_ids)
     order by p.회원번호
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;

-- ── 4. 신고 목록 ────────────────────────────────────────────────
-- 본문이 길어 바꾸는 곳만 적습니다 — 맨 끝 `limit 300;` 을
-- `limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;` 으로 바꾸고
-- 인자에 `p_page int default 0` 을 더합니다.
-- (지금 신고가 0줄이라 급하지 않습니다. 올릴 때 본문을 그대로 떠서 고치십시오 —
--  이 파일에 본문을 베껴 두면 그 사이에 원본이 바뀌었을 때 되돌아갑니다)

-- ── 5. 공개공고 ─────────────────────────────────────────────────
-- 비로그인에게 보여주는 맛보기입니다. 지금 「비로그인_공고수」 = 10.
-- ★ 지금 함수는 그 값이 -1 이면 `limit null` 이 되어 **접수 중인 것 전부**를
--   달라고 합니다. 그러면 서버가 100줄에서 자르는데, 화면의 「전체건수」는
--   진짜 수를 보여줘서 **숫자와 목록이 어긋납니다.**
--   비로그인 화면은 쪽 넘기기가 없으므로 **100 으로 묶는 것**이 맞습니다.
create or replace function 공개공고()
returns table (id text, title text, org_name text, sido text, job_group text,
               apply_to date, is_intern boolean, url text,
               전체건수 bigint, 보여주는수 int)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_몇건 integer;
  v_전체 bigint;
begin
  select case when jsonb_typeof(s.value) = 'number' then (s.value)::text::integer else null end
    into v_몇건
    from site_settings s where s.key = '비로그인_공고수';
  v_몇건 := coalesce(v_몇건, 10);

  /* ★ 서버가 100줄에서 자릅니다. -1(전부)이나 100 넘는 값을 넣어도
     어차피 100줄만 갑니다. 그럴 바엔 **보여주는수도 100 이라고 말해야**
     화면의 숫자와 목록이 안 어긋납니다 */
  if v_몇건 < 0 or v_몇건 > 100 then v_몇건 := 100; end if;

  select count(*) into v_전체 from job_posts_pub j
   where j.apply_to is null or j.apply_to >= v_오늘;

  return query
    select j.id, j.title, j.org_name, j.sido,
           j.job_group, j.apply_to, j.is_intern, j.url,
           v_전체, v_몇건
      from job_posts_pub j
     where (j.apply_to is null or j.apply_to >= v_오늘)
     order by j.posted_at desc nulls last, j.id
     limit greatest(v_몇건, 0);
end $$;

-- ── 권한 (인자가 바뀌면 다시 줘야 합니다) ───────────────────────
revoke all on function admin_접속기록(int) from anon, authenticated, public;
revoke all on function admin_회원목록(int) from anon, authenticated, public;
revoke all on function admin_회원표(uuid[], int) from anon, authenticated, public;
grant execute on function admin_접속기록(int) to authenticated;
grant execute on function admin_회원목록(int) to authenticated;
grant execute on function admin_회원표(uuid[], int) to authenticated;
grant execute on function 공개공고() to anon, authenticated;

-- ⚠ 옛 인자 꼴(인자 없는 admin_접속기록() 등)이 남아 있으면 PostgREST 가
--   어느 것을 부를지 헷갈립니다. 올린 뒤 아래로 확인하십시오 —
--     select p.proname, pg_get_function_identity_arguments(p.oid)
--       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('admin_접속기록','admin_회원목록','admin_회원표');
--   같은 이름이 둘이면 옛것을 drop 해야 합니다 (그때 세중님께 먼저 보고).

-- ── 되돌리기 ────────────────────────────────────────────────────
-- 올리기 전에 지금 본문을 떠 두십시오. 그러면 그대로 되돌릴 수 있습니다 —
--   select pg_get_functiondef(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('admin_접속기록','admin_회원목록','admin_회원표',
--                        'admin_신고목록','공개공고');
