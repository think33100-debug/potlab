-- ═══════════════════════════════════════════════════════════════
--  새 앱 알림 ① 고르는 부분 — 누구에게 무엇을 보낼지 정합니다
--  2026-10-02 준비. **올리지 않았습니다.** 세중님 확인 뒤에 올립니다.
-- ═══════════════════════════════════════════════════════════════
--
--  왜 「고르는 부분」과 「보내는 부분」을 떼어 놓나
--    나중에 앱스토어 앱이 나오면 **보내는 쪽만** 바꾸면 되게 하려고입니다.
--    이 파일에는 웹 푸시 이야기가 한 줄도 없습니다. 「누구에게 무엇을」만 정하고,
--    실제로 보내는 일은 다음 조각(Lightsail 크론 + web-push)이 합니다.
--
--  지금 왜 필요한가
--    새 앱이 회원에게 **약속은 하는데 보내는 장치가 없습니다** —
--      web/components/job-closed.tsx:70  「새 공고가 올라오면 바로 알려드릴게요」
--      web/components/org-save.tsx       「공고 뜨면 알려주기」
--    service worker 도 web-push 도 보내는 코드도 없습니다. 동의만 쌓입니다.
--
--  이 파일이 하는 것 — **만들기만 합니다**
--    표 둘      알림기기 · 알림보낸것
--    함수 넷    알림기기등록 · 알림기기끄기 · 보낼알림 · 알림보낸것남기기
--
--  **DROP · DELETE · 기존 표 변경이 하나도 없습니다.**
--  기존 표(push_devices · notification_settings · org_stars · job_stars ·
--  profiles · job_posts)는 **읽기만** 합니다.
--
--  회원 개인정보는 안 읽습니다
--    profiles 에서 쓰는 칸은 `id` 와 `erased_at` 둘뿐입니다 — 탈퇴 여부만 봅니다.
--    닉네임·직군·아바타는 안 읽습니다. 함수가 돌려주는 줄에도 안 담습니다.
--
--  토요일 작업과 안 겹칩니다
--    수집·주인넘기기 쪽 표와 함수(job_posts 쓰기 · collect_put · collect_trash ·
--    수집기짝 · 수집판정)는 **하나도 안 건드립니다.** job_posts 는 읽기만 합니다.
--
--  왜 push_devices 를 안 쓰고 새 표를 만드나
--    push_devices 는 옛 앱이 쓰던 표입니다 (지금 0줄).
--    칸이 id · profile_id · endpoint · p256dh · auth · updated_at 뿐이라
--    **구독 시각**과 **켬/끔**이 없습니다. 둘 다 안전장치에 꼭 필요합니다.
--    옛 표를 고치면 토요일 전에 옛 쪽을 건드리는 셈이라, 새 표를 따로 둡니다.

begin;

-- ── 표 ① 알림기기 ───────────────────────────────────────────
-- 회원이 「알림 받기」를 누르면 기기 하나가 여기 한 줄로 들어옵니다.
-- 웹 푸시의 endpoint·p256dh·auth 를 담지만, 이 표 자체는 보내는 방법을 모릅니다 —
-- 앱스토어 앱이 생기면 `어떻게` 칸에 'apns'·'fcm' 을 넣고 `주소` 를 토큰으로 씁니다.
create table if not exists 알림기기 (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  어떻게      text not null default 'webpush',    -- webpush · (나중에) fcm · apns
  주소        text not null,                      -- 웹 푸시면 endpoint
  열쇠1       text,                               -- p256dh
  열쇠2       text,                               -- auth
  켜짐        boolean not null default true,
  구독한때    timestamptz not null default now(), -- ★ 이 시각 뒤 공고만 보냅니다
  마지막성공  timestamptz,
  연속실패    int not null default 0,
  꺼진때      timestamptz,
  꺼진까닭    text,
  unique (어떻게, 주소)
);

comment on table 알림기기 is
  '알림 받을 기기 하나가 한 줄. 구독한때 이후 공고만 보냅니다 — 가입 전 공고를 '
  '몰아 보내면 안 되기 때문입니다. 보내는 방법은 `어떻게` 칸에만 있고, '
  '고르는 쪽은 그것을 모릅니다.';

create index if not exists 알림기기_회원 on 알림기기 (profile_id) where 켜짐;

alter table 알림기기 enable row level security;

-- 내 기기만 보고 고칠 수 있습니다
create policy "내 기기만 봅니다" on 알림기기
  for select to authenticated using (profile_id = auth.uid());
create policy "내 기기만 넣습니다" on 알림기기
  for insert to authenticated with check (profile_id = auth.uid());
create policy "내 기기만 고칩니다" on 알림기기
  for update to authenticated using (profile_id = auth.uid());

-- ── 표 ② 알림보낸것 ─────────────────────────────────────────
-- **같은 기기에 같은 공고를 두 번 보내지 않게** 하는 자물쇠입니다.
-- 고유 제약이 그 일을 합니다 — 코드가 깜빡해도 DB 가 막습니다.
create table if not exists 알림보낸것 (
  id        bigint generated always as identity primary key,
  기기id    bigint not null references 알림기기(id) on delete cascade,
  갈래      text not null,        -- '새공고' · '마감임박'
  공고id    text not null,
  보낸때    timestamptz not null default now(),
  결과      text,                 -- 'ok' · 'gone' · 오류 한 줄
  unique (기기id, 갈래, 공고id)   -- ★ 두 번 안 갑니다
);

comment on table 알림보낸것 is
  '보낸 기록. (기기id, 갈래, 공고id) 고유 제약이 중복 발송을 막습니다. '
  '회원당 하루 상한을 세는 데도 씁니다.';

create index if not exists 알림보낸것_기기_때 on 알림보낸것 (기기id, 보낸때 desc);

alter table 알림보낸것 enable row level security;
-- 회원 화면은 이 표를 안 읽습니다. 보내는 쪽만 함수로 드나듭니다.

-- ── 함수 ① 기기 등록 ────────────────────────────────────────
-- 회원이 「알림 받기」를 누를 때 브라우저가 부릅니다.
create or replace function 알림기기등록(p_주소 text, p_열쇠1 text, p_열쇠2 text,
                                        p_어떻게 text default 'webpush')
returns bigint
language plpgsql volatile security definer set search_path to 'public'
as $$
declare v_id bigint;
begin
  if auth.uid() is null then
    raise exception '로그인해야 합니다' using errcode = '42501';
  end if;
  if coalesce(p_주소, '') = '' then
    raise exception '주소가 없습니다' using errcode = '22023';
  end if;
  /* 같은 기기를 다시 누르면 **다시 켭니다.** 구독한때도 새로 잡습니다 —
     껐다 켠 사이에 올라온 공고를 몰아 보내면 안 되기 때문입니다 */
  insert into 알림기기 (profile_id, 어떻게, 주소, 열쇠1, 열쇠2, 켜짐, 구독한때, 연속실패, 꺼진때, 꺼진까닭)
  values (auth.uid(), coalesce(p_어떻게, 'webpush'), p_주소, p_열쇠1, p_열쇠2, true, now(), 0, null, null)
  on conflict (어떻게, 주소) do update
     set profile_id = auth.uid(), 열쇠1 = excluded.열쇠1, 열쇠2 = excluded.열쇠2,
         켜짐 = true, 구독한때 = now(), 연속실패 = 0, 꺼진때 = null, 꺼진까닭 = null
  returning id into v_id;
  return v_id;
end $$;

-- ── 함수 ② 기기 끄기 ────────────────────────────────────────
create or replace function 알림기기끄기(p_주소 text, p_어떻게 text default 'webpush')
returns int
language plpgsql volatile security definer set search_path to 'public'
as $$
declare n int;
begin
  if auth.uid() is null then
    raise exception '로그인해야 합니다' using errcode = '42501';
  end if;
  update 알림기기
     set 켜짐 = false, 꺼진때 = now(), 꺼진까닭 = '회원이 껐습니다'
   where profile_id = auth.uid() and 주소 = p_주소 and 어떻게 = coalesce(p_어떻게, 'webpush');
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 함수 ③ 보낼 알림 고르기 ─────────────────────────────────
-- **이 함수가 이 파일의 알맹이입니다.** 보내는 쪽은 이것만 부르면 됩니다.
-- 돌려주는 줄에 **개인정보가 없습니다** — 기기id · 주소 · 열쇠 · 공고 정보뿐입니다.
create or replace function 보낼알림(p_secret text, p_하루상한 int default 3, p_몇개 int default 100)
returns table(
  기기id   bigint,
  어떻게   text,
  주소     text,
  열쇠1    text,
  열쇠2    text,
  갈래     text,
  공고id   text,
  제목     text,
  기관     text,
  마감     date
)
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_지금 timestamptz := now();
        v_시 int := extract(hour from (v_지금 at time zone 'Asia/Seoul'));
begin
  /* 보내는 쪽(Lightsail 크론)만 부를 수 있습니다. 회원 화면은 안 부릅니다 */
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  /* ★ 조용한 시간 — 밤 22시부터 아침 7시까지는 **아무것도 안 돌려줍니다.**
     아침에 크론이 다시 부르면 그동안 쌓인 것이 한꺼번에 나갑니다 */
  if v_시 >= 22 or v_시 < 7 then
    return;
  end if;

  return query
  with 기기 as (
    /* 켜진 기기 · 탈퇴 안 한 회원만.
       profiles 에서 보는 칸은 id 와 erased_at **둘뿐**입니다 */
    select d.id, d.profile_id, d.어떻게, d.주소, d.열쇠1, d.열쇠2, d.구독한때
      from 알림기기 d
      join profiles p on p.id = d.profile_id
     where d.켜짐
       and p.erased_at is null
       and d.연속실패 < 3
  ),
  오늘보낸수 as (
    select s.기기id, count(*) n
      from 알림보낸것 s
     where s.보낸때 >= (date_trunc('day', v_지금 at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
     group by 1
  ),
  여유있는기기 as (
    select k.*, coalesce(o.n, 0) 오늘
      from 기기 k left join 오늘보낸수 o on o.기기id = k.id
     where coalesce(o.n, 0) < greatest(p_하루상한, 0)
  ),
  /* ── 갈래 ① 관심 기관의 새 공고 ───────────────────────────
     회원이 org_stars.notify 를 켠 기관의 공고 중,
     **그 기기가 구독한 뒤에** 들어온 것만 */
  새공고 as (
    select k.id 기기id, k.어떻게, k.주소, k.열쇠1, k.열쇠2,
           '새공고'::text 갈래, j.id 공고id, j.title 제목, j.org_name 기관, j.apply_to 마감,
           j.db_insert_at 때
      from 여유있는기기 k
      join org_stars t on t.profile_id = k.profile_id and t.notify
      join job_posts j on j.org_name = t.org_name
     where not j.hidden and not j.hold
       and j.db_insert_at > k.구독한때
       and (j.apply_to is null or j.apply_to >= (v_지금 at time zone 'Asia/Seoul')::date)
  ),
  /* ── 갈래 ② 찜한 공고 마감 임박 (3일 전) ──────────────────── */
  마감임박 as (
    select k.id 기기id, k.어떻게, k.주소, k.열쇠1, k.열쇠2,
           '마감임박'::text 갈래, j.id 공고id, j.title 제목, j.org_name 기관, j.apply_to 마감,
           j.apply_to::timestamptz 때
      from 여유있는기기 k
      join job_stars f on f.profile_id = k.profile_id
      join job_posts j on j.id = f.job_id
     where not j.hidden and not j.hold
       and j.apply_to is not null
       and j.apply_to between (v_지금 at time zone 'Asia/Seoul')::date
                          and ((v_지금 at time zone 'Asia/Seoul')::date + 3)
  ),
  다 as (select * from 새공고 union all select * from 마감임박)
  select d.기기id, d.어떻게, d.주소, d.열쇠1, d.열쇠2, d.갈래, d.공고id, d.제목, d.기관, d.마감
    from 다 d
   where not exists (
     select 1 from 알림보낸것 s
      where s.기기id = d.기기id and s.갈래 = d.갈래 and s.공고id = d.공고id
   )
   order by d.때 desc
   limit greatest(p_몇개, 0);
end $$;

-- ── 함수 ④ 보낸 것 남기기 ───────────────────────────────────
-- 보내는 쪽이 한 건 보낼 때마다 (또는 묶음으로) 부릅니다.
-- 고유 제약이 중복을 막으므로 **보내기 전에 먼저 남기는 것**이 안전합니다.
create or replace function 알림보낸것남기기(p_secret text, p_rows jsonb)
returns int
language plpgsql volatile security definer set search_path to 'public'
as $$
declare n int;
begin
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception '한 번에 500줄까지입니다';
  end if;

  insert into 알림보낸것 (기기id, 갈래, 공고id, 보낸때, 결과)
  select (e->>'기기id')::bigint, e->>'갈래', e->>'공고id', now(), e->>'결과'
    from jsonb_array_elements(p_rows) e
   where coalesce(e->>'기기id','') <> '' and coalesce(e->>'공고id','') <> ''
  on conflict (기기id, 갈래, 공고id) do nothing;   -- 두 번 보내도 한 줄
  get diagnostics n = row_count;

  /* 기기가 사라졌다(gone)고 하면 끕니다 — 다음부터 안 고릅니다.
     연속 실패가 3이면 보낼알림() 이 알아서 뺍니다 */
  update 알림기기 d
     set 켜짐 = false, 꺼진때 = now(), 꺼진까닭 = '보내는 쪽이 사라진 기기라고 했습니다'
    from jsonb_array_elements(p_rows) e
   where d.id = (e->>'기기id')::bigint and e->>'결과' = 'gone';

  update 알림기기 d
     set 연속실패 = d.연속실패 + 1
    from jsonb_array_elements(p_rows) e
   where d.id = (e->>'기기id')::bigint
     and coalesce(e->>'결과','') not in ('ok', 'gone', '');

  update 알림기기 d
     set 연속실패 = 0, 마지막성공 = now()
    from jsonb_array_elements(p_rows) e
   where d.id = (e->>'기기id')::bigint and e->>'결과' = 'ok';

  return n;
end $$;

-- ── 권한 ────────────────────────────────────────────────────
revoke all on function 알림기기등록(text, text, text, text) from public;
revoke all on function 알림기기끄기(text, text) from public;
revoke all on function 보낼알림(text, int, int) from public;
revoke all on function 알림보낸것남기기(text, jsonb) from public;

-- 회원이 켜고 끕니다
grant execute on function 알림기기등록(text, text, text, text) to authenticated;
grant execute on function 알림기기끄기(text, text) to authenticated;
-- 보내는 쪽(Lightsail)만. 열쇠로 한 번 더 막습니다
grant execute on function 보낼알림(text, int, int) to anon;
grant execute on function 알림보낸것남기기(text, jsonb) to anon;

commit;

-- ─────────────────────────────────────────────────────────────
-- 올린 바로 뒤에 확인할 것
--
-- 1) 표 둘이 생겼는지
--      select table_name from information_schema.tables
--       where table_schema='public' and table_name in ('알림기기','알림보낸것');
--
-- 2) 조용한 시간이 도는지 — 밤 22~7시에 부르면 0줄이어야 합니다
--      select count(*) from 보낼알림((select secret from collect_secret where source='HS3' and length(secret)=43));
--
-- 3) 지금은 기기가 0줄이라 무엇을 넣어도 0줄이 맞습니다.
--    보내는 부분(다음 조각)을 만들고 기기를 하나 등록한 뒤에 진짜 시험을 합니다.
--
-- 4) 안전장치가 다 들어갔는지 — 이 파일에서 눈으로 확인하는 자리
--      구독 시각 이후만      j.db_insert_at > k.구독한때
--      중복 방지(고유 제약)   unique (기기id, 갈래, 공고id)
--      회원당 하루 상한      오늘보낸수 … where coalesce(o.n,0) < p_하루상한
--      조용한 시간 22~7      if v_시 >= 22 or v_시 < 7 then return; end if;
--      탈퇴 회원 제외        p.erased_at is null
--      꺼진 기기 제외        d.켜짐 · d.연속실패 < 3
--      기관·직군 설정 재사용  org_stars.notify · job_stars (새 설정 표를 안 만듭니다)
