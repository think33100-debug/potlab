/* 보건기관은 **보건소 단위**로 셉니다 (2026-10-14 세중님 확정)
 *
 * 전에는 보건지소 213곳을 따로 세어 「대상 1,022곳 · 사각지대 705곳」이었습니다.
 * 보건지소는 상위 보건소에 딸린 자리이고, 공고도 시군구청·보건소 한 곳에
 * 올라옵니다. 지소를 따로 세면 **한 시군구를 열 번 세는 셈**이라 사각지대가
 * 부풀고(지침 15절 — 아무도 안 믿는 경보), 메울 품도 열 배로 보입니다.
 *
 *   묶는 열쇠   갈래 = '보건기관' 이면 (sido, sgg) 하나
 *   대표 이름   보건의료원 → 보건소 → 그밖  (시군구의 머리)
 *   상태        그 시군구의 **어느 한 곳이라도** 사이트가 있으면 사이트있음
 *
 * 475곳(보건소 244 · 지소 213 · 의료원 16 · 그밖 2) → 시군구 246곳.
 * 나머지 갈래(상급종합·대학·종합·공공보건의료)는 전과 똑같이 기관마다 한 줄입니다.
 *
 * 인수·반환 모양 그대로입니다 (지우는 문장 없음 · 지침 6-2).
 */

create or replace function public."일층병원_구멍"()
returns table ("갈래" text, "종류" text, "기관" text, "시도" text, "시군구" text,
               "상태" text, "출처" text, "우리직군" int)
language sql
security definer
set search_path = public
as $$
  with 대상 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t.kind, t."갈래", t.sido, t.sgg
      from org_targets t
     where t."커버리지분모"
       and t."갈래" in ('공공보건의료', '보건기관', '상급종합', '대학병원', '종합병원')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 when '보건기관' then 4 else 5 end
  ), 묶음 as (
    /* 보건기관만 시군구 하나로 묶습니다 */
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
    -- cfgs 로 더한 곳 — collect-hosp.mjs 의 cfgs더하기() 와 짝입니다.
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
    /* 묶음 안의 **어느 한 곳이라도** 걸리면 그 시군구는 걸린 것입니다 */
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
$$;

create or replace function public."일층병원_구멍셈"()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with 공공이름 as (
    select distinct "견줄이름"(name) as k from org_targets
     where "갈래" in ('공공보건의료', '보건기관')
  ), g as (
    select x.*, (c.k is not null) as 공공인가
      from "일층병원_구멍"() x
      left join 공공이름 c on c.k = "견줄이름"(x."기관")
  )
  select jsonb_build_object(
    '대상', (select count(*) from g),
    '사각지대', (select count(*) from g where "상태" = '사각지대'),
    '사이트있음', (select count(*) from g where "상태" = '사이트있음'),
    '공고만들어옴', (select count(*) from g where "상태" = '공고만들어옴'),
    '공공', (select jsonb_build_object(
               '대상', count(*),
               '사각지대', count(*) filter (where "상태" = '사각지대'),
               '사이트있음', count(*) filter (where "상태" = '사이트있음'),
               '공고만들어옴', count(*) filter (where "상태" = '공고만들어옴'))
             from g where 공공인가),
    '민간', (select jsonb_build_object(
               '대상', count(*),
               '사각지대', count(*) filter (where "상태" = '사각지대'),
               '사이트있음', count(*) filter (where "상태" = '사이트있음'),
               '공고만들어옴', count(*) filter (where "상태" = '공고만들어옴'))
             from g where not 공공인가),
    /* ★ 2026-10-14 — 보건소는 **지소를 묶은 시군구 단위**입니다 */
    '보건소', (select jsonb_build_object(
                 '대상', count(*),
                 '사각지대', count(*) filter (where "상태" = '사각지대'),
                 '사이트있음', count(*) filter (where "상태" = '사이트있음'),
                 '공고만들어옴', count(*) filter (where "상태" = '공고만들어옴'),
                 '묶음', '보건지소·진료소는 상위 보건소 한 곳으로 셉니다')
               from g where "갈래" = '보건기관'),
    '사각_상급종합', (select coalesce(jsonb_agg("기관" order by "기관"), '[]'::jsonb)
                       from g where "상태" = '사각지대' and "갈래" = '상급종합'),
    '사각_갈래별', (select coalesce(jsonb_object_agg("갈래", n), '{}'::jsonb)
                      from (select "갈래", count(*) as n from g
                             where "상태" = '사각지대' group by 1) z)
  )
$$;

revoke execute on function public."일층병원_구멍"()   from public, anon, authenticated;
revoke execute on function public."일층병원_구멍셈"() from public, anon, authenticated;
grant  execute on function public."일층병원_구멍"()   to service_role;
grant  execute on function public."일층병원_구멍셈"() to service_role;
