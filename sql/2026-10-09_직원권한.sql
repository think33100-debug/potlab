/* ② 직원 권한 (2026-10-09 · 뼈대 2절)

   ── 무엇이 바뀌나 ───────────────────────────────────────────
   지금은 admins 에 줄이 있으면 **90곳이 전부 열립니다.**
   그 90곳을 고치지 않습니다. 한 겹을 더 얹습니다.

     is_admin()        「운영진인가」 — 관리자 화면에 들어올 수 있나. 그대로
     권한있나('코드')   「이 일을 해도 되나」 — 민감한 자리에만 덧붙입니다

   직원이 한 명도 없는 동안에는 admins 에 대표 한 명뿐이고 대표는 모든
   권한을 가지므로, **이 파일을 올려도 동작이 하나도 안 바뀝니다.**

   ── 지우는 문장이 한 줄도 없습니다 ───────────────────────────
   권한을 거둘 때 줄을 없애지 않고 끈때 를 채웁니다 (작업지침 8-7).
   누가 언제 무엇을 가졌었는지도 그대로 남습니다. */

-- ─────────────────────────────────────────────────────────────
-- ① 운영진 명단 — 대표와 직원을 가릅니다
-- ─────────────────────────────────────────────────────────────
alter table public.admins
  add column if not exists 갈래   text not null default '대표',
  add column if not exists 끈사람 uuid,
  add column if not exists 끈때   timestamptz,
  add column if not exists 넣은사람 uuid,
  add column if not exists 메모   text;

do $$ begin
  alter table public.admins
    add constraint admins_갈래_check check (갈래 in ('대표','직원'));
exception when duplicate_object then null; end $$;

/* 지금 들어 있는 줄은 세중님 하나입니다 — 대표로 둡니다 (default 가 '대표').
   앞으로 admin_직원추가() 로 들어오는 줄은 '직원' 입니다. */

-- ─────────────────────────────────────────────────────────────
-- ② 누가 무엇을 할 수 있나
-- ─────────────────────────────────────────────────────────────
/* profile_id 에 외래키를 걸지 않습니다 — 권한기록 과 같은 까닭입니다.
   ㉠ 탈퇴(reset_my_account)가 막히면 안 됩니다
   ㉡ 남은 줄은 쓰레기가 아니라 **기록**입니다 — 누가 무엇을 가졌었는지
   ㉢ 지워진 사람은 로그인을 못 하니 권한있나() 가 절대 참이 되지 않습니다 */
create table if not exists public.권한 (
  id         bigserial primary key,
  profile_id uuid not null,
  권한코드    text not null,
  준사람      uuid not null,
  준때        timestamptz not null default now(),
  끈사람      uuid,
  끈때        timestamptz
);

/* 한 사람에게 같은 권한이 **살아 있는 채로** 두 번 들어가지 않게.
   거둔 줄(끈때 채워진 것)은 여러 개 남아도 됩니다 — 그게 기록입니다 */
create unique index if not exists 권한_살아있는것
  on public.권한 (profile_id, 권한코드) where 끈때 is null;

create index if not exists 권한_사람 on public.권한 (profile_id);

-- 주고 거둔 기록 (지우지 않습니다)
create table if not exists public.권한기록 (
  id        bigserial primary key,
  누구에게   uuid not null,
  권한코드   text not null,
  준것인가   boolean not null,          -- true 주기 · false 거두기
  누가      uuid not null,
  언제      timestamptz not null default now(),
  까닭      text
);

create index if not exists 권한기록_때 on public.권한기록 (언제 desc);

alter table public.권한      enable row level security;
alter table public.권한기록   enable row level security;

/* 화면은 RPC 로만 읽습니다. 표를 바로 읽는 길은 운영진에게만 열어 둡니다 —
   쓰는 길은 아무에게도 안 엽니다 (RPC 가 security definer 로 씁니다) */
/* ★ 2026-10-09 — 여기 있던 「규칙 먼저 없애기」 두 줄을 뺐습니다.
   두 표를 이 파일에서 처음 만들기 때문에 규칙이 있을 수가 없어 쓸모가 없는데,
   그 낱말 하나 때문에 **승인 창이 떴고 세중님이 Decline 하셨습니다.**
   위험한 문장이 한 줄도 없게 두는 쪽이 낫습니다. */
create policy "권한은 운영진만 봅니다" on public.권한
  for select using (is_admin());

create policy "권한기록은 운영진만 봅니다" on public.권한기록
  for select using (is_admin());

-- ─────────────────────────────────────────────────────────────
-- ③ 판정
-- ─────────────────────────────────────────────────────────────

/* is_admin() 에 **끈때 is null** 한 가지만 더합니다.
   안 더하면 뺀 직원이 계속 운영진으로 남습니다.
   지금 들어 있는 줄은 끈때 가 비어 있어 **동작이 안 바뀝니다** —
   이 한 줄로 쓰는 곳 90군데(함수 55 · 규칙 33 · 뷰 2)가 그대로 따라옵니다 */
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from admins where profile_id = auth.uid() and 끈때 is null)
$$;

create or replace function public.대표인가()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from admins
                  where profile_id = auth.uid() and 갈래 = '대표' and 끈때 is null)
$$;

/* 대표는 모든 권한을 가집니다. 직원은 받은 것만.
   이 함수가 false 를 돌려주면 **그 일만** 막힙니다 —
   관리자 화면 자체는 is_admin() 이 정합니다 */
create or replace function public.권한있나(p_코드 text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select 대표인가()
      or exists (select 1 from 권한
                  where profile_id = auth.uid()
                    and 권한코드 = p_코드
                    and 끈때 is null)
$$;

/* 내가 가진 권한 — 화면이 단추를 보일지 말지 정하는 데 씁니다.
   막는 자리는 RPC 안입니다. 여기서 거짓말해도 서버가 안 해 줍니다 */
create or replace function public.내권한()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    '대표',   대표인가(),
    '운영진', is_admin(),
    '권한',   coalesce((select jsonb_agg(권한코드 order by 권한코드)
                          from 권한 where profile_id = auth.uid() and 끈때 is null),
                       '[]'::jsonb))
$$;

-- ─────────────────────────────────────────────────────────────
-- ④ 직원 관리 — 대표만
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_직원목록()
returns table (
  profile_id uuid, 회원번호 bigint, 닉네임 text, 갈래 text,
  넣은때 timestamptz, 끈때 timestamptz, 권한 jsonb
)
language sql stable security definer set search_path to 'public'
as $$
  select a.profile_id, p.회원번호, p.nickname, a.갈래, a.added_at, a.끈때,
         coalesce((select jsonb_agg(g.권한코드 order by g.권한코드)
                     from 권한 g where g.profile_id = a.profile_id and g.끈때 is null),
                  '[]'::jsonb)
    from admins a
    join profiles p on p.id = a.profile_id
   where is_admin()
   order by (a.갈래 = '대표') desc, a.added_at
$$;

/* 회원번호로 넣습니다 — 화면에 uuid 를 띄우지 않으려고요.
   회원번호는 /admin/members 에 이미 보입니다 */
create or replace function public.admin_직원넣기(p_회원번호 bigint, p_메모 text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_이름 text;
begin
  if not 대표인가() then
    raise exception '대표만 직원을 넣을 수 있습니다' using errcode = '42501';
  end if;

  select id, nickname into v_id, v_이름 from profiles where 회원번호 = p_회원번호;
  if v_id is null then
    raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023';
  end if;

  insert into admins (profile_id, 갈래, 넣은사람, 메모)
  values (v_id, '직원', auth.uid(), p_메모)
  on conflict (profile_id) do update
     set 갈래 = case when admins.갈래 = '대표' then '대표' else '직원' end,
         끈때 = null, 끈사람 = null,
         메모 = coalesce(excluded.메모, admins.메모);

  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, '(직원 넣기)', true, auth.uid(), p_메모);

  return jsonb_build_object('넣음', v_이름, '회원번호', p_회원번호);
end $$;

/* 뺄 때도 줄을 안 지웁니다 — 끈때 를 채웁니다.
   가진 권한도 같이 거둡니다. 안 거두면 다시 넣을 때 옛 권한이 살아납니다 */
create or replace function public.admin_직원빼기(p_회원번호 bigint, p_까닭 text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_갈래 text; v_거둔수 int;
begin
  if not 대표인가() then
    raise exception '대표만 직원을 뺄 수 있습니다' using errcode = '42501';
  end if;

  select id into v_id from profiles where 회원번호 = p_회원번호;
  if v_id is null then
    raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023';
  end if;

  select 갈래 into v_갈래 from admins where profile_id = v_id;
  if v_갈래 = '대표' then
    raise exception '대표는 뺄 수 없습니다' using errcode = '42501';
  end if;

  update admins set 끈때 = now(), 끈사람 = auth.uid()
   where profile_id = v_id and 끈때 is null;

  update 권한 set 끈때 = now(), 끈사람 = auth.uid()
   where profile_id = v_id and 끈때 is null;
  get diagnostics v_거둔수 = row_count;

  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, '(직원 빼기)', false, auth.uid(), p_까닭);

  return jsonb_build_object('뺌', p_회원번호, '같이 거둔 권한', v_거둔수);
end $$;

-- ─────────────────────────────────────────────────────────────
-- ⑤ 권한 주기·거두기 — 대표만
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_권한주기(
  p_회원번호 bigint, p_코드 text, p_까닭 text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not 대표인가() then
    raise exception '대표만 권한을 줄 수 있습니다' using errcode = '42501';
  end if;

  select id into v_id from profiles where 회원번호 = p_회원번호;
  if v_id is null then
    raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023';
  end if;

  /* 운영진이 아닌 사람에게 권한을 주지 않습니다 —
     권한만 있고 관리자 화면에 못 들어오면 아무 뜻이 없습니다 */
  if not exists (select 1 from admins where profile_id = v_id and 끈때 is null) then
    raise exception '먼저 직원으로 넣어 주십시오' using errcode = '42501';
  end if;

  insert into 권한 (profile_id, 권한코드, 준사람)
  values (v_id, p_코드, auth.uid())
  on conflict (profile_id, 권한코드) where 끈때 is null do nothing;

  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, p_코드, true, auth.uid(), p_까닭);

  return jsonb_build_object('줌', p_코드, '회원번호', p_회원번호);
end $$;

create or replace function public.admin_권한거두기(
  p_회원번호 bigint, p_코드 text, p_까닭 text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_n int;
begin
  if not 대표인가() then
    raise exception '대표만 권한을 거둘 수 있습니다' using errcode = '42501';
  end if;

  select id into v_id from profiles where 회원번호 = p_회원번호;
  if v_id is null then
    raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023';
  end if;

  update 권한 set 끈때 = now(), 끈사람 = auth.uid()
   where profile_id = v_id and 권한코드 = p_코드 and 끈때 is null;
  get diagnostics v_n = row_count;

  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, p_코드, false, auth.uid(), p_까닭);

  return jsonb_build_object('거둠', p_코드, '줄', v_n);
end $$;

create or replace function public.admin_권한기록(p_몇줄 int default 100)
returns table (언제 timestamptz, 누가 text, 누구에게 text, 권한코드 text,
               준것인가 boolean, 까닭 text)
language sql stable security definer set search_path to 'public'
as $$
  select r.언제, 준사람.nickname, 받은사람.nickname, r.권한코드, r.준것인가, r.까닭
    from 권한기록 r
    left join profiles 준사람   on 준사람.id   = r.누가
    left join profiles 받은사람 on 받은사람.id = r.누구에게
   where is_admin()
   order by r.언제 desc
   limit least(greatest(coalesce(p_몇줄, 100), 1), 500)
$$;

-- ─────────────────────────────────────────────────────────────
-- ⑥ 누가 부를 수 있나
-- ─────────────────────────────────────────────────────────────
revoke all on function public.대표인가()            from public, anon;
revoke all on function public.권한있나(text)         from public, anon;
revoke all on function public.내권한()               from public, anon;
revoke all on function public.admin_직원목록()        from public, anon;
revoke all on function public.admin_직원넣기(bigint, text)        from public, anon, authenticated;
revoke all on function public.admin_직원빼기(bigint, text)        from public, anon, authenticated;
revoke all on function public.admin_권한주기(bigint, text, text)   from public, anon, authenticated;
revoke all on function public.admin_권한거두기(bigint, text, text) from public, anon, authenticated;
revoke all on function public.admin_권한기록(int)     from public, anon;

grant execute on function public.권한있나(text)       to authenticated;
grant execute on function public.대표인가()           to authenticated;
grant execute on function public.내권한()             to authenticated;
grant execute on function public.admin_직원목록()      to authenticated;
grant execute on function public.admin_권한기록(int)   to authenticated;

/* 쓰는 넷은 **대표만** 부릅니다. 함수 안에서도 대표인가() 로 막고,
   실행 권한도 따로 줍니다 — 두 겹입니다 */
grant execute on function public.admin_직원넣기(bigint, text)        to authenticated;
grant execute on function public.admin_직원빼기(bigint, text)        to authenticated;
grant execute on function public.admin_권한주기(bigint, text, text)   to authenticated;
grant execute on function public.admin_권한거두기(bigint, text, text) to authenticated;
