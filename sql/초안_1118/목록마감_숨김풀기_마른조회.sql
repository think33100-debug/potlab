-- 목록 날짜를 마감으로 써서 숨긴 공고 — 마른 조회 (멘토-추가-지시문5 「안동형 숨김」) · 2026-11-18 일꾼 Claude 초안
-- ★ 읽기만 합니다. select 만 있고 쓰기·권한 바꾸기가 없습니다. 맨 끝은 ROLLBACK 입니다. 돌리는 것은 세중님(또는 앱 Claude).
--
-- 규칙 (tools/hosp/목록마감.mjs · 커밋 같은 가지):
--   목록 날짜 하나를 마감으로 보는 설정(single: deadline) 12곳 가운데, 설정 메모가 「마감 칸」이라고 밝힌 11곳만
--   그 날짜를 마감으로 둡니다. 뺀 곳은 창원한마음병원(recruit.hanheart.co.kr) 하나입니다.
-- 「이 규칙이 풀 공고」 = 아래 ① 의 조건을 모두 갖춘 것:
--   source = 'HS3' (지금 도는 병원 홈페이지 수집기) · 숨김 · 까닭에 「마감」 · deadline_src = '목록'
--   · apply_from 이 빔 (날짜가 둘인 목록 줄은 apply_from 이 찹니다 — 날짜 하나 길만 고릅니다)
--   · 주소 호스트가 믿는 11곳의 호스트가 아님 · admin_locked 아님 · apply_to 를 사람이 고치지 않음
-- 칸 이름은 저장소 sql/기준구조_1030.sql 의 job_posts 그대로입니다 (10/30 뒤에 바뀌었으면 오류가 납니다).

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL timezone = 'Asia/Seoul';

-- 믿는 11곳의 호스트 (tools/hosp/목록마감.mjs 의 목록마감믿는곳 과 짝 · 설정 base/url 의 호스트)
--   bsm.or.kr(부산성모) · cmcism.or.kr(인천성모) · gang-an.or.kr(좋은강안) · sam-jeong.or.kr(좋은삼정)
--   samsun.or.kr(좋은삼선) · maryknoll.co.kr(메리놀) · recruit.hallym.or.kr(한림 다섯 곳)

-- ① 이 규칙이 풀 공고 — 한 줄씩 (풀기 초안 목록마감_숨김풀기_창원한마음.sql 이 고르는 줄과 같은 조건)
with 대상 as (
  select p.*, lower(substring(p.url from '^https?://([^/:]+)')) as 호스트
    from job_posts p
   where p.source = 'HS3' and p.hidden and coalesce(p.hidden_why, '') like '%마감%'
     and p.deadline_src = '목록' and p.apply_from is null and p.apply_to is not null
     and not p.admin_locked and not ('apply_to' = any(coalesce(p.edited_fields, '{}')))
)
select id as 공고id, org_name as 기관, left(title, 70) as 제목, job_group as 직군, hold as 보류,
       posted_at as 게시일, apply_to as 마감_목록날짜, deadline_src, hidden_why as 까닭, hidden_on as 숨긴날,
       left(coalesce(evidence->>'접수문장', ''), 100) as 접수문장, 호스트, url as 원문
  from 대상
 where 호스트 not in ('www.bsm.or.kr', 'bsm.or.kr', 'www.cmcism.or.kr', 'cmcism.or.kr', 'www.gang-an.or.kr', 'gang-an.or.kr',
                      'www.sam-jeong.or.kr', 'sam-jeong.or.kr', 'www.samsun.or.kr', 'samsun.or.kr',
                      'www.maryknoll.co.kr', 'maryknoll.co.kr', 'recruit.hallym.or.kr')
 order by (job_group in ('물리치료사', '작업치료사', '공통')) desc nulls last, hidden_on desc nulls last;

-- ② 같은 조건의 수 — 호스트별 (분모를 함께 봅니다)
select lower(substring(url from '^https?://([^/:]+)')) as 호스트, count(*) as 목록날짜로_마감숨김,
       count(*) filter (where job_group in ('물리치료사', '작업치료사', '공통')) as 우리직군
  from job_posts
 where source = 'HS3' and hidden and coalesce(hidden_why, '') like '%마감%'
   and deadline_src = '목록' and apply_from is null and apply_to is not null
 group by 1 order by 2 desc;
-- ↑ 믿는 11곳 호스트도 함께 나옵니다 — 그 곳들은 이번 규칙으로 안 풉니다(목록 칸이 마감 칸이라 맞게 숨긴 것).

-- ③ 확인만 (이번 규칙으로는 안 풂) — 믿는 곳인데 원문 말에 수시말이 있는 것 (동탄 263·264 · 인천성모 소아작업치료 같은 꼴)
select id as 공고id, org_name as 기관, left(title, 60) as 제목, job_group as 직군, apply_to as 마감, hidden_on as 숨긴날,
       left(coalesce(evidence->>'접수문장', ''), 100) as 접수문장, url as 원문
  from job_posts
 where source = 'HS3' and hidden and coalesce(hidden_why, '') like '%마감%'
   and deadline_src = '목록' and apply_from is null
   and (title ~ '(채용\s*시\s*까지|채용\s*완료\s*시|충원\s*시|상시|수시|진행\s*중)'
        or coalesce(evidence->>'접수문장', '') ~ '(채용\s*시\s*까지|채용\s*완료\s*시|충원\s*시|상시|수시|진행\s*중)')
 order by hidden_on desc nulls last;

-- ④ 안동 248·249 — 마감을 어디서 읽었나 (지금 코드로 11/6 저장본 목록·상세를 돌리면 마감이 안 나옵니다 — 이 줄의 deadline_src 가 답)
select id as 공고id, source as 출처, left(title, 40) as 제목, posted_at as 게시일, apply_from as 시작, apply_to as 마감,
       apply_to_time as 마감시각, deadline_src, left(coalesce(evidence->>'날짜출처', ''), 40) as 날짜출처,
       left(coalesce(evidence->>'접수문장', ''), 80) as 접수문장, hidden, hidden_why, hidden_on, admin_locked, edited_fields
  from job_posts
 where url in ('https://www.andonghospital.co.kr/recruit/job/view.do?no=248',
               'https://www.andonghospital.co.kr/recruit/job/view.do?no=249');

ROLLBACK;
