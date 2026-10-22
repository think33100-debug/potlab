/* job_one — 비로그인에게 **접수마감글**도 내립니다 (한 칸 추가)
 *
 * 2026-10-22 세중님 1번 — 「job_one 비회원에도 「채용시까지」」
 *
 * **인수가 그대로입니다**(p_id text 하나) → create or replace 라 **권한(ACL)이
 * 그대로 남습니다** (지침 6-2 — 인수를 바꾸면 새 함수가 되어 PUBLIC 이 붙습니다).
 * 올리기 전 ACL —
 *   job_one(text)  {postgres=X/postgres,service_role=X/postgres,
 *                   anon=X/postgres,authenticated=X/postgres}   · 한 벌(overload 1)
 * 그래서 grant·revoke 를 **한 줄도 넣지 않습니다.** 올린 뒤 같은 질의로 다시 찍어
 * 글자까지 같은지 봅니다.
 *
 * 바뀌는 것은 **비로그인 갈래의 jsonb_build_object 한 칸**뿐입니다.
 * 회원 갈래(else)·반환 칸·마감표시 호출·where 는 글자 하나 안 바뀝니다.
 */

CREATE OR REPLACE FUNCTION public.job_one(p_id text)
 RETURNS TABLE(id text, org_name text, title text, hire_type text, employ_type text, work_place text, sido text, sgg text, edu text, headcount integer, apply_from date, apply_to date, posted_at date, url text, job_group text, org_kind text, tab text, detail jsonb, is_intern boolean, "지역보임" text, "마감표시" text, apply_to_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select j.id, 기관이름보정_아이디로(j.id, j.org_name, coalesce(j."원문제목", j.title)), j.title, j.hire_type, j.employ_type,
         j.work_place, j.sido, j.sgg, j.edu, j.headcount,
         j.apply_from, j.apply_to, j.posted_at,
         /* ★ 2026-10-09 — 비회원에게는 원문 주소를 안 줍니다 */
         case when auth.uid() is null then null else j.url end,
         j.job_group, j.org_kind, j.tab,
         /* ★ 2026-10-14 — 「조교연구」는 비회원에게도 줍니다 (위 주석) */
         case when auth.uid() is null
              /* ★ 2026-10-19 세중님 ㉢ⓑ — **모집인원은 비로그인도 봅니다.**
                 「0명」은 headcount 로 이미 누구나 보므로 「○명」·「00명」도
                 같이 보여야 앞뒤가 맞습니다. 원문에 적힌 글 그대로 줍니다.
                 뷰에 「뽑은값」 칸이 없어 job_posts 를 따로 읽습니다
                 (이 함수는 security definer 라 됩니다).
                 지원자격·예상연봉은 **안 줍니다** — 회원 자료입니다 */
              then jsonb_strip_nulls(jsonb_build_object(
                     '조교연구', j."조교연구",
                     '모집인원', (select x."뽑은값"->>'모집인원'
                                    from job_posts x where x.id = j.id),
                     /* ★ 2026-10-22 세중님 1번 — **접수마감글도 비로그인에게 줍니다.**
                        워크넷 상세 API 가 「채용시까지」인 공고가 회원 화면 160건입니다.
                        회원은 `공고뽑은값` 으로 받지만 비로그인은 그 창구가 {} 를 줘서
                        **날짜(게시 만료일)가 그대로 보였습니다.** 모집인원과 같은 꼴로
                        이 칸만 더 줍니다 — 지원자격·예상연봉은 그대로 안 줍니다 */
                     '접수마감글', (select x."뽑은값"->>'접수마감글'
                                     from job_posts x where x.id = j.id)))
              else coalesce(j.detail, '{}'::jsonb)
                   || jsonb_strip_nulls(jsonb_build_object('조교연구', j."조교연구"))
         end,
         j.is_intern, j."지역보임",
         마감표시(j.apply_to, j.id, j.tab, j.org_name,
                  coalesce(j."원문제목", j.title), j."접수문장"),
         j.apply_to_time
    from job_posts_pub j
   where j.id = p_id
$function$;
