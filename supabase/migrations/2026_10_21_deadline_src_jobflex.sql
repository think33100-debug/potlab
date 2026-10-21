-- JobFlex 공고의 deadline_src 라벨 바로잡기 (2026-10-21 세중님 지시)
--
-- 왜 — JobFlex 는 `recruiter.co.kr` 이고 **고용24(워크넷)가 아닙니다.**
--      `collect-jobflex.mjs` 가 처음부터 'API:고용24' 로 적고 있었습니다.
--      이 라벨은 「마감일을 어디서 얻었나」의 근거로 관리자 화면에 보입니다.
--
-- 범위 — id like 'JF%' and deadline_src = 'API:고용24'
--        2026-10-21 19:30 기준 **22줄** (JF 공고 전체 233줄 · 나머지 211줄은 라벨이 빔)
--        **비JF 공고에 'API:고용24' 는 0줄**입니다 — 이 라벨은 JobFlex 만 쓰고 있었습니다
--        (워크넷 수집기는 다른 라벨을 씁니다). 그래서 이 바꾸기는 다른 출처를 안 건드립니다.
--
-- updated_at 을 **안 건드립니다** (지침 9절 — 알림·다리가 그 값을 봅니다).
-- 라벨만 바뀌고 회원이 보는 값(마감일·시각)은 그대로입니다.
-- 지금 회원 화면에 보이는 JF 공고는 0줄입니다 (전부 마감돼 내려갔습니다).
--
-- 코드 쪽은 같은 날 커밋에서 'API:JobFlex' 로 바꿨습니다 (collect-jobflex.mjs:196).
-- 2026_10_13_collect_put_deadline_src.sql 의 주석에 적힌 값 목록에
-- 'API:JobFlex' 가 하나 더 생긴 셈입니다 (옛 마이그레이션은 역사라 손대지 않습니다).
--
-- 되돌리기 —
--   update job_posts set deadline_src = 'API:고용24'
--    where id like 'JF%' and deadline_src = 'API:JobFlex';

begin;

-- 전
select 'before' as 때, deadline_src, count(*) as 줄
  from job_posts
 where id like 'JF%'
 group by deadline_src
 order by 3 desc;

update job_posts
   set deadline_src = 'API:JobFlex'
 where id like 'JF%'
   and deadline_src = 'API:고용24';

-- 후
select 'after' as 때, deadline_src, count(*) as 줄
  from job_posts
 where id like 'JF%'
 group by deadline_src
 order by 3 desc;

commit;
