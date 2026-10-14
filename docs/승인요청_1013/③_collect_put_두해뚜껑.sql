/* ③ 두 해 뚜껑을 **창구 한 곳**에 (2026-10-14)

   ★ 아직 안 올렸습니다. 세중님 승인 뒤에 올립니다.
   ★ 지우는 문장이 없습니다. 승인 창이 안 뜹니다.
   ★ 인수를 안 바꿉니다 — (p_secret text, p_source text, p_rows jsonb).
     그래서 ACL 이 유지됩니다 (지침 6-2).

   ═══ 왜 한 자리가 더 필요한가 ═══════════════════════════════

   세중님 지시 — 「2099 두 해 뚜껑이 목록 쪽 날짜에는 안 걸리는 것:
   목록·상세가 같은 함수 한 자리를 쓰게(기준 한 곳)」.

   그대로 했습니다 — `hs_dates.js` 에서 `너무먼날()` 을 내보내고,
   `collect-hosp.mjs` 의 `마감과출처()` 가 그것을 부릅니다. 돌려 보니
   실제 새 자료에서 **2건**이 걸렸습니다 (길병원 · 부민병원 · 둘 다 2099.12.31).

   그런데 **그것으로 끝이 아니었습니다.** 2026-10-13 에 손으로 비운 7건을
   다시 보니 한 건이 되돌아가 있었습니다 —

     CE49038  서산의료원
       10-13  apply_to = null · deadline_src 「원문 날짜 2400-03-19 → …」
       10-14 01:07  apply_to = 2400-03-19 · deadline_src 「API:클린아이」
                    ← 클린아이 수집기가 덮었습니다

   `collect_put` 의 `apply_to` 는 같은 출처면 `excluded.apply_to` 로
   덮습니다. 그러니 **수집기마다 뚜껑을 달면 일곱 자리**가 되고, 하나만
   빼먹어도 이런 일이 또 납니다 (지침 6절 · 9절 — 「이미 쌓인 자료는
   수집기가 되돌려 놓습니다」).

   뚜껑을 **창구 한 곳**에 둡니다. 수집기 일곱이 다 이 창구를 지납니다.
   (수집기 쪽 뚜껑은 그대로 둡니다 — 거기서는 `to원문` 을 `deadline_src` 에
    적을 수 있어 **왜 비었는지**가 남습니다. 창구 뚜껑은 마지막 그물입니다)

   ═══ 고치는 것 — 세 군데 ═══════════════════════════════════

   ① declare 에 한 줄
        v_뚜껑 date := ((now() at time zone 'Asia/Seoul')::date + 730);

   ② INSERT 의 VALUES 에서 apply_to
        앞  nullif(r->>'apply_to','')::date
        뒤  (case when nullif(r->>'apply_to','')::date > v_뚜껑
                  then null else nullif(r->>'apply_to','')::date end)

   ③ on conflict 의 apply_to 갈래에서 excluded.apply_to 를 쓰는 자리
        앞  when (j.source = p_source or j.source = v_짝) then excluded.apply_to
        뒤  when (j.source = p_source or j.source = v_짝)
              then (case when excluded.apply_to > v_뚜껑 then null
                         else excluded.apply_to end)

   그리고 deadline_src 에 **왜 비웠는지**를 남깁니다 —
   수집기가 보낸 출처 대신 「원문 날짜 … → 채용시까지로 봄 (창구)」.

   나머지는 글자까지 그대로입니다.

   ═══ 올린 뒤 확인할 것 ═════════════════════════════════════

     ① 지금 두 해 넘는 줄은 **1건**입니다 (CE49038 · 2400-03-19).
        select source, count(*) from job_posts
         where apply_to > ((now() at time zone 'Asia/Seoul')::date + 730)
         group by 1;
        → 올린 뒤 클린아이가 한 바퀴 돌면 **0건**이 되어야 합니다
     ② 멀쩡한 마감일이 안 비워졌는지 — 전후로 「마감일 있는 공고」 수를 셉니다
        select count(*) from job_posts where apply_to is not null;
     ③ 2026-12-31 처럼 그해 말 날짜(146건)가 그대로인지
   ═══════════════════════════════════════════════════════════ */

/* ※ 아래는 「고칠 자리」만 적은 것입니다. 올릴 때는 지금 DB 에 있는
   collect_put 전문(supabase/migrations/2026_10_13_collect_put_deadline_src.sql
   + 2026_10_13_collect_put_deadline_src_고침)에 위 ①②③ 을 넣어
   create or replace 로 통째로 올립니다 — 블록만 갈아끼우지 않습니다 (지침 7절). */
