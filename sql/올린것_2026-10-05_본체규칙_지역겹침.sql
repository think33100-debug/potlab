-- 2026-10-05 올림. 「제목 일」 마지막 묶음입니다.
--   ① 공공기관 본체가 직접 뽑으면 지역을 안 붙입니다
--   ② 지역겹치나() 가 긴 이름(경상북도·충청북도·○○광역시…)도 알아봅니다
--   ③ 겹침을 **법인 앞말을 뗀 이름**으로도 한 번 더 봅니다
--
-- 되돌리는 법은 제목_되돌리는법.md 에 있습니다.
-- 결과 — 제목 채움 375 / 살아있는 공고 376 · 지역 모름 0


-- ① 근무지 이름이 있나. 낱말은 **살아있는 자료에서 뽑았습니다** (짐작 아님).
--    (?<!복)지사 · (?<!복)지부 는 「사회복지사」「보건복지부」를 안 집기 위한 것입니다.
create or replace function "근무지이름있나"(p_org text, p_title text)
returns boolean language sql immutable as $$
  select (coalesce(p_org,'') || ' ' || coalesce(p_title,'')) ~
    ('병원|의료원|의원|요양원|요양병원|센터|센타|복지관|재활원|보건소|어린이집|'
     || '주간보호|데이케어|지역본부|(?<!복)지사|(?<!복)지부|분원|분소|출장소|사업소')
$$;

-- 기관 이름이 공공기관 본체이고, 근무지 이름이 아무 데도 없으면 「본체가 뽑는 것」입니다.
-- ★ 처음에 규칙을 넓게 잡았더니 제목 38건이 망가질 참이었습니다
--   (요양시설·너싱홈·실버케어·정형외과·○○의집에서 지역이 떨어졌습니다).
--   그래서 **기관 이름의 공공기관 낱말**로만 좁혔습니다.
create or replace function "본체만뽑나"(p_org text, p_title text)
returns boolean language sql immutable as $$
  select coalesce(p_org,'') ~
           '(공단|공사|개발원|평가원|진흥원|관리원|교육청|적십자사|복지부|사업단|연구원)'
     and not 근무지이름있나(p_org, p_title)
$$;


-- ② 긴 이름을 알아봅니다. 「경북 경상북도 성주군…」 같은 겹침 13건이 고쳐졌습니다.
create or replace function "지역겹치나"("p_지역" text, p_org text)
returns boolean language sql immutable as $$
  with 긴 as (
    select * from (values
      ('서울','서울특별시'),('부산','부산광역시'),('대구','대구광역시'),('인천','인천광역시'),
      ('광주','광주광역시'),('대전','대전광역시'),('울산','울산광역시'),('세종','세종특별자치시'),
      ('경기','경기도'),('강원','강원특별자치도'),('강원','강원도'),
      ('충북','충청북도'),('충남','충청남도'),
      ('전북','전북특별자치도'),('전북','전라북도'),('전남','전라남도'),
      ('경북','경상북도'),('경남','경상남도'),('제주','제주특별자치도'),
      ('전남광주','전남광주통합특별시')) v(짧, 긴이름)
  ), 조각 as (
    select t from unnest(
      case when p_지역 = '전남광주' then array['전남광주','전남','광주']
           else string_to_array(coalesce(p_지역,''), '·') end) t
     where t <> ''
  )
  select exists (
    select 1 from 조각 c
     where coalesce(p_org,'') like c.t || '%'
        or exists (select 1 from 긴 g
                    where g.짧 = c.t and coalesce(p_org,'') like g.긴이름 || '%'))
$$;


-- ③ 알맹이. 바뀐 곳은 지역 두 줄뿐입니다.
create or replace function "제목만들기행"(j job_posts)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_기관 text; v_산하 text; v_지역 text; v_부서 text; v_직군 text;
  v_고용 text; v_대체 text; v_가른것 text; v_조각 text[] := '{}';
begin
  v_기관 := 법인앞말떼기(j.org_name);
  select 줄인이름 into v_기관
    from 기관이름줄임 where 원래이름 = j.org_name and 승인했나 limit 1;
  if v_기관 is null then v_기관 := 법인앞말떼기(j.org_name); end if;

  v_산하 := 제목산하(j.title, j.org_name);
  if v_산하 is not null then v_기관 := v_기관 || ' ' || v_산하; end if;

  v_지역 := 제목지역기관(j.sido, j.work_place, j.org_name);
  if v_지역 = '전남광주' then
    v_가른것 := 전남광주가르기(coalesce(v_산하,'') || ' ' || coalesce(j.title,''));
    if v_가른것 is not null then v_지역 := v_가른것; end if;
  end if;
  /* ★ 원래 이름과 **법인 앞말을 뗀 이름** 둘 다 봅니다 —
     「사단법인 경상북도장애인부모회」는 뗀 뒤에야 「경상북도」로 시작합니다 */
  if v_지역 is not null
     and (지역겹치나(v_지역, j.org_name) or 지역겹치나(v_지역, v_기관))
  then v_지역 := null; end if;
  /* 공공기관 본체가 직접 뽑으면 지역을 안 붙입니다 */
  if v_지역 is not null and 본체만뽑나(j.org_name, j.title) then v_지역 := null; end if;

  v_부서 := 제목부서(j.title);
  if v_부서 is not null and v_산하 is not null and v_부서 = v_산하 then v_부서 := null; end if;
  v_직군 := 제목직군(j.job_group);
  v_고용 := 고용형태보임(j.employ_type);
  if v_고용 is null then
    v_고용 := (select m[1] from regexp_matches(coalesce(j.title,''),
      '(정규직|계약직|기간제|파트타임|무기계약직)') m limit 1);
    v_고용 := 고용형태보임(v_고용);
  end if;
  v_대체 := 제목대체사유(j.title);

  if v_기관 is null or v_직군 is null then return null; end if;

  /* ::text 를 꼭 붙입니다 — 안 붙이면 22P02 malformed array literal 입니다 */
  if v_지역 is not null then v_조각 := v_조각 || v_지역::text; end if;
  v_조각 := v_조각 || v_기관::text;
  if v_부서 is not null then v_조각 := v_조각 || v_부서::text; end if;
  v_조각 := v_조각 || v_직군::text;
  if v_고용 is not null then v_조각 := v_조각 || v_고용::text; end if;
  if v_대체 is not null then v_조각 := v_조각 || v_대체::text; end if;
  v_조각 := v_조각 || '채용공고'::text;

  return array_to_string(v_조각, ' ');
end $$;


-- 고친 뒤에는 이미 담긴 것도 다시 만듭니다 (작업지침 9번)
update job_posts set 보여줄제목 = 제목만들기(id);


-- ④ admin_제목확인() 의 「지역 모름」 도 같은 기준으로 고쳤습니다.
--    기관 단위로 묶고, 본체가 뽑는 것은 셈에서 뺍니다. 전문은 DB 에 있습니다 —
--    select pg_get_functiondef('admin_제목확인()'::regprocedure);
