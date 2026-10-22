CREATE OR REPLACE FUNCTION public."네숫자"()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with v as (select * from job_posts_pub),
  구멍 as (select "일층병원_구멍셈"() as j),
  일층 as (select "견줄이름"("기관") as k from "일층병원_구멍"()),
  시각 as (
    select count(*) as 분모,
           count(*) filter (where j.apply_to_time is not null) as 찬것
      from job_posts j
      join collect_source s on s.code = j.source
     where j.id in (select id from v) and s."마감시각줌"
  ),
  /* ★ 세는 칸은 **화면이 그리는 칸**과 같아야 합니다.
     짝은 web/app/jobs/[id]/page.tsx 이고 대조표는 docs/일곱칸_대조_1014.md 입니다 */
  칸 as (
    select v.id,
           (l.k is not null) as 일층인가,
           /* 모집 인원 — 직군인원 → headcount → 뽑은값.모집인원 (page.tsx:184) */
           (v.headcount is not null
            or coalesce((p.detail->'직군인원'->>'물리치료사')::int, 0) > 0
            or coalesce((p.detail->'직군인원'->>'작업치료사')::int, 0) > 0
            or nullif(p."뽑은값"->>'모집인원', '') is not null) as 모집있나,
           /* 근무지 — 지역보임 → work_place (page.tsx:318) */
           (coalesce(v."지역보임", '') <> '' or coalesce(v.work_place, '') <> '') as 근무지있나,
           /* 지원 자격 — 뽑은값.지원자격 → detail.지원자격 (page.tsx:167).
              edu 칸은 화면이 안 봅니다 */
           (coalesce(nullif(p."뽑은값"->>'지원자격', ''), nullif(p.detail->>'지원자격', ''))
              is not null) as 자격있나,
           /* 예상 연봉 — 글자가 아니라 **금액**. web/lib/job-state.ts 의 금액꼴과 같은 꼴 */
           coalesce(nullif(p."뽑은값"->>'예상연봉', ''), nullif(p.detail->>'연봉', ''),
                    nullif(p.detail->>'예상연봉', ''))
             ~ '[0-9][0-9,.[:space:]]*(만|천|억)?[[:space:]]*원' as 연봉있나,
           /* 병원 뜯어보기는 **줄이 있으면** 그립니다 · 바쁜정도는 band 까지 있어야 합니다
              (page.tsx:399 의 {hosp && …} 와 {hosp.band && …}) */
           (h.key is not null) as 병원자료있나,
           (h.band is not null) as 바쁜정도있나,
           "org_key"(p.org_name) as 기관키
      from v
      join job_posts p on p.id = v.id
      left join 일층 l on l.k = "견줄이름"(p.org_name)
      left join org_hospital_stat h on h.key = "org_key"(p.org_name)
  )
  select jsonb_build_object(
    '잰때', now(),
    '회원화면', (select count(*) from v),
    '①놓친공고', jsonb_build_object(
        '안긁는_1층기관', (select (j->>'사각지대')::int from 구멍),
        '대상_1층기관', (select (j->>'대상')::int from 구멍),
        '공공', (select j->'공공' from 구멍),
        '민간', (select j->'민간' from 구멍),
        '보건소', (select j->'보건소' from 구멍),
        '안긁는_상급종합', (select jsonb_array_length(j->'사각_상급종합') from 구멍),
        '경쟁사기준', null),
    /* ★ 2026-10-17 — 날짜만 보던 것을 **날짜+시각(KST)** 으로 셉니다.
       화면의 isClosed(web/lib/job-state.ts:37) 와 **같은 규칙**입니다 —
       시각이 없으면 그날 종일 보입니다(= 그날 23:59 KST 까지).
       안 고치면 「회원에게는 보이는데 경보는 0」 이 됩니다 —
       2026-10-17 에 실제로 그랬습니다 (중앙보훈 09:00 마감 공고가 종일 보임). */
    '②마감인데보임', (select count(*) from v
        where v.apply_to is not null
          and ((v.apply_to + coalesce(v.apply_to_time, time '23:59'))
                 at time zone 'Asia/Seoul') < now()),
    /* ★ 2026-10-18 — **「원문 없어짐인데 보임」 과 「정찰이 한 번도 안 본 것」을 더합니다**
       (세중님 3번). 2026-10-18 에 ② 가 0 인데 **없어진 공고가 회원 화면에 9건**
       있었습니다 — ND2 3건(「게시물이 존재하지」) · 워크넷 6건(「구인정보를 확인할
       수 없습니다」). ② 는 **마감일**만 보니 그것을 못 셌고, **0 이 사실을
       가리고 있었습니다.**

       왜 「정찰이 한 번도 안 본 것」까지 세나 — 그 9건은 DB 에 아무 신호도 없었습니다.
       `gone_streak` 가 0 인 까닭은 **정찰이 그 공고를 본 적이 없어서**입니다.
       그러니 「없어짐으로 본 것」만 세면 **모르는 것을 0 으로 셉니다.**
       정찰이 안 본 수가 0 이어야 ② 를 믿을 수 있습니다 (세중님 2번). */
    '②원문없어짐인데보임', (select count(*) from v
        join job_posts g on g.id = v.id
        where coalesce(g.gone_streak, 0) >= 2),
    '②정찰이한번도안본것', (select count(*) from v
        join job_posts g on g.id = v.id
        where g.seen_on is null),
    '②정찰이사흘안에본것', (select count(*) from v
        join job_posts g on g.id = v.id
        where g.seen_on >= (now() at time zone 'Asia/Seoul')::date - 3),
    '②마감일비어보임', (select count(*) from v where v.apply_to is null),
    /* ★ 2026-10-20 — 「마감일이 비어 보이는 것」을 따로 셉니다 (세중님 1번 뿌리②).
       ② 는 apply_to 를 오늘과 견주니, **비어 있으면 0** 으로 나옵니다. 그 0 이
       마감 지난 공고 네 건을 가리고 있었습니다 (청주의료원 103일 지남 ·
       상주적십자 75일 · 인천적십자 46일 · **광주씨티 2021년 공고**).

       「확인할 것」을 따로 세는 까닭 — 「상시채용」·「채용 시 까지」처럼 **원문에
       끝 날짜가 없는** 공고는 비어 있는 것이 맞습니다. 그래서 날짜가 **오래된
       쪽**만 고릅니다. 기준은 `tools/마감비어보임.mjs` 와 같은 한 벌입니다 —
         ㉠ 올린날·담은날 가운데 이른 것이 60일 넘었다  또는
         ㉡ **올린날이 아예 없다**
       ㉡ 가 없으면 **가장 나쁜 것을 놓칩니다** — 광주씨티는 2021년 공고인데
       posted_at 이 비어 있고 우리가 10-18 에 담아서 「2일」로 보입니다.

       ★ 이 숫자는 **세기만** 합니다. 숨기는 것은 원문을 보고 마감일을 채운
         뒤 정리매시가 합니다 — 근거 없이 숨기지 않습니다 (세중님). */
    '②마감일비어보임_확인할것', (select count(*) from v
        join job_posts g on g.id = v.id
       where v.apply_to is null
         and (g.posted_at is null
              or least(coalesce(g.posted_at, date '9999-12-31'),
                       coalesce((g.db_insert_at at time zone 'Asia/Seoul')::date,
                                date '9999-12-31'))
                 <= (now() at time zone 'Asia/Seoul')::date - 60)),
    '③일곱칸', jsonb_build_object(
        '모집인원', (select round(100.0 * count(*) filter (where 모집있나) / nullif(count(*), 0), 1) from 칸),
        '접수마감', (select round(100.0 * count(*) filter (where apply_to is not null)
                                 / nullif(count(*), 0), 1) from v),
        '마감시각', (select round(100.0 * 찬것 / nullif(분모, 0), 1) from 시각),
        '마감시각_분모', (select 분모 from 시각),
        '마감시각_찬것', (select 찬것 from 시각),
        '마감시각_전체참고', (select round(100.0 * count(*) filter (where apply_to_time is not null)
                                          / nullif(count(*), 0), 1) from v),
        '근무지', (select round(100.0 * count(*) filter (where 근무지있나) / nullif(count(*), 0), 1) from 칸),
        '지원자격', (select round(100.0 * count(*) filter (where 자격있나) / nullif(count(*), 0), 1) from 칸),
        '지원자격_1층', (select round(100.0 * count(*) filter (where 자격있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '모집인원_1층', (select round(100.0 * count(*) filter (where 모집있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉', (select round(100.0 * count(*) filter (where 연봉있나) / nullif(count(*), 0), 1) from 칸),
        '예상연봉_1층', (select round(100.0 * count(*) filter (where 연봉있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉_1층분모', (select count(*) from 칸 where 일층인가),
        '바쁜정도', (select round(100.0 * count(*) filter (where 바쁜정도있나) / nullif(count(*), 0), 1) from 칸),
        '병원뜯어보기', (select round(100.0 * count(*) filter (where 병원자료있나) / nullif(count(*), 0), 1) from 칸),
        '병원뜯어보기_1층', (select round(100.0 * count(*) filter (where 병원자료있나)
                                         / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '병원자료있는기관', (select count(distinct 기관키) from 칸 where 병원자료있나),
        '회원화면기관', (select count(distinct 기관키) from 칸),
        '※세는칸', '화면이 그리는 칸과 같은 칸을 셉니다 — 대조표 docs/일곱칸_대조_1014.md (2026-10-14)'),
    '④먼저올린비율', null
  )
$function$;


