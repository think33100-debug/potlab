/* ② 밤묶음 치우기 (2026-10-12)
   ★ 아직 안 올렸습니다. 세중님 승인 뒤에 올립니다.

   ███ 2026-10-13 — **막혔습니다. ②-0 을 먼저 올려야 합니다** ███

   세중님이 09:22 에 승인하시며 조건을 주셨습니다 —
   「올리기 전 부르는 곳 0 을 세 군데에서 세고, 하나라도 0 이 아니면 멈추고 보고」.

     ① pg_proc.prosrc              ★ **1곳** — public.collect_attach(3)
     ② 저장소 코드                  0곳
     ③ crontab · ~/*.sh · .github   0곳

   `collect_attach` 가 `수집묶음설정` 을 읽습니다. 그 창구는 크론의
   알리오·클린아이·나라일터 셋이 부르므로, 이 파일을 그대로 올리면
   **첨부 담기가 통째로 멈춥니다.**

   → `②-0_collect_attach_묶음떼기.sql` 을 먼저 올려 그 읽기를 떼고,
     ① 의 셈이 **1(밤묶음스위치 하나)** 이 된 것을 확인한 뒤 이 파일을 올립니다.
     (밤묶음스위치는 이 파일이 함께 치웁니다)

   ███████████████████████████████████████████████████████

   ⚠ **`drop` 이 여섯 줄 있습니다. 승인 창이 뜹니다.**
     세중님이 자리에 계실 때만 올립니다 (지침 8-7 — 창이 뜨면 뒤 일 전부가 막힙니다).
     그래서 ①③④ 와 **따로** 올립니다.

   ═══ 무엇을 치우나 ═══════════════════════════════════════════

   2026-10-11 밤에 제가 만든 것입니다. 「새로 들어오는 공고만 보류함으로」 를
   BEFORE INSERT 트리거로 했습니다.

   무슨 일이 났나 — PostgreSQL 은 `insert … on conflict do update` 에서
   BEFORE INSERT 트리거를 **먼저** 돌리고(충돌 판정 전), `excluded` 는
   **그 트리거가 고친 NEW** 입니다. `collect_put` 이 `hold = excluded.hold` 로
   쓰니 트리거가 켠 hold 가 **기존 공고에까지** 들어갔습니다.

     21:42 워크넷 234건 · 22:00 병원 31건 · 그밖 13건 = **278건**
     회원 화면 **358 → 80** (2시간 7분)

   `job_state_log` 로 278건을 정확히 되돌렸고, 함수 본문을 비워 뒀습니다.
   지침 8-14 에 적어 두었습니다. 쓸 일이 없으니 치웁니다.

   ═══ 치울 것 (여섯) ═════════════════════════════════════════

     트리거  밤묶음_넣을때   on job_posts
     함수    밤묶음표시()    ← 본문이 `begin return new; end` 뿐입니다 (비워 둔 것)
     함수    밤묶음본것(text)
     함수    밤묶음숨기기(text)
     함수    밤묶음스위치()
     표      수집묶음설정    ← 1줄 (켤까 = false · 메모에 사고 경위가 적혀 있습니다)

   ═══ **남기는 것** (세중님 결정) ═════════════════════════════

     job_posts.수집묶음         글자 칸
     job_attachments.수집묶음   글자 칸

   그날 들어온 줄을 가리키는 기록입니다. 지금 찬 줄 —
     job_posts        TESTNIGHT-hold · TESTNIGHT-hidden
                      (넷 다 시험자료 = true · hidden · **회원에게 0** ·
                       까닭에 「10/25 시험자료치우기 대상」 이 적혀 있습니다)
     job_attachments  id 1 · 2

   글자 칸 하나라 비용이 없습니다. 지우기를 원하시면 따로 올립니다.

   ═══ 되돌리려면 ═════════════════════════════════════════════

   전문은 `supabase/migrations/2026_10_11_밤묶음_만료.sql` 등에 있습니다.
   **다만 되살리지 마십시오.** 「새 공고만」 을 BEFORE INSERT 트리거로는
   못 합니다. 길은 둘입니다 (지침 8-14) —
     ① 수집기가 보내는 줄에 그 값을 직접 적는다
     ② collect_put 안 `on conflict` 의 **INSERT 쪽 VALUES 에만** 넣고
        UPDATE 쪽 `set` 에서는 그 칸을 안 건드린다
   ═══════════════════════════════════════════════════════════ */

drop trigger  if exists "밤묶음_넣을때" on public.job_posts;
drop function if exists public."밤묶음표시"();
drop function if exists public."밤묶음본것"(text);
drop function if exists public."밤묶음숨기기"(text);
drop function if exists public."밤묶음스위치"();
drop table    if exists public."수집묶음설정";

/* 올린 뒤 확인할 것 — 아래가 전부 0 이어야 합니다

   select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and t.tgname = '밤묶음_넣을때';
   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname ~ '밤묶음';
   select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = '수집묶음설정';

   그리고 수집묶음 칸이 **남아 있는지** (1 · 1 이어야 합니다)
   select count(*) from information_schema.columns
    where table_schema='public' and column_name='수집묶음' and table_name='job_posts';
   select count(*) from information_schema.columns
    where table_schema='public' and column_name='수집묶음' and table_name='job_attachments'; */
