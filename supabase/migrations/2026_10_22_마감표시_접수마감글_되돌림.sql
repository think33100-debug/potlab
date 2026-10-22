/* 되돌림 — 마감표시() 를 2026-10-22 **올리기 전 전문 그대로** 되돌립니다.
 * 읽는 창구(공고접수마감글)는 아무도 안 부르게 되므로 그냥 둡니다
 * (치우는 것은 승인 창이 뜨는 자리라 남겨 둡니다 — 돌지 않는 함수는 해가 없습니다).
 */
CREATE OR REPLACE FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select case
    when p_apply_to is not null then ''

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
