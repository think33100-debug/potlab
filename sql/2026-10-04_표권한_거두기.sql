-- ════════════════════════════════════════════════════════════════
--  표 권한 거두기 ① — **지금 있는 표**
--  2026-10-04 · ⚠ 세중님이 「올려라」 하신 뒤에만 실행합니다.
--  짝: sql/2026-10-04_표권한_기본값_막기.sql (새로 만드는 표 몫)
-- ════════════════════════════════════════════════════════════════
--
--  ── 무엇을 보고 만들었나 ─────────────────────────────────────
--  information_schema.role_table_grants 와 pg_default_acl 을 **읽기만**
--  해서 뽑았습니다. 표 내용은 한 줄도 안 읽었습니다.
--
--  ── 찾은 것 ─────────────────────────────────────────────────
--  public 스키마의 표 95개 거의 전부에 anon·authenticated 가
--  `TRUNCATE` · `TRIGGER` · `REFERENCES` · `MAINTAIN` 을 가지고 있습니다.
--
--  ★ `TRUNCATE` 는 **RLS 를 거치지 않습니다.**
--    RLS 정책이 아무리 촘촘해도 TRUNCATE 권한이 있으면 표가 통째로
--    비워집니다. job_posts(2,112줄) · posts · profiles 모두 해당됩니다.
--
--  Supabase 가 처음에 깔아 주는 `grant all on all tables … to anon,
--  authenticated` 가 그대로 남은 것으로 보입니다. 흔한 자국입니다.
--
--  ⚷ 실제로 비워지는지는 **시험하지 않았습니다** — 시험 자체가
--    파괴적이라서입니다. PostgreSQL 문서가 「TRUNCATE 는 RLS 를 적용하지
--    않는다」고 적고 있고, 권한이 있다는 것만 확인했습니다.
--
--  ── 화면이 실제로 쓰는 DELETE (2026-10-04 grep 으로 다시 확인) ──
--    web/app/admin/jobs/page.tsx:152          job_posts
--    web/app/admin/jobs/[id]/page.tsx:95      job_posts
--    web/components/admin-job-tools.tsx:47    job_posts
--    web/components/job-save.tsx:44           job_stars
--    web/components/org-save.tsx:54           org_stars
--    web/components/post-actions.tsx:54       post_likes
--    web/components/post-comments.tsx:58      comments
--  **그 다섯 표가 전부입니다.** 수집기(tools/*.mjs)는 표를 직접 지우지
--  않습니다 — rpc 로만 씁니다 (rest/v1/rpc 33곳 · job_posts 는 읽기 4곳).
--
--  ── 이 파일이 하는 일 ───────────────────────────────────────
--  ① 모든 표에서 TRUNCATE · TRIGGER · REFERENCES · MAINTAIN 거두기
--     넷 다 앱이 쓸 일이 없습니다 (표 비우기 · 트리거 만들기 ·
--     외래키 만들기 · VACUUM/REINDEX 권한)
--  ② 화면이 안 쓰는 DELETE 거두고, 쓰는 다섯만 돌려주기
--
--  **SELECT 는 손대지 않습니다.** 읽기를 건드리면 화면이 바로 깨집니다.
--  INSERT·UPDATE 도 이번에는 둡니다 — 더 봐야 합니다.
--
--  ⚠ 되돌리기는 맨 아래에 있습니다.
-- ════════════════════════════════════════════════════════════════

begin;

-- ── ① TRUNCATE · TRIGGER · REFERENCES · MAINTAIN 거두기 ─────────
-- 한 줄씩 적지 않고 스키마 전체에 겁니다. 뷰(admin_jobs · job_posts_pub)도
-- 같이 걸리는데, 뷰에는 어차피 쓸 수 없는 권한이라 괜찮습니다.
revoke truncate, trigger, references, maintain
    on all tables in schema public
  from anon, authenticated;

-- ── ② 화면이 안 쓰는 DELETE 거두기 ─────────────────────────────
revoke delete on all tables in schema public from anon, authenticated;

-- 쓰는 다섯만 돌려줍니다 (위 grep 목록 그대로)
grant delete on comments, job_stars, org_stars, post_likes to authenticated;
-- job_posts 의 DELETE 는 **관리자 화면**이 씁니다 (관리자도 authenticated 입니다)
grant delete on job_posts to authenticated;

-- ★ profiles 의 DELETE 는 돌려주지 않습니다.
--   화면이 profiles 를 .delete() 하는 곳이 없고, 탈퇴는
--   reset_my_account() 함수가 합니다. 혹시 탈퇴가 깨지면
--   `grant delete on profiles to authenticated;` 한 줄로 되돌리십시오.

commit;

-- ── 올린 뒤 확인 ───────────────────────────────────────────────
--   ① 넷이 한 줄도 없어야 합니다
--      select count(*) from information_schema.role_table_grants
--       where table_schema='public' and grantee in ('anon','authenticated')
--         and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES','MAINTAIN');
--      → 0
--
--   ② DELETE 는 다섯 표에만, authenticated 에만 있어야 합니다
--      select table_name, grantee from information_schema.role_table_grants
--       where table_schema='public' and grantee in ('anon','authenticated')
--         and privilege_type='DELETE' order by 1;
--      → comments · job_posts · job_stars · org_stars · post_likes (전부 authenticated)
--
--   ③ 화면 한 바퀴 — 비로그인 첫 화면 · /jobs · /edu · /edu/org ·
--      /youth · /volunteer · 관리자(공고·회원·접속기록·쓰레기통) ·
--      수집기 한 번
--
--   ④ 회원으로 눌러 볼 것 — 공고 찜 풀기 · 기관 찜 풀기 ·
--      글 좋아요 취소 · 내 댓글 지우기 (DELETE 를 쓰는 네 자리입니다)

-- ── 되돌리기 ───────────────────────────────────────────────────
-- 원래대로(Supabase 기본) 되돌리려면 —
--   grant all on all tables in schema public to anon, authenticated;
-- ⚠ 그러면 TRUNCATE 구멍도 같이 돌아옵니다. 급할 때만 쓰십시오.
--
-- 한 가지만 되돌리려면 그 줄만 —
--   grant delete on <표이름> to authenticated;
