/* 회원 재방문 — 같은 아이디가 다시 들어왔나 (2026-11-24 세중님 「같은 아이디가 다시 들어왔나 그렇게 해야해 급해」)

   브라우저 근사치(재방문_근사치.sql)는 기기·브라우저를 한 사람으로 셉니다. 이것은 **회원 한 명**을 한 사람으로 셉니다.

   담는 것: 회원 번호(profile_id) · 한국 날짜 하나 · 통계에서 뺄지(관리자) · 출처.
   시각·화면·주소·기기는 담지 않습니다. 하루에 한 줄뿐입니다(같은 날 여러 번 와도 한 줄).
   읽는 사람은 관리자뿐입니다. 회원은 **오늘·자기 줄 하나 넣기**만 할 수 있습니다.
   탈퇴(프로필 지움)하면 줄도 같이 지워집니다.

   되돌림: 회원_재방문_되돌림.sql */

create table if not exists public.회원방문일 (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  날 date not null,
  제외 boolean not null default false,   -- 관리자 — 통계에서 뺍니다
  출처 text not null default '기록' check (출처 in ('기록', '옛기록')),
  primary key (profile_id, 날)
);
comment on table public.회원방문일 is
  '회원 재방문 — 회원 한 명이 들어온 한국 날짜(하루 한 줄). 관리자만 읽음. 2026-11-24';
comment on column public.회원방문일.출처 is
  '기록 = 화면이 찍음 · 옛기록 = 11/24 이전 로그인·글·댓글 등 남은 흔적에서 채움(빠진 날이 있을 수 있음)';

create index if not exists 회원방문일_날 on public.회원방문일 (날);

alter table public.회원방문일 enable row level security;

revoke all on public.회원방문일 from anon, authenticated, public;
grant insert (profile_id, 날, 제외) on public.회원방문일 to authenticated;
grant select on public.회원방문일 to authenticated;

drop policy if exists "회원은 오늘 자기 줄만 넣습니다" on public.회원방문일;
create policy "회원은 오늘 자기 줄만 넣습니다" on public.회원방문일
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and 날 = (now() at time zone 'Asia/Seoul')::date
    and 제외 = (select public.is_admin())
    and 출처 = '기록'
  );

drop policy if exists "관리자만 읽습니다" on public.회원방문일;
create policy "관리자만 읽습니다" on public.회원방문일
  for select to authenticated
  using ((select public.is_admin()));

/* 날마다: 들어온 회원 수 · 그날 처음 들어온 회원 수 · 그중 1~7일 안에 다시 들어온 회원 수 */
create or replace function public.admin_stats_member_revisit(p_days integer default 21)
returns table (
  day date,
  visit_members bigint,
  new_members bigint,
  back_members bigint,
  back_done boolean,
  back_pct numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_days  int  := least(greatest(coalesce(p_days, 21), 1), 90);
  v_from  date;
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  v_from := v_today - (v_days - 1);

  return query
  with v as materialized (
    select m.profile_id, m.날 from public.회원방문일 m where not m.제외
  ),
  첫 as (
    select v.profile_id, min(v.날) as f from v group by v.profile_id
  ),
  days as (
    select g::date as d from generate_series(v_from, v_today, interval '1 day') g
  )
  select days.d,
         (select count(*) from v where v.날 = days.d),
         n.새,
         n.다시,
         (days.d + 7 < v_today),
         case when days.d + 7 < v_today and n.새 > 0
              then round(100.0 * n.다시 / n.새, 1) end
    from days
    cross join lateral (
      select count(*) as 새,
             count(*) filter (where exists (
               select 1 from v where v.profile_id = 첫.profile_id
                                 and v.날 between days.d + 1 and days.d + 7)) as 다시
        from 첫 where 첫.f = days.d
    ) n
   order by days.d;
end $function$;

revoke all on function public.admin_stats_member_revisit(integer) from public, anon;
grant execute on function public.admin_stats_member_revisit(integer) to authenticated;
