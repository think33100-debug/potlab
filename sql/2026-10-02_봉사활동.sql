-- ════════════════════════════════════════════════════════════════
--  봉사활동 (VMS · 한국사회복지협의회)
--  2026-10-02 · 세중님 확정안대로
-- ════════════════════════════════════════════════════════════════
--
--  확정된 것
--    · 분야 탭 = 전체(기본) / 복지·보건 / 기타
--    · 분야를 모르는 것(지금 적십자 혈액원 한 곳)은 **「전체」에만** 나옵니다
--    · 시·군·구는 카드에 적기만. 거르는 칸으로 안 씁니다
--    · 시·도는 회원 지역이 기본, 전국 보기도 열어 둡니다
--    · 날짜 범위 180일
--    · 활동 종류 거르기는 1차에서 안 넣습니다
--    · centMaster · centWorker 는 **담지도 보내지도 않습니다**
--
--  이 파일이 안 하는 것
--    · DROP 없음 · DELETE 없음 · 기존 표·함수 **하나도 안 건드립니다**
--    · 토요일 이사에 걸리는 수집·주인넘기기 표와 함수에 손대지 않습니다
--    되돌리려면 아래 표 둘과 함수 셋만 지우면 끝입니다.
--
--  이름이 겹치지 않는지 먼저 봤습니다 (2026-10-02)
--    pg_tables · pg_proc · pg_views 에서 '%봉사%' '%vms%' '%volun%' → 0건
-- ════════════════════════════════════════════════════════════════

-- ── 1. 봉사활동처 ───────────────────────────────────────────────
-- 모집 쪽에 분야·시군구 칸이 없어서, 이 표를 centCode 로 이어야 압니다.
create table if not exists 봉사처 (
  기관코드   text primary key,
  이름       text not null,
  시도       text,
  분야       text,              -- centTypeName. 코드가 아니라 **이름 그대로** 담습니다
  주소       text,              -- addr (+ addrDetail). 여기서 시·군·구를 뽑습니다
  시군구     text,              -- 수집기가 주소에서 뽑아 넣습니다
  전화       text,              -- telNum — 기관 대표번호
  우편번호   text,
  세운날     date,
  updated_at timestamptz not null default now()
);
-- ⚷ centMaster(시설장)·centWorker(담당자) 칸은 **일부러 없습니다.**
--    옛 앱(gas/wage.js 12578줄)은 centWorker 를 회원 화면까지 내려보냈습니다.

comment on table 봉사처 is
  'VMS 봉사활동처. 담당자·시설장 실명은 담지 않습니다 (칸 자체가 없습니다)';

-- ── 2. 봉사 모집 ────────────────────────────────────────────────
create table if not exists 봉사모집 (
  번호       bigint primary key,          -- VMS seq
  제목       text not null,
  기관       text,                        -- centName
  모집한곳   text,                        -- reqName. 기관과 다를 때가 있습니다
  기관코드   text,                        -- centCode → 봉사처 로 이음
  시도       text,
  시군구     text,                        -- 봉사처 주소에서. **기관이 있는 곳**입니다
  장소       text,                        -- place. 자유 글이라 거르는 데 못 씁니다
  분야       text,                        -- 이은 봉사처의 centTypeName. 없으면 null
  갈래       text not null,               -- '복지·보건' | '기타' | '모름'
  활동종류   text,                        -- actTypeName
  기간       text,                        -- termTypeName (정기/비정기)
  상태       text,                        -- statusName (모집중/모집완료)
  모집인원   int,
  신청인원   int,
  청소년     boolean not null default false,
  올린날     date,                        -- regDate
  주소       text,                        -- vms.or.kr 상세 (신청은 거기서)
  db_insert_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists 봉사모집_고르기 on 봉사모집 (갈래, 시도, 상태, 올린날 desc);
create index if not exists 봉사모집_올린날 on 봉사모집 (올린날 desc);

comment on column 봉사모집.갈래 is
  '복지·보건 = 노인·장애인·아동·청소년·여성·노숙인복지시설·정신요양시설·사회복지관·보건의료·사회복지분야 법인/단체. 기타 = 그 밖. 모름 = 봉사처 표에 없는 기관';
comment on column 봉사모집.시군구 is
  '기관이 있는 시·군·구입니다. 봉사하는 곳이 아닙니다 (장소 칸은 자유 글)';

-- ── 3. 담는 함수 — 수집기만 부릅니다 ────────────────────────────
-- collect_put 과 같은 방식입니다: 출처 + 열쇠를 collect_secret 에서 맞춰 봅니다.
create or replace function 봉사담기(p_secret text, p_처 jsonb, p_모집 jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_처수 int := 0;
  v_모집수 int := 0;
begin
  if not exists (
    select 1 from collect_secret s
    where s.source = 'VMS' and s.secret = p_secret
  ) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  -- 봉사활동처 — 번호가 같으면 덮어씁니다 (지우지 않습니다)
  if p_처 is not null and jsonb_typeof(p_처) = 'array' then
    insert into 봉사처 (기관코드, 이름, 시도, 분야, 주소, 시군구, 전화, 우편번호, 세운날, updated_at)
    select x.기관코드, x.이름, x.시도, x.분야, x.주소, x.시군구, x.전화, x.우편번호,
           nullif(x.세운날, '')::date, now()
    from jsonb_to_recordset(p_처) as x(
      기관코드 text, 이름 text, 시도 text, 분야 text, 주소 text,
      시군구 text, 전화 text, 우편번호 text, 세운날 text)
    where x.기관코드 is not null and x.기관코드 <> '' and x.이름 is not null
    on conflict (기관코드) do update set
      이름 = excluded.이름, 시도 = excluded.시도, 분야 = excluded.분야,
      주소 = excluded.주소, 시군구 = excluded.시군구, 전화 = excluded.전화,
      우편번호 = excluded.우편번호, 세운날 = excluded.세운날, updated_at = now();
    v_처수 := (select count(*) from jsonb_array_elements(p_처));
  end if;

  -- 모집
  if p_모집 is not null and jsonb_typeof(p_모집) = 'array' then
    insert into 봉사모집 (번호, 제목, 기관, 모집한곳, 기관코드, 시도, 시군구, 장소,
      분야, 갈래, 활동종류, 기간, 상태, 모집인원, 신청인원, 청소년, 올린날, 주소, updated_at)
    select x.번호, x.제목, x.기관, x.모집한곳, x.기관코드, x.시도, x.시군구, x.장소,
           x.분야,
           case when x.분야 is null or x.분야 = '' then '모름'
                when x.분야 in ('노인복지시설','장애인복지시설','아동복지시설',
                  '청소년복지시설','여성복지시설','노숙인복지시설','정신요양시설',
                  '사회복지관','보건의료','사회복지분야 법인/단체') then '복지·보건'
                else '기타' end,
           x.활동종류, x.기간, x.상태, x.모집인원, x.신청인원,
           coalesce(x.청소년, false), nullif(x.올린날, '')::date, x.주소, now()
    from jsonb_to_recordset(p_모집) as x(
      번호 bigint, 제목 text, 기관 text, 모집한곳 text, 기관코드 text, 시도 text,
      시군구 text, 장소 text, 분야 text, 활동종류 text, 기간 text, 상태 text,
      모집인원 int, 신청인원 int, 청소년 boolean, 올린날 text, 주소 text)
    where x.번호 is not null and x.제목 is not null and x.제목 <> ''
    on conflict (번호) do update set
      제목 = excluded.제목, 기관 = excluded.기관, 모집한곳 = excluded.모집한곳,
      기관코드 = excluded.기관코드, 시도 = excluded.시도, 시군구 = excluded.시군구,
      장소 = excluded.장소, 분야 = excluded.분야, 갈래 = excluded.갈래,
      활동종류 = excluded.활동종류, 기간 = excluded.기간, 상태 = excluded.상태,
      모집인원 = excluded.모집인원, 신청인원 = excluded.신청인원,
      청소년 = excluded.청소년, 올린날 = excluded.올린날, 주소 = excluded.주소,
      updated_at = now();
    v_모집수 := (select count(*) from jsonb_array_elements(p_모집));
  end if;

  return jsonb_build_object('처', v_처수, '모집', v_모집수);
end $$;

-- ── 4. 읽는 함수 — 누구나 봅니다 ────────────────────────────────
-- 공공데이터이고 개인정보가 한 칸도 없습니다. /orgs 와 같은 결입니다.
--
-- ★ 쪽을 꼭 넘깁니다. PostgREST 가 집합 함수 응답을 **100줄에서 자릅니다**
--   (2026-10-02 에 판정물어보기 에서 379건을 100건으로 자른 적이 있습니다).
--   한 쪽 20건으로 두어 그 한도에 닿지 않게 합니다.
create or replace function 봉사목록(
  p_갈래 text default null,      -- null·'전체' = 다 보기 (모름까지)
  p_시도 text default null,      -- null = 전국
  p_상태 text default '모집중',
  p_page int default 0
) returns table (
  번호 bigint, 제목 text, 기관 text, 시도 text, 시군구 text, 장소 text,
  분야 text, 갈래 text, 활동종류 text, 기간 text, 상태 text,
  모집인원 int, 신청인원 int, 청소년 boolean, 올린날 date, 주소 text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.번호, v.제목, coalesce(v.모집한곳, v.기관), v.시도, v.시군구, v.장소,
         v.분야, v.갈래, v.활동종류, v.기간, v.상태,
         v.모집인원, v.신청인원, v.청소년, v.올린날, v.주소
  from 봉사모집 v
  where (p_시도 is null or v.시도 = p_시도)
    and (p_상태 is null or v.상태 = p_상태)
    /* 「전체」는 모름까지 포함합니다. 갈래를 고르면 그것만 —
       그래서 분야를 모르는 것은 「복지·보건」·「기타」에 안 섞입니다 */
    and (p_갈래 is null or p_갈래 = '전체' or v.갈래 = p_갈래)
  order by v.올린날 desc nulls last, v.번호 desc
  limit 20 offset greatest(0, coalesce(p_page, 0)) * 20
$$;

-- 탭에 붙일 건수 + 시·도 목록을 한 번에
create or replace function 봉사셈(
  p_시도 text default null,
  p_상태 text default '모집중'
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    '전체',     count(*),
    '복지·보건', count(*) filter (where 갈래 = '복지·보건'),
    '기타',     count(*) filter (where 갈래 = '기타'),
    '모름',     count(*) filter (where 갈래 = '모름'),
    '시도들', (
      select coalesce(jsonb_agg(jsonb_build_object('시도', 시도, '수', n) order by n desc), '[]'::jsonb)
      from (select 시도, count(*) as n from 봉사모집
            where (p_상태 is null or 상태 = p_상태) and 시도 is not null
            group by 시도) t
    ),
    '마지막수집', (select max(updated_at) from 봉사모집)
  )
  from 봉사모집
  where (p_시도 is null or 시도 = p_시도)
    and (p_상태 is null or 상태 = p_상태)
$$;

-- ── 5. 권한 ─────────────────────────────────────────────────────
-- 표는 직접 못 읽습니다. 함수만 씁니다 (job_posts·알림기기 와 같은 방식).
alter table 봉사처   enable row level security;
alter table 봉사모집 enable row level security;
revoke all on table 봉사처   from anon, authenticated;
revoke all on table 봉사모집 from anon, authenticated;

revoke all on function 봉사담기(text, jsonb, jsonb) from anon, authenticated, public;
grant execute on function 봉사담기(text, jsonb, jsonb) to service_role;

grant execute on function 봉사목록(text, text, text, int) to anon, authenticated;
grant execute on function 봉사셈(text, text)             to anon, authenticated;

-- ── 6. 수집기 열쇠 자리 ─────────────────────────────────────────
-- 값은 여기에 적지 않습니다. 세중님 컴퓨터의 .env.server 와 서버 .env 에만 둡니다.
-- (이 줄은 열쇠가 이미 있으면 아무것도 하지 않습니다)
insert into collect_secret (source, secret, note, made_on)
select 'VMS', encode(gen_random_bytes(32), 'base64'),
       'VMS 봉사활동 수집기 (2026-10-02)', current_date
where not exists (select 1 from collect_secret where source = 'VMS');
