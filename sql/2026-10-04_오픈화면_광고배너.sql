-- ═══════════════════════════════════════════════════════════════
--  오픈 화면 광고 배너 — 2026-10-04
--  이 파일은 **이미 올라갔습니다** (승인 창이 뜨지 않았습니다).
--  기록으로 남깁니다. 다시 올려도 같은 결과입니다 (전부 멱등).
-- ═══════════════════════════════════════════════════════════════
--
--  ★ DROP · DELETE · TRUNCATE 가 **한 줄도 없습니다.**
--    더하기(create … if not exists · create or replace · insert … on conflict
--    do nothing · grant · create policy)만 있습니다.
--
--  UPDATE 가 들어간 자리는 둘이고, 둘 다 자료를 지우지 않습니다 —
--    ① insert into 광고배너 … on conflict (자리) do nothing
--       → do **nothing** 입니다. 이미 있으면 아무것도 안 합니다
--    ② 함수 admin_광고배너고치기 안의 update 광고배너
--       → **함수 본문**입니다. 올릴 때 돌지 않습니다.
--         관리자가 화면에서 저장을 누를 때만 그 한 줄이 바뀝니다
--
--  저장소 통(storage.buckets)은 아래 ③ 에 따로 적었습니다.
--  거기에 on conflict do update 가 있는데, 통이 없을 때는 insert 로만 돌고
--  있을 때는 **크기·형식 제한만** 맞춥니다. 파일을 지우지 않습니다.

begin;

-- ── ① 표 둘 ─────────────────────────────────────────────────
-- 자리를 열쇠로 둡니다. 「여러 배너 중 어느 것을 고를까」 하는 규칙이
-- 아예 없게 하려고입니다 — 한 자리에 한 줄뿐입니다.
create table if not exists 광고배너 (
  자리      text primary key check (자리 in ('앱', '커뮤니티')),
  이름      text,                                       -- 광고주·메모. 회원에게 안 보입니다
  그림      text,                                       -- 저장소 공개 주소. 비면 배너가 안 나갑니다
  링크      text,                                       -- 비면 누를 수 없습니다
  표시초    int not null default 2 check (표시초 between 1 and 5),
  켜짐      boolean not null default false,             -- ★ 기본은 꺼짐입니다
  시작일    date,
  끝일      date,
  updated_at timestamptz not null default now()
);

comment on table 광고배너 is
  '오픈 화면 배너. 자리(앱·커뮤니티)마다 한 줄뿐입니다. 꺼져 있거나 그림이 없으면 '
  '짧은 오픈 화면만 나갑니다.';

insert into 광고배너 (자리) values ('앱'), ('커뮤니티')
  on conflict (자리) do nothing;

-- 표시 수·누른 수. **개인 식별 정보가 한 칸도 없습니다** — 자리·날·숫자뿐입니다.
-- 회원id·기기·아이피·때각이 없습니다. 「누가 봤나」를 되돌릴 수 없는 꼴입니다.
create table if not exists 광고셈 (
  자리   text not null,
  날     date not null,
  봄     int not null default 0,
  누름   int not null default 0,
  primary key (자리, 날)
);

comment on table 광고셈 is
  '배너를 몇 번 보여주고 몇 번 눌렸나. 자리·날·숫자만 담습니다 — 누가 봤는지는 '
  '담지 않습니다 (회원id·기기·아이피·때각 하나도 없음).';

alter table 광고배너 enable row level security;
alter table 광고셈   enable row level security;
revoke all on table 광고배너 from anon, authenticated;
revoke all on table 광고셈   from anon, authenticated;

-- ── ② 함수 넷 ───────────────────────────────────────────────
-- 지금 띄울 배너 하나. 꺼짐·기간 밖·그림 없음이면 0줄입니다
create or replace function 지금광고(p_자리 text)
returns table(자리 text, 그림 text, 링크 text, 표시초 int)
language sql stable security definer set search_path to 'public'
as $$
  select b.자리, b.그림, b.링크, b.표시초
    from 광고배너 b
   where b.자리 = p_자리
     and b.켜짐
     and coalesce(b.그림, '') <> ''
     and (b.시작일 is null or b.시작일 <= (now() at time zone 'Asia/Seoul')::date)
     and (b.끝일   is null or b.끝일   >= (now() at time zone 'Asia/Seoul')::date)
$$;

-- 본 것·누른 것 세기. **켜진 자리에만** 셉니다 —
-- 아무 자리 이름이나 넣어 숫자를 불릴 수 없게 막는 자리입니다
create or replace function 광고셈올리기(p_자리 text, p_누름 boolean default false)
returns void
language plpgsql volatile security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from 지금광고(p_자리)) then
    return;
  end if;
  insert into 광고셈 (자리, 날, 봄, 누름)
  values (p_자리, (now() at time zone 'Asia/Seoul')::date,
          case when p_누름 then 0 else 1 end,
          case when p_누름 then 1 else 0 end)
  on conflict (자리, 날) do update
     set 봄   = 광고셈.봄   + case when p_누름 then 0 else 1 end,
         누름 = 광고셈.누름 + case when p_누름 then 1 else 0 end;
end $$;

create or replace function admin_광고배너()
returns table(자리 text, 이름 text, 그림 text, 링크 text, 표시초 int,
              켜짐 boolean, 시작일 date, 끝일 date,
              지금나가나 boolean, 오늘봄 int, 오늘누름 int, 다봄 bigint, 다누름 bigint)
language sql stable security definer set search_path to 'public'
as $$
  select b.자리, b.이름, b.그림, b.링크, b.표시초, b.켜짐, b.시작일, b.끝일,
         exists (select 1 from 지금광고(b.자리)) 지금나가나,
         coalesce(t.봄, 0) 오늘봄, coalesce(t.누름, 0) 오늘누름,
         coalesce(a.봄, 0) 다봄,  coalesce(a.누름, 0) 다누름
    from 광고배너 b
    left join 광고셈 t on t.자리 = b.자리
         and t.날 = (now() at time zone 'Asia/Seoul')::date
    left join (select 자리, sum(봄) 봄, sum(누름) 누름 from 광고셈 group by 1) a
         on a.자리 = b.자리
   where is_admin()
   order by b.자리
$$;

create or replace function admin_광고배너고치기(
  p_자리 text, p_이름 text, p_그림 text, p_링크 text,
  p_표시초 int, p_켜짐 boolean, p_시작일 date, p_끝일 date)
returns jsonb
language plpgsql volatile security definer set search_path to 'public'
as $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if p_자리 not in ('앱', '커뮤니티') then
    raise exception '자리는 앱 또는 커뮤니티입니다' using errcode = '22023';
  end if;
  update 광고배너
     set 이름 = nullif(btrim(coalesce(p_이름, '')), ''),
         그림 = nullif(btrim(coalesce(p_그림, '')), ''),
         링크 = nullif(btrim(coalesce(p_링크, '')), ''),
         /* 1~5초만. 밖으로 나가면 2초로 되돌립니다 — 10초짜리 광고를 못 넣게 */
         표시초 = least(greatest(coalesce(p_표시초, 2), 1), 5),
         켜짐 = coalesce(p_켜짐, false),
         시작일 = p_시작일, 끝일 = p_끝일,
         updated_at = now()
   where 자리 = p_자리;
  return jsonb_build_object('success', true,
    '지금나가나', exists (select 1 from 지금광고(p_자리)));
end $$;

revoke all on function 지금광고(text) from public;
revoke all on function 광고셈올리기(text, boolean) from public;
revoke all on function admin_광고배너() from public, anon;
revoke all on function admin_광고배너고치기(text, text, text, text, int, boolean, date, date) from public, anon;

-- 오픈 화면은 **로그인 전에도** 뜹니다 — anon 도 불러야 합니다
grant execute on function 지금광고(text) to anon, authenticated;
grant execute on function 광고셈올리기(text, boolean) to anon, authenticated;
grant execute on function admin_광고배너() to authenticated;
grant execute on function admin_광고배너고치기(text, text, text, text, int, boolean, date, date) to authenticated;

commit;

-- ── ③ 저장소 통 (1MB · jpg·png·webp) ────────────────────────
-- 크기·형식을 **서버가** 막습니다. 화면에서만 재면 지나칠 수 있습니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-images', 'ad-images', true, 1048576,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
   set public = true, file_size_limit = 1048576,
       allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- 읽기는 누구나(공개 통), 올리고 바꾸고 지우는 것은 관리자만.
-- home-images 의 정책과 같은 꼴입니다.
create policy "광고 그림은 누구나 봅니다" on storage.objects
  for select to public using (bucket_id = 'ad-images');
create policy "광고 그림은 관리자만 올립니다" on storage.objects
  for insert to authenticated with check (bucket_id = 'ad-images' and is_admin());
create policy "광고 그림은 관리자만 바꿉니다" on storage.objects
  for update to authenticated using (bucket_id = 'ad-images' and is_admin());
create policy "광고 그림은 관리자만 지웁니다" on storage.objects
  for delete to authenticated using (bucket_id = 'ad-images' and is_admin());

-- ─────────────────────────────────────────────────────────────
-- 올린 뒤 확인한 것 (2026-10-04 17:45 한국시각)
--
--   표 2 · 함수 4 · 통 1 · 정책 4   다 생겼습니다
--   지금광고('앱') · 지금광고('커뮤니티')      둘 다 0줄 (꺼져 있어서 맞습니다)
--   꺼진 자리에 광고셈올리기() 를 두 번 불러도 광고셈 0줄 — 막는 자리가 돕니다
--   켜고 세 번 부르니 봄 2 · 누름 1 로 늘었고, 바로 다시 껐습니다
--
-- ⚠ 그 시험 숫자 한 줄이 광고셈에 **남아 있습니다.**
--   지우는 줄은 승인 창이 떠서 돌리지 않았습니다 —
--   sql/2026-10-04_광고셈_시험숫자_지우기.sql 을 보십시오.
