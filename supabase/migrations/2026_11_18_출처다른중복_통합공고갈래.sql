-- 출처다른중복 — 「포털의 통합 공고 ↔ 기관 채용관의 직종별 공고」 갈래를 더합니다 (2026-11-18 세중님 「고치자」)
--
-- 꼴: 국민건강보험공단 일산병원 — 알리오 306973 「2026년 11월 기간제근로자 모집공고(간호직, 보건직, 사무직, 기능직)」
--     한 공고를 리크루터는 직종별로 나눠 올렸습니다 (JF134744 소아작업치료사 · JF134757 일차의료 거점지원센터).
--     제목이 달라 기존 갈래(제목열쇠)가 못 봅니다. 회원 화면에 같은 자리가 두 번씩 보였습니다.
-- 새 갈래 (기존 갈래가 못 묶은 것만):
--   직접 출처(JF·HS·HS3·HS4·ND·ND2) 공고 A 와 포털 공고 B 가
--   ① 같은 기관 (기존 갈래와 같은 네 갈래 견주기 · 심평원 번호)
--   ② 접수 시작일 같음 AND 마감일 같음 (둘 다 있음)
--   ③ 고용형태 같음 ④ 인턴 여부 같음 (제목의 「인턴」) — 같은 날 올린 인턴 공고(306974)를 막습니다
--   ⑤ 직군 겹침 (같거나 한쪽이 공통)
--   → B 를 숨기고 A(지원하는 곳)를 남깁니다.
--   나눈 공고(-OT·-PT)는 원본을 숨깁니다 (원본을 따라 숨김이 되살아나기 때문) —
--   그래서 **원본의 보이는 나눈 줄이 모두 덮일 때만** 숨깁니다.
-- 하루 뚜껑 10건은 그대로(같은 v_목록에 쌓습니다). 묶지않음·잠김은 건너뜁니다.
-- ACL 은 create or replace(인수 같음)라 그대로 — 끝에서 글자 확인.
-- 되돌림: 2026_10_19 판 본문(sql/기준구조_1030.sql 13063줄~)으로 create or replace.

create or replace function public."출처다른중복"("p_마른" boolean default true)
returns jsonb language plpgsql
security definer          -- 전과 같음 (바꾸지 않습니다)
set search_path to 'public'
as $function$
declare
  v_짝 record;
  v_숨김 int := 0;
  v_목록 jsonb := '[]'::jsonb;
  v_뚜껑 int := 10;          /* 하루 10건 — `중복숨기기` 와 같은 뚜껑입니다 */
begin
  perform set_config('app.누가', '출처다른중복', true);

  for v_짝 in
    with 보임 as (
      select p.id, p.source, p.org_name, p.title, p.apply_to,
             case when p."기관번호" like 'HIRA:%' then p."기관번호" end as 심평원번호,
             견줄이름(기관이름보정(p.source, p.org_name, p.title)) as 기관열쇠,
             견줄이름(coalesce(제목속병원_앞(p.title),
                               기관이름보정(p.source, p.org_name, p.title))) as 기관열쇠앞,
             제목열쇠(p.title) as 제목키,
             일곱칸찬수(p.id) as 찬수,
             (case when p.source in ('HS', 'HS3', 'HS4', 'JF', 'ND', 'ND2') then 1 else 0 end) as 직접출처,
             coalesce(p.admin_locked, false) as 잠김
        from job_posts p
        join job_posts_pub v on v.id = p.id
    )
    select a.id as 남길것, b.id as 숨길것, a.source as 남길출처, b.source as 숨길출처,
           a.title as 제목, a.org_name as 기관, a.찬수 as 남길찬수, b.찬수 as 숨길찬수
      from 보임 a
      join 보임 b
        on a.id <> b.id
       and a.source <> b.source
       and (a.기관열쇠 = b.기관열쇠
            or a.기관열쇠앞 = b.기관열쇠앞
            or a.기관열쇠   = b.기관열쇠앞
            or a.기관열쇠앞 = b.기관열쇠
            or (a.심평원번호 is not null and a.심평원번호 = b.심평원번호)
            or (length(a.기관열쇠) >= 4 and length(b.기관열쇠) >= 4
                and (a.기관열쇠 like b.기관열쇠 || '%' or b.기관열쇠 like a.기관열쇠 || '%')))
       and (a.제목키 = b.제목키
            or (length(b.제목키) >= 10 and a.제목키 like '%' || b.제목키)
            or (length(a.제목키) >= 10 and b.제목키 like '%' || a.제목키))
       and least(length(a.제목키), length(b.제목키)) >= 10
       and (a.apply_to = b.apply_to or a.apply_to is null or b.apply_to is null)
     where not b.잠김
       /* 11-12 — 관리자가 「다른 공고」로 고른 짝은 건너뜁니다 */
       and not exists (select 1 from 묶지않음 m
                        where m.왼쪽 = least(a.id, b.id) and m.오른쪽 = greatest(a.id, b.id))
       and (a.찬수 > b.찬수
            or (a.찬수 = b.찬수 and a.직접출처 > b.직접출처)
            or (a.찬수 = b.찬수 and a.직접출처 = b.직접출처 and a.id < b.id))
     order by a.id
  loop
    v_목록 := v_목록 || jsonb_build_object(
      '남길것', v_짝.남길것, '남길출처', v_짝.남길출처, '남길찬수', v_짝.남길찬수,
      '숨길것', v_짝.숨길것, '숨길출처', v_짝.숨길출처, '숨길찬수', v_짝.숨길찬수,
      '기관', left(v_짝.기관, 24), '제목', left(v_짝.제목, 48));
    v_숨김 := v_숨김 + 1;
    if v_숨김 > v_뚜껑 then
      return jsonb_build_object('마른', p_마른, '숨길수', v_숨김,
        '멈춤', '하루 뚜껑 ' || v_뚜껑 || '건을 넘었습니다 — 아무것도 안 바꾸고 멈춥니다',
        '목록', v_목록);
    end if;
  end loop;

  /* ★ 11-18 — 포털의 통합 공고 ↔ 기관 채용관의 직종별 공고 (일산병원 306973 ↔ JF134744·JF134757 꼴) */
  for v_짝 in
    with 보임 as (
      select p.id, p.source, p.org_name, p.title, p.apply_from, p.apply_to, p.employ_type, p.job_group,
             case when p.id ~ '-(OT|PT)$' then regexp_replace(p.id, '-(OT|PT)$', '') else p.id end as 원본,
             case when p."기관번호" like 'HIRA:%' then p."기관번호" end as 심평원번호,
             견줄이름(기관이름보정(p.source, p.org_name, p.title)) as 기관열쇠,
             견줄이름(coalesce(제목속병원_앞(p.title),
                               기관이름보정(p.source, p.org_name, p.title))) as 기관열쇠앞,
             (p.title ~ '인턴') as 인턴,
             (p.source in ('HS', 'HS3', 'HS4', 'JF', 'ND', 'ND2')) as 직접,
             coalesce(p.admin_locked, false) as 잠김
        from job_posts p
        join job_posts_pub v on v.id = p.id
    ), 덮임 as (
      select b.id, b.원본, min(a.id) as 남길것, min(a.source) as 남길출처
        from 보임 b
        join 보임 a
          on a.직접 and not b.직접
         and (a.기관열쇠 = b.기관열쇠
              or a.기관열쇠앞 = b.기관열쇠앞
              or a.기관열쇠   = b.기관열쇠앞
              or a.기관열쇠앞 = b.기관열쇠
              or (a.심평원번호 is not null and a.심평원번호 = b.심평원번호))
         and a.apply_from = b.apply_from and a.apply_to = b.apply_to
         and coalesce(a.employ_type, '') = coalesce(b.employ_type, '')
         and a.인턴 = b.인턴
         and (a.job_group = b.job_group or a.job_group = '공통' or b.job_group = '공통')
       where not exists (select 1 from 묶지않음 m
                          where m.왼쪽 = least(a.id, b.id) and m.오른쪽 = greatest(a.id, b.id))
       group by b.id, b.원본
    )
    select d.원본 as 숨길것, min(d.남길것) as 남길것, min(d.남길출처) as 남길출처,
           min(o.source) as 숨길출처, min(o.title) as 제목, min(o.org_name) as 기관
      from 덮임 d
      join job_posts o on o.id = d.원본
     where not coalesce(o.admin_locked, false)
       /* 원본의 보이는 줄(나눈 줄 포함)이 **모두** 덮일 때만 */
       and not exists (select 1 from 보임 x where x.원본 = d.원본
                         and not exists (select 1 from 덮임 y where y.id = x.id))
       /* 위 갈래가 이미 고른 것은 또 넣지 않습니다 */
       and not exists (select 1 from jsonb_array_elements(v_목록) e where e->>'숨길것' = d.원본)
     group by d.원본
     order by d.원본
  loop
    v_목록 := v_목록 || jsonb_build_object(
      '남길것', v_짝.남길것, '남길출처', v_짝.남길출처, '남길찬수', null,
      '숨길것', v_짝.숨길것, '숨길출처', v_짝.숨길출처, '숨길찬수', null,
      '갈래', '통합공고', '기관', left(v_짝.기관, 24), '제목', left(v_짝.제목, 48));
    v_숨김 := v_숨김 + 1;
    if v_숨김 > v_뚜껑 then
      return jsonb_build_object('마른', p_마른, '숨길수', v_숨김,
        '멈춤', '하루 뚜껑 ' || v_뚜껑 || '건을 넘었습니다 — 아무것도 안 바꾸고 멈춥니다',
        '목록', v_목록);
    end if;
  end loop;

  if p_마른 then
    return jsonb_build_object('마른', true, '숨길수', v_숨김, '숨김', 0, '목록', v_목록);
  end if;

  /* 11-12 — 남긴 줄을 「같은공고」에 적습니다. 한 줄이 여러 짝에 걸리면 첫 짝만 */
  update job_posts j
     set hidden = true,
         "같은공고" = x.남길것,
         hidden_why = case when x.갈래 = '통합공고'
                           then '중복(통합 공고) — 기관 채용관의 직종별 공고 ' || x.남길것 || ' 를 남겼습니다(지원하는 곳)'
                           else '중복(출처 다름) — ' || x.남길것 || ' 를 남겼습니다(칸이 더 찬 쪽)' end,
         hidden_on = now()
    from (select distinct on (e->>'숨길것') e->>'숨길것' as 숨길것, e->>'남길것' as 남길것, e->>'갈래' as 갈래
            from jsonb_array_elements(v_목록) e order by e->>'숨길것') x
   where j.id = x.숨길것
     and not coalesce(j.admin_locked, false);
  /* 11-12 — 남긴 줄에 마감일이 비어 있으면 숨긴 짝의 마감일을 옮깁니다 (부산의료원 꼴) */
  update job_posts k set apply_to = h.apply_to
    from job_posts h
   where h."같은공고" = k.id and h.apply_to is not null and k.apply_to is null
     and h.id in (select (x->>'숨길것') from jsonb_array_elements(v_목록) x)
     and not coalesce(k.admin_locked, false)
     and not ('apply_to' = any(coalesce(k.edited_fields, '{}')));
  return jsonb_build_object('마른', false, '숨길수', v_숨김, '숨김', v_숨김, '목록', v_목록);
end
$function$;

revoke execute on function public."출처다른중복"(boolean) from public, anon, authenticated;
grant  execute on function public."출처다른중복"(boolean) to service_role;
