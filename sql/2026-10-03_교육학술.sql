-- ════════════════════════════════════════════════════════════════
--  교육·학술 (학회 교육과정 · 학술대회)
--  2026-10-03
-- ════════════════════════════════════════════════════════════════
--
--  왜 이 표가 있나
--    스펙쌓기의 「이수 교육」 칸(web/lib/signup-fields.ts 의 COURSES_OT ·
--    COURSES_PT)은 학회 이름과 과정 이름을 고르게 되어 있습니다.
--    고를 수는 있는데 **언제 어디서 열리는지는 어디에도 없었습니다.**
--    그걸 모으는 표입니다.
--
--  어디서 긁나 — robots.txt 를 먼저 보고 **허락된 곳만** 긁습니다
--    ○ 대한연하재활학회  dysphagia.co.kr   robots.txt 없음
--    ○ 한국운전재활학회  ksdr.or.kr        robots.txt 없음
--    ○ 대한연하장애학회  kdys.or.kr        robots.txt 「allow: /」 (EUC-KR)
--    △ 대한인지재활학회  cogsociety.org    robots.txt 가 /lect/ · /notice/ ·
--      /board01/ 을 다 막습니다. 허락된 첫 화면(`/`)에 교육 공지 제목과
--      날짜가 실려 있어 **그것만** 담습니다. 상세는 학회 화면으로 보냅니다
--    ✗ 한국작업치료사협회 kaot.org         robots.txt 「Disallow: /」 전면
--      → 긁지 않습니다. 세중님 결정 전까지 링크도 안 겁니다
--
--  이 파일이 안 하는 것
--    · DROP 없음 · DELETE 없음 · 기존 표·함수 하나도 안 건드립니다
--    되돌리려면 아래 표 하나와 함수 셋만 지우면 끝입니다.
--
--  이름이 겹치지 않는지 먼저 봤습니다 (2026-10-03)
--    sql/ · web/lib · web/app 에서 '교육목록' '교육담기' '교육셈' → 0건
-- ════════════════════════════════════════════════════════════════

-- ── 1. 교육 ─────────────────────────────────────────────────────
create table if not exists 교육 (
  -- 출처마다 번호 꼴이 달라서(wr_id · idx · num · 날짜+제목) 글자로 둡니다.
  -- '연하재활:308' 처럼 출처를 앞에 붙여 서로 안 부딪히게 합니다.
  번호       text primary key,
  출처       text not null,              -- 학회 이름 **그대로** (COURSES_* 의 n 과 맞춥니다)
  직군       text not null,              -- '작업치료사' | '물리치료사' | '공통'
  갈래       text not null,              -- '교육' | '학술대회' | '공지'
  제목       text not null,
  시작       date,                       -- 교육일시 앞쪽. 못 읽으면 null
  끝         date,
  장소       text,
  모집인원   text,                       -- 「100명 (선착순)」 같은 자유 글이라 글자로
  상태       text,                       -- '접수중' | '접수마감' | '예정' | '모름'
  올린날     date,
  링크       text not null,              -- 학회 원문. 회원은 여기로 갑니다
  원문       text,                       -- 긁은 줄 그대로 (판정이 틀렸을 때 보려고)
  updated_at timestamptz not null default now()
);

comment on table 교육 is
  '학회 교육과정·학술대회. robots.txt 가 허락한 곳만 긁습니다. 개인정보 칸 없음';

create index if not exists 교육_시작 on 교육 (시작 desc nulls last);
create index if not exists 교육_출처 on 교육 (출처);

-- ── 2. 담는 함수 — 서버 열쇠만 ──────────────────────────────────
create or replace function 교육담기(p_secret text, p_교육 jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_수 int := 0;
begin
  if not exists (
    select 1 from collect_secret s
    where s.source = 'EDU' and s.secret = p_secret
  ) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  if p_교육 is null or jsonb_typeof(p_교육) <> 'array' then
    return jsonb_build_object('교육', 0);
  end if;

  insert into 교육 (번호, 출처, 직군, 갈래, 제목, 시작, 끝, 장소,
                    모집인원, 상태, 올린날, 링크, 원문, updated_at)
  select x.번호, x.출처,
         coalesce(nullif(x.직군, ''), '공통'),
         coalesce(nullif(x.갈래, ''), '공지'),
         x.제목,
         nullif(x.시작, '')::date, nullif(x.끝, '')::date,
         x.장소, x.모집인원,
         coalesce(nullif(x.상태, ''), '모름'),
         nullif(x.올린날, '')::date,
         x.링크, left(coalesce(x.원문, ''), 1000), now()
  from jsonb_to_recordset(p_교육) as x(
    번호 text, 출처 text, 직군 text, 갈래 text, 제목 text,
    시작 text, 끝 text, 장소 text, 모집인원 text, 상태 text,
    올린날 text, 링크 text, 원문 text)
  where x.번호 is not null and x.번호 <> ''
    and x.제목 is not null and x.제목 <> ''
    and x.링크 is not null and x.링크 <> ''
  on conflict (번호) do update set
    출처 = excluded.출처, 직군 = excluded.직군, 갈래 = excluded.갈래,
    제목 = excluded.제목, 시작 = excluded.시작, 끝 = excluded.끝,
    장소 = excluded.장소, 모집인원 = excluded.모집인원,
    상태 = excluded.상태, 올린날 = excluded.올린날,
    링크 = excluded.링크, 원문 = excluded.원문, updated_at = now();

  v_수 := (select count(*) from jsonb_array_elements(p_교육));
  return jsonb_build_object('교육', v_수);
end $$;

-- ── 3. 읽는 함수 — 누구나 봅니다 ────────────────────────────────
-- 학회가 공개한 교육 안내입니다. 개인정보가 한 칸도 없습니다.
--
-- ★ 쪽을 꼭 넘깁니다. PostgREST 가 집합 함수 응답을 100줄에서 자릅니다.
--   한 쪽 20건으로 둡니다 (봉사목록 과 같게).
create or replace function 교육목록(
  p_직군 text default null,      -- null·'전체' = 다 보기 ('공통' 포함)
  p_출처 text default null,      -- null = 모든 학회
  p_지난것 boolean default false, -- false = 끝난 교육은 숨깁니다
  p_page int default 0
) returns table (
  번호 text, 출처 text, 직군 text, 갈래 text, 제목 text,
  시작 date, 끝 date, 장소 text, 모집인원 text, 상태 text,
  올린날 date, 링크 text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.번호, e.출처, e.직군, e.갈래, e.제목, e.시작, e.끝,
         e.장소, e.모집인원, e.상태, e.올린날, e.링크
  from 교육 e
  where (p_출처 is null or e.출처 = p_출처)
    /* 직군을 고르면 그 직군 + 공통. 「전체」면 다 봅니다 */
    and (p_직군 is null or p_직군 = '전체'
         or e.직군 = p_직군 or e.직군 = '공통')
    /* 끝난 것 숨기기 — 날짜를 못 읽은 것(null)은 **남깁니다.**
       날짜가 없다고 지난 교육으로 몰면 멀쩡한 안내가 사라집니다 */
    and (p_지난것
         or e.끝 is null
         or e.끝 >= (now() at time zone 'Asia/Seoul')::date)
  /* 가까운 교육부터. 날짜를 못 읽은 것은 올린 날로 뒤에 붙입니다 */
  order by e.시작 asc nulls last, e.올린날 desc nulls last, e.번호
  limit 20 offset greatest(0, coalesce(p_page, 0)) * 20;
$$;

create or replace function 교육셈(
  p_직군 text default null,
  p_출처 text default null,
  p_지난것 boolean default false
) returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from 교육 e
  where (p_출처 is null or e.출처 = p_출처)
    and (p_직군 is null or p_직군 = '전체'
         or e.직군 = p_직군 or e.직군 = '공통')
    and (p_지난것
         or e.끝 is null
         or e.끝 >= (now() at time zone 'Asia/Seoul')::date);
$$;

-- ── 4. 권한 ─────────────────────────────────────────────────────
alter table 교육 enable row level security;
revoke all on table 교육 from anon, authenticated;

revoke all on function 교육담기(text, jsonb) from anon, authenticated, public;
grant execute on function 교육담기(text, jsonb) to service_role;

grant execute on function 교육목록(text, text, boolean, int) to anon, authenticated;
grant execute on function 교육셈(text, text, boolean)        to anon, authenticated;

-- ── 5. 수집기 열쇠 자리 ─────────────────────────────────────────
-- 값은 여기에 적지 않습니다. 세중님 컴퓨터의 .env.server 와 서버 .env 에만 둡니다.
insert into collect_secret (source, secret, note, made_on)
select 'EDU', encode(gen_random_bytes(32), 'base64'),
       '교육·학술 수집기 (2026-10-03)', current_date
where not exists (select 1 from collect_secret where source = 'EDU');
