-- 합칠 후보에서 「한쪽이 모름」 을 뺍니다 (2026-09-30 · 세중님 결정)
--
--   「지역 모름을 특정 지역으로 짐작해 붙이지 않는다.
--     표기만 다른 같은 지역 짝만 합치고, 합친 근거를 짝마다 적어라.」
--
-- 그래서 남기는 규칙은 하나뿐입니다 —
--   한쪽이 다른 쪽 광역에 드는 시·군일 때 (시군광역 표로 확인)
-- 근거를 짝마다 글로 적습니다.
--
-- ※ 지금 돌려 보면 후보가 **0짝**입니다. 근로복지공단·보훈공단을 병원 이름으로
--   묶으면서 「태백 ↔ 강원」 같은 짝이 처음부터 안 생기게 됐기 때문입니다.
--   규칙은 남겨 둡니다 — 나중에 기관이 늘면 또 생깁니다.

create or replace function admin_alio_merge_candidates(p_직군 text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception '관리자만'; end if;

  with 식구 as (
    select g.*, (g.기관||' · '||g.직군||' · '||coalesce(g.고용형태,'고용형태 모름')) 식구열쇠
    from alio_group_sum g
    where g.우리직군 and (p_직군 is null or g.직군 = p_직군)
      /* 「모름」 은 아예 후보에서 뺍니다 — 짐작해 붙이지 않습니다 */
      and g.지역 not in ('지역 모름', '근무처 확인 필요')),
  짝 as (
    select a.식구열쇠, a.기관, a.직군, a.고용형태,
      a.묶음키 a키, a.지역 a지역, a.회차 a회차, a.평균 a평균,
      b.묶음키 b키, b.지역 b지역, b.회차 b회차, b.평균 b평균,
      b.지역 || ' 는 ' || a.지역 || ' 안에 있는 시·군입니다 (시군광역 표)' 근거
    from 식구 a
    join 식구 b on b.식구열쇠 = a.식구열쇠 and b.묶음키 <> a.묶음키
    join 시군광역 m on m.시군 = b.지역 and m.광역 = a.지역)
  select jsonb_build_object(
    '후보', (select coalesce(jsonb_agg(to_jsonb(x) order by x.a회차 + x.b회차 desc), '[]'::jsonb)
             from (select * from 짝 limit 300) x),
    '셈', jsonb_build_object(
      '후보짝', (select count(*) from 짝),
      '묶음', (select count(distinct k) from (select a키 k from 짝 union select b키 from 짝) z),
      /* 합치지 않는 것도 몇 개인지 알려 줍니다 (화면에 「왜 비었나」 를 적으려고) */
      '모름이라 뺀 묶음', (select count(*) from alio_group_sum
                          where 우리직군 and 지역 in ('지역 모름','근무처 확인 필요')))
  ) into v;
  return v;
end $$;

revoke all on function admin_alio_merge_candidates(text) from public;
grant execute on function admin_alio_merge_candidates(text) to authenticated;
