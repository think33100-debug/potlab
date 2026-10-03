-- ════════════════════════════════════════════════════════════════
--  청년정책 (온통청년 · 한국고용정보원)
--  2026-10-04
-- ════════════════════════════════════════════════════════════════
--
--  ── 왜 이 표가 있나 ──────────────────────────────────────────
--  옛 앱에 「청년정책 찾기」가 있었는데 시트에 2,745건을 받아둔 채
--  멈춰 있었습니다 (채우는 트리거가 없었습니다). 지금 창구에는 3,150건이
--  있습니다 — 405건이 더 생겼습니다.
--
--  ⚷ **담당자 실명은 담지 않습니다.**
--     응답 60칸 중 `sprvsnInstPicNm`(소관기관 담당자) ·
--     `operInstPicNm`(운영기관 담당자) 는 **칸 자체를 안 만들었습니다.**
--     옛 앱 쪽 실수를 되풀이하지 않으려고 일부러 그렇게 둡니다.
--
--  ── 지역을 어떻게 가리나 (짐작하지 않습니다) ─────────────────
--  `zipCd` 는 못 씁니다. 중앙부처 정책이 **전부 11110(서울 종로)** 으로
--  옵니다 — 그대로 쓰면 전국 정책이 죄다 「서울」이 됩니다.
--  그래서 `rgtrHghrkInstCdNm`(등록 상위기관) · `sprvsnInstCdNm`(소관기관)의
--  **이름**으로 가립니다 —
--    시·도 이름으로 시작하면  → 그 시도
--    부·처·청·위원회면        → 전국   (중앙부처 정책은 실제로 전국입니다)
--    그 밖                    → 모름   (지어내지 않습니다)
--
--  ── 신청기간 ────────────────────────────────────────────────
--  `aplyPrdSeCd` 0057001 = 기간이 정해진 것 (`aplyYmd` 에 YYYYMMDD ~ YYYYMMDD)
--                0057002 · 0057003 = `aplyYmd` 가 비어 있음 → **상시**로 봅니다
--
--  이 파일이 안 하는 것
--    DROP 없음 · DELETE 없음 · 기존 표·함수 하나도 안 건드립니다.
--    되돌리려면 표 하나와 함수 셋만 지우면 끝입니다.
--
--  이름 겹침 확인 (2026-10-04) — '청년' 들어간 표·함수·뷰 0건
-- ════════════════════════════════════════════════════════════════

create table if not exists 청년정책 (
  번호       text primary key,          -- plcyNo
  정책명     text not null,
  갈래       text not null,             -- 일자리·교육·주거·금융복지·참여·모름
  대분류     text,                      -- lclsfNm 원문
  중분류     text,                      -- mclsfNm 원문
  키워드     text,
  설명       text,
  지원내용   text,
  소관기관   text,
  운영기관   text,
  시도       text not null,             -- 위 규칙으로 가린 것 · '전국' · '모름'
  상시       boolean not null default false,
  신청시작   date,
  신청끝     date,
  사업시작   date,
  사업끝     date,
  신청방법   text,
  추가자격   text,
  나이최소   int,
  나이최대   int,
  나이제한없음 boolean,
  신청주소   text,
  참고주소   text,
  조회수     int,
  updated_at timestamptz not null default now()
);
-- ⚷ 담당자 이름 칸은 **일부러 없습니다** (sprvsnInstPicNm · operInstPicNm)

comment on table 청년정책 is
  '온통청년 청년정책. 담당자 실명은 담지 않습니다 (칸 자체가 없습니다)';

create index if not exists 청년정책_갈래시도 on 청년정책 (갈래, 시도);
create index if not exists 청년정책_신청끝   on 청년정책 (신청끝);

-- ── 담는 함수 — 서버 열쇠만 ────────────────────────────────────
create or replace function 청년담기(p_secret text, p_정책 jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_수 int := 0;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = 'YTH' and s.secret = p_secret) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_정책 is null or jsonb_typeof(p_정책) <> 'array' then
    return jsonb_build_object('정책', 0);
  end if;

  insert into 청년정책 (번호, 정책명, 갈래, 대분류, 중분류, 키워드, 설명, 지원내용,
    소관기관, 운영기관, 시도, 상시, 신청시작, 신청끝, 사업시작, 사업끝,
    신청방법, 추가자격, 나이최소, 나이최대, 나이제한없음, 신청주소, 참고주소, 조회수, updated_at)
  select x.번호, x.정책명, coalesce(nullif(x.갈래,''),'모름'), x.대분류, x.중분류,
         x.키워드, x.설명, x.지원내용, x.소관기관, x.운영기관,
         coalesce(nullif(x.시도,''),'모름'), coalesce(x.상시,false),
         nullif(x.신청시작,'')::date, nullif(x.신청끝,'')::date,
         nullif(x.사업시작,'')::date, nullif(x.사업끝,'')::date,
         x.신청방법, x.추가자격, x.나이최소, x.나이최대, x.나이제한없음,
         x.신청주소, x.참고주소, x.조회수, now()
  from jsonb_to_recordset(p_정책) as x(
    번호 text, 정책명 text, 갈래 text, 대분류 text, 중분류 text, 키워드 text,
    설명 text, 지원내용 text, 소관기관 text, 운영기관 text, 시도 text,
    상시 boolean, 신청시작 text, 신청끝 text, 사업시작 text, 사업끝 text,
    신청방법 text, 추가자격 text, 나이최소 int, 나이최대 int,
    나이제한없음 boolean, 신청주소 text, 참고주소 text, 조회수 int)
  where x.번호 is not null and x.번호 <> '' and x.정책명 is not null and x.정책명 <> ''
  on conflict (번호) do update set
    정책명 = excluded.정책명, 갈래 = excluded.갈래, 대분류 = excluded.대분류,
    중분류 = excluded.중분류, 키워드 = excluded.키워드, 설명 = excluded.설명,
    지원내용 = excluded.지원내용, 소관기관 = excluded.소관기관,
    운영기관 = excluded.운영기관, 시도 = excluded.시도, 상시 = excluded.상시,
    신청시작 = excluded.신청시작, 신청끝 = excluded.신청끝,
    사업시작 = excluded.사업시작, 사업끝 = excluded.사업끝,
    신청방법 = excluded.신청방법, 추가자격 = excluded.추가자격,
    나이최소 = excluded.나이최소, 나이최대 = excluded.나이최대,
    나이제한없음 = excluded.나이제한없음, 신청주소 = excluded.신청주소,
    참고주소 = excluded.참고주소, 조회수 = excluded.조회수, updated_at = now();

  v_수 := (select count(*) from jsonb_array_elements(p_정책));
  return jsonb_build_object('정책', v_수);
end $$;

-- ── 읽는 함수 — 누구나 봅니다 ──────────────────────────────────
-- 정부가 공개한 정책 안내입니다. 개인정보가 한 칸도 없습니다.
-- ★ 한 쪽 20건. PostgREST 가 100줄에서 자르는 것을 피합니다.
create or replace function 청년목록(
  p_갈래 text default null,
  p_시도 text default null,
  p_지난것 boolean default false,   -- false = 신청 끝난 것 숨김
  p_page int default 0
) returns table (
  번호 text, 정책명 text, 갈래 text, 중분류 text, 키워드 text, 설명 text,
  지원내용 text, 소관기관 text, 시도 text, 상시 boolean,
  신청시작 date, 신청끝 date, 나이최소 int, 나이최대 int,
  나이제한없음 boolean, 신청주소 text, 참고주소 text
)
language sql
stable
security definer
set search_path = public
as $$
  select y.번호, y.정책명, y.갈래, y.중분류, y.키워드,
         left(coalesce(y.설명,''), 300), left(coalesce(y.지원내용,''), 400),
         y.소관기관, y.시도, y.상시, y.신청시작, y.신청끝,
         y.나이최소, y.나이최대, y.나이제한없음, y.신청주소, y.참고주소
  from 청년정책 y
  where (p_갈래 is null or p_갈래 = '전체' or y.갈래 = p_갈래)
    /* 시·도를 고르면 그 지역 + 전국. 전국 정책은 어디서나 신청합니다 */
    and (p_시도 is null or p_시도 = '전국' or y.시도 = p_시도 or y.시도 = '전국')
    /* 신청 끝난 것 숨기기 — 상시이거나 날짜를 모르는 것은 **남깁니다** */
    and (p_지난것 or y.상시 or y.신청끝 is null
         or y.신청끝 >= (now() at time zone 'Asia/Seoul')::date)
  order by y.상시, y.신청끝 asc nulls last, y.번호
  limit 20 offset greatest(0, coalesce(p_page, 0)) * 20;
$$;

create or replace function 청년셈(
  p_시도 text default null,
  p_지난것 boolean default false
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with 본것 as (
    select y.갈래, y.시도 from 청년정책 y
    where (p_시도 is null or p_시도 = '전국' or y.시도 = p_시도 or y.시도 = '전국')
      and (p_지난것 or y.상시 or y.신청끝 is null
           or y.신청끝 >= (now() at time zone 'Asia/Seoul')::date)
  )
  select jsonb_build_object(
    '전체', (select count(*) from 본것),
    '갈래', (select coalesce(jsonb_object_agg(갈래, n), '{}'::jsonb)
               from (select 갈래, count(*) n from 본것 group by 갈래) t),
    '시도들', (select coalesce(jsonb_agg(jsonb_build_object('시도', 시도, '수', n)
                                order by n desc), '[]'::jsonb)
                 from (select y.시도, count(*) n from 청년정책 y
                        where (p_지난것 or y.상시 or y.신청끝 is null
                               or y.신청끝 >= (now() at time zone 'Asia/Seoul')::date)
                          and y.시도 not in ('모름')
                        group by y.시도) s),
    '마지막수집', (select max(updated_at) from 청년정책));
$$;

-- ── 권한 ───────────────────────────────────────────────────────
alter table 청년정책 enable row level security;
revoke all on table 청년정책 from anon, authenticated;

revoke all on function 청년담기(text, jsonb) from anon, authenticated, public;
grant execute on function 청년담기(text, jsonb) to service_role;

grant execute on function 청년목록(text, text, boolean, int) to anon, authenticated;
grant execute on function 청년셈(text, boolean)               to anon, authenticated;

-- ── 수집기 열쇠 자리 ───────────────────────────────────────────
insert into collect_secret (source, secret, note, made_on)
select 'YTH', encode(gen_random_bytes(32), 'base64'),
       '청년정책 수집기 (2026-10-04)', current_date
where not exists (select 1 from collect_secret where source = 'YTH');
