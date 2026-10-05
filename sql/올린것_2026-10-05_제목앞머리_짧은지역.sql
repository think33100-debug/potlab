-- 2026-10-05 올림. 제목 앞머리를 짧은 지역 이름으로 맞춥니다.
--
-- 기준 하나입니다 (세중님 지시) —
--   제목 앞은 언제나 짧은 지역 이름(경북·전남·충북 …)으로 시작합니다.
--   기관 이름 앞의 도·광역시 이름이 그 지역과 같으면 **기관 쪽에서** 뗍니다.
--
--   「경상북도 성주군 …」            → 「경북 성주군 작업치료사 공무원 채용공고」
--   「전라남도 강진의료원 …」        → 「전남 강진의료원 …」
--   「충청북도 충주의료원 …」        → 「충북 충주의료원 …」
--   「경상북도장애인부모회 의성군지부」 → 「경북 장애인부모회 의성군지부 …」
--
-- 앞 판(10/5 낮)은 겹치면 **지역을 뺐습니다** — 그래서 긴 이름이 앞에 남았습니다.
-- 이 판은 거꾸로 **기관 이름에서 긴 이름을 뗍니다.**
--
-- 결과 — 27건 고침 · 제목 채움 375/376 · 지역 모름 0
--        updated_at 은 안 바뀝니다 (고친 줄 최대값이 되메우기보다 28분 이전)


-- ① 긴 도·광역시 이름 떼기.
--    안 떼는 자리 둘은 **살아있는 자료에서 찾은 것**입니다 (짐작 아님).
create or replace function "지역앞말떼기"("p_지역" text, p_기관 text)
returns text language sql immutable as $$
  select coalesce(
    (select btrim(substr(p_기관, length(g."긴이름") + 1))
       from (values
         ('서울','서울특별시'),('부산','부산광역시'),('대구','대구광역시'),('인천','인천광역시'),
         ('광주','광주광역시'),('대전','대전광역시'),('울산','울산광역시'),('세종','세종특별자치시'),
         ('경기','경기도'),('강원','강원특별자치도'),('강원','강원도'),
         ('충북','충청북도'),('충남','충청남도'),
         ('전북','전북특별자치도'),('전북','전라북도'),('전남','전라남도'),
         ('경북','경상북도'),('경남','경상남도'),('제주','제주특별자치도'),
         ('전남광주','전남광주통합특별시')) g("짧","긴이름")
      where g."짧" = p_지역
        and p_기관 like g."긴이름" || '%'
        and btrim(substr(p_기관, length(g."긴이름") + 1)) <> ''
        /* 「경상북도립김천노인전문요양병원」 — 떼면 「립김천…」. 낱말이 끊깁니다 */
        and btrim(substr(p_기관, length(g."긴이름") + 1)) !~ '^립'
        /* 「경기도의료원」·「부산광역시의료원」 — 떼면 「의료원」만 남아
           기관 고유 이름이 사라집니다 */
        and split_part(btrim(substr(p_기관, length(g."긴이름") + 1)), ' ', 1)
              !~ '^(의료원|병원|보건소|센터|복지관)$'
      order by length(g."긴이름") desc
      limit 1),
    p_기관)
$$;

comment on function "지역앞말떼기"(text, text) is
  '제목 앞은 짧은 지역 이름으로 시작합니다. 기관 이름 앞의 긴 도·광역시 이름이
   그 지역과 같으면 뗍니다. 안 떼는 자리 둘 — 「경상북도립…」처럼 낱말이 끊기는
   자리, 「경기도의료원」처럼 떼면 기관 고유 이름이 없어지는 자리.';


-- ② 알맹이. 지역 부분만 바뀝니다.
--    ★ 산하 붙이기를 **지역 판정 뒤로** 내렸습니다. 지역을 먼저 정하고
--      기관 이름을 거기 맞추는 순서여야 합니다.
create or replace function "제목만들기행"(j job_posts)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_기관 text; v_산하 text; v_지역 text; v_부서 text; v_직군 text;
  v_고용 text; v_대체 text; v_가른것 text; v_뗀것 text; v_조각 text[] := '{}';
begin
  v_기관 := 법인앞말떼기(j.org_name);
  select 줄인이름 into v_기관
    from 기관이름줄임 where 원래이름 = j.org_name and 승인했나 limit 1;
  if v_기관 is null then v_기관 := 법인앞말떼기(j.org_name); end if;

  /* 산하를 아직 붙이지 않습니다 */
  v_산하 := 제목산하(j.title, j.org_name);

  v_지역 := 제목지역기관(j.sido, j.work_place, j.org_name);
  if v_지역 = '전남광주' then
    v_가른것 := 전남광주가르기(coalesce(v_산하,'') || ' ' || coalesce(j.title,''));
    if v_가른것 is not null then v_지역 := v_가른것; end if;
  end if;
  /* 공공기관 본체가 직접 뽑으면 지역을 안 붙입니다 — 이걸 **먼저** 봅니다.
     지역이 떨어질 거면 기관 이름을 건드리지 않아야 합니다 */
  if v_지역 is not null and 본체만뽑나(j.org_name, j.title) then v_지역 := null; end if;
  if v_지역 is not null then
    /* (1) 기관 이름 앞의 긴 도·광역시 이름이 그 지역과 같으면 기관 쪽에서 뗍니다 */
    v_뗀것 := 지역앞말떼기(v_지역, v_기관);
    if v_뗀것 <> v_기관 then
      v_기관 := v_뗀것;
    /* (2) 못 뗀 겹침(짧은 이름으로 시작·낱말이 끊기는 자리)은 지역을 뺍니다 */
    elsif 지역겹치나(v_지역, j.org_name) or 지역겹치나(v_지역, v_기관) then
      v_지역 := null;
    end if;
  end if;

  if v_산하 is not null then v_기관 := v_기관 || ' ' || v_산하; end if;

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


-- ③ 되메우기. **조건 없이 전부 다시 쓰지 않습니다** —
--    세중님이 조건 없는 2,126건 되메우기를 거절하셨습니다 (2026-10-05).
--    바뀌는 줄만 고치고, 관리자가 손으로 고친 제목은 건드리지 않습니다.
update job_posts
   set 보여줄제목 = 제목만들기(id)
 where 보여줄제목 is distinct from 제목만들기(id)
   and not ('보여줄제목' = any(coalesce(edited_fields, '{}')));
