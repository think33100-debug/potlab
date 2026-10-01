-- ═══════════════════════════════════════════════════════════════
--  주인 넘기기 되돌리기
--  2026-10-02 준비. 2026-10-03_주인넘기기.sql 을 올린 뒤 문제가 생기면 이것을 올립니다.
-- ═══════════════════════════════════════════════════════════════
--
--  무엇을 되돌리는가
--    collect_put 의 마지막 where 한 줄을 옛 규칙으로 돌립니다.
--      바뀐 것   where j.source = p_source or j.source is null or (짝인 옛 줄)
--      돌린 것   where j.source = p_source or j.source is null
--
--  무엇을 되돌리지 **않는가** — 그리고 왜
--    이미 넘어간 주인(job_posts.source)은 되돌리지 않습니다.
--    되돌리려면 job_posts 를 고쳐야 하는데, 그 사이에 새 수집기가 고친 값
--    (공고별 주소·직군·근거)까지 같이 옛 값으로 돌아갑니다. 그게 더 나쁩니다.
--    규칙만 막으면 그다음 한 바퀴부터 더는 안 넘어갑니다.
--    주인을 진짜로 돌려야 하면 아래 ③ 을 **세중님 승인 뒤에만** 쓰십시오.
--
--  지우는 줄(DROP·DELETE·TRUNCATE)은 ①②에 **하나도 없습니다.**

begin;

-- ① 함수사본에서 옛 정의를 꺼내 그대로 올립니다
--    (사본이 있는지 먼저 보고, 없으면 멈춥니다)
do $$
declare v_def text;
begin
  select 정의 into v_def from 함수사본
   where 이름 like 'collect_put (짝만 가져가기 전%'
   order by 때 desc limit 1;
  if v_def is null then
    raise exception '함수사본에 collect_put 옛 정의가 없습니다 — 멈춥니다. 되돌릴 근거가 없습니다';
  end if;
  execute v_def;
  raise notice 'collect_put 을 사본에서 되돌렸습니다 (%자)', length(v_def);
end $$;

-- ② 권한을 다시 붙입니다 (create or replace 는 권한을 지우지 않지만, 확인 삼아)
grant execute on function collect_put(text, text, jsonb) to anon;

commit;

-- ─────────────────────────────────────────────────────────────
-- ③ 주인까지 진짜로 돌려야 할 때만 — **세중님 승인 뒤에**
--    이 블록은 주석 그대로 두십시오. 지우는 줄은 아니지만 job_posts 를 고칩니다.
--
--    begin;
--    update job_posts j
--       set source = p.옛출처, updated_at = now()
--      from 수집기짝 p
--     where j.source = p.새출처
--       and j.updated_at > '2026-10-03 00:00+09'   -- 넘긴 뒤에 바뀐 줄만
--       and exists (select 1 from 함수사본
--                    where 이름 like 'collect_put (짝만 가져가기 전%');
--    commit;
--
--    ※ 이걸 쓰면 그 줄들의 공고별 주소·직군·근거가 **옛 값으로 돌아갑니다.**
--      알리오 공고별 주소 238건을 고친 것도 되돌아갑니다. 그래서 기본은 안 씁니다.

-- ─────────────────────────────────────────────────────────────
-- 되돌린 뒤 확인할 것
--
-- 1) where 줄이 옛 꼴인지
--      select pg_get_functiondef(p.oid) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname='collect_put';
--      → 맨 아래가 `where j.source = p_source or j.source is null;` 이어야 합니다
--
-- 2) 수집기가 아직 도는지 — 한 바퀴 돌려 「담음」 숫자가 0 이 아닌지
--
-- 3) 회원 화면 공고 수 (기준 361)
--      select * from job_totals();
