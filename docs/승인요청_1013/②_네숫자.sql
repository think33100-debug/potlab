/* ② 네 숫자를 한 자리에서 세는 창구 (2026-10-14)

   ★ 아직 안 올렸습니다. 세중님 확인 뒤에 올립니다.
   ★ 지우는 문장이 없습니다. 읽기만 합니다. 권한은 service_role 뿐입니다.

   ═══ 왜 ═══════════════════════════════════════════════════

   세중님 지시 — 「하루 요약 메일 08:00 은 조용한 날에도 짧게 보냄
   (네 숫자 · 멈춘 수집기 · 안 긁는 1층 병원 N곳)」.

   그런데 `hold_digest()` 는 네 숫자를 안 돌려줍니다. 돌려주는 것은
   새 보류 건수 · 회원 화면(샘) · 늦은 수집기 · PDF 0자 · 하루 한도 ·
   기준값 · 오류 신고 · 공고마름 뿐입니다.

   그래서 제가 날마다 손으로 쿼리를 짜서 보고에 적고 있었습니다.
   **같은 셈이 두 자리에 생기지 않게** 창구 하나로 만듭니다 (지침 6절).

   ═══ 네 숫자 ═══════════════════════════════════════════════

     ① 놓친 공고        지금은 「대상인데 안 긁는 1층 병원」 으로 셉니다.
                        경쟁사 기준 숫자는 짝 맞추기 뒤에 더합니다 —
                        그때까지 '경쟁사기준' 은 null 입니다 (지어내지 않습니다)
     ② 마감인데 보임     job_posts_pub 에서 apply_to 가 오늘보다 앞선 것
     ③ 일곱 칸          **지금 있는 칸만** 셉니다 —
                          모집인원 · 접수마감 · 마감시각 · 근무지 · 지원자격
                        없는 칸 셋(예상연봉·바쁜정도·병원뜯어보기)은
                        '아직 칸이 없습니다' 로 적습니다. 0% 로 적으면
                        「값이 안 찼다」 로 읽혀서 틀립니다 (지침 15절)
     ④ 경쟁사보다 먼저   아직 못 잼 → null

   회원 화면 줄 수는 **job_posts_pub** 으로 셉니다 — hidden=false 만 보고
   세면 보류함에 든 것까지 셉니다 (지침 8-14).

   ═══ 올린 뒤 확인할 것 ═════════════════════════════════════

     select jsonb_pretty(네숫자());
     select proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='네숫자';
       → {postgres=X/postgres,service_role=X/postgres}
   ═══════════════════════════════════════════════════════════ */

create or replace function public."네숫자"()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with v as (select * from job_posts_pub),
  오늘 as (select (now() at time zone 'Asia/Seoul')::date as d)
  select jsonb_build_object(
    '잰때', now(),
    '회원화면', (select count(*) from v),
    '①놓친공고', jsonb_build_object(
        '안긁는_1층병원', (select "사각지대" from jsonb_to_record("일층병원_구멍셈"())
                            as x("사각지대" int)),
        '대상_1층병원', (select "대상" from jsonb_to_record("일층병원_구멍셈"())
                          as x("대상" int)),
        '경쟁사기준', null),
    '②마감인데보임', (select count(*) from v, 오늘 where v.apply_to < 오늘.d),
    '③일곱칸', jsonb_build_object(
        '모집인원', (select round(100.0 * count(*) filter (where headcount is not null)
                                 / nullif(count(*), 0), 1) from v),
        '접수마감', (select round(100.0 * count(*) filter (where apply_to is not null)
                                 / nullif(count(*), 0), 1) from v),
        '마감시각', (select round(100.0 * count(*) filter (where apply_to_time is not null)
                                 / nullif(count(*), 0), 1) from v),
        '근무지', (select round(100.0 * count(*) filter (where coalesce(work_place, '') <> '')
                               / nullif(count(*), 0), 1) from v),
        '지원자격', (select round(100.0 * count(*) filter (where coalesce(edu, '') <> '')
                                 / nullif(count(*), 0), 1) from v),
        '예상연봉', '아직 칸이 없습니다',
        '바쁜정도', '아직 칸이 없습니다',
        '병원뜯어보기', '아직 칸이 없습니다'),
    '④먼저올린비율', null
  )
$$;

revoke execute on function public."네숫자"() from public, anon, authenticated;
grant  execute on function public."네숫자"() to service_role;
