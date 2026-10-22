/* 마감표시() — 포털 **상세** 칸의 말(「채용시까지」)을 목록 카드·job_one·admin_jobs 가
 * 같이 쓰게 합니다 (2026-10-22 세중님 2번)
 *
 * 지금  apply_to 가 있으면 **빈 글자**를 냅니다 → 카드는 「D-12」만 보입니다.
 *       상세 화면만 `뽑은값.접수마감글` 을 따로 읽어 「채용시까지」를 보여 줍니다.
 * 뒤    마감표시() 가 그 말을 내므로 **세 자리가 한 값**을 씁니다
 *       (job_list → 목록 카드 · job_one → 상세 · admin_jobs → 관리자 표).
 *
 * 영향 — 회원 화면 **160건** (그날 회원 화면 301건의 53%). 전부 워크넷이고
 *        전부 「채용시까지」입니다. apply_to(목록 날짜)는 **안 건드립니다** —
 *        숨김·정렬·정찰이 그 칸을 봅니다.
 *
 * ① 왜 창구 함수를 하나 더 두나
 *    마감표시() 는 **정의자 권한이 아닙니다**(prosecdef=f). 그런데
 *    admin_jobs 는 **보기(view)** 라서, 그 안에서 부른 함수 본문의 표 읽기는
 *    **부르는 사람 권한**으로 검사됩니다 (지침 6-2c). 회원은 job_posts 를 못
 *    읽습니다(has_table_privilege authenticated/job_posts select = f) —
 *    마감표시() 안에 job_posts 조회를 그냥 넣으면 **관리자 표가 깨집니다.**
 *    그래서 읽는 자리만 작은 **security definer** 창구로 뗍니다.
 * ② 마감표시() 의 **인수는 그대로**입니다 → create or replace 라 권한이 남습니다.
 *    올리기 전 ACL —
 *      마감표시(date,text,text,text,text,text)
 *        {=X/postgres,postgres=X/postgres,service_role=X/postgres,
 *         anon=X/postgres,authenticated=X/postgres}      · 한 벌
 *    (drop 을 쓰지 않습니다 — admin_jobs 보기가 이 함수에 걸려 있어
 *     drop … cascade 가 **보기를 지웁니다.**)
 */

/* ── ① 읽는 창구 (새 함수) ───────────────────────────────────────────── */
create or replace function public."공고접수마감글"(p_id text)
  returns text
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select nullif(x."뽑은값"->>'접수마감글', '') from job_posts x where x.id = p_id
$$;

/* 새 함수는 PUBLIC 에 열립니다 — 걷고 필요한 역할에만 다시 겁니다 (지침 6-2·6-3).
   anon 은 **안 줍니다**: 비회원 상세는 job_one(security definer) 을 거치므로
   그 안에서는 postgres 권한으로 돕니다. 회원은 admin_jobs 보기를 직접 읽어서
   authenticated 가 필요합니다. */
revoke execute on function public."공고접수마감글"(text) from public, anon;
grant  execute on function public."공고접수마감글"(text) to authenticated, service_role;

/* ── ② 마감표시() — 첫 갈래만 바뀝니다 ──────────────────────────────── */
CREATE OR REPLACE FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select case
    /* ★ 2026-10-22 세중님 2번 — 날짜가 있어도, 포털 **상세** 칸에 기관이 적은
       말이 있으면 그 말을 냅니다 (없으면 전과 같이 빈 글자).
       화면은 날짜를 작게 「(게시 ~MM/DD)」로 따로 보여 줍니다 */
    when p_apply_to is not null then coalesce(공고접수마감글(p_id), '')

    when coalesce(p_접수문장, '') ~
           '(접수|모집|원서|지원)\s*(기간|기한|마감|일자|일시)[^가-힣]{0,8}.{0,40}?(채용\s*시\s*까지|채용\s*시\s*마감|채용\s*완료\s*시|채용\s*시([^가-힣]|$))'
      or coalesce(p_접수문장, '') ~ '마감일\s*[:：]?\s*(채용\s*시\s*까지|채용\s*완료\s*시)'
      then '채용시까지 · 공고문 확인'

    when 공공기관인가(p_id, p_tab, p_org_name) then '마감일 공고문 확인'

    when (coalesce(p_title, '') || ' ' || coalesce(p_접수문장, '')) ~ '수시|상시'
      then '수시채용'

    else '마감일 공고문 확인'
  end
$function$;
