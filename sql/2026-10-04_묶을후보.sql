-- ═══════════════════════════════════════════════════════════════
--  묶을 후보 — 2026-10-04
--  이 파일은 **이미 올라갔습니다** (승인 창이 뜨지 않았습니다).
--  기록으로 남깁니다. 다시 올려도 같은 결과입니다.
-- ═══════════════════════════════════════════════════════════════
--
--  ★ DROP · DELETE · TRUNCATE 가 **한 줄도 없습니다.**
--    되돌리기 함수에만 delete 가 있어서 그것만 따로 떼었습니다 —
--    sql/2026-10-04_묶지않음_되돌리기.sql (승인 기다림)
--
--  후보를 어떻게 고르나
--    같은 기관 · 같은 마감 · 다른 출처 · 아직 안 묶임 · 마감 안 지남.
--    **제목은 안 봅니다.** 「작업치료사」와 「물리치료사」로 제목이 달라도
--    한 공고를 둘로 올린 경우가 있고, 제목이 같아도 다른 자리인 경우가
--    있습니다. 글자로는 못 가려서 사람이 가립니다.
--
--    직군이 다른 짝은 **아래로** 내립니다 (order by 직군다름).
--    2026-10-04 기준 7짝이 걸리고, 그중 5짝이 직군이 다릅니다.

create table if not exists 묶지않음 (
  왼쪽    text not null,
  오른쪽  text not null,
  정한때  timestamptz not null default now(),
  primary key (왼쪽, 오른쪽),
  /* 늘 (작은 id, 큰 id) 로 넣습니다 — 누른 차례와 무관하게 한 줄입니다 */
  check (왼쪽 < 오른쪽)
);

comment on table 묶지않음 is
  '관리자가 「이 둘은 다른 공고다」라고 정한 짝. 다시 후보로 안 올라옵니다. '
  '공고를 지우지도 감추지도 않습니다 — 후보 목록에서만 빠집니다.';

alter table 묶지않음 enable row level security;
revoke all on table 묶지않음 from anon, authenticated;

create or replace function 묶을후보(p_page int default 0)
returns table(
  왼쪽 text, 오른쪽 text, 기관 text,
  왼쪽출처 text, 왼쪽제목 text, 왼쪽직군 text, 왼쪽링크 text, 왼쪽올린날 date,
  오른쪽출처 text, 오른쪽제목 text, 오른쪽직군 text, 오른쪽링크 text, 오른쪽올린날 date,
  마감 date, 직군다름 boolean
)
language sql stable security definer set search_path to 'public'
as $$
  with 산것 as (
    select id, source, org_name, title, job_group, url, posted_at, apply_to
      from job_posts
     where not hidden and not hold and 같은공고 is null
       and (apply_to is null or apply_to >= (now() at time zone 'Asia/Seoul')::date)
  ),
  짝 as (
    select a.id 왼쪽, b.id 오른쪽, a.org_name 기관,
           a.source 왼쪽출처, a.title 왼쪽제목, a.job_group 왼쪽직군,
           a.url 왼쪽링크, a.posted_at 왼쪽올린날,
           b.source 오른쪽출처, b.title 오른쪽제목, b.job_group 오른쪽직군,
           b.url 오른쪽링크, b.posted_at 오른쪽올린날,
           a.apply_to 마감,
           coalesce(a.job_group, '') <> coalesce(b.job_group, '') 직군다름
      from 산것 a join 산것 b
        on a.org_name = b.org_name
       and a.source <> b.source
       and a.id < b.id
       and coalesce(a.apply_to, date '1900-01-01') = coalesce(b.apply_to, date '1900-01-01')
  )
  select p.* from 짝 p
   where is_admin()
     and not exists (
       select 1 from 묶지않음 x where x.왼쪽 = p.왼쪽 and x.오른쪽 = p.오른쪽
     )
   order by p.직군다름, p.기관, p.왼쪽
   limit 100 offset greatest(coalesce(p_page, 0), 0) * 100
$$;

create or replace function 묶지않기(p_왼쪽 text, p_오른쪽 text)
returns jsonb
language plpgsql volatile security definer set search_path to 'public'
as $$
declare a text; b text;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if coalesce(p_왼쪽,'') = '' or coalesce(p_오른쪽,'') = '' or p_왼쪽 = p_오른쪽 then
    raise exception '짝이 아닙니다' using errcode = '22023';
  end if;
  a := least(p_왼쪽, p_오른쪽); b := greatest(p_왼쪽, p_오른쪽);
  insert into 묶지않음 (왼쪽, 오른쪽) values (a, b)
    on conflict (왼쪽, 오른쪽) do nothing;
  return jsonb_build_object('success', true, '왼쪽', a, '오른쪽', b);
end $$;

-- 이미 묶은 것 — 「풀기」를 걸 자리입니다.
-- 남긴 줄을 left join 으로 붙입니다. 남긴 줄이 사라져도 목록이 안 비게요
create or replace function 묶은것(p_page int default 0)
returns table(
  연결한줄 text, 연결한출처 text, 연결한제목 text, 연결한직군 text,
  남긴줄 text, 남긴출처 text, 남긴제목 text, 남긴직군 text,
  기관 text, 왜 text, 묶은날 date
)
language sql stable security definer set search_path to 'public'
as $$
  select b.id 연결한줄, b.source 연결한출처, b.title 연결한제목, b.job_group 연결한직군,
         a.id 남긴줄, a.source 남긴출처, a.title 남긴제목, a.job_group 남긴직군,
         coalesce(a.org_name, b.org_name) 기관, b.hidden_why 왜, b.hidden_on 묶은날
    from job_posts b
    left join job_posts a on a.id = b.같은공고
   where is_admin() and b.같은공고 is not null
   order by b.hidden_on desc nulls last, b.id
   limit 100 offset greatest(coalesce(p_page, 0), 0) * 100
$$;

-- 「묶지 않음」을 몇 짝 눌렀나 — 후보가 0이어도 일한 흔적이 보이게
create or replace function 묶지않음수()
returns int
language sql stable security definer set search_path to 'public'
as $$ select case when is_admin() then (select count(*)::int from 묶지않음) else 0 end $$;

revoke all on function 묶을후보(int) from public, anon;
revoke all on function 묶지않기(text, text) from public, anon;
revoke all on function 묶은것(int) from public, anon;
revoke all on function 묶지않음수() from public, anon;

grant execute on function 묶을후보(int) to authenticated;
grant execute on function 묶지않기(text, text) to authenticated;
grant execute on function 묶은것(int) to authenticated;
grant execute on function 묶지않음수() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 올린 뒤 확인한 것 (2026-10-04)
--
--   표 1 · 함수 4 생겼습니다
--   묶을후보(0) 를 postgres 로 부르면 0줄 — is_admin() 이 거짓이라 맞습니다.
--     안쪽 조인만 따로 돌려 보니 7짝이고, 그중 직군이 다른 것이 5짝입니다
--   짝 일곱 (기관 · 마감) —
--     강원특별자치도강릉의료원  10-12   CE2/WN  작업 ↔ 작업   ← 직군 같음
--     청주성모병원             마감없음 HS3/HS  작업 ↔ 작업   ← 직군 같음
--     청주성모병원             마감없음 HS3/HS  물리 ↔ 작업
--     대자인병원               마감없음 HS3/HS  (제목에 둘 다)
--     유한회사 우리메디케어     10-06   WN2/WN  작업 ↔ 물리
--     의료법인 유성의료재단      10-13   WN2/WN  작업 ↔ 물리
--     창원노인주간복지센터      10-12   WN/WN2  작업 ↔ 물리
