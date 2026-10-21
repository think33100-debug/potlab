-- deadline_from_title — **두 자리 해**를 읽습니다 (2026-10-21 세중님 지시 3번)
--
-- 왜 — 공고문·제목은 해를 두 자리로 적는 일이 흔합니다 —
--        「임용일로부터 26.11.30.까지」 (CE79408 첨부)
--        「접수기간 : 26. 10. 14.(수) 15:00」 (한국탄소산업진흥원)
--      지금 함수는 ① 에서 「20\d{2}」 만 보고, ② 는 범위 표시가 있을 때 M/D 만
--      읽습니다. 그래서 두 자리 해가 든 글은 **날짜를 못 냅니다.**
--
-- 무엇을 더하나 — ①-2 로 **(yy)[.-/](m)[.-/](d)** 를 봅니다. 함부로 읽지 않게
--      ⓐ 앞뒤에 숫자가 붙지 않은 것만 ⓑ yy 가 24~40 ⓒ mo 1~12 · d 1~31
--      ⓓ 나온 날이 **기준일 ±400일** 안에 들 때만 씁니다.
--      (「10. 15. 17」 같은 쪽 번호·시각 꼬리가 날짜로 읽히지 않게 하는 울타리입니다)
--
-- 인수·이름이 그대로라 **ACL 은 유지됩니다** (지침 6-2). 그래도 전후를 찍습니다.
-- 되돌리기 — 이 파일 아래 「되돌리기」 주석의 옛 본문을 그대로 올리면 됩니다
--            (옛 본문 = ①①② 셋만 있던 꼴 · pg_get_functiondef 로 떠 두었습니다).

\pset pager off

-- 전 ACL
select 'before' as 때, p.oid::regprocedure::text as 함수, p.proacl::text as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'deadline_from_title';

create or replace function public.deadline_from_title(p_title text, p_base date)
 returns date
 language plpgsql
 immutable
as $function$
declare
  t    text := coalesce(p_title, '');
  base date := coalesce(p_base, (now() at time zone 'Asia/Seoul')::date);
  m    text[];
  y    int; mo int; d int;
  got  date := null;
begin
  /* ① 온전한 날짜 — 마지막 것을 씁니다 */
  for m in select regexp_matches(t, '(20\d{2})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})', 'g') loop
    y := m[1]::int; mo := m[2]::int; d := m[3]::int;
    if mo between 1 and 12 and d between 1 and 31 then
      begin got := make_date(y, mo, d); exception when others then null; end;
    end if;
  end loop;
  if got is not null then return got; end if;

  /* ①-2 ★ 2026-10-21 — **두 자리 해.** 「26. 11. 30.」 「26.10.14」 꼴입니다.
     울타리 — 앞뒤에 숫자가 없고 · yy 24~40 · 나온 날이 기준일 ±400일 안 */
  for m in select regexp_matches(t, '(?<![0-9])(\d{2})\s?[.\-/]\s?(\d{1,2})\s?[.\-/]\s?(\d{1,2})(?![0-9])', 'g') loop
    y := 2000 + m[1]::int; mo := m[2]::int; d := m[3]::int;
    if m[1]::int between 24 and 40 and mo between 1 and 12 and d between 1 and 31 then
      begin
        if make_date(y, mo, d) between base - 400 and base + 400 then
          got := make_date(y, mo, d);
        end if;
      exception when others then null;
      end;
    end if;
  end loop;
  if got is not null then return got; end if;

  /* ② 범위 표시가 있을 때만 M/D 를 읽습니다 */
  if t !~ '~|∼|～|까지|마감' then return null; end if;

  for m in select regexp_matches(t, '(?<![0-9])(\d{1,2})\s?[/.]\s?(\d{1,2})(?![0-9])', 'g') loop
    mo := m[1]::int; d := m[2]::int;
    /* 「1/4분기」 「3/4」 같은 것은 날짜가 아닙니다 — 뒤에 분기·기가 붙으면 건너뜁니다 */
    if t ~ (m[1] || '\s?[/.]\s?' || m[2] || '\s?(분기|기|차)') then continue; end if;
    if mo between 1 and 12 and d between 1 and 31 then
      begin
        got := make_date(extract(year from base)::int, mo, d);
        /* 12월에 본 「1/15」 는 이듬해입니다 */
        if got < base - 180 then got := make_date(extract(year from base)::int + 1, mo, d); end if;
      exception when others then got := null;
      end;
    end if;
  end loop;
  return got;
end $function$;

-- 후 ACL (전과 글자까지 같아야 합니다)
select 'after' as 때, p.oid::regprocedure::text as 함수, p.proacl::text as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'deadline_from_title';

-- 자기 점검 — 두 자리 해가 읽히고, 아닌 것은 안 읽힙니다
select '26.11.30'            as 글, deadline_from_title('임용일로부터 26.11.30.까지', '2026-10-21')      as 날
union all select '26. 10. 14.(수)', deadline_from_title('접수기간 : 26. 10. 14.(수) 15:00', '2026-10-21')
union all select '2026-11-05 (네자리)', deadline_from_title('접수 2026-11-05 까지', '2026-10-21')
union all select '쪽번호 10. 15. 17',  deadline_from_title('10. 15. 17', '2026-10-21')
union all select '해가 멀다 99.1.1',   deadline_from_title('99.1.1 까지', '2026-10-21')
union all select '빈 글',              deadline_from_title('', '2026-10-21');
