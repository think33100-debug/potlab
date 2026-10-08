/* ══════════════════════════════════════════════════════════════════
   기관표 1단계 — 표를 만들고 채우기까지만
   (2026-10-08 · 세중님 승인 전 · 아직 올리지 않았습니다)

   판정 함수(공공기관인가·마감표시)와 화면은 **2단계**입니다.
   이 파일은 표 둘과 함수 셋만 만듭니다. job_list·job_one·admin_jobs·
   공공기관인가()·마감표시() 는 한 글자도 안 건드립니다.

   ── 왜 ───────────────────────────────────────────────────────────
   지금 기관 성격을 이름 낱말로 짐작합니다 (작업지침 10-3 이 금지한 것) —
     공공기관인가(p_id, p_tab, p_org_name)
       … or p_org_name ~ '의료원|…|공단|공사|국립|시립|도립|군립|…'
   공식 값은 이미 DB 에 있습니다 (hira_org.cl_cd · hira_detail.org_ty_cd ·
   public_hospitals), 그리고 **출처**도 공식 근거입니다 — 알리오·나라일터·
   클린아이·중앙치매센터는 공공기관만 모으는 곳입니다.

   ── 왜 이름이 아니라 공고마다 잇는가 ──────────────────────────────
   org_name 「한일병원」 아래 공고 4건이 있는데 심평원에 「한일병원」이 셋입니다 —
     의료법인한전의료재단 한일병원 / 종합병원 / 서울 도봉구
     한일병원 / 종합병원 / 경남 진주시
     한일병원 / 병원   / 광주 남구
   이름을 열쇠로 두면 네 건을 한 기관으로 읽습니다. 그래서 **기관번호**를
   열쇠로 두고, 공고마다 잇습니다.

   ── 알려 둔 한계 (ponytail) ──────────────────────────────────────
   심평원에 없는 기관(요양원·복지관·공단 본체 등 707 이름 · 공고 1,161건)은
   기관번호를 'NAME:<이름키>' 로 둡니다. 같은 이름 다른 지역의 복지관
   (「북구노인종합복지관」 부산·대구·광주)을 한 기관으로 봅니다. 지금 그 묶음은
   전부 2층이고 공고 29건뿐입니다. 복지시설표(welfare_facilities)에 지역이
   있으니 필요해지면 'WELFARE:<id>' 로 올립니다.
   ══════════════════════════════════════════════════════════════════ */

/* ── 0. 홈페이지 주소에서 도메인만 ── */
create or replace function "주소도메인"(u text) returns text
language sql immutable parallel safe set search_path = public as $$
  select nullif(regexp_replace(
    lower(split_part(split_part(
      regexp_replace(coalesce(u, ''), '^\s*[a-z]+://', ''), '/', 1), ':', 1)),
    '^www\.', ''), '')
$$;
comment on function "주소도메인"(text) is
  'https://www.hanilhosp.co.kr/recruit → hanilhosp.co.kr';


/* ── 1. 기관 표 ── */
create table if not exists 기관 (
  기관번호        text primary key,   -- 'HIRA:<ykiho>' · 'NAME:<이름키>'
  이름            text not null,      -- 심평원 이름이 있으면 그것, 없으면 공고의 org_name
  이름키          text,               -- hira_name_key(이름)
  ykiho           text,
  시도            text,
  시군구          text,
  종별            text,               -- hira_org.cl_cd      01 상급종합 · 11 종합병원 · 21 병원 …
  종별이름        text,
  설립구분        text,               -- hira_detail.org_ty_cd  01 국립 · 03 공립 · 04 학교법인 …
  설립구분이름    text,
  공공인가        boolean,            -- null = 미정
  공공근거        text,               -- '출처:AL2' · '공공병원표' · '설립구분:01'
  대학병원인가    boolean,
  상급종합인가    boolean,
  수시금지        boolean,            -- 공공 or 대학병원 or 상급종합 (기관 성격만)
  탭              text,               -- '공공기관·대학·종합 · 공공' 꼴 · null = 근거 없음(지금 탭 유지)
  확인한때        timestamptz,        -- 관리자가 손으로 고친 줄은 여기에 때가 찍힙니다
  확인한사람      text,
  메모            text,
  올린때          timestamptz not null default now(),
  고친때          timestamptz not null default now()
);

comment on table 기관 is
  '기관의 성격을 공식 값으로만 담습니다 (작업지침 10-3 — 이름으로 짐작하지 않습니다).
   열쇠는 기관번호입니다. 같은 이름의 다른 병원을 가르기 위해서입니다.
   수시금지 는 기관 성격만 담습니다. 최종 판정은 「수시금지 AND 우리 직군」 (작업지침 10-4).
   탭이 null 이면 근거가 없다는 뜻이고, 화면은 공고의 지금 탭을 그대로 씁니다.';
comment on column 기관.공공근거 is
  '출처:AL2(알리오) · 출처:GJ2(나라일터) · 출처:CE2(클린아이) · 출처:ND2(중앙치매센터)
   · 공공병원표(public_hospitals) · 설립구분:01 국립/03 공립/05 특수법인/13 군병원';
comment on column 기관.확인한때 is
  '관리자가 손으로 고친 표시. 이 값이 있으면 기관표채우기() 가 그 줄을 덮지 않습니다.';

alter table 기관 enable row level security;
revoke all on table 기관 from public;
grant select, insert, update on table 기관 to service_role;
grant select on table 기관 to authenticated;
drop policy if exists "기관 관리자읽기" on 기관;
create policy "기관 관리자읽기" on 기관 for select to authenticated using (is_admin());


/* ── 2. 공고에 기관번호 칸 ── */
alter table job_posts
  add column if not exists "기관번호" text,
  add column if not exists "연결상태" text,   -- 자동 · 사람 · 대기 · 없음
  add column if not exists "연결근거" text;   -- 이름 · 심평원주소 · 사이트표 · 시군구 · 시도 · 관리자

create index if not exists "job_posts_기관번호_idx" on job_posts ("기관번호");

comment on column job_posts."연결상태" is
  '자동(규칙이 한 곳으로 좁혔음) · 사람(관리자가 이었음 — 아무도 덮지 않습니다)
   · 대기(이름이 여럿인데 못 좁혔음) · 없음(심평원에 없는 기관)';


/* ── 3. 공고마다 기관을 잇기 ──────────────────────────────────────
   좁히는 차례 — 앞에서 하나로 좁혀지면 뒤는 보지 않습니다
     ① 이름키가 심평원 한 곳뿐
     ② 공고 주소의 도메인 = 심평원 홈페이지 도메인
     ③ 공고 주소의 도메인 → 병원사이트표(hosp_sites)의 이름
     ④ 공고의 시군구 (공고 자체의 값입니다 — 기관 단위 max(sido) 를 쓰지 않습니다)
     ⑤ 공고의 시도
   연결상태 = '사람' 인 공고는 건드리지 않습니다.
   updated_at 은 건드리지 않습니다 (작업지침 9절). */
create or replace function "기관잇기"()
returns table("자동" integer, "대기" integer, "없음" integer, "사람" integer)
language plpgsql security definer set search_path = public as $$
declare v_자동 int; v_대기 int; v_없음 int; v_사람 int;
begin
  if not (is_admin() or current_user = 'service_role') then
    raise exception '관리자나 서버만 부를 수 있습니다';
  end if;

  with 공고 as (
    /* org_alias 로 이름을 바꿔 봅니다. 단 **바꾼 이름이 심평원에 있을 때만** 바꿉니다.
       (2026-10-08 확인 — kind='경쟁사' 두 줄은 경쟁사 사이트 표기라 심평원에 없습니다.
        그냥 바꾸면 「의료법인 백제병원」·「순천향대학교 부속 서울병원」 공고 5건이
        붙던 기관을 잃습니다. 조건 없이 썼다가 재 보고 찾았습니다)
       kind='모기관'(13줄) 은 **쓰지 않습니다.** 산하 병원을 모기관으로 접는 짝이라
       (근로복지공단 정선병원 → 근로복지공단) 기관 연결에 쓰면 근무처를 잃습니다 */
    select j.id, j.org_name, j.source, btrim(coalesce(j.sgg, '')) as sgg,
           제목지역(j.sido, j.work_place) as 시도,
           주소도메인(j.url) as 도메인,
           hira_name_key(coalesce(a.hira_name, j.org_name)) as 이름키
      from job_posts j
      left join org_alias a
             on a.our_name = j.org_name
            and a.kind <> '모기관'
            and exists (select 1 from hira_org o
                         where o.name_key = hira_name_key(a.hira_name))
     where j.org_name is not null and btrim(j.org_name) <> ''
       and coalesce(j.연결상태, '') <> '사람'
  ), 사이트 as (
    select distinct 주소도메인(url) as 도메인, hira_name_key(name) as 이름키
      from hosp_sites where 주소도메인(url) is not null
    union
    /* org_alias 의 kind='호스트' — knuch.kr → 칠곡경북대학교병원 */
    select 주소도메인(our_name), hira_name_key(hira_name)
      from org_alias where kind = '호스트' and 주소도메인(our_name) is not null
  ), 짝 as (
    select c.id, c.이름키, o.ykiho,
      (주소도메인(o.hosp_url) is not null and c.도메인 is not null
        and (주소도메인(o.hosp_url) = c.도메인
             or c.도메인 like '%.' || 주소도메인(o.hosp_url)))            as 주소맞나,
      exists (select 1 from 사이트 s
               where s.도메인 = c.도메인 and s.이름키 = o.name_key)        as 사이트맞나,
      (c.sgg <> '' and (o.sggu_nm = c.sgg or o.sggu_nm like '%' || c.sgg)) as 시군구맞나,
      (o.sido_nm = c.시도)                                                 as 시도맞나
    from 공고 c join hira_org o on o.name_key = c.이름키
  ), 셈 as (
    select id, count(*) as 이름,
           count(*) filter (where 주소맞나)   as 주소,
           count(*) filter (where 사이트맞나) as 사이트,
           count(*) filter (where 시군구맞나) as 시군구,
           count(*) filter (where 시도맞나)   as 시도
      from 짝 group by id
  ), 고름 as (
    select z.id, z.ykiho,
      case when s.이름 = 1                                          then '이름'
           when s.주소 = 1 and z.주소맞나                            then '심평원주소'
           when s.주소 <> 1 and s.사이트 = 1 and z.사이트맞나         then '사이트표'
           when s.주소 <> 1 and s.사이트 <> 1
                and s.시군구 = 1 and z.시군구맞나                    then '시군구'
           when s.주소 <> 1 and s.사이트 <> 1 and s.시군구 <> 1
                and s.시도 = 1 and z.시도맞나                        then '시도' end as 근거
    from 짝 z join 셈 s using (id)
  ), 정할것 as (
    select c.id, g.ykiho, g.근거,
      case when g.근거 is not null then 'HIRA:' || g.ykiho
           else 'NAME:' || c.이름키 end as 기관번호,
      case when g.근거 is not null then '자동'
           when exists (select 1 from hira_org o where o.name_key = c.이름키) then '대기'
           else '없음' end as 상태
      from 공고 c left join 고름 g on g.id = c.id and g.근거 is not null
  )
  update job_posts j
     set 기관번호 = t.기관번호, 연결상태 = t.상태, 연결근거 = t.근거
    from 정할것 t
   where j.id = t.id
     and (j.기관번호, j.연결상태, j.연결근거)
         is distinct from (t.기관번호, t.상태, t.근거);

  select count(*) filter (where 연결상태 = '자동'),
         count(*) filter (where 연결상태 = '대기'),
         count(*) filter (where 연결상태 = '없음'),
         count(*) filter (where 연결상태 = '사람')
    into v_자동, v_대기, v_없음, v_사람
    from job_posts;

  return query select v_자동, v_대기, v_없음, v_사람;
end $$;

revoke all on function "기관잇기"() from public;
grant execute on function "기관잇기"() to service_role, authenticated;


/* ── 4. 관리자가 손으로 잇기 ── */
create or replace function "기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text default null)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만'; end if;
  if not exists (select 1 from job_posts where id = p_공고) then
    raise exception '그런 공고가 없습니다 — %', p_공고;
  end if;
  update job_posts
     set 기관번호 = p_기관번호, 연결상태 = '사람', 연결근거 = '관리자',
         admin_note = coalesce(admin_note || E'\n', '')
                      || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
                      || ' 기관 연결 ' || p_기관번호 || coalesce(' · ' || p_메모, '')
   where id = p_공고;
  return p_기관번호;
end $$;

revoke all on function "기관손으로잇기"(text, text, text) from public;
grant execute on function "기관손으로잇기"(text, text, text) to authenticated;


/* ── 5. 기관 표를 공식 값으로 채우기 ──────────────────────────────
   확인한때가 찍힌 줄(관리자가 고친 것)은 덮지 않습니다.
   고친때는 값이 실제로 달라질 때만 바뀝니다. */
create or replace function "기관표채우기"()
returns table("새로넣음" integer, "고침" integer, "관리자가고친것" integer)
language plpgsql security definer set search_path = public as $$
declare v_새 int := 0; v_고침 int := 0; v_사람 int;
begin
  if not (is_admin() or current_user = 'service_role') then
    raise exception '관리자나 서버만 부를 수 있습니다';
  end if;

  with 모음 as (
    select j.기관번호,
           array_agg(distinct j.source) as 출처들,
           min(j.org_name) as 공고이름,
           min(hira_name_key(j.org_name)) as 이름키,
           min(nullif(split_part(j.기관번호, 'HIRA:', 2), '')) as ykiho
      from job_posts j
     where j.기관번호 is not null
     group by j.기관번호
  ), 붙임 as (
    select m.기관번호, m.출처들, m.이름키,
           coalesce(o.yadm_nm, m.공고이름) as 이름,
           o.ykiho, o.sido_nm as 시도, o.sggu_nm as 시군구,
           o.cl_cd as 종별, o.cl_cd_nm as 종별이름,
           d.org_ty_cd as 설립구분, d.org_ty_nm as 설립구분이름,
           (select s from unnest(m.출처들) s
             where s in ('AL','AL2','GJ','GJ2','CE','CE2','ND','ND2') limit 1) as 공공출처,
           exists (select 1 from public_hospitals p
                    where hira_name_key(p.name) in (hira_name_key(o.yadm_nm), m.이름키)) as 공공병원표
      from 모음 m
      left join hira_org o on o.ykiho = m.ykiho
      left join hira_detail d on d.ykiho = m.ykiho
  ), 판정 as (
    select b.*,
      (b.공공출처 is not null or b.공공병원표
        or coalesce(b.설립구분 in ('01','03','05','13'), false)) as 공공인가,
      case when b.공공출처 is not null then '출처:' || b.공공출처
           when b.공공병원표 then '공공병원표'
           when b.설립구분 in ('01','03','05','13') then '설립구분:' || b.설립구분 end as 공공근거,
      /* 대학병원인가 (2026-10-08 세중님 확정)
           (설립구분 04 학교법인 AND 종별 01 상급종합·11 종합병원)
           OR 이름에 「대학병원」 또는 「대학교병원」이 **그대로** 들어감
         넓은 패턴은 금지입니다 — 「대학」 하나로 잡으면 「대학로정형외과」 가 걸립니다.
         이름은 심평원 공식 이름(yadm_nm)이 있으면 그것입니다 (작업지침 10-3) */
      (     (coalesce(b.설립구분 = '04', false) and coalesce(b.종별 in ('01','11'), false))
         or coalesce(b.이름 ~ '대학교?병원', false) ) as 대학병원인가,
      coalesce(b.종별 = '01', false) as 상급종합인가
      from 붙임 b
  ), 넣을것 as (
    select p.*,
      (p.공공인가 or p.대학병원인가 or p.상급종합인가) as 수시금지,
      /* 근거가 없으면 탭을 null 로 둡니다 — 화면은 공고의 지금 탭을 그대로 씁니다.
         1층 커버리지에 구멍을 내지 않기 위해서입니다 (2026-10-08 세중님 지시) */
      case when p.대학병원인가                     then '공공기관·대학·종합 · 대학'
           when p.공공인가                         then '공공기관·대학·종합 · 공공'
           when p.상급종합인가 or p.종별 = '11'    then '공공기관·대학·종합 · 종합'
           when p.종별 is not null                 then '재활·요양병원·의원'
           else null end as 탭
      from 판정 p
  ), 올림 as (
    insert into 기관 as t (기관번호, 이름, 이름키, ykiho, 시도, 시군구,
                           종별, 종별이름, 설립구분, 설립구분이름,
                           공공인가, 공공근거, 대학병원인가, 상급종합인가, 수시금지, 탭)
    select 기관번호, 이름, 이름키, ykiho, 시도, 시군구,
           종별, 종별이름, 설립구분, 설립구분이름,
           공공인가, 공공근거, 대학병원인가, 상급종합인가, 수시금지, 탭
      from 넣을것
    on conflict (기관번호) do update set
        이름 = excluded.이름, 이름키 = excluded.이름키, ykiho = excluded.ykiho,
        시도 = excluded.시도, 시군구 = excluded.시군구,
        종별 = excluded.종별, 종별이름 = excluded.종별이름,
        설립구분 = excluded.설립구분, 설립구분이름 = excluded.설립구분이름,
        공공인가 = excluded.공공인가, 공공근거 = excluded.공공근거,
        대학병원인가 = excluded.대학병원인가, 상급종합인가 = excluded.상급종합인가,
        수시금지 = excluded.수시금지, 탭 = excluded.탭,
        고친때 = now()
      where t.확인한때 is null                      -- 관리자가 고친 줄은 그대로
        and (t.이름, t.ykiho, t.종별, t.설립구분, t.공공인가, t.공공근거,
             t.대학병원인가, t.상급종합인가, t.수시금지, t.탭)
            is distinct from
            (excluded.이름, excluded.ykiho, excluded.종별, excluded.설립구분,
             excluded.공공인가, excluded.공공근거, excluded.대학병원인가,
             excluded.상급종합인가, excluded.수시금지, excluded.탭)
    returning (t.올린때 = t.고친때) as 새줄
  )
  select count(*) filter (where 새줄), count(*) filter (where not 새줄)
    into v_새, v_고침 from 올림;

  select count(*) into v_사람 from 기관 where 확인한때 is not null;
  return query select v_새, v_고침, v_사람;
end $$;

revoke all on function "기관표채우기"() from public;
grant execute on function "기관표채우기"() to service_role, authenticated;
