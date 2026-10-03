-- ═══════════════════════════════════════════════════════════════
--  교육기관 알림 — **보내는 쪽에 갈래 하나를 더합니다**
--  2026-10-04. 크론은 **안 켰습니다** (세중님 지시).
-- ═══════════════════════════════════════════════════════════════
--
--  ⚖ org_stars 를 쓰지 않고 새 표(교육기관알림)를 쓴 까닭
--
--    org_stars 는 (profile_id, org_name) 으로 **병원**을 찜하는 표입니다.
--    거기에 학회 이름을 넣으면 두 가지가 깨집니다.
--      ① 회원의 「찜한 병원」 목록에 학회가 섞여 나옵니다 — 화면이 거짓말을 합니다
--      ② 보낼알림() 의 새공고 갈래가 org_stars 를 job_posts.org_name 에 잇습니다.
--         학회 이름이 들어오면 그 조인이 늘 0줄이라 아무 일도 안 일어나고,
--         대신 같은 이름의 병원이 생기는 날 **엉뚱한 알림**이 갑니다
--    그래서 (회원, 기관) 짝만 담는 작은 표를 따로 두었습니다. 10월 4일에
--    이미 만들어 올렸습니다 — 이 파일은 **보내는 쪽만** 손봅니다.
--
--  바뀌는 것은 함수 하나입니다 — 보낼알림(text, int, int)
--    돌려주는 칸 이름·차례·형이 **그대로**라서 create or replace 로 됩니다.
--    (DROP 이 없습니다. 칸을 바꾸면 drop 이 필요한데, 그래서 안 바꿨습니다)
--
--  안전장치는 **하나도 새로 만들지 않았습니다.** 있던 것을 그대로 지나갑니다
--    조용한 시간 22~7      함수 맨 앞 — 갈래와 무관하게 0줄
--    하루 상한             여유있는기기 CTE
--    중복 방지             unique (기기id, 갈래, 공고id) · 갈래가 '새교육' 이라 섞이지 않음
--    탈퇴·꺼진 기기 제외    기기 CTE
--    구독 뒤의 것만        아래 ★ 를 보십시오
--
--  ★ 「구독 뒤에 올라온 것만」을 교육에서 어떻게 재나
--    교육 표에는 job_posts 의 db_insert_at 같은 **들어온 시각이 없습니다.**
--    (교육담기() 가 upsert 때마다 updated_at 을 now() 로 밀어서 못 씁니다)
--    그래서 기관이 **글을 올린 날(올린날)** 로 잽니다 —
--      올린날 > (기기 구독한때 와 기관 켠때 중 **늦은 것**)의 날짜
--    날짜 단위라 「켠 날 당일에 올라온 글」은 안 갑니다. 한 건 놓치는 쪽이
--    켠 순간 묶음으로 쏘는 쪽보다 낫습니다.
--
--    ⚠ 올린날이 비어 있는 출처는 **알림이 안 갑니다.**
--      2026-10-04 기준 한국보바스협회 4건이 그렇습니다 (109건 중 14건이 빔).
--      날짜를 짐작해 채우지 않습니다 — 틀린 날짜로 알림을 쏘면 더 나쁩니다.

begin;

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
        v_오늘 date := (v_지금 at time zone 'Asia/Seoul')::date;
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
       and (j.apply_to is null or j.apply_to >= v_오늘)
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
       and j.apply_to between v_오늘 and (v_오늘 + 3)
  ),
  /* ── 갈래 ③ 알림 켠 교육기관의 새 교육 (2026-10-04) ──────────
     기관 = 교육.출처 = 교육기관.이름 입니다. 같은 글자를 씁니다 */
  새교육 as (
    select k.id 기기id, k.어떻게, k.주소, k.열쇠1, k.열쇠2,
           '새교육'::text 갈래, e.번호 공고id, e.제목, e.출처 기관, e.끝 마감,
           e.올린날::timestamptz 때
      from 여유있는기기 k
      join 교육기관알림 t on t.회원 = k.profile_id
      join 교육기관 g on g.이름 = t.기관 and g.보임 and g.모음
      join 교육 e on e.출처 = g.이름
     where e.올린날 is not null
       /* ★ 기기를 구독한 때와 그 기관을 켠 때 중 **늦은 쪽**보다 뒤에 올린 것만 */
       and e.올린날 > (greatest(k.구독한때, t.켠때) at time zone 'Asia/Seoul')::date
       /* 이미 끝난 교육은 안 보냅니다 */
       and (e.끝 is null or e.끝 >= v_오늘)
       /* 접수마감도 안 보냅니다 — 눌러도 신청을 못 합니다 */
       and coalesce(e.상태, '모름') <> '접수마감'
  ),
  다 as (select * from 새공고
         union all select * from 마감임박
         union all select * from 새교육)
  select d.기기id, d.어떻게, d.주소, d.열쇠1, d.열쇠2, d.갈래, d.공고id, d.제목, d.기관, d.마감
    from 다 d
   where not exists (
     select 1 from 알림보낸것 s
      where s.기기id = d.기기id and s.갈래 = d.갈래 and s.공고id = d.공고id
   )
   order by d.때 desc
   limit greatest(p_몇개, 0);
end $$;

-- 권한은 그대로입니다 — service_role 만 (create or replace 는 권한을 안 지웁니다).
-- 그래도 눈으로 확인할 수 있게 한 번 더 적어 둡니다.
revoke all on function 보낼알림(text, int, int) from public, anon, authenticated;
grant execute on function 보낼알림(text, int, int) to service_role;

commit;

-- ─────────────────────────────────────────────────────────────
-- 올린 뒤 확인
--
-- 1) 갈래가 셋인지 — 함수 본문에서 눈으로
--      select pg_get_functiondef(oid) from pg_proc where proname='보낼알림';
--      → '새교육' 이 보여야 합니다
--
-- 2) 지금은 알림기기가 0줄이라 무엇을 넣어도 0줄이 맞습니다
--      select count(*) from 알림기기;
--
-- 3) 기기 없이 고르는 쪽만 흉내 내 보기 (사람 대신 모든 회원으로 가정)
--      아래는 **실제 함수가 아니고** 조인이 맞는지만 보는 쿼리입니다
--      select g.이름, count(*) 보낼수
--        from 교육기관알림 t
--        join 교육기관 g on g.이름 = t.기관 and g.보임 and g.모음
--        join 교육 e on e.출처 = g.이름
--       where e.올린날 is not null and (e.끝 is null or e.끝 >= current_date)
--       group by 1;
--
-- 4) 크론 — **안 켰습니다.** 켤 때는 알림보내기.mjs 를 --dry 로 먼저 돌립니다
