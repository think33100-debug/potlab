-- 되돌림 — 목록마감_숨김풀기_창원한마음.sql 을 돌린 뒤 되돌릴 때만 · 초안 · 돌리지 않았습니다 (2026-11-18 일꾼 Claude)
-- ★ 운영 DB 쓰기입니다. 돌리는 것은 세중님.
-- 보관표 "되돌림_목록마감_1118" 에 적힌 옛 값(apply_to · apply_to_time · deadline_src · hidden · hidden_why · hidden_on)으로
-- 그 줄들만 그대로 되돌립니다. 그 사이 수집기가 상세에서 새 마감을 찾아 넣은 줄도 옛 값으로 돌아갑니다 — 아래 ① 에서 먼저 봅니다.
-- 보관표는 남겨 둡니다 (치우기는 세중님 · 지침 8-7 때문에 이 파일에 지우는 줄을 넣지 않습니다).

BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL timezone = 'Asia/Seoul';
SELECT set_config('app.누가', '목록마감 풀기 되돌림 (2026-11-18 초안)', true);

-- ① 풀고 나서 바뀐 줄 — 수집기가 새 마감을 넣었거나 사람이 고친 줄 (되돌리면 그 값이 사라집니다)
SELECT p.id, p.apply_to AS 지금마감, p.deadline_src AS 지금출처, b.apply_to AS 옛마감, p.hidden AS 지금숨김
  FROM job_posts p JOIN "되돌림_목록마감_1118" b ON b.id = p.id
 WHERE p.apply_to IS NOT NULL OR p.hidden OR p.admin_locked;

-- ② 되돌리기 (admin_locked 줄은 건드리지 않습니다)
UPDATE job_posts p
   SET apply_to = b.apply_to, apply_to_time = b.apply_to_time, deadline_src = b.deadline_src,
       hidden = b.hidden, hidden_why = b.hidden_why, hidden_on = b.hidden_on
  FROM "되돌림_목록마감_1118" b
 WHERE p.id = b.id AND NOT p.admin_locked;

-- ③ 확인 — 보관표와 다른 줄이 0 이어야 합니다
SELECT count(*) AS 아직다른줄
  FROM job_posts p JOIN "되돌림_목록마감_1118" b ON b.id = p.id
 WHERE NOT p.admin_locked
   AND (p.apply_to IS DISTINCT FROM b.apply_to OR p.hidden IS DISTINCT FROM b.hidden
        OR p.hidden_why IS DISTINCT FROM b.hidden_why OR p.deadline_src IS DISTINCT FROM b.deadline_src);

-- 눈으로 본 뒤 COMMIT; (다르면 ROLLBACK;)
-- COMMIT;
