-- 목록 날짜를 마감으로 써서 숨긴 공고 풀기 — 초안 · 돌리지 않았습니다 (멘토-추가-지시문5 · 2026-11-18 일꾼 Claude)
-- ★ 운영 DB 쓰기입니다. 회원 화면에 공고가 다시 보일 수 있습니다 → 돌리는 것은 세중님(또는 세중님이 허락한 앱 Claude).
-- ★ 먼저 목록마감_숨김풀기_마른조회.sql 의 ① 을 돌려 줄 수와 공고를 눈으로 본 뒤에 돌립니다.
-- ★ 되돌림: 목록마감_숨김풀기_창원한마음_되돌림.sql (아래 ⓪ 에서 만든 보관표로 칸을 그대로 되돌립니다).
--
-- 하는 일 (① 마른 조회와 **같은 조건**의 줄만):
--   apply_to 를 비우고(마감 칸이라는 근거가 없는 목록 날짜) · deadline_src 에 원래 날짜와 까닭을 남기고 · 숨김을 풉니다.
--   apply_to 를 비우지 않고 숨김만 풀면 다음 바퀴 hide_stale_posts 가 같은 날짜로 다시 숨깁니다.
--   수집기는 apply_to 가 빈 값이면 덮지 않으므로(collect_put 가드) 비운 칸에 옛 목록 날짜가 다시 들어오지 않습니다 —
--   새 수집기(tools/hosp/목록마감.mjs)가 그 날짜를 게시일로 보내고, 상세에서 마감을 찾으면 그때 찹니다.
-- 안 하는 것: 믿는 11곳(목록 칸이 마감 칸) · 날짜 둘인 목록 줄(apply_from 참) · admin_locked · 사람이 고친 apply_to · 다른 까닭의 숨김.
-- updated_at 은 손대지 않습니다(지침 9절). 바뀐 줄은 칸기록·job_state_log 에 「누가」로 남습니다.

BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL timezone = 'Asia/Seoul';
SELECT set_config('app.누가', '목록마감 풀기 · 멘토 지시문5 (2026-11-18 초안)', true);

-- ⓪ 보관표 — 되돌림이 읽습니다. 이미 있으면 멈춥니다(두 번 돌리지 않게)
CREATE TABLE "되돌림_목록마감_1118" AS
  SELECT p.id, p.apply_to, p.apply_to_time, p.deadline_src, p.hidden, p.hidden_why, p.hidden_on, now() AS 보관때
    FROM job_posts p
   WHERE p.source = 'HS3' AND p.hidden AND coalesce(p.hidden_why, '') LIKE '%마감%'
     AND p.deadline_src = '목록' AND p.apply_from IS NULL AND p.apply_to IS NOT NULL
     AND NOT p.admin_locked AND NOT ('apply_to' = any(coalesce(p.edited_fields, '{}')))
     AND lower(substring(p.url from '^https?://([^/:]+)')) NOT IN (
           'www.bsm.or.kr', 'bsm.or.kr', 'www.cmcism.or.kr', 'cmcism.or.kr', 'www.gang-an.or.kr', 'gang-an.or.kr',
           'www.sam-jeong.or.kr', 'sam-jeong.or.kr', 'www.samsun.or.kr', 'samsun.or.kr',
           'www.maryknoll.co.kr', 'maryknoll.co.kr', 'recruit.hallym.or.kr');
REVOKE ALL ON TABLE "되돌림_목록마감_1118" FROM PUBLIC, anon, authenticated;

-- 줄 수 울타리 — 마른 조회 ① 의 줄 수와 같아야 합니다. 30 을 넘으면 멈춥니다(조건이 넓게 걸린 것)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "되돌림_목록마감_1118";
  RAISE NOTICE '보관한 줄 %', n;
  IF n > 30 THEN RAISE EXCEPTION '줄이 % — 30 을 넘습니다. 멈춥니다 (마른 조회를 다시 보십시오)', n; END IF;
END $$;

-- ① 마감 비우기 + 까닭 남기기 + 숨김 풀기 (보관표에 든 줄만)
UPDATE job_posts p
   SET apply_to = NULL,
       apply_to_time = NULL,
       deadline_src = '목록 날짜 ' || b.apply_to || ' → 마감 칸 근거 없음 · 비움 (2026-11-18 멘토 지시문5)',
       hidden = false, hidden_why = NULL, hidden_on = NULL
  FROM "되돌림_목록마감_1118" b
 WHERE p.id = b.id AND p.hidden AND NOT p.admin_locked;

-- ② 확인 — 바뀐 줄 수가 보관표 줄 수와 같아야 합니다. 다르면 ROLLBACK 하십시오
SELECT (SELECT count(*) FROM "되돌림_목록마감_1118") AS 보관,
       (SELECT count(*) FROM job_posts p JOIN "되돌림_목록마감_1118" b ON b.id = p.id
         WHERE NOT p.hidden AND p.apply_to IS NULL) AS 풀림,
       (SELECT count(*) FROM job_posts p JOIN "되돌림_목록마감_1118" b ON b.id = p.id
         WHERE NOT p.hidden AND NOT p.hold AND p.job_group IS NOT NULL) AS 회원화면후보;

-- 눈으로 본 뒤 COMMIT; (다르면 ROLLBACK;)
-- COMMIT;
