CREATE OR REPLACE FUNCTION public."일층병원_구멍"()
 RETURNS TABLE("갈래" text, "종류" text, "기관" text, "시도" text, "시군구" text, "상태" text, "출처" text, "우리직군" integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    /* ★ hira_org 는 **79,874줄**입니다. 전체에 "견줄이름"() 을 걸면 아침 메일이
       statement timeout 으로 ① 숫자를 통째로 못 받습니다 (2026-10-18 에 그랬습니다).
       그래서 ① **name_key 인덱스**(hira_org_name_key)를 쓰고
            ② **종합병원 갈래만** 찾습니다 — 대학병원 갈래는 `org_targets.kind` 에
               이미 심평원 종별이 들어 있습니다(한방 11·병원 5·요양 2·치과 1).
               종합병원 갈래의 kind 는 전부 '종합병원' 이라(선한병원도) 거기만
               조인이 필요합니다.
       ★★ **같은 이름 기관이 전국에 여럿입니다** — 「우리들병원」·「강남병원」·
       「온누리병원」·「참조은병원」·「대동병원」은 심평원에 여러 줄이 있고 종별이
       갈립니다. `distinct on` 으로 한 줄을 고르면 **정렬 순서에 따라 다른 종별**이
       나옵니다 (2026-10-18 에 name_key 정렬과 "견줄이름"() 정렬이 5곳에서 서로
       다른 종별을 집는 것을 봤습니다). 그래서 **종별이 갈리는 이름은 빼지
       않습니다** — 어느 기관인지 모르면 짐작하지 않고 분모에 남깁니다 (지침 10-3). */
    select o.name_key as k,
           min(o.cl_cd_nm) as cl_cd_nm,
           count(distinct o.cl_cd_nm) as 갈림
      from hira_org o
     where o.name_key in (select d.k from 대상0 d where d."갈래" = '종합병원')
     group by o.name_key
  ), 대상 as (
    select d.k, d.name, d.kind, d."갈래", d.sido, d.sgg
      from 대상0 d
      left join 공공이름 g on g.k = d.k
      left join 종별 z on z.k = d.k
     where g.k is not null          -- 공공이면 종별 무관으로 남깁니다
        or not (
             /* ★ **대학병원 갈래에서는 종별「병원」을 빼지 않습니다** (2026-10-19 세중님 결정).
                CLAUDE.md 1층 기준 3 — 「이름에 대학병원이 들어가면 종별 무관」.
                해당하는 다섯 곳 — 대구보건대학교병원 · 동아대학교대신병원 ·
                계명대학교 경주동산병원 · 강남을지대학교병원 · 건양대학교부여병원.
                대구보건대는 2026-10-18 에 설정을 넣고 공고가 1건 들어왔습니다 —
                분모에서 빼면 우리가 긁는 1층 기관을 「대상 아님」으로 만듭니다.
                한방·요양·치과·정신은 대학병원이라도 다른 과 전문이라 2층입니다.
                종합·상급은 심평원 종별을 그대로 봅니다 (선한병원 꼴 · 지침 10-3). */
             (d."갈래" = '대학병원'
              and d.kind in ('한방병원', '요양병원', '치과병원', '정신병원'))
          or (d."갈래" in ('상급종합', '종합병원') and z.갈림 = 1 and "민간2층종별"(z.cl_cd_nm))
        )
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
    /* ★ 2026-10-19 — **못 긁는 줄은 사이트로 안 봅니다.**
       주소가 없으면 수집기가 열 데가 없고, 끈 줄은 일부러 안 긁는 것입니다.
       그런 줄을 「사이트있음」 으로 세면 ① 에서 조용히 빠집니다 —
       빛고을전남대·전북대가 그렇게 빠져 있었습니다 (공고 0건).
       공고가 들어오는 곳은 아래 `들어온곳` 이 받으니 셈이 틀어지지 않습니다 */
    select s."이름열쇠" as k from hosp_sites s
     where nullif(s.url, '') is not null
       and not coalesce(s."끔", false)
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
    select j."이름열쇠" as k,
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
$function$;

/* ACL — 인수가 같아 create or replace 가 그대로 둡니다.
   전·후 {postgres=X/postgres,service_role=X/postgres} · prosecdef t */
revoke execute on function public."일층병원_구멍"() from public, anon, authenticated;
grant  execute on function public."일층병원_구멍"() to service_role;
