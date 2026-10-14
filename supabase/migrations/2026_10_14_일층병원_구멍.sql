/* 「대상인데 안 긁는 1층 병원」을 세는 창구 둘 (2026-10-14 · 올렸습니다)
 *
 *   일층병원_구멍()     목록 — 기관마다 한 줄
 *   일층병원_구멍셈()    셈   — jsonb 한 줄
 *
 * 승인 요청 전문과 까닭은 `docs/승인요청_1013/①_일층병원_구멍.sql` 에 있습니다.
 * 세중님이 2026-10-14 에 승인하셨습니다 (조건 — 지우는 문장 없음 · 읽기만 ·
 * 권한 service_role 만).
 *
 * ── 왜 만들었나 ───────────────────────────────────────────────
 * 강동경희대학교병원을 **우연히** 찾았습니다 (대학병원인데 어느 출처에도
 * 공고가 0건). 같은 구멍을 사람이 알아채기를 기다리지 않고 셉니다.
 * 하루 요약 메일이 `일층병원_구멍셈()` 을 불러 한 줄로 찍습니다
 * (`tools/hold-digest.mjs` 의 `일층구멍()`).
 *
 * ── 셈 함수를 따로 둔 까닭 ───────────────────────────────────
 * 처음에는 목록 함수를 그대로 불러 JS 에서 셌는데, **PostgREST 가 100줄에서
 * 잘라서** 「대상 100곳 · 사각지대 100곳」 으로 찍혔습니다 (실제 549 · 236).
 * 쪽을 넘기는 대신 셈을 DB 에서 끝냅니다.
 *
 * ── 올린 뒤 숫자 (2026-10-14) ────────────────────────────────
 *   대상 549곳 — 사이트있음 294 · 사각지대 236 · 공고만들어옴 19
 *   사각지대 갈래별 — 공공보건의료 155 · 종합병원 57 · 대학병원 22 · 상급종합 2
 *   남은 상급종합 둘 — 강북삼성병원(Vercel 보안 검문) ·
 *                     울산대학교병원(Vaadin UIDL) · 둘 다 fetch 로 못 받습니다
 *
 * ── 주의 ─────────────────────────────────────────────────────
 * `긁는곳` 의 values 목록은 `tools/hosp/cfgs` 폴더와 **손으로 맞추는 짝**입니다
 * (수집기는 cfgs 를 읽고 이 함수는 DB `hosp_sites` 를 읽습니다).
 * 2026-10-14 에 `hosp_sites` 의 이름 285개가 `tools/hosp/hosp-sites.json` 과
 * **글자까지 같음**을 md5(`bcd461e2…`)로 확인했습니다. 한 자리로 합치는 일은
 * 「병원 목록 합치기 2단계」(수집기가 DB 를 읽게) 차례입니다. */

create or replace function public."일층병원_구멍"()
returns table (갈래 text, 종류 text, 기관 text, 시도 text, 시군구 text,
               상태 text, 출처 text, 우리직군 int)
language sql
security definer
set search_path = public
as $$
  with 대상 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t.kind, t."갈래", t.sido, t.sgg
      from org_targets t
     where t."갈래" in ('상급종합', '종합병원', '대학병원', '공공보건의료')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 else 4 end
  ), 긁는곳 as (
    select "견줄이름"(s.name) as k from hosp_sites s
    union
    -- cfgs 로 더한 곳 — collect-hosp.mjs 의 cfgs더하기() 와 짝입니다.
    -- tools/hosp/cfgs 폴더에 새 곳을 넣으면 여기에도 한 줄 더합니다.
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
      ('조선대학교병원')
    ) as c(v)
  ), 들어온곳 as (
    select "견줄이름"(j.org_name) as k,
           string_agg(distinct j.source, ',' order by j.source) as 출처,
           count(*) filter (where j.job_group in ('작업치료사', '물리치료사', '공통'))::int as 우리직군
      from job_posts j
     where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 180
     group by 1
  )
  select t."갈래", t.kind, t.name, t.sido, t.sgg,
         case when g.k is not null then '사이트있음'
              when i.k is not null then '공고만들어옴'
              else '사각지대' end,
         i."출처", coalesce(i."우리직군", 0)
    from 대상 t
    left join 긁는곳 g on g.k = t.k
    left join 들어온곳 i on i.k = t.k
   order by case when g.k is not null then 3 when i.k is not null then 2 else 1 end,
            case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                          when '공공보건의료' then 3 else 4 end,
            t.name
$$;

create or replace function public."일층병원_구멍셈"()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with g as (select * from "일층병원_구멍"())
  select jsonb_build_object(
    '대상', (select count(*) from g),
    '사각지대', (select count(*) from g where "상태" = '사각지대'),
    '사이트있음', (select count(*) from g where "상태" = '사이트있음'),
    '공고만들어옴', (select count(*) from g where "상태" = '공고만들어옴'),
    '사각_상급종합', (select coalesce(jsonb_agg("기관" order by "기관"), '[]'::jsonb)
                       from g where "상태" = '사각지대' and "갈래" = '상급종합'),
    '사각_갈래별', (select coalesce(jsonb_object_agg("갈래", n), '{}'::jsonb)
                      from (select "갈래", count(*) as n from g
                             where "상태" = '사각지대' group by 1) z)
  )
$$;

/* 지침 6-2 · 6-3 — 새 함수는 PUBLIC 에 EXECUTE 가 붙습니다. 걷습니다 */
revoke execute on function public."일층병원_구멍"()   from public, anon, authenticated;
revoke execute on function public."일층병원_구멍셈"() from public, anon, authenticated;
grant  execute on function public."일층병원_구멍"()   to service_role;
grant  execute on function public."일층병원_구멍셈"() to service_role;
