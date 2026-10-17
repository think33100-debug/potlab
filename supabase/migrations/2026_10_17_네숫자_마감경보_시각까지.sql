/* 네숫자 ②마감인데보임 — **마감 시각까지** 셉니다 (2026-10-17 세중님 승인 ②)
 *
 * ── 왜 ───────────────────────────────────────────────
 * 2026-10-17 09:25 KST 에 마감 지난 공고가 회원 화면에 보였는데 **이 경보가 0 이었습니다.**
 * 중앙보훈병원 공고(HS146236860)는 2026-10-16 **09:00** 마감인데 이 셈은 날짜만 봐서
 * 그날 종일 「아직 안 지났다」로 셌습니다. 회원에게는 보이고 경보는 조용한 꼴입니다.
 *
 * **같은 기준이 세 자리에 있었습니다** (지침 6절 — grep 으로 전부 찾기):
 *   ⓐ 화면   web/lib/job-state.ts:37 isClosed(apply_to, today, apply_to_time)  ← 이미 시각까지 봄
 *   ⓑ 내리기 hide_stale_posts ①③                                               ← 같은 날 함께 고침
 *   ⓒ 경보   네숫자() ②마감인데보임                                             ← **이 파일**
 * ⓑ만 고치면 ⓒ가 계속 0을 말해서 다음에 또 모르게 됩니다.
 *
 * ── 무엇이 바뀌나 (두 줄) ────────────────────────────────
 *   ② 조건을 `apply_to < 오늘` → `(apply_to + coalesce(apply_to_time, 23:59)) KST < now()`
 *   `오늘` CTE 를 뺍니다 — ②만 쓰던 것이라 죽은 자리가 됩니다
 *   ①·③·④ 와 일곱칸 셈은 **글자 하나 안 바꿨습니다** (원본을 그대로 옮겼습니다).
 *
 * ── 권한 ───────────────────────────────────────────
 * `create or replace` 이고 인수가 없는 그대로입니다 → ACL 보존 (지침 6-2a).
 * 끝에 revoke/grant 를 전과 똑같이 다시 적습니다.
 * delete · drop 글자가 없습니다 (지침 8-7).
 *
 * ── 올리기 전 마른 실행 (2026-10-17 09:45 KST) ──────────────
 *   옛 셈(날짜만) **0건** → 새 셈(시각까지) **0건**
 *   잰 바탕 — job_posts_pub 중 마감일이 있는 공고 전체를 받아 JS 로 같은 규칙을 돌렸습니다
 *   → 숫자가 바뀌지 않습니다. 앞으로 안 놓치려고 고칩니다.
 *
 * ── 확인하지 못한 것 ───────────────────────────────
 * **SQL 문법은 DB 에 걸어 보지 못했습니다** (올리는 도구가 저장소에 없습니다).
 * 뜻은 JS 로 확인했고, 바뀐 두 줄 말고는 원본을 **글자 그대로** 옮겼습니다
 * (`diff` 로 확인 — 바뀐 자리 둘뿐).
 */

create or replace function public."네숫자"()
returns jsonb
language sql
security definer
set search_path = public
as $$
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
$$;

revoke execute on function public."네숫자"() from public, anon, authenticated;
grant  execute on function public."네숫자"() to service_role;
