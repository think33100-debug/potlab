-- ① 1층 분모에서 **민간 2층을 뺍니다** (2026-10-18 세중님 B 지시)
--
--   「1층 = 공공(종별 무관·보건소 포함) + 민간 상급종합·대학·종합.
--    민간 한방·요양·치과·종별「병원」 빼고, 같은 기관 여러 줄 하나로.
--    전(476/793) → 후(?/?) · 뺀 것 갈래별 수. **셈 함수만 바꾸기.**」
--
-- ── 무엇이 섞여 있었나 ──────────────────────────────────────────
-- 분모는 `org_targets.갈래` 로만 정해졌고 **심평원 종별을 안 봤습니다.**
-- 그래서 갈래가 '종합병원'·'대학병원' 인데 실제 종별이 2층인 곳이 33줄 있었습니다
-- (지침 10-3 선한병원 꼴 — 이름으로는 종합처럼 보이지만 종별이 「병원」).
--
--   병원      16곳  (종합 갈래 11 · 대학 갈래 5)
--   한방병원  11곳  (전부 대학 갈래)
--   정신병원   3곳
--   요양병원   2곳
--   치과병원   1곳
--
-- **공공은 종별 무관으로 그대로 둡니다** — 공공보건의료·보건기관 갈래에 같은
-- 이름이 있으면 공공으로 봅니다 (CLAUDE.md 「공공/민간은 갈래로 찍지 않습니다」와
-- 같은 자리). 공공 요양·정신병원도 1층입니다.
--
--   전   475 / 793
--   후   454 / 760
--
-- ── ★ 세중님께 — 대학병원 갈래 6곳이 함께 빠집니다 ──────────────
-- 지시 그대로 하면 **갈래가 '대학병원' 인데 종별이 「병원」인 6곳**도 빠집니다.
--
--   강남을지대학교병원 · 계명대학교 경주동산병원 · 대구보건대학교병원 ·
--   동아대학교대신병원 · 빛고을전남대학교병원 · 건양대학교부여병원
--
-- 그중 **빛고을전남대는 이미 긁는 곳**이고 **대구보건대·동아대대신은 오늘 설정을
-- 넣은 곳**입니다. 그리고 CLAUDE.md 1층 기준 3 은 「**이름에 대학병원이 들어가면
-- 종별 무관**」이라고 합니다.
--
-- 지시를 그대로 따랐습니다(안 A · 454/760). 뒤집으려면 아래 `2층종별()` 의
-- 조건 한 줄입니다 — 안 B 는 458/765 입니다. 빠진 6곳은 `일층병원_뺀것()` 이
-- 언제나 보여 주므로 숫자가 왜 줄었는지 가려지지 않습니다.
--
-- ── 「같은 기관 여러 줄 하나로」 ───────────────────────────────
-- **이미 되어 있습니다** — `distinct on ("견줄이름"(name))` 이 분모를 만들 때
-- 한 줄로 줄입니다. 793 은 묶은 뒤 숫자입니다. 보건기관은 그 위에 시군구로
-- 한 번 더 묶습니다 (보건지소 → 상위 보건소).

/* 2층 종별 판정 — **한 자리**에 둡니다 (지침 6절).
   공공이면 종별을 안 봅니다. 종별을 모르면(심평원에 없음) 빼지 않습니다 —
   짐작하지 않고 안전한 쪽으로 둡니다 (지침 10-3). */
create or replace function public."민간2층종별"(p_종별 text) returns boolean
language sql immutable as $fn$
  select coalesce(p_종별, '') in ('한방병원', '요양병원', '치과병원', '병원', '정신병원')
  /* 안 B 로 뒤집으려면 이 함수 대신 호출부에서 갈래를 함께 봐야 합니다 —
     일층병원_구멍() 의 `민간2층인가` 자리에 주석으로 적어 두었습니다 */
$fn$;
revoke execute on function public."민간2층종별"(text) from public, anon, authenticated;
grant  execute on function public."민간2층종별"(text) to service_role;

create or replace function public."일층병원_구멍"()
returns table("갈래" text, "종류" text, "기관" text, "시도" text, "시군구" text,
              "상태" text, "출처" text, "우리직군" integer)
language sql security definer set search_path = public as $fn$
  with 대상0 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t.kind, t."갈래", t.sido, t.sgg
      from org_targets t
     where t."커버리지분모"
       and t."갈래" in ('공공보건의료', '보건기관', '상급종합', '대학병원', '종합병원')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 when '보건기관' then 4 else 5 end
  ), 공공이름 as (
    /* 공공은 종별 무관으로 1층입니다 — 갈래로 찍지 않고 **같은 이름이 공공
       갈래에 있는지**로 가립니다 (CLAUDE.md 1층 기준) */
    select distinct "견줄이름"(t.name) as k from org_targets t
     where t."커버리지분모" and t."갈래" in ('공공보건의료', '보건기관')
  ), 종별 as (
    select distinct on ("견줄이름"(o.yadm_nm)) "견줄이름"(o.yadm_nm) as k, o.cl_cd_nm
      from hira_org o order by "견줄이름"(o.yadm_nm), o.yadm_nm
  ), 대상 as (
    select d.k, d.name, d.kind, d."갈래", d.sido, d.sgg
      from 대상0 d
      left join 공공이름 g on g.k = d.k
      left join 종별 z on z.k = d.k
     /* 민간2층인가 — 안 B 로 뒤집으려면 아래 한 줄을
          and not (… and "민간2층종별"(z.cl_cd_nm) and not (d."갈래" = '대학병원' and z.cl_cd_nm = '병원'))
        로 바꿉니다 (CLAUDE.md 기준 3 — 이름에 대학병원이 들어가면 종별 무관) */
     where not (d."갈래" in ('상급종합', '대학병원', '종합병원')
                and g.k is null
                and "민간2층종별"(z.cl_cd_nm))
  ), 묶음 as (
    /* 보건기관만 시군구 하나로 묶습니다 — 보건지소는 상위 보건소에 딸립니다 */
    select d.*,
           case when d."갈래" = '보건기관'
                then '보건기관|' || coalesce(d.sido, '') || '|' || coalesce(d.sgg, '')
                else d.k end as g
      from 대상 d
  ), 대표 as (
    select distinct on (m.g)
           m.g, m.name, m.kind, m."갈래", m.sido, m.sgg
      from 묶음 m
     order by m.g,
              case when m.name ~ '보건의료원' then 1
                   when m.name ~ '보건소' then 2 else 3 end,
              m.name
  ), 긁는곳 as (
    select "견줄이름"(s.name) as k from hosp_sites s
    union
    select "견줄이름"(v) from (values
      ('강동경희대학교병원'),
      ('연세대학교의과대학세브란스병원'),
      ('연세대학교의과대학 강남세브란스병원'),
      ('고려대학교의과대학부속구로병원'),
      ('고려대학교의과대학부속안산병원'),
      ('학교법인 고려중앙학원 고려대학교의과대학부속병원(안암병원)'),
      ('재단법인아산사회복지재단 서울아산병원'),
      ('학교법인성균관대학삼성창원병원'),
      ('한양대학교병원'),
      ('양산부산대학교병원'),
      ('조선대학교병원'),
      ('계명대학교 경주동산병원'),
      ('차의과학대학교분당차병원'),
      ('차의과학대학교부속구미차병원'),
      ('의료법인성광의료재단일산차병원')
    ) as c(v)
  ), 들어온곳 as (
    select "견줄이름"(j.org_name) as k,
           string_agg(distinct j.source, ',' order by j.source) as 출처,
           count(*) filter (where j.job_group in ('작업치료사', '물리치료사', '공통'))::int as 우리직군
      from job_posts j
     where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 180
     group by 1
  ), 묶은상태 as (
    select m.g,
           bool_or(gg.k is not null) as 사이트,
           bool_or(ii.k is not null) as 들어옴,
           string_agg(distinct ii."출처", ',') as 출처,
           coalesce(sum(ii."우리직군"), 0)::int as 우리직군
      from 묶음 m
      left join 긁는곳 gg on gg.k = m.k
      left join 들어온곳 ii on ii.k = m.k
     group by m.g
  )
  select r."갈래", r.kind, r.name, r.sido, r.sgg,
         case when s.사이트 then '사이트있음'
              when s.들어옴 then '공고만들어옴'
              else '사각지대' end,
         s."출처", s."우리직군"
    from 대표 r
    join 묶은상태 s on s.g = r.g
   order by case when s.사이트 then 3 when s.들어옴 then 2 else 1 end,
            case r."갈래" when '상급종합' then 1 when '대학병원' then 2
                          when '공공보건의료' then 3 when '보건기관' then 4 else 5 end,
            r.name
$fn$;

/* ACL 은 `create or replace` 라 그대로입니다 —
   전 {postgres=X/postgres,service_role=X/postgres} (올리기 전에 찍었습니다 · 6-2a).
   인수와 반환 타입을 **하나도 바꾸지 않았으므로** 새 함수가 아닙니다 (6-2). */


/* ── 뺀 것을 언제나 볼 수 있게 ──────────────────────────────────
 * 분모에서 빠진 줄을 숨기지 않습니다. 숫자가 줄었을 때 「왜 줄었나」를
 * 물을 수 있어야 합니다 (CLAUDE.md — 커버리지는 느낌이 아니라 숫자로). */
create or replace function public."일층병원_뺀것"()
returns table("갈래" text, "종별" text, "기관" text, "긁는곳인가" boolean, "최근180일공고" integer)
language sql security definer set search_path = public as $fn$
  with 대상0 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t."갈래"
      from org_targets t
     where t."커버리지분모"
       and t."갈래" in ('공공보건의료', '보건기관', '상급종합', '대학병원', '종합병원')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 when '보건기관' then 4 else 5 end
  ), 공공이름 as (
    select distinct "견줄이름"(t.name) as k from org_targets t
     where t."커버리지분모" and t."갈래" in ('공공보건의료', '보건기관')
  ), 종별 as (
    select distinct on ("견줄이름"(o.yadm_nm)) "견줄이름"(o.yadm_nm) as k, o.cl_cd_nm
      from hira_org o order by "견줄이름"(o.yadm_nm), o.yadm_nm
  ), 긁는곳 as (
    select "견줄이름"(s.name) as k from hosp_sites s
  ), 들어온곳 as (
    select "견줄이름"(j.org_name) as k, count(*)::int as 공고
      from job_posts j
     where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 180
     group by 1
  )
  select d."갈래", z.cl_cd_nm, d.name,
         (gg.k is not null), coalesce(ii.공고, 0)
    from 대상0 d
    left join 공공이름 g on g.k = d.k
    left join 종별 z on z.k = d.k
    left join 긁는곳 gg on gg.k = d.k
    left join 들어온곳 ii on ii.k = d.k
   where d."갈래" in ('상급종합', '대학병원', '종합병원')
     and g.k is null
     and "민간2층종별"(z.cl_cd_nm)
   order by z.cl_cd_nm, d.name
$fn$;
revoke execute on function public."일층병원_뺀것"() from public, anon, authenticated;
grant  execute on function public."일층병원_뺀것"() to service_role;

comment on function public."일층병원_뺀것"() is
  '1층 분모에서 민간 2층이라 뺀 줄 (종별 한방·요양·치과·병원·정신). 숫자가 왜 줄었나를 물을 수 있게 (2026-10-18)';
