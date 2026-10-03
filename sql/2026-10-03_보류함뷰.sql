-- ════════════════════════════════════════════════════════════════
--  보류함 목록이 비어 보이는 것 고치기 — admin_jobs 뷰에 세 칸 더하기
--  2026-10-03
-- ════════════════════════════════════════════════════════════════
--
--  증상
--    관리자 → 공고 → 보류함 탭이 「보류함 161」인데 목록은 「보류함이 비었어요」
--
--  원인 (근거는 응답 원문입니다)
--    화면은 한 요청에서 칸 19개를 달라고 합니다 (web/lib/admin-jobs.ts 의
--    ADMIN_LIST_COLS). 그 안에 admin_locked · admin_note 가 있는데
--    admin_jobs 뷰에 그 칸이 없습니다.
--
--      숫자 세기  select=id            → HTTP 200   (그래서 161 이 뜸)
--      목록      select=(칸 19개)      → HTTP 400
--        {"code":"42703","message":"column admin_jobs.admin_locked does not exist"}
--
--    목록 요청이 통째로 400 이 되니 data 가 null → 줄 0개 →
--    「보류함이 비었어요」. 조건(hold = true)은 숫자와 목록이 **같습니다.**
--    100줄 상한도 권한도 아닙니다 — 권한이면 배지 숫자도 0 이 됩니다.
--
--    하나씩 두드려 확인한 결과
--      admin_locked  400 · admin_note  400 · admin_at  400
--      evidence      200 · tab         200
--
--  언제부터
--    admin_locked 가 ADMIN_LIST_COLS 에 들어온 커밋 607d1a9 (09-29 08:36).
--    칸은 job_posts 에 생겼는데 뷰를 같이 안 고쳤습니다. 나흘째입니다.
--
--  모든 상태 탭이 같이 막힙니다
--    ADMIN_LIST_COLS 는 보류함·살리기·숨김·재판정이 다 같이 씁니다.
--    보류함만의 문제가 아닙니다.
--
--  ── 이 파일이 하는 일 ───────────────────────────────────────────
--    admin_jobs 뷰를 **다시 만듭니다** (create or replace view).
--    지금 뷰 정의(pg_get_viewdef 로 그대로 뜬 것)에 세 칸만 더합니다 —
--      admin_locked · admin_note · admin_at
--
--    · 표를 건드리지 않습니다. 자료가 바뀌지 않습니다
--    · DROP 없음 · DELETE 없음
--    · WHERE is_admin() 는 **그대로 둡니다** (관리자만 봅니다)
--    · 칸 순서와 이름을 하나도 바꾸지 않았습니다 — 뒤에 세 칸만 붙였습니다
--      (create or replace view 는 기존 칸을 바꾸면 거절합니다. 그래서 뒤에 붙입니다)
--
--  되돌리기
--    맨 아래 「되돌리기」 토막을 돌리면 세 칸 없던 모습으로 돌아갑니다.
--    (되돌리면 보류함 목록은 다시 비어 보입니다)
-- ════════════════════════════════════════════════════════════════

create or replace view admin_jobs as
 select id,
    source,
    org_name,
    title,
    job_group,
    employ_type,
    work_place,
    sido,
    sgg,
    org_kind,
    tab,
    headcount,
    apply_from,
    apply_to,
    posted_at,
    url,
    hidden,
    hold,
    detail,
    evidence,
    collected_at,
    updated_at,
    hidden_why,
    hidden_on,
    -- ↓ 2026-10-03 에 더한 세 칸. 화면이 달라는 것입니다
    admin_locked,
    admin_note,
    admin_at
   from job_posts
  where is_admin();

comment on view admin_jobs is
  '관리자용 공고 뷰. 2026-10-03 에 admin_locked·admin_note·admin_at 을 더했습니다 — 화면(ADMIN_LIST_COLS)이 달라는데 없어서 목록 요청이 42703 으로 통째로 실패했습니다';


-- ── 올린 뒤 이것으로 확인합니다 ─────────────────────────────────
-- 1) 세 칸이 들어갔나
--      select column_name from information_schema.columns
--      where table_name = 'admin_jobs' and column_name like 'admin%';
--      → admin_at · admin_locked · admin_note 세 줄이 나와야 합니다
--
-- 2) 관리자 화면에서 보류함 탭이 161건을 그리는지 눈으로
--      (서버 열쇠로는 is_admin() 이 false 라 0줄입니다 — 그게 맞는 모습입니다)


-- ── 되돌리기 (필요할 때만) ──────────────────────────────────────
-- create or replace view admin_jobs as
--  select id, source, org_name, title, job_group, employ_type, work_place,
--         sido, sgg, org_kind, tab, headcount, apply_from, apply_to, posted_at,
--         url, hidden, hold, detail, evidence, collected_at, updated_at,
--         hidden_why, hidden_on
--    from job_posts
--   where is_admin();
