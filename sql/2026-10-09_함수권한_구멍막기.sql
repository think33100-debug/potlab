/* 비로그인에게 열려 있던 함수를 닫습니다 (2026-10-09).

   ── 어떻게 찾았나 ───────────────────────────────────────────
   직원권한을 올리다가, 진단 함수를 `revoke … from anon` 했는데도
   여전히 호출되는 것을 봤습니다. anon 은 PUBLIC 에 딸려 있어서
   **PUBLIC 에서 걷지 않으면 하나도 안 닫힙니다.**

   그래서 public 스키마 함수 249개를 전부 훑었습니다.
     anon 이 부를 수 있는 것        138
     그중 PUBLIC 을 타고 들어온 것   57   ← 누군가 anon 만 걷은 자리
     닫힌 것                       111

   ── 이미 같은 교훈이 적혀 있었습니다 ────────────────────────
   2026-09-24 마이그레이션 `org_functions_revoke_public` 머리글 —
     「앞 migration 이 anon 에서만 걷었는데 안 막혔습니다. 실제로 쏴보고
      알았습니다 … 이유: 실행 권한이 anon 이 아니라 PUBLIC 에 걸려
      있었습니다 … 그래서 PUBLIC 에서 걷고 필요한 역할에만 다시 줍니다.」

   그런데 **그 다음 날 다시 열렸습니다.** 2026-09-25 14:35 의
   `org_public_host_branch` 가 인수를 넷으로 늘렸고(`p_src` 추가),
   인수가 바뀌면 **딴 함수**라 새로 만들어집니다. 새 함수는 PUBLIC 이
   기본으로 붙습니다. 그 마이그레이션에는 revoke 가 없습니다.

     닫혀 있음   org_search · org_facets · org_detail · org_jobs · org_nearby
     열려 있음   org_public ← 인수가 바뀐 그 하나

   ── 실제로 쏴서 확인했습니다 ────────────────────────────────
   비로그인 열쇠로 org_public('서울대학교병원','서울',null,null) →
   이름·시도·시군구·주소·전화·종별·출처·tile·staffed·band·설립구분·홈페이지
   한 줄이 그대로 나왔습니다. org_nearby 는 42501 로 막혔습니다.

   ── 손대지 않는 것 ──────────────────────────────────────────
   수집기 창구 20여 개(collect_put · alive_mark · 밤정리 · 재판정 …)도
   anon 이 부를 수 있지만 **일부러 그런 것입니다.** 수집기들이
   anon 열쇠 + p_secret 로 돕니다 (tools/collect-hosp·nara·nid·worknet·
   jobflex·밤정리·재판정). 여기서 anon 을 걷으면 **수집이 멈춥니다.**
   막는 자리는 p_secret 입니다. 다음에 「정리」하려는 사람을 위해 적어 둡니다.

   순수 계산 함수(제목직군 · 지역보임 · pay_band · spec_score 등 25개쯤)와
   트리거 함수 7개도 그대로 둡니다 — 자료를 안 읽고, 트리거는 직접 못 부릅니다.

   ── 지우는 문장이 없습니다 ──────────────────────────────── */

-- ─────────────────────────────────────────────────────────────
-- ① org_public — 진짜 새던 곳. 회원만 보게 되돌립니다
--    (org_nearby 와 똑같은 모양으로 맞춥니다)
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.org_public(text, text, text, text) from public, anon;
grant  execute on function public.org_public(text, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- ② collect_gap — 수집기 대조 숫자(출처별 줄 수·갈래 분포).
--    저장소 어디에서도 안 부릅니다. 아무에게도 안 엽니다
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.collect_gap(text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- ③ lang_stats — 어학 통계. 지금은 부르는 곳이 없지만 회원 자리입니다.
--    비로그인에게는 빈 것만 나가고 있었습니다(샌 것은 아닙니다)
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.lang_stats() from public, anon;
grant  execute on function public.lang_stats() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- ④ org_total — 권한이 아니라 **고장**입니다.
--    없는 표(org_facet_mv)를 읽어서, 홈에 「기관 0곳」,
--    /orgs 회원벽에 「치료사가 일하는 곳 0 곳」 이 떠 있습니다.
--    실제로 화면에서 확인했습니다 (2026-10-09).
--    /orgs 찾기가 실제로 훑는 org_group_mv 를 셉니다 — 58,610곳.
--    이 함수는 숫자 하나만 내보내므로 비로그인에게 열어 둔 채로 둡니다
-- ─────────────────────────────────────────────────────────────
create or replace function public.org_total()
returns integer
language sql stable security definer set search_path to 'public'
as $$ select count(*)::int from org_group_mv $$;
