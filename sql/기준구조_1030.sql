--
-- PostgreSQL database dump
--

\restrict ImmsvCTde25aTP4aszAgRDdJKeLxvp3oeARugvocnGWlVhl30RQK4yCvylFNrLL

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admin_alio_compete(integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_alio_compete(p_year integer DEFAULT NULL::integer, p_inst text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not is_admin() then raise exception '관리자만'; end if;

  with 공고 as (select distinct on (sn) sn, inst_nm, pbanc_ttl, end_ymd, year
                from alio_compete order by sn),
  끝 as (
    select w.*, c.inst_nm, c.pbanc_ttl, c.end_ymd, c.year,
      (w.our_job is not null and not w.mixed) 우리것
    from alio_compete_web w join 공고 c on c.sn = w.sn
    where w.is_last)
  select jsonb_build_object(
    '전체', (select jsonb_build_object(
        '묶음', count(*), '공고', count(distinct sn), '기관', count(distinct inst_nm),
        '단계', (select count(*) from alio_compete_web),
        '값있음', count(*) filter (where cmptt_rt_state = '있음'),
        '미등록',  count(*) filter (where cmptt_rt_state = '미등록'),
        '못냄',   count(*) filter (where cmptt_rt_state = '못냄'),
        '진짜0',  count(*) filter (where cmptt_rt_state = '진짜0'),
        '우리직군', count(*) filter (where 우리것),
        '합쳐짐',  count(*) filter (where mixed),
        '첫해', min(year), '끝해', max(year),
        '읽은공고', (select count(*) from alio_compete_web_state),
        '표없음',  (select count(*) from alio_compete_web_state where 왜 is not null),
        '아직',   (select count(*) from 공고 a
                   left join alio_compete_web_state s on s.sn = a.sn where s.sn is null))
      from 끝),

    '기관', (select coalesce(jsonb_agg(x order by x->>'기관'), '[]'::jsonb) from (
        select jsonb_build_object(
          '기관', inst_nm, '공고', count(distinct sn), '묶음', count(*),
          '값있음', count(*) filter (where cmptt_rt_state = '있음'),
          '미등록',  count(*) filter (where cmptt_rt_state = '미등록'),
          '못냄',   count(*) filter (where cmptt_rt_state = '못냄'),
          '진짜0',  count(*) filter (where cmptt_rt_state = '진짜0'),
          '우리직군', count(*) filter (where 우리것),
          '평균', round(avg(cmptt_rt) filter (where cmptt_rt_state = '있음'), 1),
          '최고', max(cmptt_rt) filter (where cmptt_rt_state = '있음'),
          '우리직군평균', round(avg(cmptt_rt) filter (where cmptt_rt_state = '있음' and 우리것), 1),
          '우리직군값있음', count(*) filter (where cmptt_rt_state = '있음' and 우리것),
          '첫해', min(year), '끝해', max(year)) x
        from 끝 where (p_year is null or year = p_year)
        group by inst_nm) t),

    '연도', (select coalesce(jsonb_agg(x order by x->>'연도' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          '연도', year, '공고', count(distinct sn), '묶음', count(*), '기관', count(distinct inst_nm),
          '값있음', count(*) filter (where cmptt_rt_state = '있음'),
          '미등록',  count(*) filter (where cmptt_rt_state = '미등록'),
          '못냄',   count(*) filter (where cmptt_rt_state = '못냄'),
          '진짜0',  count(*) filter (where cmptt_rt_state = '진짜0'),
          '우리직군', count(*) filter (where 우리것),
          '평균', round(avg(cmptt_rt) filter (where cmptt_rt_state = '있음'), 1),
          '우리직군평균', round(avg(cmptt_rt) filter (where cmptt_rt_state = '있음' and 우리것), 1),
          '우리직군값있음', count(*) filter (where cmptt_rt_state = '있음' and 우리것)) x
        from 끝 where year is not null and (p_inst is null or inst_nm = p_inst)
        group by year) t),

    '줄', case when p_inst is null and p_year is null then '[]'::jsonb else
      (select coalesce(jsonb_agg(x order by x->>'마감' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          '기관', inst_nm, '공고', pbanc_ttl, '직군', group_name, '마감', end_ymd, '연도', year,
          '첫지원', first_aply, '끝선발', final_nope, '단계수', group_steps,
          '경쟁률', cmptt_rt, '경쟁률상태', cmptt_rt_state, '경쟁률출처', rt_src,
          '확정일', rsn_ymd, '우리직군', case when 우리것 then our_job end, '합쳐짐', mixed) x
        from 끝
        where (p_inst is null or inst_nm = p_inst) and (p_year is null or year = p_year)
        order by end_ymd desc nulls last, sn, group_no
        limit 500) t) end,

    '어디까지', (select coalesce(jsonb_agg(jsonb_build_object(
        '말', 말, '다음쪽', 다음쪽, '전체쪽', 전체쪽, '다한날', 다한날, '마지막', 마지막)
        order by 말), '[]'::jsonb) from alio_compete_state)
  ) into v;
  return v;
end $$;


ALTER FUNCTION public.admin_alio_compete(p_year integer, p_inst text) OWNER TO postgres;

--
-- Name: admin_alio_group_one(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_alio_group_one("p_묶음키" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not is_admin() then raise exception '관리자만'; end if;

  with 공고 as (select distinct on (sn) sn, inst_nm, year, end_ymd, pbanc_ttl
                from alio_compete order by sn),
  줄 as (select w.*, c.inst_nm, c.year, c.end_ymd, c.pbanc_ttl
         from alio_compete_web w join 공고 c on c.sn = w.sn
         where w.묶음키 = p_묶음키),
  끝 as (select * from 줄 where is_last)
  select jsonb_build_object(
    '머리', (select to_jsonb(x) from (
        select s.묶음키, s.기관, s.직군, s.지역,
          coalesce(s.고용형태, '고용형태 확인 필요') 고용형태, s.자리,
          s.회차, s.첫해, s.끝해, s.값있음, s.평균, s.가장높음, s.가장낮음,
          s.계산불가, s.짝확인필요, s.고용형태확인필요, s.한회뿐, s.합쳐짐,
          s.기본값단계, s.우리직군
        from alio_group_sum s where s.묶음키 = p_묶음키) x),

    '회차', (select coalesce(jsonb_agg(x order by x->>'마감' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'sn', e.sn, '묶음차례', e.group_no,
          '연도', e.year, '마감', e.end_ymd, '공고명', e.pbanc_ttl,
          '묶음이름', e.group_name, '자리', e.자리이름,
          '고용형태', e.고용형태, '고용형태출처', e.고용형태출처,
          '경쟁률', e.cmptt_rt, '경쟁률상태', e.cmptt_rt_state, '경쟁률출처', e.rt_src,
          '첫응시', e.first_aply, '끝선발', e.final_nope,
          '확정일', e.rsn_ymd, '합쳐짐', e.mixed,
          '기본값단계', e.step_kind_src = '기본값',
          '알리오화면', 'https://job.alio.go.kr/recruitview.do?idx=' || e.sn,
          /* 공고문(A) 을 앞에, 그 밖에(Z) 를 뒤에 */
          '첨부', (select coalesce(jsonb_agg(jsonb_build_object(
                      '이름', f.파일이름, '갈래', f.파일갈래,
                      '주소', 'https://www.alio.go.kr/download/download.json?fileNo=' || f.file_no,
                      '읽었나', (f.글 is not null and f.글 <> ''), '왜', f.왜)
                      order by case f.파일갈래 when 'A' then 0 when 'Z' then 1
                                              when 'C' then 2 else 3 end, f.sort_no), '[]'::jsonb)
                   from alio_post_file f where f.sn = e.sn),
          '단계', (select coalesce(jsonb_agg(jsonb_build_object(
                      '차', s.step_name, '무엇', s.step_kind,
                      '선발', s.recrut_nope, '응시', s.aply_nope, '확정일', s.rsn_ymd)
                      order by s.step_no), '[]'::jsonb)
                   from 줄 s where s.sn = e.sn and s.group_no = e.group_no)) x
        from 끝 e) t)
  ) into v;
  return v;
end $$;


ALTER FUNCTION public.admin_alio_group_one("p_묶음키" text) OWNER TO postgres;

--
-- Name: admin_alio_groups(text, text, text, integer, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_alio_groups("p_기관" text DEFAULT NULL::text, "p_직군" text DEFAULT NULL::text, "p_지역" text DEFAULT NULL::text, "p_연도" integer DEFAULT NULL::integer, "p_찾기" text DEFAULT NULL::text, "p_고용형태" text DEFAULT NULL::text, "p_다른직군" boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not is_admin() then raise exception '관리자만'; end if;

  with 볼것 as (select * from alio_group_sum where p_다른직군 or 우리직군),
  /* 우리 직군 묶음이 하나라도 있는 기관만 고르는 칸에 올립니다 */
  우리기관 as (select distinct 기관 from alio_group_sum where 우리직군),
  걸러진 as (
    select * from 볼것
    where (p_기관 is null or 기관 = p_기관)
      and (p_직군 is null or 직군 = p_직군)
      and (p_지역 is null or 지역 = p_지역)
      and (p_고용형태 is null or coalesce(고용형태, '고용형태 확인 필요') = p_고용형태)
      and (p_연도 is null or (p_연도 between 첫해 and 끝해))
      and (p_찾기 is null or p_찾기 = '' or 묶음키 ilike '%'||p_찾기||'%'
           or coalesce(자리,'') ilike '%'||p_찾기||'%'))
  select jsonb_build_object(
    '묶음', (select coalesce(jsonb_agg(to_jsonb(x) order by x.우리직군 desc, x.값있음 desc, x.묶음키), '[]'::jsonb)
             from (select 묶음키, 기관, 직군, 지역,
                     coalesce(고용형태, '고용형태 확인 필요') 고용형태, 자리,
                     회차, 첫해, 끝해, 값있음, 평균, 가장높음, 가장낮음, 계산불가,
                     짝확인필요, 고용형태확인필요, 한회뿐, 합쳐짐, 우리직군
                   from 걸러진 order by 우리직군 desc, 값있음 desc limit 600) x),
    '전체묶음수', (select count(*) from 걸러진),
    '다른직군', p_다른직군,
    '숨긴묶음', (select count(*) from alio_group_sum where not 우리직군),

    '고를것', jsonb_build_object(
      '기관', (select coalesce(jsonb_agg(distinct 기관 order by 기관), '[]'::jsonb)
               from (select 기관 from 볼것 where p_다른직군 or 기관 in (select 기관 from 우리기관)) z),
      '직군', (select coalesce(jsonb_agg(distinct 직군 order by 직군), '[]'::jsonb) from 볼것),
      '지역', (select coalesce(jsonb_agg(distinct 지역 order by 지역), '[]'::jsonb) from 볼것),
      '고용형태', (select coalesce(jsonb_agg(distinct coalesce(고용형태,'고용형태 확인 필요')
                     order by coalesce(고용형태,'고용형태 확인 필요')), '[]'::jsonb) from 볼것),
      '연도', (select coalesce(jsonb_agg(distinct year order by year desc), '[]'::jsonb)
               from alio_compete where year is not null)),

    /* ⚠ 아래 셈은 **우리 직군만**입니다. 남의 직군은 정리를 안 하므로 섞어 세지 않습니다 */
    '알림', (select jsonb_build_object(
        '읽은공고', (select count(*) from alio_compete_web_state),
        '못읽음',  (select count(*) from alio_compete_web_state where 왜 is not null),
        '아직',   (select count(*) from (select distinct sn from alio_compete) a
                   left join alio_compete_web_state s on s.sn = a.sn where s.sn is null),
        '마지막읽은때', (select max(읽은때) from alio_compete_web_state),
        '웹값',  (select count(*) from alio_compete_web where is_last and cmptt_rt_state = '있음'),
        'API값', (select count(*) from alio_compete     where is_last and cmptt_rt_state = '있음'),
        '요약갱신', (select max(갱신때) from alio_group_sum),
        '우리직군묶음', (select count(*) from alio_group_sum where 우리직군),
        '짝확인필요', (select count(*) from alio_group_sum where 우리직군 and 짝확인필요),
        '고용형태확인필요', (select count(*) from alio_group_sum where 우리직군 and 고용형태확인필요),
        '한회뿐', (select count(*) from alio_group_sum where 우리직군 and 한회뿐)))
  ) into v;
  return v;
end $$;


ALTER FUNCTION public.admin_alio_groups("p_기관" text, "p_직군" text, "p_지역" text, "p_연도" integer, "p_찾기" text, "p_고용형태" text, "p_다른직군" boolean) OWNER TO postgres;

--
-- Name: admin_alio_merge_candidates(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_alio_merge_candidates("p_직군" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      /* 화면에 「왜 비었나」 를 적으려고 같이 줍니다 */
      '모름이라 뺀 묶음', (select count(*) from alio_group_sum
                          where 우리직군 and 지역 in ('지역 모름','근무처 확인 필요')))
  ) into v;
  return v;
end $$;


ALTER FUNCTION public.admin_alio_merge_candidates("p_직군" text) OWNER TO postgres;

--
-- Name: admin_alio_set_hiretype(bigint, integer, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_alio_set_hiretype(p_sn bigint, p_group_no integer, "p_고용형태" text, "p_메모" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_전 text;
begin
  if not is_admin() then raise exception '관리자만'; end if;

  select 고용형태 into v_전 from alio_compete_web
   where sn = p_sn and group_no = p_group_no and is_last;

  if p_고용형태 is null or btrim(p_고용형태) = '' then
    delete from alio_hiretype_fix where sn = p_sn and group_no = p_group_no;
    update alio_compete_web set 고용형태 = null, 고용형태출처 = null
     where sn = p_sn and group_no = p_group_no;
    return jsonb_build_object('지웠습니다', true, '전', v_전);
  end if;

  insert into alio_hiretype_fix (sn, group_no, 고용형태, 누가, 메모)
  values (p_sn, p_group_no, btrim(p_고용형태), coalesce(auth.uid()::text, '관리자'), p_메모)
  on conflict (sn, group_no) do update set 고용형태 = excluded.고용형태,
    누가 = excluded.누가, 언제 = now(), 메모 = excluded.메모;

  /* 화면이 바로 보이게 여기서도 바꿔 둡니다. 묶음키는 다음 수집 때 다시 짜입니다 */
  update alio_compete_web set 고용형태 = btrim(p_고용형태), 고용형태출처 = '관리자 지정'
   where sn = p_sn and group_no = p_group_no;

  return jsonb_build_object('넣었습니다', btrim(p_고용형태), '전', v_전);
end $$;


ALTER FUNCTION public.admin_alio_set_hiretype(p_sn bigint, p_group_no integer, "p_고용형태" text, "p_메모" text) OWNER TO postgres;

--
-- Name: admin_api_quota(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_api_quota() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;
  return api_quota_today();
end $$;


ALTER FUNCTION public.admin_api_quota() OWNER TO postgres;

--
-- Name: admin_decide(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_decide(p_id text, p_what text, p_job_group text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_뒤 record;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if p_what not in ('살리기', '숨기기', '보류함으로', '잠금풀기') then
    raise exception '살리기 · 숨기기 · 보류함으로 · 잠금풀기 중 하나여야 합니다' using errcode = '22023';
  end if;
  if p_what = '살리기' and coalesce(p_job_group,'') not in ('물리치료사','작업치료사','공통') then
    raise exception '살릴 때는 직군을 골라야 합니다 (물리치료사 · 작업치료사 · 공통)' using errcode = '22023';
  end if;

  perform set_config('app.누가', '관리자', true);
  perform set_config('app.왜', p_what || coalesce(' · ' || p_note, ''), true);

  update job_posts set
    hold   = (p_what = '보류함으로'),
    hidden = (p_what = '숨기기'),
    job_group = case when p_what = '살리기' then p_job_group else job_group end,
    hidden_why = case when p_what = '숨기기'
                      then '관리자가 숨김' || coalesce(' · ' || p_note, '')
                      else null end,
    hidden_on = case when p_what = '숨기기' then (now() at time zone 'Asia/Seoul')::date else null end,
    /* 「잠금풀기」 는 규칙에 도로 맡기는 것입니다 */
    admin_locked = (p_what <> '잠금풀기'),
    admin_at = now(),
    admin_note = p_note,
    updated_at = now()
  where id = p_id
  returning id, hold, hidden, job_group, admin_locked into v_뒤;

  if v_뒤.id is null then
    raise exception '그런 공고가 없습니다: %', p_id using errcode = '22023';
  end if;

  /* 재판정 표에도 들어 있으면 빼야 다시 안 감춰집니다 */
  if p_what <> '숨기기' then
    delete from rejudge_hidden where job_id = p_id;
  end if;

  return jsonb_build_object('한 것', p_what, '공고', v_뒤.id,
    '보류', v_뒤.hold, '숨김', v_뒤.hidden, '직군', v_뒤.job_group, '잠금', v_뒤.admin_locked);
end $$;


ALTER FUNCTION public.admin_decide(p_id text, p_what text, p_job_group text, p_note text) OWNER TO postgres;

--
-- Name: FUNCTION admin_decide(p_id text, p_what text, p_job_group text, p_note text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.admin_decide(p_id text, p_what text, p_job_group text, p_note text) IS '관리자 결정 — 살리기·숨기기·보류함으로·잠금풀기. 결정하면 잠겨서 규칙이 못 덮어씁니다 (2026-09-29)';


--
-- Name: admin_hand_check(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_hand_check() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.결과 desc, x.이름), '[]'::jsonb)
    from (select 이름, 결과, 공고줄, 까닭, 어디서,
            마지막확인, 마지막열린날, 사람이본날, 메모,
            (now()::date - 마지막확인::date) 확인한지며칠,
            case when 사람이본날 is null then null
                 else (now()::date - 사람이본날) end 사람이본지며칠
          from hand_check) x);
end $$;


ALTER FUNCTION public.admin_hand_check() OWNER TO postgres;

--
-- Name: admin_hand_check_seen(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_hand_check_seen("p_이름" text, "p_메모" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만'; end if;
  update hand_check set 사람이본날 = current_date, 메모 = coalesce(p_메모, 메모)
   where 이름 = p_이름;
  if not found then raise exception '그런 곳이 없습니다: %', p_이름; end if;
  return jsonb_build_object('적었습니다', p_이름, '날', current_date);
end $$;


ALTER FUNCTION public.admin_hand_check_seen("p_이름" text, "p_메모" text) OWNER TO postgres;

--
-- Name: admin_new_collect_secret(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_new_collect_secret(p_source text, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_새것 text;
begin
  if not is_admin() then raise exception '관리자만'; end if;
  if p_source is null or btrim(p_source) = '' then raise exception 'source 를 주세요'; end if;
  if exists (select 1 from collect_secret
              where source = btrim(p_source) and note like '서버 전용%') then
    raise exception '% 에는 서버 전용 열쇠가 이미 있습니다. 지우고 다시 만드십시오', btrim(p_source);
  end if;

  v_새것 := replace(replace(encode(gen_random_bytes(32), 'base64'), '/', '_'), '+', '-');

  insert into collect_secret_all (source, secret, note, made_on)
  values (btrim(p_source), v_새것,
          coalesce(p_note, '서버 전용 (Lightsail 서울)'), current_date);

  return jsonb_build_object('source', btrim(p_source), 'secret', v_새것,
    '이 source 의 켜진 열쇠 수', (select count(*) from collect_secret where source = btrim(p_source)));
end $$;


ALTER FUNCTION public.admin_new_collect_secret(p_source text, p_note text) OWNER TO postgres;

--
-- Name: admin_ocr_zero(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_ocr_zero() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_오늘 int; v_줄 jsonb;
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;

  select count(*) into v_오늘 from ocr_zero
   where (때 at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;

  select coalesce(jsonb_agg(jsonb_build_object(
           '때', to_char(때 at time zone 'Asia/Seoul', 'MM-DD HH24:MI'),
           '경로', source, '공고', 공고, '파일', 파일이름,
           '바이트', 바이트, '앞5', 앞5, 'ctype', ctype,
           '두번째도0', 두번째도0, '원문', 원문) order by 때 desc), '[]'::jsonb)
    into v_줄
    from (select * from ocr_zero order by 때 desc limit 30) t;

  return jsonb_build_object('오늘', v_오늘, '줄', v_줄);
end $$;


ALTER FUNCTION public.admin_ocr_zero() OWNER TO postgres;

--
-- Name: admin_rival(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_rival() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_요약 jsonb; v_줄 jsonb; v_원인 jsonb; v_후보 jsonb;
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;

  select jsonb_build_object(
    '이번 주 비교', count(*) filter (where p.처음본때 > now() - interval '7 days'),
    '우리가 빠름', count(*) filter (where m.판정 = '우리가 빠름'),
    '우리가 늦음', count(*) filter (where m.판정 = '우리가 늦음'),
    '우리에게 없음', count(*) filter (where m.판정 like '%우리에게 없음'),
    '기존 (셈에서 뺌)', count(*) filter (where p.기존),
    '평균 늦은 시간', coalesce(round(avg(abs(m.차이시간)) filter (where m.판정 = '우리가 늦음'), 1), 0),
    '미처리', count(*) filter (where m.상태 = '미처리'))
    into v_요약
  from rival_post p left join rival_match m using (경쟁사, 글번호);

  select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) into v_원인
  from (select coalesce(m.원인, '(없음)') k, count(*) c
          from rival_match m where m.판정 <> '우리가 빠름' group by 1) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    '경쟁사', p.경쟁사, '글번호', p.글번호, '제목', p.제목, '기관분류', p.기관분류,
    '기관명', p.기관명, '지역', p.지역, '고용형태', p.고용형태, '링크', p.링크,
    '처음본때', to_char(p.처음본때 at time zone 'Asia/Seoul', 'MM-DD HH24:MI'),
    '기존', p.기존, '넣은이', p.넣은이,
    '판정', m.판정, '차이시간', m.차이시간, '원인', m.원인, '상태', m.상태, '메모', m.메모,
    '우리것', m.우리것,
    '우리제목', (select left(j.title, 80) from job_posts j where j.id = m.우리것),
    '우리경로', (select j.source from job_posts j where j.id = m.우리것))
    order by p.처음본때 desc), '[]'::jsonb) into v_줄
  from rival_post p left join rival_match m using (경쟁사, 글번호)
  where p.처음본때 > now() - interval '30 days';

  select coalesce(jsonb_agg(jsonb_build_object('기관명', 기관명, '어디서', 어디서,
    '상태', 상태, '메모', 메모) order by 올린때 desc), '[]'::jsonb) into v_후보
  from rival_org_todo;

  return jsonb_build_object('요약', v_요약, '원인별', v_원인, '줄', v_줄, '수집후보', v_후보);
end $$;


ALTER FUNCTION public.admin_rival() OWNER TO postgres;

--
-- Name: admin_rival_add(text, text, text, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_rival_add("p_경쟁사" text, "p_기관명" text, "p_제목" text, "p_본날짜" timestamp with time zone, "p_링크" text, "p_기관분류" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_번호 text;
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;
  v_번호 := '손' || to_char(now(), 'YYYYMMDDHH24MISS');
  insert into rival_post (경쟁사, 글번호, 제목, 기관분류, 기관명, 링크, 처음본때, 기존, 넣은이, 본날짜)
  values (p_경쟁사, v_번호, left(p_제목, 300), p_기관분류, left(p_기관명, 120), p_링크,
          coalesce(p_본날짜, now()), false, '손', p_본날짜);
  perform rival_match_run();
  return jsonb_build_object('넣음', v_번호);
end $$;


ALTER FUNCTION public.admin_rival_add("p_경쟁사" text, "p_기관명" text, "p_제목" text, "p_본날짜" timestamp with time zone, "p_링크" text, "p_기관분류" text) OWNER TO postgres;

--
-- Name: admin_rival_org_todo(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_rival_org_todo("p_기관명" text, "p_어디서" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;
  insert into rival_org_todo (기관명, 어디서) values (left(p_기관명, 120), left(p_어디서, 200))
  on conflict (기관명) do update set 어디서 = excluded.어디서, 올린때 = now(), 상태 = '후보';
  return jsonb_build_object('올림', p_기관명);
end $$;


ALTER FUNCTION public.admin_rival_org_todo("p_기관명" text, "p_어디서" text) OWNER TO postgres;

--
-- Name: admin_rival_set(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_rival_set("p_경쟁사" text, "p_글번호" text, "p_상태" text, "p_메모" text, "p_원인" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;
  update rival_match set 상태 = coalesce(p_상태, 상태), 메모 = p_메모,
         원인 = coalesce(p_원인, 원인)
   where 경쟁사 = p_경쟁사 and 글번호 = p_글번호;
  return jsonb_build_object('고침', found);
end $$;


ALTER FUNCTION public.admin_rival_set("p_경쟁사" text, "p_글번호" text, "p_상태" text, "p_메모" text, "p_원인" text) OWNER TO postgres;

--
-- Name: admin_stats_daily(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_stats_daily(p_days integer DEFAULT 30) RETURNS TABLE(day date, visits bigint, views bigint, admin_visits bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Seoul')::date - (p_days - 1),
      (now() at time zone 'Asia/Seoul')::date,
      interval '1 day')::date as d
  )
  select d,
         count(distinct h.day_key) filter (where not h.by_admin),
         count(h.id)               filter (where not h.by_admin),
         count(distinct h.day_key) filter (where h.by_admin)
  from days
  left join page_hits h on h.day = days.d
  group by d
  order by d;
end $$;


ALTER FUNCTION public.admin_stats_daily(p_days integer) OWNER TO postgres;

--
-- Name: admin_stats_devices(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_stats_devices(p_days integer DEFAULT 7) RETURNS TABLE(device text, visits bigint, views bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  select coalesce(h.device, '모름'),
         count(distinct h.day_key),
         count(h.id)
  from page_hits h
  where h.day >= (now() at time zone 'Asia/Seoul')::date - (p_days - 1)
    and not h.by_admin
  group by coalesce(h.device, '모름')
  order by 3 desc;
end $$;


ALTER FUNCTION public.admin_stats_devices(p_days integer) OWNER TO postgres;

--
-- Name: admin_stats_now(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_stats_now() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return jsonb_build_object(
    'today', today,
    'members',        (select count(*) from profiles where not excluded),
    'members_today',  (select count(*) from profiles
                       where not excluded
                         and (created_at at time zone 'Asia/Seoul')::date = today),
    'members_week',   (select count(*) from profiles
                       where not excluded and created_at >= now() - interval '7 days'),
    'job_groups', (select coalesce(jsonb_object_agg(coalesce(job_group, '안 정함'), n), '{}'::jsonb)
                   from (select job_group, count(*) n from profiles
                          where not excluded group by job_group) t),
    'roles',      (select coalesce(jsonb_object_agg(coalesce(role, '안 정함'), n), '{}'::jsonb)
                   from (select role, count(*) n from profiles
                          where not excluded group by role) t),
    'providers',  (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb)
                   from (select coalesce(u.raw_app_meta_data->>'provider', '알 수 없음') p,
                                count(*) n
                         from profiles pr join auth.users u on u.id = pr.id
                         where not pr.excluded
                         group by 1) t),
    'jobs',         (select count(*) from job_posts where not hidden and not hold),
    'jobs_open',    (select count(*) from job_posts
                     where not hidden and not hold
                       and (apply_to is null or apply_to >= today)),
    'jobs_today',   (select count(*) from job_posts
                     where (collected_at at time zone 'Asia/Seoul')::date = today),
    'jobs_hold',    (select count(*) from job_posts where hold),

    /* ★ 2026-10-09 — 예시 글은 안 셉니다 */
    'posts',        (select count(*) from posts where not hidden and not 시험자료),
    'posts_today',  (select count(*) from posts
                     where not 시험자료
                       and (created_at at time zone 'Asia/Seoul')::date = today),
    'comments',     (select count(*) from comments c where not c.hidden
                       and not exists (select 1 from posts p
                                        where p.id = c.post_id and p.시험자료)),
    'comments_today',(select count(*) from comments c
                     where (c.created_at at time zone 'Asia/Seoul')::date = today
                       and not exists (select 1 from posts p
                                        where p.id = c.post_id and p.시험자료)),

    'notify_on',    (select count(*) from notification_settings where agreed),
    'orgs',         (select count(*) from org_directory)
  );
end $$;


ALTER FUNCTION public.admin_stats_now() OWNER TO postgres;

--
-- Name: admin_stats_screens(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_stats_screens(p_days integer DEFAULT 7) RETURNS TABLE(kind text, views bigint, visits bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  select h.kind, count(*), count(distinct h.day_key)
  from page_hits h
  where not h.by_admin
    and h.day > (now() at time zone 'Asia/Seoul')::date - p_days
  group by h.kind
  order by 2 desc;
end $$;


ALTER FUNCTION public.admin_stats_screens(p_days integer) OWNER TO postgres;

--
-- Name: admin_stats_top_jobs(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_stats_top_jobs(p_days integer DEFAULT 7, p_limit integer DEFAULT 10) RETURNS TABLE(id text, title text, org_name text, views bigint, outs bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  with v as (
    select h.target as jid, count(*) n
    from page_hits h
    where h.kind = 'job' and not h.by_admin and h.target is not null
      and h.day > (now() at time zone 'Asia/Seoul')::date - p_days
    group by 1
  ), o as (
    select e.job_id, count(*) n
    from job_events e
    where e.kind = 'out' and e.created_at >= now() - (p_days || ' days')::interval
    group by 1
  )
  select j.id, j.title, j.org_name, coalesce(v.n, 0), coalesce(o.n, 0)
  from v
  join job_posts j on j.id = v.jid
  left join o on o.job_id = j.id
  order by coalesce(v.n, 0) desc
  limit p_limit;
end $$;


ALTER FUNCTION public.admin_stats_top_jobs(p_days integer, p_limit integer) OWNER TO postgres;

--
-- Name: admin_stats_top_posts(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_stats_top_posts(p_days integer DEFAULT 7, p_limit integer DEFAULT 10) RETURNS TABLE(id bigint, title text, channel text, views bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return query
  select p.id, coalesce(p.title, left(p.body, 30)), p.channel, count(h.id)
  from page_hits h
  join posts p on p.id::text = h.target
  where h.kind = 'post' and not h.by_admin
    and h.day > (now() at time zone 'Asia/Seoul')::date - p_days
  group by p.id, p.title, p.body, p.channel
  order by 4 desc
  limit p_limit;
end $$;


ALTER FUNCTION public.admin_stats_top_posts(p_days integer, p_limit integer) OWNER TO postgres;

--
-- Name: admin_공고내리기(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_공고내리기"(p_job text, "p_왜" text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_셈 integer;
begin
  if not is_admin() then raise exception '관리자만 할 수 있습니다' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_왜,''))) < 2 then
    raise exception '왜 내리는지 적어 주세요' using errcode = '22023'; end if;
  update 공고올림 set 끝낸까닭 = btrim(p_왜), 끝낸사람 = auth.uid(), 끝낸때 = now()
   where id in (select id from 공고올림_도는것 where job_id = p_job);
  get diagnostics v_셈 = row_count;
  return v_셈;
end $$;


ALTER FUNCTION public."admin_공고내리기"(p_job text, "p_왜" text) OWNER TO postgres;

--
-- Name: admin_공고신고목록(boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_공고신고목록"("p_처리전만" boolean DEFAULT true, p_page integer DEFAULT 0) RETURNS TABLE(id bigint, job_id text, "기관" text, "제목" text, "주소" text, "내린것" boolean, "사유" text, "신고시각" timestamp with time zone, "신고한사람" text, "처리시각" timestamp with time zone, "처리메모" text, "이공고신고수" integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다' using errcode = '42501'; end if;
  /* 신고한사람은 회원 번호 **앞 8자**뿐입니다 — 같은 사람이 여러 번 보냈는지만 알아보려는 것이고
     누구인지는 알 수 없습니다 (세중님 지시 — 신고에 필요한 만큼만) */
  return query
    select r.id, r.job_id, j.org_name, coalesce(j.보여줄제목, j.title), j.url,
           coalesce(j.hidden, false), r.reason, r.created_at,
           coalesce(left(r.reporter_id::text, 8), '탈퇴'),
           r.handled_at, r.handled_note,
           (select count(*)::int from 공고신고 x where x.job_id = r.job_id)
      from 공고신고 r left join job_posts j on j.id = r.job_id
     where (not p_처리전만 or r.handled_at is null)
     order by r.handled_at nulls first, r.created_at desc
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;


ALTER FUNCTION public."admin_공고신고목록"("p_처리전만" boolean, p_page integer) OWNER TO postgres;

--
-- Name: admin_공고신고처리(bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_공고신고처리"(p_id bigint, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있습니다' using errcode = '42501'; end if;
  update 공고신고 set handled_at = coalesce(handled_at, now()),
                      handled_by = auth.uid(),
                      handled_note = coalesce(p_note, handled_note)
   where id = p_id;
end $$;


ALTER FUNCTION public."admin_공고신고처리"(p_id bigint, p_note text) OWNER TO postgres;

--
-- Name: admin_공고올리기(text, text, integer, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_공고올리기"(p_job text, "p_왜" text, "p_순서" integer DEFAULT 100, "p_부터" date DEFAULT NULL::date, "p_까지" date DEFAULT NULL::date) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_오늘 date := (now() at time zone 'Asia/Seoul')::date; v_id bigint;
begin
  if not is_admin() then raise exception '관리자만 할 수 있습니다' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_왜,''))) < 2 then
    raise exception '왜 올리는지 적어 주세요' using errcode = '22023'; end if;
  if not exists (select 1 from job_posts where id = p_job) then
    raise exception '없는 공고입니다' using errcode = '22023'; end if;
  if p_까지 is not null and p_까지 < coalesce(p_부터, v_오늘) then
    raise exception '「까지」 가 「부터」 보다 앞입니다' using errcode = '22023'; end if;
  /* 돌고 있던 것은 끝냅니다 — 한 공고에 두 줄이 겹치지 않게 */
  update 공고올림 set 끝낸까닭 = '새로 올려서 바뀜', 끝낸사람 = auth.uid(), 끝낸때 = now()
   where id in (select id from 공고올림_도는것 where job_id = p_job);
  insert into 공고올림 (job_id, 순서, 부터, 까지, 왜, 올린사람)
  values (p_job, greatest(1, coalesce(p_순서, 100)), coalesce(p_부터, v_오늘),
          p_까지, btrim(p_왜), auth.uid())
  returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION public."admin_공고올리기"(p_job text, "p_왜" text, "p_순서" integer, "p_부터" date, "p_까지" date) OWNER TO postgres;

--
-- Name: admin_광고배너(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_광고배너"() RETURNS TABLE("자리" text, "이름" text, "그림" text, "링크" text, "표시초" integer, "켜짐" boolean, "시작일" date, "끝일" date, "지금나가나" boolean, "오늘봄" integer, "오늘누름" integer, "다봄" bigint, "다누름" bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.자리, b.이름, b.그림, b.링크, b.표시초, b.켜짐, b.시작일, b.끝일,
         exists (select 1 from 지금광고(b.자리)) 지금나가나,
         coalesce(t.봄, 0) 오늘봄, coalesce(t.누름, 0) 오늘누름,
         coalesce(a.봄, 0) 다봄,  coalesce(a.누름, 0) 다누름
    from 광고배너 b
    left join 광고셈 t on t.자리 = b.자리
         and t.날 = (now() at time zone 'Asia/Seoul')::date
    left join (select 자리, sum(봄) 봄, sum(누름) 누름 from 광고셈 group by 1) a
         on a.자리 = b.자리
   where is_admin()
   order by b.자리
$$;


ALTER FUNCTION public."admin_광고배너"() OWNER TO postgres;

--
-- Name: admin_광고배너고치기(text, text, text, text, integer, boolean, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_광고배너고치기"("p_자리" text, "p_이름" text, "p_그림" text, "p_링크" text, "p_표시초" integer, "p_켜짐" boolean, "p_시작일" date, "p_끝일" date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if p_자리 not in ('앱', '커뮤니티') then
    raise exception '자리는 앱 또는 커뮤니티입니다' using errcode = '22023';
  end if;
  update 광고배너
     set 이름 = nullif(btrim(coalesce(p_이름, '')), ''),
         그림 = nullif(btrim(coalesce(p_그림, '')), ''),
         링크 = nullif(btrim(coalesce(p_링크, '')), ''),
         /* 1~5초만. 밖으로 나가면 2초로 되돌립니다 — 10초짜리 광고를 못 넣게 */
         표시초 = least(greatest(coalesce(p_표시초, 2), 1), 5),
         켜짐 = coalesce(p_켜짐, false),
         시작일 = p_시작일, 끝일 = p_끝일,
         updated_at = now()
   where 자리 = p_자리;
  return jsonb_build_object('success', true,
    '지금나가나', exists (select 1 from 지금광고(p_자리)));
end $$;


ALTER FUNCTION public."admin_광고배너고치기"("p_자리" text, "p_이름" text, "p_그림" text, "p_링크" text, "p_표시초" integer, "p_켜짐" boolean, "p_시작일" date, "p_끝일" date) OWNER TO postgres;

--
-- Name: admin_교육기관(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_교육기관"(p_page integer DEFAULT 0) RETURNS TABLE("이름" text, "직군" text, "소개" text, "그림" text, "누리집" text, "차례" integer, "보임" boolean, "모음" boolean, "링크주소" text, "교육수" integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  return query
    select o.이름, o.직군, o.소개, o.그림, o.누리집, o.차례, o.보임, o.모음, o.링크주소,
           (select count(*)::int from 교육 e where e.출처 = o.이름)
      from 교육기관 o
     order by o.차례, o.이름
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;


ALTER FUNCTION public."admin_교육기관"(p_page integer) OWNER TO postgres;

--
-- Name: admin_교육기관고치기(text, text, text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_교육기관고치기"("p_이름" text, "p_소개" text, "p_그림" text, "p_누리집" text, "p_차례" integer, "p_보임" boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  update 교육기관
     set 소개 = nullif(btrim(coalesce(p_소개, '')), ''),
         그림 = nullif(btrim(coalesce(p_그림, '')), ''),
         누리집 = nullif(btrim(coalesce(p_누리집, '')), ''),
         차례 = coalesce(p_차례, 차례),
         보임 = coalesce(p_보임, 보임),
         updated_at = now()
   where 이름 = p_이름;
  get diagnostics v = row_count;
  if v = 0 then raise exception '그런 기관이 없습니다' using errcode = '22023'; end if;
  return jsonb_build_object('고침', v, '이름', p_이름);
end $$;


ALTER FUNCTION public."admin_교육기관고치기"("p_이름" text, "p_소개" text, "p_그림" text, "p_누리집" text, "p_차례" integer, "p_보임" boolean) OWNER TO postgres;

--
-- Name: admin_권한거두기(bigint, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_권한거두기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid; v_n int;
begin
  if not 대표인가() then raise exception '대표만 권한을 거둘 수 있습니다' using errcode = '42501'; end if;
  select id into v_id from profiles where 회원번호 = p_회원번호;
  if v_id is null then raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023'; end if;
  update 권한 set 끈때 = now(), 끈사람 = auth.uid()
   where profile_id = v_id and 권한코드 = p_코드 and 끈때 is null;
  get diagnostics v_n = row_count;
  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, p_코드, false, auth.uid(), p_까닭);
  return jsonb_build_object('거둠', p_코드, '줄', v_n);
end $$;


ALTER FUNCTION public."admin_권한거두기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) OWNER TO postgres;

--
-- Name: admin_권한기록(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_권한기록"("p_몇줄" integer DEFAULT 100) RETURNS TABLE("언제" timestamp with time zone, "누가" text, "누구에게" text, "권한코드" text, "준것인가" boolean, "까닭" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.언제, 준사람.nickname, 받은사람.nickname, r.권한코드, r.준것인가, r.까닭
    from 권한기록 r
    left join profiles 준사람   on 준사람.id   = r.누가
    left join profiles 받은사람 on 받은사람.id = r.누구에게
   where is_admin()
   order by r.언제 desc
   limit least(greatest(coalesce(p_몇줄, 100), 1), 500)
$$;


ALTER FUNCTION public."admin_권한기록"("p_몇줄" integer) OWNER TO postgres;

--
-- Name: admin_권한주기(bigint, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_권한주기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if not 대표인가() then raise exception '대표만 권한을 줄 수 있습니다' using errcode = '42501'; end if;
  select id into v_id from profiles where 회원번호 = p_회원번호;
  if v_id is null then raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023'; end if;
  if not exists (select 1 from admins where profile_id = v_id and 끈때 is null) then
    raise exception '먼저 직원으로 넣어 주십시오' using errcode = '42501'; end if;
  insert into 권한 (profile_id, 권한코드, 준사람) values (v_id, p_코드, auth.uid())
  on conflict (profile_id, 권한코드) where 끈때 is null do nothing;
  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, p_코드, true, auth.uid(), p_까닭);
  return jsonb_build_object('줌', p_코드, '회원번호', p_회원번호);
end $$;


ALTER FUNCTION public."admin_권한주기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) OWNER TO postgres;

--
-- Name: admin_담당자신청(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_담당자신청"("p_상태" text DEFAULT '심사중'::text) RETURNS TABLE(id bigint, "회원번호" bigint, "닉네임" text, "갈래" text, "기관이름" text, "교육기관" text, "사업자번호" text, "사업자상태" text, "상태" text, "신청때" timestamp with time zone, "자료수" integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select q.id, p.회원번호, p.nickname, q.갈래,
         (select o.이름 from 기관 o where o.기관번호 = q.기관번호),
         q.교육기관, q.사업자번호, q.사업자상태, q.상태, q.신청때,
         (select count(*)::int from 인증자료 d where d.자격id = q.id and d.지운때 is null)
    from 회원자격 q join profiles p on p.id = q.profile_id
   where 권한있나('기관승인')
     and (p_상태 is null or q.상태 = p_상태)
   order by q.신청때
$$;


ALTER FUNCTION public."admin_담당자신청"("p_상태" text) OWNER TO postgres;

--
-- Name: admin_담당자정하기(bigint, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_담당자정하기"("p_자격id" bigint, "p_상태" text, "p_까닭" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not 권한있나('기관승인') then
    raise exception '「기관 회원 승인」 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_상태 not in ('승인','반려','정지') then
    raise exception '승인 · 반려 · 정지 중 하나여야 합니다' using errcode = '22023';
  end if;

  update 회원자격
     set 상태 = p_상태, 정한사람 = auth.uid(), 정한때 = now(),
         반려까닭 = case when p_상태 = '반려' then p_까닭 else null end
   where id = p_자격id;

  return jsonb_build_object('자격id', p_자격id, '상태', p_상태);
end $$;


ALTER FUNCTION public."admin_담당자정하기"("p_자격id" bigint, "p_상태" text, "p_까닭" text) OWNER TO postgres;

--
-- Name: admin_동의기록(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_동의기록"(p_profile_id uuid DEFAULT NULL::uuid) RETURNS TABLE("회원번호" text, "닉네임" text, "문서" text, "판" text, "동의함" boolean, "동의시각" timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  perform 접속기록남기기('조회', '약관동의', p_profile_id, null);
  return query
    select '#' || lpad(p.회원번호::text, 5, '0'),
           case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           a.문서, a.판, a.동의함, a.동의시각
      from 약관동의 a join profiles p on p.id = a.profile_id
     where p_profile_id is null or a.profile_id = p_profile_id
     order by p.회원번호, a.동의시각 desc;
end $$;


ALTER FUNCTION public."admin_동의기록"(p_profile_id uuid) OWNER TO postgres;

--
-- Name: admin_마지막알림(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_마지막알림"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /* 관리자 화면에 「마지막으로 보낸 알림」 한 줄 (2026-10-11 세중님 결정).
     푸시는 GitHub Actions 가 하루 세 번 돌아서 화면에서 확인할 길이
     없었습니다. 보낸 기록(알림보낸것)을 한 줄로 보여 줍니다. */
  select case when not is_admin() then jsonb_build_object('왜', '관리자만')
    else jsonb_build_object(
      '마지막때',  (select max(보낸때) from 알림보낸것),
      '오늘보냄',  (select count(*) from 알림보낸것
                     where 보낸때 >= (date_trunc('day', now() at time zone 'Asia/Seoul')
                                      at time zone 'Asia/Seoul')),
      '모두보냄',  (select count(*) from 알림보낸것),
      '켜진기기',  (select count(*) from 알림기기 where 켜짐),
      '꺼진기기',  (select count(*) from 알림기기 where not 켜짐))
  end
$$;


ALTER FUNCTION public."admin_마지막알림"() OWNER TO postgres;

--
-- Name: admin_신고목록(boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_신고목록"("p_처리전만" boolean DEFAULT true, p_page integer DEFAULT 0) RETURNS TABLE(id bigint, "무엇" text, "대상" bigint, "신고한사람" text, "사유" text, "신고시각" timestamp with time zone, "처리시각" timestamp with time zone, "처리한사람" text, "처리메모" text, "대상글제목" text, "대상글쓴이" text, "대상글있나" boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  perform 접속기록남기기('조회(목록)', 'reports', null, null);
  return query
    select r.id, r.target_type, r.target_id,
           coalesce('#' || lpad(신.회원번호::text, 5, '0') || ' '
                    || case when 신.erased_at is null then 신.nickname else '탈퇴한 회원' end,
                    '(알 수 없음)'),
           r.reason, r.created_at,
           r.handled_at,
           coalesce('#' || lpad(처.회원번호::text, 5, '0') || ' ' || 처.nickname, null),
           r.handled_note,
           case when r.target_type = 'post'
                  then (select left(coalesce(p.title, p.body), 40) from posts p where p.id = r.target_id)
                when r.target_type = 'comment'
                  then (select left(c.body, 40) from comments c where c.id = r.target_id)
                else null end,
           case when r.target_type = 'post'
                  then (select coalesce('#' || lpad(a.회원번호::text, 5, '0') || ' '
                                || case when a.erased_at is null then a.nickname else '탈퇴한 회원' end, '-')
                          from posts p join profiles a on a.id = p.author_id where p.id = r.target_id)
                when r.target_type = 'comment'
                  then (select coalesce('#' || lpad(a.회원번호::text, 5, '0') || ' '
                                || case when a.erased_at is null then a.nickname else '탈퇴한 회원' end, '-')
                          from comments c join profiles a on a.id = c.author_id where c.id = r.target_id)
                else null end,
           case when r.target_type = 'post'
                  then exists (select 1 from posts p where p.id = r.target_id)
                when r.target_type = 'comment'
                  then exists (select 1 from comments c where c.id = r.target_id)
                else false end
      from reports r
      left join profiles 신 on 신.id = r.reporter_id
      left join profiles 처 on 처.id = r.handled_by
     where (not p_처리전만) or r.handled_at is null
     order by r.handled_at nulls first, r.created_at desc
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;


ALTER FUNCTION public."admin_신고목록"("p_처리전만" boolean, p_page integer) OWNER TO postgres;

--
-- Name: admin_신고처리(bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_신고처리"(p_id bigint, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  update reports
     set handled_at = coalesce(handled_at, now()),
         handled_by = auth.uid(),
         handled_note = coalesce(p_note, handled_note)
   where id = p_id;
  perform 접속기록남기기('고침(신고 처리)', 'reports', null, 1);
end $$;


ALTER FUNCTION public."admin_신고처리"(p_id bigint, p_note text) OWNER TO postgres;

--
-- Name: admin_올린공고목록(boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_올린공고목록"("p_지난것" boolean DEFAULT false) RETURNS TABLE(id bigint, job_id text, "기관" text, "제목" text, "순서" integer, "부터" date, "까지" date, "왜" text, "올린사람" text, "만든때" timestamp with time zone, "끝낸까닭" text, "끝낸사람" text, "끝낸때" timestamp with time zone, "지금도는가" boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다' using errcode = '42501'; end if;
  return query
    select b.id, b.job_id, j.org_name, coalesce(j.보여줄제목, j.title), b.순서,
           b.부터, b.까지, b.왜,
           coalesce(p.nickname, left(b.올린사람::text, 8)), b.만든때,
           b.끝낸까닭, coalesce(q.nickname, left(b.끝낸사람::text, 8)), b.끝낸때,
           (n.id is not null) as 지금도는가
      from 공고올림 b
      left join 공고올림_도는것 n on n.id = b.id
      left join job_posts j on j.id = b.job_id
      left join profiles p on p.id = b.올린사람
      left join profiles q on q.id = b.끝낸사람
     where p_지난것 or n.id is not null
     order by (n.id is not null) desc, b.순서, b.만든때 desc
     limit 200;
end $$;


ALTER FUNCTION public."admin_올린공고목록"("p_지난것" boolean) OWNER TO postgres;

--
-- Name: admin_운영진글감추기(bigint[], bigint[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_운영진글감추기"("p_글" bigint[], "p_댓글" bigint[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n_글 int := 0; n_댓 int := 0;
begin
  if not 권한있나('운영진글') then
    raise exception '「운영진 글 관리」 권한이 필요합니다' using errcode = '42501';
  end if;

  update posts set hidden = true, hidden_at = now(), hidden_by = auth.uid()
   where id = any(coalesce(p_글, '{}'))
     and not hidden
     and exists (select 1 from 운영진글 o where o.갈래 = '글' and o.글번호 = posts.id);
  get diagnostics n_글 = row_count;

  update comments set hidden = true
   where id = any(coalesce(p_댓글, '{}'))
     and not hidden
     and exists (select 1 from 운영진글 o where o.갈래 = '댓글' and o.글번호 = comments.id);
  get diagnostics n_댓 = row_count;

  return jsonb_build_object('감춘 글', n_글, '감춘 댓글', n_댓);
end $$;


ALTER FUNCTION public."admin_운영진글감추기"("p_글" bigint[], "p_댓글" bigint[]) OWNER TO postgres;

--
-- Name: admin_운영진글목록(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_운영진글목록"("p_역할" text DEFAULT NULL::text, "p_몇줄" integer DEFAULT 200) RETURNS TABLE("갈래" text, id bigint, "쓴역할" text, "제목" text, "미리" text, "방" text, "쓴때" timestamp with time zone, "감춤" boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select t.갈래, t.id, t.쓴역할, t.제목, t.미리, t.방, t.쓴때, t.감춤
    from (
      select o.갈래 as 갈래, p.id as id, o.쓴역할 as 쓴역할, p.title as 제목,
             left(coalesce(p.body,''), 60) as 미리, p.channel as 방,
             p.created_at as 쓴때, p.hidden as 감춤
        from 운영진글 o join posts p on p.id = o.글번호
       where 권한있나('운영진글') and o.갈래 = '글'
         and (p_역할 is null or o.쓴역할 = p_역할)
      union all
      select o.갈래, c.id, o.쓴역할, null,
             left(coalesce(c.body,''), 60),
             (select x.channel from posts x where x.id = c.post_id),
             c.created_at, c.hidden
        from 운영진글 o join comments c on c.id = o.글번호
       where 권한있나('운영진글') and o.갈래 = '댓글'
         and (p_역할 is null or o.쓴역할 = p_역할)
    ) t
   order by t.쓴때 desc
   limit least(greatest(coalesce(p_몇줄, 200), 1), 1000)
$$;


ALTER FUNCTION public."admin_운영진글목록"("p_역할" text, "p_몇줄" integer) OWNER TO postgres;

--
-- Name: admin_인증자료열기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_인증자료열기"("p_자료id" bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  if not 권한있나('기관승인') then
    raise exception '「기관 회원 승인」 권한이 필요합니다' using errcode = '42501';
  end if;
  select * into r from 인증자료 where id = p_자료id and 지운때 is null;
  if r is null then raise exception '없는 자료입니다' using errcode = '22023'; end if;

  insert into 인증자료열람 (자료id, 누가) values (p_자료id, auth.uid());
  perform 접속기록남기기('조회(인증자료)', '인증자료', r.profile_id, 1);

  return jsonb_build_object('갈래', r.갈래, '경로', r.경로, '올린때', r.올린때);
end $$;


ALTER FUNCTION public."admin_인증자료열기"("p_자료id" bigint) OWNER TO postgres;

--
-- Name: admin_재직인증(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_재직인증"("p_상태" text DEFAULT '심사중'::text) RETURNS TABLE(id bigint, "회원번호" bigint, "닉네임" text, "직군" text, "병원이름" text, "상태" text, "신청때" timestamp with time zone, "파일있나" boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.id, p.회원번호, p.nickname, p.job_group, r.병원이름, r.상태, r.신청때,
         (r.경로 is not null)
    from 재직인증 r join profiles p on p.id = r.profile_id
   where 권한있나('회원관리') and (p_상태 is null or r.상태 = p_상태)
   order by r.신청때
$$;


ALTER FUNCTION public."admin_재직인증"("p_상태" text) OWNER TO postgres;

--
-- Name: admin_재직인증열기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_재직인증열기"(p_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  if not 권한있나('회원관리') then
    raise exception '「회원 관리」 권한이 필요합니다' using errcode = '42501';
  end if;
  select * into r from 재직인증 where id = p_id;
  if r is null or r.경로 is null then
    raise exception '볼 파일이 없습니다' using errcode = '22023';
  end if;
  perform 접속기록남기기('조회(재직인증)', '재직인증', r.profile_id, 1);
  return jsonb_build_object('경로', r.경로, '병원이름', r.병원이름);
end $$;


ALTER FUNCTION public."admin_재직인증열기"(p_id bigint) OWNER TO postgres;

--
-- Name: admin_재직인증정하기(bigint, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_재직인증정하기"(p_id bigint, "p_상태" text, "p_까닭" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  if not 권한있나('회원관리') then
    raise exception '「회원 관리」 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_상태 not in ('확인','반려') then
    raise exception '확인 또는 반려여야 합니다' using errcode = '22023';
  end if;
  select * into r from 재직인증 where id = p_id;
  if r is null then raise exception '없는 신청입니다' using errcode = '22023'; end if;

  update 재직인증
     set 상태 = p_상태, 정한사람 = auth.uid(), 정한때 = now(),
         반려까닭 = case when p_상태 = '반려' then p_까닭 end,
         경로 = null, 파일지운때 = now()
   where id = p_id;

  perform 알림넣기(r.profile_id,
    case when p_상태 = '확인' then '재직확인' else '재직반려' end,
    case when p_상태 = '확인' then '재직 인증이 끝났어요' else '재직 인증을 다시 부탁드려요' end,
    p_까닭, '/me');

  return jsonb_build_object('id', p_id, '상태', p_상태, '파일 비움', true);
end $$;


ALTER FUNCTION public."admin_재직인증정하기"(p_id bigint, "p_상태" text, "p_까닭" text) OWNER TO postgres;

--
-- Name: admin_접속기록(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_접속기록"(p_page integer DEFAULT 0) RETURNS TABLE("언제" timestamp with time zone, "누가" text, "어디서" text, "무엇" text, "어느표" text, "누구것" uuid, "누구" text, "몇명" integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  return query
    select g.언제,
           coalesce('#' || lpad(한.회원번호::text, 5, '0') || ' '
                    || case when 한.erased_at is null then 한.nickname else '탈퇴한 회원' end,
                    g.누가::text),
           g.어디서, g.무엇, g.어느표, g.누구것,
           coalesce('#' || lpad(둘.회원번호::text, 5, '0') || ' '
                    || case when 둘.erased_at is null then 둘.nickname else '탈퇴한 회원' end,
                    '(여러 명 또는 없음)'),
           g.몇명
      from 개인정보접속기록 g
      left join profiles 한 on 한.id = g.누가
      left join profiles 둘 on 둘.id = g.누구것
     order by g.언제 desc
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;


ALTER FUNCTION public."admin_접속기록"(p_page integer) OWNER TO postgres;

--
-- Name: admin_제목확인(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_제목확인"() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;

  select jsonb_build_object(
    '지역모름', (select jsonb_build_object(
        '수', coalesce(sum(건), 0),
        '보기', coalesce(jsonb_agg(jsonb_build_object('기관', org_name, '출처', 출처,
                  '공고수', 건, '보기id', 보기id) order by org_name), '[]'::jsonb))
      from (select org_name, min(source) 출처, count(*) 건, min(id) 보기id
              from job_posts
             where not hidden and not hold
               and 제목지역기관(sido, work_place, org_name) is null
               and not (coalesce(work_place,'') ~ ',.*,')
               /* ★ 공공기관 본체가 직접 뽑는 공고는 지역이 없는 게 맞습니다 */
               and not 본체만뽑나(org_name, title)
             group by org_name) t),

    '지역여럿', (select jsonb_build_object(
        '수', count(*),
        '보기', coalesce(jsonb_agg(jsonb_build_object('id', id, '기관', org_name,
                  '근무지', work_place) order by id), '[]'::jsonb))
      from job_posts
       where not hidden and not hold and coalesce(work_place,'') ~ ',.*,'),

    '직군모름', (select jsonb_build_object(
        '수', count(*),
        '보기', coalesce(jsonb_agg(jsonb_build_object('id', id, '기관', org_name,
                  '원문', left(title, 60)) order by id), '[]'::jsonb))
      from job_posts
       where not hidden and not hold and coalesce(job_group,'') = ''),

    '기관이름줄임확인', (select jsonb_build_object(
        '수', count(*) filter (where not 승인했나),
        '보기', coalesce(jsonb_agg(jsonb_build_object('원래이름', 원래이름,
                  '줄인이름', 줄인이름, '승인했나', 승인했나) order by 원래이름)
                  filter (where not 승인했나), '[]'::jsonb))
      from 기관이름줄임)
  ) into v;
  return v;
end $$;


ALTER FUNCTION public."admin_제목확인"() OWNER TO postgres;

--
-- Name: admin_직원넣기(bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_직원넣기"("p_회원번호" bigint, "p_메모" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid; v_이름 text;
begin
  if not 대표인가() then raise exception '대표만 직원을 넣을 수 있습니다' using errcode = '42501'; end if;
  select id, nickname into v_id, v_이름 from profiles where 회원번호 = p_회원번호;
  if v_id is null then raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023'; end if;
  insert into admins (profile_id, 갈래, 넣은사람, 메모)
  values (v_id, '직원', auth.uid(), p_메모)
  on conflict (profile_id) do update
     set 갈래 = case when admins.갈래 = '대표' then '대표' else '직원' end,
         끈때 = null, 끈사람 = null, 메모 = coalesce(excluded.메모, admins.메모);
  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, '(직원 넣기)', true, auth.uid(), p_메모);
  return jsonb_build_object('넣음', v_이름, '회원번호', p_회원번호);
end $$;


ALTER FUNCTION public."admin_직원넣기"("p_회원번호" bigint, "p_메모" text) OWNER TO postgres;

--
-- Name: admin_직원목록(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_직원목록"() RETURNS TABLE(profile_id uuid, "회원번호" bigint, "닉네임" text, "갈래" text, "넣은때" timestamp with time zone, "끈때" timestamp with time zone, "권한" jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select a.profile_id, p.회원번호, p.nickname, a.갈래, a.added_at, a.끈때,
         coalesce((select jsonb_agg(g.권한코드 order by g.권한코드)
                     from 권한 g where g.profile_id = a.profile_id and g.끈때 is null),
                  '[]'::jsonb)
    from admins a join profiles p on p.id = a.profile_id
   where is_admin()
   order by (a.갈래 = '대표') desc, a.added_at
$$;


ALTER FUNCTION public."admin_직원목록"() OWNER TO postgres;

--
-- Name: admin_직원빼기(bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_직원빼기"("p_회원번호" bigint, "p_까닭" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid; v_갈래 text; v_거둔수 int;
begin
  if not 대표인가() then raise exception '대표만 직원을 뺄 수 있습니다' using errcode = '42501'; end if;
  select id into v_id from profiles where 회원번호 = p_회원번호;
  if v_id is null then raise exception '그 회원번호가 없습니다 (%)', p_회원번호 using errcode = '22023'; end if;
  select 갈래 into v_갈래 from admins where profile_id = v_id;
  if v_갈래 = '대표' then raise exception '대표는 뺄 수 없습니다' using errcode = '42501'; end if;
  update admins set 끈때 = now(), 끈사람 = auth.uid() where profile_id = v_id and 끈때 is null;
  update 권한 set 끈때 = now(), 끈사람 = auth.uid() where profile_id = v_id and 끈때 is null;
  get diagnostics v_거둔수 = row_count;
  insert into 권한기록 (누구에게, 권한코드, 준것인가, 누가, 까닭)
  values (v_id, '(직원 빼기)', false, auth.uid(), p_까닭);
  return jsonb_build_object('뺌', p_회원번호, '같이 거둔 권한', v_거둔수);
end $$;


ALTER FUNCTION public."admin_직원빼기"("p_회원번호" bigint, "p_까닭" text) OWNER TO postgres;

--
-- Name: admin_탈퇴이름(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_탈퇴이름"(p_profile_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare v_열쇠 text; v_암호 bytea;
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;

  select 이름암호 into v_암호 from erased_accounts where profile_id = p_profile_id;
  if v_암호 is null then
    perform 접속기록남기기('조회(이미 파기됨)', 'erased_accounts', p_profile_id, 1);
    return null;
  end if;

  perform 접속기록남기기('조회', 'erased_accounts.원래이름', p_profile_id, 1);

  select decrypted_secret into v_열쇠 from vault.decrypted_secrets where name = '탈퇴이름열쇠';
  return pgp_sym_decrypt(v_암호, v_열쇠);
end $$;


ALTER FUNCTION public."admin_탈퇴이름"(p_profile_id uuid) OWNER TO postgres;

--
-- Name: admin_회원목록(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_회원목록"(p_page integer DEFAULT 0) RETURNS TABLE("회원번호" text, "닉네임" text, "직군" text, "역할" text, "가입일" date, "탈퇴일" date, "글" bigint, "댓글" bigint, "급여넣음" boolean, "스펙넣음" boolean, "알림받음" boolean, "동의판" text, "동의시각" timestamp with time zone, id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  perform 접속기록남기기('조회(목록)', 'profiles', null, (select count(*)::int from profiles));
  return query
    select '#' || lpad(p.회원번호::text, 5, '0'),
           case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           coalesce(p.job_group, '-'),
           coalesce(p.role, '-'),
           (p.created_at at time zone 'Asia/Seoul')::date,
           (p.erased_at  at time zone 'Asia/Seoul')::date,
           (select count(*) from posts    where author_id = p.id),
           (select count(*) from comments where author_id = p.id),
           exists (select 1 from salary_records where profile_id = p.id),
           exists (select 1 from student_specs  where profile_id = p.id),
           exists (select 1 from notification_settings where profile_id = p.id and agreed),
           p.terms_version,
           p.terms_agreed_at,
           p.id
      from profiles p
     order by p.회원번호
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;


ALTER FUNCTION public."admin_회원목록"(p_page integer) OWNER TO postgres;

--
-- Name: admin_회원정보보기(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_회원정보보기"(p_profile_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;

  perform 접속기록남기기('조회', 'salary_records·student_specs·spec_langs', p_profile_id, 1);

  select jsonb_build_object(
    '급여', (select to_jsonb(s) from salary_records s where s.profile_id = p_profile_id),
    '스펙', (select to_jsonb(s) from student_specs  s where s.profile_id = p_profile_id),
    '어학', (select jsonb_agg(to_jsonb(l)) from spec_langs l where l.profile_id = p_profile_id))
  into v;
  return v;
end $$;


ALTER FUNCTION public."admin_회원정보보기"(p_profile_id uuid) OWNER TO postgres;

--
-- Name: admin_회원표(uuid[], integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."admin_회원표"(p_ids uuid[] DEFAULT NULL::uuid[], p_page integer DEFAULT 0) RETURNS TABLE(id uuid, "이름표" text, "회원번호" text, "닉네임" text, "탈퇴" boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있습니다' using errcode = '42501';
  end if;
  return query
    select p.id,
           '#' || lpad(p.회원번호::text, 5, '0') || ' '
             || case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           '#' || lpad(p.회원번호::text, 5, '0'),
           case when p.erased_at is null then p.nickname else '탈퇴한 회원' end,
           (p.erased_at is not null)
      from profiles p
     where p_ids is null or p.id = any(p_ids)
     order by p.회원번호
     limit 100 offset greatest(0, coalesce(p_page, 0)) * 100;
end $$;


ALTER FUNCTION public."admin_회원표"(p_ids uuid[], p_page integer) OWNER TO postgres;

--
-- Name: alio_compete_fix(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_fix(p_secret text, p_source text DEFAULT 'AL2'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  update alio_compete a set
    group_key   = g.k, group_steps = g.n,
    first_aply  = g.첫지원, final_nope = g.끝선발, step_order = g.자리,
    is_last     = g.끝인가,
    cmptt_rt    = case when g.끝인가 then a.cmptt_rt end,
    cmptt_rt_state = case
      when not g.끝인가                              then '해당없음'
      when g.끝선발 = 0                              then '못냄'
      when a.cmptt_rt is null                        then '미등록'
      when a.cmptt_rt = 0 and a.rsn_ymd is null      then '미등록'
      when a.cmptt_rt = 0 and coalesce(g.첫지원, -1) = 0 then '진짜0'
      when a.cmptt_rt = 0                            then '못냄'
      else '있음' end
  from (
    select x.sn, x.step_sn, x.k,
      (x.step_sn = coalesce((x.raw->>'maxStepSn')::bigint, x.step_sn)) 끝인가,
      (row_number() over (partition by x.sn, x.k order by x.step_sn) - 1)::smallint 자리,
      count(*) over (partition by x.sn, x.k)::smallint n,
      first_value(x.aply_nope)  over (partition by x.sn, x.k order by x.step_sn) 첫지원,
      last_value(x.recrut_nope) over (partition by x.sn, x.k order by x.step_sn
        rows between unbounded preceding and unbounded following) 끝선발
    from (select sn, step_sn, aply_nope, recrut_nope, raw,
            coalesce((raw->>'minStepSn')::bigint, step_sn) k from alio_compete) x
  ) g
  where a.sn = g.sn and a.step_sn = g.step_sn;
  get diagnostics v = row_count;

  return jsonb_build_object('고침', v,
    '묶음', (select count(*) from alio_compete where is_last),
    '있음', (select count(*) from alio_compete where is_last and cmptt_rt_state = '있음'),
    '못냄', (select count(*) from alio_compete where is_last and cmptt_rt_state = '못냄'),
    '진짜0', (select count(*) from alio_compete where is_last and cmptt_rt_state = '진짜0'),
    '미등록', (select count(*) from alio_compete where is_last and cmptt_rt_state = '미등록'),
    /* 우리가 직접 나눈 값과 알리오가 준 값이 같은지 — 다르면 0 이 아닙니다 */
    '안맞음', (select count(*) from alio_compete where is_last and cmptt_rt_state = '있음'
        and (first_aply is null or final_nope is null or final_nope = 0
          or abs(first_aply::numeric / final_nope - cmptt_rt) >= 0.51)));
end $$;


ALTER FUNCTION public.alio_compete_fix(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: alio_compete_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_ok int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into alio_compete (sn, step_sn, inst_nm, pbanc_ttl, step_ttl, end_ymd, year,
      sort_no, step_order, is_last, group_key, group_steps, first_aply, final_nope,
      recrut_nope, recrut_nope_state, aply_nope, aply_nope_state,
      cmptt_rt, cmptt_rt_state, rsn_ymd, our_job, mixed, raw)
    values ((r->>'sn')::bigint, (r->>'step_sn')::bigint, r->>'inst_nm', r->>'pbanc_ttl',
      r->>'step_ttl', nullif(r->>'end_ymd','')::date, nullif(r->>'year','')::smallint,
      nullif(r->>'sort_no','')::smallint, nullif(r->>'step_order','')::smallint,
      coalesce((r->>'is_last')::boolean, false),
      nullif(r->>'group_key','')::bigint, nullif(r->>'group_steps','')::smallint,
      nullif(r->>'first_aply','')::int, nullif(r->>'final_nope','')::int,
      nullif(r->>'recrut_nope','')::int, r->>'recrut_nope_state',
      nullif(r->>'aply_nope','')::int, r->>'aply_nope_state',
      nullif(r->>'cmptt_rt','')::numeric, r->>'cmptt_rt_state',
      nullif(r->>'rsn_ymd','')::date, r->>'our_job',
      coalesce((r->>'mixed')::boolean, false), r->'raw')
    on conflict (sn, step_sn) do update set
      step_ttl = excluded.step_ttl, step_order = excluded.step_order, is_last = excluded.is_last,
      group_key = excluded.group_key, group_steps = excluded.group_steps,
      first_aply = excluded.first_aply, final_nope = excluded.final_nope,
      recrut_nope = excluded.recrut_nope, recrut_nope_state = excluded.recrut_nope_state,
      aply_nope = excluded.aply_nope, aply_nope_state = excluded.aply_nope_state,
      cmptt_rt = excluded.cmptt_rt, cmptt_rt_state = excluded.cmptt_rt_state,
      rsn_ymd = excluded.rsn_ymd, our_job = excluded.our_job, mixed = excluded.mixed,
      raw = excluded.raw, taken_at = now();
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('담음', v_ok,
    '표 전체', (select count(*) from alio_compete),
    '공고 수', (select count(distinct sn) from alio_compete));
end $$;


ALTER FUNCTION public.alio_compete_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alio_compete_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_compete_state (
    "말" text NOT NULL,
    "다음쪽" integer DEFAULT 1 NOT NULL,
    "전체쪽" integer,
    "다한날" date,
    "마지막" timestamp with time zone DEFAULT now() NOT NULL,
    "메모" text
);


ALTER TABLE public.alio_compete_state OWNER TO postgres;

--
-- Name: alio_compete_state_get(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_state_get(p_secret text, p_source text) RETURNS SETOF public.alio_compete_state
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return query select * from alio_compete_state;
end $$;


ALTER FUNCTION public.alio_compete_state_get(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: alio_compete_state_put(text, text, text, integer, integer, date, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  insert into alio_compete_state (말, 다음쪽, 전체쪽, 다한날, 마지막, 메모)
  values (p_말, p_다음쪽, p_전체쪽, p_다한날, now(), p_메모)
  on conflict (말) do update set 다음쪽 = excluded.다음쪽, 전체쪽 = excluded.전체쪽,
    다한날 = excluded.다한날, 마지막 = now(), 메모 = excluded.메모;
  return jsonb_build_object('적음', p_말, '다음쪽', p_다음쪽);
end $$;


ALTER FUNCTION public.alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text) OWNER TO postgres;

--
-- Name: alio_compete_web_all(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_web_all(p_secret text, p_source text, p_limit integer DEFAULT 5000) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'sn', sn, 'inst_nm', inst_nm, 'pbanc_ttl', pbanc_ttl, 'end_ymd', end_ymd, 'year', year)
      order by sn desc), '[]'::jsonb)
    from (select distinct on (sn) sn, inst_nm, pbanc_ttl, end_ymd, year
          from alio_compete order by sn) a limit p_limit);
end $$;


ALTER FUNCTION public.alio_compete_web_all(p_secret text, p_source text, p_limit integer) OWNER TO postgres;

--
-- Name: alio_compete_web_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_web_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_ok int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if r ? '왜' then          -- 못 읽은 공고도 적어 둡니다 (다시 안 두드리게)
      insert into alio_compete_web_state (sn, 묶음수, 왜)
      values ((r->>'sn')::bigint, nullif(r->>'묶음수','')::smallint, r->>'왜')
      on conflict (sn) do update set 읽은때 = now(), 묶음수 = excluded.묶음수, 왜 = excluded.왜;
    else
      insert into alio_compete_web (sn, group_no, step_no, group_name, step_name,
        recrut_nope, aply_nope, rsn_ymd, is_last, group_steps, first_aply, final_nope,
        cmptt_rt, cmptt_rt_state, rt_src, our_job, mixed)
      values ((r->>'sn')::bigint, (r->>'group_no')::smallint, (r->>'step_no')::smallint,
        r->>'group_name', r->>'step_name',
        nullif(r->>'recrut_nope','')::int, nullif(r->>'aply_nope','')::int,
        nullif(r->>'rsn_ymd','')::date, coalesce((r->>'is_last')::boolean, false),
        nullif(r->>'group_steps','')::smallint, nullif(r->>'first_aply','')::int,
        nullif(r->>'final_nope','')::int, nullif(r->>'cmptt_rt','')::numeric,
        r->>'cmptt_rt_state', r->>'rt_src', r->>'our_job',
        coalesce((r->>'mixed')::boolean, false))
      on conflict (sn, group_no, step_no) do update set
        group_name = excluded.group_name, step_name = excluded.step_name,
        recrut_nope = excluded.recrut_nope, aply_nope = excluded.aply_nope,
        rsn_ymd = excluded.rsn_ymd, is_last = excluded.is_last,
        group_steps = excluded.group_steps, first_aply = excluded.first_aply,
        final_nope = excluded.final_nope, cmptt_rt = excluded.cmptt_rt,
        cmptt_rt_state = excluded.cmptt_rt_state, rt_src = excluded.rt_src,
        our_job = excluded.our_job, mixed = excluded.mixed, taken_at = now();
      v_ok := v_ok + 1;
    end if;
  end loop;
  return jsonb_build_object('담음', v_ok,
    '표 전체', (select count(*) from alio_compete_web),
    '공고 수', (select count(*) from alio_compete_web_state));
end $$;


ALTER FUNCTION public.alio_compete_web_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: alio_compete_web_todo(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_compete_web_todo(p_secret text, p_source text, p_limit integer DEFAULT 3000) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'sn', a.sn, 'inst_nm', a.inst_nm, 'pbanc_ttl', a.pbanc_ttl,
      'end_ymd', a.end_ymd, 'year', a.year) order by a.sn desc), '[]'::jsonb)
    from (select distinct on (sn) sn, inst_nm, pbanc_ttl, end_ymd, year
          from alio_compete order by sn) a
    left join alio_compete_web_state s on s.sn = a.sn
    where s.sn is null
    limit p_limit);
end $$;


ALTER FUNCTION public.alio_compete_web_todo(p_secret text, p_source text, p_limit integer) OWNER TO postgres;

--
-- Name: alio_group_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_group_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    update alio_compete_web set
      직군키 = r->>'직군키', 우리직군 = coalesce((r->>'우리직군')::boolean, false),
      지역 = r->>'지역', 고용형태 = r->>'고용형태', 고용형태출처 = r->>'고용형태출처',
      자리이름 = r->>'자리이름', 묶음키 = r->>'묶음키',
      짝확인필요 = coalesce((r->>'짝확인필요')::boolean, false),
      step_kind = r->>'step_kind', step_kind_src = r->>'step_kind_src'
    where sn = (r->>'sn')::bigint
      and group_no = (r->>'group_no')::smallint
      and step_no = (r->>'step_no')::smallint;
    v := v + 1;
  end loop;
  return jsonb_build_object('고침', v);
end $$;


ALTER FUNCTION public.alio_group_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: alio_group_refresh(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_group_refresh(p_secret text, p_source text DEFAULT 'AL2'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  truncate alio_group_sum;
  insert into alio_group_sum (묶음키, 기관, 직군, 지역, 고용형태, 자리, 회차, 첫해, 끝해,
    값있음, 평균, 가장높음, 가장낮음, 계산불가, 미등록,
    짝확인필요, 고용형태확인필요, 한회뿐, 합쳐짐, 기본값단계, 우리직군)
  select w.묶음키, min(c.inst_nm), min(w.직군키), coalesce(min(w.지역), '지역 모름'),
    min(w.고용형태), string_agg(distinct nullif(w.자리이름, ''), ' / '),
    count(*), min(c.year), max(c.year),
    count(*) filter (where w.cmptt_rt_state = '있음'),
    round(avg(w.cmptt_rt) filter (where w.cmptt_rt_state = '있음'), 1),
    max(w.cmptt_rt) filter (where w.cmptt_rt_state = '있음'),
    min(w.cmptt_rt) filter (where w.cmptt_rt_state = '있음'),
    count(*) filter (where w.cmptt_rt_state = '못냄'),
    count(*) filter (where w.cmptt_rt_state = '미등록'),
    bool_or(w.짝확인필요), bool_or(w.고용형태 is null), count(*) = 1,
    bool_or(w.mixed), bool_or(w.step_kind_src = '기본값'), bool_or(w.우리직군)
  from alio_compete_web w
  join (select distinct on (sn) sn, inst_nm, year from alio_compete order by sn) c on c.sn = w.sn
  where w.is_last and w.묶음키 is not null
  group by w.묶음키;
  get diagnostics v = row_count;

  /* ⚠ 세는 것은 **우리 직군만**입니다 (2026-09-30 · 세중님).
     남의 직군은 정리를 안 하므로 섞어 세면 숫자가 뜻을 잃습니다 */
  return jsonb_build_object('묶음', v,
    '우리직군묶음', (select count(*) from alio_group_sum where 우리직군),
    '짝확인필요', (select count(*) from alio_group_sum where 우리직군 and 짝확인필요),
    '고용형태확인필요', (select count(*) from alio_group_sum where 우리직군 and 고용형태확인필요),
    '한회뿐', (select count(*) from alio_group_sum where 우리직군 and 한회뿐));
end $$;


ALTER FUNCTION public.alio_group_refresh(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: alio_group_src(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_group_src(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'sn', g.sn, 'group_no', g.group_no, 'group_name', g.group_name,
      'our_job', g.our_job, 'mixed', g.mixed, 'group_steps', g.group_steps,
      'step_names', g.step_names,
      'inst_nm', c.inst_nm, 'year', c.year, 'end_ymd', c.end_ymd, 'pbanc_ttl', c.pbanc_ttl,
      '근무지', m.근무지, '고용형태', m.고용형태, '전형절차', m.전형절차,
      '첨부이름', coalesce(f.이름들, '[]'::jsonb),
      '첨부글',  coalesce(f.글들,   '[]'::jsonb),
      '관리자고용형태', x.고용형태,
      '관리자직군', d."직군")
      order by g.sn, g.group_no), '[]'::jsonb)
    from (select sn, group_no, min(group_name) group_name, min(our_job) our_job,
            bool_or(mixed) mixed, max(group_steps) group_steps,
            array_agg(step_name order by step_no) step_names
          from alio_compete_web group by sn, group_no) g
    join (select distinct on (sn) sn, inst_nm, year, end_ymd, pbanc_ttl
          from alio_compete order by sn) c on c.sn = g.sn
    left join alio_post_meta m on m.sn = g.sn
    left join (select sn,
                 jsonb_agg(파일이름 order by sort_no) 이름들,
                 jsonb_agg(글 order by sort_no) filter
                   (where 글 is not null and 글 <> '' and 파일갈래 in ('A','Z')) 글들
               from alio_post_file group by sn) f on f.sn = g.sn
    left join alio_hiretype_fix x on x.sn = g.sn and x.group_no = g.group_no
    left join "알리오직군고침" d on d.sn = g.sn and d.group_no = g.group_no);
end $$;


ALTER FUNCTION public.alio_group_src(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: alio_post_file_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_post_file_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into alio_post_file (sn, file_no, sort_no, 파일이름, 파일갈래, url)
    values ((r->>'sn')::bigint, (r->>'file_no')::bigint, nullif(r->>'sort_no','')::smallint,
      r->>'파일이름', r->>'파일갈래', r->>'url')
    on conflict (sn, file_no) do update set 파일이름 = excluded.파일이름,
      파일갈래 = excluded.파일갈래, url = excluded.url, taken_at = now();
    v := v + 1;
  end loop;
  return jsonb_build_object('담음', v, '표 전체', (select count(*) from alio_post_file));
end $$;


ALTER FUNCTION public.alio_post_file_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: alio_post_file_text_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_post_file_text_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    update alio_post_file set 글 = left(r->>'글', 20000), 왜 = r->>'왜'
     where sn = (r->>'sn')::bigint and file_no = (r->>'file_no')::bigint;
    v := v + 1;
  end loop;
  return jsonb_build_object('고침', v,
    '글 있는 첨부', (select count(*) from alio_post_file where 글 is not null and 글 <> ''));
end $$;


ALTER FUNCTION public.alio_post_file_text_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: alio_post_file_text_todo(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_post_file_text_todo(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'sn', f.sn, 'file_no', f.file_no, '이름', f.파일이름, '갈래', f.파일갈래, 'url', f.url)
      order by f.sn, f.sort_no), '[]'::jsonb)
    from alio_post_file f
    where f.파일갈래 in ('A','Z') and f.글 is null and f.왜 is null
      and f.sn in (select distinct sn from alio_compete_web where is_last and 고용형태 is null));
end $$;


ALTER FUNCTION public.alio_post_file_text_todo(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: alio_post_file_todo(text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_post_file_todo(p_secret text, p_source text, "p_모름만" boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('sn', a.sn) order by a.sn desc), '[]'::jsonb)
    from (select distinct sn from alio_compete
          where not p_모름만
             or sn in (select sn from alio_compete_web where is_last and 고용형태 is null)) a
    left join (select distinct sn from alio_post_file) f on f.sn = a.sn
    where f.sn is null);
end $$;


ALTER FUNCTION public.alio_post_file_todo(p_secret text, p_source text, "p_모름만" boolean) OWNER TO postgres;

--
-- Name: alio_post_meta_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_post_meta_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into alio_post_meta (sn, 근무지, 고용형태, 근무분야, 전형절차)
    values ((r->>'sn')::bigint, r->>'근무지', r->>'고용형태', r->>'근무분야', r->>'전형절차')
    on conflict (sn) do update set 근무지 = excluded.근무지, 고용형태 = excluded.고용형태,
      근무분야 = excluded.근무분야, 전형절차 = excluded.전형절차, taken_at = now();
    v := v + 1;
  end loop;
  return jsonb_build_object('담음', v, '표 전체', (select count(*) from alio_post_meta));
end $$;


ALTER FUNCTION public.alio_post_meta_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: alio_post_meta_todo(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_post_meta_todo(p_secret text, p_source text, p_limit integer DEFAULT 5000) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('sn', a.sn) order by a.sn desc), '[]'::jsonb)
    from (select distinct sn from alio_compete) a
    left join alio_post_meta m on m.sn = a.sn
    where m.sn is null limit p_limit);
end $$;


ALTER FUNCTION public.alio_post_meta_todo(p_secret text, p_source text, p_limit integer) OWNER TO postgres;

--
-- Name: alio_web_health(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_web_health() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not is_admin() then raise exception '관리자만'; end if;
  select jsonb_build_object(
    '읽은공고',  (select count(*) from alio_compete_web_state),
    '못읽음',   (select count(*) from alio_compete_web_state where 왜 is not null),
    '마지막읽은때', (select max(읽은때) from alio_compete_web_state),
    '아직',    (select count(*) from (select distinct sn from alio_compete) a
                left join alio_compete_web_state s on s.sn = a.sn where s.sn is null),
    /* 웹 ↔ API — API 가 몇 %나 주고 있나. 거의 같아지면 API 로 돌아갑니다 */
    '웹값',    (select count(*) from alio_compete_web where is_last and cmptt_rt_state = '있음'),
    'API값',   (select count(*) from alio_compete     where is_last and cmptt_rt_state = '있음'),
    '묶음',    (select count(*) from alio_compete_web where is_last),
    'API복귀가능', (select
        (select count(*) from alio_compete where is_last and cmptt_rt_state = '있음')::numeric
        >= 0.98 * (select count(*) from alio_compete_web where is_last and cmptt_rt_state = '있음'))
  ) into v;
  return v;
end $$;


ALTER FUNCTION public.alio_web_health() OWNER TO postgres;

--
-- Name: alio_web_peek(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alio_web_peek(p_secret text, p_source text, p_keys jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'sn', e.sn, 'group_no', e.group_no, 'group_name', e.group_name,
      'inst_nm', c.inst_nm, 'year', c.year, '묶음키', e.묶음키,
      '경쟁률', e.cmptt_rt, '상태', e.cmptt_rt_state,
      '단계', (select jsonb_agg(jsonb_build_object('차', s.step_name, '무엇', s.step_kind,
                 '선발', s.recrut_nope, '응시', s.aply_nope) order by s.step_no)
               from alio_compete_web s where s.sn = e.sn and s.group_no = e.group_no))), '[]'::jsonb)
    from alio_compete_web e
    join (select distinct on (sn) sn, inst_nm, year from alio_compete order by sn) c on c.sn = e.sn
    join jsonb_array_elements(p_keys) k
      on (k->>'sn')::bigint = e.sn and (k->>'group_no')::smallint = e.group_no
    where e.is_last);
end $$;


ALTER FUNCTION public.alio_web_peek(p_secret text, p_source text, p_keys jsonb) OWNER TO postgres;

--
-- Name: alive_mark(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alive_mark(p_secret text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  r jsonb; v_살아 int := 0; v_사라 int := 0; v_감춤 int := 0; v_모름 int := 0;
  v_마감표시 int := 0; v_기간채움 int := 0; v_되살림 int := 0; v_수시라패스 int := 0;
  v_까닭고침 int := 0;
  v_날 date; v_id text; v_기간 text;
  v_까닭 text;
begin
  if not exists (select 1 from collect_secret s where s.source = 'ALIVE' and s.secret = p_secret
                   and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  perform set_config('app.누가', '정찰 · 원문 확인', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_id := r->>'id';
    v_기간 := coalesce(r->>'접수기간', '');
    v_까닭 := coalesce(nullif(r->>'까닭', ''), '제목·본문에 마감');

    if v_기간 <> '' then
      if v_기간 ~ '채용\s*시|충원\s*시|결원\s*시|적격자|상시|수시' then
        v_수시라패스 := v_수시라패스 + 1;
      else
        v_날 := deadline_from_title(v_기간, v_오늘);
        if v_날 is not null then
          update job_posts
             set apply_to = v_날,
                 deadline_src = '정찰 · 본문 접수기간 (' || v_오늘 || ')'
           where id = v_id and apply_to is null and not admin_locked;
          if found then
            v_기간채움 := v_기간채움 + 1;
            if v_날 >= v_오늘 then
              update job_posts
                 set hidden = false, hidden_why = null, hidden_on = null, gone_streak = 0
               where id = v_id and hidden and not admin_locked
                 and coalesce(hidden_why, '') not like '%넘음%';
              if found then v_되살림 := v_되살림 + 1; end if;
            end if;
          end if;
        end if;
      end if;
    end if;

    update job_posts set hidden_why = '마감 지남'
     where id = v_id and hidden and not admin_locked
       and hidden_why like '%일 지남' and hidden_why not like '%(수시)%'
       and apply_to is not null and apply_to < v_오늘;
    if found then v_까닭고침 := v_까닭고침 + 1; end if;

    if (r->>'결과') = 'alive' then
      update job_posts set gone_streak = 0, seen_on = v_오늘 where id = v_id;
      v_살아 := v_살아 + 1;

    elsif (r->>'결과') = 'closed' then
      update job_posts
         set hidden = true, hold = false, seen_on = v_오늘,
             hidden_why = v_까닭, hidden_on = v_오늘
       where id = v_id and not hidden and not admin_locked;
      if found then v_마감표시 := v_마감표시 + 1; end if;
      update job_posts set hidden_why = v_까닭, seen_on = v_오늘
       where id = v_id and hidden and not admin_locked
         and hidden_why like '%일 지남' and hidden_why not like '%(수시)%';
      if found then v_까닭고침 := v_까닭고침 + 1; end if;

    elsif (r->>'결과') = 'gone' then
      update job_posts set gone_streak = least(coalesce(gone_streak,0) + 1, 9), seen_on = v_오늘
       where id = v_id and not admin_locked;
      v_사라 := v_사라 + 1;
      /* ★ 2026-10-18 — 까닭 글귀를 **「원문이 없어짐」 하나로** 모읍니다 (세중님 2번).
         전에는 여기만 「병원이 내림」 이었고, 제가 손으로 내릴 때는 「원문이 없어짐」 을
         써서 **같은 일에 글귀가 두 벌**이 됐습니다.
         ★ 이미 「병원이 내림」 으로 적힌 줄은 **그대로 둡니다** (세중님).
           그래서 읽는 쪽은 **원문없어짐까닭() 한 자리**를 봅니다 — 두 글귀를
           같은 것으로 다룹니다 (지침 6절). */
      update job_posts set hidden = true, hold = false,
             hidden_why = "원문없어짐까닭말"(), hidden_on = v_오늘
       where id = v_id and coalesce(gone_streak,0) >= 2 and not admin_locked
         /* ★ `hidden_why <> all(...)` 만 쓰면 **NULL 일 때 참이 아닙니다** —
            숨지 않은 공고는 hidden_why 가 NULL 이라 **주된 경우가 안 내려갑니다.**
            원래 `is distinct from` 은 NULL 에서 참이었습니다. 그 뜻을 지킵니다 */
         and (hidden_why is null or hidden_why <> all("원문없어짐까닭"()))
         and (not hidden or (hidden_why like '%일 지남' and hidden_why not like '%(수시)%'));
      if found then v_감춤 := v_감춤 + 1; end if;

    else
      v_모름 := v_모름 + 1;
    end if;
  end loop;

  return jsonb_build_object('살아 있음', v_살아, '사라짐', v_사라,
                            '두 번 연속이라 감춤', v_감춤, '제목·본문에 마감', v_마감표시,
                            '까닭 바로잡음', v_까닭고침,
                            '접수기간 채움', v_기간채움, '되살림', v_되살림,
                            '끝없는 공고라 안 채움', v_수시라패스,
                            '판단 못 함', v_모름);
end
$$;


ALTER FUNCTION public.alive_mark(p_secret text, p_rows jsonb) OWNER TO postgres;

--
-- Name: alive_targets(text, integer, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.alive_targets(p_secret text, p_n integer DEFAULT 200, "p_내린것" boolean DEFAULT false) RETURNS TABLE(id text, url text, org_name text, title text, gone_streak smallint, seen_on date)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = 'ALIVE' and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return query
    select j.id, j.url, j.org_name, j.title, j.gone_streak, j.seen_on
      from job_posts j
     where not j.hold
       and not coalesce(j.admin_locked, false)
       and coalesce(j.url,'') ~ '^https?://'
       and j.apply_to is null
       and (
         /* 보이는 공고 — 지금까지와 같습니다 */
         (not j.hidden
          and (j.seen_on is null or j.seen_on < (now() at time zone 'Asia/Seoul')::date - 6))
         /* 날수로 내린 공고 — 켤 때만 (2026-10-07) */
         or (p_내린것 and j.hidden
             and j.hidden_why like '%일 지남'
             and j.hidden_why not like '%(수시)%')
       )
     order by j.hidden, j.seen_on nulls first, j.first_seen
     limit greatest(p_n, 1);
end $$;


ALTER FUNCTION public.alive_targets(p_secret text, p_n integer, "p_내린것" boolean) OWNER TO postgres;

--
-- Name: api_quota_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.api_quota_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r jsonb; v_n int := 0;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(r->>'서비스','') = '' or (r->>'한도') is null then continue; end if;
    insert into api_quota (날, 서비스, 한도, 남음, 본때, 경로)
    values ((now() at time zone 'Asia/Seoul')::date,
            left(r->>'서비스', 200),
            nullif(r->>'한도','')::bigint,
            nullif(r->>'남음','')::bigint,
            now(), p_source)
    on conflict (날, 서비스) do update set
      한도 = excluded.한도,
      /* 더 적게 남은 쪽을 남깁니다 */
      남음 = least(api_quota.남음, excluded.남음),
      본때 = now(),
      경로 = excluded.경로;
    v_n := v_n + 1;
  end loop;

  delete from api_quota where 날 < (now() at time zone 'Asia/Seoul')::date - 60;
  return jsonb_build_object('남김', v_n);
end $$;


ALTER FUNCTION public.api_quota_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: api_quota_today(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.api_quota_today() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '줄', coalesce(jsonb_agg(jsonb_build_object(
            '서비스', 서비스, '한도', 한도, '남음', 남음, '쓴양', 쓴양,
            '몇퍼센트', round(100.0 * 쓴양 / nullif(한도,0)),
            '빨간줄', (100.0 * 쓴양 / nullif(한도,0)) >= 70,
            '본때', to_char(본때 at time zone 'Asia/Seoul', 'HH24:MI'))
          order by (1.0 * 쓴양 / nullif(한도,0)) desc), '[]'::jsonb),
    '넘은것', count(*) filter (where (100.0 * 쓴양 / nullif(한도,0)) >= 70))
  from api_quota
  where 날 = (now() at time zone 'Asia/Seoul')::date;
$$;


ALTER FUNCTION public.api_quota_today() OWNER TO postgres;

--
-- Name: apply_rejudged(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_rejudged() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int := 0;
begin
  perform set_config('app.누가', '재판정 다시 적용', true);
  perform set_config('app.왜', '다리가 시트 값으로 되돌린 것', true);
  update job_posts j
     set hidden = true, hold = false, hidden_why = r.why,
         hidden_on = r.decided_on, updated_at = now()
    from rejudge_hidden r
   where j.id = r.job_id
     and not j.admin_locked            -- ★ 관리자가 정한 것은 안 건드립니다
     and (not j.hidden or j.hold);
  get diagnostics n = row_count;
  return jsonb_build_object('재판정 다시 적용', n);
end $$;


ALTER FUNCTION public.apply_rejudged() OWNER TO postgres;

--
-- Name: FUNCTION apply_rejudged(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.apply_rejudged() IS '다리가 시트 값으로 되돌린 재판정 결정을 다시 적용합니다 (2026-09-28)';


--
-- Name: beat_health(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.beat_health() RETURNS TABLE("경로" text, "이름" text, "마지막" timestamp with time zone, "몇시간째" numeric, "평소간격시간" numeric, "기대간격시간" numeric, "마지막탈" text, "빨간줄" boolean, "왜" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 최근 as (
    select b.source, b.ran_at, b.ok, b.왜,
           row_number() over (partition by b.source order by b.ran_at desc) rn,
           lag(b.ran_at) over (partition by b.source order by b.ran_at desc) 앞
      from collector_beat b
     where b.ran_at > now() - interval '30 days'
  ),
  틈 as (
    /* 평소 몇 시간마다 오나 — 가운데값. 한 번 늦은 것으로 기준이 흔들리지 않게 */
    select source,
           percentile_cont(0.5) within group (
             order by extract(epoch from (앞 - ran_at)) / 3600.0) 평소
      from 최근 where 앞 is not null and rn <= 30
     group by source
  ),
  끝 as (select source, ran_at, ok, 왜 from 최근 where rn = 1),
  잰것 as (
    select k.source, k.ran_at, k.ok, k.왜,
           coalesce(s.name, k.source) 이름,
           round(coalesce(g.평소, 0)::numeric, 1) 평소,
           /* ★ 경로에 적어 둔 기준이 있으면 그것을 먼저 씁니다.
              주 1회 경로는 박동이 드물어 가운데값이 안 믿을 만합니다 —
              박동이 하나뿐이면 평소가 null 이라 12시간으로 보고,
              다음 날 바로 빨간 줄이 섰습니다 (2026-10-05) */
           round(coalesce(s."늦음기준시간", coalesce(g.평소, 12) * 2)::numeric, 1) 기대,
           extract(epoch from (now() - k.ran_at)) / 3600.0 지난시간
      from 끝 k
      left join 틈 g on g.source = k.source
      left join collect_source s on s.code = k.source
  )
  select source, 이름, ran_at, round(지난시간::numeric, 1), 평소, 기대,
         case when ok then '' else left(coalesce(왜, '까닭 안 적힘'), 200) end,
         (not ok) or 지난시간 > 기대,
         case when not ok then '마지막 실행이 탈났습니다'
              when 지난시간 > 기대 then '와야 할 때가 지났는데 안 왔습니다'
              else '' end
    from 잰것;
$$;


ALTER FUNCTION public.beat_health() OWNER TO postgres;

--
-- Name: FUNCTION beat_health(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.beat_health() IS '수집기가 제때 돌았는지. 평소 간격의 2배를 넘으면 빨간 줄 (2026-09-28)';


--
-- Name: bump_comment_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_comment_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;


ALTER FUNCTION public.bump_comment_count() OWNER TO postgres;

--
-- Name: bump_like_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_like_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;


ALTER FUNCTION public.bump_like_count() OWNER TO postgres;

--
-- Name: bump_nickname_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_nickname_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.nickname is distinct from old.nickname then
    if old.nickname_changes >= 5 then
      raise exception '닉네임은 5번까지 무료입니다';
    end if;
    new.nickname_changes := old.nickname_changes + 1;
  else
    new.nickname_changes := old.nickname_changes;   -- 손으로는 못 줄입니다
  end if;
  return new;
end $$;


ALTER FUNCTION public.bump_nickname_change() OWNER TO postgres;

--
-- Name: bump_post_view(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_post_view(p_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update posts set view_count = view_count + 1 where id = p_id and not hidden;
end $$;


ALTER FUNCTION public.bump_post_view(p_id bigint) OWNER TO postgres;

--
-- Name: bump_report_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_report_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.target_type = 'post' then
    update posts set report_count = report_count + 1 where id = new.target_id;
  end if;
  return null;
end $$;


ALTER FUNCTION public.bump_report_count() OWNER TO postgres;

--
-- Name: collect_after(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_after(p_secret text, p_source text, p_days integer DEFAULT 45, p_rolling_days integer DEFAULT 180) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_감춤 jsonb;
  v_샘 jsonb;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  v_감춤 := hide_stale_posts(p_days, p_rolling_days);
  v_샘 := pub_leak();
  return jsonb_build_object('감춤', v_감춤, '회원화면', v_샘);
end $$;


ALTER FUNCTION public.collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer) OWNER TO postgres;

--
-- Name: FUNCTION collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer) IS '수집기가 담은 뒤 부르는 뒷정리 — 지난 공고 감추기 + 회원 화면 새는지 세기. anon 열쇠로 부르고 권한은 열쇠 검사로 (2026-09-28)';


--
-- Name: collect_attach(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_attach(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok int := 0; v_bad int := 0; v_겹침 int := 0; v_공고없음 int := 0;
  /* ★ 2026-10-14 — 밤묶음 설정 표를 **안 읽습니다.** 그 표는 2026-10-11 밤
     사고(BEFORE INSERT 트리거가 기존 공고 278건을 보류함으로 보냄) 때 만든
     것이고 꺼져 있었습니다. 치우려는데 이 창구가 유일하게 읽고 있었습니다
     (지침 6절 — 부르는 곳을 먼저 셉니다).
     ※ 표 이름을 여기 적지 않습니다 — 「부르는 곳 0」 을 세는 검사에
       주석까지 걸려서 헷갈립니다 (2026-10-14 에 실제로 겪었습니다).
     job_attachments 의 묶음 칸은 남깁니다 — 앞으로 null 이 들어갑니다 */
  v_묶음 text := null; r jsonb; v_탈 text := null;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'job_id','') = '' or coalesce(r->>'url','') = '' then
        raise exception '공고ID 나 주소가 없습니다';
      end if;
      if r->>'url' ~ '&amp;|&#38;' then
        raise exception '주소에 &amp; 가 안 풀렸습니다';
      end if;
      if not exists (select 1 from job_posts j where j.id = r->>'job_id') then
        v_공고없음 := v_공고없음 + 1;
        continue;
      end if;

      insert into job_attachments (job_id, kind, name, url, "수집묶음")
      values (r->>'job_id', coalesce(r->>'kind', '공고문'),
              left(coalesce(r->>'name', ''), 200), r->>'url', v_묶음)
      on conflict (job_id, url) do nothing;

      if found then v_ok := v_ok + 1; else v_겹침 := v_겹침 + 1; end if;
    exception when others then
      v_bad := v_bad + 1;
      if v_탈 is null then v_탈 := left(sqlerrm, 160); end if;
    end;
  end loop;

  return jsonb_build_object(
    '담음', v_ok, '겹침', v_겹침, '건너뜀', v_bad, '공고없음', v_공고없음,
    '묶음', v_묶음, '첫탈', v_탈,
    '표 줄수', (select count(*) from job_attachments));
end
$$;


ALTER FUNCTION public.collect_attach(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: FUNCTION collect_attach(p_secret text, p_source text, p_rows jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.collect_attach(p_secret text, p_source text, p_rows jsonb) IS '수집기가 공고문 첨부 주소를 담는 창구. &amp; 안 풀린 주소는 막습니다 (2026-10-11)';


--
-- Name: collect_beat(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_beat(p_secret text, p_source text, p_beat jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  insert into collector_beat (source, took_ms, ok, 본곳, 담음, 보류, 버림, 못받음, 왜, 메모)
  values (p_source,
          nullif(p_beat->>'took_ms','')::int,
          coalesce((p_beat->>'ok')::boolean, true),
          nullif(p_beat->>'본곳','')::int, nullif(p_beat->>'담음','')::int,
          nullif(p_beat->>'보류','')::int, nullif(p_beat->>'버림','')::int,
          nullif(p_beat->>'못받음','')::int,
          left(coalesce(p_beat->>'왜',''), 2000),
          coalesce(p_beat->'메모', '{}'::jsonb));

  /* 오래된 것은 치웁니다 — 경로마다 최근 500줄만 */
  delete from collector_beat b
   where b.source = p_source
     and b.id < (select min(id) from (
           select id from collector_beat where source = p_source order by id desc limit 500) t);

  return jsonb_build_object('남김', true, '때', now());
end $$;


ALTER FUNCTION public.collect_beat(p_secret text, p_source text, p_beat jsonb) OWNER TO postgres;

--
-- Name: collect_body(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok int := 0; v_bad int := 0; v_바이트 bigint := 0;
  r jsonb;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'job_id','') = '' or coalesce(r->>'body','') = '' then
        raise exception '공고ID 나 본문이 없습니다';
      end if;
      insert into job_body as b (job_id, kind, ord, source, url, file_name, body)
      values (r->>'job_id', coalesce(r->>'kind','상세'),
              coalesce((r->>'ord')::smallint, 0), p_source,
              r->>'url', r->>'file_name',
              개인정보지움(r->>'body'))          -- ← 담기 전에 한 번만 지납니다
      on conflict (job_id, kind, ord) do update set
        body = excluded.body, url = excluded.url,
        file_name = excluded.file_name, taken_at = now();
      v_ok := v_ok + 1;
      v_바이트 := v_바이트 + octet_length(개인정보지움(r->>'body'));
    exception when others then
      v_bad := v_bad + 1;
    end;
  end loop;

  return jsonb_build_object('담음', v_ok, '건너뜀', v_bad, '바이트', v_바이트,
    '표 크기', pg_size_pretty(pg_total_relation_size('job_body')),
    'DB 크기', pg_size_pretty(pg_database_size(current_database())));
end $$;


ALTER FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: FUNCTION collect_body(p_secret text, p_source text, p_rows jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) IS '공고 원문을 내부 보관함(job_body)에 담습니다. 담기 전에 개인정보를 지웁니다 (2026-09-28)';


--
-- Name: collect_gap(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_gap(p_new text, p_old text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '새것', p_new, '옛것', p_old,
    '새것 줄', (select count(*) from job_posts where source = p_new),
    '옛것 줄', (select count(*) from job_posts where source = p_old),
    '새것에만 (옛 것이 놓침)',
      (select count(*) from job_posts n where n.source = p_new
        and not exists (select 1 from job_posts o where o.source = p_old and o.id = n.id)),
    '옛것에만',
      (select count(*) from job_posts o where o.source = p_old
        and not exists (select 1 from job_posts n where n.source = p_new and n.id = o.id)),
    '새것에만 · 갈래',
      (select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) from (
         select coalesce(nullif(n.org_kind, ''), '(빈칸)') k, count(*) c
           from job_posts n where n.source = p_new
            and not exists (select 1 from job_posts o where o.source = p_old and o.id = n.id)
          group by 1) t));
$$;


ALTER FUNCTION public.collect_gap(p_new text, p_old text) OWNER TO postgres;

--
-- Name: collect_gap_get(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_gap_get(p_secret text, p_source text, p_new text, p_old text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return collect_gap(p_new, p_old);
end $$;


ALTER FUNCTION public.collect_gap_get(p_secret text, p_source text, p_new text, p_old text) OWNER TO postgres;

--
-- Name: collect_peek(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_peek(p_secret text, p_source text, p_of text) RETURNS TABLE(id text, org_name text, title text, apply_to date, url text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return query
    select j.id, j.org_name, j.title, j.apply_to, j.url
      from job_posts j
     where j.source = p_of
     limit 5000;
end $$;


ALTER FUNCTION public.collect_peek(p_secret text, p_source text, p_of text) OWNER TO postgres;

--
-- Name: collect_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_ok int := 0; v_bad int := 0; v_나쁜 jsonb := '[]'::jsonb; r jsonb;
  v_짝 text;
  /* ★ 2026-10-14 — **두 해 뚜껑** (세중님 승인).
     병원·기관이 「채용시까지」 를 2099-12-31 · 2400-03-19 같은 먼 날짜로 적습니다.
     수집기 쪽에도 뚜껑이 있지만(hs_dates 의 너무먼날) 수집기가 일곱이라
     하나만 빼먹으면 되돌아갑니다 — 2026-10-14 에 CE49038(서산의료원)이
     클린아이 바퀴에 2400-03-19 로 되돌아간 것을 찾았습니다 (지침 6절 · 9절).
     그래서 **모든 수집기가 지나는 이 창구**에 마지막 그물을 둡니다. */
  v_뚜껑 date := ((now() at time zone 'Asia/Seoul')::date + 730);
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  select 옛출처 into v_짝 from 수집기짝 where 새출처 = p_source;

  perform set_config('app.누가', '수집기 ' || p_source, true);

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'id', '') = '' then raise exception '공고ID 가 없습니다'; end if;
      insert into job_posts as j (
        id, source, external_id, org_name, title, hire_type, employ_type,
        work_place, sido, sgg, edu, headcount, apply_from, apply_to, posted_at,
        url, job_group, form, org_kind, tab, hidden, hold, notify,
        detail, evidence, collected_at, updated_at,
        apply_to_time, deadline_src, "뽑은값", "뽑은법", "뽑은때")
      values (
        r->>'id', p_source, r->>'external_id', r->>'org_name', r->>'title',
        r->>'hire_type', r->>'employ_type', r->>'work_place', r->>'sido', r->>'sgg',
        r->>'edu', nullif(r->>'headcount','')::int,
        nullif(r->>'apply_from','')::date,
        /* 두 해 넘는 날짜는 안 믿습니다 — 비우고, 아래 deadline_src 에 원문을 적습니다 */
        (case when nullif(r->>'apply_to','')::date > v_뚜껑 then null
              else nullif(r->>'apply_to','')::date end),
        nullif(r->>'posted_at','')::date,
        r->>'url', r->>'job_group', r->>'form', r->>'org_kind', r->>'tab',
        coalesce((r->>'hidden')::boolean, false),
        coalesce((r->>'hold')::boolean, false),
        coalesce((r->>'notify')::boolean, false),
        coalesce(r->'detail', '{}'::jsonb), coalesce(r->'evidence', '{}'::jsonb),
        coalesce(nullif(r->>'collected_at','')::timestamptz, now()), now(),
        nullif(r->>'apply_to_time','')::time,
        (case when nullif(r->>'apply_to','')::date > v_뚜껑
              then '원문 날짜 ' || (r->>'apply_to') || ' → 채용시까지로 봄 (창구)'
              else nullif(r->>'deadline_src','') end),
        /* ★ 뽑은값 은 not null default '{}' 입니다 — null 을 넣으면 막힙니다
           (2026-10-11 에 클린아이 3건이 그렇게 막혔습니다) */
        coalesce(r->'뽑은값', '{}'::jsonb),
        nullif(r->>'뽑은법',''),
        case when r ? '뽑은값' then now() else null end)
      on conflict (id) do update set
        source = case when (j.source = p_source or j.source = v_짝) then excluded.source else j.source end,
        org_name   = case when 'org_name'   = any(coalesce(j.edited_fields,'{}')) then j.org_name
                          when (j.source = p_source or j.source = v_짝) then excluded.org_name   else j.org_name end,
        /* ★ 2026-10-19 — **잘린 제목으로 온전한 제목을 덮지 않습니다.**
           워크넷 목록 API 가 제목을 30자로 자릅니다. 14:20 에 97건을 상세 API 의
           온전한 제목으로 되메웠는데 14:27 수집기 한 바퀴에 95건이 되돌아갔습니다.
           work_place·apply_to 의 「빈 값으로 덮지 않기」와 같은 결입니다 */
        title      = case when 'title'      = any(coalesce(j.edited_fields,'{}')) then j.title
                          when (j.source = p_source or j.source = v_짝) then
                            case when excluded.title ~ '(\.\.\.|…)[[:space:]]*$'
                                  and j.title is not null
                                  and j.title !~ '(\.\.\.|…)[[:space:]]*$'
                                 then j.title              /* 온전한 것을 지킵니다 */
                                 else excluded.title end
                          else j.title end,
        hire_type  = case when 'hire_type'  = any(coalesce(j.edited_fields,'{}')) then j.hire_type
                          when (j.source = p_source or j.source = v_짝) then excluded.hire_type  else j.hire_type end,
        employ_type= case when 'employ_type'= any(coalesce(j.edited_fields,'{}')) then j.employ_type
                          /* ★ 2026-10-22 세중님 1번 — **본문에서 읽어 정한 값은 수집기가
                             안 덮습니다.** 규칙은 「고용형태는 공고 본문(·첨부)에서 읽어
                             정한다」(10-19)인데 이 한 줄에 져 있었습니다 —
                             10-22 12:01 수집기 HS3 가 되메운 168건을 다시 비웠고,
                             11:42 수집기 WN2 가 육아휴직 대체 공고 둘에 「정규직」을
                             다시 넣었습니다 (칸기록). 표시는 `뽑은값.고용형태근거` 입니다.
                             `edited_fields` 는 「**사람이** 고친 칸」이라 안 씁니다 */
                          when (j."뽑은값" ? '고용형태근거') then j.employ_type
                          /* ⓐ 수집기는 **빈 값으로 덮지 못합니다** — 모르는 것이 적힌
                             것을 지우면 안 됩니다. headcount·apply_to·apply_to_time·
                             work_place 에는 이미 같은 가드가 있습니다 */
                          when nullif(excluded.employ_type, '') is null then j.employ_type
                          /* ⓑ 창구는 **셋 중 하나만** 받습니다. 코드·낱말을 셋으로
                             옮기는 규칙은 `공고문읽기.mjs` 의 고용형태코드()·
                             고용형태판정() 한 자리이고 수집기가 이미 지납니다 —
                             여기서 규칙을 또 쓰면 기준이 두 벌이 됩니다 (지침 6절).
                             그래서 **울타리만** 둡니다. 「공무원」·「시간선택제」·
                             쉼표로 섞인 글자는 고용형태가 아니라서 **안 받습니다**
                             (지금 값은 그대로 둡니다 — 여기서 지우지 않습니다) */
                          when excluded.employ_type not in ('정규직', '계약직', '무기계약직')
                            then j.employ_type
                          when (j.source = p_source or j.source = v_짝) then excluded.employ_type
                          else j.employ_type end,
        /* ★ 2026-10-18 — headcount 와 같은 자리입니다. 되메우기·공고문읽기가 채운
           근무지를 수집기가 못 뽑으면 지워집니다. 이번에는 수집기가 값을 보내서
           살았을 뿐입니다 (운이 좋았던 것이고 구조는 뚫려 있었습니다) */
        work_place = case when 'work_place' = any(coalesce(j.edited_fields,'{}')) then j.work_place
                          when nullif(excluded.work_place, '') is null then j.work_place
                          when (j.source = p_source or j.source = v_짝) then excluded.work_place else j.work_place end,
        sido       = case when 'sido'       = any(coalesce(j.edited_fields,'{}')) then j.sido
                          when (j.source = p_source or j.source = v_짝) then excluded.sido       else j.sido end,
        sgg        = case when 'sgg'        = any(coalesce(j.edited_fields,'{}')) then j.sgg
                          when (j.source = p_source or j.source = v_짝) then excluded.sgg        else j.sgg end,
        edu        = case when 'edu'        = any(coalesce(j.edited_fields,'{}')) then j.edu
                          when (j.source = p_source or j.source = v_짝) then excluded.edu        else j.edu end,
        /* ★ 2026-10-18 — **빈 값으로 덮지 않습니다** (세중님 「뿌리부터」).
           2026-10-18 17:04 바퀴에서 되메우기가 채운 모집인원 4건이 통째로 지워졌습니다
           (광주보훈·충주의료원·성남시의료원·경북대병원). HS3 수집기는 모집인원을
           못 뽑아 null 을 보내는데, 여기에 null 가드가 없어 그대로 덮었습니다.
           바로 아래 apply_to_time 에는 그 가드가 **있어서** 마감시각은 살아남았습니다 —
           같은 자리인데 한쪽만 막혀 있었습니다 (지침 6절) */
        headcount  = case when 'headcount'  = any(coalesce(j.edited_fields,'{}')) then j.headcount
                          when excluded.headcount is null then j.headcount
                          when (j.source = p_source or j.source = v_짝) then excluded.headcount  else j.headcount end,
        /* ★ 2026-10-19 — headcount·work_place·apply_to_time 과 **같은 자리**입니다.
           수집기가 접수시작일을 못 뽑으면 null 을 보내는데 가드가 없어 지워졌습니다.
           새 값이 **있으면** 그대로 덮으니 기간 변경은 따라갑니다 */
        apply_from = case when 'apply_from' = any(coalesce(j.edited_fields,'{}')) then j.apply_from
                          when excluded.apply_from is null then j.apply_from
                          when (j.source = p_source or j.source = v_짝) then excluded.apply_from else j.apply_from end,
        /* ★★ 2026-10-19 세중님 ② 승인 — **빈 값으로 덮지 않습니다.**
           2026-10-18 에 headcount 를 고치면서 **이 칸을 일부러 뺐습니다. 그것이
           틀렸습니다.** 칸기록을 켠 첫 바퀴(10-19 08:00)에 5건이 지워졌고 그중
           경기도의료원 수원병원 공고는 마감 2026-10-22(사흘 뒤)가 지워진 채
           **회원 화면에 마감일 없이 보였습니다.** 원문에는 「○ 모집기간 :
           2026. 10. 12.(월) ~ 2026. 10. 22.(목) 12:00」 이 그대로 있었습니다 —
           「기관이 지운 것」이 아니라 **수집기가 못 읽은 것**이었습니다.
           바로 아래 apply_to_time 에는 가드가 있어 마감시각 12:00 은 살아남았고,
           그래서 **마감시각은 있는데 마감일이 없는** 꼴이 됐습니다.
           새 값이 **있으면** 그대로 덮으니 마감일 연장·단축은 따라갑니다 */
        apply_to   = case when 'apply_to'   = any(coalesce(j.edited_fields,'{}')) then j.apply_to
                          when excluded.apply_to is null then j.apply_to
                          when (j.source = p_source or j.source = v_짝) then excluded.apply_to   else j.apply_to end,
        /* ★ 2026-10-13 고침 — 비어 있으면 같은 날짜라도 채우고,
              차 있으면 마감일이 바뀔 때만 바꿉니다 (세중님 지시) */
        deadline_src = case
                          when j.admin_locked then j.deadline_src
                          when 'apply_to' = any(coalesce(j.edited_fields,'{}')) then j.deadline_src
                          when not (j.source = p_source or j.source = v_짝) then j.deadline_src
                          when nullif(r->>'apply_to','')::date > v_뚜껑
                            then '원문 날짜 ' || (r->>'apply_to') || ' → 채용시까지로 봄 (창구)'
                          when j.deadline_src is null
                            then coalesce(excluded.deadline_src, j.deadline_src)
                          when excluded.apply_to is distinct from j.apply_to
                            then excluded.deadline_src
                          else j.deadline_src end,
        posted_at  = case when 'posted_at'  = any(coalesce(j.edited_fields,'{}')) then j.posted_at
                          when (j.source = p_source or j.source = v_짝) then excluded.posted_at  else j.posted_at end,
        url        = case when (j.source = p_source or j.source = v_짝) then excluded.url        else j.url end,
        job_group  = case when j.admin_locked then j.job_group
                          when 'job_group'  = any(coalesce(j.edited_fields,'{}')) then j.job_group
                          when (j.source = p_source or j.source = v_짝) then excluded.job_group else j.job_group end,
        form       = case when 'form'       = any(coalesce(j.edited_fields,'{}')) then j.form
                          when (j.source = p_source or j.source = v_짝) then excluded.form       else j.form end,
        org_kind   = case when 'org_kind'   = any(coalesce(j.edited_fields,'{}')) then j.org_kind
                          when (j.source = p_source or j.source = v_짝) then excluded.org_kind   else j.org_kind end,
        hold       = case when j.admin_locked then j.hold
                          when 'hold'       = any(coalesce(j.edited_fields,'{}')) then j.hold
                          when j.hidden then false
                          when (j.source = p_source or j.source = v_짝) then excluded.hold else j.hold end,
        /* ★ 2026-10-18 — **통째 교체에서 병합으로** 바꿉니다.
           되메우기가 detail.지원자격 · detail.연봉 을 채우는데, 수집기 detail 로
           통째 덮으면 그 칸이 **사라집니다.** 바로 아래 「뽑은값」 은 이미 병합이고
           admin_locked 도 지킵니다 — 그 꼴을 그대로 가져옵니다 (지침 6절).
           같은 열쇠가 오면 새 값이 이깁니다. 없는 열쇠만 지킵니다 */
        detail     = case when j.admin_locked then j.detail
                          when excluded.detail is null or excluded.detail = '{}'::jsonb then j.detail
                          when (j.source = p_source or j.source = v_짝)
                               then coalesce(j.detail, '{}'::jsonb) || excluded.detail
                          else j.detail end,
        /* ★ 2026-10-23 세중님 승인 — **덮지 않고 합칩니다.**
           전에는 `then excluded.evidence` 라 통째로 덮었고, 수집기가 evidence 를
           안 보내면 `coalesce(r->'evidence','{}')` 가 들어와 **빈 꼴**이 됐습니다.
           2026-10-23 09:49 에 GJ305543 에 적은 직군 근거가 13:42 upsert 에 지워졌습니다
           (2026-10-14 결정 — 「근거를 evidence 에 원문 줄로」).
           꼴은 **위 `detail` 줄과 같습니다** (지침 6절 — 새로 만들지 않습니다). */
        evidence   = case when j.admin_locked then j.evidence
                          when excluded.evidence is null or excluded.evidence = '{}'::jsonb then j.evidence
                          when (j.source = p_source or j.source = v_짝)
                               then coalesce(j.evidence, '{}'::jsonb) || excluded.evidence
                          else j.evidence end,
        apply_to_time = case when 'apply_to_time' = any(coalesce(j.edited_fields,'{}')) then j.apply_to_time
                             when excluded.apply_to_time is null then j.apply_to_time
                             when (j.source = p_source or j.source = v_짝) then excluded.apply_to_time
                             else j.apply_to_time end,
        /* 빈 객체면 「이번에 공고문을 안 읽었다」는 뜻 — 건드리지 않습니다 */
        "뽑은값" = case when j.admin_locked then j."뽑은값"
                     when excluded."뽑은값" = '{}'::jsonb then j."뽑은값"
                     else coalesce(j."뽑은값", '{}'::jsonb) || excluded."뽑은값" end,
        "뽑은법" = coalesce(excluded."뽑은법", j."뽑은법"),
        "뽑은때" = case when excluded."뽑은값" = '{}'::jsonb then j."뽑은때" else now() end,
        updated_at = now()
      where j.source = p_source
         or j.source is null
         or (v_짝 is not null and j.source = v_짝);
      v_ok := v_ok + 1;
    exception when others then
      v_bad := v_bad + 1;
      if jsonb_array_length(v_나쁜) < 20 then
        v_나쁜 := v_나쁜 || jsonb_build_object('id', r->>'id', 'why', left(sqlerrm, 160));
      end if;
    end;
  end loop;

  return jsonb_build_object('담음', v_ok, '건너뜀', v_bad, '건너뛴것', v_나쁜);
end
$_$;


ALTER FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: FUNCTION collect_put(p_secret text, p_source text, p_rows jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb) IS '새 수집기의 유일한 쓰기 통로. 지우지 못하고, job_posts 말고는 못 쓰고, 정해둔 source 만 담습니다. 한 줄이 틀리면 그 줄만 건너뜁니다';


--
-- Name: collect_trash(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.collect_trash(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok int := 0; v_bad int := 0; v_나쁜 jsonb := '[]'::jsonb; r jsonb;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'id', '') = '' then raise exception '공고ID 가 없습니다'; end if;
      insert into job_trash as t (id, trashed_at, source, org_name, title, url, why, restored)
      values (r->>'id', coalesce(nullif(r->>'trashed_at','')::timestamptz, now()),
              p_source, r->>'org_name', r->>'title', r->>'url', r->>'why', false)
      on conflict (id) do update set
        /* **되돌린 줄은 안 건드립니다.** 관리자가 「잘못 버림」 을 눌러 둔 것을
           다음 수집이 지워버리면 그 표시가 뜻을 잃습니다 */
        why = case when t.restored then t.why else excluded.why end,
        title = case when t.restored then t.title else excluded.title end,
        trashed_at = case when t.restored then t.trashed_at else excluded.trashed_at end
      where t.source = p_source or t.source is null;
      v_ok := v_ok + 1;
    exception when others then
      v_bad := v_bad + 1;
      if jsonb_array_length(v_나쁜) < 20 then
        v_나쁜 := v_나쁜 || jsonb_build_object('id', r->>'id', 'why', left(sqlerrm, 160));
      end if;
    end;
  end loop;
  return jsonb_build_object('담음', v_ok, '건너뜀', v_bad, '건너뛴것', v_나쁜);
end $$;


ALTER FUNCTION public.collect_trash(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: comment_depth_guard(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.comment_depth_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.parent_id is not null then
    if exists (select 1 from comments c where c.id = new.parent_id and c.parent_id is not null) then
      raise exception '댓글은 2단까지만 달 수 있습니다';
    end if;
    if not exists (select 1 from comments c where c.id = new.parent_id and c.post_id = new.post_id) then
      raise exception '다른 글의 댓글에는 달 수 없습니다';
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION public.comment_depth_guard() OWNER TO postgres;

--
-- Name: deadline_from_title(text, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.deadline_from_title(p_title text, p_base date) RETURNS date
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  t    text := coalesce(p_title, '');
  base date := coalesce(p_base, (now() at time zone 'Asia/Seoul')::date);
  m    text[];
  y    int; mo int; d int;
  got  date := null;
begin
  /* ① 온전한 날짜 — 마지막 것을 씁니다 */
  for m in select regexp_matches(t, '(20\d{2})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})', 'g') loop
    y := m[1]::int; mo := m[2]::int; d := m[3]::int;
    if mo between 1 and 12 and d between 1 and 31 then
      begin got := make_date(y, mo, d); exception when others then null; end;
    end if;
  end loop;
  if got is not null then return got; end if;

  /* ①-2 ★ 2026-10-21 — **두 자리 해.** 「26. 11. 30.」 「26.10.14」 꼴입니다.
     울타리 — 앞뒤에 숫자가 없고 · yy 24~40 · 나온 날이 기준일 ±400일 안 */
  for m in select regexp_matches(t, '(?<![0-9])(\d{2})\s?[.\-/]\s?(\d{1,2})\s?[.\-/]\s?(\d{1,2})(?![0-9])', 'g') loop
    y := 2000 + m[1]::int; mo := m[2]::int; d := m[3]::int;
    if m[1]::int between 24 and 40 and mo between 1 and 12 and d between 1 and 31 then
      begin
        if make_date(y, mo, d) between base - 400 and base + 400 then
          got := make_date(y, mo, d);
        end if;
      exception when others then null;
      end;
    end if;
  end loop;
  if got is not null then return got; end if;

  /* ② 범위 표시가 있을 때만 M/D 를 읽습니다 */
  if t !~ '~|∼|～|까지|마감' then return null; end if;

  for m in select regexp_matches(t, '(?<![0-9])(\d{1,2})\s?[/.]\s?(\d{1,2})(?![0-9])', 'g') loop
    mo := m[1]::int; d := m[2]::int;
    /* 「1/4분기」 「3/4」 같은 것은 날짜가 아닙니다 — 뒤에 분기·기가 붙으면 건너뜁니다 */
    if t ~ (m[1] || '\s?[/.]\s?' || m[2] || '\s?(분기|기|차)') then continue; end if;
    if mo between 1 and 12 and d between 1 and 31 then
      begin
        got := make_date(extract(year from base)::int, mo, d);
        /* 12월에 본 「1/15」 는 이듬해입니다 */
        if got < base - 180 then got := make_date(extract(year from base)::int + 1, mo, d); end if;
      exception when others then got := null;
      end;
    end if;
  end loop;
  return got;
end $$;


ALTER FUNCTION public.deadline_from_title(p_title text, p_base date) OWNER TO postgres;

--
-- Name: exec_keys(text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.exec_keys(p_names text[]) RETURNS TABLE(nm text, k text, k_nosido text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select n, public.org_name_key(n), public.org_name_key(n, true)
  from unnest(p_names) as n
$$;


ALTER FUNCTION public.exec_keys(p_names text[]) OWNER TO postgres;

--
-- Name: fill_deadline_from_title(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fill_deadline_from_title() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int;
begin
  update job_posts j
  set apply_to = public.deadline_from_title(j.title, j.first_seen),
      deadline_src = '제목'
  where j.apply_to is null
    /* ★ 2026-10-09 — 담당자가 마감일을 비워 둔 것은 그렇게 올린 것입니다.
       제목에서 날짜를 캐내 채우면 담당자 뜻과 다른 마감일이 붙습니다 */
    and j.source <> 'BIZ'
    and public.deadline_from_title(j.title, j.first_seen) is not null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('제목에서 마감일 채움', v_n);
end $$;


ALTER FUNCTION public.fill_deadline_from_title() OWNER TO postgres;

--
-- Name: gojobs_recheck(text[], boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.gojobs_recheck(p_words text[], p_dry boolean DEFAULT true) RETURNS TABLE(job_id text, org_name text, title text, "했나" text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_batch text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD') || ' 전형이름 다시거르기';
begin
  create temp table _대상 on commit drop as
  select j.id, j.org_name, j.title
    from job_posts j
   where j.source = 'GJ'
     /* 아직 안 감춰진 것만 */
     and not exists (select 1 from job_hides h where h.job_id = j.id)
     /* 제목에 넘긴 낱말이 하나라도 있으면 */
     and exists (select 1 from unnest(p_words) w where j.title like '%' || w || '%')
     /* 직군이 붙은 것은 안 건드립니다 — 사람이 확인한 것입니다 */
     and j.job_group is null
     /* 기관 이름이 장애 관련이면 안 건드립니다 — 거기는 진짜 자리입니다 */
     and j.org_name !~ '장애|복지관|재활|발달|자립생활|특수교육';

  if not p_dry then
    insert into job_hides (job_id, org_name, title, reason, batch, added_on)
    select t.id, t.org_name, t.title,
           '제목의 「장애」가 채용 전형 이름입니다 — 우리 직군 자리가 아닙니다',
           v_batch, current_date
    from _대상 t
    on conflict (job_id) do nothing;
  end if;

  return query
  select t.id, t.org_name, t.title,
         case when p_dry then '감출 예정 (보기만 함)' else '감췄습니다' end
  from _대상 t order by t.org_name, t.id;
end $$;


ALTER FUNCTION public.gojobs_recheck(p_words text[], p_dry boolean) OWNER TO postgres;

--
-- Name: hand_check_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hand_check_put(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int := 0; r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into hand_check (이름, 결과, 공고줄, 까닭, 어디서, 마지막확인, 마지막열린날)
    values (r->>'이름', r->>'결과', nullif(r->>'공고줄','')::int, r->>'까닭', r->>'어디서',
            now(), case when r->>'결과' = '열림' then current_date end)
    on conflict (이름) do update set
      결과 = excluded.결과, 공고줄 = excluded.공고줄, 까닭 = excluded.까닭,
      어디서 = excluded.어디서, 마지막확인 = now(),
      /* 열린 적이 있으면 그날을 지우지 않습니다 */
      마지막열린날 = coalesce(excluded.마지막열린날, hand_check.마지막열린날);
    v := v + 1;
  end loop;
  return jsonb_build_object('적음', v);
end $$;


ALTER FUNCTION public.hand_check_put(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: hide_backfill_nodate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hide_backfill_nodate() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int;
begin
  update job_posts
  set hidden = true, hidden_why = '백필·날짜 없음', hidden_on = (now() at time zone 'Asia/Seoul')::date
  where source = 'HS2' and apply_to is null and posted_at is null and apply_from is null
    and hidden_why is distinct from '백필·날짜 없음';
  get diagnostics v_n = row_count;
  return jsonb_build_object('백필·날짜 없음', v_n);
end $$;


ALTER FUNCTION public.hide_backfill_nodate() OWNER TO postgres;

--
-- Name: hide_closed_by_title(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hide_closed_by_title() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_마감 int; v_결과 int;
begin
  update job_posts
  set hidden = true, hidden_why = '제목에 마감',
      hidden_on = coalesce(hidden_on, (now() at time zone 'Asia/Seoul')::date)
  where title ~ '[(<\[]\s*마감\s*[)>\]]|마감\s*완료|채용\s*완료|모집\s*마감|모집\s*종료|채용\s*종료|접수\s*마감\s*$|마감되었|종료되었'
    and hidden_why is distinct from '제목에 마감';
  get diagnostics v_마감 = row_count;

  update job_posts
  set hidden = true, hidden_why = '결과 공고',
      hidden_on = coalesce(hidden_on, (now() at time zone 'Asia/Seoul')::date)
  where title ~ '면접\s*대상자|서류\s*전형\s*합격|최종\s*합격|합격자|결과\s*발표|전형\s*결과|합격\s*발표|합격\s*안내|면접\s*일정\s*안내|서류\s*합격'
    and hidden_why is distinct from '결과 공고'
    and hidden_why is distinct from '제목에 마감';
  get diagnostics v_결과 = row_count;

  return jsonb_build_object('제목에 마감', v_마감, '결과 공고', v_결과);
end $_$;


ALTER FUNCTION public.hide_closed_by_title() OWNER TO postgres;

--
-- Name: hide_post(bigint, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hide_post(p_id bigint, p_hide boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_author uuid;
begin
  select author_id into v_author from posts where id = p_id;
  if v_author is null then
    raise exception '없는 글입니다';
  end if;

  if v_author <> auth.uid() and not is_admin() then
    raise exception '내 글만 지울 수 있습니다';
  end if;

  -- 되살리기는 관리자만. 글쓴이가 지웠다 살렸다 하면 감춘 기록이 뜻이 없어집니다
  if not p_hide and not is_admin() then
    raise exception '되살리는 것은 관리자만 할 수 있습니다';
  end if;

  update posts set
    hidden    = p_hide,
    hidden_at = case when p_hide then now() else null end,
    hidden_by = case when p_hide then auth.uid() else null end
  where id = p_id;
end $$;


ALTER FUNCTION public.hide_post(p_id bigint, p_hide boolean) OWNER TO postgres;

--
-- Name: FUNCTION hide_post(p_id bigint, p_hide boolean); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.hide_post(p_id bigint, p_hide boolean) IS '글 감추기·되살리기. 줄은 안 지웁니다 — 감춘 사람과 시각을 여기서 박습니다';


--
-- Name: hide_stale_posts(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hide_stale_posts(p_days integer DEFAULT 30, p_rolling_days integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_사유 text := p_days || '일 지남';
  v_정찰유효 int := 14;
  v_뚜껑일 int := 90;
  v_마감 int := 0; v_날수 int := 0; v_풀림 int := 0; v_정찰풀림 int := 0; v_뚜껑 int := 0;
begin
  perform set_config('app.누가', '지난 공고 감추기', true);

  /* ① 마감이 지난 것 — 보이는 공고만, 보류함은 뺍니다.
     ★ 2026-10-17 — `not admin_locked` 를 **뺐습니다.** 잠긴 공고도 마감이 지나면
       내립니다. 잠금은 「값을 덮어쓰지 마라」지 「내리지 마라」가 아닙니다.
     ★ 2026-10-17 — 날짜만 보던 것을 **날짜+시각(KST)** 으로 봅니다.
       `apply_to_time` 이 없으면 **그날 23:59 KST** 로 봅니다.
     담당자 공고도 여기서는 같이 내립니다 (마감일은 담당자가 적은 값입니다) */
  update job_posts set hidden = true, hold = false, hidden_why = '마감 지남', hidden_on = v_오늘
  where apply_to is not null
    and ((apply_to + coalesce(apply_to_time, time '23:59')) at time zone 'Asia/Seoul') < now()
    and not hidden and not hold;
  get diagnostics v_마감 = row_count;

  /* ② 마감일이 없고 아무 신호도 없는 것 — 지금까지와 같습니다 */
  update job_posts set hidden = true, hold = false, hidden_why = v_사유, hidden_on = v_오늘
  where apply_to is null and not admin_locked
    and source <> 'BIZ'
    and not hidden and not hold
    /* ★ 2026-10-28 세중님 ㉬ — **게시일 먼저**입니다. 전에는 담은 날만 봐서,
       늦게 담은 공고가 그만큼 오래 남았습니다 (청주성모 게시일 없음·담은날 09-17) */
    and coalesce(posted_at, first_seen, (collected_at at time zone 'Asia/Seoul')::date) < v_오늘 - p_days
    /* ★ 2026-10-28 세중님 ㉬ — **긁기(HS%) 는 정찰 면제를 안 받습니다.**
       긁기 정찰은 그 공고 쪽을 여는데, 병원이 옛 글을 안 내리면 그 쪽은 200 이고
       글도 그대로라 「살아 있다」가 맞습니다. 그래서 30일 규칙이 영영 안 걸렸습니다 —
       10/28 에 포항세명 55일 · 청주성모 41일 · 대자인 36일이 그렇게 남아 있었습니다 */
    and not (source not like 'HS%'
             and seen_on is not null and seen_on >= v_오늘 - v_정찰유효
             and coalesce(gone_streak, 0) = 0);
  get diagnostics v_날수 = row_count;

  /* ★ ②-2 날수 뚜껑 — **정찰이 살아 있다고 해도** 내립니다 (2026-10-12) */
  update job_posts set hidden = true, hold = false,
         hidden_why = v_뚜껑일 || '일 넘음 (정찰이 보고 있어도)', hidden_on = v_오늘
  where apply_to is null and not admin_locked
    and source <> 'BIZ'
    and not hidden and not hold
    and coalesce(first_seen, (collected_at at time zone 'Asia/Seoul')::date) < v_오늘 - v_뚜껑일;
  get diagnostics v_뚜껑 = row_count;

  /* ③ 마감이 늘어났으면 다시 보이게
     ★ 2026-10-17 — `not admin_locked` 를 뺐습니다(①과 짝). 안 빼면 잠긴 공고는
       내려가기만 하고 **영영 못 올라옵니다.**
     ★ 되살리는 것은 **이 함수가 내린 것만** 입니다 —
       `hidden_why = '마감 지남'` 정확히 같을 때만. 관리자가 다른 까닭으로 숨긴 것,
       쓰레기통, 보류함(hold)은 **절대 안 건드립니다** (세중님 조건). */
  /* ★ 2026-10-28 세중님 ㉱ — **관리자가 숨긴 공고는 자동으로 안 올라옵니다.**
     2026-10-17 에 not admin_locked 를 일부러 뺐는데(①과 짝), 그러면 안전이
     **까닭 글귀 하나**('마감 지남')에 걸립니다. 글귀가 바뀌면 조용히 뚫립니다.
     올리는 것은 관리자가 「살리기」를 누르는 자리입니다 */
  update job_posts set hidden = false, hidden_why = null, hidden_on = null
  where hidden and not hold and not admin_locked
    and hidden_why = '마감 지남'
    and apply_to is not null
    and ((apply_to + coalesce(apply_to_time, time '23:59')) at time zone 'Asia/Seoul') >= now();
  get diagnostics v_풀림 = row_count;

  /* ④ 날수로 내렸는데 정찰이 살아있다고 본 것은 다시 보이게
     — 「%일 지남」만 봅니다. 뚜껑(「…일 넘음」)은 여기서 안 풀립니다 */
  update job_posts set hidden = false, hidden_why = null, hidden_on = null
  where hidden and not admin_locked
    and hidden_why like '%일 지남'
    and apply_to is null
    /* ★ 2026-10-28 세중님 ㉬ — ②의 짝입니다. 여기에 울타리를 안 넣으면
       ②가 내린 긁기 공고를 **그 자리에서 다시 올립니다** */
    and source not like 'HS%'
    and seen_on is not null and seen_on >= v_오늘 - v_정찰유효
    and coalesce(gone_streak, 0) = 0;
  get diagnostics v_정찰풀림 = row_count;

  return jsonb_build_object('마감 지남', v_마감, v_사유, v_날수,
                            v_뚜껑일 || '일 뚜껑', v_뚜껑,
                            '다시 보이게', v_풀림, '정찰이 살아있다고 해서 다시 보이게', v_정찰풀림,
                            '기준일', v_오늘, '며칠', p_days,
                            '정찰 유효(일)', v_정찰유효, '날수 뚜껑(일)', v_뚜껑일,
                            '담당자 공고(BIZ)', '신호 없음으로는 안 내립니다',
                            '수시 며칠', '안 씁니다 — 정찰 규칙에 합쳤습니다');
end $$;


ALTER FUNCTION public.hide_stale_posts(p_days integer, p_rolling_days integer) OWNER TO postgres;

--
-- Name: FUNCTION hide_stale_posts(p_days integer, p_rolling_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.hide_stale_posts(p_days integer, p_rolling_days integer) IS '지난 공고를 회원 목록에서 감춤. 사유가 아니라 hidden 상태로 중복을 가립니다 (2026-09-28)';


--
-- Name: hide_www_twins(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hide_www_twins() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_숨김 int;
begin
  with 짝 as (
    select 옛.id
    from job_posts 옛
    join job_posts 새 on 새.org_name = 옛.org_name
                     and 새.title    = 옛.title
                     and 새.id      <> 옛.id
                     and replace(새.url, '://www.', '://') = replace(옛.url, '://www.', '://')
    where 옛.url like '%://www.%'
      and 새.url not like '%://www.%'
      and not 옛.hidden
  )
  update job_posts p
  set hidden = true,
      hidden_why = '주소가 www 없는 꼴로 바뀌어 같은 공고가 새 줄로 들어옴',
      hidden_on = coalesce(p.hidden_on, (now() at time zone 'Asia/Seoul')::date)
  from 짝
  where p.id = 짝.id;
  get diagnostics v_숨김 = row_count;

  return jsonb_build_object('숨긴 줄', v_숨김);
end $$;


ALTER FUNCTION public.hide_www_twins() OWNER TO postgres;

--
-- Name: FUNCTION hide_www_twins(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.hide_www_twins() IS '주소가 www 로만 다른 같은 공고의 옛 줄을 숨깁니다 (지우지 않음). 짝이 없으면 0.';


--
-- Name: hide_www_twins(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hide_www_twins(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return hide_www_twins();
end $$;


ALTER FUNCTION public.hide_www_twins(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: hira_name_key(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hira_name_key(s text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$ select public.org_name_key(s) $$;


ALTER FUNCTION public.hira_name_key(s text) OWNER TO postgres;

--
-- Name: hold_digest(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_보류 jsonb; v_샘 jsonb; v_늦음 jsonb; v_수 int; v_영자 int; v_한도 jsonb; v_기준 jsonb;
  v_신고 int; v_마름 jsonb; v_영자다시 int; v_의심 jsonb; v_못담음 jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by x->>'기관'), '[]'::jsonb), count(*)
    into v_보류, v_수
  from (
    select jsonb_build_object(
             '기관', j.org_name, '제목', left(j.title, 90), '주소', j.url,
             '까닭', left(coalesce(j.evidence->>'보류사유', j.evidence->>'사유', ''), 90),
             '경로', j.source, '마감', j.apply_to) x
      from job_posts j
     where j.hold and not j.hidden
       and j.collected_at > now() - make_interval(hours => p_hours)
     limit 120
  ) t;

  v_샘 := pub_leak();
  select coalesce(jsonb_agg(jsonb_build_object(
           '경로', b.이름, '몇시간째', b.몇시간째, '왜', b.왜)), '[]'::jsonb)
    into v_늦음 from beat_health() b where b.빨간줄;

  /* ★ 2026-10-11 — 둘로 나눕니다. 경보는 「두 번 다 0자」만 */
  select count(*) filter (where 두번째도0),
         count(*) filter (where not 두번째도0)
    into v_영자, v_영자다시
    from ocr_zero where 때 > now() - make_interval(hours => p_hours);

  v_한도 := api_quota_today();
  v_기준 := pub_baseline_check();
  select count(*) into v_신고 from 공고신고 where handled_at is null;
  v_마름 := 새공고마름();
  /* ★ 2026-10-14 — 「직군 의심」 (세중님 결정 3). 기관 원문에 우리 직군 말이
     없는데 직군이 붙어 회원 화면에 있는 공고. 통합공고는 따로 셉니다 */
  v_의심 := "직군의심"();
  /* ★ 2026-10-14 세중님 0번 — 수집기가 창구에 못 보낸 줄 */
  v_못담음 := "담지못한줄"(p_hours);

  return jsonb_build_object(
    '때', now(), '몇시간치', p_hours,
    '새 보류 건수', v_수, '새 보류', v_보류,
    '회원 화면', v_샘, '늦은 수집기', v_늦음,
    'PDF 0자', v_영자,
    'PDF 0자 다시읽힘', v_영자다시,
    '하루 한도', v_한도, '기준값', v_기준,
    '오류 신고', v_신고,
    '공고마름', v_마름,
    '직군 의심', v_의심,
    '담지 못한 줄', v_못담음,
    '보낼것있나', (v_수 > 0) or coalesce((v_샘->>'샘')::boolean, false)
                  or (jsonb_array_length(v_늦음) > 0) or (v_영자 > 0)
                  or (v_신고 > 0)
                  or coalesce((v_마름->>'마름')::boolean, false)
                  or coalesce((v_의심->>'의심')::int, 0) > 0
                  or coalesce((v_못담음->>'건수')::int, 0) > 0
                  or (coalesce((v_한도->>'넘은것')::int, 0) > 0)
                  or coalesce((v_기준->>'넘었나')::boolean, false));
end
$$;


ALTER FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer) OWNER TO postgres;

--
-- Name: FUNCTION hold_digest(p_secret text, p_source text, p_hours integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer) IS '하루 한 번 요약 — 새 보류 공고 · 회원 화면에 새는 것 · 늦은 수집기 (2026-09-28)';


--
-- Name: hold_rehab_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hold_rehab_only() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n_보류 int;
begin
  perform set_config('app.누가', '「재활치료」만으로 잡힌 것 보류', true);
  with 볼것 as (
    select id from job_posts
    where job_group is not null and hold = false and not admin_locked
      /* ★ 2026-10-09 — 담당자는 직군을 골라서 올립니다. 제목으로 다시
         짐작해 job_group 을 비우면 담당자가 적은 값을 덮습니다 */
      and source <> 'BIZ'
      and title ~ '재활치료' and title !~ '물리치료|작업치료'
      and coalesce(detail::text, '') !~ '물리치료|작업치료'
  ), 고침 as (
    update job_posts j set hold = true, job_group = null,
      evidence = coalesce(j.evidence, '{}'::jsonb) || jsonb_build_object(
        '보류사유', '「재활치료」만으로 잡힘 — 상세에 물리치료·작업치료 없음 (hold_rehab_only)')
    from 볼것 v where j.id = v.id returning j.id
  )
  select count(*) into n_보류 from 고침;
  return jsonb_build_object('재활치료만_보류', n_보류);
end $$;


ALTER FUNCTION public.hold_rehab_only() OWNER TO postgres;

--
-- Name: FUNCTION hold_rehab_only(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.hold_rehab_only() IS '「재활치료」만으로 직군이 잡힌 공고를 보류함으로. 지우지 않고 hold=true 만 둡니다 (2026-09-28)';


--
-- Name: home_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.home_stats() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    /* 심평원 병원 자료 — 병원 수와 직군별 치료사 수.
       치료사 합계는 두 값을 읽어 더합니다. 미리 더한 숫자를 두지 않습니다 */
    'hospitals', (select count(*) from hospitals),
    'ot',        (select coalesce(sum(ot), 0) from hospitals),
    'pt',        (select coalesce(sum(pt), 0) from hospitals),
    'hira_ver',  (select max(data_version) from hospitals),

    /* 직군별 참여 현황. 3명이 안 되면 중위값을 안 내보냅니다 —
       화면에서 가리는 게 아니라 여기서 아예 안 줍니다 */
    'joined', coalesce((
      select jsonb_agg(jsonb_build_object(
               'job', job, 'n', n,
               'mid', case when n >= 3 then mid end)
             order by n desc, job)
        from (
          select pr.job_group job,
                 count(*) n,
                 round(percentile_cont(0.5) within group (
                   order by sr.annual_total / 12.0)) mid
            from salary_records sr
            join profiles pr on pr.id = sr.profile_id and not pr.excluded
           where sr.pay_basis <> 'legacy' and sr.annual_total is not null
             and pr.job_group is not null
           group by pr.job_group
        ) z), '[]'::jsonb),
    'min_n', 3)
$$;


ALTER FUNCTION public.home_stats() OWNER TO postgres;

--
-- Name: hook_block_email_signup(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hook_block_email_signup(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare 제공자 text;
begin
  제공자 := event->'user'->'app_metadata'->>'provider';
  if 제공자 = 'email' then
    return jsonb_build_object('error', jsonb_build_object(
      /* 2026-10-11 — Apple 로그인을 이었으므로 말에도 넣습니다 */
      'message', '이메일로는 가입할 수 없어요. 카카오·네이버·Apple 로 시작해 주세요.',
      'http_code', 403));
  end if;
  return '{}'::jsonb;
end $$;


ALTER FUNCTION public.hook_block_email_signup(event jsonb) OWNER TO postgres;

--
-- Name: in_room(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.in_room(p_room bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists (select 1 from chat_members
                       where room_id = p_room and profile_id = auth.uid()) $$;


ALTER FUNCTION public.in_room(p_room bigint) OWNER TO postgres;

--
-- Name: FUNCTION in_room(p_room bigint); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.in_room(p_room bigint) IS 'RLS 규칙이 부릅니다. 위와 같은 이유로 열어 둡니다';


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from admins where profile_id = auth.uid() and 끈때 is null)
     and not exists (select 1 from 마스터페르소나
                      where auth_id = auth.uid() and 지금역할 <> '관리자')
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: FUNCTION is_admin(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_admin() IS 'RLS 규칙이 부릅니다. EXECUTE 를 빼면 규칙이 막힙니다 — 그래서 anon 에도 열려 있습니다';


--
-- Name: job_counts(text, text, text, boolean, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_counts(p_job text DEFAULT NULL::text, p_sido text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_all boolean DEFAULT false, p_tabs text[] DEFAULT NULL::text[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_out jsonb := '{}'::jsonb;
  v_tab text;
  v_n bigint;
begin
  if auth.uid() is null then
    raise exception '로그인해야 볼 수 있습니다' using errcode = '42501';
  end if;

  foreach v_tab in array coalesce(p_tabs, array[]::text[]) loop
    select count(*) into v_n
      from job_posts_pub j
     where (j.tab like v_tab or j.tab is null)
       and (p_job  is null or p_job  = '' or j.job_group = p_job)
       /* 시도는 sido_has 한 곳에서만 봅니다 — 긴 이름·쉼표 목록·전남광주 (2026-09-25) */
       and sido_has(j.sido, p_sido)
       and (p_all or j.apply_to >= v_today or j.apply_to is null)
       and (p_q is null or p_q = ''
            or j.title ilike '%' || p_q || '%'
            or j.org_name ilike '%' || p_q || '%');
    v_out := v_out || jsonb_build_object(v_tab, v_n);
  end loop;

  /* 겹치지 않게 센 전체 건수 — 탭이 빈 공고가 네 탭에 다 들어가므로
     탭 건수의 합은 전체보다 큽니다 (2026-10-07) */
  select count(*) into v_n
    from job_posts_pub j
   where (p_job  is null or p_job  = '' or j.job_group = p_job)
     and sido_has(j.sido, p_sido)
     and (p_all or j.apply_to >= v_today or j.apply_to is null)
     and (p_q is null or p_q = ''
          or j.title ilike '%' || p_q || '%'
          or j.org_name ilike '%' || p_q || '%');
  v_out := v_out || jsonb_build_object('(전체)', v_n);

  return v_out;
end $$;


ALTER FUNCTION public.job_counts(p_job text, p_sido text, p_q text, p_all boolean, p_tabs text[]) OWNER TO postgres;

--
-- Name: job_list(text, text, text, text, boolean, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_list(p_job text, p_sido text, p_tab text, p_q text, p_all boolean, p_sort text, p_page integer) RETURNS TABLE(id text, org_name text, title text, employ_type text, work_place text, sido text, job_group text, org_kind text, tab text, apply_from date, apply_to date, posted_at date, headcount integer, is_intern boolean, "지역보임" text, "올림" boolean, "마감표시" text, apply_to_time time without time zone, "조교연구" text, total bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  /* 한 번에 20건. 부르는 쪽이 더 달라고 해도 여기서 끊습니다 */
  v_size integer := 20;
begin
  if auth.uid() is null then
    raise exception '로그인해야 공고 목록을 볼 수 있습니다' using errcode = '42501';
  end if;

  return query
  with 거른것 as (
    select j.id, 기관이름보정_아이디로(j.id, j.org_name, coalesce(j."원문제목", j.title)) as org_name, j.title, j.employ_type, j.work_place,
           j.sido, j.job_group, j.org_kind, j.tab,
           j.apply_from, j.apply_to, j.posted_at, j.headcount, j.is_intern,
           j."지역보임", j.apply_to_time,
           j."조교연구",
           b.순서 as 올림순서,
           마감표시(j.apply_to, j.id, j.tab, j.org_name,
                    coalesce(j."원문제목", j.title), j."접수문장") as 마감표시
      from job_posts_pub j
      left join 공고올림_도는것 b on b.job_id = j.id
     where (p_job  is null or p_job  = '' or j.job_group = p_job)
       and sido_has(j.sido, p_sido)
       /* ★ tab 이 NULL 인 공고는 모든 탭에 보입니다 (2026-10-07 · 임시) */
       and (p_tab  is null or p_tab  = '' or j.tab like p_tab or j.tab is null)
       /* ★ 2026-10-08 — 마감 판정은 아직산공고인가() 한 곳에서만 합니다.
          마감일이 오늘이고 시각이 지났으면 여기서 빠집니다 */
       and (p_all or 아직산공고인가(j.apply_to, j.apply_to_time))
       and (p_q is null or p_q = ''
            or j.title ilike '%' || p_q || '%'
            or j.org_name ilike '%' || p_q || '%')
       /* 마감순은 마감일 있는 것만 — 없는 것을 섞으면 순서가 뜻이 없습니다 */
       and (p_sort is distinct from 'deadline'
            or (j.apply_to is not null and 아직산공고인가(j.apply_to, j.apply_to_time)))
  )
  select f.id, f.org_name, f.title, f.employ_type, f.work_place,
         f.sido, f.job_group, f.org_kind, f.tab,
         f.apply_from, f.apply_to, f.posted_at, f.headcount, f.is_intern,
         f."지역보임", (f.올림순서 is not null) as "올림",
         f.마감표시, f.apply_to_time,
         f."조교연구",
         (select count(*) from 거른것) as total
    from 거른것 f
   order by
     case when p_sort is null or p_sort in ('top', 'views') then f.올림순서 end asc nulls last,
     case when p_sort = 'deadline' then f.apply_to end asc nulls last,
     case when p_sort = 'views'    then 공고조회수(f.id) end desc nulls last,
     /* ★ 추천순 기본 계산 (2026-10-07 세중님 적용).
          ① 1층(공공·대학·종합) +2  ② 최근 7일 +1  ③ 마감이 7일 안 +1 */
     case when p_sort is null or p_sort = 'top' then
            (case when f.tab like '공공기관·대학·종합%' then 2 else 0 end)
          + (case when f.posted_at >= v_today - 7 then 1 else 0 end)
          + (case when f.apply_to between v_today and v_today + 7 then 1 else 0 end)
          end desc nulls last,
     f.posted_at desc nulls last,
     f.id
   limit v_size
  offset greatest(0, coalesce(p_page, 0)) * v_size;
end
$$;


ALTER FUNCTION public.job_list(p_job text, p_sido text, p_tab text, p_q text, p_all boolean, p_sort text, p_page integer) OWNER TO postgres;

--
-- Name: job_one(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_one(p_id text) RETURNS TABLE(id text, source text, org_name text, title text, hire_type text, employ_type text, work_place text, sido text, sgg text, edu text, headcount integer, apply_from date, apply_to date, posted_at date, url text, job_group text, org_kind text, tab text, detail jsonb, is_intern boolean, "지역보임" text, "마감표시" text, apply_to_time time without time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select j.id,
         /* ★ 2026-10-28 세중님 ㉭ — 출처를 내립니다. 화면이 공고 번호 앞머리로
            「긁기인가」를 짐작하던 자리를 없앱니다 (web/lib/job-state.ts 긁기공고인가).
            ★ job_posts_pub 뷰에는 source 칸이 **없습니다** — job_posts 를 따로
              읽습니다 (이 함수는 security definer 라 됩니다 · 모집인원과 같은 꼴) */
         (select x.source from job_posts x where x.id = j.id),
         기관이름보정_아이디로(j.id, j.org_name, coalesce(j."원문제목", j.title)), j.title, j.hire_type, j.employ_type,
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
              /* ★ 2026-10-24 세중님 ㉠ 승인 — **허용 목록**으로 좁힙니다.
                 전에는 `coalesce(j.detail, …)` 로 **통째로** 내렸습니다. 열쇠 28가지가
                 나가는데 화면이 읽는 것은 여덜이고, 그 속에 기관 담당자 **전화**
                 (detail.문의처 · 2건) · 사업자번호(265건) · **우리가 쓴 근거 글**(271건)이
                 섞여 있었습니다 (docs/오류잡기_1023.md ①②).
                 아래 열쇠는 web/app/jobs/[id]/page.tsx 가 읽는 여덜과, 2026-10-23 에
                 담기 시작한 지원 방법 둘(접수방법·기관홈페이지)입니다.
                 ★ 비회원 갈래(위)는 안 건드렸습니다. 칸을 더 보여 줄 일이 생기면
                   **이 목록에 열쇠를 더합니다** — 통째로 돌리지 않습니다. */
              else
              /* ★ 2026-10-28 세중님 ㉣ — **기관 표·사이트표의 기관 칸**을 함께 내립니다.
                 화면 지원링크() 가 ① detail.채용게시판 → ② detail.기관홈 → ③ url 차례로
                 보는데 ①②가 공고에 안 담겨 늘 ③이었습니다 (docs/표시규칙_1028.md E).
                 울타리 ㉠ 연결상태 '대기'(의심)면 **네 칸 전부 null**
                        ㉡ 기관번호가 NAME:… 이고 **확인한때가 없으면 채용페이지를 안 씁니다**
                           (기관.채용페이지 칸 주석 · 2026-10-24 세중님 ㉯)
                 ★ 공고가 준 값이 **이깁니다** — 아래에서 허용 목록을 합치기로 덮습니다.
                 ★ 담당자 개인 전화·메일은 안 내립니다 — 기관 표 전화는 기관 대표번호이고
                   허용 목록에 문의처·사업자번호·근거가 없습니다 (2026-10-24 ㉠) */
              coalesce((select jsonb_strip_nulls(jsonb_build_object(
                  '채용게시판',
                    case when p."연결상태" = '대기' then null
                         when p."기관번호" like 'NAME:%' and o."확인한때" is null then null
                         else coalesce(nullif(o."채용페이지", ''), nullif(s."채용주소", '')) end,
                  '기관홈',
                    case when p."연결상태" = '대기' then null
                         else coalesce(nullif(o."홈페이지", ''), nullif(s.url, '')) end,
                  '기관주소',
                    case when p."연결상태" = '대기' then null else nullif(o."주소", '') end,
                  '기관전화',
                    case when p."연결상태" = '대기' then null else nullif(o."전화", '') end))
                from job_posts p
                left join "기관" o on o."기관번호" = p."기관번호"
                /* 사이트표에 같은 열쇠가 여러 줄인 곳이 있어 **한 줄만** 고릅니다 */
                left join lateral (
                  select h."채용주소", h.url from hosp_sites h
                   where not h."끔"
                     and ((p."기관번호" like 'HIRA:%' and h.ykiho = substr(p."기관번호", 6))
                          or h."이름열쇠" = o."이름키")
                   order by (nullif(h."채용주소",'') is null), (nullif(h.url,'') is null), h.name
                   limit 1) s on true
               where p.id = j.id), '{}'::jsonb)
              || (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
                      from jsonb_each(coalesce(j.detail, '{}'::jsonb)) as e(k, v)
                     where e.k in ('연봉', '예상연봉', '지원자격', '접수마감글', '직군인원', '모집인원', '조교연구', '기관홈', '접수방법', '기관홈페이지'))
                   || jsonb_strip_nulls(jsonb_build_object('조교연구', j."조교연구"))
         end,
         j.is_intern, j."지역보임",
         마감표시(j.apply_to, j.id, j.tab, j.org_name,
                  coalesce(j."원문제목", j.title), j."접수문장"),
         j.apply_to_time
    from job_posts_pub j
   where j.id = p_id
$$;


ALTER FUNCTION public.job_one(p_id text) OWNER TO postgres;

--
-- Name: job_posts_first_seen_keep(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_posts_first_seen_keep() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_새 date := least(
    (coalesce(new.collected_at, now()) at time zone 'Asia/Seoul')::date,
    coalesce(new.posted_at, (coalesce(new.collected_at, now()) at time zone 'Asia/Seoul')::date),
    coalesce(new.apply_from, (coalesce(new.collected_at, now()) at time zone 'Asia/Seoul')::date));
begin
  if tg_op = 'INSERT' then
    new.first_seen := least(coalesce(new.first_seen, v_새), v_새);
  else
    /* **더 이른 날만 받습니다.** 누가 수집일을 오늘로 되돌려도 안 밀립니다 */
    new.first_seen := least(coalesce(old.first_seen, v_새), coalesce(new.first_seen, v_새), v_새);
  end if;
  return new;
end $$;


ALTER FUNCTION public.job_posts_first_seen_keep() OWNER TO postgres;

--
-- Name: job_posts_one_state_trg(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_posts_one_state_trg() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.hidden and new.hold then
    new.hold := false;
  end if;
  return new;
end $$;


ALTER FUNCTION public.job_posts_one_state_trg() OWNER TO postgres;

--
-- Name: job_state_log_trg(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_state_log_trg() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (old.hold is distinct from new.hold)
     or (old.hidden is distinct from new.hidden)
     or (old.job_group is distinct from new.job_group)
     or (old.hidden_why is distinct from new.hidden_why) then
    insert into job_state_log (job_id, 누가, 왜,
      옛_hold, 새_hold, 옛_hidden, 새_hidden, 옛_직군, 새_직군, 옛_까닭, 새_까닭)
    values (new.id,
      coalesce(
        nullif(current_setting('app.누가', true), ''),
        case when current_setting('role', true) = 'service_role'
             then nullif(
                    coalesce(nullif(current_setting('request.headers', true), '')::jsonb,
                             '{}'::jsonb) ->> 'x-who', '')
        end,
        case when current_setting('role', true) = 'service_role'
             then '(서버에서 바로 씀 · 이름 없음)'
        end,
        '(안 적힘)'),
      nullif(current_setting('app.왜', true), ''),
      old.hold, new.hold, old.hidden, new.hidden,
      old.job_group, new.job_group, old.hidden_why, new.hidden_why);
  end if;
  return new;
end $$;


ALTER FUNCTION public.job_state_log_trg() OWNER TO postgres;

--
-- Name: job_totals(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_totals() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'jobs',     (select count(*) from job_posts_pub),
    'deadline', (select count(*) from job_posts_pub
                  where apply_to >= (now() at time zone 'Asia/Seoul')::date
                    and apply_to <= (now() at time zone 'Asia/Seoul')::date + 7)
  )
$$;


ALTER FUNCTION public.job_totals() OWNER TO postgres;

--
-- Name: FUNCTION job_totals(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.job_totals() IS '홈에 쓰는 공고 개수. 줄은 안 나갑니다 — 그래서 로그인 없이 엽니다';


--
-- Name: job_views(text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.job_views(p_ids text[]) RETURNS TABLE(job_id text, views integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select i, 공고조회수(i) from unnest(p_ids) i
$$;


ALTER FUNCTION public.job_views(p_ids text[]) OWNER TO postgres;

--
-- Name: FUNCTION job_views(p_ids text[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.job_views(p_ids text[]) IS '공고 조회수. page_hits 를 센 값만 내줍니다 — 날것은 안 열립니다';


--
-- Name: keep_one_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.keep_one_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from admins) <= 1 then
    raise exception '관리자가 한 명뿐이라 내릴 수 없습니다';
  end if;
  return old;
end $$;


ALTER FUNCTION public.keep_one_admin() OWNER TO postgres;

--
-- Name: lang_bands(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lang_bands() RETURNS TABLE(exam text, points integer, min_score integer, levels text[], source text)
    LANGUAGE sql IMMUTABLE
    AS $$
  select * from (values
    /* 토익 0~990 — 옛 POTJOB 기준의 위쪽 경계를 그대로. 회원이 이미 아는 숫자입니다 */
    ('토익', 15, 800, null::text[], '옛 POTJOB 기준'),
    ('토익', 12, 700, null,         '옛 POTJOB 기준'),
    ('토익',  9, 600, null,         '옛 POTJOB 기준'),
    ('토익',  5, 500, null,         '옛 POTJOB 기준'),
    ('토익',  2, null, null,        '넣었으면 최소 2점'),

    /* 텝스 0~600 — teps.or.kr 공식 등급표 그대로.
       1+ 526~600 · 1 453~525 · 2+ 387~452 · 2 327~386 */
    ('텝스', 15, 526, null, 'teps.or.kr 공식 등급표 · 1+ 등급'),
    ('텝스', 12, 453, null, 'teps.or.kr 공식 등급표 · 1 등급'),
    ('텝스',  9, 387, null, 'teps.or.kr 공식 등급표 · 2+ 등급'),
    ('텝스',  5, 327, null, 'teps.or.kr 공식 등급표 · 2 등급'),
    ('텝스',  2, null, null, '넣었으면 최소 2점'),

    /* 토익스피킹 0~200 — ETS 공식으로 확인한 두 칸만 둡니다.
       9점·5점 자리는 일부러 비워 뒀습니다. 140·110 이 어느 등급 경계인지
       공식 문서로 확인하지 못했습니다. 추측으로 채우지 않습니다 */
    ('토익스피킹', 15, 190, null, 'ETS 공식 · Level 8 (190~200) — 확인함'),
    ('토익스피킹', 12, 160, null, 'ETS 공식 · Level 7 (160~180) — 확인함'),
    ('토익스피킹',  2, null, null, '9점·5점 경계는 아직 확인 못 해 비워 뒀어요'),

    /* 오픽 — opic.or.kr 공식 9등급. 「IM등급을 세분화하여 제공합니다 (IM3 > IM2 > IM1)」,
       범위는 Novice Low ~ Advanced Low. AM·AH·Superior 는 OPI 것이라 없습니다.
       아홉을 다섯으로 묶은 것은 POTJOB 판단입니다 */
    ('오픽', 15, null, array['AL'],        'opic.or.kr 공식 등급 · Advanced Low'),
    ('오픽', 12, null, array['IH'],        'opic.or.kr 공식 등급 · Intermediate High'),
    ('오픽',  9, null, array['IM3','IM2'], 'opic.or.kr 공식 등급 · Intermediate Mid 상·중'),
    ('오픽',  5, null, array['IM1','IL'],  'opic.or.kr 공식 등급 · Intermediate Mid 하 · Low'),
    ('오픽',  2, null, array['NH','NM','NL'], 'opic.or.kr 공식 등급 · Novice')
  ) v(exam, points, min_score, levels, source)
$$;


ALTER FUNCTION public.lang_bands() OWNER TO postgres;

--
-- Name: lang_best(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lang_best(p_profile uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(max(public.lang_points(exam, score, level)), 0)
    from spec_langs where profile_id = p_profile
$$;


ALTER FUNCTION public.lang_best(p_profile uuid) OWNER TO postgres;

--
-- Name: lang_points(text, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lang_points(p_exam text, p_score integer, p_level text) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select coalesce(max(b.points), 0)
    from public.lang_bands() b
   where b.exam = p_exam
     and (b.min_score is null or (p_score is not null and p_score >= b.min_score))
     and (b.levels   is null or (p_level is not null and p_level = any(b.levels)))
$$;


ALTER FUNCTION public.lang_points(p_exam text, p_score integer, p_level text) OWNER TO postgres;

--
-- Name: lang_points_check(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lang_points_check() RETURNS TABLE("경우" text, "기대" integer, "실제" integer)
    LANGUAGE sql STABLE
    AS $$
  with t(경우, 기대, 실제) as (values
    ('토익 900 → 15',        15, public.lang_points('토익', 900, null)),
    ('토익 800 경계 → 15',   15, public.lang_points('토익', 800, null)),
    ('토익 799 → 12',        12, public.lang_points('토익', 799, null)),
    ('토익 450 → 2 (0 아님)', 2, public.lang_points('토익', 450, null)),
    ('토익 0 → 2',            2, public.lang_points('토익', 0, null)),
    ('텝스 526 경계 → 15',   15, public.lang_points('텝스', 526, null)),
    ('텝스 525 → 12',        12, public.lang_points('텝스', 525, null)),
    ('텝스 327 경계 → 5',     5, public.lang_points('텝스', 327, null)),
    ('텝스 326 → 2',          2, public.lang_points('텝스', 326, null)),
    ('토스 200 → 15',        15, public.lang_points('토익스피킹', 200, null)),
    ('토스 190 경계 → 15',   15, public.lang_points('토익스피킹', 190, null)),
    ('토스 189 → 12',        12, public.lang_points('토익스피킹', 189, null)),
    ('토스 160 경계 → 12',   12, public.lang_points('토익스피킹', 160, null)),
    ('토스 150 → 2 (미확인 구간 없음)', 2, public.lang_points('토익스피킹', 150, null)),
    ('토스 140 → 2 (9점 안 줌)',        2, public.lang_points('토익스피킹', 140, null)),
    ('토스 110 → 2 (5점 안 줌)',        2, public.lang_points('토익스피킹', 110, null)),
    ('오픽 AL → 15',         15, public.lang_points('오픽', null, 'AL')),
    ('오픽 IH → 12',         12, public.lang_points('오픽', null, 'IH')),
    ('오픽 IM3 → 9',          9, public.lang_points('오픽', null, 'IM3')),
    ('오픽 IM2 → 9',          9, public.lang_points('오픽', null, 'IM2')),
    ('오픽 IM1 → 5',          5, public.lang_points('오픽', null, 'IM1')),
    ('오픽 IL → 5',           5, public.lang_points('오픽', null, 'IL')),
    ('오픽 NL → 2',           2, public.lang_points('오픽', null, 'NL')),
    ('「기타」는 이제 없는 시험 → 0', 0, public.lang_points('기타', null, null)),
    ('없는 시험 → 0',         0, public.lang_points('아이엘츠', null, null))
  )
  select 경우, 기대, 실제 from t where 실제 is distinct from 기대
$$;


ALTER FUNCTION public.lang_points_check() OWNER TO postgres;

--
-- Name: lang_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lang_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  me_id    uuid := auth.uid();
  min_n    constant int := 3;
  scored   jsonb;
  opic     jsonb;
  people   int;
begin
  select count(distinct l.profile_id) into people
    from spec_langs l join profiles pr on pr.id = l.profile_id and not pr.excluded;

  /* 점수형 — 시험별 중앙값과 사분위.
     등급형(오픽)과 한 평균에 섞지 않습니다. 990점 만점과 IM2 를 더할 방법이 없습니다 */
  with t as (
    select l.exam, l.score, l.profile_id
      from spec_langs l join profiles pr on pr.id = l.profile_id and not pr.excluded
     where l.exam in ('토익','텝스','토익스피킹')
  ), g as (
    select exam,
           count(distinct profile_id) n,
           percentile_cont(0.25) within group (order by score) p25,
           percentile_cont(0.5)  within group (order by score) mid,
           percentile_cont(0.75) within group (order by score) p75,
           max(score) top
      from t group by exam having count(distinct profile_id) >= min_n
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'exam', exam, 'n', n,
           'p25', round(p25), 'mid', round(mid), 'p75', round(p75), 'top', top)
         order by n desc), '[]'::jsonb)
    into scored from g;

  /* 등급형 — 평균을 내지 않고 등급별 인원만 셉니다.
     등급은 순서가 있을 뿐 간격이 같지 않아서 평균이 뜻을 못 가집니다 */
  with t as (
    select l.level, l.profile_id
      from spec_langs l join profiles pr on pr.id = l.profile_id and not pr.excluded
     where l.exam = '오픽' and l.level is not null
  ), n as (select count(distinct profile_id) c from t)
  select case when (select c from n) >= min_n then
      jsonb_build_object('n', (select c from n),
        'levels', coalesce((
          select jsonb_agg(jsonb_build_object('level', lv, 'n', cnt) order by ord)
            from (select level lv, count(distinct profile_id) cnt,
                         array_position(array['NL','NM','NH','IL','IM1','IM2','IM3','IH','AL'], level) ord
                    from t group by level) z), '[]'::jsonb))
    end
    into opic;

  return jsonb_build_object(
    'min_n', min_n,
    'people', people,
    'scored', scored,
    'opic', opic,
    'mine', case when me_id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('exam', exam, 'score', score, 'level', level)
             order by exam)
        from spec_langs where profile_id = me_id), '[]'::jsonb) end);
end $$;


ALTER FUNCTION public.lang_stats() OWNER TO postgres;

--
-- Name: ocr_zero_put(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ocr_zero_put(p_secret text, p_source text, p_x jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  insert into ocr_zero (source, 공고, 파일이름, 바이트, 앞5, ctype, 원문, 두번째도0)
  values (p_source,
          left(coalesce(p_x->>'공고',''), 60),
          left(coalesce(p_x->>'파일이름',''), 200),
          nullif(p_x->>'바이트','')::int,
          left(coalesce(p_x->>'앞5',''), 10),
          left(coalesce(p_x->>'ctype',''), 120),
          left(coalesce(p_x->>'원문',''), 500),
          coalesce((p_x->>'두번째도0')::boolean, false));

  /* 최근 500줄만 남깁니다 */
  delete from ocr_zero z
   where z.id < (select min(id) from (select id from ocr_zero order by id desc limit 500) t);

  return jsonb_build_object('남김', true);
end $$;


ALTER FUNCTION public.ocr_zero_put(p_secret text, p_source text, p_x jsonb) OWNER TO postgres;

--
-- Name: org_detail(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_detail(p_name text, p_sido text DEFAULT NULL::text) RETURNS TABLE(name text, kinds text[], hosp_kind text, tel text, bed integer, rehab integer, ot integer, pt integer, capacity integer, per_bed numeric, kind_med double precision, kind_p25 double precision, kind_p75 double precision, kind_n bigint, band text, data_version text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select g.name, g.kinds, coalesce(s.kind, g.hosp_kind), g.tel,
         g.bed, g.rehab, g.ot, g.pt, g.capacity,
         s.per_bed, s.kind_med, s.kind_p25, s.kind_p75, s.kind_n, s.band, s.data_version
    from org_group_mv g
    left join org_hospital_stat s on s.key = g.key
   where auth.uid() is not null
     and g.name = p_name
     and (p_sido is null or p_sido = '' or g.sido_std = p_sido)
   order by g.staffed desc
   limit 1
$$;


ALTER FUNCTION public.org_detail(p_name text, p_sido text) OWNER TO postgres;

--
-- Name: org_facets(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_facets() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'tiles', coalesce((select jsonb_object_agg(key, n) from org_facet_mv where slot = 'tile'), '{}'::jsonb),
    'sidos', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n) order by key)
                         from org_facet_mv where slot = 'sido'), '[]'::jsonb),
    'sggs',  coalesce((select jsonb_object_agg(src, xs) from (
                         select src, jsonb_agg(jsonb_build_object('key', key, 'n', n) order by key) xs
                           from org_facet_mv where slot = 'sgg' group by src) t), '{}'::jsonb),
    'total', coalesce((select n from org_facet_mv where slot = 'total'), 0))
$$;


ALTER FUNCTION public.org_facets() OWNER TO postgres;

--
-- Name: org_hospital_by_name(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_hospital_by_name(p_name text) RETURNS TABLE(name text, kind text, bed integer, rehab integer, ot integer, pt integer, per_bed numeric, kind_med double precision, kind_p25 double precision, kind_p75 double precision, kind_n bigint, band text, data_version text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.name, s.kind, s.bed, s.rehab, s.ot, s.pt,
         s.per_bed, s.kind_med, s.kind_p25, s.kind_p75, s.kind_n, s.band, s.data_version
  from org_hospital_stat s
  where s.key = org_key(p_name)
  limit 1
$$;


ALTER FUNCTION public.org_hospital_by_name(p_name text) OWNER TO postgres;

--
-- Name: org_jobs(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_jobs(p_name text, p_n integer DEFAULT 10) RETURNS TABLE(id text, title text, job_group text, employ_type text, apply_to date, org_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select j.id, j.title, j.job_group, j.employ_type, j.apply_to, j.org_name
    from job_posts_pub j
   where org_key(j.org_name) = org_key(p_name)
   order by j.posted_at desc nulls last
   limit least(coalesce(p_n, 10), 20)
$$;


ALTER FUNCTION public.org_jobs(p_name text, p_n integer) OWNER TO postgres;

--
-- Name: org_key(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_key(s text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  with a as (
    select regexp_replace(
             regexp_replace(coalesce(s,''),
               '\(.*?\)|재단법인|의료법인|사회복지법인|학교법인|주식회사|\(주\)|의료재단|유지재단|사단법인', '', 'g'),
             '[^가-힣0-9A-Za-z]', '', 'g') as v
  ),
  b as (
    select v,
           '^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)' as sido
      from a
  )
  select case
    when v ~ (sido || '.*(보건소|보건지소|보건의료원|치매안심센터|치매센터)$')
      then regexp_replace(v, sido, '')
    else v
  end
  from b
$_$;


ALTER FUNCTION public.org_key(s text) OWNER TO postgres;

--
-- Name: org_name_key(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_name_key(s text, p_drop_sido boolean DEFAULT false) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  with a as (
    /* ① 전각을 반각으로. 그리고 여는 괄호 앞에 빈칸을 하나 넣습니다 */
    select regexp_replace(
             translate(coalesce(s, ''), '（）［］＋－／　', '()[]+-/ '),
             '\(', ' (', 'g') as v
  ), b as (
    /* ② 법인 표기를 뗍니다 */
    select regexp_replace(v,
      ' \(주\)| \(의\)| \(재\)| \(사\)| \(학\)| \(특\)|㈜|의료법인|재단법인|사회복지법인|학교법인|사단법인|특수법인|영리법인|공익법인|주식회사|유한회사',
      ' ', 'g') as v from a
  ), c as (
    /* ③ 법인명을 뗍니다 — 뒤에 병원 이름이 올 때만 */
    select case
      when v ~ '^[[:space:]]*[가-힣A-Za-z0-9]{1,14}(의료재단|복지재단|의료법인|복지법인|재단|학원|법인)[[:space:]]+.*(병원|의원|요양원|의료원|센터|클리닉)'
        then regexp_replace(v, '^[[:space:]]*[가-힣A-Za-z0-9]{1,14}(의료재단|복지재단|의료법인|복지법인|재단|학원|법인)[[:space:]]+', '')
      else v
    end as v from b
  ), d as (
    /* ④⑤ 괄호 안은 남기고 기호만 · 공백·가운뎃점·붙임표를 뗍니다 */
    select lower(regexp_replace(v, '[[:space:]·・,()\[\]‐‑–—\-/]', '', 'g')) as v from c
  )
  select case
    when p_drop_sido and v ~ '(보건소|보건지소|보건의료원|치매안심센터|치매센터)$'
      then regexp_replace(v,
        '^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)', '')
    else v
  end
  from d
$_$;


ALTER FUNCTION public.org_name_key(s text, p_drop_sido boolean) OWNER TO postgres;

--
-- Name: org_nearby(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_nearby(p_name text, p_sido text DEFAULT NULL::text, p_n integer DEFAULT 3) RETURNS TABLE(name text, sido_std text, sgg_std text, kinds text[], tile text, therapists integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with me as (
    select * from org_group_mv g
     where g.name = p_name and (p_sido is null or p_sido = '' or g.sido_std = p_sido)
     order by g.staffed desc limit 1
  )
  select g.name, g.sido_std, g.sgg_std, g.kinds, g.tile, g.therapists
    from org_group_mv g, me
   where g.tile = me.tile
     and g.sido_std is not distinct from me.sido_std
     and g.sgg_std  is not distinct from me.sgg_std
     and g.name <> me.name
   order by g.therapists desc, g.name
   limit least(coalesce(p_n, 3), 5)
$$;


ALTER FUNCTION public.org_nearby(p_name text, p_sido text, p_n integer) OWNER TO postgres;

--
-- Name: org_public(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_public(p_name text, p_sido text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_src text DEFAULT NULL::text) RETURNS TABLE(name text, sido_std text, sgg_std text, addr text, tel text, kinds text[], sources text[], tile text, staffed boolean, band text, est_type text, homepage text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 지역맞나 as (select p_sido is null or p_sido = '' as 아무데나),
  /* ── 0번째 칸 — 원문 주소가 분원 것인가 (2026-09-25) ──────────
     알리오가 「경북대학교병원」 이름으로 보낸 공고 5건의 원문 주소가
     www.knuch.kr:442, 곧 칠곡경북대학교병원 사이트였습니다. 제목도 전부
     「칠곡경북대학교병원 …」 이고 그중 4건에 물리·작업치료사가 있습니다.
     본원은 대구 중구, 칠곡은 대구 북구라 카드가 틀리게 뜹니다.

     부탁받은 자리는 다섯째 칸이었는데 넣어 보니 **한 번도 안 켜집니다** —
     「경북대학교병원」 은 첫째 칸에서 이미 붙어 다섯째까지 오지 않습니다.
     그래서 첫째 칸 앞에 둡니다. 위험하지 않은 까닭은, 이 칸이
     org_alias 에 kind='호스트' 로 **손으로 적어둔 주소일 때만** 켜지기
     때문입니다. 안 적은 주소에는 아무 일도 안 일어납니다.

     창원경상국립대·화순전남대는 이걸로 못 가립니다 — 모기관과 채용
     사이트가 같습니다. 그 둘은 수집기가 HOSP_SITES 의 only/not 으로
     긁을 때 이미 갈라 놓습니다. 빛고을은 아직 공고가 없습니다. */
  호스트 as (
    select lower(coalesce((regexp_match(coalesce(p_src, ''), '^https?://([^/:]+)'))[1], '')) as h
  ),
  t0 as (
    select g.* from org_group_mv g, 호스트 x
     where x.h <> ''
       and exists (
         select 1 from org_alias a
          where a.kind = '호스트'
            and (x.h = lower(a.our_name) or x.h like '%.' || lower(a.our_name))
            and org_name_key(a.hira_name) = org_name_key(g.name)
       )
  ),
  t0일 as (select * from t0 where (select count(*) from t0) = 1),
  t1 as (
    select g.* from org_group_mv g, 지역맞나 z
     where not exists (select 1 from t0일)
       and g.name = p_name and (z.아무데나 or g.sido_std = p_sido)
     order by g.staffed desc limit 1
  ),
  t2 as (
    select g.* from org_group_mv g, 지역맞나 z
     where not exists (select 1 from t0일) and not exists (select 1 from t1)
       and org_name_key(g.name) = org_name_key(p_name)
       and (z.아무데나 or g.sido_std = p_sido)
  ),
  t2일 as (select * from t2 where (select count(*) from t2) = 1),
  t3 as (
    select g.* from org_group_mv g, 지역맞나 z
     where not exists (select 1 from t0일) and not exists (select 1 from t1)
       and not exists (select 1 from t2일)
       and org_name_key(g.name, true) = org_name_key(p_name, true)
       and (z.아무데나 or g.sido_std = p_sido)
  ),
  t3일 as (select * from t3 where (select count(*) from t3) = 1),
  대괄호 as (
    select (regexp_match(coalesce(p_title, ''), '\[([^\]]{2,40})\]'))[1] as v
  ),
  t4 as (
    select g.* from org_group_mv g, 대괄호 b, 지역맞나 z
     where not exists (select 1 from t0일) and not exists (select 1 from t1)
       and not exists (select 1 from t2일) and not exists (select 1 from t3일)
       and b.v is not null
       and org_name_key(g.name) = org_name_key(p_name || ' ' || b.v)
       and (z.아무데나 or g.sido_std = p_sido)
  ),
  t4일 as (select * from t4 where (select count(*) from t4) = 1),
  /* ── 5번째 칸 — 모기관 이름으로 온 분원 공고 ──────────────────
     분원 이름은 모기관 이름으로 **끝납니다** (양산부산대학교병원 → 부산대학교병원).
     시도가 반드시 있어야 하고(아무데나면 안 씁니다), 단일 일치일 때만 붙입니다.
     모기관 이름이 짧으면 엉뚱한 것이 걸리므로 6자 이상일 때만 봅니다 */
  t5 as (
    select g.* from org_group_mv g
     where not exists (select 1 from t0일) and not exists (select 1 from t1)
       and not exists (select 1 from t2일)
       and not exists (select 1 from t3일) and not exists (select 1 from t4일)
       and p_sido is not null and p_sido <> ''
       and length(org_name_key(p_name)) >= 6
       and g.sido_std = p_sido
       and org_name_key(g.name) like '%' || org_name_key(p_name)
       and org_name_key(g.name) <> org_name_key(p_name)
  ),
  t5일 as (select * from t5 where (select count(*) from t5) = 1)
  select g.name, g.sido_std, g.sgg_std, g.addr, g.tel, g.kinds,
         g.sources, g.tile, g.staffed, g.band, g.est_type, g.homepage
    from (select * from t0일
          union all select * from t1
          union all select * from t2일
          union all select * from t3일
          union all select * from t4일
          union all select * from t5일) g
   order by g.staffed desc
   limit 1
$$;


ALTER FUNCTION public.org_public(p_name text, p_sido text, p_title text, p_src text) OWNER TO postgres;

--
-- Name: org_search(text, text, text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_search(p_q text DEFAULT NULL::text, p_tile text DEFAULT NULL::text, p_sido text DEFAULT NULL::text, p_sgg text DEFAULT NULL::text, p_sort text DEFAULT 'staff'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(name text, sido_std text, sgg_std text, kinds text[], tile text, bed integer, ot integer, pt integer, rehab integer, capacity integer, band text, staffed boolean, n_jobs integer, total bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  w    text := '';
  ord  text;
  sql  text;
begin
  if p_q is not null and btrim(p_q) <> '' then
    w := w || ' and g.name ilike ' || quote_literal('%' || btrim(p_q) || '%');
  end if;
  if p_tile is not null and p_tile not in ('', 'all') then
    w := w || ' and g.tile = ' || quote_literal(p_tile);
  end if;
  if p_sido is not null and p_sido <> '' then
    w := w || ' and g.sido_std = ' || quote_literal(p_sido);
  end if;
  if p_sgg is not null and p_sgg <> '' then
    w := w || ' and g.sgg_std = ' || quote_literal(p_sgg);
  end if;

  ord := case coalesce(p_sort, 'staff')
           when 'jobs' then 'n_jobs desc, g.therapists desc nulls last, g.name'
           when 'name' then 'g.name'
           else             'g.therapists desc nulls last, g.name'
         end;

  sql := 'with j as (
            select org_key(org_name) as k, count(*)::int as n
              from job_posts where not hidden and not hold group by 1)
          select g.name, g.sido_std, g.sgg_std, g.kinds, g.tile,
                 g.bed, g.ot, g.pt, g.rehab, g.capacity,
                 g.band, g.staffed, coalesce(j.n, 0) as n_jobs, count(*) over () as total
            from org_group_mv g left join j on j.k = g.key
           where true' || w || '
           order by ' || ord || '
           limit '  || least(coalesce(p_limit, 20), 20)::text || '
          offset ' || greatest(coalesce(p_offset, 0), 0)::text;

  return query execute sql;
end
$$;


ALTER FUNCTION public.org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- Name: FUNCTION org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer) IS '병원정보 검색. 회원만 (anon 에서 실행 권한을 걷었습니다) · 한 번에 20곳';


--
-- Name: org_sgg(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_sgg(p_sido text, p_sgg text, p_addr text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  with b as (
    select coalesce(nullif(btrim(p_sgg), ''),
                    btrim(regexp_replace(coalesce(p_addr, ''), '^\s*\S+\s+', ''))) as s
  ),
  t as (
    select (select x
              from unnest(string_to_array((select s from b), ' ')) as x
             where x ~ '(시|군|구)$'
             limit 1) as v
  ),
  u as (
    select case
      when (select v from t) = '부산진구' then '부산진구'
      else regexp_replace(
             coalesce((select v from t), ''),
             '^(서울특별시|서울|부산광역시|부산|대구광역시|대구|인천광역시|인천|광주광역시|광주|대전광역시|대전|울산광역시|울산|세종특별자치시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전라북도|전북특별자치도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)(?=.+(시|군|구)$)',
             '')
    end as w
  )
  select case
    when nullif((select w from u), '') is null then null
    when (select w from u) ~ '구$'
     and (select w from u) ~ '^(수원|성남|고양|용인|부천|안산|안양|화성|창원|포항|전주|천안|청주)'
      then substring((select w from u) from '^(수원|성남|고양|용인|부천|안산|안양|화성|창원|포항|전주|천안|청주)') || '시'
    else (select w from u)
  end
$_$;


ALTER FUNCTION public.org_sgg(p_sido text, p_sgg text, p_addr text) OWNER TO postgres;

--
-- Name: org_sido(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_sido(p_sido text, p_addr text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when s like '서울%' then '서울'  when s like '부산%' then '부산'
    when s like '대구%' then '대구'  when s like '인천%' then '인천'
    when s like '광주%' then '광주'  when s like '대전%' then '대전'
    when s like '울산%' then '울산'  when s like '세종%' then '세종'
    when s like '경기%' then '경기'  when s like '강원%' then '강원'
    when s like '충청북%' or s like '충북%' then '충북'
    when s like '충청남%' or s like '충남%' then '충남'
    when s like '전라북%' or s like '전북%' then '전북'
    when s like '전라남%' or s like '전남%' then '전남'
    when s like '경상북%' or s like '경북%' then '경북'
    when s like '경상남%' or s like '경남%' then '경남'
    when s like '제주%' then '제주'
  end
  from (select trim(coalesce(nullif(trim(p_sido), ''), p_addr, '')) s) t
$$;


ALTER FUNCTION public.org_sido(p_sido text, p_addr text) OWNER TO postgres;

--
-- Name: org_tile(text[], text[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_tile(p_kinds text[], p_sources text[], p_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_kinds, '{}') && array['상급종합','종합병원','상급종합병원'] then 'general'
    when coalesce(p_kinds, '{}') && array['병원'] and coalesce(p_name,'') like '%재활%' then 'rehab'
    when coalesce(p_kinds, '{}') && array['요양병원'] then 'nursing'
    when coalesce(p_kinds, '{}') && array['의원','한의원'] then 'clinic'
    when coalesce(p_kinds, '{}') && array['보건소','보건지소','보건의료원',
                                          '치매안심센터','광역치매센터','치매상담전화센터'] then 'health'
    when 'ltc' = any(coalesce(p_sources, '{}')) or coalesce(p_kinds, '{}') && array['요양원'] then 'ltc'
    when coalesce(p_sources, '{}') && array['welfare','welfare_ctr','mental','dev_rehab'] then 'welfare'
    else 'etc'
  end
$$;


ALTER FUNCTION public.org_tile(p_kinds text[], p_sources text[], p_name text) OWNER TO postgres;

--
-- Name: org_total(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.org_total() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select count(*)::int from org_group_mv $$;


ALTER FUNCTION public.org_total() OWNER TO postgres;

--
-- Name: pay_band(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pay_band(p_hired_year integer) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select case
    when p_hired_year is null then null
    when (extract(year from (now() at time zone 'Asia/Seoul'))::int - p_hired_year + 1) <= 1  then '1년차'
    when (extract(year from (now() at time zone 'Asia/Seoul'))::int - p_hired_year + 1) <= 3  then '2-3년차'
    when (extract(year from (now() at time zone 'Asia/Seoul'))::int - p_hired_year + 1) <= 6  then '4-6년차'
    when (extract(year from (now() at time zone 'Asia/Seoul'))::int - p_hired_year + 1) <= 10 then '7-10년차'
    else '11년차 이상' end
$$;


ALTER FUNCTION public.pay_band(p_hired_year integer) OWNER TO postgres;

--
-- Name: pay_stats(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pay_stats(p_job text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_band text DEFAULT NULL::text, p_employ text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  me_id  uuid := auth.uid();
  min_n  constant int := 3;
  job    text := p_job;
  total  int;
  out    jsonb;
  me     jsonb;
  my_ann int;
  my_base int;
begin
  if me_id is not null then
    select jsonb_build_object(
             'nickname', pr.nickname, 'job_group', pr.job_group, 'role', pr.role,
             'hired_year', s.hired_year, 'current_hired_year', s.current_hired_year,
             'band', pay_band(s.hired_year),
             'region', s.region, 'hospital_type', s.hospital_type, 'employ_type', s.employ_type,
             'base_monthly', s.base_monthly, 'pay_basis', s.pay_basis,
             'net_monthly', s.net_monthly, 'dependents', s.dependents,
             'extra_pay_monthly', s.extra_pay_monthly, 'bonus_yearly', s.bonus_yearly,
             'duty_count', s.duty_count, 'duty_hours', s.duty_hours, 'duty_pay', s.duty_pay,
             'weekend_count', s.weekend_count, 'weekend_hours', s.weekend_hours,
             'weekend_pay', s.weekend_pay,
             'birth_year', s.birth_year, 'annual', s.annual_total),
           s.annual_total, s.base_monthly
      into me, my_ann, my_base
      from salary_records s join profiles pr on pr.id = s.profile_id
     where s.profile_id = me_id;
  end if;

  if job is null then job := me ->> 'job_group'; end if;

  /* 연 총소득이 없는 줄(옛 화면으로 적은 것)은 통계에서 뺍니다 —
     세전을 모르는 줄을 섞으면 중위값이 틀립니다 */
  select count(*) into total
    from salary_records s join profiles pr on pr.id = s.profile_id
   where not pr.excluded and s.annual_total is not null
     and (job is null or pr.job_group = job);

  with m as (
    select s.annual_total ann, s.base_monthly base, s.employ_type,
           s.duty_count, s.weekend_count, s.profile_id
      from salary_records s
      join profiles pr on pr.id = s.profile_id and not pr.excluded
     where s.annual_total is not null
       and (job      is null or pr.job_group    = job)
       and (p_region is null or s.region        = p_region)
       and (p_type   is null or s.hospital_type = p_type)
       and (p_band   is null or pay_band(s.hired_year) = p_band)
       and (p_employ is null or s.employ_type   = p_employ)
  )
  select jsonb_build_object(
    'n', count(*),
    'annual', case when count(*) >= min_n then jsonb_build_object(
        'min',    min(ann),
        'q1',     percentile_cont(0.25) within group (order by ann)::int,
        'median', percentile_cont(0.50) within group (order by ann)::int,
        'q3',     percentile_cont(0.75) within group (order by ann)::int,
        'max',    max(ann)) end,
    'base', case when count(*) >= min_n then jsonb_build_object(
        'q1',     percentile_cont(0.25) within group (order by base)::int,
        'median', percentile_cont(0.50) within group (order by base)::int,
        'q3',     percentile_cont(0.75) within group (order by base)::int) end,
    'duty_avg',    case when count(*) >= min_n then round(avg(coalesce(duty_count, 0))::numeric, 1) end,
    'weekend_avg', case when count(*) >= min_n then round(avg(coalesce(weekend_count, 0))::numeric, 1) end,
    'emp_dist', case when count(*) >= min_n then
        (select jsonb_object_agg(employ_type, c) from
           (select employ_type, count(*) c from m group by employ_type) d) end,
    'my_below_annual', count(*) filter (where my_ann  is not null and ann  < my_ann),
    'my_below_base',   count(*) filter (where my_base is not null and base < my_base),
    'in_filter', coalesce(bool_or(profile_id = me_id), false)
  ) into out from m;

  return jsonb_build_object('job', job, 'total', total, 'min_n', min_n, 'stats', out, 'me', me);
end $$;


ALTER FUNCTION public.pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text) OWNER TO postgres;

--
-- Name: FUNCTION pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text) IS '월급 확인 화면. 표본 3명 미만이면 숫자를 안 내보냅니다. 개별 금액은 본인 것만 나갑니다';


--
-- Name: post_state(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_state(p_id bigint) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when not exists (select 1 from posts where id = p_id) then 'gone'
    when (select hidden from posts where id = p_id)        then 'hidden'
    else 'ok'
  end
$$;


ALTER FUNCTION public.post_state(p_id bigint) OWNER TO postgres;

--
-- Name: FUNCTION post_state(p_id bigint); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.post_state(p_id bigint) IS '공유 링크가 안 열릴 때 「없는 글」인지 「지워진 글」인지만 알려줍니다';


--
-- Name: pub_baseline_check(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pub_baseline_check() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '지금', (select count(*) from job_posts_pub),
    '기준', b.기준,
    '정한날', b.정한날,
    '까닭', b.까닭,
    '몇퍼센트', round(100.0 * ((select count(*) from job_posts_pub) - b.기준) / nullif(b.기준, 0), 1),
    /* **늘어나는 쪽만** 봅니다. 줄어드는 것은 마감 때문이라 헛알림이었습니다 */
    '넘었나', (100.0 * ((select count(*) from job_posts_pub) - b.기준) / nullif(b.기준, 0)) >= 10,
    '어느쪽', '늘어난 쪽만 봅니다 (줄어드는 쪽은 수집기박동 이 봅니다)')
  from pub_baseline b where b.한줄;
$$;


ALTER FUNCTION public.pub_baseline_check() OWNER TO postgres;

--
-- Name: pub_baseline_get(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pub_baseline_get(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return pub_baseline_check();
end $$;


ALTER FUNCTION public.pub_baseline_get(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: pub_leak(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pub_leak() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 오늘 as (select (now() at time zone 'Asia/Seoul')::date d),
  본것 as (
    select p.id, p.apply_to, p.job_group,
           coalesce(j.first_seen, (j.collected_at at time zone 'Asia/Seoul')::date) 처음본날,
           /* hide_stale_posts 와 글자까지 같은 조건입니다 (2026-10-07) */
           (j.seen_on is not null and j.seen_on >= (select d from 오늘) - 14
            and coalesce(j.gone_streak, 0) = 0) 정찰이살아있다고봄
      from job_posts_pub p join job_posts j on j.id = p.id
  ),
  잰것 as (
    select
      count(*) filter (where apply_to is not null and apply_to < (select d from 오늘)) 마감지남,
      count(*) filter (where apply_to is null and not 정찰이살아있다고봄
                         and 처음본날 < (select d from 오늘) - 30) 오래된것,
      count(*) filter (where apply_to is null and 정찰이살아있다고봄) 정찰이보는중,
      count(*) filter (where apply_to is not null and apply_to < (select d from 오늘)
                         and job_group = '물리치료사') 마감_물리,
      count(*) filter (where apply_to is not null and apply_to < (select d from 오늘)
                         and job_group = '작업치료사') 마감_작업,
      min(apply_to) filter (where apply_to is not null and apply_to < (select d from 오늘)) 가장오래전마감,
      count(*) 회원화면전체
    from 본것
  )
  select jsonb_build_object(
    '마감 지남', 마감지남,
    '신호 없이 30일 넘음', 오래된것,
    '정찰이 살아있다고 보는 중', 정찰이보는중,
    '마감 지남 · 물리치료사', 마감_물리, '마감 지남 · 작업치료사', 마감_작업,
    '가장 오래전 마감', 가장오래전마감,
    '며칠째', case when 가장오래전마감 is null then 0
                 else (select d from 오늘) - 가장오래전마감 end,
    '회원 화면 전체', 회원화면전체,
    '샘', (마감지남 + 오래된것) > 0,
    '기준일', (select d from 오늘))
  from 잰것;
$$;


ALTER FUNCTION public.pub_leak() OWNER TO postgres;

--
-- Name: FUNCTION pub_leak(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.pub_leak() IS '회원 화면(job_posts_pub)에 마감 지난·오래된 공고가 새는지 셈. 0이 아니면 빨간 줄 (2026-09-28)';


--
-- Name: refresh_job_scores(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_job_scores() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  with s as (
    select job_id,
           count(*) filter (where kind='click') * 1
         + count(*) filter (where kind='star')  * 5
         + coalesce(sum(case when kind='stay' then least(value,120) else 0 end),0) / 30.0
         - count(*) filter (where kind='out')   * 1  as score
    from job_events
    where created_at > now() - interval '30 days'
    group by job_id
  )
  update job_posts j
     set score = coalesce(s.score, 0), score_at = now()
    from s where s.job_id = j.id;
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION public.refresh_job_scores() OWNER TO postgres;

--
-- Name: FUNCTION refresh_job_scores(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.refresh_job_scores() IS '인기 점수 다시 계산. service_role 만 부릅니다 (옛 trk_score 10분 캐시 자리)';


--
-- Name: refresh_org_coverage(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_org_coverage() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n integer; m integer;
begin
  /* 공고→기관을 먼저 풀고, 그 위에 표를 세웁니다. 순서가 중요합니다 */
  refresh materialized view public.job_org;
  refresh materialized view concurrently public.org_coverage;
  select count(*) into n from public.org_coverage;
  select count(*) into m from public.job_org where key is not null;
  return '경로 표를 새로 셌습니다 · 기관 ' || n || '곳 · 기관에 붙은 공고 ' || m || '건 · '
       || to_char(now() at time zone 'Asia/Seoul', 'MM-DD HH24:MI');
end $$;


ALTER FUNCTION public.refresh_org_coverage() OWNER TO postgres;

--
-- Name: refresh_org_directory(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_org_directory() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  refresh materialized view public.org_directory;
  refresh materialized view public.org_group_mv;
  refresh materialized view public.org_facet_mv;
end $$;


ALTER FUNCTION public.refresh_org_directory() OWNER TO postgres;

--
-- Name: rejudge_forget(text, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rejudge_forget(p_secret text, p_ids text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int := 0;
begin
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  delete from rejudge_hidden where job_id = any(p_ids);
  get diagnostics n = row_count;
  return jsonb_build_object('잊음', n);
end $$;


ALTER FUNCTION public.rejudge_forget(p_secret text, p_ids text[]) OWNER TO postgres;

--
-- Name: rejudge_hold_apply(text, text[], text[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_올림 int := 0; v_감춤 int := 0;
begin
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if coalesce(p_why, '') = '' then
    raise exception '감추는 까닭을 적어야 합니다' using errcode = '22023';
  end if;

  /* 회원 화면으로 — 보류를 풉니다. 직군은 수집기가 다시 채웁니다 */
  update job_posts set hold = false, updated_at = now()
   where id = any(p_show) and hold;
  get diagnostics v_올림 = row_count;

  /* 버릴 것 — **지우지 않고 감추기만.** 까닭을 남겨 되살릴 수 있게 */
  update job_posts
     set hidden = true, hold = false,
         hidden_why = p_why,
         hidden_on = (now() at time zone 'Asia/Seoul')::date,
         updated_at = now()
   where id = any(p_hide) and hold;
  get diagnostics v_감춤 = row_count;

  return jsonb_build_object('회원 화면으로', v_올림, '감춤', v_감춤, '까닭', p_why);
end $$;


ALTER FUNCTION public.rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text) OWNER TO postgres;

--
-- Name: FUNCTION rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text) IS '보류함 재판정 적용 — 지우지 않고 감추기만. 까닭을 남겨 되살릴 수 있습니다 (2026-09-28)';


--
-- Name: rejudge_hold_list(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rejudge_hold_list(p_secret text) RETURNS TABLE(id text, org_name text, title text, source text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return query
    select j.id, j.org_name, j.title, j.source
      from job_posts j
     where j.hold and not j.hidden
     limit 3000;
end $$;


ALTER FUNCTION public.rejudge_hold_list(p_secret text) OWNER TO postgres;

--
-- Name: reset_my_account(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_my_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  me     uuid := auth.uid();
  v_이름 text;
  v_열쇠 text;
begin
  if me is null then
    raise exception '로그인한 사람만 쓸 수 있습니다';
  end if;

  if exists (select 1 from profiles where id = me and erased_at is not null) then
    return;
  end if;

  select nickname into v_이름 from profiles where id = me;
  select decrypted_secret into v_열쇠 from vault.decrypted_secrets where name = '탈퇴이름열쇠';

  /* 남기는 것 — 가입일 · 탈퇴일 · 암호화한 원래 이름(30일) · 대조용 지문 */
  insert into erased_accounts (profile_id, joined_at, 이름암호, 이름지문)
  select id, created_at,
         case when v_열쇠 is null then null else pgp_sym_encrypt(v_이름, v_열쇠) end,
         닉네임지문(v_이름)
    from profiles where id = me
  on conflict (profile_id) do nothing;

  /* 바로 파기 — 급여 · 스펙 · 어학 */
  delete from spec_langs     where profile_id = me;
  delete from student_specs  where profile_id = me;
  delete from salary_records where profile_id = me;

  /* 바로 파기 — 알림 */
  delete from push_devices          where profile_id = me;
  delete from notification_settings where profile_id = me;

  /* 바로 파기 — 관심 공고 · 관심 기관 · 좋아요 */
  delete from job_stars  where profile_id = me;
  delete from org_stars  where profile_id = me;
  delete from post_likes where profile_id = me;

  /* 이용 기록은 숫자만 남기고 사람과의 끈을 끊습니다 */
  update job_events set profile_id = null where profile_id = me;

  /* 회원 정보 지우기.
     회원번호(회원번호)는 그대로 둡니다 — 다시 쓰지 않으려면 남아 있어야 합니다 */
  update profiles set
    nickname           = '지운계정-' || replace(me::text, '-', ''),
    avatar             = null,
    job_group          = null,
    role               = null,
    survey_at          = null,
    survey_edits       = 0,
    survey_edits_since = null,
    erased_at          = now()
  where id = me;

  /* 로그인 수단까지 지웁니다 — 카카오·네이버 연결이 여기서 끊깁니다.
     ⚠ 애플 로그인을 켜면 /auth/revoke 도 불러야 합니다 (지금은 안 켜서 해당 없음) */
  delete from auth.users where id = me;
end $$;


ALTER FUNCTION public.reset_my_account() OWNER TO postgres;

--
-- Name: FUNCTION reset_my_account(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.reset_my_account() IS '개인정보만 지웁니다. 글·댓글은 남고 글쓴이만 「알 수 없음」이 됩니다';


--
-- Name: rival_match_go(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rival_match_go(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return rival_match_run();
end $$;


ALTER FUNCTION public.rival_match_go(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: rival_match_run(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rival_match_run() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record; v_우리 record;
  v_본것 int := 0; v_빠름 int := 0; v_늦음 int := 0; v_없음 int := 0; v_기존 int := 0;
  v_차이 numeric; v_원인 text;
  v_기관키 text; v_제목키 text; v_별칭 text[];
begin
  /* ★ 이름키를 한 번만 만듭니다. 고리 안에서 견줄이름() 을 부르지 않습니다 (2026-10-07).
     전에는 rival_post 한 줄에 7,205ms 였습니다 — 공고 2,203줄마다 견줄이름() 을
     네 번씩 다시 불렀기 때문입니다. 20줄이면 144초로 service 한도 60초도 넘습니다. */
  drop table if exists pg_temp._rival_ours;
  create temp table _rival_ours on commit drop as
    select j.id, j.collected_at, j.hold, j.hidden, j.job_group, j.source,
           j.org_name, j.title, 견줄이름(j.org_name) as 이름키
      from job_posts j;
  create index on _rival_ours (이름키);
  analyze _rival_ours;

  for r in select * from rival_post loop
    v_본것 := v_본것 + 1;

    v_기관키 := 견줄이름(r.기관명);
    v_제목키 := 견줄이름(r.제목);
    select array_agg(견줄이름(a.our_name)) into v_별칭
      from org_alias a
     where a.kind = '경쟁사' and 견줄이름(a.hira_name) = v_기관키;

    select u.id, u.collected_at, u.hold, u.hidden, u.job_group, u.source, u.org_name
      into v_우리
      from pg_temp._rival_ours u
     where (
        /* ① 글자 그대로 (예전 방식 — 그대로 둡니다) */
        (coalesce(r.기관명,'') <> '' and u.org_name ilike '%' || r.기관명 || '%')
        /* ② 다듬어서 똑같나 — 「의료법인·학교법인·부속·종합·띄어쓰기」 를 뗀 뒤 */
        or (coalesce(r.기관명,'') <> '' and u.이름키 = v_기관키)
        /* ③ 다듬은 이름이 서로 안에 들어 있나. 너무 짧으면 아무거나 걸려서 4자 이상만 */
        or (length(v_기관키) >= 4 and position(v_기관키 in u.이름키) > 0)
        /* ④ 규칙으로 안 되는 짝은 손으로 적어 둔 별칭에서 */
        or (v_별칭 is not null and u.이름키 = any(v_별칭))
        /* ⑤ 경쟁사 제목 안에 우리 기관 이름이 들어 있나 */
        or (length(u.이름키) >= 4 and position(u.이름키 in v_제목키) > 0)
       )
       and u.collected_at > r.처음본때 - interval '45 days'
     order by extensions.similarity(u.title, r.제목) desc, u.collected_at desc
     limit 1;

    v_차이 := null; v_원인 := null;

    if v_우리.id is null then
      v_없음 := v_없음 + 1;
      v_원인 := case
        when exists (select 1 from hand_check h
                      where position(h.이름 in r.제목) > 0 and h.결과 <> '열림') then '막힌 병원'
        else '수집 목록에 없는 기관' end;
      insert into rival_match (경쟁사, 글번호, 우리것, 판정, 차이시간, 원인, 잰때)
      values (r.경쟁사, r.글번호, null,
              case when r.기존 then '기존 · 우리에게 없음' else '우리에게 없음' end,
              null, v_원인, now())
      on conflict (경쟁사, 글번호) do update
        set 우리것 = null, 판정 = excluded.판정, 차이시간 = null,
            원인 = case when rival_match.상태 = '미처리' then excluded.원인 else rival_match.원인 end,
            잰때 = now();
      continue;
    end if;

    if r.기존 then
      v_기존 := v_기존 + 1;
      insert into rival_match (경쟁사, 글번호, 우리것, 판정, 차이시간, 원인, 잰때)
      values (r.경쟁사, r.글번호, v_우리.id, '기존 (언제 올라왔는지 모름)', null, null, now())
      on conflict (경쟁사, 글번호) do update
        set 우리것 = excluded.우리것, 판정 = excluded.판정, 차이시간 = null, 잰때 = now();
      continue;
    end if;

    v_차이 := round(extract(epoch from (r.처음본때 - v_우리.collected_at)) / 3600.0, 1);
    if v_차이 >= 0 then v_빠름 := v_빠름 + 1; else v_늦음 := v_늦음 + 1; end if;

    if v_차이 < 0 then
      v_원인 := case
        when v_우리.hold then '보류함 대기'
        when coalesce(v_우리.job_group,'') = '' then '직군 못 가림'
        when abs(v_차이) <= 24 then '수집 주기 탓'
        else '모름' end;
    end if;

    insert into rival_match (경쟁사, 글번호, 우리것, 판정, 차이시간, 원인, 잰때)
    values (r.경쟁사, r.글번호, v_우리.id,
            case when v_차이 >= 0 then '우리가 빠름' else '우리가 늦음' end, v_차이, v_원인, now())
    on conflict (경쟁사, 글번호) do update
      set 우리것 = excluded.우리것, 판정 = excluded.판정, 차이시간 = excluded.차이시간,
          원인 = case when rival_match.상태 = '미처리' then excluded.원인 else rival_match.원인 end,
          잰때 = now();
  end loop;

  return jsonb_build_object('본 것', v_본것, '우리가 빠름', v_빠름, '우리가 늦음', v_늦음,
    '우리에게 없음', v_없음, '기존', v_기존);
end $$;


ALTER FUNCTION public.rival_match_run() OWNER TO postgres;

--
-- Name: rival_put(text, text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rival_put(p_secret text, p_source text, p_rows jsonb, "p_첫판" boolean DEFAULT NULL::boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r jsonb; v_새것 int := 0; v_이미 int := 0; v_첫판 boolean; v_경쟁사 text;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  v_경쟁사 := (select x->>'경쟁사' from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) x limit 1);
  /* 밖에서 넘어온 값은 참고만 합니다. **진짜 판정은 여기서** 합니다 */
  v_첫판 := not exists (select 1 from rival_post where 경쟁사 = v_경쟁사);

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into rival_post (경쟁사, 글번호, 제목, 기관분류, 기관명, 지역, 고용형태, 링크, 기존, 넣은이)
    values (r->>'경쟁사', r->>'글번호', left(r->>'제목', 300), r->>'기관분류',
            left(r->>'기관명', 120), r->>'지역', r->>'고용형태', r->>'링크',
            v_첫판, '자동')
    on conflict (경쟁사, 글번호) do nothing;
    if found then v_새것 := v_새것 + 1; else v_이미 := v_이미 + 1; end if;
  end loop;

  return jsonb_build_object('새것', v_새것, '이미 있던 것', v_이미, '첫판', v_첫판);
end $$;


ALTER FUNCTION public.rival_put(p_secret text, p_source text, p_rows jsonb, "p_첫판" boolean) OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: rookie_salary(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rookie_salary(p_job text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  me_id uuid := auth.uid();
  job   text := p_job;
  min_n constant int := 3;
  out   jsonb;
begin
  if job is null and me_id is not null then
    select job_group into job from profiles where id = me_id;
  end if;

  with r as (
    select sr.hospital_type ht, sr.annual_total ann, sr.base_monthly base
      from salary_records sr
      join profiles pr on pr.id = sr.profile_id and not pr.excluded
     where sr.annual_total is not null
       and (job is null or pr.job_group = job)
       and (extract(year from (now() at time zone 'Asia/Seoul'))::int - sr.hired_year + 1) <= 2
  ), g as (
    select ht, count(*) n,
           percentile_cont(0.5) within group (order by ann)::int  med_year,
           percentile_cont(0.5) within group (order by base)::int med_base
      from r group by ht having count(*) >= min_n
  )
  select jsonb_build_object(
    'job', job, 'min_n', min_n, 'base', (select count(*) from r),
    'types', coalesce((select jsonb_agg(jsonb_build_object(
                'type', ht, 'n', n, 'median_year', med_year, 'median_base', med_base)
              order by med_year desc) from g), '[]'::jsonb))
    into out;
  return out;
end $$;


ALTER FUNCTION public.rookie_salary(p_job text) OWNER TO postgres;

--
-- Name: FUNCTION rookie_salary(p_job text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.rookie_salary(p_job text) IS '연차 2년 이하의 기관유형별 중위 월급. 3명 미만인 유형은 안 내보냅니다';


--
-- Name: route_health(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.route_health() RETURNS TABLE("경로" text, "마지막" date, "며칠째" integer, "평소간격" numeric, "가장긴틈" integer, "본틈" integer, "기준일" integer, "빨간줄" boolean, "왜" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 오늘 as (select (now() at time zone 'Asia/Seoul')::date as d),
  이름 as (
    select * from (values
      ('AL','알리오(옛)'), ('CE','클린아이(옛)'), ('WN','워크넷(옛)'),
      ('GJ','나라일터(옛)'), ('HS','홈페이지(구글)'), ('HM','홈페이지(집)'),
      ('ND','치매센터(옛)'),
      /* 새 서버로 옮긴 것들 — 2026-10-01 에 더했습니다 */
      ('AL2','알리오'), ('CE2','클린아이'), ('WN2','워크넷'),
      ('GJ2','나라일터'), ('HS3','홈페이지(서울서버)'), ('ND2','치매센터'),
      ('JF','고용24')
    ) as t(cd, nm)
  ),
  일별 as (
    select distinct source, (collected_at at time zone 'Asia/Seoul')::date as 날
      from job_posts
  ),
  틈 as (
    select source, 날 - lag(날) over (partition by source order by 날) as g from 일별
  ),
  재기 as (
    select source,
           count(*) filter (where g is not null) as 본틈,
           max(g)                                as 가장긴틈,
           (percentile_cont(0.5) within group (order by g))::numeric as 중앙값
      from 틈 group by source
  ),
  마지막 as (select source, max(날) as 마지막 from 일별 group by source),
  모음 as (
    /* ★ 2026-10-23 세중님 K — 빨간줄 판정에 **출처 코드**가 필요합니다.
       바깥 select 는 칸을 하나씩 골라 내므로 union all 쪽 칸 수는 그대로입니다 */
    select i.cd as cd, i.nm as "경로", l.마지막,
           ((select d from 오늘) - l.마지막)::integer as "며칠째",
           round(coalesce(m.중앙값, 0), 1)            as "평소간격",
           m.가장긴틈::integer                        as "가장긴틈",
           coalesce(m.본틈, 0)::integer               as "본틈",
           greatest(ceil(coalesce(m.중앙값, 0) * 5), 3)::integer as "기준일"
      from 이름 i
      left join 재기 m on m.source = i.cd
      left join 마지막 l on l.source = i.cd
  )
  select c."경로", c.마지막, c."며칠째", c."평소간격", c."가장긴틈", c."본틈", c."기준일",
         /* ★ 2026-10-23 세중님 K — **짝이 있는 옛 출처는 빨개지지 않습니다.**
            2026-10-11 에 세중님 승인으로 멈춘 길이고(sync.yml 머리글), 짝이 되는
            새 길이 같은 공고를 받습니다(수집기짝 표 · docs/빨간경고_옛출처_1023.md).
            줄은 **안 지웁니다** — 아래 「왜」가 까닭을 글로 말합니다 */
         (c."본틈" >= 5 and c."며칠째" >= c."기준일"
          and not exists (select 1 from "수집기짝" p where p."옛출처" = c.cd)) as "빨간줄",
         case
           when c.마지막 is null  then '한 번도 안 들어온 경로입니다'
           when exists (select 1 from "수집기짝" p where p."옛출처" = c.cd)
             then '**옛 길입니다** — 2026-10-11 에 일부러 멈췄고(세중님 승인) 새 길 '
                  || (select p."새출처" || ' ' || p."이름" from "수집기짝" p where p."옛출처" = c.cd)
                  || ' 이 같은 공고를 받습니다. **고칠 것이 없습니다** · 마지막 ' || c.마지막
           when c."본틈" < 5      then '아직 ' || c."본틈" || '번밖에 못 봐서 판단을 미룹니다 · 마지막 ' || c.마지막
           when c."며칠째" >= c."기준일"
             then '평소 ' || c."평소간격" || '일에 한 번 · 기준 ' || c."기준일"
                  || '일 · 지금 ' || c."며칠째" || '일째'
           else '들어오고 있습니다 (평소 ' || c."평소간격" || '일에 한 번 · 기준 ' || c."기준일" || '일)'
         end as "왜"
    from 모음 c
  union all
  select '다리(시트→DB)',
         (select max((updated_at at time zone 'Asia/Seoul')::date) from job_posts),
         ((select d from 오늘) - (select max((updated_at at time zone 'Asia/Seoul')::date) from job_posts))::integer,
         null::numeric, null::integer, null::integer, 3,
         ((select d from 오늘) - (select max((updated_at at time zone 'Asia/Seoul')::date) from job_posts)) >= 3,
         '30분마다 돕니다 · 마지막으로 줄이 바뀐 때 '
         || to_char((select max(updated_at) from job_posts) at time zone 'Asia/Seoul', 'MM-DD HH24:MI')
  order by 8 desc nulls last, 3 desc
$$;


ALTER FUNCTION public.route_health() OWNER TO postgres;

--
-- Name: salary_stats(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.salary_stats(p_hospital_type text, p_region text, p_hired_year integer) RETURNS TABLE(n bigint, p25 integer, p50 integer, p75 integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select count(*)::bigint,
           percentile_cont(0.25) within group (order by net_monthly)::int,
           percentile_cont(0.50) within group (order by net_monthly)::int,
           percentile_cont(0.75) within group (order by net_monthly)::int
    from salary_records s
    join profiles pr on pr.id = s.profile_id and not pr.excluded
    where (p_hospital_type is null or s.hospital_type = p_hospital_type)
      and (p_region        is null or s.region        = p_region)
      and (p_hired_year    is null or s.hired_year    = p_hired_year)
    having count(*) >= 3
  $$;


ALTER FUNCTION public.salary_stats(p_hospital_type text, p_region text, p_hired_year integer) OWNER TO postgres;

--
-- Name: FUNCTION salary_stats(p_hospital_type text, p_region text, p_hired_year integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.salary_stats(p_hospital_type text, p_region text, p_hired_year integer) IS '급여 원본 줄은 아무에게도 안 보여줍니다. 3명 미만이면 줄 자체를 안 돌려줍니다';


--
-- Name: save_my_survey(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.save_my_survey(p_salary jsonb, p_spec jsonb, p_langs jsonb DEFAULT NULL::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  me uuid := auth.uid();
  p  record;
  sp student_specs;
  sr salary_records;
  first_time boolean;
  used int;
  my_role text;
begin
  if me is null then raise exception '로그인한 사람만 쓸 수 있습니다'; end if;

  select survey_at, survey_edits, survey_edits_since, role into p
    from profiles where id = me for update;
  if not found then raise exception '가입을 먼저 마쳐 주세요'; end if;
  my_role := p.role;

  first_time := p.survey_at is null;
  if first_time then used := 0;
  elsif p.survey_edits_since is null or now() - p.survey_edits_since >= interval '1 year' then used := 0;
  else used := p.survey_edits;
  end if;
  if not first_time and used >= 2 then
    raise exception '1년에 2번까지 고칠 수 있습니다';
  end if;

  if p_spec is not null then
    sp := jsonb_populate_record(null::student_specs, p_spec);
    insert into student_specs
      (profile_id, school_type, grade, gpa, gpa_scale, licenses, trainings,
       practice, career, practice_months, career_months, want_type, want_region)
    values
      (me, sp.school_type, sp.grade, sp.gpa, sp.gpa_scale, sp.licenses, sp.trainings,
       sp.practice, sp.career, sp.practice_months, sp.career_months, sp.want_type, sp.want_region)
    on conflict (profile_id) do update set
      school_type = excluded.school_type, grade = excluded.grade,
      gpa = excluded.gpa, gpa_scale = excluded.gpa_scale,
      licenses = excluded.licenses, trainings = excluded.trainings,
      practice = excluded.practice, career = excluded.career,
      practice_months = excluded.practice_months, career_months = excluded.career_months,
      want_type = excluded.want_type, want_region = excluded.want_region,
      submitted_at = now();
  end if;

  /* 어학.
     null 이면 손대지 않습니다. []  이면 「하나도 없음」이라 다 지웁니다.
     지우고 다시 넣습니다 — 어느 줄이 어느 줄인지 맞추는 것보다 단순하고,
     같은 시험 두 줄·5줄 상한은 표 쪽 규칙이 그대로 잡아 줍니다.

     역할은 화면이 보내는 값을 안 믿고 여기서 profiles 를 읽어 박습니다 */
  if p_langs is not null then
    delete from spec_langs where profile_id = me;
    insert into spec_langs (profile_id, exam, score, level, submitted_role)
    select me,
           x ->> 'exam',
           nullif(x ->> 'score', '')::int,
           nullif(x ->> 'level', ''),
           my_role
      from jsonb_array_elements(p_langs) x;
  end if;

  if p_salary is not null then
    sr := jsonb_populate_record(null::salary_records, p_salary);
    insert into salary_records
      (profile_id, hired_year, current_hired_year, region, hospital_type, employ_type,
       base_monthly, pay_basis, net_monthly, dependents, extra_pay_monthly,
       duty_count, duty_hours, duty_pay, weekend_count, weekend_hours, weekend_pay,
       bonus_yearly, gender, birth_year, note)
    values
      (me, sr.hired_year, sr.current_hired_year, sr.region, sr.hospital_type, sr.employ_type,
       sr.base_monthly, sr.pay_basis, sr.net_monthly, sr.dependents, sr.extra_pay_monthly,
       sr.duty_count, sr.duty_hours, sr.duty_pay, sr.weekend_count, sr.weekend_hours, sr.weekend_pay,
       sr.bonus_yearly, sr.gender, sr.birth_year, sr.note)
    on conflict (profile_id) do update set
      hired_year = excluded.hired_year, current_hired_year = excluded.current_hired_year,
      region = excluded.region, hospital_type = excluded.hospital_type,
      employ_type = excluded.employ_type,
      base_monthly = excluded.base_monthly, pay_basis = excluded.pay_basis,
      net_monthly = excluded.net_monthly, dependents = excluded.dependents,
      extra_pay_monthly = excluded.extra_pay_monthly,
      duty_count = excluded.duty_count, duty_hours = excluded.duty_hours, duty_pay = excluded.duty_pay,
      weekend_count = excluded.weekend_count, weekend_hours = excluded.weekend_hours,
      weekend_pay = excluded.weekend_pay,
      bonus_yearly = excluded.bonus_yearly,
      gender = excluded.gender, birth_year = excluded.birth_year, note = excluded.note,
      submitted_at = now();
  end if;

  update profiles set
    survey_at = coalesce(survey_at, now()),
    survey_edits = case when first_time then 0 else used + 1 end,
    survey_edits_since = case
      when first_time then null when used = 0 then now() else survey_edits_since end
  where id = me;

  return json_build_object('first', first_time,
    'left', case when first_time then 2 else 2 - (used + 1) end);
end $$;


ALTER FUNCTION public.save_my_survey(p_salary jsonb, p_spec jsonb, p_langs jsonb) OWNER TO postgres;

--
-- Name: sido_has(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sido_has(p_stored text, p_want text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(btrim(p_want), '') = '' then true
    when coalesce(btrim(p_stored), '') = '' then false
    else exists (
      select 1 from unnest(string_to_array(p_stored, ',')) x
      where public.org_sido(btrim(x), null) = public.org_sido(btrim(p_want), null)
    )
  end
$$;


ALTER FUNCTION public.sido_has(p_stored text, p_want text) OWNER TO postgres;

--
-- Name: FUNCTION sido_has(p_stored text, p_want text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sido_has(p_stored text, p_want text) IS '저장된 시도 글자(긴 이름·쉼표 목록 섞여 있음)가 고른 시도를 품는가. job_list·job_counts 가 함께 씁니다';


--
-- Name: spec_langs_cap(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spec_langs_cap() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from spec_langs where profile_id = new.profile_id) > 5 then
    raise exception '어학은 5개까지 넣을 수 있습니다';
  end if;
  return null;
end $$;


ALTER FUNCTION public.spec_langs_cap() OWNER TO postgres;

--
-- Name: spec_parts(numeric, numeric, integer, text, text[], text[], jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spec_parts(p_gpa numeric, p_gpa_scale numeric, p_lang_pt integer, p_school text, p_licenses text[], p_trainings text[], p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  g numeric;
  pt_gpa numeric := 0;
  pt_lang numeric := coalesce(p_lang_pt, 0);   -- 0~15. lang_best 가 넘겨줍니다
  pt_school numeric := 0;          -- 안 적으면 0점입니다
  pt_cert numeric := 0; pt_course numeric := 0; pt_prac numeric := 0;
  c text; add numeric;
  n_course int := coalesce(array_length(p_trainings, 1), 0);
  n_rows int := coalesce(jsonb_array_length(p_rows), 0);
  big int := 0;
  h text;
begin
  if p_gpa > 0 and p_gpa_scale > 0 then
    /* 자리수 때문에 경계에서 한 칸 떨어지지 않게 반올림합니다 */
    g := round(p_gpa / p_gpa_scale * 4.5, 4);
    pt_gpa := case
      when g >= 4.3 then 60 when g >= 3.8 then 48 when g >= 3.5 then 38
      when g >= 3.2 then 29 when g >= 3.0 then 19 when g >= 2.5 then 10 else 0 end;
  end if;

  /* 적은 경우에만 점수를 줍니다. 목록에 없는 학교를 적었으면 3점(옛 기본값) */
  if p_school is not null and btrim(p_school) <> '' then
    pt_school := case
      when p_school like '%박사%' then 5
      when p_school like '%석사%' then 5
      when p_school like '%4년제%' then 5
      when p_school like '%수도권%' and p_school like '%3년제%' then 4
      when p_school like '%서울·경기%' and p_school like '%3년제%' then 4
      when p_school like '%전공심화%' then 4
      when p_school like '%3년제%' then 3
      else 3 end;
  end if;

  foreach c in array coalesce(p_licenses, '{}') loop
    add := case
      when c like '%컴퓨터활용능력 - 1급%' then 4
      when c like '%컴퓨터활용능력 - 2급%' then 2
      when c like '%한국사%'      then 2
      when c like '%사회복지사%'  then 2
      when c like '%보조공학사%'  then 2
      when c like '%요양보호사%'  then 2
      when c like '%운전면허%'    then 1
      else 1 end;
    pt_cert := pt_cert + add;
  end loop;
  pt_cert := least(pt_cert, 10);

  pt_course := case when n_course >= 4 then 5 when n_course = 3 then 4
                    when n_course = 2 then 3 when n_course = 1 then 1.5 else 0 end;

  /* 옛 앱은 학생의 실습만 봤습니다. 현직은 이 칸이 비어 0점이 되는데,
     그러면 「합격한 사람들과 비교」가 학생에게 유리하게 나와 사실과 달라집니다.
     그래서 현직은 경력 줄을 같은 자리에 놓고 셉니다 (spec_score 참고) */
  if n_rows > 0 then
    for h in select coalesce(x ->> 'hospital', '') from jsonb_array_elements(p_rows) x loop
      if h like '%대학병원%' or h like '%상급종합%' or h like '%종합병원%'
         or h like '%공공기관(병원)%' or h like '%의료원%' then
        big := big + 1;
      end if;
    end loop;
    pt_prac := case when big >= 3 then 5 when big = 2 then 4 when big = 1 then 3 else 1 end;
  end if;

  return jsonb_build_object(
    'gpa', pt_gpa, 'lang', pt_lang, 'school', pt_school,
    'certs', pt_cert, 'courses', pt_course, 'practice', pt_prac,
    'total', pt_gpa + pt_lang + pt_school + pt_cert + pt_course + pt_prac);
end $$;


ALTER FUNCTION public.spec_parts(p_gpa numeric, p_gpa_scale numeric, p_lang_pt integer, p_school text, p_licenses text[], p_trainings text[], p_rows jsonb) OWNER TO postgres;

--
-- Name: spec_parts_check(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spec_parts_check() RETURNS TABLE("경우" text, "기대" numeric, "실제" numeric)
    LANGUAGE sql STABLE
    AS $$
  with t(경우, 칸, 기대, v) as (values
    ('학력 안 적음은 0점',        'school', 0,
       (public.spec_parts(null,null,null,null,   null,null,'[]'::jsonb))),
    ('학력 빈 글자도 0점',        'school', 0,
       (public.spec_parts(null,null,null,'',     null,null,'[]'::jsonb))),
    ('지방 3년제 3점',            'school', 3,
       (public.spec_parts(null,null,null,'지방 3년제', null,null,'[]'::jsonb))),
    ('서울·경기 3년제 4점',       'school', 4,
       (public.spec_parts(null,null,null,'서울·경기 3년제', null,null,'[]'::jsonb))),
    ('4년제 5점',                 'school', 5,
       (public.spec_parts(null,null,null,'지방 4년제', null,null,'[]'::jsonb))),
    ('목록에 없는 학교는 3점',    'school', 3,
       (public.spec_parts(null,null,null,'어디대학교', null,null,'[]'::jsonb))),
    ('학점 3.8/4.5 는 48점',      'gpa',   48,
       (public.spec_parts(3.8,4.5,null,null,     null,null,'[]'::jsonb))),
    ('어학 안 넣으면 0점',        'lang',   0,
       (public.spec_parts(null,null,null,null,   null,null,'[]'::jsonb))),
    ('어학 점수는 받아 쓰기만',   'lang',  12,
       (public.spec_parts(null,null,12,null,     null,null,'[]'::jsonb))),
    ('아무것도 안 적으면 0점',    'total',  0,
       (public.spec_parts(null,null,null,null,   null,null,'[]'::jsonb))),
    ('다 채우면 100점',           'total', 100,
       (public.spec_parts(4.5,4.5,15,'박사',
          array['컴퓨터활용능력 - 1급','한국사능력검정 - 1급','사회복지사 - 1급','보조공학사'],
          array['a','b','c','d'],
          '[{"hospital":"대학병원(국립)"},{"hospital":"종합병원"},{"hospital":"의료원"}]'::jsonb)))
  )
  select 경우, 기대, (v ->> 칸)::numeric from t where (v ->> 칸)::numeric is distinct from 기대
$$;


ALTER FUNCTION public.spec_parts_check() OWNER TO postgres;

--
-- Name: student_specs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_specs (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    school_type text,
    grade text,
    gpa numeric,
    gpa_scale numeric,
    licenses text[],
    trainings text[],
    practice jsonb,
    career jsonb,
    practice_months integer,
    career_months integer,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    want_type text,
    want_region text,
    CONSTRAINT spec_gpa_range CHECK ((((gpa IS NULL) OR ((gpa >= (0)::numeric) AND (gpa <= (100)::numeric))) AND ((gpa_scale IS NULL) OR ((gpa_scale >= (1)::numeric) AND (gpa_scale <= (100)::numeric)))))
);


ALTER TABLE public.student_specs OWNER TO postgres;

--
-- Name: TABLE student_specs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.student_specs IS '스펙. 현직·학생 공용입니다 — 옛 화면에서도 2단계 카드는 둘 다 썼습니다. 실습은 학생, 경력은 현직 칸입니다';


--
-- Name: spec_score(public.student_specs); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spec_score(s public.student_specs) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  select ((public.spec_parts(s.gpa, s.gpa_scale, public.lang_best(s.profile_id), s.school_type,
                             s.licenses, s.trainings,
                             coalesce(s.practice, s.career, '[]'::jsonb))) ->> 'total')::numeric
$$;


ALTER FUNCTION public.spec_score(s public.student_specs) OWNER TO postgres;

--
-- Name: spec_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.spec_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  me_id     uuid := auth.uid();
  min_peer  constant int := 3;
  min_pro   constant int := 20;
  my        record;
  my_parts  jsonb;
  my_score  numeric;
  my_lang   int;
  my_langs  jsonb;
  peer      jsonb;
  reach     jsonb;
  pro_n     int;
begin
  if me_id is null then
    return jsonb_build_object('me', null, 'min_peer', min_peer, 'min_pro', min_pro);
  end if;

  select s.*, pr.job_group, pr.role
    into my
    from student_specs s join profiles pr on pr.id = s.profile_id
   where s.profile_id = me_id;

  if not found then
    return jsonb_build_object('me', null, 'min_peer', min_peer, 'min_pro', min_pro);
  end if;

  my_lang := lang_best(me_id);
  /* 넣은 어학을 그대로 돌려줍니다 — /spec 이 「토익 850점」처럼 보여줍니다 */
  select coalesce(jsonb_agg(jsonb_build_object(
           'exam', exam, 'score', score, 'level', level,
           'points', lang_points(exam, score, level))
         order by lang_points(exam, score, level) desc, exam), '[]'::jsonb)
    into my_langs from spec_langs where profile_id = me_id;

  my_parts := spec_parts(my.gpa, my.gpa_scale, my_lang, my.school_type,
                         my.licenses, my.trainings,
                         coalesce(my.practice, my.career, '[]'::jsonb));
  my_score := (my_parts ->> 'total')::numeric;

  with p as (
    select spec_score(s.*) sc
      from student_specs s join profiles pr on pr.id = s.profile_id and not pr.excluded
     where pr.job_group is not distinct from my.job_group
       and pr.role      is not distinct from my.role
       and (my.role <> '학생' or s.grade is not distinct from my.grade)
  )
  select jsonb_build_object(
           'n', count(*),
           'top', case when count(*) >= min_peer
                  then round((1 - count(*) filter (where sc < my_score)::numeric / count(*)) * 100)
                  end)
    into peer from p;

  select count(*) into pro_n
    from student_specs s join profiles pr on pr.id = s.profile_id and not pr.excluded
    join salary_records sr on sr.profile_id = s.profile_id
   where pr.role = '현직' and pr.job_group is not distinct from my.job_group
     and s.school_type is not null and s.gpa > 0;

  if pro_n < min_pro then
    reach := jsonb_build_object('enough', false, 'have', pro_n, 'need', min_pro);
  else
    with t as (
      select sr.hospital_type ht, spec_score(s.*) sc
        from student_specs s join profiles pr on pr.id = s.profile_id and not pr.excluded
        join salary_records sr on sr.profile_id = s.profile_id
       where pr.role = '현직' and pr.job_group is not distinct from my.job_group
         and s.school_type is not null and s.gpa > 0
    ), g as (
      select ht, count(*) n, round(count(*) filter (where sc <= my_score)::numeric / count(*) * 100) rate
        from t group by ht having count(*) >= 3
    )
    select jsonb_build_object('enough', true, 'base', pro_n,
             'types', coalesce(jsonb_agg(jsonb_build_object('type', ht, 'n', n, 'rate', rate)
                                         order by rate desc), '[]'::jsonb))
      into reach from g;
  end if;

  return jsonb_build_object(
    'min_peer', min_peer, 'min_pro', min_pro,
    'me', jsonb_build_object(
      'job_group', my.job_group, 'role', my.role, 'grade', my.grade,
      'school_type', my.school_type, 'gpa', my.gpa, 'gpa_scale', my.gpa_scale,
      'langs', my_langs, 'lang_points', my_lang,
      'n_licenses', coalesce(array_length(my.licenses, 1), 0),
      'n_trainings', coalesce(array_length(my.trainings, 1), 0),
      'rows', coalesce(my.practice, my.career, '[]'::jsonb),
      'want_type', my.want_type, 'want_region', my.want_region,
      'score', round(my_score), 'parts', my_parts),
    'peer', peer,
    'reach', reach);
end $$;


ALTER FUNCTION public.spec_stats() OWNER TO postgres;

--
-- Name: unread_count(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.unread_count(p_room bigint) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select count(*) from chat_messages m
    join chat_members me on me.room_id = m.room_id and me.profile_id = auth.uid()
    where m.room_id = p_room and m.created_at > me.last_read_at and m.sender_id <> auth.uid()
  $$;


ALTER FUNCTION public.unread_count(p_room bigint) OWNER TO postgres;

--
-- Name: 가입하기(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."가입하기"("p_닉네임" text, "p_직군" text, "p_역할" text, "p_사진" text DEFAULT NULL::text, "p_약관판" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_이름 text := btrim(coalesce("p_닉네임", ''));
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if char_length(v_이름) < 2 or char_length(v_이름) > 12 then
    raise exception '2자에서 12자까지 쓸 수 있어요' using errcode = '22023';
  end if;
  if coalesce("p_직군",'') = '' or coalesce("p_역할",'') = '' then
    raise exception '직군과 역할을 골라 주세요' using errcode = '22023';
  end if;

  insert into profiles (id, nickname, job_group, role, avatar, terms_agreed_at, terms_version)
  values (auth.uid(), v_이름, "p_직군", "p_역할", "p_사진", now(), "p_약관판");

  return jsonb_build_object('됨', true);
exception
  when unique_violation then
    raise exception '이미 쓰고 있는 닉네임이에요. 다른 것으로 해주세요' using errcode = '23505';
  when foreign_key_violation then
    raise exception '로그인이 풀렸어요. 다시 로그인해 주세요' using errcode = '23503';
end $$;


ALTER FUNCTION public."가입하기"("p_닉네임" text, "p_직군" text, "p_역할" text, "p_사진" text, "p_약관판" text) OWNER TO postgres;

--
-- Name: 개인정보지움(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."개인정보지움"(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 coalesce(p, ''),
                 /* ① 휴대폰 — 02·0XX 유선 대표번호는 안 건드립니다 */
                 '01[016789][-. ]?[0-9]{3,4}[-. ]?[0-9]{4}', '[휴대폰 지움]', 'g'),
               /* ② 이메일 — 기관 것이어도 사람 계정일 수 있어 전부 */
               '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[이메일 지움]', 'g'),
             /* ③ 담당자 이름 — 부서 한 낱말(\2)은 남깁니다.
                  앞보기 둘: 열쇳말 자체가 이름으로 먹히지 않게 · 부서 꼴을 이름으로 안 보게 */
             '(담당자|담당|문의처|문의|연락처)(\s*[:：]?\s*[가-힣]{2,6}(팀|과|부|실|처|국|센터))?\s*[:：]?\s*'
             || '(?!(담당자|담당|문의처|문의|연락처)[^가-힣])'
             || '(?![가-힣]{0,4}(팀|과|부|실|처|국|센터)[^가-힣])'
             || '[가-힣]{2,4}(\s*(주무관|주임|과장|팀장|대리|사원|선생님?))?',
             '\1\2 [이름 지움]', 'g'),
           /* ④ 주민번호 꼴 */
           '[0-9]{6}\s*-\s*[1-4][0-9]{6}', '[주민번호 지움]', 'g');
$$;


ALTER FUNCTION public."개인정보지움"(p text) OWNER TO postgres;

--
-- Name: FUNCTION "개인정보지움"(p text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."개인정보지움"(p text) IS '저장 전에 휴대폰·이메일·담당자 이름·주민번호를 지웁니다. 유선 대표번호와 부서 이름은 남깁니다 (2026-09-28)';


--
-- Name: 견줄이름(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."견줄이름"(s text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select regexp_replace(org_name_key(coalesce(s, '')), '부속|종합', '', 'g');
$$;


ALTER FUNCTION public."견줄이름"(s text) OWNER TO postgres;

--
-- Name: 경쟁률찾기목록(text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."경쟁률찾기목록"("p_직군" text DEFAULT NULL::text, "p_지역" text DEFAULT NULL::text, "p_기관" text DEFAULT NULL::text, "p_찾기" text DEFAULT NULL::text, "p_쪽" integer DEFAULT 1) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 낼것 as (
    select * from alio_group_sum
     where 우리직군 and not 짝확인필요 and not 고용형태확인필요
       and not 합쳐짐 and 값있음 > 0
  ), 걸러진 as (
    select * from 낼것
     where (p_직군 is null or 직군 = p_직군)
       and (p_지역 is null or 지역 = p_지역)
       and (p_기관 is null or 기관 = p_기관)
       and (p_찾기 is null or btrim(p_찾기) = ''
            or 기관 ilike '%'||p_찾기||'%' or coalesce(자리,'') ilike '%'||p_찾기||'%')
  )
  select jsonb_build_object(
    '전체', (select count(*) from 걸러진),
    '쪽', greatest(coalesce(p_쪽,1), 1),
    '쪽당', 30,
    '직군들', (select coalesce(jsonb_agg(distinct 직군), '[]'::jsonb) from 낼것),
    '지역들', (select coalesce(jsonb_agg(x), '[]'::jsonb)
               from (select distinct 지역 x from 낼것 order by 1) t),
    '기관들', (select coalesce(jsonb_agg(x), '[]'::jsonb)
               from (select distinct 기관 x from 낼것 order by 1) t),
    '묶음', (select coalesce(jsonb_agg(jsonb_build_object(
                '묶음키', 묶음키, '기관', 기관, '직군', 직군,
                '지역', 지역, '고용형태', 고용형태, '자리', 자리,
                '회차', 회차, '첫해', 첫해, '끝해', 끝해,
                '기본값단계', 기본값단계
              ) order by 회차 desc, 기관, 직군), '[]'::jsonb)
             from (select * from 걸러진 order by 회차 desc, 기관, 직군
                    limit 30 offset (greatest(coalesce(p_쪽,1),1) - 1) * 30) p)
  )
$$;


ALTER FUNCTION public."경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer) OWNER TO postgres;

--
-- Name: FUNCTION "경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer) IS '경쟁률 찾아보기 목록. 누구나 부릅니다. ★ 평균·가장높음·가장낮음·값있음을
   **아예 안 내보냅니다** — 숫자는 경쟁률한묶음() 이 로그인 확인 뒤에 줍니다.
   화면에서 가리면 개발자 도구로 보입니다 (2026-10-05 세중님 결정 · 가운데 길).';


--
-- Name: 경쟁률한묶음(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."경쟁률한묶음"("p_묶음키" text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  select jsonb_build_object(
    '머리', jsonb_build_object(
      '묶음키', g.묶음키, '기관', g.기관, '직군', g.직군, '지역', g.지역,
      '고용형태', g.고용형태, '자리', g.자리, '회차', g.회차,
      '첫해', g.첫해, '끝해', g.끝해, '값있음', g.값있음,
      '평균', g.평균, '가장낮음', g.가장낮음, '가장높음', g.가장높음,
      '계산불가', g.계산불가, '기본값단계', g.기본값단계),
    '회차들', (select coalesce(jsonb_agg(jsonb_build_object(
          'sn', z.sn, '마감', z.end_ymd, '해', z.year, '공고제목', z.pbanc_ttl,
          '자리이름', z.자리이름, '경쟁률', z.cmptt_rt, '경쟁률상태', z.cmptt_rt_state,
          '첫응시', z.first_aply, '끝선발', z.final_nope,
          '단계들', z.단계들) order by z.end_ymd desc nulls last), '[]'::jsonb)
        from (select w.sn, w.group_no, c.end_ymd, c.year, c.pbanc_ttl, w.자리이름,
                     w.cmptt_rt, w.cmptt_rt_state, w.first_aply, w.final_nope,
                     (select jsonb_agg(jsonb_build_object(
                          '이름', w2.step_name, '선발', w2.recrut_nope,
                          '응시', w2.aply_nope, '확정일', w2.rsn_ymd)
                        order by w2.step_no)
                        from alio_compete_web w2
                       where w2.sn = w.sn and w2.group_no = w.group_no) 단계들
                from alio_compete_web w
                join (select distinct on (sn) sn, end_ymd, year, pbanc_ttl
                        from alio_compete order by sn) c on c.sn = w.sn
               where w.묶음키 = p_묶음키 and w.is_last) z)
  ) into v
    from alio_group_sum g
   where g.묶음키 = p_묶음키
     and g.우리직군 and not g.짝확인필요 and not g.고용형태확인필요
     and not g.합쳐짐 and g.값있음 > 0;

  if v is null then raise exception '없는 묶음입니다'; end if;
  return v;
end $$;


ALTER FUNCTION public."경쟁률한묶음"("p_묶음키" text) OWNER TO postgres;

--
-- Name: FUNCTION "경쟁률한묶음"("p_묶음키" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."경쟁률한묶음"("p_묶음키" text) IS '한 묶음의 경쟁률과 회차별 내역. ★ 첫 줄에서 auth.uid() 로 로그인을 확인합니다.
   anon 에게도 실행 권한을 주되 42501 로 막습니다 — 화면이 「로그인하면 볼 수
   있어요」를 띄울 수 있게 (2026-10-05).';


--
-- Name: 경쟁사_오래된글_지우기(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."경쟁사_오래된글_지우기"(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_지움 int := 0;
  v_남음 int := 0;
begin
  perform set_config('app.누가', '경쟁사 오래된 글 지우기', true);

  delete from rival_post
  where 처음본때 < now() - (p_days || ' days')::interval;
  get diagnostics v_지움 = row_count;

  select count(*) into v_남음 from rival_post;

  return jsonb_build_object('지운 줄', v_지움, '남은 줄', v_남음, '며칠', p_days,
                            '언제', (now() at time zone 'Asia/Seoul'));
end $$;


ALTER FUNCTION public."경쟁사_오래된글_지우기"(p_days integer) OWNER TO postgres;

--
-- Name: 고용24칸바로잡기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."고용24칸바로잡기"() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_시도 text[] := array['서울','부산','대구','인천','광주','대전','울산','세종',
                         '경기','강원','충북','충남','전북','전남','경북','경남','제주',
                         '전남광주'];
  v_고용 text[] := array['정규직','계약직','비정규직','무기계약직'];
  v_전_지역아님 int; v_전_경력이고용형태 int; v_고친줄 int;
  v_후_지역아님 int; v_후_경력이고용형태 int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;

  select count(*) into v_전_지역아님 from job_posts
   where source='JF' and coalesce(work_place,'') <> '' and not (work_place = any(v_시도));
  select count(*) into v_전_경력이고용형태 from job_posts
   where source='JF' and employ_type in ('NEW','CAREER','ANY','신입/경력','FIELD_DIFFERENCE','INTERNSHIP');

  with 풀기 as (
    select id, btrim(work_place) 꼬리표, employ_type 옛고용 from job_posts where source='JF'
  ),
  정리 as (
    select id,
           case when 꼬리표 = any(v_시도) then 꼬리표 else '' end  새근무지,
           case when 꼬리표 = any(v_고용) then 꼬리표 else '' end  새고용,
           case when 꼬리표 <> '' and not (꼬리표 = any(v_시도))
                     and not (꼬리표 = any(v_고용)) then 꼬리표 else null end  남은꼬리표,
           case 옛고용
             when 'NEW' then '신입' when 'CAREER' then '경력'
             when 'ANY' then '관계없음' when 'NEW_CAREER' then '신입/경력'
             /* ★ 뜻을 못 확인한 둘은 [미확인] 을 답니다 (2026-10-07).
                  JobFlex 상세 API 가 401 이라 확인 못 했습니다 */
             when 'FIELD_DIFFERENCE' then '분야별 상이 [미확인]'
             when 'INTERNSHIP' then '인턴 [미확인]'
             else 옛고용 end  새채용구분
      from 풀기
  )
  update job_posts j
     set work_place  = 정리.새근무지,
         employ_type = 정리.새고용,
         hire_type   = case when coalesce(j.hire_type,'') = '' then 정리.새채용구분
                            else j.hire_type end,
         detail      = case when 정리.남은꼬리표 is null then j.detail
                            else coalesce(j.detail,'{}'::jsonb)
                                 || jsonb_build_object('꼬리표', 정리.남은꼬리표) end,
         updated_at  = now()
    from 정리
   where j.id = 정리.id
     and (j.work_place is distinct from 정리.새근무지
       or j.employ_type is distinct from 정리.새고용);
  get diagnostics v_고친줄 = row_count;

  update job_posts set hire_type = '분야별 상이 [미확인]'
   where source='JF' and hire_type in ('FIELD_DIFFERENCE', '분야무관');
  update job_posts set hire_type = '인턴 [미확인]'
   where source='JF' and hire_type = 'INTERNSHIP';

  select count(*) into v_후_지역아님 from job_posts
   where source='JF' and coalesce(work_place,'') <> '' and not (work_place = any(v_시도));
  select count(*) into v_후_경력이고용형태 from job_posts
   where source='JF' and employ_type in ('NEW','CAREER','ANY','신입/경력','FIELD_DIFFERENCE','INTERNSHIP');

  return jsonb_build_object(
    '고친줄', v_고친줄,
    '전_근무지가_지역이_아닌줄', v_전_지역아님,
    '후_근무지가_지역이_아닌줄', v_후_지역아님,
    '전_고용형태에_경력조건이_든줄', v_전_경력이고용형태,
    '후_고용형태에_경력조건이_든줄', v_후_경력이고용형태);
end $$;


ALTER FUNCTION public."고용24칸바로잡기"() OWNER TO postgres;

--
-- Name: 고용형태보임(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."고용형태보임"(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when v is null or btrim(v) = '' then null

    /* 워크넷 코드 (empTpCd). 목록 API 는 empTpNm 을 주지 않습니다 */
    when btrim(v) = '10' then '정규직'
    when btrim(v) = '11' then '정규직(시간선택제)'
    when btrim(v) = '20' then '계약직'
    when btrim(v) = '21' then '계약직(시간선택제)'

    /* 같은 뜻인데 출처마다 다른 말을 씁니다 — 거르기가 둘로 갈립니다 */
    when btrim(v) in ('계약직', '기간제', '일반계약직', '전문계약직')
      then '계약직'
    when btrim(v) in ('계약직(시간선택제)', '기간제(시간선택제)',
                      '계약직(시간제)',     '기간제(시간제)', '시간선택제')
      then '계약직(시간선택제)'
    when btrim(v) in ('일반정규직', '정규직')              then '정규직'
    when btrim(v) in ('정규직(시간선택제)', '정규직(시간제)') then '정규직(시간선택제)'

    /* 「비정규직」은 기관이 적은 그대로 둡니다 (2026-10-07 세중님) */
    when btrim(v) = '비정규직' then '비정규직'

    /* ★ 처음 보는 코드는 회원에게 안 보냅니다 (2026-10-07 세중님).
         한글이 하나도 없으면 코드로 봅니다. 화면이 「공고문 참고」 로 그립니다.
         「[미확인]」 이 붙은 것도 같습니다 — 관리자 화면에만 남깁니다 */
    when btrim(v) !~ '[가-힣]' then null
    when btrim(v) like '%[미확인]%' then null

    else btrim(v)
  end
$$;


ALTER FUNCTION public."고용형태보임"(v text) OWNER TO postgres;

--
-- Name: FUNCTION "고용형태보임"(v text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."고용형태보임"(v text) IS '보여 줄 고용형태를 정하는 한 곳. 계약직·기간제 → 계약직, 일반정규직 → 정규직. job_posts_pub 뷰와 제목 이어 붙이기가 같이 씁니다 (2026-10-05).';


--
-- Name: job_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_posts (
    id text NOT NULL,
    source text NOT NULL,
    external_id text,
    org_name text NOT NULL,
    title text NOT NULL,
    hire_type text,
    employ_type text,
    work_place text,
    sido text,
    sgg text,
    edu text,
    headcount integer,
    apply_from date,
    apply_to date,
    posted_at date,
    url text NOT NULL,
    job_group text,
    form text,
    org_kind text,
    tab text,
    hidden boolean DEFAULT false NOT NULL,
    hold boolean DEFAULT false NOT NULL,
    notify boolean DEFAULT false NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    edited_fields text[] DEFAULT '{}'::text[] NOT NULL,
    detail_tries integer DEFAULT 0 NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    score numeric DEFAULT 0 NOT NULL,
    score_at timestamp with time zone,
    hidden_why text,
    hidden_on date,
    seen_on date,
    gone_streak smallint DEFAULT 0 NOT NULL,
    first_seen date,
    deadline_src text,
    is_intern boolean GENERATED ALWAYS AS ((title ~ '수련생|체험형|청년인턴|인턴'::text)) STORED,
    admin_locked boolean DEFAULT false NOT NULL,
    admin_at timestamp with time zone,
    admin_note text,
    db_insert_at timestamp with time zone DEFAULT now() NOT NULL,
    "같은공고" text,
    "고용형태보임" text GENERATED ALWAYS AS (public."고용형태보임"(employ_type)) STORED,
    "보여줄제목" text,
    apply_to_time time without time zone,
    "기관번호" text,
    "연결상태" text,
    "연결근거" text,
    "시험자료" boolean DEFAULT false NOT NULL,
    "뽑은값" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "뽑은때" timestamp with time zone,
    "뽑은법" text,
    "수집묶음" text,
    "이름열쇠" text GENERATED ALWAYS AS (public."견줄이름"(org_name)) STORED
);


ALTER TABLE public.job_posts OWNER TO postgres;

--
-- Name: TABLE job_posts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_posts IS '채용공고. 거르는 칸만 진짜 칸이고 본문은 detail jsonb 에 넣습니다';


--
-- Name: COLUMN job_posts.hidden_why; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.hidden_why IS '감춘 까닭. 「마감 지남」 「45일 지남」 「원래 글 없어짐」 「쓰레기통」. 비어 있으면 안 감춘 것';


--
-- Name: COLUMN job_posts.gone_streak; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.gone_streak IS '원문이 404 인 것을 연속 몇 번 봤나. **두 번 연속일 때만** 감춥니다 (사이트 일시 장애 대비)';


--
-- Name: COLUMN job_posts.first_seen; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.first_seen IS '이 공고를 처음 본 날. **뒤로 가지 않습니다** (방아쇠가 막습니다). 45일 셈은 이 칸으로 합니다';


--
-- Name: COLUMN job_posts.deadline_src; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.deadline_src IS '마감일이 어디서 왔나. 비어 있으면 수집한 그대로, 「제목」 이면 제목에서 읽은 것';


--
-- Name: COLUMN job_posts.is_intern; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.is_intern IS '수련생·인턴 자리인가 (제목에서 만들어집니다). 회원 화면에 딱지로 보여 주세요';


--
-- Name: COLUMN job_posts.admin_locked; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.admin_locked IS '관리자가 손으로 정한 공고. 규칙·재판정·동기화가 hold/hidden/job_group 을 못 건드립니다 (2026-09-29)';


--
-- Name: COLUMN job_posts."고용형태보임"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts."고용형태보임" IS '화면과 제목이 쓰는 고용형태. employ_type 원래 값은 그대로 두고 여기서만 맞춥니다 (계약직·기간제 → 계약직, 일반정규직 → 정규직). 2026-10-05.';


--
-- Name: COLUMN job_posts."보여줄제목"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts."보여줄제목" IS '회원에게 보여 줄 제목. 원문(title)은 그대로 둡니다. 비우면 원문이 나갑니다 (2026-10-05).';


--
-- Name: COLUMN job_posts.apply_to_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts.apply_to_time IS '접수 마감 시각 (한국 시각). null 이면 「그날 종일」. 원문에 적힌 것만 넣습니다 — 짐작 금지';


--
-- Name: COLUMN job_posts."연결상태"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts."연결상태" IS '자동(규칙이 한 곳으로 좁혔음) · 사람(관리자가 이었음 — 아무도 덮지 않습니다)
   · 대기(이름이 여럿인데 못 좁혔음) · 없음(심평원에 없는 기관)';


--
-- Name: COLUMN job_posts."수집묶음"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_posts."수집묶음" IS '그 줄이 어느 작업에서 들어왔나. 한 번에 되돌릴 때 씁니다 (2026-10-11)';


--
-- Name: 고용형태보임행(public.job_posts); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."고용형태보임행"(j public.job_posts) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  /* ★ 2026-10-28 ㉫ (세중님 B·F) — **빈 값을 거치지 않습니다.**
     employ_type 이 비면 제목에 고용형태를 **안 적습니다**.
     전에는 원문 제목에서 「정규직」 같은 글자를 주웠습니다 (예수병원 때문에 넣은 길).
     그런데 그 공고의 **우리 직군 자리**가 정규직인지는 공고문을 봐야 압니다
     — 306248 은 「정규직(약무직) 및 계약직(…)」 를 함께 뽑는 공고입니다.
     값이 「체험형 인턴」·「채용형 인턴」·「인턴」이면 고용형태보임() 이 그대로 냅니다 */
  return "고용형태보임"(j.employ_type);
end $$;


ALTER FUNCTION public."고용형태보임행"(j public.job_posts) OWNER TO postgres;

--
-- Name: 공개공고(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공개공고"() RETURNS TABLE(id text, title text, org_name text, sido text, job_group text, apply_to date, is_intern boolean, url text, "전체건수" bigint, "보여주는수" integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_몇건 integer;
  v_전체 bigint;
begin
  select case when jsonb_typeof(s.value) = 'number' then (s.value)::text::integer else null end
    into v_몇건
    from site_settings s where s.key = '비로그인_공고수';
  v_몇건 := coalesce(v_몇건, 10);
  if v_몇건 < 0 or v_몇건 > 100 then v_몇건 := 100; end if;

  select count(*) into v_전체 from job_posts_pub j
   where j.apply_to is null or j.apply_to >= v_오늘;

  return query
    select j.id, j.title, j.org_name, j.sido,
           j.job_group, j.apply_to, j.is_intern,
           /* ★ 2026-10-09 — 비회원 맛보기에는 원문 주소를 안 실습니다.
              회원이 이 창구를 부를 일은 없지만, 부르면 그대로 줍니다 */
           case when auth.uid() is null then null else j.url end,
           v_전체, v_몇건
      from job_posts_pub j
     where (j.apply_to is null or j.apply_to >= v_오늘)
     order by j.posted_at desc nulls last, j.id
     limit greatest(v_몇건, 0);
end $$;


ALTER FUNCTION public."공개공고"() OWNER TO postgres;

--
-- Name: 공개공고하나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공개공고하나"(p_id text) RETURNS TABLE(id text, title text, org_name text, sido text, job_group text, apply_from date, apply_to date, is_intern boolean, url text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return query
    select o.id, o.title, o.org_name, o.sido,
           o.job_group, p.apply_from, o.apply_to, o.is_intern, o.url
      from 공개공고() o
      join job_posts_pub p on p.id = o.id
     where o.id = p_id;
end $$;


ALTER FUNCTION public."공개공고하나"(p_id text) OWNER TO postgres;

--
-- Name: 공고경쟁률있나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고경쟁률있나"("p_공고" text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with j as (select org_name, job_group, 기관번호 from job_posts where id = p_공고),
  이름들 as (
    select j.org_name as 이름 from j
    union
    select o.이름 from 기관 o join j on o.기관번호 = j.기관번호
    union
    select m.이름 from 기관 o join j on o.기관번호 = j.기관번호
                  join 기관 m on m.기관번호 = o.모기관번호
  )
  select exists (
    select 1 from alio_group_sum s join 이름들 n on n.이름 = s.기관, j
     where s.우리직군
       and (j.job_group is null or j.job_group = '공통' or s.직군 = j.job_group))
$$;


ALTER FUNCTION public."공고경쟁률있나"("p_공고" text) OWNER TO postgres;

--
-- Name: 공고뽑은값(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고뽑은값"(p_id text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /* 비회원에게는 안 줍니다 — 지원자격·연봉은 회원 자료입니다 */
  select case when auth.uid() is null then '{}'::jsonb
              else coalesce(j."뽑은값", '{}'::jsonb) end
    from job_posts j where j.id = p_id
$$;


ALTER FUNCTION public."공고뽑은값"(p_id text) OWNER TO postgres;

--
-- Name: 공고연결(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고연결"("p_남길" text, "p_연결할" text, "p_왜" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if p_남길 = p_연결할 then
    raise exception '같은 줄끼리는 연결할 수 없습니다';
  end if;
  update job_posts
     set 같은공고 = p_남길, hidden = true, hold = false,
         hidden_why = '같은 공고 — ' || p_남길 || ' 와 묶음' || coalesce(' · ' || p_왜, ''),
         hidden_on = (now() at time zone 'Asia/Seoul')::date
   where id = p_연결할 and not admin_locked;
  get diagnostics v = row_count;
  perform 접속기록남기기('고침(공고 연결)', 'job_posts', null, v);
  return jsonb_build_object('연결함', v, '남긴 줄', p_남길, '연결한 줄', p_연결할);
end $$;


ALTER FUNCTION public."공고연결"("p_남길" text, "p_연결할" text, "p_왜" text) OWNER TO postgres;

--
-- Name: 공고연결풀기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고연결풀기"("p_연결할" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  update job_posts
     set 같은공고 = null, hidden = false, hidden_why = null, hidden_on = null
   where id = p_연결할 and 같은공고 is not null and not admin_locked;
  get diagnostics v = row_count;
  return jsonb_build_object('푼 줄', v);
end $$;


ALTER FUNCTION public."공고연결풀기"("p_연결할" text) OWNER TO postgres;

--
-- Name: 공고열쇠(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select case
    /* ① 워크넷 — 공고 번호 하나로 봅니다 (제목·주소 꼬리 무시) */
    when p_주소 ~ 'wantedAuthNo=[A-Za-z0-9]' then
      '워크넷|' || (regexp_match(p_주소, 'wantedAuthNo=([A-Za-z0-9]+)'))[1]
    /* ② 그 밖 — 기관|주소|제목 세 토막 (2026-10-18 그대로) */
    else
      -- 기관 — 글자·숫자만
      regexp_replace(coalesce(p_기관, ''), '[^가-힣A-Za-z0-9]', '', 'g')
      || '|' ||
      -- 주소 — scheme · www · 끝 슬래시 · 대소문자를 맞춥니다
      regexp_replace(
        regexp_replace(lower(coalesce(p_주소, '')), '^https?://(www\.)?', ''),
        '/+$', '')
      || '|' ||
      -- 제목 — D-데이·경력 꼬리를 떼고 글자·숫자만
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_제목, ''),
            '[\(\[]?[[:space:]]*[Dd][[:space:]]*-[[:space:]]*([Dd][Aa][Yy]|[0-9]+)[[:space:]]*[\)\]]?', '', 'g'),
          '[\(\[][[:space:]]*(경력[[:space:]]*무관|신입[[:space:]]*/?[[:space:]]*경력|신입|경력)[[:space:]]*[\)\]]', '', 'g'),
        '[^가-힣A-Za-z0-9]', '', 'g')
  end
$_$;


ALTER FUNCTION public."공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text) OWNER TO postgres;

--
-- Name: FUNCTION "공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text) IS '같은 공고인지 보는 열쇠 — 워크넷은 wantedAuthNo 하나로, 그 밖은 기관|주소|제목. 공고ID 와는 별개입니다 (2026-10-19)';


--
-- Name: 공고오류신고(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고오류신고"(p_job text, p_reason text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_사유 text := btrim(coalesce(p_reason, '')); v_id bigint;
begin
  if v_me is null then raise exception '로그인해야 신고할 수 있습니다' using errcode = '42501'; end if;
  if char_length(v_사유) < 2 then
    raise exception '어디가 잘못됐는지 두 글자 이상 적어 주세요' using errcode = '22023'; end if;
  v_사유 := left(v_사유, 500);
  if not exists (select 1 from job_posts j where j.id = p_job) then
    raise exception '없는 공고입니다' using errcode = '22023'; end if;
  /* 한 사람이 하루 10건까지. 더 받으면 관리자가 못 봅니다 */
  if (select count(*) from 공고신고 r
       where r.reporter_id = v_me and r.created_at > now() - interval '1 day') >= 10 then
    raise exception '오늘은 신고를 10건까지 받았어요. 내일 다시 보내 주세요' using errcode = '42901'; end if;
  /* 같은 공고를 또 보내면 새 줄을 안 만들고 사유만 덧붙입니다 (공고신고_한번) */
  update 공고신고 r set reason = left(r.reason || E'\n' || v_사유, 500)
   where r.job_id = p_job and r.reporter_id = v_me and r.handled_at is null
   returning r.id into v_id;
  if v_id is not null then return v_id; end if;
  insert into 공고신고 (job_id, reporter_id, reason) values (p_job, v_me, v_사유) returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION public."공고오류신고"(p_job text, p_reason text) OWNER TO postgres;

--
-- Name: 공고원문제목(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고원문제목"(p_id text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /* 보여 줄 제목과 **다를 때만** 돌려줍니다 — 같으면 화면에 두 번 적힙니다.
     숨김·보류 공고는 job_posts_pub 에 없어서 자연히 빠집니다 */
  select case when j.원문제목 is distinct from j.title then j.원문제목 end
    from job_posts_pub j where j.id = p_id
$$;


ALTER FUNCTION public."공고원문제목"(p_id text) OWNER TO postgres;

--
-- Name: 공고접수마감글(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고접수마감글"(p_id text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select nullif(x."뽑은값"->>'접수마감글', '') from job_posts x where x.id = p_id
$$;


ALTER FUNCTION public."공고접수마감글"(p_id text) OWNER TO postgres;

--
-- Name: 공고조회수(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공고조회수"(p_id text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int from page_hits where kind = 'job' and not by_admin and target = p_id
$$;


ALTER FUNCTION public."공고조회수"(p_id text) OWNER TO postgres;

--
-- Name: 공공기관인가(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공공기관인가"(p_id text, p_tab text, p_org_name text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  select coalesce(p_tab like '공공기관·대학·종합%', false)
      /* 출처 자체가 공공만 모으는 곳 — 치매센터·나라일터·클린아이·알리오 */
      or coalesce(p_id, '') ~ '^(ND|GJ|CE)'
      or coalesce(p_id, '') ~ '^[0-9]+$'
      or coalesce(p_org_name, '') ~
         '의료원|치매센터|치매안심센터|보건소|보건의료원|공단|공사|국립|시립|도립|군립|구립|보훈|산재|대학교병원|대학병원'
$_$;


ALTER FUNCTION public."공공기관인가"(p_id text, p_tab text, p_org_name text) OWNER TO postgres;

--
-- Name: 공식확인하기(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."공식확인하기"("p_공고" text, "p_맞나" boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_기관 text;
begin
  select 기관번호 into v_기관 from job_posts where id = p_공고;
  if v_기관 is null then raise exception '기관이 안 붙은 공고입니다' using errcode = '22023'; end if;
  if not exists (select 1 from 회원자격 q
                  where q.profile_id = auth.uid() and q.갈래 = '채용담당자'
                    and q.상태 = '승인' and q.기관번호 = v_기관) then
    raise exception '이 병원의 승인된 담당자가 아닙니다' using errcode = '42501';
  end if;

  update job_posts
     set evidence = coalesce(evidence, '{}'::jsonb)
                    || jsonb_build_object('공식확인', p_맞나,
                                          '공식확인한사람', auth.uid(),
                                          '공식확인때', now())
   where id = p_공고;

  return jsonb_build_object('공고', p_공고, '공식확인', p_맞나);
end $$;


ALTER FUNCTION public."공식확인하기"("p_공고" text, "p_맞나" boolean) OWNER TO postgres;

--
-- Name: 광고셈올리기(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."광고셈올리기"("p_자리" text, "p_누름" boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from 지금광고(p_자리)) then
    return;
  end if;
  insert into 광고셈 (자리, 날, 봄, 누름)
  values (p_자리, (now() at time zone 'Asia/Seoul')::date,
          case when p_누름 then 0 else 1 end,
          case when p_누름 then 1 else 0 end)
  on conflict (자리, 날) do update
     set 봄   = 광고셈.봄   + case when p_누름 then 0 else 1 end,
         누름 = 광고셈.누름 + case when p_누름 then 1 else 0 end;
end $$;


ALTER FUNCTION public."광고셈올리기"("p_자리" text, "p_누름" boolean) OWNER TO postgres;

--
-- Name: 교육과정고치기(bigint, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육과정고치기"("p_과정" bigint, "p_제목" text DEFAULT NULL::text, "p_직군" text DEFAULT NULL::text, "p_소개" text DEFAULT NULL::text, "p_숨길까" boolean DEFAULT NULL::boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not 교육담당자인가(p_과정) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;
  if p_직군 is not null and p_직군 not in ('작업치료사', '물리치료사') then
    raise exception '직군은 작업치료사 또는 물리치료사입니다' using errcode = '22023';
  end if;
  update 교육과정 set
    제목 = coalesce(nullif(btrim(coalesce(p_제목, '')), ''), 제목),
    직군 = coalesce(p_직군, 직군),
    소개 = coalesce(p_소개, 소개),
    숨김 = coalesce(p_숨길까, 숨김)
   where 과정id = p_과정;
  return true;
end $$;


ALTER FUNCTION public."교육과정고치기"("p_과정" bigint, "p_제목" text, "p_직군" text, "p_소개" text, "p_숨길까" boolean) OWNER TO postgres;

--
-- Name: 교육과정만들기(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육과정만들기"("p_제목" text, "p_직군" text DEFAULT NULL::text, "p_소개" text DEFAULT NULL::text, "p_교육기관" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_id bigint; v_갈래 text;
begin
  if p_교육기관 is not null then
    if not exists (select 1 from 회원자격 q where q.profile_id = v
                     and q.갈래 = '교육담당자기관' and q.상태 = '승인' and q.교육기관 = p_교육기관) then
      raise exception '그 기관의 승인된 담당자가 아닙니다' using errcode = '42501';
    end if;
    v_갈래 := '기관';
  else
    if not exists (select 1 from 회원자격 q where q.profile_id = v
                     and q.갈래 = '교육담당자개인' and q.상태 = '승인') then
      raise exception '승인된 개인 강사가 아닙니다' using errcode = '42501';
    end if;
    v_갈래 := '개인';
  end if;

  insert into 교육과정 (주최갈래, 교육기관, 강사, 제목, 직군, 소개, 만든이, 시험자료)
  values (v_갈래, p_교육기관, case when v_갈래 = '개인' then v end,
          p_제목, p_직군, p_소개, v,
          /* ★ 2026-10-09 — 마스터가 페르소나로 만든 것은 시험자료입니다.
             시험 교육기관에 붙은 것도 마찬가지입니다 */
          (마스터인가() or p_교육기관 = '시험 교육기관 (마스터 전용)'))
  returning 과정id into v_id;

  return jsonb_build_object('과정id', v_id);
end $$;


ALTER FUNCTION public."교육과정만들기"("p_제목" text, "p_직군" text, "p_소개" text, "p_교육기관" text) OWNER TO postgres;

--
-- Name: 교육기관목록(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육기관목록"("p_직군" text DEFAULT NULL::text) RETURNS TABLE("이름" text, "직군" text, "소개" text, "그림" text, "누리집" text, "모음" boolean, "링크주소" text, "열린교육" integer, "최근" date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.이름, o.직군, o.소개, o.그림, o.누리집, o.모음, o.링크주소,
         (select count(*)::int from 교육 e
           where e.출처 = o.이름
             and (e.끝 is null or e.끝 >= (now() at time zone 'Asia/Seoul')::date)),
         (select max(coalesce(e.시작, e.올린날)) from 교육 e where e.출처 = o.이름)
  from 교육기관 o
  where o.보임
    and (p_직군 is null or p_직군 = '전체'
         or o.직군 = p_직군 or o.직군 = '공통')
  order by o.차례, o.이름
  limit 100;
$$;


ALTER FUNCTION public."교육기관목록"("p_직군" text) OWNER TO postgres;

--
-- Name: 교육기관알림켜기(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육기관알림켜기"("p_기관" text, "p_켤까" boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_나 uuid := auth.uid();
begin
  if v_나 is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if not exists (select 1 from 교육기관 where 이름 = p_기관 and 보임) then
    raise exception '그런 기관이 없습니다' using errcode = '22023';
  end if;
  if p_켤까 then
    insert into 교육기관알림 (회원, 기관) values (v_나, p_기관)
      on conflict (회원, 기관) do nothing;
  else
    delete from 교육기관알림 where 회원 = v_나 and 기관 = p_기관;
  end if;
  return jsonb_build_object('켜짐', p_켤까, '기관', p_기관);
end $$;


ALTER FUNCTION public."교육기관알림켜기"("p_기관" text, "p_켤까" boolean) OWNER TO postgres;

--
-- Name: 교육기관하나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육기관하나"("p_이름" text) RETURNS TABLE("이름" text, "직군" text, "소개" text, "그림" text, "누리집" text, "모음" boolean, "링크주소" text, "열린교육" integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.이름, o.직군, o.소개, o.그림, o.누리집, o.모음, o.링크주소,
         (select count(*)::int from 교육 e
           where e.출처 = o.이름
             and (e.끝 is null or e.끝 >= (now() at time zone 'Asia/Seoul')::date))
  from 교육기관 o
  where o.보임 and o.이름 = p_이름
  limit 1;
$$;


ALTER FUNCTION public."교육기관하나"("p_이름" text) OWNER TO postgres;

--
-- Name: 교육담기(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육담기"(p_secret text, "p_교육" jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_수 int := 0;
begin
  if not exists (
    select 1 from collect_secret s
    where s.source = 'EDU' and s.secret = p_secret
  ) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  if p_교육 is null or jsonb_typeof(p_교육) <> 'array' then
    return jsonb_build_object('교육', 0);
  end if;

  insert into 교육 (번호, 출처, 직군, 갈래, 제목, 시작, 끝, 장소,
                    모집인원, 상태, 올린날, 접수시작, 링크, 원문, updated_at)
  select x.번호, x.출처,
         coalesce(nullif(x.직군, ''), '공통'),
         coalesce(nullif(x.갈래, ''), '공지'),
         x.제목,
         nullif(x.시작, '')::date, nullif(x.끝, '')::date,
         x.장소, x.모집인원,
         coalesce(nullif(x.상태, ''), '모름'),
         nullif(x.올린날, '')::date,
         nullif(x.접수시작, '')::date,
         x.링크, left(coalesce(x.원문, ''), 1000), now()
  from jsonb_to_recordset(p_교육) as x(
    번호 text, 출처 text, 직군 text, 갈래 text, 제목 text,
    시작 text, 끝 text, 장소 text, 모집인원 text, 상태 text,
    올린날 text, 접수시작 text, 링크 text, 원문 text)
  where x.번호 is not null and x.번호 <> ''
    and x.제목 is not null and x.제목 <> ''
    and x.링크 is not null and x.링크 <> ''
  on conflict (번호) do update set
    출처 = excluded.출처, 직군 = excluded.직군, 갈래 = excluded.갈래,
    제목 = excluded.제목, 시작 = excluded.시작, 끝 = excluded.끝,
    장소 = excluded.장소, 모집인원 = excluded.모집인원,
    상태 = excluded.상태, 올린날 = excluded.올린날,
    /* ★ 접수시작은 **덮어쓰지 않고 채우기만** 합니다.
       한 번 알아낸 기준일이 다음 수집에서 빈 값으로 지워지면
       그 공고가 「새 것」으로 되살아나 알림이 다시 갑니다 */
    접수시작 = coalesce(excluded.접수시작, 교육.접수시작),
    링크 = excluded.링크, 원문 = excluded.원문, updated_at = now();

  v_수 := (select count(*) from jsonb_array_elements(p_교육));
  return jsonb_build_object('교육', v_수);
end $$;


ALTER FUNCTION public."교육담기"(p_secret text, "p_교육" jsonb) OWNER TO postgres;

--
-- Name: 교육담당자인가(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육담당자인가"("p_과정" bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from 교육과정 c
     where c.과정id = p_과정
       and ((c.주최갈래 = '개인' and c.강사 = auth.uid())
         or (c.주최갈래 = '기관' and exists (
              select 1 from 회원자격 q
               where q.profile_id = auth.uid() and q.갈래 = '교육담당자기관'
                 and q.상태 = '승인' and q.교육기관 = c.교육기관))
         /* ★ 마스터는 **시험 과정 + 교육 담당자 페르소나일 때만** */
         or (c.시험자료 and 마스터역할() in ('교육담당자', '채용+교육담당자'))))
$$;


ALTER FUNCTION public."교육담당자인가"("p_과정" bigint) OWNER TO postgres;

--
-- Name: 교육리뷰답글쓰기(bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육리뷰답글쓰기"("p_리뷰" bigint, "p_글" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_과정 bigint;
begin
  select c.과정id into v_과정
    from 교육리뷰 r join 교육회차 s on s.회차id = r.회차id
    join 교육과정 c on c.과정id = s.과정id where r.리뷰id = p_리뷰;
  if v_과정 is null then raise exception '없는 리뷰입니다' using errcode = '22023'; end if;
  if not 교육담당자인가(v_과정) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;
  insert into 교육리뷰답글 (리뷰id, profile_id, 글) values (p_리뷰, auth.uid(), p_글);
  return jsonb_build_object('리뷰id', p_리뷰);
end $$;


ALTER FUNCTION public."교육리뷰답글쓰기"("p_리뷰" bigint, "p_글" text) OWNER TO postgres;

--
-- Name: 교육리뷰쓰기(bigint, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육리뷰쓰기"("p_회차" bigint, "p_별점" integer, "p_글" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare s record;
begin
  select * into s from 교육회차 where 회차id = p_회차;
  if s is null then raise exception '없는 회차입니다' using errcode = '22023'; end if;
  if not exists (select 1 from 교육신청 a
                  where a.회차id = p_회차 and a.profile_id = auth.uid() and a.상태 = '참여확정') then
    raise exception '참여가 확정된 분만 쓸 수 있어요' using errcode = '42501';
  end if;
  if (now() at time zone 'Asia/Seoul') < (s.시작 + time '08:00') then
    raise exception '첫날 오전 8시부터 쓸 수 있어요' using errcode = '22023';
  end if;

  insert into 교육리뷰 (회차id, profile_id, 별점, 글)
  values (p_회차, auth.uid(), p_별점, p_글)
  on conflict (회차id, profile_id)
    do update set 별점 = excluded.별점, 글 = excluded.글, 고친때 = now();

  return jsonb_build_object('회차id', p_회차);
end $$;


ALTER FUNCTION public."교육리뷰쓰기"("p_회차" bigint, "p_별점" integer, "p_글" text) OWNER TO postgres;

--
-- Name: 교육모집끝내기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육모집끝내기"("p_회차" bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_과정 bigint; v_n int; c record; r record;
begin
  select 과정id into v_과정 from 교육회차 where 회차id = p_회차;
  if not 교육담당자인가(v_과정) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;
  select * into c from 교육과정 where 과정id = v_과정;

  for r in select profile_id from 교육신청 where 회차id = p_회차 and 상태 <> '참여확정' loop
    perform 알림넣기(r.profile_id, '교육미선정', '이번에는 자리가 안 났어요 — ' || c.제목,
                     null, '/edu/session/' || p_회차);
  end loop;

  update 교육신청 set 상태 = '미선정', 바뀐때 = now()
   where 회차id = p_회차 and 상태 <> '참여확정';
  get diagnostics v_n = row_count;

  update 교육회차 set 상태 = '끝남' where 회차id = p_회차;
  return jsonb_build_object('회차id', p_회차, '미선정', v_n);
end $$;


ALTER FUNCTION public."교육모집끝내기"("p_회차" bigint) OWNER TO postgres;

--
-- Name: 교육목록(text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육목록"("p_직군" text DEFAULT NULL::text, "p_출처" text DEFAULT NULL::text, "p_지난것" boolean DEFAULT false, p_page integer DEFAULT 0) RETURNS TABLE("번호" text, "출처" text, "직군" text, "갈래" text, "제목" text, "시작" date, "끝" date, "장소" text, "모집인원" text, "상태" text, "올린날" date, "링크" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select e.번호, e.출처, e.직군, e.갈래, e.제목, e.시작, e.끝,
         e.장소, e.모집인원, e.상태, e.올린날, e.링크
  from 교육 e
  where (p_출처 is null or e.출처 = p_출처)
    and (p_직군 is null or p_직군 = '전체'
         or e.직군 = p_직군 or e.직군 = '공통')
    and (p_지난것
         or not "지난교육인가"(e.끝, e.시작, e.올린날, (now() at time zone 'Asia/Seoul')::date))
  order by e.시작 asc nulls last, e.올린날 desc nulls last, e.번호
  limit 20 offset greatest(0, coalesce(p_page, 0)) * 20;
$$;


ALTER FUNCTION public."교육목록"("p_직군" text, "p_출처" text, "p_지난것" boolean, p_page integer) OWNER TO postgres;

--
-- Name: 교육셈(text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육셈"("p_직군" text DEFAULT NULL::text, "p_출처" text DEFAULT NULL::text, "p_지난것" boolean DEFAULT false) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int
  from 교육 e
  where (p_출처 is null or e.출처 = p_출처)
    and (p_직군 is null or p_직군 = '전체'
         or e.직군 = p_직군 or e.직군 = '공통')
    and (p_지난것
         or not "지난교육인가"(e.끝, e.시작, e.올린날, (now() at time zone 'Asia/Seoul')::date));
$$;


ALTER FUNCTION public."교육셈"("p_직군" text, "p_출처" text, "p_지난것" boolean) OWNER TO postgres;

--
-- Name: 교육신청목록(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육신청목록"("p_회차" bigint) RETURNS TABLE("신청id" bigint, "닉네임" text, "상태" text, "입금눌렀나" boolean, "입금누른때" timestamp with time zone, "신청때" timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select a.신청id, p.nickname, a.상태, a.입금눌렀나, a.입금누른때, a.신청때
    from 교육신청 a
    join 교육회차 s on s.회차id = a.회차id
    join profiles p on p.id = a.profile_id
   where a.회차id = p_회차 and 교육담당자인가(s.과정id)
   order by a.신청때
$$;


ALTER FUNCTION public."교육신청목록"("p_회차" bigint) OWNER TO postgres;

--
-- Name: 교육신청하기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육신청하기"("p_회차" bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); s record; c record; v_확정 int;
begin
  if v is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  select * into s from 교육회차 where 회차id = p_회차;
  if s is null then raise exception '없는 회차입니다' using errcode = '22023'; end if;
  if s.상태 <> '모집중' then raise exception '지금은 신청을 안 받아요' using errcode = '22023'; end if;

  select count(*) into v_확정 from 교육신청 where 회차id = p_회차 and 상태 = '참여확정';
  if v_확정 >= s.정원 then raise exception '정원이 찼어요' using errcode = '22023'; end if;

  insert into 교육신청 (회차id, profile_id) values (p_회차, v)
  on conflict (회차id, profile_id) do nothing;

  select * into c from 교육과정 where 과정id = s.과정id;
  perform 알림넣기(v, '교육신청', '신청했어요 — ' || c.제목,
    '입금 안내를 확인해 주세요.' ||
    case when s.입금기한 is not null then ' 입금 기한은 ' || s.입금기한 || ' 입니다.' else '' end,
    '/edu/session/' || p_회차);

  return jsonb_build_object('회차id', p_회차, '상태', '신청함');
end $$;


ALTER FUNCTION public."교육신청하기"("p_회차" bigint) OWNER TO postgres;

--
-- Name: 교육입금눌렀어요(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육입금눌렀어요"("p_회차" bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update 교육신청 set 입금눌렀나 = true, 입금누른때 = now(),
                      상태 = case when 상태 = '신청함' then '입금대기' else 상태 end,
                      바뀐때 = now()
   where 회차id = p_회차 and profile_id = auth.uid();
  if not found then raise exception '신청한 적이 없습니다' using errcode = '22023'; end if;
  return jsonb_build_object('회차id', p_회차, '상태', '입금대기');
end $$;


ALTER FUNCTION public."교육입금눌렀어요"("p_회차" bigint) OWNER TO postgres;

--
-- Name: 교육입금알림(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육입금알림"(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int := 0; r record;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  for r in
    select a.profile_id, h.회차id, c.제목, h.입금기한
      from 교육신청 a
      join 교육회차 h on h.회차id = a.회차id
      join 교육과정 c on c.과정id = h.과정id
     where a.상태 in ('신청함','입금대기') and not a.입금눌렀나
       and h.입금기한 = ((now() at time zone 'Asia/Seoul')::date + 1)
  loop
    perform 알림넣기(r.profile_id, '입금기한', '내일이 입금 기한이에요 — ' || r.제목,
                     '입금하셨으면 「입금했어요」를 눌러 주세요.', '/edu/session/' || r.회차id);
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('보낸 알림', v_n);
end $$;


ALTER FUNCTION public."교육입금알림"(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: 교육재공고(bigint, date, date, date, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육재공고"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_접수시작" date, "p_접수끝" date, "p_입금기한" date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare s record; v_id bigint;
begin
  select * into s from 교육회차 where 회차id = p_회차;
  if s is null then raise exception '없는 회차입니다' using errcode = '22023'; end if;
  if not 교육담당자인가(s.과정id) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;

  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 입금기한, 입금자명규칙, 환불규정,
                        결제링크, 상태, 시험자료)
  values (s.과정id, p_시작, p_끝, s.장소, s.정원, p_접수시작, p_접수끝, s.수강료,
          s.은행, s.계좌번호, s.예금주, p_입금기한, s.입금자명규칙, s.환불규정,
          s.결제링크, '모집중', s.시험자료)
  returning 회차id into v_id;

  return jsonb_build_object('회차id', v_id, '베낀회차', p_회차);
end $$;


ALTER FUNCTION public."교육재공고"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_접수시작" date, "p_접수끝" date, "p_입금기한" date) OWNER TO postgres;

--
-- Name: 교육참여확정(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육참여확정"("p_신청" bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare s record; c record; v_확정 int;
begin
  select a.*, h.과정id, h.정원, h.회차id as 회차
    into s from 교육신청 a join 교육회차 h on h.회차id = a.회차id where a.신청id = p_신청;
  if s is null then raise exception '없는 신청입니다' using errcode = '22023'; end if;
  if not 교육담당자인가(s.과정id) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;

  update 교육신청 set 상태 = '참여확정', 바뀐때 = now() where 신청id = p_신청;

  select count(*) into v_확정 from 교육신청 where 회차id = s.회차 and 상태 = '참여확정';
  if v_확정 >= s.정원 then
    update 교육회차 set 상태 = '마감' where 회차id = s.회차;
  end if;

  select * into c from 교육과정 where 과정id = s.과정id;
  perform 알림넣기(s.profile_id, '교육확정', '참여가 확정됐어요 — ' || c.제목,
                   null, '/edu/session/' || s.회차);

  return jsonb_build_object('신청id', p_신청, '상태', '참여확정',
                            '확정수', v_확정, '정원', s.정원);
end $$;


ALTER FUNCTION public."교육참여확정"("p_신청" bigint) OWNER TO postgres;

--
-- Name: 교육회차고치기(bigint, date, date, text, integer, date, date, integer, text, text, text, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육회차고치기"("p_회차" bigint, "p_시작" date DEFAULT NULL::date, "p_끝" date DEFAULT NULL::date, "p_장소" text DEFAULT NULL::text, "p_정원" integer DEFAULT NULL::integer, "p_접수시작" date DEFAULT NULL::date, "p_접수끝" date DEFAULT NULL::date, "p_수강료" integer DEFAULT NULL::integer, "p_은행" text DEFAULT NULL::text, "p_계좌번호" text DEFAULT NULL::text, "p_예금주" text DEFAULT NULL::text, "p_입금기한" date DEFAULT NULL::date, "p_입금자명규칙" text DEFAULT NULL::text, "p_환불규정" text DEFAULT NULL::text, "p_결제링크" text DEFAULT NULL::text, "p_상태" text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_과정 bigint;
begin
  select 과정id into v_과정 from 교육회차 where 회차id = p_회차;
  if v_과정 is null then raise exception '없는 회차입니다' using errcode = '22023'; end if;
  if not 교육담당자인가(v_과정) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;
  if p_상태 is not null and p_상태 not in ('모집중', '마감', '끝남') then
    raise exception '모르는 상태입니다 (%)', p_상태 using errcode = '22023';
  end if;
  update 교육회차 set
    시작 = coalesce(p_시작, 시작), 끝 = coalesce(p_끝, 끝),
    장소 = coalesce(p_장소, 장소), 정원 = coalesce(p_정원, 정원),
    접수시작 = coalesce(p_접수시작, 접수시작), 접수끝 = coalesce(p_접수끝, 접수끝),
    수강료 = coalesce(p_수강료, 수강료),
    은행 = coalesce(p_은행, 은행), 계좌번호 = coalesce(p_계좌번호, 계좌번호),
    예금주 = coalesce(p_예금주, 예금주),
    입금기한 = coalesce(p_입금기한, 입금기한),
    입금자명규칙 = coalesce(p_입금자명규칙, 입금자명규칙),
    환불규정 = coalesce(nullif(btrim(coalesce(p_환불규정, '')), ''), 환불규정),
    결제링크 = coalesce(p_결제링크, 결제링크),
    상태 = coalesce(p_상태, 상태)
   where 회차id = p_회차;
  return true;
end $$;


ALTER FUNCTION public."교육회차고치기"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text, "p_상태" text) OWNER TO postgres;

--
-- Name: 교육회차리뷰(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육회차리뷰"("p_회차" bigint) RETURNS TABLE("리뷰id" bigint, "닉네임" text, "별점" integer, "글" text, "쓴때" timestamp with time zone, "고친때" timestamp with time zone, "답글" text, "답글쓴때" timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.리뷰id, p.nickname, r.별점, r.글, r.쓴때, r.고친때,
         (select a.글 from 교육리뷰답글 a where a.리뷰id = r.리뷰id order by a.쓴때 limit 1),
         (select a.쓴때 from 교육리뷰답글 a where a.리뷰id = r.리뷰id order by a.쓴때 limit 1)
    from 교육리뷰 r join profiles p on p.id = r.profile_id
   where r.회차id = p_회차 and not r.숨김
     and (not r.시험자료 or 시험자료볼까())
   order by r.쓴때 desc
$$;


ALTER FUNCTION public."교육회차리뷰"("p_회차" bigint) OWNER TO postgres;

--
-- Name: 교육회차보기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육회차보기"("p_회차" bigint) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '회차id', s.회차id, '과정id', s.과정id, '제목', c.제목,
    '시작', s.시작, '끝', s.끝, '장소', s.장소, '정원', s.정원,
    '접수시작', s.접수시작, '접수끝', s.접수끝, '수강료', s.수강료,
    '상태', s.상태, '환불규정', s.환불규정, '결제링크', s.결제링크,
    '확정수', (select count(*) from 교육신청 a where a.회차id = s.회차id and a.상태 = '참여확정'),
    '내상태', (select a.상태 from 교육신청 a
                where a.회차id = s.회차id and a.profile_id = auth.uid()),
    '리뷰가능', (exists (select 1 from 교육신청 a
                          where a.회차id = s.회차id and a.profile_id = auth.uid()
                            and a.상태 = '참여확정')
                 and (now() at time zone 'Asia/Seoul') >= (s.시작 + time '08:00')),
    '계좌', case when 교육담당자인가(s.과정id)
                   or exists (select 1 from 교육신청 a
                               where a.회차id = s.회차id and a.profile_id = auth.uid())
                 then jsonb_build_object('은행', s.은행, '계좌번호', s.계좌번호,
                                         '예금주', s.예금주, '입금기한', s.입금기한,
                                         '입금자명규칙', s.입금자명규칙)
            end)
    from 교육회차 s join 교육과정 c on c.과정id = s.과정id
   where s.회차id = p_회차
     /* ★ 2026-10-09 — 목록(신청가능교육)은 시험자료를 걸러내는데 여기는 안 걸렀습니다.
        회차 번호만 알면 회원도 열 수 있었습니다. 목록과 같은 기준으로 맞춥니다 */
     and (not s.시험자료 or 시험자료볼까())
$$;


ALTER FUNCTION public."교육회차보기"("p_회차" bigint) OWNER TO postgres;

--
-- Name: 교육회차열기(bigint, date, date, text, integer, date, date, integer, text, text, text, date, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."교육회차열기"("p_과정" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id bigint; v_시험 boolean;
begin
  if not 교육담당자인가(p_과정) then
    raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501';
  end if;
  if coalesce(btrim(p_환불규정), '') = '' then
    raise exception '환불 규정을 적어 주세요' using errcode = '22023';
  end if;

  /* ★ 2026-10-09 — 회차는 과정의 표시를 따릅니다. 과정이 시험자료면
     그 회차도 시험자료입니다. 한 과정 안에서 갈리면 목록이 반만 보입니다 */
  select 시험자료 into v_시험 from 교육과정 where 과정id = p_과정;

  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 입금기한, 입금자명규칙, 환불규정,
                        결제링크, 시험자료)
  values (p_과정, p_시작, p_끝, p_장소, p_정원, p_접수시작, p_접수끝, p_수강료,
          p_은행, p_계좌번호, p_예금주, p_입금기한, p_입금자명규칙, p_환불규정,
          p_결제링크, coalesce(v_시험, false))
  returning 회차id into v_id;

  return jsonb_build_object('회차id', v_id);
end $$;


ALTER FUNCTION public."교육회차열기"("p_과정" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text) OWNER TO postgres;

--
-- Name: 권한있나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."권한있나"("p_코드" text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select 대표인가()
      or exists (select 1 from 권한
                  where profile_id = auth.uid() and 권한코드 = p_코드 and 끈때 is null)
$$;


ALTER FUNCTION public."권한있나"("p_코드" text) OWNER TO postgres;

--
-- Name: 근무지이름있나(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."근무지이름있나"(p_org text, p_title text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select (coalesce(p_org,'') || ' ' || coalesce(p_title,'')) ~
    ('병원|의료원|의원|요양원|요양병원|센터|센타|복지관|재활원|보건소|어린이집|'
     || '주간보호|데이케어|지역본부|(?<!복)지사|(?<!복)지부|분원|분소|출장소|사업소')
$$;


ALTER FUNCTION public."근무지이름있나"(p_org text, p_title text) OWNER TO postgres;

--
-- Name: 글사진(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."글사진"(p_post bigint) RETURNS TABLE("몇번째" integer, "큰것" text, "작은것" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select i.sort, i.path, coalesce(i.thumb_path, i.path)
    from post_images i
    join posts p on p.id = i.post_id and not p.hidden
   where i.post_id = p_post
   order by i.sort
$$;


ALTER FUNCTION public."글사진"(p_post bigint) OWNER TO postgres;

--
-- Name: 글쓴적있나(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."글쓴적있나"(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from posts         where author_id = p_id)
      or exists (select 1 from comments      where author_id = p_id)
      or exists (select 1 from chat_messages where sender_id = p_id);
$$;


ALTER FUNCTION public."글쓴적있나"(p_id uuid) OWNER TO postgres;

--
-- Name: 기관번호_이름으로(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관번호_이름으로"("p_이름" text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /* 이름 → 기관번호. 심평원에 그 이름열쇠가 **딱 한 곳**일 때만 냅니다.
     여러 곳이면 null — 어느 병원인지 모르면 짐작하지 않습니다 (지침 10-3) */
  select 'HIRA:' || min(h.ykiho)
    from hira_org h
   where h.name_key = hira_name_key(p_이름)
  having count(distinct h.ykiho) = 1
$$;


ALTER FUNCTION public."기관번호_이름으로"("p_이름" text) OWNER TO postgres;

--
-- Name: 기관사이트_맞추기(text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_넣음 int := 0;
  v_고침 int := 0;
  v_그대로 int := 0;
  v_표에만 jsonb := '[]'::jsonb;
  v_줄 int := 0;
begin
  if p_secret is null
     or not exists (select 1 from collect_secret s
                     where s.source = 'HS3'
                       and s.secret = p_secret
                       and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  perform set_config('app.누가', '기관 사이트 맞추기', true);
  v_줄 := coalesce(jsonb_array_length(p_rows), 0);

  /* ★ 임시 표를 쓰지 않습니다 — `create temporary` + `delete` 꼴은
     ㉠ `delete` 에 `where` 가 없어 Supabase 안전장치에 막히고
     ㉡ `delete` 글자가 승인 창을 띄울 수 있습니다 (지침 8-7)
     그래서 **CTE** 로 그때그때 만듭니다 (2026-10-19) */

  /* 표에만 있고 cfg 에 없는 이름 — **지우지 않고 알려만 줍니다** */
  with 맞출것 as (
    select r->>'name' as name
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'url', s.url)
                            order by s.name), '[]'::jsonb)
    into v_표에만
    from hosp_sites s
   where not exists (select 1 from 맞출것 c where c.name = s.name);

  /* 셈 — 마른 실행이든 아니든 같은 수를 냅니다 */
  with 맞출것 as (
    select r->>'name' as name,
           r->>'url'  as url,
           coalesce(nullif(r->>'type', ''), 'html') as kind,
           (r - 'name' - 'url' - 'base' - 'type') as 규칙
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
  )
  select count(*) filter (where s.name is null),
         count(*) filter (where s.name is not null
                           and (coalesce(s."채용주소",'') is distinct from coalesce(c.url,'')
                             or coalesce(s."갈래",'')     is distinct from coalesce(c.kind,'')
                             or coalesce(s."긁는규칙",'{}'::jsonb) is distinct from coalesce(c.규칙,'{}'::jsonb))),
         count(*) filter (where s.name is not null
                           and coalesce(s."채용주소",'') = coalesce(c.url,'')
                           and coalesce(s."갈래",'')     = coalesce(c.kind,'')
                           and coalesce(s."긁는규칙",'{}'::jsonb) = coalesce(c.규칙,'{}'::jsonb))
    into v_넣음, v_고침, v_그대로
    from 맞출것 c
    left join hosp_sites s on s.name = c.name;

  if p_마른 then
    return jsonb_build_object(
      '마른', true, '받은 줄', v_줄,
      '새로 넣을 것', v_넣음, '고칠 것', v_고침, '그대로', v_그대로,
      '표에만 있는 것', jsonb_array_length(v_표에만), '표에만 있는 목록', v_표에만,
      '※', '지우지 않습니다 — 표에만 있는 것은 세중님이 보고 정하십니다');
  end if;

  /* 있으면 고칩니다 */
  with 맞출것 as (
    select r->>'name' as name,
           r->>'url'  as url,
           coalesce(nullif(r->>'type', ''), 'html') as kind,
           (r - 'name' - 'url' - 'base' - 'type') as 규칙
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
  )
  update hosp_sites s
     set "채용주소" = c.url,
         "갈래"     = c.kind,
         "긁는규칙" = coalesce(c.규칙, '{}'::jsonb),
         "옮긴날"   = (now() at time zone 'Asia/Seoul')::date
    from 맞출것 c
   where s.name = c.name;

  /* 없으면 넣습니다 — `url_key` 는 지금 표가 쓰는 꼴(주소 그대로)을 따릅니다.
     같은 이름이 cfg 에 여럿이면 하나만 넣습니다 (`distinct on`) */
  with 맞출것 as (
    select distinct on (r->>'name')
           r->>'name' as name,
           r->>'url'  as url,
           nullif(r->>'base', '') as base,
           coalesce(nullif(r->>'type', ''), 'html') as kind,
           (r - 'name' - 'url' - 'base' - 'type') as 규칙
      from jsonb_array_elements(p_rows) r
     where nullif(r->>'name', '') is not null
       and nullif(r->>'url', '')  is not null
     order by r->>'name'
  )
  /* ★ `url_key` 는 **생성 칸(generated)** 입니다 — 값을 넣으면 428C9 로 막힙니다.
     `information_schema.columns` 를 찍을 때 `is_generated` 를 안 봐서
     처음에 주소를 넣으려 했습니다 (2026-10-19 · 짐작한 자리). 빼고 맡깁니다 */
  insert into hosp_sites
         (name, url, base, kind, loaded_on,
          "채용주소", "갈래", "긁는규칙", "끔", "집에서만", "옮긴날", note)
  select c.name, c.url, c.base, c.kind,
         (now() at time zone 'Asia/Seoul')::date,
         c.url, c.kind, coalesce(c.규칙, '{}'::jsonb), false, false,
         (now() at time zone 'Asia/Seoul')::date,
         'cfg 에서 맞춤 (기관사이트_맞추기 · ' || (now() at time zone 'Asia/Seoul')::date || ')'
    from 맞출것 c
   where not exists (select 1 from hosp_sites s where s.name = c.name)
  on conflict (name, url_key) do nothing;

  return jsonb_build_object(
    '마른', false, '받은 줄', v_줄,
    '새로 넣음', v_넣음, '고침', v_고침, '그대로', v_그대로,
    '표에만 있는 것', jsonb_array_length(v_표에만), '표에만 있는 목록', v_표에만,
    '※', '지우지 않습니다 — 표에만 있는 것은 세중님이 보고 정하십니다');
end
$$;


ALTER FUNCTION public."기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean) OWNER TO postgres;

--
-- Name: FUNCTION "기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean) IS 'cfg 목록을 hosp_sites 표에 맞춥니다 — 없으면 넣고 있으면 고칩니다. 지우지 않고 「표에만 있는 것」은 목록으로 돌려줍니다. p_마른 이 기본 true (2026-10-19)';


--
-- Name: 기관사이트_옮기기(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관사이트_옮기기"(p_secret text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_n int := 0; v_못찾음 int := 0; v_줄 int := 0;
begin
  if p_secret is null
     or not exists (select 1 from collect_secret s
                     where s.source = 'HS3'
                       and s.secret = p_secret
                       and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  perform set_config('app.누가', '병원 목록 옮기기', true);
  v_줄 := jsonb_array_length(p_rows);

  update hosp_sites s set
    "채용주소" = r->>'url',
    "갈래"     = r->>'type',
    "긁는규칙" = (r - 'name' - 'url' - 'type' - 'off' - 'athome'),
    "끔"       = (r ? 'off'),
    "끈까닭"   = r->>'off',
    "집에서만" = coalesce((r->>'athome')::boolean, false),
    "옮긴날"   = (now() at time zone 'Asia/Seoul')::date
  from jsonb_array_elements(p_rows) r
  where s.name = r->>'name';
  get diagnostics v_n = row_count;

  select count(*) into v_못찾음
    from jsonb_array_elements(p_rows) r
   where not exists (select 1 from hosp_sites s where s.name = r->>'name');

  return jsonb_build_object(
    '넣은 줄', v_줄,
    '옮긴 곳', v_n,
    '이름을 못 찾은 줄', v_못찾음,
    '다음 단계', 'collect-hosp.mjs 가 DB 를 읽게 바꾸기 — 옮긴 값을 눈으로 본 뒤에');
end $$;


ALTER FUNCTION public."기관사이트_옮기기"(p_secret text, p_rows jsonb) OWNER TO postgres;

--
-- Name: 기관손으로잇기(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception '관리자만'; end if;
  if not exists (select 1 from job_posts where id = p_공고) then
    raise exception '그런 공고가 없습니다 — %', p_공고;
  end if;
  update job_posts
     set 기관번호 = p_기관번호, 연결상태 = '사람', 연결근거 = '관리자',
         admin_note = coalesce(admin_note || E'\n', '')
                      || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
                      || ' 기관 연결 ' || p_기관번호 || coalesce(' · ' || p_메모, '')
   where id = p_공고;
  return p_기관번호;
end $$;


ALTER FUNCTION public."기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text) OWNER TO postgres;

--
-- Name: 기관이름보정(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관이름보정"(p_source text, "p_기관" text, "p_제목" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_source, '') in ('AL', 'AL2')
     and 여러병원거느린곳(p_기관)
     and 제목속병원(p_제목) is not null
    then 제목속병원(p_제목)
    else p_기관 end
$$;


ALTER FUNCTION public."기관이름보정"(p_source text, "p_기관" text, "p_제목" text) OWNER TO postgres;

--
-- Name: FUNCTION "기관이름보정"(p_source text, "p_기관" text, "p_제목" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."기관이름보정"(p_source text, "p_기관" text, "p_제목" text) IS '여러 병원을 거느린 공단·법인의 AL·AL2 공고는 제목의 「[OO병원]」을 기관으로 봅니다 — 중복 판정과 화면이 같이 씁니다 (2026-10-19)';


--
-- Name: 기관이름보정_아이디로(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select 기관이름보정(
    case when coalesce(p_id, '') ~ '^[0-9]+$' then 'AL2' else '그밖' end,
    p_기관, p_제목)
$_$;


ALTER FUNCTION public."기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text) OWNER TO postgres;

--
-- Name: FUNCTION "기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text) IS 'job_posts_pub 에 source 칸이 없어 id 로 출처를 가립니다 — AL·AL2 는 id 가 숫자만입니다(데이터로 확인) (2026-10-19)';


--
-- Name: 기관이름줄임정하기(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관이름줄임정하기"("p_원래이름" text, "p_쓸까" boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;
  update 기관이름줄임
     set 승인했나 = coalesce(p_쓸까, false), 정한때 = now()
   where 원래이름 = p_원래이름;
  get diagnostics n = row_count;

  /* 정한 대로 그 기관 공고의 보여 줄 제목을 다시 만듭니다 —
     안 하면 다음 수집 때까지 옛 제목이 남습니다 (작업지침 9번) */
  update job_posts set 보여줄제목 = 제목만들기행(job_posts), updated_at = now()
   where org_name = p_원래이름;

  return jsonb_build_object('고친줄', n);
end $$;


ALTER FUNCTION public."기관이름줄임정하기"("p_원래이름" text, "p_쓸까" boolean) OWNER TO postgres;

--
-- Name: 기관잇기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관잇기"() RETURNS TABLE("자동" integer, "대기" integer, "없음" integer, "사람" integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_자동 int; v_대기 int; v_없음 int; v_사람 int;
begin
  /* 자물쇠는 권한(grant execute to service_role)으로만 겁니다.
     security definer 안에서 current_user 는 함수 주인이라 역할 검사가 안 됩니다 */
  with 공고 as (
    select j.id, j.org_name as 원래이름, j.source, btrim(coalesce(j.sgg, '')) as sgg,
           제목지역(j.sido, j.work_place) as 시도,
           주소도메인(j.url) as 도메인,
           nullif(btrim("제목산하"(j.title, j.org_name)), '') as 산하,
           hira_name_key(coalesce(a.hira_name, j.org_name)) as 이름키
      from job_posts j
      left join org_alias a
             on a.our_name = j.org_name
            and a.kind <> '모기관'
            and exists (select 1 from hira_org o
                         where o.name_key = hira_name_key(a.hira_name))
     where j.org_name is not null and btrim(j.org_name) <> ''
       and coalesce(j.연결상태, '') <> '사람'
  ), 산하후보 as (
    /* ⓪ 산하 병원 잇기 (2026-10-08 세중님 승인).
       알리오처럼 org_name 이 본부(근로복지공단·한국보훈복지의료공단)이고 병원 이름이
       제목에만 있는 공고입니다. 제목산하() 는 화면용이라 「재무팀」·「공고 제2026-18호」·
       「대전」 같은 것도 뽑습니다. 그래서 **심평원 기관으로 딱 하나 풀릴 때만** 받습니다
       (뽑힌 482건 중 105건만 남습니다). 차례 1(본부+산하) 이 2(산하이름만)보다 앞입니다 —
       「대구병원」처럼 흔한 이름이 엉뚱한 곳에 붙지 않게 하기 위해서입니다 */
    select c.id, o.ykiho, 1 as 차례, '본부+산하' as 근거
      from 공고 c join hira_org o on o.name_key = hira_name_key(c.원래이름 || ' ' || c.산하)
     where c.산하 is not null
    union all
    select c.id, o.ykiho, 2, '산하이름'
      from 공고 c join hira_org o on o.name_key = hira_name_key(c.산하)
     where c.산하 is not null
  ), 산하정함 as (
    select distinct on (id) id, ykiho, 근거
      from (select id, ykiho, 근거, 차례,
                   count(*) over (partition by id, 차례) as n
              from 산하후보) t
     where n = 1
     order by id, 차례
  ), 사이트 as (
    /* ★ 2026-10-24 세중님 ㉪ — **번호(ykiho)까지** 함께 봅니다. 같은 이름 다른 병원
       (한일병원: 진주 ↔ 서울 한전)에서 이름키로만 보면 후보가 둘이 되어 **못 골랐습니다**.
       사이트표에 ykiho 를 채워 두었습니다 (266/297줄 · 열어서 전화로 가린 것만) */
    select distinct 주소도메인(url) as 도메인, hira_name_key(name) as 이름키, ykiho
      from hosp_sites where 주소도메인(url) is not null
    union
    select 주소도메인(our_name), hira_name_key(hira_name), null
      from org_alias where kind = '호스트' and 주소도메인(our_name) is not null
  ), 짝 as (
    select c.id, c.이름키, o.ykiho,
      (o.yadm_nm = c.원래이름)                                            as 글자맞나,
      (주소도메인(o.hosp_url) is not null and c.도메인 is not null
        and (주소도메인(o.hosp_url) = c.도메인
             or c.도메인 like '%.' || 주소도메인(o.hosp_url)))            as 주소맞나,
      exists (select 1 from 사이트 s
               where s.도메인 = c.도메인
                 and (s.ykiho = o.ykiho                     /* 번호가 있으면 번호로 */
                      or (s.ykiho is null and s.이름키 = o.name_key)))     as 사이트맞나,
      (c.sgg <> '' and (o.sggu_nm = c.sgg or o.sggu_nm like '%' || c.sgg)) as 시군구맞나,
      (o.sido_nm = c.시도)                                                 as 시도맞나
    from 공고 c join hira_org o on o.name_key = c.이름키
  ), 셈 as (
    select id, count(*) as 이름,
           count(*) filter (where 글자맞나)   as 글자,
           count(*) filter (where 주소맞나)   as 주소,
           count(*) filter (where 사이트맞나) as 사이트,
           count(*) filter (where 시군구맞나) as 시군구,
           count(*) filter (where 시도맞나)   as 시도
      from 짝 group by id
  ), 고름 as (
    select z.id, z.ykiho,
      case when s.이름 = 1                                  then '이름'
           when s.글자 = 1 and z.글자맞나                    then '공식이름'
           when s.글자 <> 1 and s.주소 = 1 and z.주소맞나     then '심평원주소'
           when s.글자 <> 1 and s.주소 <> 1
                and s.사이트 = 1 and z.사이트맞나             then '사이트표'
           when s.글자 <> 1 and s.주소 <> 1 and s.사이트 <> 1
                and s.시군구 = 1 and z.시군구맞나             then '시군구'
           when s.글자 <> 1 and s.주소 <> 1 and s.사이트 <> 1
                and s.시군구 <> 1 and s.시도 = 1 and z.시도맞나 then '시도' end as 근거
    from 짝 z join 셈 s using (id)
  ), 정할것 as (
    select c.id,
      case when h.ykiho is not null then 'HIRA:' || h.ykiho
           when g.근거  is not null then 'HIRA:' || g.ykiho
           when exists (select 1 from hira_org o where o.name_key = c.이름키) then null
           else 'NAME:' || c.이름키 end as 기관번호,
      /* ★ 2026-10-24 세중님 ㉮ — **이름 글자로 이은 것도 근거를 남깁니다.**
         전에는 '없음'(심평원에 그 이름이 없어 'NAME:<이름키>' 로 이은 것) 줄의
         근거가 비어 있어서, 회원 화면 202건이 「근거 빈칸」으로 보였습니다.
         「이름」은 좁히기 ①에도 쓰는 말이지만 **연결상태가 가립니다** —
         자동/이름(심평원 한 곳뿐) ↔ 없음/이름(심평원에 없음). */
      coalesce(h.근거, g.근거,
               case when h.ykiho is null and g.근거 is null
                     and not exists (select 1 from hira_org o where o.name_key = c.이름키)
                    then '이름' end) as 근거,
      case when h.ykiho is not null or g.근거 is not null then '자동'
           when exists (select 1 from hira_org o where o.name_key = c.이름키) then '대기'
           else '없음' end as 상태
      from 공고 c
      left join 산하정함 h on h.id = c.id
      left join 고름 g on g.id = c.id and g.근거 is not null
  )
  update job_posts j
     set 기관번호 = t.기관번호, 연결상태 = t.상태, 연결근거 = t.근거
    from 정할것 t
   where j.id = t.id
     and (j.기관번호, j.연결상태, j.연결근거)
         is distinct from (t.기관번호, t.상태, t.근거);

  select count(*) filter (where 연결상태 = '자동'),
         count(*) filter (where 연결상태 = '대기'),
         count(*) filter (where 연결상태 = '없음'),
         count(*) filter (where 연결상태 = '사람')
    into v_자동, v_대기, v_없음, v_사람
    from job_posts;

  return query select v_자동, v_대기, v_없음, v_사람;
end $$;


ALTER FUNCTION public."기관잇기"() OWNER TO postgres;

--
-- Name: 기관주소보기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관주소보기"() RETURNS TABLE("이름키" text, "이름" text, "주소" text, "어디서" text, "확인일" date)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select a."이름키", a."이름", a."주소",
         case when a."주소" is not null then '우리 표 — 열어 본 주소'
              else '우리 표 — 열 수 없다고 확인' end,
         a."확인일"
    from public."기관주소" a
   order by a."이름"
$$;


ALTER FUNCTION public."기관주소보기"() OWNER TO postgres;

--
-- Name: 기관주소적기(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관주소적기"(p_secret text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v int := 0;
  r jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = 'HS3' and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(r->>'이름', '') = '' or coalesce(r->>'근거', '') = '' then
      raise exception '이름과 근거는 비울 수 없습니다 — 근거 없이 적지 않습니다';
    end if;
    insert into public."기관주소" ("이름키", "이름", "주소", "근거", "누가", "메모")
    values ("견줄이름"(r->>'이름'), r->>'이름', nullif(r->>'주소', ''),
            r->>'근거', r->>'누가', r->>'메모')
    on conflict ("이름키") do update set
      "이름"   = excluded."이름",
      "주소"   = excluded."주소",
      "근거"   = excluded."근거",
      "확인일" = (now() at time zone 'Asia/Seoul')::date,
      "누가"   = excluded."누가",
      "메모"   = excluded."메모";
    v := v + 1;
  end loop;
  return jsonb_build_object('적음', v);
end $$;


ALTER FUNCTION public."기관주소적기"(p_secret text, p_rows jsonb) OWNER TO postgres;

--
-- Name: FUNCTION "기관주소적기"(p_secret text, p_rows jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."기관주소적기"(p_secret text, p_rows jsonb) IS '확인한 기관 주소를 적습니다. 이름·근거가 비면 거부합니다 (2026-10-19)';


--
-- Name: 기관지역정하기(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관지역정하기"("p_기관" text, "p_시도" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if not is_admin() then raise exception '관리자만' using errcode = '42501'; end if;
  if coalesce(p_시도,'') = '' then
    delete from 기관지역 where 기관 = p_기관;
  else
    if p_시도 not in ('서울','부산','대구','인천','광주','대전','울산','세종','경기',
                      '강원','충북','충남','전북','전남','경북','경남','제주') then
      raise exception '시·도 이름이 아닙니다: %', p_시도 using errcode = '22023';
    end if;
    insert into 기관지역 (기관, 시도, 까닭) values (p_기관, p_시도, '관리자가 손으로 정함')
      on conflict (기관) do update set 시도 = excluded.시도,
        까닭 = excluded.까닭, 정한때 = now();
  end if;
  update job_posts set 보여줄제목 = 제목만들기행(job_posts), updated_at = now()
   where org_name = p_기관;
  get diagnostics n = row_count;
  return jsonb_build_object('고친 공고', n);
end $$;


ALTER FUNCTION public."기관지역정하기"("p_기관" text, "p_시도" text) OWNER TO postgres;

--
-- Name: 기관표채우기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."기관표채우기"() RETURNS TABLE("새로넣음" integer, "고침" integer, "관리자가고친것" integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_새 int := 0; v_고침 int := 0; v_사람 int;
begin
  with 모음 as (
    select j.기관번호,
           array_agg(distinct j.source) as 출처들,
           min(j.org_name) as 공고이름,
           min(hira_name_key(j.org_name)) as 이름키,
           min(nullif(split_part(j.기관번호, 'HIRA:', 2), '')) as ykiho,
           min(j.org_name) filter (where j.연결근거 in ('산하이름', '본부+산하')) as 본부이름
      from job_posts j
     where j.기관번호 is not null
     group by j.기관번호
  ), 모기관 as (
    select m.기관번호,
      nullif(coalesce(
        /* ㉠ 공고가 본부 이름으로 들어온 것.
           본부이름이 없으면 **아예 안 찾습니다** — hira_name_key(null) 이 null 이 아니라
           빈 글자라, 전에는 'NAME:' || '' = 'NAME:' 이 989곳에 들어갔습니다 (2026-10-08 고침) */
        (case when m.본부이름 is null then null
              else (select case when count(*) = 1 then 'HIRA:' || min(o.ykiho)
                                else 'NAME:' || hira_name_key(m.본부이름) end
                      from hira_org o where o.name_key = hira_name_key(m.본부이름)) end),
        /* ㉡ org_alias 의 모기관 짝 13줄 */
        (select case when (select count(*) from hira_org o
                            where o.name_key = hira_name_key(a.hira_name)) = 1
                     then 'HIRA:' || (select o.ykiho from hira_org o
                                       where o.name_key = hira_name_key(a.hira_name))
                     else 'NAME:' || hira_name_key(a.hira_name) end
           from org_alias a
          where a.kind = '모기관' and hira_name_key(a.our_name) = m.이름키
          limit 1)
      ), m.기관번호) as 모기관번호
      from 모음 m
  ), 붙임 as (
    select m.기관번호, m.출처들, m.이름키, mo.모기관번호,
           coalesce(o.yadm_nm, m.공고이름) as 이름,
           o.ykiho, o.sido_nm as 시도, o.sggu_nm as 시군구,
           o.cl_cd as 종별, o.cl_cd_nm as 종별이름,
           d.org_ty_cd as 설립구분, d.org_ty_nm as 설립구분이름,
           (select s from unnest(m.출처들) s
             where s in ('AL','AL2','GJ','GJ2','CE','CE2','ND','ND2') limit 1) as 공공출처,
           exists (select 1 from public_hospitals p
                    where hira_name_key(p.name) in (hira_name_key(o.yadm_nm), m.이름키)) as 공공병원표
      from 모음 m
      join 모기관 mo on mo.기관번호 = m.기관번호
      left join hira_org o on o.ykiho = m.ykiho
      left join hira_detail d on d.ykiho = m.ykiho
  ), 판정 as (
    select b.*,
      case when b.공공출처 is not null or b.공공병원표
                or coalesce(b.설립구분 in ('01','03','05','13'), false) then true
           when b.설립구분 is not null                                  then false
           else null end as 공공인가,
      case when b.공공출처 is not null then '출처:' || b.공공출처
           when b.공공병원표 then '공공병원표'
           when b.설립구분 in ('01','03','05','13') then '설립구분:' || b.설립구분 end as 공공근거,
      (     (coalesce(b.설립구분 = '04', false) and coalesce(b.종별 in ('01','11'), false))
         or coalesce(b.이름 ~ '대학교?병원', false) ) as 대학병원인가,
      coalesce(b.종별 = '01', false) as 상급종합인가
      from 붙임 b
  ), 넣을것 as (
    select p.*,
      /* 미정(null)은 「수시 허용 — 원문에 수시말이 있을 때만」 입니다 (2026-10-08 세중님 확정).
         미정 기관은 거의 민간 2층이고, 공공은 출처(AL·GJ·CE·ND)로 이미 잡힙니다.
         2단계에서 거를 때 null 이 공고를 조용히 빼지 않게 해야 합니다 */
      (p.공공인가 or p.대학병원인가 or p.상급종합인가) as 수시금지,
      case when p.대학병원인가                     then '공공기관·대학·종합 · 대학'
           when p.공공인가                         then '공공기관·대학·종합 · 공공'
           when p.상급종합인가 or p.종별 = '11'    then '공공기관·대학·종합 · 종합'
           when p.종별 is not null                 then '재활·요양병원·의원'
           else null end as 탭
      from 판정 p
  ), 올림 as (
    insert into 기관 as t (기관번호, 이름, 이름키, ykiho, 시도, 시군구,
                           종별, 종별이름, 설립구분, 설립구분이름,
                           공공인가, 공공근거, 대학병원인가, 상급종합인가, 수시금지, 탭,
                           모기관번호)
    select 기관번호, 이름, 이름키, ykiho, 시도, 시군구,
           종별, 종별이름, 설립구분, 설립구분이름,
           공공인가, 공공근거, 대학병원인가, 상급종합인가, 수시금지, 탭,
           모기관번호
      from 넣을것
    on conflict (기관번호) do update set
        이름 = excluded.이름, 이름키 = excluded.이름키, ykiho = excluded.ykiho,
        시도 = excluded.시도, 시군구 = excluded.시군구,
        종별 = excluded.종별, 종별이름 = excluded.종별이름,
        설립구분 = excluded.설립구분, 설립구분이름 = excluded.설립구분이름,
        공공인가 = excluded.공공인가, 공공근거 = excluded.공공근거,
        대학병원인가 = excluded.대학병원인가, 상급종합인가 = excluded.상급종합인가,
        수시금지 = excluded.수시금지, 탭 = excluded.탭,
        모기관번호 = excluded.모기관번호,
        고친때 = now()
      where t.확인한때 is null
        and (t.이름, t.ykiho, t.종별, t.설립구분, t.공공인가, t.공공근거,
             t.대학병원인가, t.상급종합인가, t.수시금지, t.탭, t.모기관번호)
            is distinct from
            (excluded.이름, excluded.ykiho, excluded.종별, excluded.설립구분,
             excluded.공공인가, excluded.공공근거, excluded.대학병원인가,
             excluded.상급종합인가, excluded.수시금지, excluded.탭, excluded.모기관번호)
    returning (t.올린때 = t.고친때) as 새줄
  )
  select count(*) filter (where 새줄), count(*) filter (where not 새줄)
    into v_새, v_고침 from 올림;

  select count(*) into v_사람 from 기관 where 확인한때 is not null;
  return query select v_새, v_고침, v_사람;
end $$;


ALTER FUNCTION public."기관표채우기"() OWNER TO postgres;

--
-- Name: 꼬리말떼기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."꼬리말떼기"(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p, ''),
               '[[:space:]]*(재공고|공고|채용공고|모집공고|채용|모집|안내)[[:space:]]*$', ''),
             '[[:space:]]*(재공고|공고|채용공고|모집공고|채용|모집|안내)[[:space:]]*$', ''),
           '[[:space:]]*(재공고|공고|채용공고|모집공고|채용|모집|안내)[[:space:]]*$', '')
$_$;


ALTER FUNCTION public."꼬리말떼기"(p text) OWNER TO postgres;

--
-- Name: 내가차단한사람(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내가차단한사람"() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select 누구 from public.회원차단 where 누가 = auth.uid() and 켬
$$;


ALTER FUNCTION public."내가차단한사람"() OWNER TO postgres;

--
-- Name: 내관리메뉴(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내관리메뉴"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '채용관리', exists (select 1 from 회원자격 q
                        where q.profile_id = auth.uid()
                          and q.갈래 = '채용담당자' and q.상태 = '승인'),
    '교육관리', exists (select 1 from 회원자격 q
                        where q.profile_id = auth.uid()
                          and q.갈래 in ('교육담당자기관', '교육담당자개인')
                          and q.상태 = '승인'),
    '페르소나역할', 마스터역할())
$$;


ALTER FUNCTION public."내관리메뉴"() OWNER TO postgres;

--
-- Name: 내교육과정(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내교육과정"() RETURNS TABLE("과정id" bigint, "제목" text, "직군" text, "주최갈래" text, "주최이름" text, "숨김" boolean, "시험자료" boolean, "회차" jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.과정id, c.제목, c.직군, c.주최갈래,
         coalesce(c.교육기관, (select p.nickname from profiles p where p.id = c.강사)),
         c.숨김, c.시험자료,
         coalesce((select jsonb_agg(jsonb_build_object(
                     '회차id', s.회차id, '시작', s.시작, '끝', s.끝, '장소', s.장소,
                     '정원', s.정원, '상태', s.상태,
                     '접수시작', s.접수시작, '접수끝', s.접수끝, '수강료', s.수강료,
                     '시험자료', s.시험자료,
                     '확정수', (select count(*) from 교육신청 a
                                where a.회차id = s.회차id and a.상태 = '참여확정'),
                     '신청수', (select count(*) from 교육신청 a where a.회차id = s.회차id),
                     '입금눌렀는데대기', (select count(*) from 교육신청 a
                                where a.회차id = s.회차id and a.입금눌렀나
                                  and a.상태 <> '참여확정'),
                     '후기수', (select count(*) from 교육리뷰 r
                                where r.회차id = s.회차id and not r.숨김))
                   order by s.시작 desc)
                    from 교육회차 s where s.과정id = c.과정id), '[]'::jsonb)
    from 교육과정 c
   where 교육담당자인가(c.과정id)
   order by c.과정id desc
$$;


ALTER FUNCTION public."내교육과정"() OWNER TO postgres;

--
-- Name: 내교육기관알림(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내교육기관알림"() RETURNS TABLE("기관" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select 기관 from 교육기관알림 where 회원 = auth.uid() limit 100;
$$;


ALTER FUNCTION public."내교육기관알림"() OWNER TO postgres;

--
-- Name: 내교육신청(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내교육신청"() RETURNS TABLE("회차id" bigint, "제목" text, "주최" text, "시작" date, "상태" text, "입금눌렀나" boolean, "입금기한" date, "리뷰썼나" boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.회차id, c.제목,
         coalesce(c.교육기관, (select p.nickname from profiles p where p.id = c.강사)),
         s.시작, a.상태, a.입금눌렀나, s.입금기한,
         exists (select 1 from 교육리뷰 r
                  where r.회차id = s.회차id and r.profile_id = auth.uid())
    from 교육신청 a join 교육회차 s on s.회차id = a.회차id
    join 교육과정 c on c.과정id = s.과정id
   where a.profile_id = auth.uid()
   order by s.시작 desc
$$;


ALTER FUNCTION public."내교육신청"() OWNER TO postgres;

--
-- Name: 내교육후기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내교육후기"() RETURNS TABLE("리뷰id" bigint, "회차id" bigint, "제목" text, "닉네임" text, "별점" integer, "글" text, "쓴때" timestamp with time zone, "답글" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.리뷰id, r.회차id, c.제목, p.nickname, r.별점, r.글, r.쓴때,
         (select d.글 from 교육리뷰답글 d where d.리뷰id = r.리뷰id order by d.답글id limit 1)
    from 교육리뷰 r
    join 교육회차 s on s.회차id = r.회차id
    join 교육과정 c on c.과정id = s.과정id
    join profiles p on p.id = r.profile_id
   where 교육담당자인가(c.과정id) and not r.숨김
   order by (exists (select 1 from 교육리뷰답글 d where d.리뷰id = r.리뷰id)) asc, r.쓴때 desc
$$;


ALTER FUNCTION public."내교육후기"() OWNER TO postgres;

--
-- Name: 내권한(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내권한"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '대표',   대표인가(),
    '운영진', is_admin(),
    '권한',   coalesce((select jsonb_agg(권한코드 order by 권한코드)
                          from 권한 where profile_id = auth.uid() and 끈때 is null),
                       '[]'::jsonb))
$$;


ALTER FUNCTION public."내권한"() OWNER TO postgres;

--
-- Name: 내담당자신청(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내담당자신청"() RETURNS TABLE(id bigint, "갈래" text, "기관번호" text, "교육기관" text, "상태" text, "사업자번호" text, "사업자상태" text, "반려까닭" text, "신청때" timestamp with time zone, "자료" jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select q.id, q.갈래, q.기관번호, q.교육기관, q.상태, q.사업자번호, q.사업자상태,
         q.반려까닭, q.신청때,
         coalesce((select jsonb_agg(jsonb_build_object('갈래', d.갈래, '올린때', d.올린때)
                                    order by d.올린때)
                     from 인증자료 d where d.자격id = q.id and d.지운때 is null), '[]'::jsonb)
    from 회원자격 q
   where q.profile_id = auth.uid()
   order by q.신청때 desc
$$;


ALTER FUNCTION public."내담당자신청"() OWNER TO postgres;

--
-- Name: 내대화(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내대화"() RETURNS TABLE("방" bigint, "상대" text, "상대아바타" text, "상태" text, "건사람인가" boolean, "마지막" text, "마지막때" timestamp with time zone, "안읽음" integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select t.방, t.상대, t.상대아바타, t.상태, t.건사람인가, t.마지막, t.마지막때, t.안읽음
    from (
      select r.id as 방, p.nickname as 상대, p.avatar as 상대아바타, r.상태 as 상태,
             (r.건사람 = auth.uid()) as 건사람인가,
             (select left(coalesce(m.body, '(사진)'), 40) from chat_messages m
               where m.room_id = r.id order by m.created_at desc limit 1) as 마지막,
             (select max(m.created_at) from chat_messages m where m.room_id = r.id) as 마지막때,
             unread_count(r.id) as 안읽음
        from chat_rooms r
        join chat_members me on me.room_id = r.id and me.profile_id = auth.uid()
        join chat_members you on you.room_id = r.id and you.profile_id <> auth.uid()
        join profiles p on p.id = you.profile_id
       where r.상태 <> '거절'
    ) t
   order by t.마지막때 desc nulls last
$$;


ALTER FUNCTION public."내대화"() OWNER TO postgres;

--
-- Name: 내병원(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내병원"() RETURNS TABLE("기관번호" text, "이름" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select q.기관번호, o.이름
    from 회원자격 q join 기관 o on o.기관번호 = q.기관번호
   where q.profile_id = auth.uid() and q.갈래 = '채용담당자' and q.상태 = '승인'
  union
  select o.기관번호, o.이름
    from 기관 o
   where o.기관번호 = 'TEST:마스터시험병원'
     and 마스터역할() in ('채용담당자', '채용+교육담당자')
$$;


ALTER FUNCTION public."내병원"() OWNER TO postgres;

--
-- Name: 내병원공고(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내병원공고"("p_기관번호" text) RETURNS TABLE(id text, "제목" text, "직군" text, "고용형태" text, apply_from date, apply_to date, hidden boolean, hold boolean, "조회수" integer, "지원누름" integer, "공식확인" boolean, source text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select j.id, coalesce(j.보여줄제목, j.title), j.job_group, j.employ_type,
         j.apply_from, j.apply_to, j.hidden, j.hold,
         (select count(*)::int from page_hits h
           where h.kind = 'job' and not h.by_admin and h.target = j.id),
         (select count(*)::int from job_events e
           where e.job_id = j.id and e.kind = 'open'),
         coalesce((j.evidence->>'공식확인')::boolean, false),
         j.source
    from job_posts j
   where j.기관번호 = p_기관번호
     and exists (select 1 from 회원자격 q
                  where q.profile_id = auth.uid() and q.갈래 = '채용담당자'
                    and q.상태 = '승인' and q.기관번호 = p_기관번호)
   order by coalesce(j.apply_to, '2099-12-31') desc, j.id
$$;


ALTER FUNCTION public."내병원공고"("p_기관번호" text) OWNER TO postgres;

--
-- Name: 내알림(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내알림"("p_몇줄" integer DEFAULT 50) RETURNS TABLE(id bigint, "갈래" text, "제목" text, "본문" text, "링크" text, "읽은때" timestamp with time zone, "만든때" timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select n.id, n.갈래, n.제목, n.본문, n.링크, n.읽은때, n.만든때
    from 알림함 n
   where n.profile_id = auth.uid()
     and (not n.시험자료 or 시험자료볼까())
   order by n.만든때 desc
   limit least(greatest(coalesce(p_몇줄, 50), 1), 200)
$$;


ALTER FUNCTION public."내알림"("p_몇줄" integer) OWNER TO postgres;

--
-- Name: 내애플연결(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내애플연결"() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select "토큰" from "애플연결" where profile_id = auth.uid() and "끊은때" is null
$$;


ALTER FUNCTION public."내애플연결"() OWNER TO postgres;

--
-- Name: 내재직인증(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내재직인증"() RETURNS TABLE(id bigint, "상태" text, "병원이름" text, "신청때" timestamp with time zone, "반려까닭" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.id, r.상태, r.병원이름, r.신청때, r.반려까닭
    from 재직인증 r where r.profile_id = auth.uid()
   order by r.신청때 desc
$$;


ALTER FUNCTION public."내재직인증"() OWNER TO postgres;

--
-- Name: 내차단목록(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내차단목록"() RETURNS TABLE("누구" uuid, "닉네임" text, "때" timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.누구, coalesce(pr.nickname, '(탈퇴한 회원)'), b.때
    from 회원차단 b left join profiles pr on pr.id = b.누구
   where b.누가 = auth.uid() and b.켬
   order by b.때 desc
$$;


ALTER FUNCTION public."내차단목록"() OWNER TO postgres;

--
-- Name: 내페르소나(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내페르소나"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when not 마스터인가() then '{"마스터": false}'::jsonb
         else (select jsonb_build_object(
                 '마스터', true, '지금역할', m.지금역할, '바뀐때', m.바뀐때,
                 '고를수있는것', jsonb_build_array('관리자','학생','작업치료사','물리치료사',
                                                '채용담당자','교육담당자','채용+교육담당자',
                                                '가입중','비회원'))
                 from 마스터페르소나 m where m.auth_id = auth.uid()) end
$$;


ALTER FUNCTION public."내페르소나"() OWNER TO postgres;

--
-- Name: 내프로필(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."내프로필"() RETURNS TABLE(id uuid, nickname text, avatar text, job_group text, role text, nickname_changes integer, survey_at timestamp with time zone, survey_edits integer, survey_edits_since timestamp with time zone, terms_version text, terms_agreed_at timestamp with time zone, created_at timestamp with time zone, erased_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id, p.nickname, p.avatar, p.job_group, p.role,
         p.nickname_changes, p.survey_at,
         p.survey_edits, p.survey_edits_since,
         p.terms_version, p.terms_agreed_at, p.created_at, p.erased_at
    from profiles p
   where p.id = auth.uid();
$$;


ALTER FUNCTION public."내프로필"() OWNER TO postgres;

--
-- Name: 네숫자(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."네숫자"() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with v as (select * from job_posts_pub),
  구멍 as (select "일층병원_구멍셈"() as j),
  /* ★ 2026-10-22 — **회원이 신뢰를 느끼는 셋** (docs/오픈일정_1110.md · 오픈 11/10).
     셋을 **여기 한 자리**에서 셉니다 — tools/신뢰셋.mjs 는 이 함수를 받아 찍기만 합니다.
     ③ 의 「자격증 목록꼴」 = 제목에 우리 직군이 없고, 원문의 직군 말이
     「간호사, 사회복지사, 작업치료사 … 중 1개 이상」처럼 **여러 직종 자격 요건**이거나
     「‘담당업무’는 물리·작업치료 관련 경력임을 기재」처럼 **서식 안내문**인 것입니다.
     직군의심() 은 원문에 글자가 있으면 통과시켜 이 꼴을 못 봅니다 — 그래서 따로 셉니다. */
  /* ★ as materialized — 없으면 PostgreSQL 이 이 CTE 를 **줄마다 펼쳐서**
     직군의심() (0.8초) 을 회원 공고 수만큼 부릅니다. 10-22 밤에 그렇게 해서
     네숫자() 가 **statement timeout** 으로 터졌습니다 (57014) */
  의심 as materialized (select "직군의심"() as j),
  "직군셋" as (
    select v.id,
           btrim(coalesce(v.job_group, '')) = '' as "빈칸",
           (btrim(coalesce(v.job_group, '')) <> ''
            and coalesce(nullif(v."원문제목", ''), v.title, '')
                  !~ '(물리|작업|도수)[[:space:]]*치료|물리\(작업\)|작업\(물리\)'
            and "글".g ~ '(물리|작업|도수)[[:space:]]*치료'
            /* ★ 2026-10-22 밤 — 그물을 넓혔습니다 (세중님 승인 B).
               좁은 그물이 **「중 1개 **분야** 이상」을 못 봤습니다** — 서귀포시 공고가
               「다음 자격요건 중 1개 분야 이상: 1.간호사 2.사회복지사1급 3.작업치료사
               4.임상심리사」 로 적어서 빠져나갔습니다. 마른 실행 — 넓혀도 새로
               걸리는 공고 **0건**(그 두 건은 이미 손으로 보류함에 넣었습니다) */
            and "글".g ~ ('중[[:space:]]*(하나|한[[:space:]]*가지)'
                       || '|중[[:space:]]*[0-9]+[[:space:]]*(개|가지)?[[:space:]]*(분야|종목|항목)?[[:space:]]*이상'
                       || '|각[[:space:]]*[0-9]+급[[:space:]]*이상'
                       || '|(어느|아래)[[:space:]]*하나'
                       || '|관련[[:space:]]*경력임을')
            and "글".g ~ '간호사|사회복지사|임상심리사|상담심리사|정신건강|보건교사|영양사'
           ) as "목록꼴",
           /* 직군의심() 은 id 를 안 줍니다 — **주소**로 맞춥니다 */
           (v.url in (select x->>'주소' from 의심, jsonb_array_elements(의심.j->'의심목록') x))
             as "의심인가"
      from v
      join job_posts p on p.id = v.id
      cross join lateral (
        /* 기관이 적은 글만 봅니다 — 우리가 쓴 「근거」 칸은 근거로 안 씁니다 */
        select concat_ws(' ', p.detail->>'지원자격', p.detail->>'걸린줄',
                              p.detail->>'본문', p."뽑은값"->>'지원자격') as g) "글"
  ),
  일층 as (select "견줄이름"("기관") as k from "일층병원_구멍"()),
  시각 as (
    select count(*) as 분모,
           count(*) filter (where j.apply_to_time is not null) as 찬것
      from job_posts j
      join collect_source s on s.code = j.source
     where j.id in (select id from v) and s."마감시각줌"
  ),
  /* ★ 세는 칸은 **화면이 그리는 칸**과 같아야 합니다.
     짝은 web/app/jobs/[id]/page.tsx 이고 대조표는 docs/일곱칸_대조_1014.md 입니다 */
  칸 as (
    select v.id,
           (l.k is not null) as 일층인가,
           /* 모집 인원 — 직군인원 → headcount → 뽑은값.모집인원 (page.tsx:184) */
           (v.headcount is not null
            or coalesce((p.detail->'직군인원'->>'물리치료사')::int, 0) > 0
            or coalesce((p.detail->'직군인원'->>'작업치료사')::int, 0) > 0
            or nullif(p."뽑은값"->>'모집인원', '') is not null) as 모집있나,
           /* 근무지 — 지역보임 → work_place (page.tsx:318) */
           (coalesce(v."지역보임", '') <> '' or coalesce(v.work_place, '') <> '') as 근무지있나,
           /* 지원 자격 — 뽑은값.지원자격 → detail.지원자격 (page.tsx:167).
              edu 칸은 화면이 안 봅니다 */
           (coalesce(nullif(p."뽑은값"->>'지원자격', ''), nullif(p.detail->>'지원자격', ''))
              is not null) as 자격있나,
           /* 예상 연봉 — 글자가 아니라 **금액**. web/lib/job-state.ts 의 금액꼴과 같은 꼴 */
           coalesce(nullif(p."뽑은값"->>'예상연봉', ''), nullif(p.detail->>'연봉', ''),
                    nullif(p.detail->>'예상연봉', ''))
             ~ '[0-9][0-9,.[:space:]]*(만|천|억)?[[:space:]]*원' as 연봉있나,
           /* 병원 뜯어보기는 **줄이 있으면** 그립니다 · 바쁜정도는 band 까지 있어야 합니다
              (page.tsx:399 의 {hosp && …} 와 {hosp.band && …}) */
           (h.key is not null) as 병원자료있나,
           (h.band is not null) as 바쁜정도있나,
           "org_key"(p.org_name) as 기관키
      from v
      join job_posts p on p.id = v.id
      left join 일층 l on l.k = "견줄이름"(p.org_name)
      left join org_hospital_stat h on h.key = "org_key"(p.org_name)
  )
  select jsonb_build_object(
    '잰때', now(),
    '회원화면', (select count(*) from v),
    '①놓친공고', jsonb_build_object(
        '안긁는_1층기관', (select (j->>'사각지대')::int from 구멍),
        '대상_1층기관', (select (j->>'대상')::int from 구멍),
        '공공', (select j->'공공' from 구멍),
        '민간', (select j->'민간' from 구멍),
        '보건소', (select j->'보건소' from 구멍),
        '안긁는_상급종합', (select jsonb_array_length(j->'사각_상급종합') from 구멍),
        '경쟁사기준', null),
    /* ★ 2026-10-17 — 날짜만 보던 것을 **날짜+시각(KST)** 으로 셉니다.
       화면의 isClosed(web/lib/job-state.ts:37) 와 **같은 규칙**입니다 —
       시각이 없으면 그날 종일 보입니다(= 그날 23:59 KST 까지).
       안 고치면 「회원에게는 보이는데 경보는 0」 이 됩니다 —
       2026-10-17 에 실제로 그랬습니다 (중앙보훈 09:00 마감 공고가 종일 보임). */
    '②마감인데보임', (select count(*) from v
        where v.apply_to is not null
          and ((v.apply_to + coalesce(v.apply_to_time, time '23:59'))
                 at time zone 'Asia/Seoul') < now()),
    /* ★ 2026-10-18 — **「원문 없어짐인데 보임」 과 「정찰이 한 번도 안 본 것」을 더합니다**
       (세중님 3번). 2026-10-18 에 ② 가 0 인데 **없어진 공고가 회원 화면에 9건**
       있었습니다 — ND2 3건(「게시물이 존재하지」) · 워크넷 6건(「구인정보를 확인할
       수 없습니다」). ② 는 **마감일**만 보니 그것을 못 셌고, **0 이 사실을
       가리고 있었습니다.**

       왜 「정찰이 한 번도 안 본 것」까지 세나 — 그 9건은 DB 에 아무 신호도 없었습니다.
       `gone_streak` 가 0 인 까닭은 **정찰이 그 공고를 본 적이 없어서**입니다.
       그러니 「없어짐으로 본 것」만 세면 **모르는 것을 0 으로 셉니다.**
       정찰이 안 본 수가 0 이어야 ② 를 믿을 수 있습니다 (세중님 2번). */
    '②원문없어짐인데보임', (select count(*) from v
        join job_posts g on g.id = v.id
        where coalesce(g.gone_streak, 0) >= 2),
    '②정찰이한번도안본것', (select count(*) from v
        join job_posts g on g.id = v.id
        where g.seen_on is null),
    '②정찰이사흘안에본것', (select count(*) from v
        join job_posts g on g.id = v.id
        where g.seen_on >= (now() at time zone 'Asia/Seoul')::date - 3),
    '②마감일비어보임', (select count(*) from v where v.apply_to is null),
    /* ★ 2026-10-20 — 「마감일이 비어 보이는 것」을 따로 셉니다 (세중님 1번 뿌리②).
       ② 는 apply_to 를 오늘과 견주니, **비어 있으면 0** 으로 나옵니다. 그 0 이
       마감 지난 공고 네 건을 가리고 있었습니다 (청주의료원 103일 지남 ·
       상주적십자 75일 · 인천적십자 46일 · **광주씨티 2021년 공고**).

       「확인할 것」을 따로 세는 까닭 — 「상시채용」·「채용 시 까지」처럼 **원문에
       끝 날짜가 없는** 공고는 비어 있는 것이 맞습니다. 그래서 날짜가 **오래된
       쪽**만 고릅니다. 기준은 `tools/마감비어보임.mjs` 와 같은 한 벌입니다 —
         ㉠ 올린날·담은날 가운데 이른 것이 60일 넘었다  또는
         ㉡ **올린날이 아예 없다**
       ㉡ 가 없으면 **가장 나쁜 것을 놓칩니다** — 광주씨티는 2021년 공고인데
       posted_at 이 비어 있고 우리가 10-18 에 담아서 「2일」로 보입니다.

       ★ 이 숫자는 **세기만** 합니다. 숨기는 것은 원문을 보고 마감일을 채운
         뒤 정리매시가 합니다 — 근거 없이 숨기지 않습니다 (세중님). */
    '②마감일비어보임_확인할것', (select count(*) from v
        join job_posts g on g.id = v.id
       where v.apply_to is null
         and (g.posted_at is null
              or least(coalesce(g.posted_at, date '9999-12-31'),
                       coalesce((g.db_insert_at at time zone 'Asia/Seoul')::date,
                                date '9999-12-31'))
                 <= (now() at time zone 'Asia/Seoul')::date - 60)),
    '③일곱칸', jsonb_build_object(
        '모집인원', (select round(100.0 * count(*) filter (where 모집있나) / nullif(count(*), 0), 1) from 칸),
        '접수마감', (select round(100.0 * count(*) filter (where apply_to is not null)
                                 / nullif(count(*), 0), 1) from v),
        '마감시각', (select round(100.0 * 찬것 / nullif(분모, 0), 1) from 시각),
        '마감시각_분모', (select 분모 from 시각),
        '마감시각_찬것', (select 찬것 from 시각),
        '마감시각_전체참고', (select round(100.0 * count(*) filter (where apply_to_time is not null)
                                          / nullif(count(*), 0), 1) from v),
        '근무지', (select round(100.0 * count(*) filter (where 근무지있나) / nullif(count(*), 0), 1) from 칸),
        '지원자격', (select round(100.0 * count(*) filter (where 자격있나) / nullif(count(*), 0), 1) from 칸),
        '지원자격_1층', (select round(100.0 * count(*) filter (where 자격있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '모집인원_1층', (select round(100.0 * count(*) filter (where 모집있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉', (select round(100.0 * count(*) filter (where 연봉있나) / nullif(count(*), 0), 1) from 칸),
        '예상연봉_1층', (select round(100.0 * count(*) filter (where 연봉있나)
                                     / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '예상연봉_1층분모', (select count(*) from 칸 where 일층인가),
        '바쁜정도', (select round(100.0 * count(*) filter (where 바쁜정도있나) / nullif(count(*), 0), 1) from 칸),
        '병원뜯어보기', (select round(100.0 * count(*) filter (where 병원자료있나) / nullif(count(*), 0), 1) from 칸),
        '병원뜯어보기_1층', (select round(100.0 * count(*) filter (where 병원자료있나)
                                         / nullif(count(*), 0), 1) from 칸 where 일층인가),
        '병원자료있는기관', (select count(distinct 기관키) from 칸 where 병원자료있나),
        '회원화면기관', (select count(distinct 기관키) from 칸),
        '※세는칸', '화면이 그리는 칸과 같은 칸을 셉니다 — 대조표 docs/일곱칸_대조_1014.md (2026-10-14)'),
    /* ★ 2026-10-22 — **오픈까지의 목표 셋. 셋 다 0 이어야 합니다** (세중님).
       ② 는 새 표본 40건을 원문에 대고 **주 1회 손으로** 재어
       site_settings['신뢰셋_틀림'] 에 적습니다. 안 쟀으면 **null** 입니다 —
       「모름」을 0 으로 찍지 않습니다 (0 은 「재서 틀림이 없었다」는 뜻입니다). */
    '신뢰셋', jsonb_build_object(
      '①마감지난공고가보임', (select count(*) from v
          where (v.apply_to is not null
                 and ((v.apply_to + coalesce(v.apply_to_time, time '23:59'))
                        at time zone 'Asia/Seoul') < now())
             or exists (select 1 from job_posts g
                         where g.id = v.id and coalesce(g.gone_streak, 0) >= 2)),
      '②회원화면에틀린값', (select value->'틀림' from site_settings where key = '신뢰셋_틀림'),
      '②잰날', (select value->>'잰날' from site_settings where key = '신뢰셋_틀림'),
      '②표본', (select value->>'표본' from site_settings where key = '신뢰셋_틀림'),
      /* ★ **공고 몇 건인가**를 셉니다 — 셋이 겹치면 한 건입니다.
         2026-10-22 에 더해 세다가 군산의료원 두 건을 두 번 세어 7 이 나왔습니다
         (실제 5건). 빈칸인 공고는 원문에 직군 말이 없으니 의심에도 들어갑니다. */
      /* ★ 2026-10-23 세중님 H-2 = ⓐ — **목록꼴을 ③ 에서 뺐습니다.**
         「A, 작업치료사, B 중 1개 이상」 꼴은 2026-10-14 결정대로 **우리 직군
         공고로 둡니다**. ③ 의 뜻은 「우리 직군이 **아닌** 공고」인데, 면허를
         받아 주는 공고는 아닌 것이 아닙니다. 건수는 아래 보조 줄로 셉니다. */
      '③우리직군아님_직군빈칸', (select count(*) from "직군셋" d
          where d."빈칸" or d."의심인가"),
      '③직군빈칸', (select count(*) from "직군셋" where "빈칸"),
      '③자격증목록꼴', (select count(*) from "직군셋" where "목록꼴"),
      '③자격증목록꼴※', '**보조 줄입니다 — 목표값이 없습니다.** 「A, 작업치료사,'
           || ' B 중 1개 이상」 꼴은 우리 직군 공고로 둡니다 (2026-10-14 · 10-23 세중님).'
           || ' 건수만 봅니다. 그 공고의 모집인원은 우리 직군 인원이 아니라 비웁니다',
      '③직군의심', (select j->'의심' from 의심),
      '③겹친것', (select count(*) from "직군셋" d
          where d."빈칸" and d."의심인가"),
      '※', '목표는 셋 다 0 입니다 (docs/오픈일정_1110.md). ② 는 주 1회 손으로 재어'
           || ' site_settings[신뢰셋_틀림] 에 넣습니다 — 안 쟀으면 null 입니다'),
    '④먼저올린비율', null
  )
$$;


ALTER FUNCTION public."네숫자"() OWNER TO postgres;

--
-- Name: 닉네임다듬기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."닉네임다듬기"(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$ select lower(regexp_replace(coalesce(p, ''), '\s', '', 'g')); $$;


ALTER FUNCTION public."닉네임다듬기"(p text) OWNER TO postgres;

--
-- Name: 닉네임쓸수있나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."닉네임쓸수있나"(p_nickname text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_다듬 text := 닉네임다듬기(p_nickname);
begin
  if length(v_다듬) = 0 then
    return jsonb_build_object('됨', false, '왜', '닉네임을 적어 주세요');
  end if;
  if exists (select 1 from profiles
              where 닉네임다듬기(nickname) = v_다듬 and id is distinct from auth.uid()) then
    return jsonb_build_object('됨', false, '왜', '이미 쓰고 있는 닉네임이에요');
  end if;
  if 닉네임잡혔나(p_nickname) then
    return jsonb_build_object('됨', false, '왜', '최근에 쓰이던 닉네임이라 조금 뒤에 쓸 수 있어요');
  end if;
  return jsonb_build_object('됨', true, '왜', '쓸 수 있어요');
end $$;


ALTER FUNCTION public."닉네임쓸수있나"(p_nickname text) OWNER TO postgres;

--
-- Name: 닉네임잡혔나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."닉네임잡혔나"(p_nickname text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_지문 bytea;
begin
  v_지문 := 닉네임지문(p_nickname);
  if v_지문 is null then return false; end if;      -- 열쇠가 없으면 막지 않습니다
  return exists (
    select 1 from erased_accounts
     where 이름지문 = v_지문
       and 이름암호 is not null                     -- 아직 파기 전
  );
end $$;


ALTER FUNCTION public."닉네임잡혔나"(p_nickname text) OWNER TO postgres;

--
-- Name: 닉네임지문(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."닉네임지문"(p text) RETURNS bytea
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare v_열쇠 text;
begin
  select decrypted_secret into v_열쇠 from vault.decrypted_secrets where name = '닉네임대조열쇠';
  if v_열쇠 is null then return null; end if;
  return hmac(닉네임다듬기(p), v_열쇠, 'sha256');
end $$;


ALTER FUNCTION public."닉네임지문"(p text) OWNER TO postgres;

--
-- Name: 담당자공고고치기(text, text, text, text, text, integer, date, date, time without time zone, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."담당자공고고치기"("p_공고" text, "p_제목" text DEFAULT NULL::text, "p_직군" text DEFAULT NULL::text, "p_고용형태" text DEFAULT NULL::text, "p_근무지" text DEFAULT NULL::text, "p_인원" integer DEFAULT NULL::integer, "p_접수부터" date DEFAULT NULL::date, "p_접수까지" date DEFAULT NULL::date, "p_마감시각" time without time zone DEFAULT NULL::time without time zone, "p_주소" text DEFAULT NULL::text, "p_상세" jsonb DEFAULT NULL::jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); j record;
begin
  select * into j from job_posts where id = p_공고;
  if j is null then raise exception '없는 공고입니다' using errcode = '22023'; end if;
  if j.source <> 'BIZ' then
    raise exception '우리가 모아 온 공고는 담당자가 고칠 수 없습니다' using errcode = '42501';
  end if;
  if not 채용담당자인가(j.기관번호) then
    raise exception '이 공고의 담당자가 아닙니다' using errcode = '42501';
  end if;
  if p_직군 is not null and p_직군 not in ('작업치료사', '물리치료사') then
    raise exception '직군은 작업치료사 또는 물리치료사입니다' using errcode = '22023'; end if;

  update job_posts set
    title         = coalesce(nullif(btrim(coalesce(p_제목, '')), ''), title),
    job_group     = coalesce(p_직군, job_group),
    employ_type   = coalesce(nullif(btrim(coalesce(p_고용형태, '')), ''), employ_type),
    work_place    = coalesce(nullif(btrim(coalesce(p_근무지, '')), ''), work_place),
    headcount     = coalesce(p_인원, headcount),
    apply_from    = coalesce(p_접수부터, apply_from),
    apply_to      = coalesce(p_접수까지, apply_to),
    apply_to_time = coalesce(p_마감시각, apply_to_time),
    url           = coalesce(nullif(btrim(coalesce(p_주소, '')), ''), url),
    detail        = coalesce(p_상세, detail),
    evidence      = evidence || jsonb_build_object('고친사람', v, '고친때', now()),
    updated_at    = now()
   where id = p_공고;
  return true;
end $$;


ALTER FUNCTION public."담당자공고고치기"("p_공고" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) OWNER TO postgres;

--
-- Name: 담당자공고마감(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."담당자공고마감"("p_공고" text, "p_내릴까" boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); j record;
        v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into j from job_posts where id = p_공고;
  if j is null then raise exception '없는 공고입니다' using errcode = '22023'; end if;
  if j.source <> 'BIZ' then
    raise exception '우리가 모아 온 공고는 담당자가 마감할 수 없습니다' using errcode = '42501';
  end if;
  if not 채용담당자인가(j.기관번호) then
    raise exception '이 공고의 담당자가 아닙니다' using errcode = '42501';
  end if;

  if p_내릴까 then
    update job_posts
       set hidden = true, hidden_why = '담당자가 내렸습니다', hidden_on = v_오늘,
           evidence = evidence || jsonb_build_object('내린사람', v, '내린때', now()),
           updated_at = now()
     where id = p_공고;
  else
    update job_posts
       set apply_to = v_오늘,
           apply_to_time = (now() at time zone 'Asia/Seoul')::time,
           evidence = evidence || jsonb_build_object('마감한사람', v, '마감한때', now()),
           updated_at = now()
     where id = p_공고;
  end if;
  return true;
end $$;


ALTER FUNCTION public."담당자공고마감"("p_공고" text, "p_내릴까" boolean) OWNER TO postgres;

--
-- Name: 담당자공고쓰기(text, text, text, text, text, integer, date, date, time without time zone, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."담당자공고쓰기"("p_기관번호" text, "p_제목" text, "p_직군" text, "p_고용형태" text DEFAULT NULL::text, "p_근무지" text DEFAULT NULL::text, "p_인원" integer DEFAULT NULL::integer, "p_접수부터" date DEFAULT NULL::date, "p_접수까지" date DEFAULT NULL::date, "p_마감시각" time without time zone DEFAULT NULL::time without time zone, "p_주소" text DEFAULT NULL::text, "p_상세" jsonb DEFAULT '{}'::jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); o record; v_id text; v_기관 text := p_기관번호; v_시험 boolean;
begin
  if v is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;

  /* 승인된 담당자가 아니면 — 채용 담당자 페르소나인 마스터만 시험병원으로 */
  if not 채용담당자인가(v_기관) then
    if 마스터역할() in ('채용담당자', '채용+교육담당자') then
      v_기관 := 'TEST:마스터시험병원';
    else
      raise exception '이 기관의 승인된 채용담당자가 아닙니다' using errcode = '42501';
    end if;
  end if;

  if coalesce(btrim(p_제목), '') = '' then
    raise exception '제목을 적어 주세요' using errcode = '22023'; end if;
  if p_직군 is null or p_직군 not in ('작업치료사', '물리치료사') then
    raise exception '직군은 작업치료사 또는 물리치료사입니다' using errcode = '22023'; end if;
  if coalesce(btrim(p_주소), '') = '' then
    raise exception '지원 안내 주소를 적어 주세요' using errcode = '22023'; end if;
  if p_접수까지 is not null and p_접수부터 is not null and p_접수까지 < p_접수부터 then
    raise exception '마감일이 접수 시작보다 빠릅니다' using errcode = '22023'; end if;

  select * into o from 기관 where 기관번호 = v_기관;
  if o is null then raise exception '없는 기관입니다' using errcode = '22023'; end if;

  v_시험 := (v_기관 like 'TEST:%');
  v_id   := 'BIZ' || lpad(nextval('담당자공고번호')::text, 6, '0');

  insert into job_posts (id, source, external_id, org_name, title,
                         employ_type, work_place, sido, sgg, headcount,
                         apply_from, apply_to, apply_to_time, posted_at, url,
                         job_group, tab, 기관번호, 연결상태, 연결근거,
                         detail, evidence, 시험자료)
  values (v_id, 'BIZ', v_id, o.이름, btrim(p_제목),
          nullif(btrim(coalesce(p_고용형태, '')), ''),
          nullif(btrim(coalesce(p_근무지, '')), ''),
          o.시도, o.시군구, p_인원,
          coalesce(p_접수부터, (now() at time zone 'Asia/Seoul')::date),
          p_접수까지, p_마감시각,
          (now() at time zone 'Asia/Seoul')::date, btrim(p_주소),
          p_직군, o.탭, v_기관, '담당자', '담당자가 직접 올린 공고',
          coalesce(p_상세, '{}'::jsonb),
          jsonb_build_object('올린사람', v, '올린때', now(), '공식확인', true),
          v_시험);

  return v_id;
end $$;


ALTER FUNCTION public."담당자공고쓰기"("p_기관번호" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) OWNER TO postgres;

--
-- Name: 담당자신청(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."담당자신청"("p_갈래" text, "p_기관번호" text DEFAULT NULL::text, "p_교육기관" text DEFAULT NULL::text, "p_사업자번호" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_id bigint;
begin
  if v is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if p_갈래 not in ('채용담당자','교육담당자기관','교육담당자개인') then
    raise exception '모르는 갈래입니다 (%)', p_갈래 using errcode = '22023';
  end if;

  insert into 회원자격 (profile_id, 갈래, 기관번호, 교육기관, 사업자번호, 상태)
  values (v, p_갈래,
          case when p_갈래 = '채용담당자' then p_기관번호 end,
          case when p_갈래 = '교육담당자기관' then p_교육기관 end,
          nullif(btrim(coalesce(p_사업자번호,'')), ''), '심사중')
  returning id into v_id;

  return jsonb_build_object('자격id', v_id, '상태', '심사중');
end $$;


ALTER FUNCTION public."담당자신청"("p_갈래" text, "p_기관번호" text, "p_교육기관" text, "p_사업자번호" text) OWNER TO postgres;

--
-- Name: 담지못한줄(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."담지못한줄"(p_hours integer DEFAULT 24) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
with 줄 as (
  select b.source, b.ran_at, b."메모"->'못담은것' as 것들,
         coalesce((b."메모"->>'못담음')::int, 0) as 수
    from collector_beat b
   where b.ran_at > now() - make_interval(hours => p_hours)
     and coalesce((b."메모"->>'못담음')::int, 0) > 0
)
select jsonb_build_object(
  '건수', coalesce((select sum(수) from 줄), 0),
  '바퀴수', (select count(*) from 줄),
  '목록', coalesce((
    select jsonb_agg(jsonb_build_object(
             '경로', z.source,
             '때', to_char(z.ran_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI'),
             '공고', x->>'id', '어디', x->>'어디', '까닭', left(x->>'까닭', 120))
           order by z.ran_at desc)
      from 줄 z, lateral jsonb_array_elements(coalesce(z.것들, '[]'::jsonb)) x
  ), '[]'::jsonb),
  '※', '수집기가 창구에 못 보낸 줄입니다. 한 줄 때문에 바퀴가 통째로 죽지 않게'
       || ' 반씩 나눠 그 줄만 빼고 담습니다 (tools/보낼줄.mjs). 0 이 정상입니다'
);
$$;


ALTER FUNCTION public."담지못한줄"(p_hours integer) OWNER TO postgres;

--
-- Name: 대표인가(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대표인가"() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from admins
                  where profile_id = auth.uid() and 갈래 = '대표' and 끈때 is null)
$$;


ALTER FUNCTION public."대표인가"() OWNER TO postgres;

--
-- Name: 대화걸기(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대화걸기"("p_상대" uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_열쇠 text; v_방 bigint;
begin
  if v is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if v = p_상대 then raise exception '자기 자신에게는 못 겁니다' using errcode = '22023'; end if;
  if not exists (select 1 from profiles where id = p_상대) then
    raise exception '없는 회원입니다' using errcode = '22023';
  end if;
  if exists (select 1 from 대화차단 where 막은사람 = p_상대 and 막힌사람 = v) then
    raise exception '지금은 말을 걸 수 없어요' using errcode = '42501';
  end if;

  v_열쇠 := least(v::text, p_상대::text) || '|' || greatest(v::text, p_상대::text);

  select id into v_방 from chat_rooms where dm_key = v_열쇠;
  if v_방 is null then
    insert into chat_rooms (dm_key, 상태, 건사람) values (v_열쇠, '신청', v)
    returning id into v_방;
    insert into chat_members (room_id, profile_id) values (v_방, v), (v_방, p_상대);
    perform 알림넣기(p_상대, '대화신청', '말을 걸어온 분이 있어요',
                     '받을지 안 받을지 고르실 수 있어요.', '/talk');
  end if;

  return jsonb_build_object('방', v_방, '상태',
    (select 상태 from chat_rooms where id = v_방));
end $$;


ALTER FUNCTION public."대화걸기"("p_상대" uuid) OWNER TO postgres;

--
-- Name: 대화보내기(bigint, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대화보내기"("p_방" bigint, "p_글" text, "p_사진" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); r record; v_상대 uuid; v_id bigint;
begin
  select * into r from chat_rooms where id = p_방;
  if r is null or not in_room(p_방) then
    raise exception '내 방이 아닙니다' using errcode = '42501';
  end if;
  if r.상태 <> '수락' then raise exception '아직 시작된 대화가 아니에요' using errcode = '22023'; end if;

  select profile_id into v_상대 from chat_members
   where room_id = p_방 and profile_id <> v limit 1;
  if exists (select 1 from 대화차단 where 막은사람 = v_상대 and 막힌사람 = v) then
    raise exception '지금은 말을 걸 수 없어요' using errcode = '42501';
  end if;

  insert into chat_messages (room_id, sender_id, body, image_path)
  values (p_방, v, nullif(btrim(coalesce(p_글,'')), ''), p_사진)
  returning id into v_id;

  update chat_members set last_read_at = now() where room_id = p_방 and profile_id = v;
  return jsonb_build_object('id', v_id);
end $$;


ALTER FUNCTION public."대화보내기"("p_방" bigint, "p_글" text, "p_사진" text) OWNER TO postgres;

--
-- Name: 대화읽기(bigint, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대화읽기"("p_방" bigint, "p_몇줄" integer DEFAULT 100) RETURNS TABLE(id bigint, "나인가" boolean, "글" text, "사진" text, "사진사라짐" boolean, "쓴때" timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, m.sender_id = auth.uid(), m.body,
         case when m.image_path is null then null
              when m.sender_id = auth.uid() then m.image_path
              when m.본때 is null then m.image_path
         end,
         (m.image_path is not null and m.본때 is not null and m.sender_id <> auth.uid()),
         m.created_at
    from chat_messages m
    join chat_rooms r on r.id = m.room_id
   where m.room_id = p_방 and in_room(p_방) and r.상태 = '수락'
   order by m.created_at
   limit least(greatest(coalesce(p_몇줄, 100), 1), 300)
$$;


ALTER FUNCTION public."대화읽기"("p_방" bigint, "p_몇줄" integer) OWNER TO postgres;

--
-- Name: 대화읽음(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대화읽음"("p_방" bigint) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if not in_room(p_방) then raise exception '내 방이 아닙니다' using errcode = '42501'; end if;
  update chat_messages set 본때 = now()
   where room_id = p_방 and sender_id <> auth.uid()
     and image_path is not null and 본때 is null;
  get diagnostics n = row_count;
  update chat_members set last_read_at = now()
   where room_id = p_방 and profile_id = auth.uid();
  return n;
end $$;


ALTER FUNCTION public."대화읽음"("p_방" bigint) OWNER TO postgres;

--
-- Name: 대화정하기(bigint, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대화정하기"("p_방" bigint, "p_받나" boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); r record;
begin
  select * into r from chat_rooms where id = p_방;
  if r is null then raise exception '없는 방입니다' using errcode = '22023'; end if;
  if r.건사람 = v then raise exception '건 사람은 못 정합니다' using errcode = '42501'; end if;
  if not in_room(p_방) then raise exception '내 방이 아닙니다' using errcode = '42501'; end if;

  update chat_rooms set 상태 = case when p_받나 then '수락' else '거절' end where id = p_방;
  if p_받나 then
    perform 알림넣기(r.건사람, '대화수락', '대화가 시작됐어요', null, '/talk/' || p_방);
  end if;
  return jsonb_build_object('방', p_방, '상태', case when p_받나 then '수락' else '거절' end);
end $$;


ALTER FUNCTION public."대화정하기"("p_방" bigint, "p_받나" boolean) OWNER TO postgres;

--
-- Name: 대화차단하기(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."대화차단하기"("p_상대" uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into 대화차단 (막은사람, 막힌사람) values (auth.uid(), p_상대)
  on conflict do nothing;
  return jsonb_build_object('막음', true);
end $$;


ALTER FUNCTION public."대화차단하기"("p_상대" uuid) OWNER TO postgres;

--
-- Name: 동의남기기(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."동의남기기"("p_판" text, "p_문서들" jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare me uuid := auth.uid(); n int := 0;
begin
  if me is null then
    raise exception '로그인한 사람만 쓸 수 있습니다' using errcode = '42501';
  end if;
  insert into 약관동의 (profile_id, 문서, 판, 동의함)
  select me, key, p_판, (value)::text::boolean
    from jsonb_each(p_문서들)
   where key in ('service', 'privacy', 'community', 'notify', 'age')
  on conflict (profile_id, 문서, 판) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION public."동의남기기"("p_판" text, "p_문서들" jsonb) OWNER TO postgres;

--
-- Name: 마감일되읽기(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."마감일되읽기"(p_secret text, p_source text, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_ok int := 0; v_건너뜀 int := 0; r jsonb; v_짝 text;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;
  select 옛출처 into v_짝 from 수집기짝 where 새출처 = p_source;
  perform set_config('app.누가', '마감일되읽기 ' || p_source, true);
  for r in select * from jsonb_array_elements(p_rows) loop
    update job_posts j set
      apply_from = coalesce(j.apply_from, nullif(r->>'apply_from','')::date),
      apply_to   = nullif(r->>'apply_to','')::date,
      evidence   = coalesce(j.evidence,'{}'::jsonb)
                   || jsonb_strip_nulls(jsonb_build_object(
                        '날짜출처', r->>'날짜출처', '접수문장', r->>'접수문장')),
      updated_at = now()
     where j.id = r->>'id'
       and j.apply_to is null
       and not coalesce(j.admin_locked, false)
       and (j.source = p_source or j.source is null
            or (v_짝 is not null and j.source = v_짝));
    if found then v_ok := v_ok + 1; else v_건너뜀 := v_건너뜀 + 1; end if;
  end loop;
  return jsonb_build_object('채움', v_ok, '건너뜀', v_건너뜀);
end $$;


ALTER FUNCTION public."마감일되읽기"(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: 마감지났나(date, time without time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."마감지났나"(p_apply_to date, p_apply_to_time time without time zone DEFAULT NULL::time without time zone) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select case
    when p_apply_to is null then false
    when p_apply_to < (now() at time zone 'Asia/Seoul')::date then true
    when p_apply_to > (now() at time zone 'Asia/Seoul')::date then false
    when p_apply_to_time is null then false
    else (now() at time zone 'Asia/Seoul')::time > p_apply_to_time
  end
$$;


ALTER FUNCTION public."마감지났나"(p_apply_to date, p_apply_to_time time without time zone) OWNER TO postgres;

--
-- Name: 마감표시(date, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text) RETURNS text
    LANGUAGE sql STABLE
    AS $_$
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
$_$;


ALTER FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text) OWNER TO postgres;

--
-- Name: 마스터역할(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."마스터역할"() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select m.지금역할 from 마스터페르소나 m where m.auth_id = auth.uid() $$;


ALTER FUNCTION public."마스터역할"() OWNER TO postgres;

--
-- Name: 마스터인가(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."마스터인가"() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists (select 1 from 마스터페르소나 where auth_id = auth.uid()) $$;


ALTER FUNCTION public."마스터인가"() OWNER TO postgres;

--
-- Name: 모르는코드(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."모르는코드"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 본것 as (
    select '고용형태'::text 칸, source, btrim(employ_type) 값, count(*) 건수,
           count(*) filter (where not hidden and not hold) 살아있음
      from job_posts
     where coalesce(employ_type,'') <> ''
       and (btrim(employ_type) !~ '[가-힣]' or btrim(employ_type) like '%[미확인]%')
     group by 1,2,3
    union all
    select '채용구분', source, btrim(hire_type), count(*),
           count(*) filter (where not hidden and not hold)
      from job_posts
     where coalesce(hire_type,'') <> ''
       and (btrim(hire_type) !~ '[가-힣]' or btrim(hire_type) like '%[미확인]%')
     group by 1,2,3
  )
  select jsonb_build_object(
    '있나', exists (select 1 from 본것),
    '가짓수', (select count(*) from 본것),
    '공고수', coalesce((select sum(건수) from 본것), 0),
    '회원화면에보이는것', coalesce((select sum(살아있음) from 본것 where 칸 = '고용형태'), 0),
    '줄', coalesce((select jsonb_agg(jsonb_build_object(
            '칸', 칸, '출처', source, '값', 값, '공고수', 건수, '살아있음', 살아있음)
            order by 살아있음 desc, 건수 desc) from 본것), '[]'::jsonb));
$$;


ALTER FUNCTION public."모르는코드"() OWNER TO postgres;

--
-- Name: 목록빠짐표시(text, text, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."목록빠짐표시"(p_secret text, p_source text, "p_본것" text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_살아 int; v_걸린것 int; v_본것수 int := coalesce(array_length(p_본것, 1), 0);
  v_빠짐 int := 0; v_되돌림 int := 0; v_내림 int := 0;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  select count(*) into v_살아
    from job_posts where source = p_source and not hidden and not hold and not admin_locked;

  select count(*) into v_걸린것
    from job_posts where source = p_source and not hidden and not hold and not admin_locked
                     and id = any(p_본것);

  /* 목록을 제대로 못 받은 날은 아무것도 안 합니다 */
  if v_본것수 < 10 or (v_살아 > 0 and v_걸린것 * 2 < v_살아) then
    return jsonb_build_object(
      '했나', false,
      '왜', '목록을 제대로 못 받은 것 같아 건드리지 않았습니다',
      '받은번호', v_본것수, '살아있음', v_살아, '목록에걸린것', v_걸린것);
  end if;

  /* 목록에 있는 것 — 연속 셈을 0 으로 */
  update job_posts
     set gone_streak = 0, seen_on = v_오늘
   where source = p_source and not hidden and not hold and not admin_locked
     and id = any(p_본것)
     and (coalesce(gone_streak, 0) <> 0 or seen_on is distinct from v_오늘);
  get diagnostics v_되돌림 = row_count;

  /* 목록에 없는 것 — 연속 셈을 하나 올립니다 */
  update job_posts
     set gone_streak = least(coalesce(gone_streak, 0) + 1, 9), seen_on = v_오늘
   where source = p_source and not hidden and not hold and not admin_locked
     and not (id = any(p_본것));
  get diagnostics v_빠짐 = row_count;

  /* 두 번 연속이면 내립니다.
     자료는 지우지 않습니다 — 통계와 경쟁률에 그대로 씁니다 (방침) */
  perform set_config('app.누가', '정찰 · 목록에서 빠짐', true);
  update job_posts
     set hidden = true, hold = false,
         hidden_why = '병원이 내림', hidden_on = v_오늘
   where source = p_source and not hidden and not hold and not admin_locked
     and coalesce(gone_streak, 0) >= 2;
  get diagnostics v_내림 = row_count;

  return jsonb_build_object(
    '했나', true, '받은번호', v_본것수, '살아있음', v_살아, '목록에걸린것', v_걸린것,
    '다시보임', v_되돌림, '이번에빠짐', v_빠짐, '두번연속이라내림', v_내림,
    '기준일', v_오늘);
end $$;


ALTER FUNCTION public."목록빠짐표시"(p_secret text, p_source text, "p_본것" text[]) OWNER TO postgres;

--
-- Name: 묶은것(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."묶은것"(p_page integer DEFAULT 0) RETURNS TABLE("연결한줄" text, "연결한출처" text, "연결한제목" text, "연결한직군" text, "남긴줄" text, "남긴출처" text, "남긴제목" text, "남긴직군" text, "기관" text, "왜" text, "묶은날" date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.id 연결한줄, b.source 연결한출처, b.title 연결한제목, b.job_group 연결한직군,
         a.id 남긴줄, a.source 남긴출처, a.title 남긴제목, a.job_group 남긴직군,
         coalesce(a.org_name, b.org_name) 기관, b.hidden_why 왜, b.hidden_on 묶은날
    from job_posts b
    left join job_posts a on a.id = b.같은공고
   where is_admin() and b.같은공고 is not null
   order by b.hidden_on desc nulls last, b.id
   limit 100 offset greatest(coalesce(p_page, 0), 0) * 100
$$;


ALTER FUNCTION public."묶은것"(p_page integer) OWNER TO postgres;

--
-- Name: 묶을후보(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."묶을후보"(p_page integer DEFAULT 0) RETURNS TABLE("왼쪽" text, "오른쪽" text, "기관" text, "왼쪽출처" text, "왼쪽제목" text, "왼쪽직군" text, "왼쪽링크" text, "왼쪽올린날" date, "오른쪽출처" text, "오른쪽제목" text, "오른쪽직군" text, "오른쪽링크" text, "오른쪽올린날" date, "마감" date, "직군다름" boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /* ── 대표(남길 쪽) 고르는 차례 ────────────────────────────
     ① **우리 직군 인원**이 적힌 쪽. 통합 인원만 있는 쪽은 대표가 될 수 없습니다
     ② 마감일이 있는 쪽 (둘 다 있으면 다음으로)
     ③ 채워진 칸이 많은 쪽 — 고용형태 · 인원 · 경력 · 학력
     ※ 화면이 보여주기만 하고, 누를지는 관리자가 정합니다 */
  with 산것 as (
    select id, source, org_name, 견줄이름(org_name) as 이름키,
           title, job_group, url, posted_at, apply_to
      from job_posts
     where not hidden and not hold and 같은공고 is null
       and (apply_to is null or apply_to >= (now() at time zone 'Asia/Seoul')::date)
  ),
  짝 as (
    select a.id 왼쪽, b.id 오른쪽, a.org_name 기관,
           a.source 왼쪽출처, a.title 왼쪽제목, a.job_group 왼쪽직군,
           a.url 왼쪽링크, a.posted_at 왼쪽올린날,
           b.source 오른쪽출처, b.title 오른쪽제목, b.job_group 오른쪽직군,
           b.url 오른쪽링크, b.posted_at 오른쪽올린날,
           coalesce(a.apply_to, b.apply_to) 마감,
           coalesce(a.job_group, '') <> coalesce(b.job_group, '') 직군다름
      from 산것 a join 산것 b
        on a.이름키 = b.이름키
       and a.이름키 <> ''
       and a.source <> b.source
       and a.id < b.id
       /* ★ 직군이 다르면 절대 후보가 아닙니다 (2026-10-07 세중님 결정) */
       and coalesce(a.job_group, '?') = coalesce(b.job_group, '?')
       /* 마감일이 같거나, 한쪽이 비어 있으면 (비어 있는 쪽이 물려받을 자리입니다) */
       and (a.apply_to is not distinct from b.apply_to
            or a.apply_to is null or b.apply_to is null)
       /* 올린 날이 보름 안에 있어야 같은 공고로 봅니다 */
       and abs(coalesce(a.posted_at, (now() at time zone 'Asia/Seoul')::date)
             - coalesce(b.posted_at, (now() at time zone 'Asia/Seoul')::date)) <= 14
  )
  select p.* from 짝 p
   where is_admin()
     and not exists (
       select 1 from 묶지않음 x where x.왼쪽 = p.왼쪽 and x.오른쪽 = p.오른쪽
     )
   order by p.기관, p.왼쪽
   limit 100 offset greatest(coalesce(p_page, 0), 0) * 100
$$;


ALTER FUNCTION public."묶을후보"(p_page integer) OWNER TO postgres;

--
-- Name: 묶지않기(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."묶지않기"("p_왼쪽" text, "p_오른쪽" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare a text; b text;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if coalesce(p_왼쪽,'') = '' or coalesce(p_오른쪽,'') = '' or p_왼쪽 = p_오른쪽 then
    raise exception '짝이 아닙니다' using errcode = '22023';
  end if;
  a := least(p_왼쪽, p_오른쪽); b := greatest(p_왼쪽, p_오른쪽);
  insert into 묶지않음 (왼쪽, 오른쪽) values (a, b)
    on conflict (왼쪽, 오른쪽) do nothing;
  return jsonb_build_object('success', true, '왼쪽', a, '오른쪽', b);
end $$;


ALTER FUNCTION public."묶지않기"("p_왼쪽" text, "p_오른쪽" text) OWNER TO postgres;

--
-- Name: 묶지않음되돌리기(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."묶지않음되돌리기"("p_왼쪽" text, "p_오른쪽" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  /* 짝을 늘 (작은 id, 큰 id) 로 맞춰 찾습니다 — 누른 차례와 무관합니다 */
  delete from 묶지않음
   where 왼쪽 = least(p_왼쪽, p_오른쪽) and 오른쪽 = greatest(p_왼쪽, p_오른쪽);
  get diagnostics n = row_count;
  return jsonb_build_object('되돌린줄', n);
end $$;


ALTER FUNCTION public."묶지않음되돌리기"("p_왼쪽" text, "p_오른쪽" text) OWNER TO postgres;

--
-- Name: 묶지않음목록(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."묶지않음목록"(p_page integer DEFAULT 0) RETURNS TABLE("왼쪽" text, "오른쪽" text, "정한때" timestamp with time zone, "왼쪽출처" text, "왼쪽제목" text, "오른쪽출처" text, "오른쪽제목" text, "기관" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select x.왼쪽, x.오른쪽, x.정한때,
         a.source, a.title, b.source, b.title,
         coalesce(a.org_name, b.org_name)
    from 묶지않음 x
    left join job_posts a on a.id = x.왼쪽
    left join job_posts b on b.id = x.오른쪽
   where is_admin()
   order by x.정한때 desc
   limit 100 offset greatest(coalesce(p_page, 0), 0) * 100
$$;


ALTER FUNCTION public."묶지않음목록"(p_page integer) OWNER TO postgres;

--
-- Name: 묶지않음수(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."묶지않음수"() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select case when is_admin() then (select count(*)::int from 묶지않음) else 0 end $$;


ALTER FUNCTION public."묶지않음수"() OWNER TO postgres;

--
-- Name: 민간2층종별(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."민간2층종별"("p_종별" text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_종별, '') in ('한방병원', '요양병원', '치과병원', '병원', '정신병원')
  /* 안 B 로 뒤집으려면 이 함수 대신 호출부에서 갈래를 함께 봐야 합니다 —
     일층병원_구멍() 의 `민간2층인가` 자리에 주석으로 적어 두었습니다 */
$$;


ALTER FUNCTION public."민간2층종별"("p_종별" text) OWNER TO postgres;

--
-- Name: 밤정리(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."밤정리"(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_오늘   date := (now() at time zone 'Asia/Seoul')::date;
  v_이용   int := 0; v_이름 int := 0; v_이름남 int := 0;
  v_채팅   int := 0; v_신고 int := 0; v_접속 int := 0;
  v_판정   int := 0; v_사진 int := 0; v_신고남 int := 0;
  v_공고   jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  delete from job_events where created_at < now() - interval '90 days';
  get diagnostics v_이용 = row_count;

  update erased_accounts
     set 이름암호 = null, 이름지문 = null, 이름지운때 = now()
   where 이름암호 is not null
     and erased_at < now() - interval '30 days'
     and not 신고걸렸나(profile_id);
  get diagnostics v_이름 = row_count;

  select count(*) into v_이름남 from erased_accounts
   where 이름암호 is not null and erased_at < now() - interval '30 days';

  update chat_messages m
     set image_path = null, image_thumb_path = null
   where (m.image_path is not null or m.image_thumb_path is not null)
     and m.created_at < now() - interval '30 days'
     and not "신고걸린방"(m.room_id);
  get diagnostics v_사진 = row_count;

  delete from chat_messages m
   where m.created_at < now() - interval '1 year'
     and not "신고걸린방"(m.room_id);
  get diagnostics v_채팅 = row_count;

  select count(*) into v_신고남 from chat_messages m
   where m.created_at < now() - interval '1 year' and "신고걸린방"(m.room_id);

  delete from reports where handled_at is not null and handled_at < now() - interval '1 year';
  get diagnostics v_신고 = row_count;

  delete from 개인정보접속기록 where 언제 < now() - interval '1 year';
  get diagnostics v_접속 = row_count;

  delete from 수집판정 where 판정때 < now() - interval '180 days';
  get diagnostics v_판정 = row_count;

  v_공고 := hide_stale_posts(30, 180);

  return jsonb_build_object(
    '이용 기록 지움(3개월)', v_이용, '탈퇴 이름 파기(30일)', v_이름,
    '신고 처리 중이라 남긴 이름', v_이름남, '대화 사진 지움(30일)', v_사진,
    '채팅 글 지움(1년)', v_채팅, '신고 처리 중이라 남긴 대화', v_신고남,
    '신고 기록 지움(처리 1년)', v_신고, '관리자 접속기록 지움(1년)', v_접속,
    '순찰 기억 지움(180일)', v_판정, '공고 옮김', v_공고, '기준일', v_오늘);
end $$;


ALTER FUNCTION public."밤정리"(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: 방묶음(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."방묶음"("p_방" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_방
    when 'free'   then 'all'   when 'life'  then 'all'
    when 'love'   then 'all'   when 'edurv' then 'all'
    when 'used'   then 'all'
    when 'clinic' then 'pro'   when 'pay'   then 'pro'
    when 'move'   then 'pro'   when 'itv'   then 'pro'
    when 'cert'   then 'pro'   when 'biz'   then 'pro'
    when 'exam'   then 'stu'   when 'prac'  then 'stu'
    when 'grade'  then 'stu'   when 'first' then 'stu'
    when 'campus' then 'stu'   when 'path'  then 'stu'
    else 'all' end
$$;


ALTER FUNCTION public."방묶음"("p_방" text) OWNER TO postgres;

--
-- Name: 방볼수있나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."방볼수있나"("p_방" text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case 방묶음(p_방)
    when 'stu' then coalesce(
      (select p.role = '학생' from profiles p where p.id = auth.uid()), false)
    else true end
$$;


ALTER FUNCTION public."방볼수있나"("p_방" text) OWNER TO postgres;

--
-- Name: 방에쓸수있나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."방에쓸수있나"("p_방" text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((
    select case 방묶음(p_방)
      when 'stu' then p.role = '학생'
      when 'pro' then p.role = '현직'
      else p.role in ('현직','학생') end
      from profiles p where p.id = auth.uid()
  ), false)
$$;


ALTER FUNCTION public."방에쓸수있나"("p_방" text) OWNER TO postgres;

--
-- Name: 법인앞말떼기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."법인앞말떼기"(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(btrim(regexp_replace(
    coalesce(v, ''),
    '^\s*\(?\s*(의료법인|재단법인|사회복지법인|학교법인|학교법인\)|사단법인|의료재단)\s*\)?\s*',
    '', 'g')), '')
$$;


ALTER FUNCTION public."법인앞말떼기"(v text) OWNER TO postgres;

--
-- Name: 보낼알림(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."보낼알림"(p_secret text, "p_하루상한" integer DEFAULT 3, "p_몇개" integer DEFAULT 100) RETURNS TABLE("기기id" bigint, "어떻게" text, "주소" text, "열쇠1" text, "열쇠2" text, "갈래" text, "공고id" text, "제목" text, "기관" text, "마감" date)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_지금 timestamptz := now();
        v_시 int := extract(hour from (v_지금 at time zone 'Asia/Seoul'));
        v_오늘 date := (v_지금 at time zone 'Asia/Seoul')::date;
begin
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  if v_시 >= 22 or v_시 < 7 then
    return;
  end if;

  return query
  with 기기 as (
    select d.id, d.profile_id, d.어떻게, d.주소, d.열쇠1, d.열쇠2, d.구독한때
      from 알림기기 d
      join profiles p on p.id = d.profile_id
     where d.켜짐
       and p.erased_at is null
       and d.연속실패 < 3
  ),
  오늘보낸수 as (
    select s.기기id, count(*) n
      from 알림보낸것 s
     where s.보낸때 >= (date_trunc('day', v_지금 at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
     group by 1
  ),
  여유있는기기 as (
    select k.*, coalesce(o.n, 0) 오늘
      from 기기 k left join 오늘보낸수 o on o.기기id = k.id
     where coalesce(o.n, 0) < greatest(p_하루상한, 0)
  ),
  새공고 as (
    select k.id 기기id, k.어떻게, k.주소, k.열쇠1, k.열쇠2,
           '새공고'::text 갈래, j.id 공고id, j.title 제목, j.org_name 기관, j.apply_to 마감,
           j.db_insert_at 때
      from 여유있는기기 k
      join org_stars t on t.profile_id = k.profile_id and t.notify
      join job_posts j on j.org_name = t.org_name
     where not j.hidden and not j.hold
       and j.db_insert_at > k.구독한때
       and (j.apply_to is null or j.apply_to >= v_오늘)
  ),
  마감임박 as (
    select k.id 기기id, k.어떻게, k.주소, k.열쇠1, k.열쇠2,
           '마감임박'::text 갈래, j.id 공고id, j.title 제목, j.org_name 기관, j.apply_to 마감,
           j.apply_to::timestamptz 때
      from 여유있는기기 k
      join job_stars f on f.profile_id = k.profile_id
      join job_posts j on j.id = f.job_id
     where not j.hidden and not j.hold
       and j.apply_to is not null
       and j.apply_to between v_오늘 and (v_오늘 + 3)
  ),
  새교육 as (
    /* ★ 기준일 — 올린날이 있으면 올린날, 없으면 **접수 시작일** (2026-10-05).
       한국보바스협회처럼 글 올린 날을 안 적는 곳이 있습니다. 둘 다 없으면
       보내지 않습니다 — 날짜를 짐작해 쏘면 묵은 교육이 한꺼번에 나갑니다 */
    select k.id 기기id, k.어떻게, k.주소, k.열쇠1, k.열쇠2,
           '새교육'::text 갈래, e.번호 공고id, e.제목, e.출처 기관, e.끝 마감,
           coalesce(e.올린날, e.접수시작)::timestamptz 때
      from 여유있는기기 k
      join 교육기관알림 t on t.회원 = k.profile_id
      join 교육기관 g on g.이름 = t.기관 and g.보임 and g.모음
      join 교육 e on e.출처 = g.이름
     where coalesce(e.올린날, e.접수시작) is not null
       and coalesce(e.올린날, e.접수시작)
             > (greatest(k.구독한때, t.켠때) at time zone 'Asia/Seoul')::date
       and (e.끝 is null or e.끝 >= v_오늘)
       and coalesce(e.상태, '모름') <> '접수마감'
  ),
  다 as (select * from 새공고
         union all select * from 마감임박
         union all select * from 새교육)
  select d.기기id, d.어떻게, d.주소, d.열쇠1, d.열쇠2, d.갈래, d.공고id, d.제목, d.기관, d.마감
    from 다 d
   where not exists (
     select 1 from 알림보낸것 s
      where s.기기id = d.기기id and s.갈래 = d.갈래 and s.공고id = d.공고id
   )
   order by d.때 desc
   limit greatest(p_몇개, 0);
end $$;


ALTER FUNCTION public."보낼알림"(p_secret text, "p_하루상한" integer, "p_몇개" integer) OWNER TO postgres;

--
-- Name: 보류함마감정리(boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."보류함마감정리"("p_정말" boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_셀것 int; v_치운것 int := 0;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;

  select count(*) into v_셀것 from job_posts
   where hold and not hidden and not admin_locked
     and apply_to is not null and apply_to < v_오늘;

  if not p_정말 then
    return jsonb_build_object('셀것', v_셀것, '치운것', 0, '정말했나', false, '기준일', v_오늘);
  end if;

  perform set_config('app.누가', '관리자 보류함 정리', true);
  update job_posts
     set hold = false, hidden = true,
         hidden_why = '보류함 정리(마감 지남)', hidden_on = v_오늘
   where hold and not hidden and not admin_locked
     and apply_to is not null and apply_to < v_오늘;
  get diagnostics v_치운것 = row_count;

  return jsonb_build_object('셀것', v_셀것, '치운것', v_치운것, '정말했나', true, '기준일', v_오늘);
end $$;


ALTER FUNCTION public."보류함마감정리"("p_정말" boolean) OWNER TO postgres;

--
-- Name: 본체만뽑나(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."본체만뽑나"(p_org text, p_title text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_org,'') ~
           '(공단|공사|개발원|평가원|진흥원|관리원|교육청|적십자사|복지부|사업단|연구원)'
     and not 근무지이름있나(p_org, p_title)
$$;


ALTER FUNCTION public."본체만뽑나"(p_org text, p_title text) OWNER TO postgres;

--
-- Name: 봉사담기(text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."봉사담기"(p_secret text, "p_처" jsonb, "p_모집" jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_처수 int := 0; v_모집수 int := 0;
begin
  if not exists (select 1 from collect_secret s where s.source = 'VMS' and s.secret = p_secret) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_처 is not null and jsonb_typeof(p_처) = 'array' then
    insert into 봉사처 (기관코드, 이름, 시도, 분야, 주소, 시군구, 전화, 우편번호, 세운날, updated_at)
    select x.기관코드, x.이름, x.시도, x.분야, x.주소, x.시군구, x.전화, x.우편번호,
           nullif(x.세운날, '')::date, now()
    from jsonb_to_recordset(p_처) as x(기관코드 text, 이름 text, 시도 text, 분야 text,
      주소 text, 시군구 text, 전화 text, 우편번호 text, 세운날 text)
    where x.기관코드 is not null and x.기관코드 <> '' and x.이름 is not null
    on conflict (기관코드) do update set
      이름 = excluded.이름, 시도 = excluded.시도, 분야 = excluded.분야,
      주소 = excluded.주소, 시군구 = excluded.시군구, 전화 = excluded.전화,
      우편번호 = excluded.우편번호, 세운날 = excluded.세운날, updated_at = now();
    v_처수 := (select count(*) from jsonb_array_elements(p_처));
  end if;
  if p_모집 is not null and jsonb_typeof(p_모집) = 'array' then
    insert into 봉사모집 (번호, 제목, 기관, 모집한곳, 기관코드, 시도, 시군구, 장소,
      분야, 갈래, 활동종류, 기간, 상태, 모집인원, 신청인원, 청소년, 올린날, 주소, updated_at)
    select x.번호, x.제목, x.기관, x.모집한곳, x.기관코드, x.시도, x.시군구, x.장소, x.분야,
           case when x.분야 is null or x.분야 = '' then '모름'
                when x.분야 in ('노인복지시설','장애인복지시설','아동복지시설',
                  '청소년복지시설','여성복지시설','노숙인복지시설','정신요양시설',
                  '사회복지관','보건의료','사회복지분야 법인/단체') then '복지·보건'
                else '기타' end,
           x.활동종류, x.기간, x.상태, x.모집인원, x.신청인원,
           coalesce(x.청소년, false), nullif(x.올린날, '')::date, x.주소, now()
    from jsonb_to_recordset(p_모집) as x(번호 bigint, 제목 text, 기관 text, 모집한곳 text,
      기관코드 text, 시도 text, 시군구 text, 장소 text, 분야 text, 활동종류 text,
      기간 text, 상태 text, 모집인원 int, 신청인원 int, 청소년 boolean, 올린날 text, 주소 text)
    where x.번호 is not null and x.제목 is not null and x.제목 <> ''
    on conflict (번호) do update set
      제목 = excluded.제목, 기관 = excluded.기관, 모집한곳 = excluded.모집한곳,
      기관코드 = excluded.기관코드, 시도 = excluded.시도, 시군구 = excluded.시군구,
      장소 = excluded.장소, 분야 = excluded.분야, 갈래 = excluded.갈래,
      활동종류 = excluded.활동종류, 기간 = excluded.기간, 상태 = excluded.상태,
      모집인원 = excluded.모집인원, 신청인원 = excluded.신청인원,
      청소년 = excluded.청소년, 올린날 = excluded.올린날, 주소 = excluded.주소,
      updated_at = now();
    v_모집수 := (select count(*) from jsonb_array_elements(p_모집));
  end if;
  return jsonb_build_object('처', v_처수, '모집', v_모집수);
end $$;


ALTER FUNCTION public."봉사담기"(p_secret text, "p_처" jsonb, "p_모집" jsonb) OWNER TO postgres;

--
-- Name: 봉사목록(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."봉사목록"("p_갈래" text DEFAULT NULL::text, "p_시도" text DEFAULT NULL::text, "p_상태" text DEFAULT '모집중'::text, p_page integer DEFAULT 0) RETURNS TABLE("번호" bigint, "제목" text, "기관" text, "시도" text, "시군구" text, "장소" text, "분야" text, "갈래" text, "활동종류" text, "기간" text, "상태" text, "모집인원" integer, "신청인원" integer, "청소년" boolean, "올린날" date, "주소" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select v.번호, v.제목, coalesce(v.모집한곳, v.기관), v.시도, v.시군구, v.장소,
         v.분야, v.갈래, v.활동종류, v.기간, v.상태,
         v.모집인원, v.신청인원, v.청소년, v.올린날, v.주소
  from 봉사모집 v
  where (p_시도 is null or v.시도 = p_시도)
    and (p_상태 is null or v.상태 = p_상태)
    and (p_갈래 is null or p_갈래 = '전체' or v.갈래 = p_갈래)
  order by v.올린날 desc nulls last, v.번호 desc
  limit 20 offset greatest(0, coalesce(p_page, 0)) * 20
$$;


ALTER FUNCTION public."봉사목록"("p_갈래" text, "p_시도" text, "p_상태" text, p_page integer) OWNER TO postgres;

--
-- Name: 봉사셈(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."봉사셈"("p_시도" text DEFAULT NULL::text, "p_상태" text DEFAULT '모집중'::text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    '전체', count(*),
    '복지·보건', count(*) filter (where 갈래 = '복지·보건'),
    '기타', count(*) filter (where 갈래 = '기타'),
    '모름', count(*) filter (where 갈래 = '모름'),
    '시도들', (select coalesce(jsonb_agg(jsonb_build_object('시도', 시도, '수', n) order by n desc), '[]'::jsonb)
      from (select 시도, count(*) as n from 봉사모집
            where (p_상태 is null or 상태 = p_상태) and 시도 is not null group by 시도) t),
    '마지막수집', (select max(updated_at) from 봉사모집))
  from 봉사모집
  where (p_시도 is null or 시도 = p_시도) and (p_상태 is null or 상태 = p_상태)
$$;


ALTER FUNCTION public."봉사셈"("p_시도" text, "p_상태" text) OWNER TO postgres;

--
-- Name: 빈칸공고(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."빈칸공고"("p_직군" text DEFAULT NULL::text, p_page integer DEFAULT 0) RETURNS TABLE(id text, org_name text, title text, job_group text, apply_to date, source text, "빈칸" text[], "뽑은때" timestamp with time zone, "잠긴칸" text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 볼것 as (
    select j.*,
           array_remove(array[
             case when j.headcount is null
                   and coalesce(j."뽑은값"->>'모집인원','') = '' then '모집인원' end,
             case when j.apply_to is null then '접수마감' end,
             case when coalesce(j.work_place,'') = ''
                   and coalesce(j."뽑은값"->>'근무지','') = '' then '근무지' end,
             case when coalesce(j.detail->>'지원자격','') = ''
                   and coalesce(j."뽑은값"->>'지원자격','') = '' then '지원자격' end,
             case when coalesce(j.detail->>'연봉','') = ''
                   and coalesce(j."뽑은값"->>'예상연봉','') = '' then '예상연봉' end
           ], null) as 빈칸
      from job_posts j
     where is_admin()
       and not j.hidden and not j.hold
       and (p_직군 is null or j.job_group = p_직군)
  )
  select v.id, v.org_name, coalesce(v."보여줄제목", v.title), v.job_group,
         v.apply_to, v.source, v.빈칸, v."뽑은때", v.edited_fields
    from 볼것 v
   where array_length(v.빈칸, 1) > 0
   order by array_length(v.빈칸, 1) desc, v.apply_to nulls last, v.id
   limit 50 offset greatest(0, coalesce(p_page, 0)) * 50
$$;


ALTER FUNCTION public."빈칸공고"("p_직군" text, p_page integer) OWNER TO postgres;

--
-- Name: 빈칸채우기(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."빈칸채우기"("p_공고" text, "p_칸" text, "p_값" text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501'; end if;
  if p_칸 not in ('모집인원','근무지','지원자격','예상연봉') then
    raise exception '모르는 칸입니다 (%)', p_칸 using errcode = '22023'; end if;

  /* ★ updated_at 을 안 바꿉니다 (지침 9절). 알림·다리가 그 값을 봅니다 */
  update job_posts
     set "뽑은값" = coalesce("뽑은값", '{}'::jsonb) || jsonb_build_object(p_칸, p_값),
         "뽑은법" = '관리자',
         "뽑은때" = now(),
         edited_fields = (select array_agg(distinct x)
                            from unnest(edited_fields || array[p_칸]) x)
   where id = p_공고;
  return true;
end $$;


ALTER FUNCTION public."빈칸채우기"("p_공고" text, "p_칸" text, "p_값" text) OWNER TO postgres;

--
-- Name: 상세건너뛸공고(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."상세건너뛸공고"(p_secret text, p_source text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret
                    and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.job_id, '직군', coalesce(t.직군, ''))), '[]'::jsonb)
    into v
    from (
      select b.job_id, max(p.job_group) as 직군
        from job_body b
        join job_posts p on p.id = b.job_id
       where b.source = p_source
         and b.taken_at > now() - interval '20 hours'
         and length(b.body) > 200
         /* ★ 메뉴뿐인 본문은 건너뛰지 않습니다 — 「치료사」가 없습니다 */
         and b.body ~ '(물리|작업|도수)[^가-힣]{0,6}치료[[:space:]]*(사|직|선생)'
       group by b.job_id
    ) t;
  return jsonb_build_object(
    '건너뛸것', v,
    '수', jsonb_array_length(v),
    '※', '오늘(20시간 안) 쓸 만한 본문을 이미 받은 공고입니다 — 보류함 것도 들어갑니다.'
         || ' 수집기가 상세를 다시 안 열고, 아는 직군이 있으면 그대로 씁니다.'
         || ' 본문이 비었거나 메뉴뿐이면 여기 없어서 매 바퀴 엽니다'
  );
end
$$;


ALTER FUNCTION public."상세건너뛸공고"(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: 새공고마름(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."새공고마름"() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_마지막 timestamptz;
  v_업무시간 int;
  v_기준 int := 6;
begin
  select max(db_insert_at) into v_마지막
    from job_posts
   where coalesce(시험자료, false) = false and source <> 'BIZ';

  if v_마지막 is null then
    return jsonb_build_object('마름', false, '왜', '견줄 것이 없습니다');
  end if;

  select count(*) into v_업무시간
    from generate_series(
           date_trunc('hour', v_마지막 at time zone 'Asia/Seoul') + interval '1 hour',
           date_trunc('hour', now()      at time zone 'Asia/Seoul'),
           interval '1 hour') h
   where extract(dow from h) between 1 and 5
     and h::date not in (select 날 from 공휴일)
     and extract(hour from h) between 9 and 21;

  return jsonb_build_object(
    '마름', v_업무시간 >= v_기준,
    '업무시간', v_업무시간,
    '기준', v_기준,
    '마지막새공고', v_마지막,
    '몇시간째', round(extract(epoch from (now() - v_마지막)) / 3600.0, 1));
end
$$;


ALTER FUNCTION public."새공고마름"() OWNER TO postgres;

--
-- Name: FUNCTION "새공고마름"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."새공고마름"() IS '평일 업무시간으로 세어 새 공고가 N시간 안 들어왔나. 주말·공휴일은 안 셉니다';


--
-- Name: 수시인가(text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."수시인가"(p_title text, p_detail jsonb, "p_제목말" text, "p_칸말" text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_title, '') ~ p_제목말
      or concat_ws(' ',
           p_detail->>'일정', p_detail->>'접수방법',
           p_detail->>'지원자격', p_detail->>'전형방법') ~ p_칸말;
$$;


ALTER FUNCTION public."수시인가"(p_title text, p_detail jsonb, "p_제목말" text, "p_칸말" text) OWNER TO postgres;

--
-- Name: FUNCTION "수시인가"(p_title text, p_detail jsonb, "p_제목말" text, "p_칸말" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."수시인가"(p_title text, p_detail jsonb, "p_제목말" text, "p_칸말" text) IS '제목과 상세 칸에서 「수시·상시」 표시를 찾습니다 (2026-09-28)';


--
-- Name: 수집기박동(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."수집기박동"() RETURNS TABLE("수집기" text, "지난24시간" bigint, "7일 하루평균" numeric, "알림선(평균의 절반)" numeric, "잰 날수" integer, "빨간줄" boolean, "왜" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 이제 as (select now() as t),
  창 as (
    select (t - interval '24 hours') as 창시작, t as 창끝,
           ((t - interval '24 hours') at time zone 'Asia/Seoul')::date as 어제,
           (t at time zone 'Asia/Seoul')::date as 오늘
      from 이제
  ),
  쉬나 as (
    select (쉬는날인가(어제) or 쉬는날인가(오늘)) as 쉬는날끼었나,
           case when 쉬는날인가(어제) and 쉬는날인가(오늘)
                  then to_char(어제,'MM/DD') || '·' || to_char(오늘,'MM/DD')
                when 쉬는날인가(어제) then to_char(어제,'MM/DD')
                when 쉬는날인가(오늘) then to_char(오늘,'MM/DD')
                else '' end as 쉰날
      from 창
  ),
  하루 as (
    select source, count(*) as 건
      from job_posts, 창
     where db_insert_at >= 창시작
     group by 1
  ),
  이레날별 as (
    select source, (db_insert_at at time zone 'Asia/Seoul')::date as 날, count(*) as 건
      from job_posts, 이제
     where db_insert_at >= t - interval '8 days' and db_insert_at < t - interval '24 hours'
     group by 1, 2
  ),
  이레 as (
    /* ★ 평균은 **일하는 날만**. 주말이 섞이면 기준이 물러집니다 */
    select source, round(avg(건), 1) as 평균, count(*)::int as 날수
      from 이레날별 where not 쉬는날인가(날) group by 1
  ),
  모든수집기 as (
    select distinct source from job_posts
     where db_insert_at >= (select t from 이제) - interval '8 days'
  )
  select m.source,
         coalesce(h.건, 0),
         coalesce(w.평균, 0),
         round(coalesce(w.평균, 0) * 0.5, 1),
         coalesce(w.날수, 0),
         (not (select 쉬는날끼었나 from 쉬나)
          and coalesce(w.날수, 0) >= 3
          and coalesce(h.건, 0) < coalesce(w.평균, 0) * 0.5),
         case
           when (select 쉬는날끼었나 from 쉬나)
             then '쉬는 날(' || (select 쉰날 from 쉬나) || ')이 끼어 판단을 미룹니다 — 24시간 '
                  || coalesce(h.건, 0) || '건'
           when coalesce(w.날수, 0) < 3
             then '아직 일하는 날 ' || coalesce(w.날수, 0) || '일치밖에 없어 판단을 미룹니다'
           when coalesce(h.건, 0) < coalesce(w.평균, 0) * 0.5
             then '지난 24시간 ' || coalesce(h.건, 0) || '건 — 일하는 날 하루 '
                  || coalesce(w.평균, 0) || '건의 절반(' || round(coalesce(w.평균,0)*0.5,1) || ')보다 적습니다'
           else '들어오고 있습니다 (24시간 ' || coalesce(h.건, 0)
                || '건 · 일하는 날 하루 ' || coalesce(w.평균, 0) || '건)'
         end
    from 모든수집기 m
    left join 하루 h on h.source = m.source
    left join 이레 w on w.source = m.source
   order by 6 desc, 3 desc;
$$;


ALTER FUNCTION public."수집기박동"() OWNER TO postgres;

--
-- Name: 쉬는날인가(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."쉬는날인가"(d date) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select extract(isodow from d) >= 6 or exists (select 1 from 공휴일 h where h.날 = d)
$$;


ALTER FUNCTION public."쉬는날인가"(d date) OWNER TO postgres;

--
-- Name: 시험자료볼까(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."시험자료볼까"() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select case
    /* ★ 2026-10-28 세중님 ㉡ — **역할도 봅니다.** 마스터 계정이 회원 역할을
       쓰고 있으면 시험 자료를 **안 보여 줍니다** (「회원처럼 보기」가 참이 되게).
       울타리를 맨 앞에 둔 까닭 — 마스터 계정이 admins 에도 있어서 is_admin() 이
       참입니다. 뒤에 두면 안 듣습니다 (2026-10-28 확인) */
    when "마스터인가"() and coalesce("마스터역할"(), '관리자')
         in ('학생', '작업치료사', '물리치료사', '비회원') then false
    else is_admin() or "마스터인가"() end $$;


ALTER FUNCTION public."시험자료볼까"() OWNER TO postgres;

--
-- Name: 시험자료치우기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."시험자료치우기"() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare j jsonb := '{}'::jsonb; n int;
begin
  if not 대표인가() then
    raise exception '대표만 치울 수 있습니다' using errcode = '42501';
  end if;

  delete from 교육리뷰답글 where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('교육리뷰답글', n);
  delete from 교육리뷰     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('교육리뷰', n);
  delete from 교육신청     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('교육신청', n);
  delete from 교육회차     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('교육회차', n);
  delete from 교육과정     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('교육과정', n);
  delete from 인증자료열람 where 자료id in (select id from 인증자료 where 시험자료);
  get diagnostics n = row_count; j := j || jsonb_build_object('인증자료열람', n);
  delete from 인증자료     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('인증자료', n);
  delete from 회원자격     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('회원자격', n);
  delete from 재직인증     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('재직인증', n);
  delete from 알림함       where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('알림함', n);
  delete from 운영진글     where 시험자료;   get diagnostics n = row_count;
  j := j || jsonb_build_object('운영진글', n);
  delete from chat_messages where room_id in (select id from chat_rooms where 시험자료);
  get diagnostics n = row_count; j := j || jsonb_build_object('대화글', n);
  delete from chat_members  where room_id in (select id from chat_rooms where 시험자료);
  get diagnostics n = row_count; j := j || jsonb_build_object('대화참여', n);
  delete from chat_rooms    where 시험자료; get diagnostics n = row_count;
  j := j || jsonb_build_object('대화방', n);
  delete from comments where post_id in (select id from posts where 시험자료);
  get diagnostics n = row_count; j := j || jsonb_build_object('댓글', n);
  delete from posts        where 시험자료;  get diagnostics n = row_count;
  j := j || jsonb_build_object('글', n);

  /* ★ 2026-10-11 — 공고첨부 를 **job_posts 보다 먼저** 지웁니다.
     공고첨부_공고id_fkey 는 NO ACTION 이라 함께 안 지워집니다 —
     안 지우면 아래 job_posts 삭제가 외래키에서 멈춥니다 (승인대기 ⑩) */
  delete from 공고첨부 where 공고id in (select id from job_posts where 시험자료);
  get diagnostics n = row_count; j := j || jsonb_build_object('공고첨부', n);

  /* 2026-10-09 보탬 — 담당자가 올린 시험 공고.
     딸린 표 여덟(공고신고·공고올림·job_attachments·job_events·job_hides·
     job_post_edits·job_stars)은 on delete cascade 라 함께 지워집니다.
     page_hits · job_state_log 는 외래키가 없어 남습니다 — 기록이라 일부러 둡니다 */
  delete from job_posts    where 시험자료;  get diagnostics n = row_count;
  j := j || jsonb_build_object('공고', n);

  return j;
end $$;


ALTER FUNCTION public."시험자료치우기"() OWNER TO postgres;

--
-- Name: 신고걸렸나(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."신고걸렸나"(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from reports r
     where r.handled_at is null
       and ((r.target_type = 'post'    and r.target_id in (select id from posts    where author_id = p_id))
         or (r.target_type = 'comment' and r.target_id in (select id from comments where author_id = p_id)))
  );
$$;


ALTER FUNCTION public."신고걸렸나"(p_id uuid) OWNER TO postgres;

--
-- Name: 신고걸린방(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."신고걸린방"(p_room bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from reports r
     where r.handled_at is null
       and ((r.target_type = 'chat_room' and r.target_id = p_room)
         or (r.target_type = 'chat'
             and r.target_id in (select m.id from chat_messages m where m.room_id = p_room))))
$$;


ALTER FUNCTION public."신고걸린방"(p_room bigint) OWNER TO postgres;

--
-- Name: 신청가능교육(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."신청가능교육"("p_직군" text DEFAULT NULL::text, "p_지난것" boolean DEFAULT false) RETURNS TABLE("회차id" bigint, "과정id" bigint, "제목" text, "직군" text, "주최" text, "시작" date, "끝" date, "장소" text, "정원" integer, "확정수" integer, "접수시작" date, "접수끝" date, "수강료" integer, "상태" text, "별점" numeric, "리뷰수" integer, "시험자료" boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.회차id, c.과정id, c.제목, c.직군,
         coalesce(c.교육기관, (select p.nickname from profiles p where p.id = c.강사)),
         s.시작, s.끝, s.장소, s.정원,
         (select count(*)::int from 교육신청 a where a.회차id = s.회차id and a.상태 = '참여확정'),
         s.접수시작, s.접수끝, s.수강료, s.상태,
         (select round(avg(r.별점), 1) from 교육리뷰 r where r.회차id = s.회차id and not r.숨김),
         (select count(*)::int from 교육리뷰 r where r.회차id = s.회차id and not r.숨김),
         s.시험자료
    from 교육회차 s join 교육과정 c on c.과정id = s.과정id
   where not c.숨김
     and (not s.시험자료 or 시험자료볼까())
     and (p_직군 is null or c.직군 = p_직군)
     and (coalesce(p_지난것, false) or s.상태 <> '끝남')
   order by (s.상태 = '모집중') desc, s.시작
$$;


ALTER FUNCTION public."신청가능교육"("p_직군" text, "p_지난것" boolean) OWNER TO postgres;

--
-- Name: 심평원받을곳(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."심평원받을곳"(p_secret text, p_source text, "p_연월" text) RETURNS TABLE(ykiho text, "기관명" text, "종별" text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_연월 !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '연월은 YYYY-MM 꼴이어야 합니다';
  end if;
  return query
    select o.ykiho, o.yadm_nm, o.cl_cd_nm
      from hira_org o
     where o.ykiho is not null
       and (
         o.cl_cd_nm in ('상급종합', '종합병원')
         or o.yadm_nm like '%대학병원%'
         or exists (select 1 from public_hospitals p
                     where replace(p.name, ' ', '') = replace(o.yadm_nm, ' ', ''))
       )
       and not exists (select 1 from 심평원인원월별 m
                        where m.ykiho = o.ykiho and m.연월 = p_연월)
     order by o.yadm_nm;
end $_$;


ALTER FUNCTION public."심평원받을곳"(p_secret text, p_source text, "p_연월" text) OWNER TO postgres;

--
-- Name: 심평원인원담기(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."심평원인원담기"(p_secret text, p_source text, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare n int;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  if jsonb_array_length(p_rows) > 300 then
    raise exception '한 번에 300줄까지입니다';
  end if;
  insert into 심평원인원월별 (ykiho, 연월, 기관명, 종별, 물리, 작업, 받은때)
  select e->>'ykiho', e->>'연월', e->>'기관명', e->>'종별',
         nullif(e->>'물리', '')::int, nullif(e->>'작업', '')::int, now()
    from jsonb_array_elements(p_rows) e
   where coalesce(e->>'ykiho', '') <> ''
     and coalesce(e->>'연월', '') ~ '^[0-9]{4}-[0-9]{2}$'
  on conflict (ykiho, 연월) do update
     set 기관명 = excluded.기관명, 종별 = excluded.종별,
         물리 = excluded.물리, 작업 = excluded.작업, 받은때 = excluded.받은때;
  get diagnostics n = row_count;
  return n;
end $_$;


ALTER FUNCTION public."심평원인원담기"(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: 아직산공고인가(date, time without time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone DEFAULT NULL::time without time zone) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select p_apply_to is null or not 마감지났나(p_apply_to, p_apply_to_time)
$$;


ALTER FUNCTION public."아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone) OWNER TO postgres;

--
-- Name: 안읽은알림(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."안읽은알림"() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int from 알림함
   where profile_id = auth.uid() and 읽은때 is null
     and (not 시험자료 or 시험자료볼까())
$$;


ALTER FUNCTION public."안읽은알림"() OWNER TO postgres;

--
-- Name: 알리오자리같음목록(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."알리오자리같음목록"(p_secret text, p_source text) RETURNS SETOF text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret
                    and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return query select "묶음키" from "알리오자리같음";
end $$;


ALTER FUNCTION public."알리오자리같음목록"(p_secret text, p_source text) OWNER TO postgres;

--
-- Name: 알림기기끄기(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."알림기기끄기"("p_주소" text, "p_어떻게" text DEFAULT 'webpush'::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if auth.uid() is null then
    raise exception '로그인해야 합니다' using errcode = '42501';
  end if;
  update 알림기기
     set 켜짐 = false, 꺼진때 = now(), 꺼진까닭 = '회원이 껐습니다'
   where profile_id = auth.uid() and 주소 = p_주소 and 어떻게 = coalesce(p_어떻게, 'webpush');
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION public."알림기기끄기"("p_주소" text, "p_어떻게" text) OWNER TO postgres;

--
-- Name: 알림기기등록(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."알림기기등록"("p_주소" text, "p_열쇠1" text, "p_열쇠2" text, "p_어떻게" text DEFAULT 'webpush'::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id bigint;
begin
  if auth.uid() is null then
    raise exception '로그인해야 합니다' using errcode = '42501';
  end if;
  if coalesce(p_주소, '') = '' then
    raise exception '주소가 없습니다' using errcode = '22023';
  end if;
  insert into 알림기기 (profile_id, 어떻게, 주소, 열쇠1, 열쇠2, 켜짐, 구독한때, 연속실패, 꺼진때, 꺼진까닭)
  values (auth.uid(), coalesce(p_어떻게, 'webpush'), p_주소, p_열쇠1, p_열쇠2, true, now(), 0, null, null)
  on conflict (어떻게, 주소) do update
     set 열쇠1 = excluded.열쇠1, 열쇠2 = excluded.열쇠2,
         켜짐 = true, 구독한때 = now(), 연속실패 = 0, 꺼진때 = null, 꺼진까닭 = null
   /* 남의 기기를 가로채지 못하게 — 주인이 나일 때만 고칩니다 */
   where 알림기기.profile_id = auth.uid()
  returning id into v_id;
  if v_id is null then
    raise exception '이미 다른 분의 기기로 등록된 주소입니다' using errcode = '42501';
  end if;
  return v_id;
end $$;


ALTER FUNCTION public."알림기기등록"("p_주소" text, "p_열쇠1" text, "p_열쇠2" text, "p_어떻게" text) OWNER TO postgres;

--
-- Name: 알림넣기(uuid, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."알림넣기"("p_누구" uuid, "p_갈래" text, "p_제목" text, "p_본문" text DEFAULT NULL::text, "p_링크" text DEFAULT NULL::text, "p_시험" boolean DEFAULT false) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id bigint;
begin
  insert into 알림함 (profile_id, 갈래, 제목, 본문, 링크, 시험자료)
  values (p_누구, p_갈래, p_제목, p_본문, p_링크, coalesce(p_시험, false))
  returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION public."알림넣기"("p_누구" uuid, "p_갈래" text, "p_제목" text, "p_본문" text, "p_링크" text, "p_시험" boolean) OWNER TO postgres;

--
-- Name: 알림보낸것남기기(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."알림보낸것남기기"(p_secret text, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if not exists (select 1 from collect_secret s
                  where s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception '한 번에 500줄까지입니다';
  end if;

  insert into 알림보낸것 (기기id, 갈래, 공고id, 보낸때, 결과)
  select (e->>'기기id')::bigint, e->>'갈래', e->>'공고id', now(), e->>'결과'
    from jsonb_array_elements(p_rows) e
   where coalesce(e->>'기기id','') <> '' and coalesce(e->>'공고id','') <> ''
  on conflict (기기id, 갈래, 공고id) do nothing;
  get diagnostics n = row_count;

  update 알림기기 d
     set 켜짐 = false, 꺼진때 = now(), 꺼진까닭 = '보내는 쪽이 사라진 기기라고 했습니다'
    from jsonb_array_elements(p_rows) e
   where d.id = (e->>'기기id')::bigint and e->>'결과' = 'gone';

  update 알림기기 d
     set 연속실패 = d.연속실패 + 1
    from jsonb_array_elements(p_rows) e
   where d.id = (e->>'기기id')::bigint
     and coalesce(e->>'결과','') not in ('ok', 'gone', '');

  update 알림기기 d
     set 연속실패 = 0, 마지막성공 = now()
    from jsonb_array_elements(p_rows) e
   where d.id = (e->>'기기id')::bigint and e->>'결과' = 'ok';

  return n;
end $$;


ALTER FUNCTION public."알림보낸것남기기"(p_secret text, p_rows jsonb) OWNER TO postgres;

--
-- Name: 알림읽음(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."알림읽음"(p_id bigint DEFAULT NULL::bigint) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  update 알림함 set 읽은때 = now()
   where profile_id = auth.uid() and 읽은때 is null
     and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION public."알림읽음"(p_id bigint) OWNER TO postgres;

--
-- Name: 애플끊기적기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."애플끊기적기"("p_결과" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  update erased_accounts
     set "애플끊기" = left(coalesce("p_결과", ''), 200), "애플끊은때" = now()
   where profile_id = auth.uid() and "애플끊기" is null;
  if not found then
    /* 탈퇴 줄이 아직 없을 수 있습니다 (끊기를 먼저 부르므로) — 자리를 만들어 둡니다 */
    insert into erased_accounts (profile_id, joined_at, erased_at, "애플끊기", "애플끊은때")
    values (auth.uid(), now(), now(), left(coalesce("p_결과", ''), 200), now())
    on conflict (profile_id) do update
      set "애플끊기" = coalesce(erased_accounts."애플끊기", excluded."애플끊기"),
          "애플끊은때" = coalesce(erased_accounts."애플끊은때", excluded."애플끊은때");
  end if;
  return jsonb_build_object('됨', true);
end $$;


ALTER FUNCTION public."애플끊기적기"("p_결과" text) OWNER TO postgres;

--
-- Name: 애플연결끊음(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."애플연결끊음"() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  update "애플연결" set "토큰" = null, "끊은때" = now() where profile_id = auth.uid();
  return jsonb_build_object('됨', true);
end $$;


ALTER FUNCTION public."애플연결끊음"() OWNER TO postgres;

--
-- Name: 애플연결저장(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."애플연결저장"("p_토큰" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if coalesce(btrim("p_토큰"), '') = '' then return jsonb_build_object('됨', false, '왜', '토큰이 비었습니다'); end if;
  insert into "애플연결" (profile_id, "토큰", "넣은때", "끊은때")
  values (auth.uid(), "p_토큰", now(), null)
  on conflict (profile_id) do update
    set "토큰" = excluded."토큰", "넣은때" = now(), "끊은때" = null;
  return jsonb_build_object('됨', true);
end $$;


ALTER FUNCTION public."애플연결저장"("p_토큰" text) OWNER TO postgres;

--
-- Name: 여러병원거느린곳(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."여러병원거느린곳"("p_기관" text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  /* 목록은 **여기 한 자리**입니다. 늘릴 때는 실제 데이터를 먼저 세고 늘립니다 */
  select 견줄이름(coalesce(p_기관, '')) in (
    견줄이름('한국보훈복지의료공단'),
    견줄이름('근로복지공단'),
    견줄이름('경상국립대학교병원')
  )
$$;


ALTER FUNCTION public."여러병원거느린곳"("p_기관" text) OWNER TO postgres;

--
-- Name: 열린창구(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."열린창구"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with f as (
    select p.oid, p.proname, p.prosrc, pg_get_function_result(p.oid) as 결과,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as 이름
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and has_function_privilege('anon', p.oid, 'execute')
  ), g as (
    select 이름, case
      when 결과 = 'trigger'                then '트리거'
      when prosrc ilike '%collect_secret%' then '수집기창구'
      when prosrc !~* '\m(from|join|insert|update)\M' then '순수계산'
      when proname like 'admin!_%' escape '!' then '검토'
      when proname in ('save_my_survey','닉네임쓸수있나','닉네임잡혔나','in_room') then '검토'
      else '비회원화면' end as 갈래
      from f
  ), t as (
    select c.relname as 이름,
           case when has_table_privilege('anon', c.oid, 'insert')
                  or has_table_privilege('anon', c.oid, 'update')
                  or has_table_privilege('anon', c.oid, 'delete')
                then '쓰기까지' else '읽기만' end as 갈래
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v','m','p')
       and (has_table_privilege('anon', c.oid,'select') or has_table_privilege('anon', c.oid,'insert')
         or has_table_privilege('anon', c.oid,'update') or has_table_privilege('anon', c.oid,'delete'))
  )
  select jsonb_build_object(
    '함수', coalesce((select jsonb_agg(jsonb_build_object('이름', 이름, '갈래', 갈래) order by 이름) from g), '[]'::jsonb),
    '표',   coalesce((select jsonb_agg(jsonb_build_object('이름', 이름, '갈래', 갈래) order by 이름) from t), '[]'::jsonb))
$$;


ALTER FUNCTION public."열린창구"() OWNER TO postgres;

--
-- Name: 열린창구_역할(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."열린창구_역할"("p_역할" text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with f as (
    select p.oid, p.proname, p.prosrc, pg_get_function_result(p.oid) as 결과,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as 이름
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and has_function_privilege(p_역할, p.oid, 'execute')
  ), g as (
    select 이름,
      case
        when 결과 = 'trigger'                 then '트리거'
        when prosrc ilike '%collect_secret%'  then '수집기창구'
        when prosrc ~ 'is_admin\(\)'          then '관리자창구'
        when prosrc ~ 'auth\.uid\(\)'         then '회원창구'
        when prosrc !~* '\m(from|join|insert|update|delete|perform)\M' then '순수계산'
        when proname like 'admin!_%' escape '!' then '검토'
        when proname in ('save_my_survey','닉네임쓸수있나','닉네임잡혔나','in_room') then '검토'
        when p_역할 = 'anon'                  then '비회원화면'
        else '검토'
      end as 갈래,
      case
        when prosrc ilike '%collect_secret%' then 'collect_secret'
        when prosrc ~ 'is_admin\(\)'         then 'is_admin'
        when prosrc ~ 'auth\.uid\(\)'        then 'auth.uid'
        else '없음'
      end as 검사글자,
      (prosrc ~* '\m(insert|update|delete|perform)\M') as 쓰기낌새,
      nullif(concat_ws(' · ',
        case when prosrc ~ '\mjob_posts\M' then 'job_posts' end,
        case when prosrc ~ '\mprofiles\M'  then 'profiles'  end), '') as 닿는표
      from f
  ), t as (
    select c.relname as 이름,
           case when has_table_privilege(p_역할, c.oid, 'insert')
                  or has_table_privilege(p_역할, c.oid, 'update')
                  or has_table_privilege(p_역할, c.oid, 'delete')
                then '쓰기까지' else '읽기만' end as 갈래
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v','m','p')
       and (has_table_privilege(p_역할, c.oid,'select') or has_table_privilege(p_역할, c.oid,'insert')
         or has_table_privilege(p_역할, c.oid,'update') or has_table_privilege(p_역할, c.oid,'delete'))
  )
  select jsonb_build_object(
    '역할', p_역할,
    '갈래는참고일뿐', '허용 목록은 갈래와 상관없이 이름 전부로 둡니다. '
      || '검사글자는 「글자가 있다」는 뜻이고 막는다는 뜻이 아닙니다',
    '함수', coalesce((select jsonb_agg(jsonb_build_object(
              '이름', 이름, '갈래', 갈래, '검사글자', 검사글자,
              '쓰기낌새', 쓰기낌새, '닿는표', 닿는표) order by 이름) from g), '[]'::jsonb),
    '먼저볼것', coalesce((select jsonb_agg(이름 order by 이름) from g
                 where 검사글자 = '없음' and 쓰기낌새 and 갈래 <> '트리거'), '[]'::jsonb),
    '표',   coalesce((select jsonb_agg(jsonb_build_object('이름', 이름, '갈래', 갈래) order by 이름) from t), '[]'::jsonb))
$$;


ALTER FUNCTION public."열린창구_역할"("p_역할" text) OWNER TO postgres;

--
-- Name: 요청헤더확인(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."요청헤더확인"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with h as (
    select coalesce(nullif(current_setting('request.headers', true), '')::jsonb,
                    '{}'::jsonb) as j
  )
  select jsonb_build_object(
    '헤더가 읽히나', (select j <> '{}'::jsonb from h),
    'x-who 있나',    (select j ? 'x-who' from h),
    'x-who 값',      (select j->>'x-who' from h),
    '지금 역할',     current_setting('role', true))
$$;


ALTER FUNCTION public."요청헤더확인"() OWNER TO postgres;

--
-- Name: 운영진글남기기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."운영진글남기기"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_역할 text;
begin
  select m.지금역할 into v_역할
    from 마스터페르소나 m where m.auth_id = new.author_id;
  if v_역할 is null then return null; end if;

  insert into 운영진글 (갈래, 글번호, 쓴역할)
  values (tg_argv[0], new.id, v_역할)
  on conflict (갈래, 글번호) do nothing;

  return null;
end $$;


ALTER FUNCTION public."운영진글남기기"() OWNER TO postgres;

--
-- Name: 워크넷고용형태풀기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."워크넷고용형태풀기"() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_전 int; v_푼것 int; v_뒤 int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;

  select count(*) into v_전 from job_posts where employ_type ~ '^[0-9]+$';

  update job_posts
     set employ_type = case employ_type
           when '10' then '정규직'
           when '11' then '정규직(시간선택제)'
           when '20' then '기간제'
           when '21' then '기간제(시간선택제)'
         end,
         updated_at = now()
   where employ_type in ('10', '11', '20', '21');
  get diagnostics v_푼것 = row_count;

  select count(*) into v_뒤 from job_posts where employ_type ~ '^[0-9]+$';

  return jsonb_build_object(
    '고치기전_숫자로남은줄', v_전,
    '푼줄', v_푼것,
    '고친뒤_숫자로남은줄', v_뒤);
end $_$;


ALTER FUNCTION public."워크넷고용형태풀기"() OWNER TO postgres;

--
-- Name: 원문없어짐까닭(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."원문없어짐까닭"() RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  /* 옛 글귀 「병원이 내림」 을 함께 둡니다 — 이미 적힌 줄을 고치지 않기 때문입니다 */
  select array['원문이 없어짐', '병원이 내림']::text[]
$$;


ALTER FUNCTION public."원문없어짐까닭"() OWNER TO postgres;

--
-- Name: 원문없어짐까닭말(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."원문없어짐까닭말"() RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$ select '원문이 없어짐'::text $$;


ALTER FUNCTION public."원문없어짐까닭말"() OWNER TO postgres;

--
-- Name: 인증자료올림(bigint, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."인증자료올림"("p_자격id" bigint, "p_갈래" text, "p_경로" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_id bigint;
begin
  if not exists (select 1 from 회원자격 where id = p_자격id and profile_id = v) then
    raise exception '내 신청이 아닙니다' using errcode = '42501';
  end if;
  insert into 인증자료 (profile_id, 자격id, 갈래, 경로)
  values (v, p_자격id, p_갈래, p_경로) returning id into v_id;
  return jsonb_build_object('자료id', v_id);
end $$;


ALTER FUNCTION public."인증자료올림"("p_자격id" bigint, "p_갈래" text, "p_경로" text) OWNER TO postgres;

--
-- Name: 일곱칸찬수(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."일곱칸찬수"(p_id text) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select (case when j.headcount is not null
                 or coalesce(j."뽑은값"->>'모집인원', j.detail->>'직군인원') is not null then 1 else 0 end)
       + (case when j.apply_to is not null then 1 else 0 end)
       + (case when j.apply_to_time is not null then 1 else 0 end)
       + (case when coalesce(nullif(j.work_place, ''), j.sido) is not null then 1 else 0 end)
       + (case when coalesce(j."뽑은값"->>'지원자격', j.detail->'뽑은값'->>'지원자격',
                             j.detail->>'지원자격') is not null then 1 else 0 end)
       + (case when coalesce(j."뽑은값"->>'예상연봉', j.detail->'뽑은값'->>'예상연봉',
                             j.detail->>'연봉') is not null then 1 else 0 end)
       + (case when exists (select 1 from job_body b where b.job_id = j.id) then 1 else 0 end)
    from job_posts j where j.id = p_id
$$;


ALTER FUNCTION public."일곱칸찬수"(p_id text) OWNER TO postgres;

--
-- Name: 일층병원_구멍(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."일층병원_구멍"() RETURNS TABLE("갈래" text, "종류" text, "기관" text, "시도" text, "시군구" text, "상태" text, "출처" text, "우리직군" integer)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 대상0 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t.kind, t."갈래", t.sido, t.sgg
      from org_targets t
     where t."커버리지분모"
       and t."갈래" in ('공공보건의료', '보건기관', '상급종합', '대학병원', '종합병원')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 when '보건기관' then 4 else 5 end
  ), 공공이름 as (
    /* 공공은 종별 무관으로 1층입니다 — 갈래로 찍지 않고 **같은 이름이 공공
       갈래에 있는지**로 가립니다 (CLAUDE.md 1층 기준) */
    select distinct "견줄이름"(t.name) as k from org_targets t
     where t."커버리지분모" and t."갈래" in ('공공보건의료', '보건기관')
  ), 종별 as (
    /* ★ hira_org 는 **79,874줄**입니다. 전체에 "견줄이름"() 을 걸면 아침 메일이
       statement timeout 으로 ① 숫자를 통째로 못 받습니다 (2026-10-18 에 그랬습니다).
       그래서 ① **name_key 인덱스**(hira_org_name_key)를 쓰고
            ② **종합병원 갈래만** 찾습니다 — 대학병원 갈래는 `org_targets.kind` 에
               이미 심평원 종별이 들어 있습니다(한방 11·병원 5·요양 2·치과 1).
               종합병원 갈래의 kind 는 전부 '종합병원' 이라(선한병원도) 거기만
               조인이 필요합니다.
       ★★ **같은 이름 기관이 전국에 여럿입니다** — 「우리들병원」·「강남병원」·
       「온누리병원」·「참조은병원」·「대동병원」은 심평원에 여러 줄이 있고 종별이
       갈립니다. `distinct on` 으로 한 줄을 고르면 **정렬 순서에 따라 다른 종별**이
       나옵니다 (2026-10-18 에 name_key 정렬과 "견줄이름"() 정렬이 5곳에서 서로
       다른 종별을 집는 것을 봤습니다). 그래서 **종별이 갈리는 이름은 빼지
       않습니다** — 어느 기관인지 모르면 짐작하지 않고 분모에 남깁니다 (지침 10-3). */
    select o.name_key as k,
           min(o.cl_cd_nm) as cl_cd_nm,
           count(distinct o.cl_cd_nm) as 갈림
      from hira_org o
     where o.name_key in (select d.k from 대상0 d where d."갈래" = '종합병원')
     group by o.name_key
  ), 대상 as (
    select d.k, d.name, d.kind, d."갈래", d.sido, d.sgg
      from 대상0 d
      left join 공공이름 g on g.k = d.k
      left join 종별 z on z.k = d.k
     where g.k is not null          -- 공공이면 종별 무관으로 남깁니다
        or not (
             /* ★ **대학병원 갈래에서는 종별「병원」을 빼지 않습니다** (2026-10-19 세중님 결정).
                CLAUDE.md 1층 기준 3 — 「이름에 대학병원이 들어가면 종별 무관」.
                해당하는 다섯 곳 — 대구보건대학교병원 · 동아대학교대신병원 ·
                계명대학교 경주동산병원 · 강남을지대학교병원 · 건양대학교부여병원.
                대구보건대는 2026-10-18 에 설정을 넣고 공고가 1건 들어왔습니다 —
                분모에서 빼면 우리가 긁는 1층 기관을 「대상 아님」으로 만듭니다.
                한방·요양·치과·정신은 대학병원이라도 다른 과 전문이라 2층입니다.
                종합·상급은 심평원 종별을 그대로 봅니다 (선한병원 꼴 · 지침 10-3). */
             (d."갈래" = '대학병원'
              and d.kind in ('한방병원', '요양병원', '치과병원', '정신병원'))
          or (d."갈래" in ('상급종합', '종합병원') and z.갈림 = 1 and "민간2층종별"(z.cl_cd_nm))
        )
  ), 묶음 as (
    /* 보건기관만 시군구 하나로 묶습니다 — 보건지소는 상위 보건소에 딸립니다 */
    select d.*,
           case when d."갈래" = '보건기관'
                then '보건기관|' || coalesce(d.sido, '') || '|' || coalesce(d.sgg, '')
                else d.k end as g
      from 대상 d
  ), 대표 as (
    select distinct on (m.g)
           m.g, m.name, m.kind, m."갈래", m.sido, m.sgg
      from 묶음 m
     order by m.g,
              case when m.name ~ '보건의료원' then 1
                   when m.name ~ '보건소' then 2 else 3 end,
              m.name
  ), 긁는곳 as (
    /* ★ 2026-10-19 — **못 긁는 줄은 사이트로 안 봅니다.**
       주소가 없으면 수집기가 열 데가 없고, 끈 줄은 일부러 안 긁는 것입니다.
       그런 줄을 「사이트있음」 으로 세면 ① 에서 조용히 빠집니다 —
       빛고을전남대·전북대가 그렇게 빠져 있었습니다 (공고 0건).
       공고가 들어오는 곳은 아래 `들어온곳` 이 받으니 셈이 틀어지지 않습니다 */
    /* ★ 2026-10-22 밤 — **API 꼴은 주소가 없어도 긁는 곳입니다.**
       주소가 빈 줄 17곳은 전부 appsite·schmc·listjson 꼴이고, 그 꼴은
       주소가 아니라 **호스트+번호로 API 를 부릅니다** — 부산대 23건 ·
       분당서울대 19건 · 부민 9 · 용인세브란스 8 · 아주대 7 · 길병원 7 ·
       전남대 5 … 로 **잘 들어오고 있습니다**. 그런데 「주소 없음」이라
       사각지대로 세어 ① 숫자가 그만큼 부풀었습니다 (17곳).
       0건인 둘(전북대·빛고을전남대)도 **긁고는 있고** 우리 직군 공고가
       없을 뿐입니다 — 2026-10-19 에 그 둘을 보고 고친 것이 과했습니다. */
    select s."이름열쇠" as k from hosp_sites s
     where (nullif(s.url, '') is not null
            or s.kind in ('appsite', 'schmc', 'listjson', 'cmc', 'greeting'))
       and not coalesce(s."끔", false)
    union
    select "견줄이름"(v) from (values
      ('강동경희대학교병원'),
      ('연세대학교의과대학세브란스병원'),
      ('연세대학교의과대학 강남세브란스병원'),
      ('고려대학교의과대학부속구로병원'),
      ('고려대학교의과대학부속안산병원'),
      ('학교법인 고려중앙학원 고려대학교의과대학부속병원(안암병원)'),
      ('재단법인아산사회복지재단 서울아산병원'),
      ('학교법인성균관대학삼성창원병원'),
      ('한양대학교병원'),
      ('양산부산대학교병원'),
      ('조선대학교병원'),
      ('계명대학교 경주동산병원'),
      ('차의과학대학교분당차병원'),
      ('차의과학대학교부속구미차병원'),
      ('의료법인성광의료재단일산차병원')
    ) as c(v)
  ), 들어온곳 as (
    select j."이름열쇠" as k,
           string_agg(distinct j.source, ',' order by j.source) as 출처,
           count(*) filter (where j.job_group in ('작업치료사', '물리치료사', '공통'))::int as 우리직군
      from job_posts j
     where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 180
     group by 1
  ), 묶은상태 as (
    select m.g,
           bool_or(gg.k is not null) as 사이트,
           bool_or(ii.k is not null) as 들어옴,
           string_agg(distinct ii."출처", ',') as 출처,
           coalesce(sum(ii."우리직군"), 0)::int as 우리직군
      from 묶음 m
      left join 긁는곳 gg on gg.k = m.k
      left join 들어온곳 ii on ii.k = m.k
     group by m.g
  )
  select r."갈래", r.kind, r.name, r.sido, r.sgg,
         case when s.사이트 then '사이트있음'
              when s.들어옴 then '공고만들어옴'
              else '사각지대' end,
         s."출처", s."우리직군"
    from 대표 r
    join 묶은상태 s on s.g = r.g
   order by case when s.사이트 then 3 when s.들어옴 then 2 else 1 end,
            case r."갈래" when '상급종합' then 1 when '대학병원' then 2
                          when '공공보건의료' then 3 when '보건기관' then 4 else 5 end,
            r.name
$$;


ALTER FUNCTION public."일층병원_구멍"() OWNER TO postgres;

--
-- Name: 일층병원_구멍셈(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."일층병원_구멍셈"() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 공공이름 as (
    select distinct "견줄이름"(name) as k from org_targets
     where "갈래" in ('공공보건의료', '보건기관')
  ), g as (
    select x.*, (c.k is not null) as 공공인가
      from "일층병원_구멍"() x
      left join 공공이름 c on c.k = "견줄이름"(x."기관")
  )
  select jsonb_build_object(
    '대상', (select count(*) from g),
    '사각지대', (select count(*) from g where "상태" = '사각지대'),
    '사이트있음', (select count(*) from g where "상태" = '사이트있음'),
    '공고만들어옴', (select count(*) from g where "상태" = '공고만들어옴'),
    '공공', (select jsonb_build_object(
               '대상', count(*),
               '사각지대', count(*) filter (where "상태" = '사각지대'),
               '사이트있음', count(*) filter (where "상태" = '사이트있음'),
               '공고만들어옴', count(*) filter (where "상태" = '공고만들어옴'))
             from g where 공공인가),
    '민간', (select jsonb_build_object(
               '대상', count(*),
               '사각지대', count(*) filter (where "상태" = '사각지대'),
               '사이트있음', count(*) filter (where "상태" = '사이트있음'),
               '공고만들어옴', count(*) filter (where "상태" = '공고만들어옴'))
             from g where not 공공인가),
    '보건소', (select jsonb_build_object(
                 '대상', count(*),
                 '사각지대', count(*) filter (where "상태" = '사각지대'),
                 '사이트있음', count(*) filter (where "상태" = '사이트있음'),
                 '공고만들어옴', count(*) filter (where "상태" = '공고만들어옴'),
                 '묶음', '보건지소·진료소는 상위 보건소 한 곳으로 셉니다')
               from g where "갈래" = '보건기관'),
    '사각_상급종합', (select coalesce(jsonb_agg("기관" order by "기관"), '[]'::jsonb)
                       from g where "상태" = '사각지대' and "갈래" = '상급종합'),
    '사각_갈래별', (select coalesce(jsonb_object_agg("갈래", n), '{}'::jsonb)
                      from (select "갈래", count(*) as n from g
                             where "상태" = '사각지대' group by 1) z)
  )
$$;


ALTER FUNCTION public."일층병원_구멍셈"() OWNER TO postgres;

--
-- Name: 일층병원_뺀것(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."일층병원_뺀것"() RETURNS TABLE("갈래" text, "종별" text, "기관" text, "긁는곳인가" boolean, "최근180일공고" integer)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 대상0 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t."갈래", t.kind
      from org_targets t
     where t."커버리지분모"
       and t."갈래" in ('공공보건의료', '보건기관', '상급종합', '대학병원', '종합병원')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 when '보건기관' then 4 else 5 end
  ), 공공이름 as (
    select distinct "견줄이름"(t.name) as k from org_targets t
     where t."커버리지분모" and t."갈래" in ('공공보건의료', '보건기관')
  ), 종별 as (
    /* 위와 같습니다 — name_key 인덱스 · 종별이 갈리는 이름은 빼지 않습니다 */
    select o.name_key as k, min(o.cl_cd_nm) as cl_cd_nm,
           count(distinct o.cl_cd_nm) as 갈림
      from hira_org o
     where o.name_key in (select d.k from 대상0 d where d."갈래" = '종합병원')
     group by o.name_key
  ), 긁는곳 as (
    select "견줄이름"(s.name) as k from hosp_sites s
  ), 들어온곳 as (
    select "견줄이름"(j.org_name) as k, count(*)::int as 공고
      from job_posts j
     where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 180
     group by 1
  )
  select d."갈래", coalesce(z.cl_cd_nm, d.kind), d.name,
         (gg.k is not null), coalesce(ii.공고, 0)
    from 대상0 d
    left join 공공이름 g on g.k = d.k
    left join 종별 z on z.k = d.k
    left join 긁는곳 gg on gg.k = d.k
    left join 들어온곳 ii on ii.k = d.k
   where g.k is null
     and ((d."갈래" = '대학병원'
           and d.kind in ('한방병원', '요양병원', '치과병원', '정신병원'))
       or (d."갈래" in ('상급종합', '종합병원') and z.갈림 = 1 and "민간2층종별"(z.cl_cd_nm)))
   order by coalesce(z.cl_cd_nm, d.kind), d.name
$$;


ALTER FUNCTION public."일층병원_뺀것"() OWNER TO postgres;

--
-- Name: FUNCTION "일층병원_뺀것"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."일층병원_뺀것"() IS '1층 분모에서 민간 2층이라 뺀 줄 (종별 한방·요양·치과·병원·정신). 숫자가 왜 줄었나를 물을 수 있게 (2026-10-18)';


--
-- Name: 있는번호(text, text, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."있는번호"(p_secret text, p_source text, p_ids text[]) RETURNS TABLE(id text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;
  /* 한 번에 너무 많이 묻지 못하게 막습니다 */
  if array_length(p_ids, 1) > 500 then
    raise exception '번호는 한 번에 500개까지입니다';
  end if;
  return query
    select j.id from job_posts j where j.id = any(p_ids);
end $$;


ALTER FUNCTION public."있는번호"(p_secret text, p_source text, p_ids text[]) OWNER TO postgres;

--
-- Name: 잡힌닉네임막기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."잡힌닉네임막기"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  /* 탈퇴 처리로 들어가는 「지운계정-…」 은 건너뜁니다 */
  if new.nickname like '지운계정-%' then
    return new;
  end if;
  if tg_op = 'UPDATE' and 닉네임다듬기(new.nickname) = 닉네임다듬기(old.nickname) then
    return new;
  end if;
  if 닉네임잡혔나(new.nickname) then
    raise exception '최근에 쓰이던 닉네임이라 조금 뒤에 쓸 수 있어요'
      using errcode = '23505';
  end if;
  return new;
end $$;


ALTER FUNCTION public."잡힌닉네임막기"() OWNER TO postgres;

--
-- Name: 재직인증됐나(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."재직인증됐나"("p_사람" uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from 재직인증
                  where profile_id = coalesce(p_사람, auth.uid()) and 상태 = '확인')
$$;


ALTER FUNCTION public."재직인증됐나"("p_사람" uuid) OWNER TO postgres;

--
-- Name: 재직인증신청(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."재직인증신청"("p_경로" text, "p_병원" text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_id bigint;
begin
  if v is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  insert into 재직인증 (profile_id, 병원이름, 경로) values (v, p_병원, p_경로)
  returning id into v_id;
  return jsonb_build_object('id', v_id, '상태', '심사중');
end $$;


ALTER FUNCTION public."재직인증신청"("p_경로" text, "p_병원" text) OWNER TO postgres;

--
-- Name: 전남광주가르기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."전남광주가르기"("p_글" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_글,'') ~ '광주|광산구' then '광주'
    when coalesce(p_글,'') ~ ('목포|여수|순천|나주|광양|담양|곡성|구례|고흥|보성|화순|'
                            || '장흥|강진|해남|영암|무안|함평|영광|장성|완도|진도|신안') then '전남'
    else null end
$$;


ALTER FUNCTION public."전남광주가르기"("p_글" text) OWNER TO postgres;

--
-- Name: 접속기록남기기(text, text, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."접속기록남기기"("p_무엇" text, "p_어느표" text, "p_누구것" uuid DEFAULT NULL::uuid, "p_몇명" integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_ip text;
begin
  /* 화면(PostgREST)을 거치면 헤더가 들어옵니다. 직접 SQL 로 부르면 비어 있습니다 */
  begin
    v_ip := coalesce(
      split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1),
      current_setting('request.headers', true)::json ->> 'cf-connecting-ip');
  exception when others then v_ip := null;
  end;

  insert into 개인정보접속기록 (누가, 어디서, 누구것, 몇명, 무엇, 어느표)
  values (auth.uid(), nullif(trim(coalesce(v_ip, '')), ''), p_누구것, p_몇명, p_무엇, p_어느표);
exception when others then
  /* 기록을 못 남겨도 하던 일은 굴러가야 합니다 */
  null;
end $$;


ALTER FUNCTION public."접속기록남기기"("p_무엇" text, "p_어느표" text, "p_누구것" uuid, "p_몇명" integer) OWNER TO postgres;

--
-- Name: 제목글자다듬기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목글자다듬기"(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when btrim(coalesce(v, '')) = '' then null
    /* ★ 떼서 **두 글자 이하**면 원문을 그대로 둡니다 (세중님 C) */
    when length(t."다듬") <= 2 then btrim(v)
    else t."다듬" end
  from (select btrim(regexp_replace(
                 translate(
                   regexp_replace(
                     regexp_replace(
                       regexp_replace(coalesce(v, ''),
                         /* 괄호 속 한자 — 「삼성(杉晟)센텀…」 「계양효(孝)요양원」 */
                         '\(\s*[一-龥]+\s*\)', '', 'g'),
                       /* 법인 표기 — ㈜ 꼴을 목록에 넣었습니다 (세중님 C) */
                       '(주식회사|유한회사|㈜|㈐|\(주\)|\(유\))', '', 'g'),
                     /* 남은 한자 */
                     '[一-龥]', '', 'g'),
                   '[]★※【】◇◆□■○●▲▼〈〉《》', ''),
                 '\s{2,}', ' ', 'g')) as "다듬") t
$$;


ALTER FUNCTION public."제목글자다듬기"(v text) OWNER TO postgres;

--
-- Name: FUNCTION "제목글자다듬기"(v text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."제목글자다듬기"(v text) IS '제목에 쓸 글자에서 괄호 속 한자·한자·기호·법인 표기(㈜)를 떼고 공백 정리. 두 글자 이하가 되면 원문 유지 (2026-10-28 ㉫)';


--
-- Name: 제목기관(public.job_posts); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목기관"(j public.job_posts) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_기관 text;
begin
  select "줄인이름" into v_기관
    from "기관이름줄임" where "원래이름" = j.org_name and "승인했나" limit 1;
  /* ★ 2026-10-28 ㉫ (세중님 C) — 한자·기호·법인 표기를 뗍니다 */
  return "제목글자다듬기"(coalesce(v_기관, "법인앞말떼기"(j.org_name)));
end $$;


ALTER FUNCTION public."제목기관"(j public.job_posts) OWNER TO postgres;

--
-- Name: 제목대체사유(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목대체사유"(p_title text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_title,'') ~ '육아\s*휴직\s*대체|출산/육아휴직\s*대체|육아휴직대체' then '육아휴직대체'
    when coalesce(p_title,'') ~ '대체\s*근로자'  then '대체근로자'
    when coalesce(p_title,'') ~ '대체\s*인력'    then '대체인력'
    else null end
$$;


ALTER FUNCTION public."제목대체사유"(p_title text) OWNER TO postgres;

--
-- Name: 제목만들기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목만들기"(p_id text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select 제목만들기행(j) from job_posts j where j.id = p_id $$;


ALTER FUNCTION public."제목만들기"(p_id text) OWNER TO postgres;

--
-- Name: 제목만들기행(public.job_posts); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목만들기행"(j public.job_posts) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_기관 text; v_산하 text; v_지역 text; v_부서 text; v_직군 text;
  v_분야 text; v_고용 text; v_대체 text; v_조각 text[] := '{}';
begin
  /* ★ 2026-10-14 — 「조교·연구」 자리는 **원문 제목 그대로** (세중님 결정).
     규칙은 조교연구갈래() 한 자리입니다 (지침 6절) */
  if "조교연구갈래"(j.title, j.org_name,
       coalesce((coalesce(j.detail,'{}'::jsonb) - '근거')::text, '') || ' '
       || coalesce((coalesce(j."뽑은값",'{}'::jsonb) - '근거')::text, '')) is not null then
    return j.title;
  end if;

  v_기관 := 제목기관(j);
  v_산하 := 제목산하(j.title, j.org_name);

  /* 지역은 제목에 넣지 않습니다 (2026-10-07 확정).
     그래도 계산하는 까닭 — 기관 이름 앞의 긴 도·광역시 이름을 떼는 데 씁니다 */
  v_지역 := 지역보임(j);
  if v_지역 is not null then
    v_기관 := 지역앞말떼기(split_part(v_지역, ' ', 1), v_기관);
  end if;

  if v_산하 is not null then v_기관 := v_기관 || ' ' || v_산하; end if;

  /* ★ 2026-10-08 — detail->>'부서' 를 먼저 봅니다 (세중님 결정 ㉮) */
  v_부서 := 제목부서(j.title, j.detail->>'부서');
  if v_부서 is not null and v_산하 is not null and v_부서 = v_산하 then v_부서 := null; end if;
  v_직군 := 제목직군(j.job_group);
  /* ★ 2026-10-11 — 부서가 직군과 같으면 뺍니다.
     「바른아동발달연구소 물리치료사 물리치료사 정규직 채용공고」가 나왔습니다 */
  if v_부서 is not null and v_직군 is not null and v_부서 = v_직군 then v_부서 := null; end if;

  /* ★ 2026-10-11 — 분야 낱말을 살립니다 (세중님 결정).
     소아·신경·도수·근골격 같은 말은 회원이 자리를 고르는 기준입니다 */
  v_분야 := 제목분야(j.title);
  if v_분야 is not null and v_부서 is not null and v_부서 like '%' || v_분야 || '%' then
    v_분야 := null;
  end if;
  if v_분야 is not null and v_기관 is not null and v_기관 like '%' || v_분야 || '%' then
    v_분야 := null;
  end if;

  v_고용 := 고용형태보임행(j);
  v_대체 := 제목대체사유(j.title);

  if v_기관 is null or v_직군 is null then return null; end if;

  v_조각 := v_조각 || v_기관::text;
  if v_부서 is not null then v_조각 := v_조각 || v_부서::text; end if;
  if v_분야 is not null then v_조각 := v_조각 || v_분야::text; end if;
  v_조각 := v_조각 || v_직군::text;
  if v_고용 is not null then v_조각 := v_조각 || v_고용::text; end if;
  if v_대체 is not null then v_조각 := v_조각 || v_대체::text; end if;
  v_조각 := v_조각 || '채용공고'::text;

  return array_to_string(v_조각, ' ');
end
$$;


ALTER FUNCTION public."제목만들기행"(j public.job_posts) OWNER TO postgres;

--
-- Name: 제목바꿀만한가(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목바꿀만한가"("p_옛" text, "p_새" text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  with x as (
    select coalesce(p_옛, '') as 옛, coalesce(p_새, '') as 새,
           /* 잘린 꼬리를 뗀 토막 */
           제목속글자(regexp_replace(coalesce(p_옛, ''), '(\.\.\.|…)\s*$', '')) as 토막,
           제목속글자(coalesce(p_새, '')) as 새글자
  )
  select 새 <> ''
     and 옛 ~ '(\.\.\.|…)\s*$'          /* ㉠ 지금 것이 잘려 있어야 합니다 */
     and length(토막) >= 10              /* 토막이 너무 짧으면 아무거나 맞습니다 */
     and 새글자 like 토막 || '%'         /* ㉡ 같은 공고의 제목이어야 합니다 */
     and 새 !~ '(\.\.\.|…)\s*$'          /* 새 것도 잘려 있으면 바꿀 뜻이 없습니다 */
     and length(새글자) >= length(토막)  /* 짧아지는 쪽으로는 안 바꿉니다 */
    from x
$_$;


ALTER FUNCTION public."제목바꿀만한가"("p_옛" text, "p_새" text) OWNER TO postgres;

--
-- Name: FUNCTION "제목바꿀만한가"("p_옛" text, "p_새" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."제목바꿀만한가"("p_옛" text, "p_새" text) IS '잘린 제목을 온전한 제목으로 바꿔도 되는지 — 잘려 있고, 새 것이 그 토막으로 시작하고, 더 길 때만 (2026-10-19)';


--
-- Name: 제목부서(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목부서"(p_title text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(btrim((
    select m[1] from regexp_matches(coalesce(p_title,''),
      '([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|재활의학과|의학팀|파트|지원팀))') m
     limit 1)), '')
  $$;


ALTER FUNCTION public."제목부서"(p_title text) OWNER TO postgres;

--
-- Name: 제목부서(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목부서"(p_title text, "p_부서" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(
    nullif(btrim(coalesce("p_부서", '')), ''),      -- ① 사람·AI 가 넣은 부서가 있으면 그것
    제목부서(p_title)                                -- ② 없으면 제목에서 뽑습니다
  )
$$;


ALTER FUNCTION public."제목부서"(p_title text, "p_부서" text) OWNER TO postgres;

--
-- Name: 제목분야(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목분야"(p_title text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  /* 「치료」 바로 앞에 붙은 분야 낱말만 집습니다. 기관 이름에 든
     「재활요양원」·「노인복지센터」는 분야가 아니라 기관이라 안 집힙니다 */
  select (regexp_match(coalesce(p_title, ''),
    '(소아|아동|성인|노인|신경|근골격|정형|도수|스포츠|심장|호흡|연하|인지|산재|방문|가정|특수)[^가-힣]{0,2}(?:물리|작업)?치료'))[1]
$$;


ALTER FUNCTION public."제목분야"(p_title text) OWNER TO postgres;

--
-- Name: 제목산하(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목산하"(p_title text, p_org text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
declare v text;
begin
  /* 앞의 꺾쇠 — [행복한요양원 분당점] · [구포] · [서울병원] */
  v := (select m[1] from regexp_matches(coalesce(p_title,''), '^\s*\[([^\]]{1,20})\]') m limit 1);
  if v is null then
    /* 꺾쇠가 없으면 제목 맨 앞의 「…병원」 — 경인권역재활병원 */
    v := (select m[1] from regexp_matches(coalesce(p_title,''),
            '^\s*([가-힣]{2,12}(?:병원|의료원|센터))\s') m limit 1);
  end if;
  if v is null then
    /* 2026-10-28 ㉧ — **제목 어디에 있든** 산하 기관말을 찾습니다.
       「2026년 대구광역시 중구 치매안심센터 시간선택제…」 꼴입니다 (지침 10-3) */
    v := (select m[1] from regexp_matches(coalesce(p_title,''),
            '([가-힣]{0,10}(?:치매안심센터|치매센터|보건의료원|보건지소|보건소))') m limit 1);
  end if;
  /* ★ 2026-10-28 ㉫ (세중님 C) — 한자·기호·법인 표기를 먼저 뗍니다.
     그래야 「계양효(孝)요양원 **계양효요양원** …」 처럼 같은 말이 두 번 안 적힙니다 */
  v := btrim(coalesce("제목글자다듬기"(v), ''));
  if v = '' then return null; end if;
  /* 「모집」 「채용」 같은 꾸밈은 지점이 아닙니다 */
  if v ~ '^(모집|채용|공고|온라인|긴급|재공고|마감|신규)$' then return null; end if;
  /* ★ 2026-10-28 ㉫ (세중님 A·D) — **근무처 이름 꼴만** 씁니다.
     지역 [구포] · 부서 [통합재활팀] · 법인 [안동의료재단] · 조건 [주4.5일] ·
     직군 [물리치료사] 는 산하 기관이 아닙니다. 지금은 이 다섯이 전부 붙습니다 */
  if v !~ '(점|관|센터|센타|병원|의원|의료원|한의원|치과|약국|요양원|요양병원|주간보호|보건소|보건지소|보건의료원|복지관|복지센터|어린이집|분원|분소)$' then
    return null;
  end if;
  /* 기관명에 이미 있으면 안 붙입니다 (기관명도 다듬어 견줍니다) */
  if coalesce("제목글자다듬기"(p_org), '') like '%' || v || '%' then return null; end if;
  return v;
end $_$;


ALTER FUNCTION public."제목산하"(p_title text, p_org text) OWNER TO postgres;

--
-- Name: 제목속글자(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목속글자"(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select regexp_replace(
           regexp_replace(
             replace(replace(coalesce(p, ''), '&amp;', '&'), '&amp;', '&'),
             '&(lt|gt|quot|nbsp|#[0-9]{1,5});', '', 'g'),
           '[^가-힣A-Za-z0-9]', '', 'g')
$$;


ALTER FUNCTION public."제목속글자"(p text) OWNER TO postgres;

--
-- Name: 제목속병원(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목속병원"("p_제목" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  /* 제목 맨 앞의 「[…]」 안을 **그대로** 씁니다. 다만 —
       · 「병원·의료원·센터」 가 안 들어 있으면 기관 이름이 아닙니다
       · 「소속·전체·각 병원·산하·공동」 은 **뭉뚱그린 말**이라 안 씁니다 */
  select case
    when v is null then null
    when v !~ '(병원|의료원|센터)' then null
    when v ~ '(소속|전체|각\s*병원|산하|공동)' then null
    else btrim(v) end
  from (select (regexp_match(coalesce(p_제목, ''), '^\[([^\]]{2,40})\]'))[1] as v) t
$$;


ALTER FUNCTION public."제목속병원"("p_제목" text) OWNER TO postgres;

--
-- Name: FUNCTION "제목속병원"("p_제목" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."제목속병원"("p_제목" text) IS '제목 맨 앞 「[…]」 안을 그대로 (괄호 포함) — 앞만 떼면 분원·의원이 틀어집니다 (2026-10-19 세중님 ㉤)';


--
-- Name: 제목속병원_앞(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목속병원_앞"("p_제목" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  /* 전체 이름에서 **괄호 앞**만 — 견주기에만 씁니다 (화면에는 전체를 씁니다) */
  select nullif(btrim(regexp_replace(제목속병원(p_제목), '\s*[\(（].*$', '')), '')
$_$;


ALTER FUNCTION public."제목속병원_앞"("p_제목" text) OWNER TO postgres;

--
-- Name: 제목열쇠(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목열쇠"("p_제목" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select 제목속글자(꼬리말떼기(
    regexp_replace(coalesce(p_제목, ''),
      '[\(\[]?[[:space:]]*[Dd][[:space:]]*-[[:space:]]*([Dd][Aa][Yy]|[0-9]+)[[:space:]]*[\)\]]?', '', 'g')))
$$;


ALTER FUNCTION public."제목열쇠"("p_제목" text) OWNER TO postgres;

--
-- Name: 제목지역(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목지역"(p_sido text, p_work text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_짧 text[] := array['서울','부산','대구','인천','광주','대전','울산','세종',
                       '경기','강원','충북','충남','전북','전남','경북','경남','제주','전남광주'];
  v_긴 text[][] := array[
    ['서울특별시','서울'],['부산광역시','부산'],['대구광역시','대구'],['인천광역시','인천'],
    ['광주광역시','광주'],['대전광역시','대전'],['울산광역시','울산'],['세종특별자치시','세종'],
    ['경기도','경기'],['강원특별자치도','강원'],['강원도','강원'],
    ['충청북도','충북'],['충청남도','충남'],['전북특별자치도','전북'],['전라북도','전북'],
    ['전라남도','전남'],['경상북도','경북'],['경상남도','경남'],['제주특별자치도','제주'],
    ['전남광주통합특별시','전남광주']];
  v_원 text; v_찾 text[] := '{}'; t text; i int;
begin
  v_원 := btrim(coalesce(
            nullif(nullif(btrim(coalesce(p_sido,'')), ''), '전국'),
            nullif(btrim(coalesce(p_work,'')), ''),
            ''));
  if v_원 = '' then return null; end if;

  foreach t in array string_to_array(v_원, ',') loop
    t := btrim(t);
    if t = '' then continue; end if;
    for i in 1 .. array_length(v_긴, 1) loop
      if t like v_긴[i][1] || '%' then t := v_긴[i][2]; exit; end if;
    end loop;
    if not (t = any(v_짧)) then
      /* 「전남광주」가 「전남」보다 먼저 걸려야 합니다 — 긴 것부터 봅니다 */
      if t like '전남광주%' then t := '전남광주';
      else
        for i in 1 .. array_length(v_짧, 1) loop
          if t like v_짧[i] || '%' then t := v_짧[i]; exit; end if;
        end loop;
      end if;
    end if;
    if t = any(v_짧) and not (t = any(v_찾)) then v_찾 := v_찾 || t::text; end if;
  end loop;

  if array_length(v_찾, 1) is null then return null; end if;
  if array_length(v_찾, 1) >= 3 then return null; end if;   -- 지역 여럿
  return array_to_string(v_찾, '·');
end $$;


ALTER FUNCTION public."제목지역"(p_sido text, p_work text) OWNER TO postgres;

--
-- Name: 제목지역기관(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목지역기관"(p_sido text, p_work text, p_org text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /* 기관지역(손으로 정한 것)이 공고에 담긴 지역을 **이깁니다** (2026-10-07).
     선한병원의 sido 가 「전남」으로 잘못 담겨 있어 기관지역을 넣어도
     안 먹히던 자리입니다.
     ⚠ 한 기관이 여러 지역에 공고를 내는 곳(근로복지공단 등)은
       기관지역에 넣지 마십시오 — 모든 공고가 그 한 지역이 됩니다.
       근무처별로 가르는 것은 기관 표 작업에서 합니다 */
  select coalesce(
    (select g.시도 from 기관지역 g where g.기관 = p_org),
    제목지역(p_sido, p_work))
$$;


ALTER FUNCTION public."제목지역기관"(p_sido text, p_work text, p_org text) OWNER TO postgres;

--
-- Name: 제목직군(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목직군"(p_job text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when p_job = '공통' then '작업치료사·물리치료사'
    when coalesce(p_job,'') = '' then null
    else p_job end
$$;


ALTER FUNCTION public."제목직군"(p_job text) OWNER TO postgres;

--
-- Name: 제목채우기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."제목채우기"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  /* 관리자가 손으로 고친 제목은 안 덮습니다.
     조건 — UPDATE 이고, edited_fields 배열에 '보여줄제목' 이 들어 있을 때 */
  if tg_op = 'UPDATE' and '보여줄제목' = any(coalesce(new.edited_fields, '{}')) then
    new.보여줄제목 := old.보여줄제목;
    return new;
  end if;

  begin
    new.보여줄제목 := 제목만들기행(new);
  exception when others then
    /* ★ 제목만 비우고 넣기는 그대로 갑니다. 까닭은 로그에 남깁니다 */
    new.보여줄제목 := null;
    raise warning '제목만들기 실패 (공고는 담습니다) · id=% · %', new.id, sqlerrm;
  end;
  return new;
end $$;


ALTER FUNCTION public."제목채우기"() OWNER TO postgres;

--
-- Name: 조교연구갈래(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  with t as (
    select
      /* 기관 이름을 뗀 제목 */
      case when coalesce(p_기관,'') = '' then coalesce(p_제목,'')
           else replace(coalesce(p_제목,''), p_기관, ' ') end as 제목,
      coalesce(p_제목,'') || ' ' || coalesce(p_글,'') as 글
  )
  select case
    /* 모집 대상이 조교·연구 자리인가 */
    when t.제목 !~ '조교|연구원|연구위원|연구교수|연구조교|전임연구원|위촉연구원|박사후|포스트닥'
      then null
    /* 우리 직군과 관련 있나 — 학과명이나 응시자격·직무에 물리치료/작업치료 */
    when t.글 !~ '(물리|작업)[[:space:]]*치료[[:space:]]*(학과|학부|학|전공|사|직|선생)'
      then null
    when t.제목 ~ '연구' then '연구'
    else '조교'
  end
  from t;
$$;


ALTER FUNCTION public."조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text) OWNER TO postgres;

--
-- Name: 주소도메인(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."주소도메인"(u text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public'
    AS $$
  select nullif(regexp_replace(
    lower(split_part(split_part(
      regexp_replace(coalesce(u, ''), '^\s*[a-z]+://', ''), '/', 1), ':', 1)),
    '^www\.', ''), '')
$$;


ALTER FUNCTION public."주소도메인"(u text) OWNER TO postgres;

--
-- Name: FUNCTION "주소도메인"(u text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."주소도메인"(u text) IS 'https://www.hanilhosp.co.kr/recruit → hanilhosp.co.kr';


--
-- Name: 중복숨기기(boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."중복숨기기"("p_마른" boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_목록 jsonb;
  v_숨김 int := 0;
begin
  with 보임 as (
    select p.id, p.source, p.org_name, p.title, p.url, p.db_insert_at, p.admin_locked,
           공고열쇠(p.org_name, p.url, p.title) as 열쇠,
             (case when coalesce(p.detail->>'직군인원', p.headcount::text,
                                 p.detail->'뽑은값'->>'모집인원') is not null then 1 else 0 end)
           + (case when p.apply_to is not null then 1 else 0 end)
           + (case when p.apply_to_time is not null then 1 else 0 end)
           + (case when coalesce(nullif(p.work_place, ''), p.sido) is not null then 1 else 0 end)
           + (case when coalesce(p.detail->'뽑은값'->>'지원자격', p.detail->>'지원자격')
                        is not null then 1 else 0 end)
           + (case when coalesce(p.detail->'뽑은값'->>'예상연봉', p.detail->>'연봉',
                                 p.detail->>'예상연봉') is not null then 1 else 0 end) as 찬칸
      from job_posts p
      join job_posts_pub v on v.id = p.id
  ), 매긴것 as (
    select b.*, row_number() over (
             partition by b.열쇠
             order by b.admin_locked desc,
                      (b.source in ('HS', 'HS3', 'ND', 'ND2')) desc,
                      b.찬칸 desc,
                      b.db_insert_at asc,
                      b.id asc) as 순서,
           count(*) over (partition by b.열쇠) as 줄수
      from 보임 b
  ), 숨길것 as (
    select * from 매긴것 where 줄수 > 1 and 순서 > 1 and not admin_locked
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'source', s.source, '기관', s.org_name, '제목', s.title,
           '찬칸', s.찬칸, '열쇠', s.열쇠,
           '남는것', (select m.id from 매긴것 m where m.열쇠 = s.열쇠 and m.순서 = 1)
         ) order by s.열쇠, s.순서), '[]'::jsonb)
    into v_목록
    from 숨길것 s;

  if not p_마른 then
    with 보임 as (
      select p.id, p.source, p.db_insert_at, p.admin_locked,
             공고열쇠(p.org_name, p.url, p.title) as 열쇠,
               (case when coalesce(p.detail->>'직군인원', p.headcount::text,
                                   p.detail->'뽑은값'->>'모집인원') is not null then 1 else 0 end)
             + (case when p.apply_to is not null then 1 else 0 end)
             + (case when p.apply_to_time is not null then 1 else 0 end)
             + (case when coalesce(nullif(p.work_place, ''), p.sido) is not null then 1 else 0 end)
             + (case when coalesce(p.detail->'뽑은값'->>'지원자격', p.detail->>'지원자격')
                          is not null then 1 else 0 end)
             + (case when coalesce(p.detail->'뽑은값'->>'예상연봉', p.detail->>'연봉',
                                   p.detail->>'예상연봉') is not null then 1 else 0 end) as 찬칸
        from job_posts p
        join job_posts_pub v on v.id = p.id
    ), 매긴것 as (
      select b.*, row_number() over (
               partition by b.열쇠
               order by b.admin_locked desc,
                        (b.source in ('HS', 'HS3', 'ND', 'ND2')) desc,
                        b.찬칸 desc,
                        b.db_insert_at asc,
                        b.id asc) as 순서,
             count(*) over (partition by b.열쇠) as 줄수
        from 보임 b
    )
    update job_posts j
       set hidden = true, hidden_why = '중복', hidden_on = now()
      from 매긴것 m
     where m.id = j.id and m.줄수 > 1 and m.순서 > 1 and not m.admin_locked;
    v_숨김 := coalesce((select count(*) from jsonb_array_elements(v_목록)), 0);
  end if;

  return jsonb_build_object(
    '마른', p_마른,
    '숨길수', coalesce(jsonb_array_length(v_목록), 0),
    '숨김', v_숨김,
    '목록', v_목록);
end;
$$;


ALTER FUNCTION public."중복숨기기"("p_마른" boolean) OWNER TO postgres;

--
-- Name: FUNCTION "중복숨기기"("p_마른" boolean); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."중복숨기기"("p_마른" boolean) IS '같은 공고가 회원 화면에 둘 이상 보이면 한 줄만 남기고 hidden_why=「중복」 으로 숨깁니다. 기본은 마른 실행 (2026-10-18)';


--
-- Name: 지금광고(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."지금광고"("p_자리" text) RETURNS TABLE("자리" text, "그림" text, "링크" text, "표시초" integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.자리, b.그림, b.링크, b.표시초
    from 광고배너 b
   where b.자리 = "p_자리"
     and b.켜짐
     and coalesce(b.그림, '') <> ''
     and (b.시작일 is null or b.시작일 <= (now() at time zone 'Asia/Seoul')::date)
     and (b.끝일   is null or b.끝일   >= (now() at time zone 'Asia/Seoul')::date)
     /* ★ 2026-10-11 — 시험 배너는 관리자·마스터에게만 */
     and (not b.시험자료 or is_admin())
$$;


ALTER FUNCTION public."지금광고"("p_자리" text) OWNER TO postgres;

--
-- Name: 지난교육인가(date, date, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."지난교육인가"("p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when "p_오늘" is null then false
    when "p_끝" is not null then "p_끝" < "p_오늘"
    when "p_시작" is not null then "p_시작" < "p_오늘"
    when "p_올린날" is not null then ("p_올린날" + 30) < "p_오늘"
    else false                      -- 셋 다 모르면 안 내립니다
  end
$$;


ALTER FUNCTION public."지난교육인가"("p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date) OWNER TO postgres;

--
-- Name: 지역겹치나(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."지역겹치나"("p_지역" text, p_org text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
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


ALTER FUNCTION public."지역겹치나"("p_지역" text, p_org text) OWNER TO postgres;

--
-- Name: 지역겹치나_새(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."지역겹치나_새"("p_지역" text, p_org text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  with 긴 as (
    select * from (values
      ('서울','서울특별시'),('부산','부산광역시'),('대구','대구광역시'),('인천','인천광역시'),
      ('광주','광주광역시'),('대전','대전광역시'),('울산','울산광역시'),('세종','세종특별자치시'),
      ('경기','경기도'),('강원','강원특별자치도'),('강원','강원도'),
      ('충북','충청북도'),('충남','충청남도'),
      ('전북','전북특별자치도'),('전북','전라북도'),('전남','전라남도'),
      ('경북','경상북도'),('경남','경상남도'),('제주','제주특별자치도'),
      ('전남광주','전남광주통합특별시')) v(짧, 긴이름)
  ),
  조각 as (
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


ALTER FUNCTION public."지역겹치나_새"("p_지역" text, p_org text) OWNER TO postgres;

--
-- Name: 지역보임(public.job_posts); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."지역보임"(j public.job_posts) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_시도 text; v_가른것 text; v_시군구 text;
begin
  /* 공공기관 본체가 직접 뽑으면 지역 칸을 비웁니다 (2026-10-07 확정 방침) */
  if 본체만뽑나(j.org_name, j.title) then return null; end if;

  v_시도 := 제목지역기관(j.sido, j.work_place, j.org_name);
  if v_시도 = '전남광주' then
    v_가른것 := 전남광주가르기(coalesce(제목산하(j.title, j.org_name),'')
                               || ' ' || coalesce(j.title,''));
    /* 못 가르면 비웁니다 — 「전남광주」는 쓰지 않습니다 */
    v_시도 := v_가른것;
  end if;
  if v_시도 is null then return null; end if;

  /* 시도가 둘 이상이면 시군구를 붙이지 않습니다 (「부산·경남 창원시」는 틀립니다) */
  if v_시도 like '%·%' then return v_시도; end if;

  /* 손으로 정한 시군구가 공고에 담긴 것보다 셉니다 */
  select g.시군구 into v_시군구 from 기관지역 g where g.기관 = j.org_name;
  v_시군구 := nullif(btrim(coalesce(v_시군구, j.sgg, '')), '');
  if v_시군구 is null then return v_시도; end if;

  /* 시군구에 시도가 겹쳐 적힌 것을 뗍니다 — 「광주서구」 → 「서구」.
     심평원은 시군구를 「시도+구」 로 적습니다 (부산 16개 구 중 15개가
     「부산OO구」). 그래서 떼는 것이 늘 맞습니다. 두 가지만 빼고 —
       「제주시」  떼면 「시」 가 됩니다  → 남는 글자가 두 자 미만이면 안 뗍니다
       「부산진구」 진짜 이름이 그렇습니다 → 이름으로 뺍니다
     우리 자료의 19가지를 전부 넣고 확인했습니다 (2026-10-07) */
  if v_시군구 like v_시도 || '%'
     and v_시군구 <> '부산진구'
     and length(v_시군구) - length(v_시도) >= 2
     and substr(v_시군구, length(v_시도) + 1) ~ '(시|군|구)$' then
    v_시군구 := substr(v_시군구, length(v_시도) + 1);
  end if;

  return v_시도 || ' ' || v_시군구;
end $_$;


ALTER FUNCTION public."지역보임"(j public.job_posts) OWNER TO postgres;

--
-- Name: 지역앞말떼기(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."지역앞말떼기"("p_지역" text, "p_기관" text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select coalesce(
    (select btrim(substr("p_기관", length(g."긴이름") + 1))
       from (values
         ('서울','서울특별시'),('부산','부산광역시'),('대구','대구광역시'),('인천','인천광역시'),
         ('광주','광주광역시'),('대전','대전광역시'),('울산','울산광역시'),('세종','세종특별자치시'),
         ('경기','경기도'),('강원','강원특별자치도'),('강원','강원도'),
         ('충북','충청북도'),('충남','충청남도'),
         ('전북','전북특별자치도'),('전북','전라북도'),('전남','전라남도'),
         ('경북','경상북도'),('경남','경상남도'),('제주','제주특별자치도'),
         ('전남광주','전남광주통합특별시')) g("짧","긴이름")
      where g."짧" = "p_지역"
        and "p_기관" like g."긴이름" || '%'
        and btrim(substr("p_기관", length(g."긴이름") + 1)) <> ''
        and btrim(substr("p_기관", length(g."긴이름") + 1)) !~ '^립'
        /* ★ 범위를 가리키는 말로 시작하면 안 뗍니다 (2026-10-07) */
        and btrim(substr("p_기관", length(g."긴이름") + 1))
              !~ '^(광역|권역|남부|북부|동부|서부|중부|동남권|서남권)'
        and split_part(btrim(substr("p_기관", length(g."긴이름") + 1)), ' ', 1)
              !~ '^(의료원|병원|보건소|센터|복지관)$'
        /* ★ 2026-10-28 세중님 ㉧ — 떼고 나서 **「○구」·「○군」 하나만** 남으면
           안 뗍니다. 「대구광역시 중구」가 「중구」가 되어 어느 중구인지 모릅니다 */
        and btrim(substr("p_기관", length(g."긴이름") + 1)) !~ '^[가-힣]{1,3}(구|군)$'
      order by length(g."긴이름") desc
      limit 1),
    "p_기관")
$_$;


ALTER FUNCTION public."지역앞말떼기"("p_지역" text, "p_기관" text) OWNER TO postgres;

--
-- Name: FUNCTION "지역앞말떼기"("p_지역" text, "p_기관" text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."지역앞말떼기"("p_지역" text, "p_기관" text) IS '제목 앞은 짧은 지역 이름으로 시작합니다. 기관 이름 앞의 긴 도·광역시 이름이
   그 지역과 같으면 뗍니다. 안 떼는 자리 둘 — 「경상북도립…」처럼 낱말이 끊기는
   자리, 「경기도의료원」처럼 떼면 기관 고유 이름이 없어지는 자리.';


--
-- Name: 직군의심(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."직군의심"() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
with 글모음 as (
  select p.id, p.source, p.org_name, p.title, p.job_group, p.url,
         /* ★ `evidence` 전체와 `뽑은값.근거`·`detail.근거` 는 **우리가 쓴 글**이라
            뺍니다. `detail.걸린줄` 은 원문을 떼어 적은 것이라 남깁니다 */
         coalesce(p.title, '') || ' ' || coalesce(b.body, '') || ' '
           || coalesce((coalesce(p."뽑은값",'{}'::jsonb) - '근거')::text, '') || ' '
           || coalesce((coalesce(p.detail,'{}'::jsonb) - '근거')::text, '') as 글
    from job_posts p
    join job_posts_pub v on v.id = p.id
    /* ★ 2026-10-23 세중님 I — **본문을 공고마다 하나로 묶습니다.**
       전에는 `left join job_body b` 라 **본문 줄마다 한 줄**이 나왔습니다. 그래서
         ① 의심 셈이 부풀었습니다 — GJ306151 이 본문 둘(상세 240자 · 첨부 23,935자)
            이라 「의심 2」로 찍혔습니다. 회원 화면에 중복 공고는 없었습니다
         ② 더 나쁜 것 — `근거있음` 을 **줄마다 따로** 재니, 우리 직군 말이 한 줄에만
            있으면 **다른 줄이 그 공고를 의심으로** 올립니다 (헛의심).
            2026-10-23 기준 회원 화면에 본문 2줄인 공고가 8건입니다
       묶는 자리를 **출력이 아니라 여기**에 둡니다 — 출력에서 주소로만 묶으면 ②가
       남고, 출력은 네 자리를 다 고쳐야 합니다 (지침 6절 — 기준은 한 자리) */
    left join (select b2.job_id, string_agg(coalesce(b2.body, ''), ' ') as body
                 from job_body b2 group by b2.job_id) b on b.job_id = p.id
), 잼 as (
  select g.*,
    (g.글 ~ '(물리|작업|도수)[^가-힣]{0,6}치료[[:space:]]*(사|직|선생)'
     or g.글 ~ '(물리|작업)[[:space:]]*\(?(물리|작업)?\)?[[:space:]]*치료[[:space:]]*(사|직|선생)')
      as "근거있음",
    "조교연구갈래"(g.title, g.org_name, g.글) as "조교연구",
    (g.title ~ '(\.\.\.|…|\.\.)[[:space:]]*$') as "잘린제목",
    (g.title ~ ('직원[[:space:]]*(채용|모집)|제[[:space:]]*[0-9]+[[:space:]]*[차회]'
            || '|공개[[:space:]]*(채용|경쟁)|통합[[:space:]]*채용|임용시험'
            || '|(기간제|계약직)[[:space:]]*(직원|근로자)|신규[[:space:]]*직원')) as "뭉뚱그림",
    /* ★ 2026-10-28 세중님 ㉲ — **「보조원」은 우리 직군이 아닙니다.**
       「물리치료보조원 구함」(제생의원)이 물리치료사로 회원 화면에 있었습니다.
       **제목**으로만 봅니다 — 본문에 「물리치료사」가 한 번 나온다고 보조원 자리가
       우리 자리가 되지는 않습니다. 그리고 세중님 뜻대로 **제목에 둘 다 있으면**
       우리 직군 공고로 둡니다 (「물리치료사 1명, 보조원 1명」 꼴).
       자 글자는 tools/보조원규칙.mjs 와 **같은 글자**입니다 (지침 6절 — 한 자리) */
    (g.title ~ '물리\s*치료\s*보조|작업\s*치료\s*보조|치료\s*보조\s*원|보조\s*원|보조\s*인력'
     and g.title !~ '(물리|작업|도수)\s*치료\s*(사|직|선생)') as "보조꼴"
   from 글모음 g
), 걸린것 as (
  select * from 잼
   /* ★ 2026-10-28 ㉲ — 우리 직군 말이 없거나 **보조원 꼴이면** 걸립니다 */
   where (not "근거있음" or "보조꼴") and not "잘린제목" and "조교연구" is null
)
select jsonb_build_object(
  '의심', (select count(*) from 걸린것 where not "뭉뚱그림"),
  '의심목록', (select coalesce(jsonb_agg(jsonb_build_object(
                 '기관', org_name, '제목', left(title, 80), '직군', job_group,
                 '경로', source, '주소', url) order by source, id), '[]'::jsonb)
                 from 걸린것 where not "뭉뚱그림"),
  '통합공고', (select count(*) from 걸린것 where "뭉뚱그림"),
  '통합공고목록', (select coalesce(jsonb_agg(jsonb_build_object(
                 '기관', org_name, '제목', left(title, 80), '직군', job_group,
                 '경로', source, '주소', url) order by source, id), '[]'::jsonb)
                 from 걸린것 where "뭉뚱그림"),
  /* ★ 2026-10-28 세중님 ㉲ — 보조원 꼴을 따로 셉니다 (아침 메일이 읽습니다) */
  '보조꼴', (select count(*) from 걸린것 where "보조꼴"),
  '보조꼴목록', (select coalesce(jsonb_agg(jsonb_build_object(
                 '기관', org_name, '제목', left(title, 80), '직군', job_group,
                 '경로', source, '주소', url) order by source, id), '[]'::jsonb)
                 from 걸린것 where "보조꼴"),
  '잘린제목', (select count(*) from 잼 where not "근거있음" and "잘린제목"),
  '조교연구', (select count(*) from 잼 where "조교연구" is not null),
  '※', '기관 원문(제목·본문·뽑은값·detail)에 우리 직군 말이 없는데 직군이 붙은 공고입니다.'
       || ' 통합공고는 첨부에 근거가 있을 수 있어 따로 셉니다. evidence 와'
       || ' 뽑은값·detail 의 「근거」 칸은 우리가 쓴 글이라 근거로 안 씁니다.'
       || ' 「조교·연구」 갈래는 의심에서 빼고 따로 셉니다 (조교연구갈래() 한 자리).'
       || ' 「보조원」 꼴(제목에 보조 말이 있고 우리 직군 말이 없는 것)은 본문에 우리 직군'
       || ' 말이 있어도 의심으로 셉니다 — 보조원은 우리 직군이 아닙니다 (2026-10-28 세중님)'
);
$_$;


ALTER FUNCTION public."직군의심"() OWNER TO postgres;

--
-- Name: 차단풀기(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."차단풀기"("p_누구" uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  update 회원차단 set 켬 = false where 누가 = auth.uid() and 누구 = "p_누구";
  return jsonb_build_object('됨', true);
end $$;


ALTER FUNCTION public."차단풀기"("p_누구" uuid) OWNER TO postgres;

--
-- Name: 차단하기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."차단하기"("p_글" bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_누구 uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  select author_id into v_누구 from posts where id = "p_글";
  if v_누구 is null then raise exception '그 글이 없습니다' using errcode = '22023'; end if;
  if v_누구 = auth.uid() then raise exception '자기 자신은 차단할 수 없습니다' using errcode = '22023'; end if;
  insert into 회원차단 (누가, 누구, 켬, 때) values (auth.uid(), v_누구, true, now())
    on conflict (누가, 누구) do update set 켬 = true, 때 = now();
  return jsonb_build_object('됨', true);
end $$;


ALTER FUNCTION public."차단하기"("p_글" bigint) OWNER TO postgres;

--
-- Name: 채용담당자인가(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."채용담당자인가"("p_기관번호" text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from 회원자격 q
                  where q.profile_id = auth.uid() and q.갈래 = '채용담당자'
                    and q.상태 = '승인' and q.기관번호 = p_기관번호)
      or (p_기관번호 like 'TEST:%'
          and 마스터역할() in ('채용담당자', '채용+교육담당자'))
$$;


ALTER FUNCTION public."채용담당자인가"("p_기관번호" text) OWNER TO postgres;

--
-- Name: 첨부목록(text, text, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부목록"("p_갈래" text, "p_공고" text DEFAULT NULL::text, "p_회차" bigint DEFAULT NULL::bigint) RETURNS TABLE(id bigint, "이름" text, "크기" integer, "형식" text, "읽었나" boolean, "올린때" timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select a.id, a.이름, a.크기, a.형식, a.읽었나, a.올린때
    from 공고첨부 a
   where auth.uid() is not null
     and a.지운때 is null
     and ((p_갈래 = '채용' and a.공고id = p_공고)
       or (p_갈래 = '교육' and a.회차id = p_회차))
   order by a.올린때
$$;


ALTER FUNCTION public."첨부목록"("p_갈래" text, "p_공고" text, "p_회차" bigint) OWNER TO postgres;

--
-- Name: 첨부올리기(text, text, text, integer, text, text, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부올리기"("p_갈래" text, "p_경로" text, "p_이름" text, "p_크기" integer, "p_형식" text, "p_공고" text DEFAULT NULL::text, "p_회차" bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_id bigint; v_시험 boolean := false;
        j record; s record; v_몇개 int;
        최대개수 constant int := 5;
        최대크기 constant int := 10 * 1024 * 1024;
begin
  if v is null then raise exception '로그인이 필요합니다' using errcode = '42501'; end if;
  if not 첨부형식맞나(p_형식) then
    raise exception '올릴 수 없는 형식입니다 (%)', p_형식 using errcode = '22023'; end if;
  if p_크기 > 최대크기 then
    raise exception '파일 하나는 10MB 까지예요' using errcode = '22023'; end if;
  if coalesce(btrim(p_이름), '') = '' then
    raise exception '파일 이름이 없습니다' using errcode = '22023'; end if;

  if p_갈래 = '채용' then
    select * into j from job_posts where id = p_공고;
    if j is null then raise exception '없는 공고입니다' using errcode = '22023'; end if;
    if j.source <> 'BIZ' then
      raise exception '우리가 모아 온 공고에는 담당자가 첨부를 못 답니다' using errcode = '42501'; end if;
    if not 채용담당자인가(j.기관번호) then
      raise exception '이 공고의 담당자가 아닙니다' using errcode = '42501'; end if;
    select count(*) into v_몇개 from 공고첨부
     where 공고id = p_공고 and 지운때 is null;
    v_시험 := j.시험자료;

  elsif p_갈래 = '교육' then
    select * into s from 교육회차 where 회차id = p_회차;
    if s is null then raise exception '없는 회차입니다' using errcode = '22023'; end if;
    if not 교육담당자인가(s.과정id) then
      raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501'; end if;
    select count(*) into v_몇개 from 공고첨부
     where 회차id = p_회차 and 지운때 is null;
    v_시험 := s.시험자료;

  else raise exception '모르는 갈래입니다 (%)', p_갈래 using errcode = '22023';
  end if;

  if v_몇개 >= 최대개수 then
    raise exception '첨부는 %개까지예요', 최대개수 using errcode = '22023'; end if;

  insert into 공고첨부 (갈래, 공고id, 회차id, 경로, 이름, 크기, 형식, 올린사람, 시험자료)
  values (p_갈래, p_공고, p_회차, p_경로, btrim(p_이름), p_크기, p_형식, v, v_시험)
  returning id into v_id;

  return jsonb_build_object('id', v_id, '몇개', v_몇개 + 1, '최대', 최대개수,
                            '읽을수있나', p_형식 in ('application/pdf','image/jpeg','image/png','image/webp'));
end $$;


ALTER FUNCTION public."첨부올리기"("p_갈래" text, "p_경로" text, "p_이름" text, "p_크기" integer, "p_형식" text, "p_공고" text, "p_회차" bigint) OWNER TO postgres;

--
-- Name: 첨부올릴수있나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부올릴수있나"("p_폴더" text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from job_posts j
                  where j.id = "p_폴더" and j.source = 'BIZ'
                    and "채용담당자인가"(j."기관번호"))
      /* ★ 2026-10-11 — 앞머리를 **영문 edu** 로 바꿨습니다.
         저장소 열쇠에 한글이 들어가면 InvalidKey 입니다 (작업지침 6-2b).
         「교육9/…」로 올리다 400 이 났습니다 — 교육 첨부는 **한 번도
         올라간 적이 없습니다**. 옛 경로로 올라간 줄은 0건이라
         갈아탈 것이 없습니다 */
      or exists (select 1 from "교육회차" s
                  where 'edu' || s."회차id" = "p_폴더"
                    and "교육담당자인가"(s."과정id"))
$$;


ALTER FUNCTION public."첨부올릴수있나"("p_폴더" text) OWNER TO postgres;

--
-- Name: 첨부읽음표시(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부읽음표시"(p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r jsonb;
  v_성공 int := 0;
  v_실패 int := 0;
  v_못찾음 int := 0;
  v_탈 text := null;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  perform set_config('app.누가', '첨부 읽음 표시', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'job_id', '') = '' or coalesce(r->>'url', '') = '' then
        raise exception '공고ID 나 주소가 없습니다';
      end if;

      update job_attachments
         set parsed_at = now(),
             "읽기탈" = nullif(r->>'왜', '')
       where job_id = r->>'job_id' and url = r->>'url';

      if not found then
        v_못찾음 := v_못찾음 + 1;
      elsif coalesce(r->>'왜', '') = '' then
        v_성공 := v_성공 + 1;
      else
        v_실패 := v_실패 + 1;
      end if;
    exception when others then
      if v_탈 is null then v_탈 := left(sqlerrm, 160); end if;
    end;
  end loop;

  return jsonb_build_object(
    '읽음', v_성공, '못읽음', v_실패, '그 줄이 없음', v_못찾음, '첫탈', v_탈,
    /* 하루 상한을 걸 수 있게 **오늘(KST) 읽어 본 수**를 함께 돌려줍니다 */
    '오늘 읽어 본 수', (select count(*) from job_attachments
                        where parsed_at is not null
                          and (parsed_at at time zone 'Asia/Seoul')::date
                              = (now() at time zone 'Asia/Seoul')::date),
    '표 전체', (select count(*) from job_attachments),
    '아직 안 본 것', (select count(*) from job_attachments where parsed_at is null));
end
$$;


ALTER FUNCTION public."첨부읽음표시"(p_rows jsonb) OWNER TO postgres;

--
-- Name: 첨부치우기(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부치우기"(p_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare a record; j record; s record;
begin
  select * into a from 공고첨부 where id = p_id and 지운때 is null;
  if a is null then raise exception '없는 첨부입니다' using errcode = '22023'; end if;

  if a.갈래 = '채용' then
    select * into j from job_posts where id = a.공고id;
    if not 채용담당자인가(j.기관번호) then
      raise exception '이 공고의 담당자가 아닙니다' using errcode = '42501'; end if;
  else
    select * into s from 교육회차 where 회차id = a.회차id;
    if not 교육담당자인가(s.과정id) then
      raise exception '이 과정의 담당자가 아닙니다' using errcode = '42501'; end if;
  end if;

  update 공고첨부 set 지운때 = now() where id = p_id;
  return true;
end $$;


ALTER FUNCTION public."첨부치우기"(p_id bigint) OWNER TO postgres;

--
-- Name: 첨부하나(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부하나"(p_id bigint) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when auth.uid() is null then null
         else (select jsonb_build_object('경로', a.경로, '이름', a.이름, '형식', a.형식)
                 from 공고첨부 a where a.id = p_id and a.지운때 is null) end
$$;


ALTER FUNCTION public."첨부하나"(p_id bigint) OWNER TO postgres;

--
-- Name: 첨부형식맞나(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."첨부형식맞나"("p_형식" text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$ select p_형식 in ('image/jpeg', 'image/png', 'image/webp',
                        'application/pdf',
                        'application/x-hwp', 'application/haansofthwp',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document') $$;


ALTER FUNCTION public."첨부형식맞나"("p_형식" text) OWNER TO postgres;

--
-- Name: 청년담기(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."청년담기"(p_secret text, "p_정책" jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_수 int := 0;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = 'YTH' and s.secret = p_secret) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_정책 is null or jsonb_typeof(p_정책) <> 'array' then
    return jsonb_build_object('정책', 0);
  end if;

  insert into 청년정책 (번호, 정책명, 갈래, 대분류, 중분류, 키워드, 설명, 지원내용,
    소관기관, 운영기관, 시도, 상시, 신청시작, 신청끝, 사업시작, 사업끝,
    신청방법, 추가자격, 나이최소, 나이최대, 나이제한없음, 신청주소, 참고주소, 조회수, updated_at)
  select x.번호, x.정책명, coalesce(nullif(x.갈래,''),'모름'), x.대분류, x.중분류,
         x.키워드, x.설명, x.지원내용, x.소관기관, x.운영기관,
         coalesce(nullif(x.시도,''),'모름'), coalesce(x.상시,false),
         nullif(x.신청시작,'')::date, nullif(x.신청끝,'')::date,
         nullif(x.사업시작,'')::date, nullif(x.사업끝,'')::date,
         x.신청방법, x.추가자격, x.나이최소, x.나이최대, x.나이제한없음,
         x.신청주소, x.참고주소, x.조회수, now()
  from jsonb_to_recordset(p_정책) as x(
    번호 text, 정책명 text, 갈래 text, 대분류 text, 중분류 text, 키워드 text,
    설명 text, 지원내용 text, 소관기관 text, 운영기관 text, 시도 text,
    상시 boolean, 신청시작 text, 신청끝 text, 사업시작 text, 사업끝 text,
    신청방법 text, 추가자격 text, 나이최소 int, 나이최대 int,
    나이제한없음 boolean, 신청주소 text, 참고주소 text, 조회수 int)
  where x.번호 is not null and x.번호 <> '' and x.정책명 is not null and x.정책명 <> ''
  on conflict (번호) do update set
    정책명 = excluded.정책명, 갈래 = excluded.갈래, 대분류 = excluded.대분류,
    중분류 = excluded.중분류, 키워드 = excluded.키워드, 설명 = excluded.설명,
    지원내용 = excluded.지원내용, 소관기관 = excluded.소관기관,
    운영기관 = excluded.운영기관, 시도 = excluded.시도, 상시 = excluded.상시,
    신청시작 = excluded.신청시작, 신청끝 = excluded.신청끝,
    사업시작 = excluded.사업시작, 사업끝 = excluded.사업끝,
    신청방법 = excluded.신청방법, 추가자격 = excluded.추가자격,
    나이최소 = excluded.나이최소, 나이최대 = excluded.나이최대,
    나이제한없음 = excluded.나이제한없음, 신청주소 = excluded.신청주소,
    참고주소 = excluded.참고주소, 조회수 = excluded.조회수, updated_at = now();

  v_수 := (select count(*) from jsonb_array_elements(p_정책));
  return jsonb_build_object('정책', v_수);
end $$;


ALTER FUNCTION public."청년담기"(p_secret text, "p_정책" jsonb) OWNER TO postgres;

--
-- Name: 청년목록(text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."청년목록"("p_갈래" text DEFAULT NULL::text, "p_시도" text DEFAULT NULL::text, "p_지난것" boolean DEFAULT false, p_page integer DEFAULT 0) RETURNS TABLE("번호" text, "정책명" text, "갈래" text, "중분류" text, "키워드" text, "설명" text, "지원내용" text, "소관기관" text, "시도" text, "상시" boolean, "신청시작" date, "신청끝" date, "나이최소" integer, "나이최대" integer, "나이제한없음" boolean, "신청주소" text, "참고주소" text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select y.번호, y.정책명, y.갈래, y.중분류, y.키워드,
         left(coalesce(y.설명,''), 300), left(coalesce(y.지원내용,''), 400),
         y.소관기관, y.시도, y.상시, y.신청시작, y.신청끝,
         y.나이최소, y.나이최대, y.나이제한없음, y.신청주소, y.참고주소
  from 청년정책 y
  where (p_갈래 is null or p_갈래 = '전체' or y.갈래 = p_갈래)
    and (p_시도 is null or p_시도 = '전국' or y.시도 = p_시도 or y.시도 = '전국')
    and (p_지난것 or y.상시 or y.신청끝 is null
         or y.신청끝 >= (now() at time zone 'Asia/Seoul')::date)
  order by y.상시, y.신청끝 asc nulls last, y.번호
  limit 20 offset greatest(0, coalesce(p_page, 0)) * 20;
$$;


ALTER FUNCTION public."청년목록"("p_갈래" text, "p_시도" text, "p_지난것" boolean, p_page integer) OWNER TO postgres;

--
-- Name: 청년셈(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."청년셈"("p_시도" text DEFAULT NULL::text, "p_지난것" boolean DEFAULT false) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 본것 as (
    select y.갈래, y.시도 from 청년정책 y
    where (p_시도 is null or p_시도 = '전국' or y.시도 = p_시도 or y.시도 = '전국')
      and (p_지난것 or y.상시 or y.신청끝 is null
           or y.신청끝 >= (now() at time zone 'Asia/Seoul')::date)
  )
  select jsonb_build_object(
    '전체', (select count(*) from 본것),
    '갈래', (select coalesce(jsonb_object_agg(갈래, n), '{}'::jsonb)
               from (select 갈래, count(*) n from 본것 group by 갈래) t),
    '시도들', (select coalesce(jsonb_agg(jsonb_build_object('시도', 시도, '수', n)
                                order by n desc), '[]'::jsonb)
                 from (select y.시도, count(*) n from 청년정책 y
                        where (p_지난것 or y.상시 or y.신청끝 is null
                               or y.신청끝 >= (now() at time zone 'Asia/Seoul')::date)
                          and y.시도 not in ('모름')
                        group by y.시도) s),
    '마지막수집', (select max(updated_at) from 청년정책));
$$;


ALTER FUNCTION public."청년셈"("p_시도" text, "p_지난것" boolean) OWNER TO postgres;

--
-- Name: 출처다른중복(boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."출처다른중복"("p_마른" boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
             /* ★ 2026-10-19 — **보정한 기관 이름**으로 봅니다.
                여러 병원을 거느린 공단·법인의 AL·AL2 공고는 제목의
                「[OO병원]」이 진짜 기관입니다 (기관이름보정 한 자리) */
             견줄이름(기관이름보정(p.source, p.org_name, p.title)) as 기관열쇠,
             /* ★ 2026-10-19 세중님 ㉤ — 괄호가 든 이름은 **앞 이름으로도** 견줍니다.
                화면에는 전체(「인천병원(서울의원)」)를 쓰지만 다른 출처는
                「인천병원」으로만 적을 수 있습니다 */
             견줄이름(coalesce(제목속병원_앞(p.title),
                               기관이름보정(p.source, p.org_name, p.title))) as 기관열쇠앞,
             제목열쇠(p.title) as 제목키,
             일곱칸찬수(p.id) as 찬수,
             /* 기관 직접 출처가 먼저입니다 (2026-10-18 에 정한 그 순서) */
             (case when p.source in ('HS', 'HS3', 'ND', 'ND2') then 1 else 0 end) as 직접출처,
             coalesce(p.admin_locked, false) as 잠김
        from job_posts p
        join job_posts_pub v on v.id = p.id
    )
    select a.id as 남길것, b.id as 숨길것, a.source as 남길출처, b.source as 숨길출처,
           a.title as 제목, a.org_name as 기관, a.찬수 as 남길찬수, b.찬수 as 숨길찬수
      from 보임 a
      join 보임 b
        on (a.기관열쇠 = b.기관열쇠
            or a.기관열쇠앞 = b.기관열쇠앞
            or a.기관열쇠   = b.기관열쇠앞
            or a.기관열쇠앞 = b.기관열쇠)
       and a.제목키 = b.제목키
       and length(a.제목키) >= 10            /* 토막이 짧으면 아무거나 맞습니다 */
       and a.id < b.id                        /* 짝을 한 번만 봅니다 */
       and a.source <> b.source               /* ★ **출처가 달라야** 합니다 */
       /* ★ 마감일이 같거나 한쪽이 비어 있어야 합니다 */
       and (a.apply_to = b.apply_to or a.apply_to is null or b.apply_to is null)
     where not b.잠김                          /* 관리자가 잠근 것은 안 숨깁니다 */
       /* 남길 쪽 = 칸이 더 찬 쪽, 같으면 기관 직접 출처 */
       and (a.찬수 > b.찬수
            or (a.찬수 = b.찬수 and a.직접출처 >= b.직접출처))
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

  if p_마른 then
    return jsonb_build_object('마른', true, '숨길수', v_숨김, '숨김', 0, '목록', v_목록);
  end if;

  /* 칸 이름은 `중복숨기기` 와 **같은 것**을 씁니다 — `hidden_why`·`hidden_on`
     입니다(찍어서 확인했습니다. 처음에 `hide_why` 로 짐작해 틀렸습니다) */
  update job_posts j
     set hidden = true,
         hidden_why = '중복(출처 다름) — 칸이 더 찬 쪽을 남겼습니다',
         hidden_on = now()
   where j.id in (select (x->>'숨길것') from jsonb_array_elements(v_목록) x)
     and not coalesce(j.admin_locked, false);
  return jsonb_build_object('마른', false, '숨길수', v_숨김, '숨김', v_숨김, '목록', v_목록);
end
$$;


ALTER FUNCTION public."출처다른중복"("p_마른" boolean) OWNER TO postgres;

--
-- Name: FUNCTION "출처다른중복"("p_마른" boolean); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."출처다른중복"("p_마른" boolean) IS '출처가 다른 같은 공고를 좁게 묶어 한쪽을 숨깁니다 — 같은 기관 AND 같은 제목열쇠 AND (마감일 같음 OR 한쪽 빔) · 남길 쪽은 칸이 더 찬 쪽, 같으면 기관 직접 출처 (2026-10-19)';


--
-- Name: 칸기록_오래된것지우기(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."칸기록_오래된것지우기"(p_days integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v int;
begin
  if p_days < 7 then
    raise exception '칸기록을 7일보다 짧게 두지 않습니다 — 받은 값 %', p_days;
  end if;
  delete from "칸기록" where "바뀐때" < now() - make_interval(days => p_days);
  get diagnostics v = row_count;
  return v;
end $$;


ALTER FUNCTION public."칸기록_오래된것지우기"(p_days integer) OWNER TO postgres;

--
-- Name: FUNCTION "칸기록_오래된것지우기"(p_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public."칸기록_오래된것지우기"(p_days integer) IS '칸기록을 30일만 둡니다. 밤정리가 부릅니다. 7일보다 짧은 값은 거부합니다 (2026-10-18)';


--
-- Name: 칸기록남기기(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."칸기록남기기"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_누가 text := coalesce(nullif(current_setting('app.누가', true), ''), '(모름)');
  v_왜   text := nullif(current_setting('app.왜', true), '');
begin
  if new.headcount is distinct from old.headcount then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'headcount', old.headcount::text, new.headcount::text, v_누가, v_왜);
  end if;
  if new.apply_to is distinct from old.apply_to then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'apply_to', old.apply_to::text, new.apply_to::text, v_누가, v_왜);
  end if;
  if new.apply_to_time is distinct from old.apply_to_time then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'apply_to_time', old.apply_to_time::text, new.apply_to_time::text, v_누가, v_왜);
  end if;
  if new.work_place is distinct from old.work_place then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'work_place', left(old.work_place, 200), left(new.work_place, 200), v_누가, v_왜);
  end if;
  /* ★ 2026-10-19 세중님 6번 — 고용형태. 일곱 칸은 아니지만 **회원에게 보이고
     수집기가 덮는** 값입니다. 「공무원」 120건을 바로잡은 날 함께 넣었습니다 */
  if new.employ_type is distinct from old.employ_type then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'employ_type', left(old.employ_type, 200), left(new.employ_type, 200), v_누가, v_왜);
  end if;
  /* 아래 셋은 detail 속입니다. **화면이 읽는 순서와 같은 순서**로 꺼냅니다
     (docs/일곱칸_대조_1014.md) — 그래야 「화면 값이 바뀐 것」이 기록됩니다 */
  if coalesce(new.detail->>'직군인원', new."뽑은값"->>'모집인원', new.detail->'뽑은값'->>'모집인원')
     is distinct from coalesce(old.detail->>'직군인원', old."뽑은값"->>'모집인원', old.detail->'뽑은값'->>'모집인원') then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'detail.모집인원',
            left(coalesce(old.detail->>'직군인원', old."뽑은값"->>'모집인원', old.detail->'뽑은값'->>'모집인원'), 200),
            left(coalesce(new.detail->>'직군인원', new."뽑은값"->>'모집인원', new.detail->'뽑은값'->>'모집인원'), 200), v_누가, v_왜);
  end if;
  /* ★ 2026-10-24 세중님 ㉢ — **맨 위 「뽑은값」 칸도** 봅니다.
     `칸되메우기` 창구는 맨 위 뽑은값에 씁니다(detail 이 아닙니다). 그래서
     2026-10-24 에 지원자격 11건을 덮었는데 칸기록에 한 줄도 안 남았습니다.
     읽는 순서는 화면과 같게 — 맨 위 뽑은값 → detail.뽑은값 → detail */
  if coalesce(new."뽑은값"->>'지원자격', new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격')
     is distinct from coalesce(old."뽑은값"->>'지원자격', old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격') then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'detail.지원자격',
            left(coalesce(old."뽑은값"->>'지원자격', old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격'), 200),
            left(coalesce(new."뽑은값"->>'지원자격', new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격'), 200), v_누가, v_왜);
  end if;
  if coalesce(new."뽑은값"->>'예상연봉', new.detail->'뽑은값'->>'예상연봉', new.detail->>'연봉', new.detail->>'예상연봉')
     is distinct from coalesce(old."뽑은값"->>'예상연봉', old.detail->'뽑은값'->>'예상연봉', old.detail->>'연봉', old.detail->>'예상연봉') then
    insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
    values (new.id, 'detail.예상연봉',
            left(coalesce(old."뽑은값"->>'예상연봉', old.detail->'뽑은값'->>'예상연봉', old.detail->>'연봉', old.detail->>'예상연봉'), 200),
            left(coalesce(new."뽑은값"->>'예상연봉', new.detail->'뽑은값'->>'예상연봉', new.detail->>'연봉', new.detail->>'예상연봉'), 200), v_누가, v_왜);
  end if;
  return null;          -- after 트리거의 반환값은 쓰이지 않습니다
end $$;


ALTER FUNCTION public."칸기록남기기"() OWNER TO postgres;

--
-- Name: 칸되메우기(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."칸되메우기"(p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r jsonb;
  v_담음 int := 0; v_건너뜀 int := 0; v_없음 int := 0; v_마감일찬것 int := 0;
  v_잠긴칸 text[];
  v_고용형태 int := 0;   /* 2026-10-19 — 고용형태를 바로잡은 수 */
  v_제목 int := 0;       /* 2026-10-19 — 잘린 제목을 온전하게 한 수 */
begin
  perform set_config('app.누가', '첨부 되메우기', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    if not exists (select 1 from job_posts j where j.id = r->>'id') then
      v_없음 := v_없음 + 1; continue;
    end if;
    if exists (select 1 from job_posts j
                where j.id = r->>'id' and coalesce(j.admin_locked, false)) then
      v_건너뜀 := v_건너뜀 + 1; continue;
    end if;

    select coalesce(j.edited_fields, '{}') into v_잠긴칸
      from job_posts j where j.id = r->>'id';

    /* ★ 2026-10-19 — **뚜껑을 넘는 날짜는 안 넣습니다.**
       알리오가 「상시모집」 공고에 pbancEndYmd 20501231 을 줍니다.
       `collect_put` 과 같은 기준(오늘 + 400일)입니다 — 기준을 한 자리에 둡니다 */
    if (r ? 'apply_to') and not ('apply_to' = any(v_잠긴칸))
       and (nullif(r->>'apply_to', '')::date
            <= ((now() at time zone 'Asia/Seoul')::date + 400)) then
      update job_posts j set
        apply_to = (r->>'apply_to')::date,
        deadline_src = coalesce(r->>'마감일출처', '첨부') || '(kordoc) · '
                       || (now() at time zone 'Asia/Seoul')::date
      where j.id = r->>'id'
        and j.apply_to is null
        and (r->>'apply_to') is not null;
      if found then v_마감일찬것 := v_마감일찬것 + 1; end if;
    end if;

    /* ★ 2026-10-19 세중님 지시 — **고용형태는 덮습니다.**
       다른 칸은 「비어 있을 때만」 채우는데, 고용형태는 **틀린 값을
       바로잡는 것**입니다 — 「공무원」·「기간제」·「비정규직」을 「계약직」 등으로
       바꿔야 하므로 비어 있을 때만으로는 안 됩니다.
       지키는 것은 edited_fields(사람이 고친 칸)와 admin_locked 뿐이고
       updated_at 은 안 바꿉니다 (이 창구의 뜻 그대로).
       값이 **빈 글자면 안 건드립니다** — 짐작으로 지우지 않습니다 */
    if (r ? 'employ_type') and not ('employ_type' = any(v_잠긴칸))
       and nullif(r->>'employ_type', '') is not null then
      update job_posts j set employ_type = r->>'employ_type'
       where j.id = r->>'id'
         and not coalesce(j.admin_locked, false)
         and j.employ_type is distinct from (r->>'employ_type');
      if found then v_고용형태 := v_고용형태 + 1; end if;
    end if;

    /* ★ 2026-10-19 세중님 3번 — **잘린 제목**을 온전한 제목으로.
       워크넷 목록 API 가 30자로 자른 것이 회원 화면 「기관 원문 제목」에
       「…」 로 보입니다. 상세 API 의 wantedTitle 이 온전합니다.
       제목은 공고의 얼굴이라 **잘린 것만** 바꿉니다 — `제목바꿀만한가()` 가
       ㉠ 지금 것이 잘렸는가 ㉡ 새 것이 그 토막으로 시작하는가 를 봅니다.
       ㉡ 가 authNo 를 잘못 짚었을 때의 그물입니다.
       제목이 바뀌면 `제목채우기_고칠때` 트리거가 보여줄제목을 다시 만듭니다 */
    if (r ? 'title') and not ('title' = any(v_잠긴칸)) then
      update job_posts j set title = r->>'title'
       where j.id = r->>'id'
         and not coalesce(j.admin_locked, false)
         and j.title is distinct from (r->>'title')   /* 같은 글자면 트리거를 깨우지 않습니다 */
         and 제목바꿀만한가(j.title, r->>'title');
      if found then v_제목 := v_제목 + 1; end if;
    end if;

    update job_posts j set
      headcount = case
        when (r ? 'headcount') and not ('headcount' = any(v_잠긴칸))
             and (j.headcount is null
                  /* ★ 2026-10-24 세중님 ㉠ 승인 — **까닭이 적혀 있으면 덮습니다.**
                     통합 공고에서 다른 직군 인원을 집은 값을 고치는 자리입니다.
                     창구는 「통합 공고인가」를 스스로 가리지 않습니다 — 부르는 쪽이
                     `인원덮기까닭` 을 적어 보내야 합니다 (좁히는 자는
                     tools/낡은칸덮기.mjs 의 좁은근거인가() 하나입니다).
                     edited_fields·admin_locked 는 위에서 이미 건너뜁니다 */
                  or nullif(r->>'인원덮기까닭','') is not null)
        then (r->>'headcount')::int else j.headcount end,
      apply_to_time = case
        when (r ? 'apply_to_time') and j.apply_to_time is null
             and not ('apply_to_time' = any(v_잠긴칸))
        then (r->>'apply_to_time')::time else j.apply_to_time end,
      work_place = case
        when (r ? 'work_place') and coalesce(j.work_place, '') = ''
             and not ('work_place' = any(v_잠긴칸))
        then r->>'work_place' else j.work_place end,
      detail = case
        when (r ? 'detail') and not ('detail' = any(v_잠긴칸))
        then coalesce(r->'detail', '{}'::jsonb) || coalesce(j.detail, '{}'::jsonb)
        else j.detail end,
      "뽑은값" = coalesce(j."뽑은값", '{}'::jsonb) || coalesce(r->'뽑은값', '{}'::jsonb),
      "뽑은법" = coalesce(j."뽑은법", 'kordoc'),
      "뽑은때" = coalesce(j."뽑은때", now())
    where j.id = r->>'id';
    if found then v_담음 := v_담음 + 1; end if;
  end loop;

  return jsonb_build_object(
    '담음', v_담음,
    '마감일을 새로 찬 것', v_마감일찬것,
    '잠겨서 건너뜀', v_건너뜀,
    '그 공고가 없음', v_없음,
    'updated_at', '안 바꿨습니다',
    'apply_to', 'null 일 때만 찼습니다 — 값이 있으면 안 건드렸습니다',
    'employ_type', v_고용형태 || '건 바로잡았습니다 (덮습니다 · edited_fields·admin_locked 는 건너뜀)',
    'title', v_제목 || '건 — **잘린 제목만** 바꿨습니다 (제목바꿀만한가: 잘렸고 · 같은 토막으로 시작하고 · 더 긴 것)');
end $$;


ALTER FUNCTION public."칸되메우기"(p_rows jsonb) OWNER TO postgres;

--
-- Name: 커버리지(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."커버리지"() RETURNS TABLE("갈래" text, "대상" integer, "들어온곳" integer, "퍼센트" integer, "분모인가" boolean, "어떻게" text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with 긁힌곳 as (
    select distinct 견줄이름(org_name) k
      from job_posts
     where collected_at > now() - interval '30 days' and org_name is not null
  )
  select t.갈래,
         count(*)::int,
         count(*) filter (where 견줄이름(t.name) in (select k from 긁힌곳))::int,
         round(100.0 * count(*) filter (where 견줄이름(t.name) in (select k from 긁힌곳)) / count(*))::int,
         bool_and(t.커버리지분모),
         case when bool_and(t.커버리지분모) then '기관마다 봅니다'
              else '중앙 게시판 한 곳으로 모입니다 — 기관 수로 세지 않습니다' end
    from org_targets t
   group by t.갈래
   order by bool_and(t.커버리지분모) desc, count(*) desc;
$$;


ALTER FUNCTION public."커버리지"() OWNER TO postgres;

--
-- Name: 판정남기기(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."판정남기기"(p_secret text, p_source text, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception '판정은 한 번에 500개까지입니다';
  end if;
  insert into 수집판정 (source, 번호, 판정, 지문, 판정때)
  select p_source,
         e->>'번호',
         left(coalesce(e->>'판정', '모름'), 40),
         left(coalesce(e->>'지문', ''), 64),
         now()
    from jsonb_array_elements(p_rows) e
   where coalesce(e->>'번호', '') <> ''
  on conflict (source, 번호) do update
     set 판정 = excluded.판정, 지문 = excluded.지문, 판정때 = excluded.판정때;
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION public."판정남기기"(p_secret text, p_source text, p_rows jsonb) OWNER TO postgres;

--
-- Name: 판정물어보기(text, text, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."판정물어보기"(p_secret text, p_source text, p_ids text[]) RETURNS TABLE("번호" text, "지문" text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;
  if array_length(p_ids, 1) > 500 then
    raise exception '번호는 한 번에 500개까지입니다';
  end if;
  return query
    select t.번호, t.지문 from 수집판정 t
     where t.source = p_source and t.번호 = any(p_ids);
end $$;


ALTER FUNCTION public."판정물어보기"(p_secret text, p_source text, p_ids text[]) OWNER TO postgres;

--
-- Name: 페르소나바꾸기(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public."페르소나바꾸기"("p_역할" text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid := auth.uid(); v_보관 jsonb; v_남길 text[];
begin
  if not 마스터인가() then
    raise exception '마스터 계정만 바꿀 수 있습니다' using errcode = '42501';
  end if;
  if p_역할 not in ('관리자','학생','작업치료사','물리치료사',
                    '채용담당자','교육담당자','채용+교육담당자','가입중','비회원') then
    raise exception '모르는 역할입니다 (%)', p_역할 using errcode = '22023';
  end if;

  /* 「비회원」은 보기만 바꿉니다. profiles·회원자격을 한 줄도 안 건드립니다 */
  if p_역할 = '비회원' then
    update 마스터페르소나 set 지금역할 = '비회원', 바뀐때 = now() where auth_id = v;
    return 내페르소나();
  end if;

  select 보관 into v_보관 from 마스터페르소나 where auth_id = v;
  if v_보관 is null or v_보관 = '{}'::jsonb then
    select jsonb_build_object('role', role, 'job_group', job_group, 'survey_at', survey_at)
      into v_보관 from profiles where id = v;
    update 마스터페르소나 set 보관 = v_보관 where auth_id = v;
  end if;

  if p_역할 = '가입중' then
    update profiles set survey_at = null where id = v;
  elsif p_역할 = '학생' then
    update profiles set role = '학생',
                        job_group = coalesce(job_group, '작업치료사'),
                        survey_at = coalesce(survey_at, now()) where id = v;
  elsif p_역할 = '작업치료사' then
    update profiles set role = '현직', job_group = '작업치료사',
                        survey_at = coalesce(survey_at, now()) where id = v;
  elsif p_역할 = '물리치료사' then
    update profiles set role = '현직', job_group = '물리치료사',
                        survey_at = coalesce(survey_at, now()) where id = v;
  elsif p_역할 in ('채용담당자','교육담당자','채용+교육담당자') then
    update profiles set role = null, job_group = null,
                        survey_at = coalesce(survey_at, now()) where id = v;
  else
    update profiles
       set role      = coalesce(v_보관->>'role', role),
           job_group = coalesce(v_보관->>'job_group', job_group),
           survey_at = coalesce((v_보관->>'survey_at')::timestamptz, survey_at, now())
     where id = v;
  end if;

  /* 이 페르소나에서 **살려 둘 갈래**. 나머지 승인은 정지시킵니다 */
  v_남길 := case p_역할
              when '채용담당자'      then array['채용담당자']
              when '교육담당자'      then array['교육담당자기관']
              when '채용+교육담당자' then array['채용담당자','교육담당자기관']
              else array[]::text[] end;

  update 회원자격 set 상태 = '정지'
   where profile_id = v and 상태 = '승인' and not (갈래 = any(v_남길));

  if p_역할 in ('채용담당자','채용+교육담당자') then
    insert into 회원자격 (profile_id, 갈래, 기관번호, 상태, 정한사람, 정한때, 시험자료)
    select v, '채용담당자', o.기관번호, '승인', v, now(), true
      from 기관 o where o.이름 = '시험병원 (마스터 전용)'
    on conflict (profile_id, 기관번호) where 갈래 = '채용담당자'
      do update set 상태 = '승인', 시험자료 = true;
  end if;
  if p_역할 in ('교육담당자','채용+교육담당자') then
    insert into 회원자격 (profile_id, 갈래, 교육기관, 상태, 정한사람, 정한때, 시험자료)
    values (v, '교육담당자기관', '시험 교육기관 (마스터 전용)', '승인', v, now(), true)
    on conflict (profile_id, 교육기관) where 갈래 = '교육담당자기관'
      do update set 상태 = '승인', 시험자료 = true;
  end if;

  update 마스터페르소나 set 지금역할 = p_역할, 바뀐때 = now() where auth_id = v;
  return 내페르소나();
end $$;


ALTER FUNCTION public."페르소나바꾸기"("p_역할" text) OWNER TO postgres;

--
-- Name: admin_jobs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.admin_jobs AS
 SELECT id,
    source,
    org_name,
    title,
    job_group,
    employ_type,
    work_place,
    sido,
    sgg,
    org_kind,
    tab,
    headcount,
    apply_from,
    apply_to,
    posted_at,
    url,
    hidden,
    hold,
    detail,
    evidence,
    collected_at,
    updated_at,
    hidden_why,
    hidden_on,
    admin_locked,
    admin_note,
    admin_at,
    public."마감표시"(apply_to, id, tab, org_name, title, (evidence ->> '접수문장'::text)) AS "마감표시",
    "뽑은값"
   FROM public.job_posts
  WHERE public.is_admin();


ALTER VIEW public.admin_jobs OWNER TO postgres;

--
-- Name: VIEW admin_jobs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.admin_jobs IS '관리자용 공고 뷰. 2026-10-03 에 admin_locked·admin_note·admin_at 을 더했습니다 — 화면(ADMIN_LIST_COLS)이 달라는데 없어서 목록 요청이 42703 으로 통째로 실패했습니다';


--
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    profile_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    "갈래" text DEFAULT '대표'::text NOT NULL,
    "끈사람" uuid,
    "끈때" timestamp with time zone,
    "넣은사람" uuid,
    "메모" text,
    CONSTRAINT "admins_갈래_check" CHECK (("갈래" = ANY (ARRAY['대표'::text, '직원'::text])))
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- Name: TABLE admins; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admins IS '관리자. profiles.role 칸으로 두면 profiles RLS 가 자기를 다시 읽어 재귀에 걸립니다';


--
-- Name: alio_compete; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_compete (
    sn bigint NOT NULL,
    step_sn bigint NOT NULL,
    inst_nm text,
    pbanc_ttl text,
    step_ttl text,
    end_ymd date,
    year smallint,
    sort_no smallint,
    step_order smallint,
    is_last boolean,
    recrut_nope integer,
    recrut_nope_state text,
    aply_nope integer,
    aply_nope_state text,
    cmptt_rt numeric,
    cmptt_rt_state text,
    rsn_ymd date,
    our_job text,
    mixed boolean DEFAULT false NOT NULL,
    raw jsonb NOT NULL,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    group_key bigint,
    group_steps smallint,
    first_aply integer,
    final_nope integer
);


ALTER TABLE public.alio_compete OWNER TO postgres;

--
-- Name: TABLE alio_compete; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alio_compete IS '알리오 전형단계별 선발·응시·경쟁률. 화면에는 아직 안 붙입니다 — 모으기만 (2026-09-29)';


--
-- Name: alio_compete_web; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_compete_web (
    sn bigint NOT NULL,
    group_no smallint NOT NULL,
    step_no smallint NOT NULL,
    group_name text,
    step_name text,
    recrut_nope integer,
    aply_nope integer,
    rsn_ymd date,
    is_last boolean DEFAULT false NOT NULL,
    group_steps smallint,
    first_aply integer,
    final_nope integer,
    cmptt_rt numeric,
    cmptt_rt_state text,
    rt_src text,
    our_job text,
    mixed boolean DEFAULT false NOT NULL,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    "직군키" text,
    "지역" text,
    "자리이름" text,
    "묶음키" text,
    "짝확인필요" boolean DEFAULT false NOT NULL,
    step_kind text,
    step_kind_src text,
    "고용형태" text,
    "고용형태출처" text,
    "우리직군" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.alio_compete_web OWNER TO postgres;

--
-- Name: TABLE alio_compete_web; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alio_compete_web IS '알리오 웹의 전형단계별 채용정보. API /detail 이 뒤쪽 단계를 비워 보내서 웹에서 읽습니다.';


--
-- Name: alio_compete_web_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_compete_web_state (
    sn bigint NOT NULL,
    "읽은때" timestamp with time zone DEFAULT now() NOT NULL,
    "묶음수" smallint,
    "왜" text
);


ALTER TABLE public.alio_compete_web_state OWNER TO postgres;

--
-- Name: alio_group_sum; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_group_sum (
    "묶음키" text NOT NULL,
    "기관" text,
    "직군" text,
    "지역" text,
    "고용형태" text,
    "자리" text,
    "회차" integer,
    "첫해" smallint,
    "끝해" smallint,
    "값있음" integer,
    "평균" numeric,
    "가장높음" numeric,
    "가장낮음" numeric,
    "계산불가" integer,
    "미등록" integer,
    "짝확인필요" boolean DEFAULT false NOT NULL,
    "고용형태확인필요" boolean DEFAULT false NOT NULL,
    "한회뿐" boolean DEFAULT false NOT NULL,
    "합쳐짐" boolean DEFAULT false NOT NULL,
    "기본값단계" boolean DEFAULT false NOT NULL,
    "갱신때" timestamp with time zone DEFAULT now() NOT NULL,
    "우리직군" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.alio_group_sum OWNER TO postgres;

--
-- Name: TABLE alio_group_sum; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alio_group_sum IS '묶음 요약. 화면이 6,069줄을 매번 묶으면 8초 제한에 걸려서 미리 계산해 둡니다. alio_group_refresh() 가 갱신합니다.';


--
-- Name: alio_hiretype_fix; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_hiretype_fix (
    sn bigint NOT NULL,
    group_no smallint NOT NULL,
    "고용형태" text NOT NULL,
    "누가" text,
    "언제" timestamp with time zone DEFAULT now() NOT NULL,
    "메모" text
);


ALTER TABLE public.alio_hiretype_fix OWNER TO postgres;

--
-- Name: TABLE alio_hiretype_fix; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alio_hiretype_fix IS '관리자가 직접 고른 고용형태. 수집기가 절대 덮어쓰지 않습니다.';


--
-- Name: alio_post_file; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_post_file (
    sn bigint NOT NULL,
    file_no bigint NOT NULL,
    sort_no smallint,
    "파일이름" text,
    "파일갈래" text,
    url text,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    "글" text,
    "왜" text
);


ALTER TABLE public.alio_post_file OWNER TO postgres;

--
-- Name: COLUMN alio_post_file."글"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alio_post_file."글" IS '첨부에서 뽑은 글자. hwp 는 바로 읽고, pdf 는 OCR 열쇠가 있어야 합니다';


--
-- Name: alio_post_meta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alio_post_meta (
    sn bigint NOT NULL,
    "근무지" text,
    "고용형태" text,
    "근무분야" text,
    "전형절차" text,
    taken_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.alio_post_meta OWNER TO postgres;

--
-- Name: api_quota; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_quota (
    "날" date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL,
    "서비스" text NOT NULL,
    "한도" bigint,
    "남음" bigint,
    "쓴양" bigint GENERATED ALWAYS AS (("한도" - "남음")) STORED,
    "본때" timestamp with time zone DEFAULT now() NOT NULL,
    "경로" text
);


ALTER TABLE public.api_quota OWNER TO postgres;

--
-- Name: api_roster; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_roster (
    source text NOT NULL,
    org_name text NOT NULL,
    name_key text NOT NULL,
    posts integer DEFAULT 0 NOT NULL,
    last_posted date,
    fetched_on date NOT NULL,
    scanned integer,
    CONSTRAINT api_roster_source_check CHECK ((source = ANY (ARRAY['AL'::text, 'CE'::text])))
);


ALTER TABLE public.api_roster OWNER TO postgres;

--
-- Name: COLUMN api_roster.posts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.api_roster.posts IS '훑은 범위 안에서 본 공고 수 (직군 안 가림)';


--
-- Name: COLUMN api_roster.scanned; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.api_roster.scanned IS '그때 훑은 전체 공고 건수. posts 를 읽을 때 같이 봐야 합니다';


--
-- Name: chat_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_members (
    room_id bigint NOT NULL,
    profile_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chat_members OWNER TO postgres;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id bigint NOT NULL,
    room_id bigint NOT NULL,
    sender_id uuid NOT NULL,
    body text,
    image_path text,
    image_thumb_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    "본때" timestamp with time zone,
    CONSTRAINT chat_messages_check CHECK (((body IS NOT NULL) OR (image_path IS NOT NULL)))
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_rooms (
    id bigint NOT NULL,
    dm_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    "상태" text DEFAULT '수락'::text NOT NULL,
    "건사람" uuid,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "chat_rooms_상태_check" CHECK (("상태" = ANY (ARRAY['신청'::text, '수락'::text, '거절'::text])))
);


ALTER TABLE public.chat_rooms OWNER TO postgres;

--
-- Name: chat_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_rooms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_rooms_id_seq OWNER TO postgres;

--
-- Name: chat_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_rooms_id_seq OWNED BY public.chat_rooms.id;


--
-- Name: collect_secret_all; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collect_secret_all (
    source text NOT NULL,
    secret text NOT NULL,
    note text,
    made_on date DEFAULT CURRENT_DATE,
    "끈때" timestamp with time zone,
    "끈까닭" text
);


ALTER TABLE public.collect_secret_all OWNER TO postgres;

--
-- Name: TABLE collect_secret_all; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.collect_secret_all IS '수집기가 DB 함수를 부를 때 내는 내부 열쇠. 한 source 에 여러 개 둘 수 있습니다 — 서버로 옮기는 동안 옛 열쇠와 새 열쇠가 같이 살아야 해서 2026-09-30 에 바꿨습니다. 함수들은 「있나」만 보므로 어느 쪽이든 통과합니다. 되돌리기: sql/2026-09-30_서버전용열쇠_되돌리기.sql';


--
-- Name: collect_secret; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.collect_secret AS
 SELECT source,
    secret,
    note,
    made_on,
    "끈때",
    "끈까닭"
   FROM public.collect_secret_all
  WHERE ("끈때" IS NULL);


ALTER VIEW public.collect_secret OWNER TO postgres;

--
-- Name: collect_source; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collect_source (
    code text NOT NULL,
    name text NOT NULL,
    note text,
    live boolean DEFAULT true,
    "늦음기준시간" numeric,
    "마감시각줌" boolean
);


ALTER TABLE public.collect_source OWNER TO postgres;

--
-- Name: TABLE collect_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.collect_source IS '공고가 어느 경로로 들어왔나. job_posts.source 가 이 표의 code 입니다. 빨간 줄·경로지도가 이 표를 봅니다';


--
-- Name: COLUMN collect_source."늦음기준시간"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.collect_source."늦음기준시간" IS '늦음 기준(시간). 적어 두면 beat_health 가 「평소 간격 × 2」 대신 이 값을 씁니다.
   주 1회처럼 박동이 드물어 간격 가운데값을 못 믿는 경로에 씁니다 (2026-10-05).';


--
-- Name: COLUMN collect_source."마감시각줌"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.collect_source."마감시각줌" IS '그 출처에서 마감 「시각」을 얻을 수 있나 (2026-10-14). true=얻는 길이 있다 · false=없다고 확인했다 · null=미정(확인 안 함). 네숫자() 의 ③ 마감시각 분모가 이 칸입니다';


--
-- Name: collectable_orgs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collectable_orgs (
    org_name text NOT NULL,
    ok boolean NOT NULL,
    reason text,
    from_where text,
    checked_on date,
    n integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.collectable_orgs OWNER TO postgres;

--
-- Name: TABLE collectable_orgs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.collectable_orgs IS '한 번이라도 자동으로 받아온 기관. 커버리지 숫자의 근거';


--
-- Name: collector_beat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collector_beat (
    id bigint NOT NULL,
    source text NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    took_ms integer,
    ok boolean DEFAULT true NOT NULL,
    "본곳" integer,
    "담음" integer,
    "보류" integer,
    "버림" integer,
    "못받음" integer,
    "왜" text,
    "메모" jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.collector_beat OWNER TO postgres;

--
-- Name: TABLE collector_beat; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.collector_beat IS '수집기가 한 바퀴 돌 때마다 남기는 기록. 관리자 화면이 「안 돌았다」 를 이걸로 압니다 (2026-09-28)';


--
-- Name: collector_beat_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.collector_beat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.collector_beat_id_seq OWNER TO postgres;

--
-- Name: collector_beat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.collector_beat_id_seq OWNED BY public.collector_beat.id;


--
-- Name: collector_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collector_state (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.collector_state OWNER TO postgres;

--
-- Name: TABLE collector_state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.collector_state IS '수집기 상태. RLS 를 켜고 규칙을 하나도 안 만들어 service_role 만 닿습니다 — 의도한 것입니다';


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    parent_id bigint,
    author_id uuid NOT NULL,
    body text NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: dementia_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dementia_centers (
    id bigint NOT NULL,
    name text NOT NULL,
    kind text,
    road_addr text,
    jibun_addr text,
    lat numeric,
    lng numeric,
    est_ym text,
    area text,
    facilities text,
    doctors integer,
    nurses integer,
    social_workers integer,
    others text,
    operator text,
    operator_ceo text,
    operator_tel text,
    entrust_date text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.dementia_centers OWNER TO postgres;

--
-- Name: dementia_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dementia_centers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dementia_centers_id_seq OWNER TO postgres;

--
-- Name: dementia_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dementia_centers_id_seq OWNED BY public.dementia_centers.id;


--
-- Name: dementia_safe_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dementia_safe_centers (
    id bigint NOT NULL,
    name text NOT NULL,
    sido text,
    sgg text,
    zipcode text,
    addr1 text,
    addr2 text,
    road_code text,
    dong_code text,
    adm_code text,
    lat numeric,
    lng numeric,
    homepage text,
    tel text,
    fax text,
    opened_on text
);


ALTER TABLE public.dementia_safe_centers OWNER TO postgres;

--
-- Name: dementia_safe_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dementia_safe_centers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dementia_safe_centers_id_seq OWNER TO postgres;

--
-- Name: dementia_safe_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dementia_safe_centers_id_seq OWNED BY public.dementia_safe_centers.id;


--
-- Name: dev_rehab_orgs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dev_rehab_orgs (
    id bigint NOT NULL,
    name text NOT NULL,
    sido text,
    sgg text,
    road_addr text,
    jibun_addr text,
    lat numeric,
    lng numeric,
    tel text,
    service text,
    ceo text,
    mgr_org text,
    mgr_tel text,
    as_of text,
    provider_code text,
    provider_name text
);


ALTER TABLE public.dev_rehab_orgs OWNER TO postgres;

--
-- Name: dev_rehab_orgs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dev_rehab_orgs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dev_rehab_orgs_id_seq OWNER TO postgres;

--
-- Name: dev_rehab_orgs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dev_rehab_orgs_id_seq OWNED BY public.dev_rehab_orgs.id;


--
-- Name: drop_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drop_rules (
    key text NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    note text,
    evidence_n integer DEFAULT 0 NOT NULL,
    example text,
    enabled boolean DEFAULT true NOT NULL,
    blocked_n integer DEFAULT 0 NOT NULL,
    created_on date,
    last_used_at timestamp with time zone
);


ALTER TABLE public.drop_rules OWNER TO postgres;

--
-- Name: TABLE drop_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.drop_rules IS '버린 공고에서 뽑아낸 규칙. 끄면 안 씁니다';


--
-- Name: erased_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.erased_accounts (
    profile_id uuid NOT NULL,
    joined_at timestamp with time zone,
    erased_at timestamp with time zone DEFAULT now() NOT NULL,
    "이름암호" bytea,
    "이름지운때" timestamp with time zone,
    "이름지문" bytea,
    "애플끊기" text,
    "애플끊은때" timestamp with time zone
);


ALTER TABLE public.erased_accounts OWNER TO postgres;

--
-- Name: TABLE erased_accounts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.erased_accounts IS '지운 계정의 원래 이름. 관리자만 읽습니다 — 분쟁 때 누구 글인지 가릅니다';


--
-- Name: COLUMN erased_accounts."애플끊기"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.erased_accounts."애플끊기" IS '탈퇴할 때 appleid.apple.com/auth/revoke 를 부른 결과. 「200」·「끊을 것 없음」·「열쇠 없음」·「HTTP 400 …」 (2026-10-11)';


--
-- Name: hand_check; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hand_check (
    "이름" text NOT NULL,
    "결과" text,
    "공고줄" integer,
    "까닭" text,
    "어디서" text,
    "마지막확인" timestamp with time zone DEFAULT now() NOT NULL,
    "마지막열린날" date,
    "사람이본날" date,
    "메모" text
);


ALTER TABLE public.hand_check OWNER TO postgres;

--
-- Name: TABLE hand_check; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.hand_check IS '기계가 못 가는 곳. 아마존 대역에서 막는 병원들. 자세한 것은 손으로_확인할곳.md';


--
-- Name: hira_cl_cd; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hira_cl_cd (
    cl_cd text NOT NULL,
    cl_cd_nm text NOT NULL,
    "차례" integer NOT NULL,
    "비고" text
);


ALTER TABLE public.hira_cl_cd OWNER TO postgres;

--
-- Name: hira_detail; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hira_detail (
    ykiho text NOT NULL,
    perm_sbd integer,
    std_sbd integer,
    ptrm_cnt integer,
    org_ty_cd text,
    org_ty_nm text,
    pt integer,
    ot integer,
    pharm integer,
    social integer,
    rehab_sdr integer,
    eqp_at timestamp with time zone,
    hst_at timestamp with time zone,
    sdr_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hira_detail OWNER TO postgres;

--
-- Name: hira_org; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hira_org (
    ykiho text NOT NULL,
    yadm_nm text NOT NULL,
    cl_cd text,
    cl_cd_nm text,
    sido_cd integer,
    sido_nm text,
    sggu_cd integer,
    sggu_nm text,
    emdong_nm text,
    addr text,
    tel text,
    hosp_url text,
    estb_dd date,
    x_pos double precision,
    y_pos double precision,
    name_key text,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hira_org OWNER TO postgres;

--
-- Name: hira_quota; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hira_quota (
    day date NOT NULL,
    requests integer DEFAULT 0 NOT NULL,
    note text
);


ALTER TABLE public.hira_quota OWNER TO postgres;

--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hospitals (
    id bigint NOT NULL,
    name text NOT NULL,
    kind text,
    sido text,
    sgg text,
    ot integer,
    pt integer,
    sw integer,
    bed integer,
    doc integer,
    rehab integer,
    im integer,
    nr integer,
    ns integer,
    os integer,
    fm integer,
    addr text,
    tel text,
    data_version text
);


ALTER TABLE public.hospitals OWNER TO postgres;

--
-- Name: TABLE hospitals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.hospitals IS '심평원 병원정보. 원본 hospital_data.json (cols 17개 순서 그대로)';


--
-- Name: org_alias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_alias (
    our_name text NOT NULL,
    hira_name text NOT NULL,
    why text,
    added_on date DEFAULT CURRENT_DATE NOT NULL,
    kind text DEFAULT '심평원'::text NOT NULL,
    CONSTRAINT org_alias_kind_ok CHECK ((kind = ANY (ARRAY['심평원'::text, '모기관'::text, '호스트'::text, '경쟁사'::text])))
);


ALTER TABLE public.org_alias OWNER TO postgres;

--
-- Name: COLUMN org_alias.hira_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.org_alias.hira_name IS '붙일 상대 이름. kind=심평원 이면 심평원 표기, kind=모기관 이면 명부(api_roster)에 올라오는 모기관 이름';


--
-- Name: COLUMN org_alias.kind; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.org_alias.kind IS '이 별칭이 무엇을 잇나 — 심평원 이름 대조인지, 분원→모기관인지';


--
-- Name: org_note; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_note (
    name text NOT NULL,
    note text NOT NULL,
    added_on date DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE public.org_note OWNER TO postgres;

--
-- Name: public_hospitals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.public_hospitals (
    id bigint NOT NULL,
    seq integer,
    name text NOT NULL,
    kind text,
    agency text,
    law text,
    est_type text,
    er text,
    beds integer,
    addr text,
    homepage text,
    tel text,
    fax text
);


ALTER TABLE public.public_hospitals OWNER TO postgres;

--
-- Name: org_targets; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.org_targets AS
 SELECT public.org_key(h.name) AS key,
    h.name,
    h.kind,
    h.sido,
    h.sgg,
        CASE
            WHEN (h.kind = '상급종합'::text) THEN '상급종합'::text
            WHEN (h.name ~~ '%대학%병원%'::text) THEN '대학병원'::text
            ELSE '종합병원'::text
        END AS "갈래",
    n.note,
    true AS "커버리지분모"
   FROM (public.hospitals h
     LEFT JOIN public.org_note n ON ((n.name = h.name)))
  WHERE ((h.kind = ANY (ARRAY['상급종합'::text, '종합병원'::text])) OR (h.name ~~ '%대학%병원%'::text))
UNION ALL
 SELECT public.org_key(h.name) AS key,
    h.name,
    h.kind,
    h.sido,
    h.sgg,
    '보건기관'::text AS "갈래",
    n.note,
    true AS "커버리지분모"
   FROM (public.hospitals h
     LEFT JOIN public.org_note n ON ((n.name = h.name)))
  WHERE (h.kind = ANY (ARRAY['보건소'::text, '보건지소'::text, '보건의료원'::text]))
UNION ALL
 SELECT public.org_key(p.name) AS key,
    p.name,
    p.kind,
    NULL::text AS sido,
    NULL::text AS sgg,
    '공공보건의료'::text AS "갈래",
    n.note,
    true AS "커버리지분모"
   FROM (public.public_hospitals p
     LEFT JOIN public.org_note n ON ((n.name = p.name)))
UNION ALL
 SELECT public.org_key(d.name) AS key,
    d.name,
    '치매센터'::text AS kind,
    NULL::text AS sido,
    NULL::text AS sgg,
    '치매센터'::text AS "갈래",
    n.note,
    false AS "커버리지분모"
   FROM (public.dementia_centers d
     LEFT JOIN public.org_note n ON ((n.name = d.name)))
UNION ALL
 SELECT public.org_key(s.name) AS key,
    s.name,
    '치매안심센터'::text AS kind,
    s.sido,
    s.sgg,
    '치매안심센터'::text AS "갈래",
    n.note,
    false AS "커버리지분모"
   FROM (public.dementia_safe_centers s
     LEFT JOIN public.org_note n ON ((n.name = s.name)));


ALTER VIEW public.org_targets OWNER TO postgres;

--
-- Name: VIEW org_targets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.org_targets IS '우리가 봐야 할 기관 목록. 커버리지분모=false 는 중앙 게시판으로 모이는 갈래 — 기관 수로 세지 않습니다 (2026-10-11)';


--
-- Name: hira_todo; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.hira_todo AS
 WITH "목표열쇠" AS (
         SELECT public.hira_name_key(t.name) AS k
           FROM public.org_targets t
        UNION
         SELECT public.hira_name_key(a.hira_name) AS hira_name_key
           FROM public.org_alias a
        )
 SELECT o.ykiho,
    o.yadm_nm,
    o.cl_cd_nm,
    (o.name_key IN ( SELECT "목표열쇠".k
           FROM "목표열쇠")) AS is_target,
        CASE
            WHEN (o.name_key IN ( SELECT "목표열쇠".k
               FROM "목표열쇠")) THEN 1
            ELSE COALESCE(c."차례", 9)
        END AS "차례"
   FROM (public.hira_org o
     LEFT JOIN public.hira_cl_cd c ON ((c.cl_cd = o.cl_cd)))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM public.hira_detail d
          WHERE (d.ykiho = o.ykiho))));


ALTER VIEW public.hira_todo OWNER TO postgres;

--
-- Name: home_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.home_blocks (
    id bigint NOT NULL,
    kind text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    emoji text,
    image_path text,
    title text NOT NULL,
    descr text,
    href text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    metric text,
    icon text,
    CONSTRAINT home_blocks_kind_check CHECK ((kind = ANY (ARRAY['top'::text, 'category'::text, 'big'::text, 'comm'::text]))),
    CONSTRAINT home_blocks_metric_check CHECK (((metric IS NULL) OR (metric = ANY (ARRAY['deadline'::text, 'coverage'::text, 'hot'::text]))))
);


ALTER TABLE public.home_blocks OWNER TO postgres;

--
-- Name: TABLE home_blocks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.home_blocks IS '홈 화면의 상단 배너·카테고리·큰 배너. 관리자가 고칩니다';


--
-- Name: COLUMN home_blocks.kind; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.home_blocks.kind IS 'top 홈 상단배너 · category 홈 카테고리 · big 홈 큰배너 · comm 커뮤니티 배너';


--
-- Name: COLUMN home_blocks.emoji; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.home_blocks.emoji IS '카테고리 이모지. image_path 를 채우면 그림이 먼저입니다';


--
-- Name: COLUMN home_blocks.metric; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.home_blocks.metric IS '큰 배너에 띄울 숫자. deadline=이번 주 마감 · coverage=공고/기관 수 · hot=인기 글. 비우면 문구만';


--
-- Name: home_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.home_blocks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.home_blocks_id_seq OWNER TO postgres;

--
-- Name: home_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.home_blocks_id_seq OWNED BY public.home_blocks.id;


--
-- Name: home_texts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.home_texts (
    key text NOT NULL,
    area text NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    multiline boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone,
    updated_by uuid
);


ALTER TABLE public.home_texts OWNER TO postgres;

--
-- Name: TABLE home_texts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.home_texts IS '홈 랜딩 문구. 코드에는 기본값만 남기고 여기 값이 있으면 그걸 씁니다';


--
-- Name: hosp_kind_stat; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.hosp_kind_stat AS
 SELECT kind,
    count(*) AS n,
    percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((((bed)::numeric / ((ot + pt))::numeric))::double precision)) AS p25,
    percentile_cont((0.50)::double precision) WITHIN GROUP (ORDER BY ((((bed)::numeric / ((ot + pt))::numeric))::double precision)) AS med,
    percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((((bed)::numeric / ((ot + pt))::numeric))::double precision)) AS p75
   FROM public.hospitals
  WHERE ((bed > 0) AND ((COALESCE(ot, 0) + COALESCE(pt, 0)) > 0))
  GROUP BY kind
 HAVING (count(*) >= 20)
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.hosp_kind_stat OWNER TO postgres;

--
-- Name: hosp_sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosp_sites (
    name text NOT NULL,
    url text,
    base text,
    kind text NOT NULL,
    off_why text,
    note text,
    loaded_on date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL,
    url_key text GENERATED ALWAYS AS (COALESCE(url, ''::text)) STORED NOT NULL,
    "채용주소" text,
    "갈래" text,
    "긁는규칙" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "끔" boolean DEFAULT false NOT NULL,
    "끈까닭" text,
    "집에서만" boolean DEFAULT false NOT NULL,
    "옮긴날" date,
    "이름열쇠" text GENERATED ALWAYS AS (public."견줄이름"(name)) STORED,
    ykiho text
);


ALTER TABLE public.hosp_sites OWNER TO postgres;

--
-- Name: TABLE hosp_sites; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.hosp_sites IS 'gas/wage.js 의 HOSP_SITES 를 담습니다. **gas 가 주인이고 여기는 사본입니다.**
   경로지도(org_coverage)가 「홈페이지 길이 있나」를 알려면 DB 안에 있어야 합니다.
   note(사람이 읽는 긴 메모)는 안 담습니다 — 지도에 안 쓰고 gas 에 그대로 있습니다.';


--
-- Name: COLUMN hosp_sites."채용주소"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hosp_sites."채용주소" IS '채용게시판 주소. url 칸은 홈페이지 뿌리인 곳이 142곳이라 따로 둡니다 (2026-10-12)';


--
-- Name: COLUMN hosp_sites."갈래"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hosp_sites."갈래" IS 'html(261) · appsite(12) · cmc(6) · schmc(4) · greeting(4) · listjson(1) — sites.mjs 가 쓰는 값';


--
-- Name: COLUMN hosp_sites."긁는규칙"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hosp_sites."긁는규칙" IS 'row·link·only·not·enc·host·base·cls·clsTitle·dept — HOSP_SITES 의 나머지 칸을 통째로';


--
-- Name: COLUMN hosp_sites."끔"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hosp_sites."끔" IS '수집기가 건너뛸까. HOSP_SITES 의 off. 지금 42곳입니다 (DB off_why 의 47 이 아닙니다)';


--
-- Name: COLUMN hosp_sites."집에서만"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hosp_sites."집에서만" IS 'HOSP_SITES 의 athome — 서버 IP 로는 막히고 집에서만 열리는 곳 (26곳)';


--
-- Name: COLUMN hosp_sites.ykiho; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hosp_sites.ykiho IS '심평원 요양기관번호 — 같은 이름 다른 병원을 가립니다 (2026-10-24 세중님 1번)';


--
-- Name: hospitals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hospitals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hospitals_id_seq OWNER TO postgres;

--
-- Name: hospitals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hospitals_id_seq OWNED BY public.hospitals.id;


--
-- Name: job_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_attachments (
    id bigint NOT NULL,
    job_id text NOT NULL,
    kind text,
    name text,
    url text NOT NULL,
    parsed_at timestamp with time zone,
    "수집묶음" text,
    "만든때" timestamp with time zone DEFAULT now() NOT NULL,
    "읽기탈" text
);


ALTER TABLE public.job_attachments OWNER TO postgres;

--
-- Name: COLUMN job_attachments."만든때"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_attachments."만든때" IS '줄이 생긴 때. 첨부 담기 하루 상한을 이 칸으로 셉니다 (2026-10-14). 전에는 서버 셈 파일 ~/첨부담은수.json 으로 셌습니다';


--
-- Name: COLUMN job_attachments."읽기탈"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_attachments."읽기탈" IS '첨부를 읽어 봤는데 안 된 까닭. 성공이면 null. parsed_at 은 성공·실패 모두 적습니다';


--
-- Name: job_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_attachments_id_seq OWNER TO postgres;

--
-- Name: job_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_attachments_id_seq OWNED BY public.job_attachments.id;


--
-- Name: job_body; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_body (
    job_id text NOT NULL,
    kind text NOT NULL,
    ord smallint DEFAULT 0 NOT NULL,
    source text,
    url text,
    file_name text,
    body text NOT NULL,
    bytes integer GENERATED ALWAYS AS (octet_length(body)) STORED,
    taken_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.job_body OWNER TO postgres;

--
-- Name: TABLE job_body; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_body IS '공고 원문 보관 — 내부용. 회원 화면에 안 나갑니다. 저장 전에 개인정보를 지웁니다 (2026-09-28)';


--
-- Name: job_post_edits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_post_edits (
    id bigint NOT NULL,
    job_id text NOT NULL,
    field text NOT NULL,
    old_value text,
    new_value text,
    edited_by uuid,
    edited_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.job_post_edits OWNER TO postgres;

--
-- Name: TABLE job_post_edits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_post_edits IS '옛 공고수정 시트. 본문은 직접 고치고 여기엔 이력만 쌓습니다';


--
-- Name: job_edit_now; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.job_edit_now WITH (security_invoker='false') AS
 SELECT job_id,
    jsonb_object_agg(field, new_value) AS f
   FROM ( SELECT DISTINCT ON (job_post_edits.job_id, job_post_edits.field) job_post_edits.job_id,
            job_post_edits.field,
            job_post_edits.new_value
           FROM public.job_post_edits
          ORDER BY job_post_edits.job_id, job_post_edits.field, job_post_edits.edited_at DESC, job_post_edits.id DESC) t
  GROUP BY job_id;


ALTER VIEW public.job_edit_now OWNER TO postgres;

--
-- Name: job_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_events (
    id bigint NOT NULL,
    job_id text NOT NULL,
    profile_id uuid,
    kind text NOT NULL,
    value integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_events_kind_check CHECK ((kind = ANY (ARRAY['click'::text, 'stay'::text, 'out'::text, 'star'::text])))
);


ALTER TABLE public.job_events OWNER TO postgres;

--
-- Name: job_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_events_id_seq OWNER TO postgres;

--
-- Name: job_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_events_id_seq OWNED BY public.job_events.id;


--
-- Name: job_hides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_hides (
    job_id text NOT NULL,
    org_name text NOT NULL,
    title text NOT NULL,
    reason text NOT NULL,
    batch text NOT NULL,
    added_on date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL
);


ALTER TABLE public.job_hides OWNER TO postgres;

--
-- Name: job_meta; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.job_meta AS
 SELECT id,
    source,
    collected_at,
    evidence,
    hidden,
    hold,
    updated_at
   FROM public.job_posts
  WHERE public.is_admin();


ALTER VIEW public.job_meta OWNER TO postgres;

--
-- Name: VIEW job_meta; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.job_meta IS '출처·수집일·분류근거. 관리자만 읽습니다 (안에서 is_admin() 으로 잠급니다)';


--
-- Name: job_org; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.job_org AS
 SELECT j.id AS job_id,
    j.source,
    j.org_name,
    j.collected_at,
    p.name AS "붙은기관",
        CASE
            WHEN (p.name IS NULL) THEN NULL::text
            ELSE public.org_name_key(p.name)
        END AS key
   FROM (public.job_posts j
     LEFT JOIN LATERAL ( SELECT o.name
           FROM ( SELECT x.name,
                    1 AS "차례"
                   FROM public.org_public(j.org_name, j.sido, j.title, j.url) x(name, sido_std, sgg_std, addr, tel, kinds, sources, tile, staffed, band, est_type, homepage)
                UNION ALL
                 SELECT x.name,
                    2 AS "차례"
                   FROM public.org_public(j.org_name, NULL::text, j.title, j.url) x(name, sido_std, sgg_std, addr, tel, kinds, sources, tile, staffed, band, est_type, homepage)) o
          ORDER BY o."차례"
         LIMIT 1) p ON (true))
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.job_org OWNER TO postgres;

--
-- Name: job_post_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_post_edits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_post_edits_id_seq OWNER TO postgres;

--
-- Name: job_post_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_post_edits_id_seq OWNED BY public.job_post_edits.id;


--
-- Name: job_posts_pub; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.job_posts_pub AS
 SELECT j.id,
    COALESCE((e.f ->> 'title'::text), j."보여줄제목", j.title) AS title,
    j.org_name,
    j.hire_type,
    COALESCE(public."고용형태보임"((e.f ->> 'employ_type'::text)), public."고용형태보임행"(j.*)) AS employ_type,
    j.work_place,
    COALESCE(j.sido, public.org_sido(NULL::text, j.org_name)) AS sido,
    j.sgg,
    j.edu,
    COALESCE(((e.f ->> 'headcount'::text))::integer, j.headcount) AS headcount,
    COALESCE(((e.f ->> 'apply_from'::text))::date, j.apply_from) AS apply_from,
    COALESCE(((e.f ->> 'apply_to'::text))::date, j.apply_to) AS apply_to,
    j.posted_at,
    j.url,
    COALESCE((e.f ->> 'job_group'::text), j.job_group) AS job_group,
    j.org_kind,
    j.tab,
    j.form,
    j.score,
    (COALESCE(j.detail, '{}'::jsonb) || COALESCE(jsonb_strip_nulls(jsonb_build_object('전형방법', (e.f ->> 'detail.전형방법'::text), '지원자격', (e.f ->> 'detail.지원자격'::text))), '{}'::jsonb)) AS detail,
    (COALESCE((e.f ->> 'title'::text), j.title) ~ '수련생|체험형|청년인턴|인턴'::text) AS is_intern,
    j.title AS "원문제목",
    public."지역보임"(j.*) AS "지역보임",
    (j.evidence ->> '접수문장'::text) AS "접수문장",
    COALESCE(((e.f ->> 'apply_to_time'::text))::time without time zone, j.apply_to_time) AS apply_to_time,
    public."조교연구갈래"(j.title, j.org_name, ((COALESCE(((COALESCE(j.detail, '{}'::jsonb) - '근거'::text))::text, ''::text) || ' '::text) || COALESCE(((COALESCE(j."뽑은값", '{}'::jsonb) - '근거'::text))::text, ''::text))) AS "조교연구"
   FROM ((public.job_posts j
     LEFT JOIN public.job_edit_now e ON ((e.job_id = j.id)))
     LEFT JOIN public.job_hides h ON ((h.job_id = j.id)))
  WHERE ((h.job_id IS NULL) AND (NOT COALESCE(((e.f ->> 'hidden'::text))::boolean, j.hidden)) AND (NOT COALESCE(((e.f ->> 'hold'::text))::boolean, j.hold)) AND ((NOT j."시험자료") OR public."시험자료볼까"()));


ALTER VIEW public.job_posts_pub OWNER TO postgres;

--
-- Name: job_stars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_stars (
    profile_id uuid DEFAULT auth.uid() NOT NULL,
    job_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.job_stars OWNER TO postgres;

--
-- Name: job_state_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_state_log (
    id bigint NOT NULL,
    job_id text NOT NULL,
    "바뀐때" timestamp with time zone DEFAULT now() NOT NULL,
    "누가" text DEFAULT '(안 적힘)'::text NOT NULL,
    "왜" text,
    "옛_hold" boolean,
    "새_hold" boolean,
    "옛_hidden" boolean,
    "새_hidden" boolean,
    "옛_직군" text,
    "새_직군" text,
    "옛_까닭" text,
    "새_까닭" text
);


ALTER TABLE public.job_state_log OWNER TO postgres;

--
-- Name: TABLE job_state_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_state_log IS '공고 상태가 바뀔 때마다 언제·무엇이·왜 바꿨는지. 노원을지 건처럼 까닭을 못 밝히는 일이 없게 (2026-09-29)';


--
-- Name: job_state_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_state_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_state_log_id_seq OWNER TO postgres;

--
-- Name: job_state_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_state_log_id_seq OWNED BY public.job_state_log.id;


--
-- Name: job_sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_sync_log (
    id bigint NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    mode text NOT NULL,
    sheet_total integer,
    read_rows integer DEFAULT 0 NOT NULL,
    upserted integer DEFAULT 0 NOT NULL,
    edits_kept integer DEFAULT 0 NOT NULL,
    took_ms integer,
    ok boolean DEFAULT true NOT NULL,
    note text
);


ALTER TABLE public.job_sync_log OWNER TO postgres;

--
-- Name: job_sync_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.job_sync_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.job_sync_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_tab_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_tab_cards (
    tab_key text NOT NULL,
    image_path text,
    updated_at timestamp with time zone,
    updated_by uuid
);


ALTER TABLE public.job_tab_cards OWNER TO postgres;

--
-- Name: TABLE job_tab_cards; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_tab_cards IS '공고 목록 분류 카드의 그림. 이름·가는 곳은 코드(lib/supabase.ts TABS)에 있습니다';


--
-- Name: job_trash; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_trash (
    id text NOT NULL,
    trashed_at timestamp with time zone NOT NULL,
    source text,
    org_name text,
    title text NOT NULL,
    url text,
    why text NOT NULL,
    restored boolean DEFAULT false NOT NULL,
    restored_at timestamp with time zone
);


ALTER TABLE public.job_trash OWNER TO postgres;

--
-- Name: TABLE job_trash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_trash IS '버림 단어만 있어 안 담은 공고. 자동으로 안 비웁니다. 주인은 gas 의 「쓰레기통」 시트입니다';


--
-- Name: ltc_facilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ltc_facilities (
    id bigint NOT NULL,
    code text,
    name text NOT NULL,
    sido text,
    sgg text,
    dong text,
    addr text,
    kind text,
    capacity integer,
    pt integer,
    ot integer,
    care integer,
    sw integer,
    nurse integer,
    designated_on text
);


ALTER TABLE public.ltc_facilities OWNER TO postgres;

--
-- Name: ltc_facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ltc_facilities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ltc_facilities_id_seq OWNER TO postgres;

--
-- Name: ltc_facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ltc_facilities_id_seq OWNED BY public.ltc_facilities.id;


--
-- Name: mental_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mental_centers (
    id bigint NOT NULL,
    facility_type text,
    facility_kind text,
    name text NOT NULL,
    sido text,
    sgg text,
    addr text
);


ALTER TABLE public.mental_centers OWNER TO postgres;

--
-- Name: mental_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mental_centers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mental_centers_id_seq OWNER TO postgres;

--
-- Name: mental_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mental_centers_id_seq OWNED BY public.mental_centers.id;


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_settings (
    profile_id uuid NOT NULL,
    agreed boolean DEFAULT false NOT NULL,
    items text[] DEFAULT '{}'::text[] NOT NULL,
    target_group text,
    agreed_at timestamp with time zone,
    revoked_at timestamp with time zone
);


ALTER TABLE public.notification_settings OWNER TO postgres;

--
-- Name: ocr_zero; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ocr_zero (
    id bigint NOT NULL,
    "때" timestamp with time zone DEFAULT now() NOT NULL,
    source text NOT NULL,
    "공고" text,
    "파일이름" text,
    "바이트" integer,
    "앞5" text,
    ctype text,
    "원문" text,
    "두번째도0" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.ocr_zero OWNER TO postgres;

--
-- Name: ocr_zero_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ocr_zero_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ocr_zero_id_seq OWNER TO postgres;

--
-- Name: ocr_zero_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ocr_zero_id_seq OWNED BY public.ocr_zero.id;


--
-- Name: site_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_state (
    name text NOT NULL,
    url text,
    auto text,
    fail_streak integer DEFAULT 0,
    last_fail text,
    off_on date,
    off_why text,
    on_on date,
    tried_on date
);


ALTER TABLE public.site_state OWNER TO postgres;

--
-- Name: TABLE site_state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.site_state IS '병원 홈페이지 켜고 끄기. 세 번 연속 실패해야 끄고, 꺼진 곳은 일주일에 한 번 다시 두드립니다. gas 의 「사이트상태」 시트가 원본';


--
-- Name: org_coverage; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.org_coverage AS
 WITH "갈래경로" AS (
         SELECT t_1."갈래",
            t_1.cd,
            t_1.nm,
            t_1."근거"
           FROM ( VALUES ('보건기관'::text,'GJ'::text,'나라일터'::text,'확인'::text), ('치매안심센터'::text,'GJ'::text,'나라일터'::text,'아직'::text), ('치매센터'::text,'ND'::text,'중앙치매센터'::text,'확인'::text)) t_1("갈래", cd, nm, "근거")
        ), "목표" AS (
         SELECT DISTINCT ON ((public.org_name_key(t_1.name))) public.org_name_key(t_1.name) AS key,
            t_1.name,
            t_1.kind,
            t_1.sido,
            t_1.sgg,
            t_1."갈래",
            t_1.note
           FROM public.org_targets t_1
          WHERE (public.org_name_key(t_1.name) <> ''::text)
          ORDER BY (public.org_name_key(t_1.name)),
                CASE t_1."갈래"
                    WHEN '상급종합'::text THEN 1
                    WHEN '대학병원'::text THEN 2
                    WHEN '종합병원'::text THEN 3
                    WHEN '공공보건의료'::text THEN 4
                    WHEN '보건기관'::text THEN 5
                    WHEN '치매센터'::text THEN 6
                    ELSE 7
                END
        ), "공고" AS (
         SELECT o.key,
            count(*) AS "공고수",
            count(*) FILTER (WHERE (o.source = 'AL'::text)) AS "알리오",
            count(*) FILTER (WHERE (o.source = 'CE'::text)) AS "클린아이",
            count(*) FILTER (WHERE (o.source = 'WN'::text)) AS "워크넷",
            count(*) FILTER (WHERE (o.source = 'GJ'::text)) AS "나라일터",
            count(*) FILTER (WHERE (o.source = 'HS'::text)) AS "홈페이지",
            count(*) FILTER (WHERE (o.source = 'ND'::text)) AS "치매센터경로",
            max((o.collected_at)::date) AS "마지막",
            string_agg(DISTINCT o.source, ','::text ORDER BY o.source) AS "수집처"
           FROM public.job_org o
          WHERE (o.key IS NOT NULL)
          GROUP BY o.key
        )
 SELECT t.key,
    t.name AS "기관",
    t."갈래",
    t.kind AS "종별",
    t.sido AS "시도",
    t.sgg AS "시군구",
    t.note AS "손표시",
    COALESCE(c."공고수", (0)::bigint) AS "공고수",
    COALESCE(c."알리오", (0)::bigint) AS "알리오",
    COALESCE(c."클린아이", (0)::bigint) AS "클린아이",
    COALESCE(c."워크넷", (0)::bigint) AS "워크넷",
    COALESCE(c."나라일터", (0)::bigint) AS "나라일터",
    COALESCE(c."홈페이지", (0)::bigint) AS "홈페이지",
    COALESCE(c."치매센터경로", (0)::bigint) AS "치매센터경로",
    c."마지막",
    c."수집처",
    NULLIF(concat_ws(','::text, COALESCE(r."길", p."길"),
        CASE
            WHEN (h."켠것" > 0) THEN 'HS'::text
            WHEN (h."끈것" > 0) THEN 'HS꺼짐'::text
            ELSE NULL::text
        END), ''::text) AS "길",
    COALESCE(r."명부이름", p."명부이름") AS "명부이름",
    p."모기관",
    (h."켠것" + h."끈것") AS "홈페이지주소수",
    g.nm AS "지정경로",
    g."근거" AS "경로근거",
        CASE
            WHEN (t.name ~ '^국군|^해군|^공군|서울지구병원'::text) THEN '군 병원 · 나라일터(군무원)'::text
            WHEN ((t."갈래" = '공공보건의료'::text) AND (t.name ~ '치과병원|한방병원|한의원|한방촌'::text)) THEN '치과·한방 · 뺌'::text
            WHEN ((t."갈래" = '공공보건의료'::text) AND (t.name ~ '노인|요양'::text)) THEN '뒤로 미룸 · 치료사 많음'::text
            ELSE NULL::text
        END AS "자리",
        CASE
            WHEN (c."마지막" IS NULL) THEN NULL::integer
            ELSE (CURRENT_DATE - c."마지막")
        END AS "며칠전",
        CASE
            WHEN (c.key IS NOT NULL) THEN '들어온 적 있음'::text
            WHEN ((r."길" IS NOT NULL) OR (p."길" IS NOT NULL) OR (h."켠것" > 0)) THEN '길은 있는데 안 옴'::text
            WHEN (h."끈것" > 0) THEN '길을 꺼 둠'::text
            WHEN (g.cd IS NOT NULL) THEN '갈래 경로로 덮음'::text
            WHEN (t.name ~ '^국군|^해군|^공군|서울지구병원'::text) THEN '갈래 경로로 덮음'::text
            ELSE '길도 모름'::text
        END AS "상태",
    now() AS "갱신시각"
   FROM ((((("목표" t
     LEFT JOIN "공고" c ON ((c.key = t.key)))
     LEFT JOIN "갈래경로" g ON ((g."갈래" = t."갈래")))
     LEFT JOIN LATERAL ( SELECT string_agg(DISTINCT a.source, ','::text ORDER BY a.source) AS "길",
            min(a.org_name) AS "명부이름"
           FROM public.api_roster a
          WHERE ((a.name_key = t.key) OR (a.name_key = public.org_name_key(t.name, true)))) r ON (true))
     LEFT JOIN LATERAL ( SELECT string_agg(DISTINCT a.source, ','::text ORDER BY a.source) AS "길",
            min(a.org_name) AS "명부이름",
            min(al.hira_name) AS "모기관"
           FROM (public.org_alias al
             JOIN public.api_roster a ON ((a.name_key = public.org_name_key(al.hira_name))))
          WHERE ((al.kind = '모기관'::text) AND (public.org_name_key(al.our_name) = t.key))) p ON (true))
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE ((COALESCE(st.auto, ''::text) = 'Y'::text) OR ((COALESCE(st.auto, ''::text) <> 'N'::text) AND ((s.off_why IS NULL) OR (s.off_why = ''::text))))) AS "켠것",
            count(*) FILTER (WHERE ((COALESCE(st.auto, ''::text) = 'N'::text) OR ((COALESCE(st.auto, ''::text) <> 'Y'::text) AND (s.off_why IS NOT NULL) AND (s.off_why <> ''::text)))) AS "끈것"
           FROM (public.hosp_sites s
             LEFT JOIN public.site_state st ON ((st.name = s.name)))
          WHERE ((public.org_name_key(s.name) = t.key) OR (public.org_name_key(s.name, true) = public.org_name_key(t.name, true)))) h ON (true))
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.org_coverage OWNER TO postgres;

--
-- Name: welfare_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.welfare_centers (
    id bigint NOT NULL,
    sido text,
    sgg text,
    facility_type text,
    corp text,
    name text NOT NULL,
    addr text,
    tel text,
    staff_quota integer,
    staff_now integer
);


ALTER TABLE public.welfare_centers OWNER TO postgres;

--
-- Name: welfare_facilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.welfare_facilities (
    id bigint NOT NULL,
    facility_type text,
    facility_kind text,
    name text NOT NULL,
    sido text,
    sgg text,
    addr text
);


ALTER TABLE public.welfare_facilities OWNER TO postgres;

--
-- Name: org_directory; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.org_directory AS
 SELECT 'hospital'::text AS source,
    hospitals.name,
    hospitals.kind,
    hospitals.sido,
    hospitals.sgg,
    hospitals.addr
   FROM public.hospitals
UNION ALL
 SELECT 'public'::text AS source,
    public_hospitals.name,
    public_hospitals.kind,
    NULL::text AS sido,
    NULL::text AS sgg,
    public_hospitals.addr
   FROM public.public_hospitals
UNION ALL
 SELECT 'dementia'::text AS source,
    dementia_safe_centers.name,
    '치매안심센터'::text AS kind,
    dementia_safe_centers.sido,
    dementia_safe_centers.sgg,
    dementia_safe_centers.addr1 AS addr
   FROM public.dementia_safe_centers
UNION ALL
 SELECT 'dementia'::text AS source,
    dementia_centers.name,
    COALESCE(dementia_centers.kind, '치매센터'::text) AS kind,
    NULL::text AS sido,
    NULL::text AS sgg,
    dementia_centers.road_addr AS addr
   FROM public.dementia_centers
UNION ALL
 SELECT 'dev_rehab'::text AS source,
    dev_rehab_orgs.name,
    dev_rehab_orgs.service AS kind,
    dev_rehab_orgs.sido,
    dev_rehab_orgs.sgg,
    dev_rehab_orgs.road_addr AS addr
   FROM public.dev_rehab_orgs
UNION ALL
 SELECT 'ltc'::text AS source,
    ltc_facilities.name,
    ltc_facilities.kind,
    ltc_facilities.sido,
    ltc_facilities.sgg,
    ltc_facilities.addr
   FROM public.ltc_facilities
UNION ALL
 SELECT 'mental'::text AS source,
    mental_centers.name,
    mental_centers.facility_kind AS kind,
    mental_centers.sido,
    mental_centers.sgg,
    mental_centers.addr
   FROM public.mental_centers
UNION ALL
 SELECT 'welfare_ctr'::text AS source,
    welfare_centers.name,
    welfare_centers.facility_type AS kind,
    welfare_centers.sido,
    welfare_centers.sgg,
    welfare_centers.addr
   FROM public.welfare_centers
UNION ALL
 SELECT 'welfare'::text AS source,
    welfare_facilities.name,
    welfare_facilities.facility_kind AS kind,
    welfare_facilities.sido,
    welfare_facilities.sgg,
    welfare_facilities.addr
   FROM public.welfare_facilities
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.org_directory OWNER TO postgres;

--
-- Name: MATERIALIZED VIEW org_directory; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON MATERIALIZED VIEW public.org_directory IS '기관 이름 대조 전용. 원본 9종을 합쳐 이름·종별·지역만 남깁니다. 원본을 다시 부으면 refresh 하십시오';


--
-- Name: org_hospital_stat; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.org_hospital_stat AS
 WITH api AS (
         SELECT DISTINCT ON ((public.org_key(o.yadm_nm))) public.org_key(o.yadm_nm) AS key,
            d.perm_sbd,
            d.ot,
            d.pt,
            d.rehab_sdr,
            d.ptrm_cnt,
            d.org_ty_nm,
            d.updated_at
           FROM (public.hira_detail d
             JOIN public.hira_org o ON ((o.ykiho = d.ykiho)))
          WHERE (d.eqp_at IS NOT NULL)
          ORDER BY (public.org_key(o.yadm_nm)), d.perm_sbd DESC NULLS LAST
        ), "합친것" AS (
         SELECT DISTINCT ON ((public.org_key(h.name))) public.org_key(h.name) AS key,
            h.name,
            h.kind,
            h.sido,
            h.sgg,
            COALESCE(a.perm_sbd, h.bed) AS bed,
            COALESCE(a.rehab_sdr, h.rehab) AS rehab,
            COALESCE(a.ot, h.ot) AS ot,
            COALESCE(a.pt, h.pt) AS pt,
            a.ptrm_cnt,
            a.org_ty_nm,
                CASE
                    WHEN (a.key IS NULL) THEN h.data_version
                    ELSE ('심평원 '::text || to_char((a.updated_at AT TIME ZONE 'Asia/Seoul'::text), 'YYYY-MM-DD'::text))
                END AS data_version
           FROM (public.hospitals h
             LEFT JOIN api a ON ((a.key = public.org_key(h.name))))
          ORDER BY (public.org_key(h.name)), h.bed DESC
        )
 SELECT c.key,
    c.name,
    c.kind,
    c.sido,
    c.sgg,
    c.bed,
    c.rehab,
    c.ot,
    c.pt,
    round(((c.bed)::numeric / ((c.ot + c.pt))::numeric), 1) AS per_bed,
    s.med AS kind_med,
    s.p25 AS kind_p25,
    s.p75 AS kind_p75,
    s.n AS kind_n,
        CASE
            WHEN (s.kind IS NULL) THEN NULL::text
            WHEN ((((c.bed)::numeric / ((c.ot + c.pt))::numeric))::double precision <= s.p25) THEN 'easy'::text
            WHEN ((((c.bed)::numeric / ((c.ot + c.pt))::numeric))::double precision >= s.p75) THEN 'busy'::text
            ELSE 'mid'::text
        END AS band,
    c.data_version,
    c.ptrm_cnt,
    c.org_ty_nm
   FROM ("합친것" c
     LEFT JOIN public.hosp_kind_stat s ON ((s.kind = c.kind)))
  WHERE ((c.bed > 0) AND ((COALESCE(c.ot, 0) + COALESCE(c.pt, 0)) > 0));


ALTER VIEW public.org_hospital_stat OWNER TO postgres;

--
-- Name: org_group_mv; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.org_group_mv AS
 WITH g AS (
         SELECT o.name,
            public.org_sido(o.sido, o.addr) AS sido_std,
            public.org_sgg(o.sido, o.sgg, o.addr) AS sgg_std,
            min(o.addr) AS addr,
            array_agg(DISTINCT o.kind) FILTER (WHERE (o.kind IS NOT NULL)) AS kinds,
            array_agg(DISTINCT o.source) AS sources
           FROM public.org_directory o
          GROUP BY o.name, (public.org_sido(o.sido, o.addr)), (public.org_sgg(o.sido, o.sgg, o.addr))
        ), hs AS (
         SELECT DISTINCT ON ((public.org_key(hospitals.name)), (public.org_sido(hospitals.sido, hospitals.addr)), hospitals.sgg) public.org_key(hospitals.name) AS key,
            public.org_sido(hospitals.sido, hospitals.addr) AS sido_std,
            hospitals.sgg AS sgg_std,
            hospitals.bed,
            hospitals.rehab,
            hospitals.ot,
            hospitals.pt,
            hospitals.tel,
            hospitals.kind
           FROM public.hospitals
          ORDER BY (public.org_key(hospitals.name)), (public.org_sido(hospitals.sido, hospitals.addr)), hospitals.sgg, hospitals.bed DESC NULLS LAST
        ), h AS (
         SELECT DISTINCT ON ((public.org_key(hospitals.name)), (public.org_sido(hospitals.sido, hospitals.addr))) public.org_key(hospitals.name) AS key,
            public.org_sido(hospitals.sido, hospitals.addr) AS sido_std,
            hospitals.bed,
            hospitals.rehab,
            hospitals.ot,
            hospitals.pt,
            hospitals.tel,
            hospitals.kind
           FROM public.hospitals
          ORDER BY (public.org_key(hospitals.name)), (public.org_sido(hospitals.sido, hospitals.addr)), hospitals.bed DESC NULLS LAST
        ), h1 AS (
         SELECT z.key,
            z.bed,
            z.rehab,
            z.ot,
            z.pt,
            z.tel,
            z.kind
           FROM ( SELECT public.org_key(hospitals.name) AS key,
                    hospitals.bed,
                    hospitals.rehab,
                    hospitals.ot,
                    hospitals.pt,
                    hospitals.tel,
                    hospitals.kind,
                    count(*) OVER (PARTITION BY (public.org_key(hospitals.name))) AS n
                   FROM public.hospitals) z
          WHERE (z.n = 1)
        ), ls AS (
         SELECT DISTINCT ON ((public.org_key(ltc_facilities.name)), (public.org_sido(ltc_facilities.sido, ltc_facilities.addr)), ltc_facilities.sgg) public.org_key(ltc_facilities.name) AS key,
            public.org_sido(ltc_facilities.sido, ltc_facilities.addr) AS sido_std,
            ltc_facilities.sgg AS sgg_std,
            ltc_facilities.capacity,
            ltc_facilities.ot,
            ltc_facilities.pt
           FROM public.ltc_facilities
          WHERE ((COALESCE(ltc_facilities.ot, 0) + COALESCE(ltc_facilities.pt, 0)) > 0)
          ORDER BY (public.org_key(ltc_facilities.name)), (public.org_sido(ltc_facilities.sido, ltc_facilities.addr)), ltc_facilities.sgg, ltc_facilities.capacity DESC NULLS LAST
        ), l AS (
         SELECT DISTINCT ON ((public.org_key(ltc_facilities.name)), (public.org_sido(ltc_facilities.sido, ltc_facilities.addr))) public.org_key(ltc_facilities.name) AS key,
            public.org_sido(ltc_facilities.sido, ltc_facilities.addr) AS sido_std,
            ltc_facilities.capacity,
            ltc_facilities.ot,
            ltc_facilities.pt
           FROM public.ltc_facilities
          WHERE ((COALESCE(ltc_facilities.ot, 0) + COALESCE(ltc_facilities.pt, 0)) > 0)
          ORDER BY (public.org_key(ltc_facilities.name)), (public.org_sido(ltc_facilities.sido, ltc_facilities.addr)), ltc_facilities.capacity DESC NULLS LAST
        ), l1 AS (
         SELECT z.key,
            z.capacity,
            z.ot,
            z.pt
           FROM ( SELECT public.org_key(ltc_facilities.name) AS key,
                    ltc_facilities.capacity,
                    ltc_facilities.ot,
                    ltc_facilities.pt,
                    count(*) OVER (PARTITION BY (public.org_key(ltc_facilities.name))) AS n
                   FROM public.ltc_facilities
                  WHERE ((COALESCE(ltc_facilities.ot, 0) + COALESCE(ltc_facilities.pt, 0)) > 0)) z
          WHERE (z.n = 1)
        ), p AS (
         SELECT DISTINCT ON ((public.org_key(public_hospitals.name))) public.org_key(public_hospitals.name) AS key,
            public_hospitals.tel,
            public_hospitals.est_type,
            public_hospitals.homepage
           FROM public.public_hospitals
          ORDER BY (public.org_key(public_hospitals.name)), public_hospitals.beds DESC NULLS LAST
        )
 SELECT g.name,
    public.org_key(g.name) AS key,
    g.sido_std,
    g.sgg_std,
    g.addr,
    g.kinds,
    g.sources,
    public.org_tile(g.kinds, g.sources, g.name) AS tile,
    COALESCE(hs.bed, h.bed, h1.bed) AS bed,
    COALESCE(hs.rehab, h.rehab, h1.rehab) AS rehab,
    COALESCE(hs.ot, h.ot, h1.ot, ls.ot, l.ot, l1.ot) AS ot,
    COALESCE(hs.pt, h.pt, h1.pt, ls.pt, l.pt, l1.pt) AS pt,
    COALESCE(ls.capacity, l.capacity, l1.capacity) AS capacity,
    COALESCE(hs.tel, h.tel, h1.tel, p.tel) AS tel,
    p.est_type,
    p.homepage,
    COALESCE(hs.kind, h.kind, h1.kind) AS hosp_kind,
    s.band,
    ((hs.key IS NOT NULL) OR (h.key IS NOT NULL) OR (h1.key IS NOT NULL) OR (ls.key IS NOT NULL) OR (l.key IS NOT NULL) OR (l1.key IS NOT NULL)) AS staffed,
    (COALESCE(hs.ot, h.ot, h1.ot, ls.ot, l.ot, l1.ot, 0) + COALESCE(hs.pt, h.pt, h1.pt, ls.pt, l.pt, l1.pt, 0)) AS therapists
   FROM ((((((((g
     LEFT JOIN hs ON (((hs.key = public.org_key(g.name)) AND (NOT (hs.sido_std IS DISTINCT FROM g.sido_std)) AND (NOT (hs.sgg_std IS DISTINCT FROM g.sgg_std)))))
     LEFT JOIN h ON (((h.key = public.org_key(g.name)) AND (NOT (h.sido_std IS DISTINCT FROM g.sido_std)) AND (hs.key IS NULL))))
     LEFT JOIN h1 ON (((h1.key = public.org_key(g.name)) AND (hs.key IS NULL) AND (h.key IS NULL))))
     LEFT JOIN ls ON (((ls.key = public.org_key(g.name)) AND (NOT (ls.sido_std IS DISTINCT FROM g.sido_std)) AND (NOT (ls.sgg_std IS DISTINCT FROM g.sgg_std)))))
     LEFT JOIN l ON (((l.key = public.org_key(g.name)) AND (NOT (l.sido_std IS DISTINCT FROM g.sido_std)) AND (ls.key IS NULL))))
     LEFT JOIN l1 ON (((l1.key = public.org_key(g.name)) AND (ls.key IS NULL) AND (l.key IS NULL))))
     LEFT JOIN p ON ((p.key = public.org_key(g.name))))
     LEFT JOIN public.org_hospital_stat s ON ((s.key = public.org_key(g.name))))
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.org_group_mv OWNER TO postgres;

--
-- Name: org_match_before; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_match_before (
    job_id text NOT NULL,
    org_name text NOT NULL,
    "붙은기관" text,
    sido_std text,
    "찍은때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.org_match_before OWNER TO postgres;

--
-- Name: org_stars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_stars (
    profile_id uuid DEFAULT auth.uid() NOT NULL,
    org_name text NOT NULL,
    notify boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.org_stars OWNER TO postgres;

--
-- Name: page_hits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.page_hits (
    id bigint NOT NULL,
    day date NOT NULL,
    kind text NOT NULL,
    target text,
    day_key text NOT NULL,
    by_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    device text,
    CONSTRAINT page_hits_kind_check CHECK ((kind = ANY (ARRAY['home'::text, 'jobs'::text, 'job'::text, 'community'::text, 'post'::text, 'orgs'::text, 'org'::text, 'other'::text])))
);


ALTER TABLE public.page_hits OWNER TO postgres;

--
-- Name: TABLE page_hits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.page_hits IS '화면 조회. 개인 추적 안 함 — day_key 는 자정마다 바뀌는 임의 번호입니다';


--
-- Name: COLUMN page_hits.day_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.page_hits.day_key IS '그날 하루짜리 임의 번호. 서로 다른 개수를 세면 「방문 수」가 됩니다';


--
-- Name: COLUMN page_hits.device; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.page_hits.device IS 'mobile · desktop · 빈 값(2026-09-23 이전에 쌓인 것). User-Agent 는 안 담습니다';


--
-- Name: page_hits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.page_hits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.page_hits_id_seq OWNER TO postgres;

--
-- Name: page_hits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.page_hits_id_seq OWNED BY public.page_hits.id;


--
-- Name: post_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_images (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    path text NOT NULL,
    thumb_path text NOT NULL,
    width integer,
    height integer,
    bytes integer,
    sort integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.post_images OWNER TO postgres;

--
-- Name: post_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_images_id_seq OWNER TO postgres;

--
-- Name: post_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_images_id_seq OWNED BY public.post_images.id;


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_likes (
    post_id bigint NOT NULL,
    profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_likes OWNER TO postgres;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id bigint NOT NULL,
    channel text NOT NULL,
    author_id uuid NOT NULL,
    title text,
    body text NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    report_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    hidden_at timestamp with time zone,
    hidden_by uuid,
    "시험자료" boolean DEFAULT false NOT NULL,
    "값" integer,
    "거래상태" text,
    CONSTRAINT "posts_값_check" CHECK ((("값" IS NULL) OR (("값" >= 0) AND ("값" <= 100000000)))),
    CONSTRAINT "posts_거래상태_check" CHECK ((("거래상태" IS NULL) OR ("거래상태" = ANY (ARRAY['판매중'::text, '예약중'::text, '거래완료'::text]))))
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: COLUMN posts.hidden_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.hidden_at IS '감춘 시각. 안 감췄으면 비어 있습니다';


--
-- Name: COLUMN posts.hidden_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.hidden_by IS '감춘 사람. 글쓴이가 지운 것인지 관리자가 내린 것인지 여기서 갈립니다';


--
-- Name: COLUMN posts."값"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts."값" IS '중고거래 값(원). 비어 있으면 「값 안 적음」입니다. 2026-10-11';


--
-- Name: COLUMN posts."거래상태"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts."거래상태" IS '판매중 · 예약중 · 거래완료. 중고거래 방에서만 씁니다. 2026-10-11';


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.posts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posts_id_seq OWNER TO postgres;

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: 회원번호_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."회원번호_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."회원번호_seq" OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nickname text NOT NULL,
    job_group text,
    avatar text,
    excluded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nickname_changes integer DEFAULT 0 NOT NULL,
    terms_agreed_at timestamp with time zone,
    terms_version text,
    role text,
    survey_at timestamp with time zone,
    survey_edits integer DEFAULT 0 NOT NULL,
    survey_edits_since timestamp with time zone,
    erased_at timestamp with time zone,
    "회원번호" bigint DEFAULT nextval('public."회원번호_seq"'::regclass) NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['현직'::text, '학생'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.profiles IS '회원. auth.users 와 1:1. 닉네임·직군·아바타는 누구나 읽습니다';


--
-- Name: COLUMN profiles.nickname_changes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.nickname_changes IS '닉네임을 바꾼 횟수. 5번까지 무료 — 트리거가 셉니다';


--
-- Name: COLUMN profiles.terms_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.terms_version IS '동의한 약관 묶음의 판. 약관이 바뀌면 다시 받습니다';


--
-- Name: COLUMN profiles.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.role IS '현직 | 학생. 커뮤니티 방을 가릅니다. 비면 현직으로 봅니다 (옛 chFor_ 와 같게)';


--
-- Name: COLUMN profiles.survey_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.survey_at IS '급여·스펙을 마친 시각. 비어 있으면 가입이 안 끝난 것입니다';


--
-- Name: COLUMN profiles.survey_edits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.survey_edits IS '지금 1년 창에서 급여·스펙을 고친 횟수. 처음 등록은 안 셉니다';


--
-- Name: COLUMN profiles.survey_edits_since; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.survey_edits_since IS '지금 1년 창이 시작된 시각';


--
-- Name: COLUMN profiles.erased_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.erased_at IS '계정을 지운 시각. 이 값이 있으면 화면에 「알 수 없음」으로 나갑니다';


--
-- Name: pub_baseline; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pub_baseline (
    "한줄" boolean DEFAULT true NOT NULL,
    "기준" integer NOT NULL,
    "정한날" date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL,
    "까닭" text,
    CONSTRAINT "pub_baseline_한줄_check" CHECK ("한줄")
);


ALTER TABLE public.pub_baseline OWNER TO postgres;

--
-- Name: public_hospitals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.public_hospitals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.public_hospitals_id_seq OWNER TO postgres;

--
-- Name: public_hospitals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.public_hospitals_id_seq OWNED BY public.public_hospitals.id;


--
-- Name: push_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_devices (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text,
    auth text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.push_devices OWNER TO postgres;

--
-- Name: push_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.push_devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_devices_id_seq OWNER TO postgres;

--
-- Name: push_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.push_devices_id_seq OWNED BY public.push_devices.id;


--
-- Name: rejudge_hidden; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rejudge_hidden (
    job_id text NOT NULL,
    why text NOT NULL,
    decided_on date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL
);


ALTER TABLE public.rejudge_hidden OWNER TO postgres;

--
-- Name: TABLE rejudge_hidden; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rejudge_hidden IS '재판정으로 감추기로 한 공고. 다리가 시트 값으로 되돌리지 못하게 매번 다시 적용합니다 (2026-09-28)';


--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id bigint NOT NULL,
    target_type text NOT NULL,
    target_id bigint NOT NULL,
    reporter_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone,
    handled_by uuid,
    handled_note text,
    CONSTRAINT reports_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'comment'::text, 'chat_room'::text, 'chat'::text])))
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reports_id_seq OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: rival_match; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rival_match (
    "경쟁사" text NOT NULL,
    "글번호" text NOT NULL,
    "우리것" text,
    "판정" text,
    "차이시간" numeric,
    "원인" text,
    "상태" text DEFAULT '미처리'::text NOT NULL,
    "메모" text,
    "잰때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rival_match OWNER TO postgres;

--
-- Name: rival_org_todo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rival_org_todo (
    "기관명" text NOT NULL,
    "어디서" text,
    "올린때" timestamp with time zone DEFAULT now() NOT NULL,
    "상태" text DEFAULT '후보'::text NOT NULL,
    "메모" text
);


ALTER TABLE public.rival_org_todo OWNER TO postgres;

--
-- Name: rival_post; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rival_post (
    "경쟁사" text NOT NULL,
    "글번호" text NOT NULL,
    "제목" text NOT NULL,
    "기관분류" text,
    "기관명" text,
    "지역" text,
    "고용형태" text,
    "링크" text,
    "처음본때" timestamp with time zone DEFAULT now() NOT NULL,
    "기존" boolean DEFAULT false NOT NULL,
    "넣은이" text DEFAULT '자동'::text NOT NULL,
    "본날짜" timestamp with time zone
);


ALTER TABLE public.rival_post OWNER TO postgres;

--
-- Name: salary_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_records (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    hired_year integer NOT NULL,
    region text NOT NULL,
    hospital_type text NOT NULL,
    employ_type text NOT NULL,
    net_monthly integer,
    duty_count integer,
    duty_hours integer,
    weekend_count integer,
    weekend_hours integer,
    bonus_yearly integer,
    extra_pay boolean,
    current_hired_year integer,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    gender text,
    birth_year integer,
    note text,
    base_monthly integer,
    pay_basis text,
    dependents integer,
    extra_pay_monthly integer,
    duty_pay integer,
    weekend_pay integer,
    annual_total integer GENERATED ALWAYS AS (
CASE
    WHEN (base_monthly IS NULL) THEN NULL::integer
    ELSE (((((base_monthly * 12) + (COALESCE(extra_pay_monthly, 0) * 12)) + COALESCE(bonus_yearly, 0)) + ((COALESCE(duty_pay, 0) * COALESCE(duty_count, 0)) * 12)) + ((COALESCE(weekend_pay, 0) * COALESCE(weekend_count, 0)) * 12))
END) STORED,
    CONSTRAINT salary_base_range CHECK (((base_monthly IS NULL) OR ((base_monthly >= 1) AND (base_monthly <= 2000)))),
    CONSTRAINT salary_basis_ok CHECK (((pay_basis IS NULL) OR (pay_basis = ANY (ARRAY['gross'::text, 'estimated'::text, 'legacy'::text])))),
    CONSTRAINT salary_birth_range CHECK (((birth_year IS NULL) OR ((birth_year >= 1940) AND (birth_year <= 2020)))),
    CONSTRAINT salary_bonus_range CHECK (((bonus_yearly IS NULL) OR ((bonus_yearly >= 0) AND (bonus_yearly <= 9999)))),
    CONSTRAINT salary_dependents_range CHECK (((dependents IS NULL) OR ((dependents >= 1) AND (dependents <= 15)))),
    CONSTRAINT salary_duty_range CHECK (((duty_count IS NULL) OR ((duty_count >= 0) AND (duty_count <= 31)))),
    CONSTRAINT salary_dutypay_range CHECK (((duty_pay IS NULL) OR ((duty_pay >= 0) AND (duty_pay <= 200)))),
    CONSTRAINT salary_estimated_needs_net CHECK (((pay_basis <> 'estimated'::text) OR ((net_monthly IS NOT NULL) AND (dependents IS NOT NULL)))),
    CONSTRAINT salary_extra_range CHECK (((extra_pay_monthly IS NULL) OR ((extra_pay_monthly >= 0) AND (extra_pay_monthly <= 2000)))),
    CONSTRAINT salary_gender_ok CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['남'::text, '여'::text])))),
    CONSTRAINT salary_hours_range CHECK ((((duty_hours IS NULL) OR ((duty_hours >= 0) AND (duty_hours <= 24))) AND ((weekend_hours IS NULL) OR ((weekend_hours >= 0) AND (weekend_hours <= 24))))),
    CONSTRAINT salary_net_range CHECK (((net_monthly IS NULL) OR ((net_monthly >= 1) AND (net_monthly <= 2000)))),
    CONSTRAINT salary_note_len CHECK (((note IS NULL) OR (char_length(note) <= 300))),
    CONSTRAINT salary_weekend_range CHECK (((weekend_count IS NULL) OR ((weekend_count >= 0) AND (weekend_count <= 10)))),
    CONSTRAINT salary_weekendpay_range CHECK (((weekend_pay IS NULL) OR ((weekend_pay >= 0) AND (weekend_pay <= 200)))),
    CONSTRAINT salary_year_range CHECK ((((hired_year >= 1970) AND (hired_year <= 2100)) AND ((current_hired_year IS NULL) OR ((current_hired_year >= 1970) AND (current_hired_year <= 2100)))))
);


ALTER TABLE public.salary_records OWNER TO postgres;

--
-- Name: TABLE salary_records; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.salary_records IS '급여. 현직만. 개별 줄은 본인과 관리자만 읽습니다 — 다른 회원에게는 통계로만 나갑니다';


--
-- Name: COLUMN salary_records.net_monthly; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.salary_records.net_monthly IS '월 실수령. 옛 화면에서는 이것만 받았습니다. 지금은 세후로 적은 분만 채워집니다';


--
-- Name: COLUMN salary_records.base_monthly; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.salary_records.base_monthly IS '근로계약서의 고정 월급. 세전. 만원 단위';


--
-- Name: COLUMN salary_records.pay_basis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.salary_records.pay_basis IS 'gross = 세전을 직접 적음 · estimated = 세후를 적어 계산함 · legacy = 옛 화면(월 실수령만)';


--
-- Name: COLUMN salary_records.annual_total; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.salary_records.annual_total IS '연 총소득(만원) = 고정월급×12 + 추가수당×12 + 상여 + 당직수당×횟수×12 + 주말수당×횟수×12. DB 가 직접 셉니다';


--
-- Name: salary_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salary_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salary_records_id_seq OWNER TO postgres;

--
-- Name: salary_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salary_records_id_seq OWNED BY public.salary_records.id;


--
-- Name: seen_postings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seen_postings (
    source text NOT NULL,
    external_id text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    result text
);


ALTER TABLE public.seen_postings OWNER TO postgres;

--
-- Name: TABLE seen_postings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.seen_postings IS '이미 열어본 공고. 위와 같습니다';


--
-- Name: site_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_checks (
    id text NOT NULL,
    name text NOT NULL,
    checked_on date,
    round integer,
    code text,
    ms integer,
    job_words integer,
    page_title text,
    body_head text,
    off_why_before text
);


ALTER TABLE public.site_checks OWNER TO postgres;

--
-- Name: TABLE site_checks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.site_checks IS '꺼진 병원 홈페이지를 구글 서버에서 두드려 본 기록. gas 의 「사이트점검」 시트가 원본, tools/copy_jobs.js 가 나릅니다';


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


ALTER TABLE public.site_settings OWNER TO postgres;

--
-- Name: TABLE site_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.site_settings IS '화면 전체에 걸린 설정. 지금은 상단 배너 속도뿐입니다';


--
-- Name: spec_langs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.spec_langs (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    exam text NOT NULL,
    score integer,
    level text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_role text,
    CONSTRAINT spec_langs_exam_ok CHECK ((exam = ANY (ARRAY['토익'::text, '텝스'::text, '토익스피킹'::text, '오픽'::text]))),
    CONSTRAINT spec_langs_level_ok CHECK ((((exam = '오픽'::text) AND (level = ANY (ARRAY['NL'::text, 'NM'::text, 'NH'::text, 'IL'::text, 'IM1'::text, 'IM2'::text, 'IM3'::text, 'IH'::text, 'AL'::text]))) OR ((exam <> '오픽'::text) AND (level IS NULL)))),
    CONSTRAINT spec_langs_role_ok CHECK (((submitted_role IS NULL) OR (submitted_role = ANY (ARRAY['현직'::text, '학생'::text])))),
    CONSTRAINT spec_langs_score_range CHECK (
CASE exam
    WHEN '토익'::text THEN ((score IS NOT NULL) AND ((score >= 0) AND (score <= 990)))
    WHEN '텝스'::text THEN ((score IS NOT NULL) AND ((score >= 0) AND (score <= 600)))
    WHEN '토익스피킹'::text THEN ((score IS NOT NULL) AND ((score >= 0) AND (score <= 200)))
    ELSE (score IS NULL)
END)
);


ALTER TABLE public.spec_langs OWNER TO postgres;

--
-- Name: spec_langs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.spec_langs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.spec_langs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: student_specs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_specs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_specs_id_seq OWNER TO postgres;

--
-- Name: student_specs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_specs_id_seq OWNED BY public.student_specs.id;


--
-- Name: ui_icons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ui_icons (
    slot text NOT NULL,
    area text NOT NULL,
    label text NOT NULL,
    icon text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ui_icons OWNER TO postgres;

--
-- Name: welfare_centers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.welfare_centers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.welfare_centers_id_seq OWNER TO postgres;

--
-- Name: welfare_centers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.welfare_centers_id_seq OWNED BY public.welfare_centers.id;


--
-- Name: welfare_facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.welfare_facilities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.welfare_facilities_id_seq OWNER TO postgres;

--
-- Name: welfare_facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.welfare_facilities_id_seq OWNED BY public.welfare_facilities.id;


--
-- Name: wn_verdicts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wn_verdicts (
    wanted_auth_no text NOT NULL,
    verdict text NOT NULL,
    reason text,
    org_name text,
    title text,
    decided_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wn_verdicts OWNER TO postgres;

--
-- Name: TABLE wn_verdicts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.wn_verdicts IS '워크넷 공고를 한 번 판정하면 다시 안 열려고 남기는 기록';


--
-- Name: 개인정보접속기록; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."개인정보접속기록" (
    id bigint NOT NULL,
    "누가" uuid NOT NULL,
    "언제" timestamp with time zone DEFAULT now() NOT NULL,
    "어디서" text,
    "누구것" uuid,
    "몇명" integer,
    "무엇" text NOT NULL,
    "어느표" text NOT NULL
);


ALTER TABLE public."개인정보접속기록" OWNER TO postgres;

--
-- Name: 개인정보접속기록_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."개인정보접속기록_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."개인정보접속기록_id_seq" OWNER TO postgres;

--
-- Name: 개인정보접속기록_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."개인정보접속기록_id_seq" OWNED BY public."개인정보접속기록".id;


--
-- Name: 공개글; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public."공개글" AS
 SELECT p.id,
    p.channel,
    p.title,
    p.body,
    p.comment_count,
    p.like_count,
    p.view_count,
    p.created_at,
    p.edited_at,
    (p.author_id = auth.uid()) AS "내글",
    jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'erased_at', pr.erased_at) AS profiles,
    ( SELECT (count(*))::integer AS count
           FROM public.post_images i
          WHERE (i.post_id = p.id)) AS "사진수",
    p."값",
    p."거래상태"
   FROM (public.posts p
     LEFT JOIN public.profiles pr ON ((pr.id = p.author_id)))
  WHERE ((NOT p.hidden) AND (public."방볼수있나"(p.channel) OR public.is_admin()) AND ((NOT p."시험자료") OR public."시험자료볼까"()) AND ((p.author_id IS NULL) OR (NOT (p.author_id IN ( SELECT public."내가차단한사람"() AS "내가차단한사람")))));


ALTER VIEW public."공개글" OWNER TO postgres;

--
-- Name: 공개댓글; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public."공개댓글" AS
 SELECT c.id,
    c.post_id,
    c.parent_id,
    c.body,
    c.created_at,
    (c.author_id = auth.uid()) AS "내글",
    jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar, 'erased_at', pr.erased_at) AS profiles
   FROM ((public.comments c
     JOIN public.posts p ON (((p.id = c.post_id) AND (NOT p.hidden))))
     LEFT JOIN public.profiles pr ON ((pr.id = c.author_id)))
  WHERE ((NOT c.hidden) AND (public."방볼수있나"(p.channel) OR public.is_admin()) AND ((NOT p."시험자료") OR public."시험자료볼까"()) AND ((c.author_id IS NULL) OR (NOT (c.author_id IN ( SELECT public."내가차단한사람"() AS "내가차단한사람")))));


ALTER VIEW public."공개댓글" OWNER TO postgres;

--
-- Name: 공고신고; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."공고신고" (
    id bigint NOT NULL,
    job_id text NOT NULL,
    reporter_id uuid,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone,
    handled_by uuid,
    handled_note text,
    CONSTRAINT "공고신고_사유길이" CHECK (((char_length(btrim(reason)) >= 2) AND (char_length(btrim(reason)) <= 500)))
);


ALTER TABLE public."공고신고" OWNER TO postgres;

--
-- Name: TABLE "공고신고"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."공고신고" IS '회원이 보낸 공고 오류 신고 (2026-10-07). 커뮤니티 신고(reports)와 따로 둡니다 — 공고 id 는 text 이고, 보관 규정도 다릅니다. 남기는 개인정보는 회원 번호 하나뿐이고 탈퇴하면 비워집니다. 규칙(policy)은 한 줄도 없습니다 — 아래 세 함수만 닿습니다.';


--
-- Name: 공고신고_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."공고신고_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."공고신고_id_seq" OWNER TO postgres;

--
-- Name: 공고신고_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."공고신고_id_seq" OWNED BY public."공고신고".id;


--
-- Name: 공고올림; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."공고올림" (
    id bigint NOT NULL,
    job_id text NOT NULL,
    "순서" integer DEFAULT 100 NOT NULL,
    "부터" date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL,
    "까지" date,
    "왜" text NOT NULL,
    "올린사람" uuid NOT NULL,
    "만든때" timestamp with time zone DEFAULT now() NOT NULL,
    "끝낸까닭" text,
    "끝낸사람" uuid,
    "끝낸때" timestamp with time zone,
    CONSTRAINT "공고올림_기간" CHECK ((("까지" IS NULL) OR ("까지" >= "부터"))),
    CONSTRAINT "공고올림_왜" CHECK (((char_length(btrim("왜")) >= 2) AND (char_length(btrim("왜")) <= 300)))
);


ALTER TABLE public."공고올림" OWNER TO postgres;

--
-- Name: TABLE "공고올림"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."공고올림" IS '관리자가 공고를 추천순 맨 위로 올린 기록 (2026-10-07). 줄을 지우지 않습니다 — 끝낼 때 「까지」를 어제로 바꿉니다. 나중에 유료 광고 상품으로 이어질 자리라 「누가 언제 왜」 가 남아야 합니다. 올린사람·끝낸사람에 외래키를 안 걸었습니다 — 계정이 없어져도 누가 올렸는지는 남아야 합니다.';


--
-- Name: 공고올림_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."공고올림_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."공고올림_id_seq" OWNER TO postgres;

--
-- Name: 공고올림_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."공고올림_id_seq" OWNED BY public."공고올림".id;


--
-- Name: 공고올림_도는것; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public."공고올림_도는것" AS
 SELECT id,
    job_id,
    "순서",
    "부터",
    "까지",
    "왜",
    "올린사람",
    "만든때",
    "끝낸까닭",
    "끝낸사람",
    "끝낸때"
   FROM public."공고올림"
  WHERE (("끝낸때" IS NULL) AND ("부터" <= ((now() AT TIME ZONE 'Asia/Seoul'::text))::date) AND (("까지" IS NULL) OR ("까지" >= ((now() AT TIME ZONE 'Asia/Seoul'::text))::date)));


ALTER VIEW public."공고올림_도는것" OWNER TO postgres;

--
-- Name: 공고첨부; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."공고첨부" (
    id bigint NOT NULL,
    "갈래" text NOT NULL,
    "공고id" text,
    "회차id" bigint,
    "경로" text NOT NULL,
    "이름" text NOT NULL,
    "크기" integer NOT NULL,
    "형식" text NOT NULL,
    "읽었나" boolean DEFAULT false NOT NULL,
    "올린사람" uuid NOT NULL,
    "올린때" timestamp with time zone DEFAULT now() NOT NULL,
    "지운때" timestamp with time zone,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "공고첨부_check" CHECK (((("갈래" = '채용'::text) AND ("공고id" IS NOT NULL) AND ("회차id" IS NULL)) OR (("갈래" = '교육'::text) AND ("회차id" IS NOT NULL) AND ("공고id" IS NULL)))),
    CONSTRAINT "공고첨부_갈래_check" CHECK (("갈래" = ANY (ARRAY['채용'::text, '교육'::text]))),
    CONSTRAINT "공고첨부_크기_check" CHECK (("크기" > 0))
);


ALTER TABLE public."공고첨부" OWNER TO postgres;

--
-- Name: 공고첨부_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."공고첨부_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."공고첨부_id_seq" OWNER TO postgres;

--
-- Name: 공고첨부_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."공고첨부_id_seq" OWNED BY public."공고첨부".id;


--
-- Name: 공휴일; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."공휴일" (
    "날" date NOT NULL,
    "이름" text,
    "받은때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."공휴일" OWNER TO postgres;

--
-- Name: TABLE "공휴일"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."공휴일" IS '쉬는 날. 수집기 박동이 「이 날은 공고가 없는 게 맞다」를 가리는 데 씁니다. 한국천문연구원 특일 정보 API(공공데이터포털 15012690)로 채울 예정 (2026-10-05).';


--
-- Name: 광고배너; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."광고배너" (
    "자리" text NOT NULL,
    "이름" text,
    "그림" text,
    "링크" text,
    "표시초" integer DEFAULT 2 NOT NULL,
    "켜짐" boolean DEFAULT false NOT NULL,
    "시작일" date,
    "끝일" date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "광고배너_자리_check" CHECK (("자리" = ANY (ARRAY['앱'::text, '커뮤니티'::text]))),
    CONSTRAINT "광고배너_표시초_check" CHECK ((("표시초" >= 1) AND ("표시초" <= 5)))
);


ALTER TABLE public."광고배너" OWNER TO postgres;

--
-- Name: TABLE "광고배너"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."광고배너" IS '오픈 화면 배너. 자리(앱·커뮤니티)마다 한 줄뿐입니다. 꺼져 있거나 그림이 없으면 짧은 오픈 화면만 나갑니다.';


--
-- Name: COLUMN "광고배너"."시험자료"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."광고배너"."시험자료" IS '참이면 관리자·마스터에게만 보입니다 (모양 보기용). 2026-10-11';


--
-- Name: 광고셈; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."광고셈" (
    "자리" text NOT NULL,
    "날" date NOT NULL,
    "봄" integer DEFAULT 0 NOT NULL,
    "누름" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."광고셈" OWNER TO postgres;

--
-- Name: TABLE "광고셈"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."광고셈" IS '배너를 몇 번 보여주고 몇 번 눌렸나. 자리·날·숫자만 담습니다 — 누가 봤는지는 담지 않습니다 (회원id·기기·아이피·때각 하나도 없음).';


--
-- Name: 교육; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육" (
    "번호" text NOT NULL,
    "출처" text NOT NULL,
    "직군" text NOT NULL,
    "갈래" text NOT NULL,
    "제목" text NOT NULL,
    "시작" date,
    "끝" date,
    "장소" text,
    "모집인원" text,
    "상태" text,
    "올린날" date,
    "링크" text NOT NULL,
    "원문" text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "접수시작" date
);


ALTER TABLE public."교육" OWNER TO postgres;

--
-- Name: TABLE "교육"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."교육" IS '학회 교육과정·학술대회. robots.txt 가 허락한 곳만 긁습니다. 개인정보 칸 없음';


--
-- Name: COLUMN "교육"."접수시작"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."교육"."접수시작" IS '접수 시작일. 보바스처럼 「올린날」이 없는 곳의 **알림 기준일**로 씁니다 (2026-10-05).';


--
-- Name: 교육과정; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육과정" (
    "과정id" bigint NOT NULL,
    "주최갈래" text NOT NULL,
    "교육기관" text,
    "강사" uuid,
    "제목" text NOT NULL,
    "직군" text,
    "소개" text,
    "만든이" uuid NOT NULL,
    "만든때" timestamp with time zone DEFAULT now() NOT NULL,
    "숨김" boolean DEFAULT false NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "교육과정_check" CHECK (((("주최갈래" = '기관'::text) AND ("교육기관" IS NOT NULL) AND ("강사" IS NULL)) OR (("주최갈래" = '개인'::text) AND ("강사" IS NOT NULL) AND ("교육기관" IS NULL)))),
    CONSTRAINT "교육과정_주최갈래_check" CHECK (("주최갈래" = ANY (ARRAY['기관'::text, '개인'::text])))
);


ALTER TABLE public."교육과정" OWNER TO postgres;

--
-- Name: 교육과정_과정id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."교육과정_과정id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."교육과정_과정id_seq" OWNER TO postgres;

--
-- Name: 교육과정_과정id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."교육과정_과정id_seq" OWNED BY public."교육과정"."과정id";


--
-- Name: 교육기관; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육기관" (
    "이름" text NOT NULL,
    "직군" text DEFAULT '공통'::text NOT NULL,
    "소개" text,
    "그림" text,
    "누리집" text,
    "차례" integer DEFAULT 100 NOT NULL,
    "보임" boolean DEFAULT true NOT NULL,
    "모음" boolean DEFAULT true NOT NULL,
    "링크주소" text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."교육기관" OWNER TO postgres;

--
-- Name: TABLE "교육기관"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."교육기관" IS '교육·학술 기관 카드. 이름은 교육.출처 와 글자 그대로 같아야 이어집니다. 남의 로고는 담지 않습니다 — 그림은 관리자가 올린 것만';


--
-- Name: 교육기관알림; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육기관알림" (
    id bigint NOT NULL,
    "회원" uuid NOT NULL,
    "기관" text NOT NULL,
    "켠때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."교육기관알림" OWNER TO postgres;

--
-- Name: TABLE "교육기관알림"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."교육기관알림" IS '교육기관 알림 켜기. org_stars(병원 공고 알림)와 따로 둡니다 — 이어지는 자료가 job_posts 와 교육 으로 다릅니다';


--
-- Name: 교육기관알림_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."교육기관알림_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."교육기관알림_id_seq" OWNER TO postgres;

--
-- Name: 교육기관알림_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."교육기관알림_id_seq" OWNED BY public."교육기관알림".id;


--
-- Name: 교육리뷰; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육리뷰" (
    "리뷰id" bigint NOT NULL,
    "회차id" bigint NOT NULL,
    profile_id uuid NOT NULL,
    "별점" integer NOT NULL,
    "글" text NOT NULL,
    "쓴때" timestamp with time zone DEFAULT now() NOT NULL,
    "고친때" timestamp with time zone,
    "숨김" boolean DEFAULT false NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "교육리뷰_별점_check" CHECK ((("별점" >= 1) AND ("별점" <= 5)))
);


ALTER TABLE public."교육리뷰" OWNER TO postgres;

--
-- Name: 교육리뷰_리뷰id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."교육리뷰_리뷰id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."교육리뷰_리뷰id_seq" OWNER TO postgres;

--
-- Name: 교육리뷰_리뷰id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."교육리뷰_리뷰id_seq" OWNED BY public."교육리뷰"."리뷰id";


--
-- Name: 교육리뷰답글; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육리뷰답글" (
    "답글id" bigint NOT NULL,
    "리뷰id" bigint NOT NULL,
    profile_id uuid NOT NULL,
    "글" text NOT NULL,
    "쓴때" timestamp with time zone DEFAULT now() NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."교육리뷰답글" OWNER TO postgres;

--
-- Name: 교육리뷰답글_답글id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."교육리뷰답글_답글id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."교육리뷰답글_답글id_seq" OWNER TO postgres;

--
-- Name: 교육리뷰답글_답글id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."교육리뷰답글_답글id_seq" OWNED BY public."교육리뷰답글"."답글id";


--
-- Name: 교육신청; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육신청" (
    "신청id" bigint NOT NULL,
    "회차id" bigint NOT NULL,
    profile_id uuid NOT NULL,
    "상태" text DEFAULT '신청함'::text NOT NULL,
    "입금눌렀나" boolean DEFAULT false NOT NULL,
    "입금누른때" timestamp with time zone,
    "신청때" timestamp with time zone DEFAULT now() NOT NULL,
    "바뀐때" timestamp with time zone DEFAULT now() NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "교육신청_상태_check" CHECK (("상태" = ANY (ARRAY['신청함'::text, '입금대기'::text, '참여확정'::text, '미선정'::text])))
);


ALTER TABLE public."교육신청" OWNER TO postgres;

--
-- Name: 교육신청_신청id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."교육신청_신청id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."교육신청_신청id_seq" OWNER TO postgres;

--
-- Name: 교육신청_신청id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."교육신청_신청id_seq" OWNED BY public."교육신청"."신청id";


--
-- Name: 교육회차; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."교육회차" (
    "회차id" bigint NOT NULL,
    "과정id" bigint NOT NULL,
    "시작" date NOT NULL,
    "끝" date,
    "장소" text,
    "정원" integer NOT NULL,
    "접수시작" date NOT NULL,
    "접수끝" date NOT NULL,
    "수강료" integer,
    "은행" text,
    "계좌번호" text,
    "예금주" text,
    "입금기한" date,
    "입금자명규칙" text,
    "환불규정" text NOT NULL,
    "결제링크" text,
    "상태" text DEFAULT '모집중'::text NOT NULL,
    "만든때" timestamp with time zone DEFAULT now() NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "교육회차_check" CHECK ((("접수끝" >= "접수시작") AND ("접수끝" <= ("접수시작" + 30)))),
    CONSTRAINT "교육회차_상태_check" CHECK (("상태" = ANY (ARRAY['모집중'::text, '마감'::text, '끝남'::text]))),
    CONSTRAINT "교육회차_정원_check" CHECK (("정원" > 0))
);


ALTER TABLE public."교육회차" OWNER TO postgres;

--
-- Name: 교육회차_회차id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."교육회차_회차id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."교육회차_회차id_seq" OWNER TO postgres;

--
-- Name: 교육회차_회차id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."교육회차_회차id_seq" OWNED BY public."교육회차"."회차id";


--
-- Name: 권한; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."권한" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "권한코드" text NOT NULL,
    "준사람" uuid NOT NULL,
    "준때" timestamp with time zone DEFAULT now() NOT NULL,
    "끈사람" uuid,
    "끈때" timestamp with time zone
);


ALTER TABLE public."권한" OWNER TO postgres;

--
-- Name: 권한_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."권한_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."권한_id_seq" OWNER TO postgres;

--
-- Name: 권한_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."권한_id_seq" OWNED BY public."권한".id;


--
-- Name: 권한기록; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."권한기록" (
    id bigint NOT NULL,
    "누구에게" uuid NOT NULL,
    "권한코드" text NOT NULL,
    "준것인가" boolean NOT NULL,
    "누가" uuid NOT NULL,
    "언제" timestamp with time zone DEFAULT now() NOT NULL,
    "까닭" text
);


ALTER TABLE public."권한기록" OWNER TO postgres;

--
-- Name: 권한기록_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."권한기록_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."권한기록_id_seq" OWNER TO postgres;

--
-- Name: 권한기록_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."권한기록_id_seq" OWNED BY public."권한기록".id;


--
-- Name: 기관; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."기관" (
    "기관번호" text NOT NULL,
    "이름" text NOT NULL,
    "이름키" text,
    ykiho text,
    "시도" text,
    "시군구" text,
    "종별" text,
    "종별이름" text,
    "설립구분" text,
    "설립구분이름" text,
    "공공인가" boolean,
    "공공근거" text,
    "대학병원인가" boolean,
    "상급종합인가" boolean,
    "수시금지" boolean,
    "탭" text,
    "확인한때" timestamp with time zone,
    "확인한사람" text,
    "메모" text,
    "올린때" timestamp with time zone DEFAULT now() NOT NULL,
    "고친때" timestamp with time zone DEFAULT now() NOT NULL,
    "모기관번호" text,
    "주소" text,
    "전화" text,
    "홈페이지" text,
    "채용페이지" text,
    "알리오코드" text,
    "사진경로" text,
    "불변근거" jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public."기관" OWNER TO postgres;

--
-- Name: TABLE "기관"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."기관" IS '기관의 성격을 공식 값으로만 담습니다 (작업지침 10-3 — 이름으로 짐작하지 않습니다).
   열쇠는 기관번호입니다. 같은 이름의 다른 병원을 가르기 위해서입니다.
   수시금지 는 기관 성격만 담습니다. 최종 판정은 「수시금지 AND 우리 직군」 (작업지침 10-4).
   탭이 null 이면 근거가 없다는 뜻이고, 화면은 공고의 지금 탭을 그대로 씁니다.';


--
-- Name: COLUMN "기관"."공공근거"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관"."공공근거" IS '출처:AL2(알리오) · 출처:GJ2(나라일터) · 출처:CE2(클린아이) · 출처:ND2(중앙치매센터)
   · 공공병원표(public_hospitals) · 설립구분:01 국립/03 공립/05 특수법인/13 군병원';


--
-- Name: COLUMN "기관"."확인한때"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관"."확인한때" IS '관리자가 손으로 고친 표시. 이 값이 있으면 기관표채우기() 가 그 줄을 덮지 않습니다.';


--
-- Name: COLUMN "기관"."모기관번호"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관"."모기관번호" IS '본부(모기관)의 기관번호. 근무처 병원이 기관번호, 본부가 모기관번호입니다.
   ㉠ 공고가 본부 이름으로 들어와 산하로 옮긴 것 (연결근거 산하이름·본부+산하)
   ㉡ org_alias kind=''모기관'' 13줄 (근로복지공단 정선병원 → 근로복지공단 등)';


--
-- Name: COLUMN "기관"."채용페이지"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관"."채용페이지" IS '기관 채용 게시판 주소. **열어서 200 + 채용 쪽인 것만** 담습니다 (주소 짐작 금지).
   ★ 이름 글자로 붙은 기관(기관번호 NAME:…)의 채용페이지·사진은 관리자 확인(확인한때)
     전에는 **회원 화면에 쓰지 않습니다** (2026-10-24 세중님 ㉯).';


--
-- Name: COLUMN "기관"."알리오코드"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관"."알리오코드" IS '알리오 기관 코드. 2026-10-24 현재 **어디에도 없습니다** — 알리오 응답에 오는지
   두드려 보고 채웁니다 (지침 4절). 짐작으로 적지 않습니다.';


--
-- Name: COLUMN "기관"."불변근거"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관"."불변근거" IS '칸마다 어디서 베꼈나 — {"주소":"hira_org(ykiho)","채용페이지":"hosp_sites(이름열쇠)"} 꼴.
   관리자가 손으로 고치면 「관리자」로 적습니다.';


--
-- Name: 기관이름줄임; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."기관이름줄임" (
    "원래이름" text NOT NULL,
    "줄인이름" text NOT NULL,
    "승인했나" boolean DEFAULT false NOT NULL,
    "올린때" timestamp with time zone DEFAULT now() NOT NULL,
    "정한때" timestamp with time zone
);


ALTER TABLE public."기관이름줄임" OWNER TO postgres;

--
-- Name: TABLE "기관이름줄임"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."기관이름줄임" IS '「○○재단」처럼 법인 이름까지 떼는 안. **자동으로 안 씁니다** — 승인했나 = true 일 때만 제목에 들어갑니다 (2026-10-05 세중님 지시).';


--
-- Name: 기관주소; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."기관주소" (
    "이름키" text NOT NULL,
    "이름" text NOT NULL,
    "주소" text,
    "근거" text NOT NULL,
    "확인일" date DEFAULT ((now() AT TIME ZONE 'Asia/Seoul'::text))::date NOT NULL,
    "누가" text,
    "메모" text
);


ALTER TABLE public."기관주소" OWNER TO postgres;

--
-- Name: TABLE "기관주소"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."기관주소" IS '확인한 기관 주소. hira_org.hosp_url 보다 **먼저** 씁니다. 근거 없이 적지 않습니다 (2026-10-19)';


--
-- Name: COLUMN "기관주소"."주소"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관주소"."주소" IS '실제로 열어 본 주소. 열 수 없으면 null 로 두고 근거에 까닭을 적습니다';


--
-- Name: 기관지역; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."기관지역" (
    "기관" text NOT NULL,
    "시도" text NOT NULL,
    "까닭" text,
    "정한때" timestamp with time zone DEFAULT now() NOT NULL,
    "시군구" text
);


ALTER TABLE public."기관지역" OWNER TO postgres;

--
-- Name: TABLE "기관지역"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."기관지역" IS '사람이 정한 기관별 시·도. job_posts.sido 는 재수집 때 덮이므로 여기 둡니다. 그 기관의 다음 공고에도 그대로 쓰입니다 (2026-10-05).';


--
-- Name: COLUMN "기관지역"."시군구"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."기관지역"."시군구" IS '손으로 정한 시군구. job_posts.sgg 보다 셉니다 (2026-10-07)';


--
-- Name: 담당자공고번호; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."담당자공고번호"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."담당자공고번호" OWNER TO postgres;

--
-- Name: 대화차단; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."대화차단" (
    "막은사람" uuid NOT NULL,
    "막힌사람" uuid NOT NULL,
    "막은때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."대화차단" OWNER TO postgres;

--
-- Name: 마스터페르소나; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."마스터페르소나" (
    auth_id uuid NOT NULL,
    "지금역할" text DEFAULT '관리자'::text NOT NULL,
    "바뀐때" timestamp with time zone DEFAULT now() NOT NULL,
    "보관" jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public."마스터페르소나" OWNER TO postgres;

--
-- Name: 묶지않음; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."묶지않음" (
    "왼쪽" text NOT NULL,
    "오른쪽" text NOT NULL,
    "정한때" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "묶지않음_check" CHECK (("왼쪽" < "오른쪽"))
);


ALTER TABLE public."묶지않음" OWNER TO postgres;

--
-- Name: TABLE "묶지않음"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."묶지않음" IS '관리자가 「이 둘은 다른 공고다」라고 정한 짝. 다시 후보로 안 올라옵니다. 공고를 지우지도 감추지도 않습니다 — 후보 목록에서만 빠집니다.';


--
-- Name: 봉사모집; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."봉사모집" (
    "번호" bigint NOT NULL,
    "제목" text NOT NULL,
    "기관" text,
    "모집한곳" text,
    "기관코드" text,
    "시도" text,
    "시군구" text,
    "장소" text,
    "분야" text,
    "갈래" text NOT NULL,
    "활동종류" text,
    "기간" text,
    "상태" text,
    "모집인원" integer,
    "신청인원" integer,
    "청소년" boolean DEFAULT false NOT NULL,
    "올린날" date,
    "주소" text,
    db_insert_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."봉사모집" OWNER TO postgres;

--
-- Name: COLUMN "봉사모집"."시군구"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."봉사모집"."시군구" IS '기관이 있는 시·군·구입니다. 봉사하는 곳이 아닙니다 (장소 칸은 자유 글)';


--
-- Name: COLUMN "봉사모집"."갈래"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."봉사모집"."갈래" IS '복지·보건 = 노인·장애인·아동·청소년·여성·노숙인복지시설·정신요양시설·사회복지관·보건의료·사회복지분야 법인/단체. 기타 = 그 밖. 모름 = 봉사처 표에 없는 기관';


--
-- Name: 봉사처; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."봉사처" (
    "기관코드" text NOT NULL,
    "이름" text NOT NULL,
    "시도" text,
    "분야" text,
    "주소" text,
    "시군구" text,
    "전화" text,
    "우편번호" text,
    "세운날" date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."봉사처" OWNER TO postgres;

--
-- Name: TABLE "봉사처"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."봉사처" IS 'VMS 봉사활동처. 담당자·시설장 실명은 담지 않습니다 (칸 자체가 없습니다)';


--
-- Name: 수집기짝; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."수집기짝" (
    "새출처" text NOT NULL,
    "옛출처" text NOT NULL,
    "이름" text NOT NULL,
    "메모" text
);


ALTER TABLE public."수집기짝" OWNER TO postgres;

--
-- Name: 수집판정; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."수집판정" (
    source text NOT NULL,
    "번호" text NOT NULL,
    "판정" text NOT NULL,
    "지문" text NOT NULL,
    "판정때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."수집판정" OWNER TO postgres;

--
-- Name: 시군광역; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."시군광역" (
    "시군" text NOT NULL,
    "광역" text NOT NULL
);


ALTER TABLE public."시군광역" OWNER TO postgres;

--
-- Name: TABLE "시군광역"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."시군광역" IS '시·군이 어느 광역에 드는지. 「태백」 과 「강원」 이 같은 곳임을 알려 합칠 후보를 찾습니다.';


--
-- Name: 시군구시도; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."시군구시도" (
    "시군구" text NOT NULL,
    "시도" text NOT NULL
);


ALTER TABLE public."시군구시도" OWNER TO postgres;

--
-- Name: TABLE "시군구시도"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."시군구시도" IS '시·군·구 이름으로 시·도를 찾는 표. 제목에 지역을 채울 때 씁니다 (2026-10-05). ★ 대학병원 이름에는 쓰지 않습니다 — 칠곡경북대학교병원은 칠곡(경북)이 아니라 대구에 있습니다.';


--
-- Name: 심평원인원월별; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."심평원인원월별" (
    ykiho text NOT NULL,
    "연월" text NOT NULL,
    "기관명" text,
    "종별" text,
    "물리" integer,
    "작업" integer,
    "받은때" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "연월꼴" CHECK (("연월" ~ '^[0-9]{4}-[0-9]{2}$'::text))
);


ALTER TABLE public."심평원인원월별" OWNER TO postgres;

--
-- Name: TABLE "심평원인원월별"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."심평원인원월별" IS '심평원 기타인력정보(getEtcHstInfo2.8)의 물리·작업치료사 인원을 달마다 쌓습니다. (기관, 연월) 이 열쇠라 덮어쓰지 않습니다. hira_detail 은 「지금」, 이 표는 「흐름」입니다.';


--
-- Name: 알리오자리같음; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."알리오자리같음" (
    "묶음키" text NOT NULL,
    "누가" text,
    "언제" timestamp with time zone DEFAULT now() NOT NULL,
    "메모" text
);


ALTER TABLE public."알리오자리같음" OWNER TO postgres;

--
-- Name: TABLE "알리오자리같음"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."알리오자리같음" IS '사람이 「이 묶음의 자리 이름이 여럿이어도 같은 자리다」라고 정한 것.
   alio-group.mjs 가 짝확인필요를 셈할 때 이 표에 있으면 false 로 둡니다.
   묶음을 합치거나 지우지 않습니다 — 「확인 필요」 표시만 뗍니다 (2026-10-05).';


--
-- Name: 알리오직군고침; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."알리오직군고침" (
    sn bigint NOT NULL,
    group_no integer NOT NULL,
    "직군" text NOT NULL,
    "누가" text,
    "언제" timestamp with time zone DEFAULT now() NOT NULL,
    "근거" text
);


ALTER TABLE public."알리오직군고침" OWNER TO postgres;

--
-- Name: TABLE "알리오직군고침"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."알리오직군고침" IS '사람이 공고 원문(지원자격)으로 가린 직군. alio_group_src 가 「관리자직군」으로
   내보내고 alio-group.mjs 가 our_job 보다 먼저 씁니다. 수집기가 덮지 않습니다.
   근로복지공단이 「물리작업치료사」로 부르지만 한 직군만 뽑는 자리에 씁니다 (2026-10-07).';


--
-- Name: 알림기기; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."알림기기" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "어떻게" text DEFAULT 'webpush'::text NOT NULL,
    "주소" text NOT NULL,
    "열쇠1" text,
    "열쇠2" text,
    "켜짐" boolean DEFAULT true NOT NULL,
    "구독한때" timestamp with time zone DEFAULT now() NOT NULL,
    "마지막성공" timestamp with time zone,
    "연속실패" integer DEFAULT 0 NOT NULL,
    "꺼진때" timestamp with time zone,
    "꺼진까닭" text
);


ALTER TABLE public."알림기기" OWNER TO postgres;

--
-- Name: TABLE "알림기기"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."알림기기" IS '알림 받을 기기 하나가 한 줄. 구독한때 이후 공고만 보냅니다 — 가입 전 공고를 몰아 보내면 안 되기 때문입니다. 보내는 방법은 어떻게 칸에만 있고, 고르는 쪽은 그것을 모릅니다.';


--
-- Name: 알림기기_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public."알림기기" ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public."알림기기_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: 알림보낸것; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."알림보낸것" (
    id bigint NOT NULL,
    "기기id" bigint NOT NULL,
    "갈래" text NOT NULL,
    "공고id" text NOT NULL,
    "보낸때" timestamp with time zone DEFAULT now() NOT NULL,
    "결과" text
);


ALTER TABLE public."알림보낸것" OWNER TO postgres;

--
-- Name: TABLE "알림보낸것"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."알림보낸것" IS '보낸 기록. (기기id, 갈래, 공고id) 고유 제약이 중복 발송을 막습니다. 회원당 하루 상한을 세는 데도 씁니다.';


--
-- Name: 알림보낸것_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public."알림보낸것" ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public."알림보낸것_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: 알림함; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."알림함" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "갈래" text NOT NULL,
    "제목" text NOT NULL,
    "본문" text,
    "링크" text,
    "읽은때" timestamp with time zone,
    "만든때" timestamp with time zone DEFAULT now() NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."알림함" OWNER TO postgres;

--
-- Name: 알림함_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."알림함_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."알림함_id_seq" OWNER TO postgres;

--
-- Name: 알림함_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."알림함_id_seq" OWNED BY public."알림함".id;


--
-- Name: 애플연결; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."애플연결" (
    profile_id uuid NOT NULL,
    "토큰" text,
    "넣은때" timestamp with time zone DEFAULT now() NOT NULL,
    "끊은때" timestamp with time zone
);


ALTER TABLE public."애플연결" OWNER TO postgres;

--
-- Name: TABLE "애플연결"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."애플연결" IS '애플 refresh token. 탈퇴할 때 appleid.apple.com/auth/revoke 를 부르는 데만 씁니다 (2026-10-11)';


--
-- Name: 약관동의; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."약관동의" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "문서" text NOT NULL,
    "판" text NOT NULL,
    "동의시각" timestamp with time zone DEFAULT now() NOT NULL,
    "동의함" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."약관동의" OWNER TO postgres;

--
-- Name: 약관동의_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."약관동의_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."약관동의_id_seq" OWNER TO postgres;

--
-- Name: 약관동의_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."약관동의_id_seq" OWNED BY public."약관동의".id;


--
-- Name: 운영진글; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."운영진글" (
    "갈래" text NOT NULL,
    "글번호" bigint NOT NULL,
    "쓴역할" text NOT NULL,
    "쓴때" timestamp with time zone DEFAULT now() NOT NULL,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "운영진글_갈래_check" CHECK (("갈래" = ANY (ARRAY['글'::text, '댓글'::text])))
);


ALTER TABLE public."운영진글" OWNER TO postgres;

--
-- Name: 인증자료; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."인증자료" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "자격id" bigint,
    "갈래" text NOT NULL,
    "경로" text NOT NULL,
    "올린때" timestamp with time zone DEFAULT now() NOT NULL,
    "지운때" timestamp with time zone,
    "지운까닭" text,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "인증자료_갈래_check" CHECK (("갈래" = ANY (ARRAY['사업자등록증'::text, '고유번호증'::text, '사원증'::text, '재직증명서'::text, '활동이력'::text, '면허증'::text])))
);


ALTER TABLE public."인증자료" OWNER TO postgres;

--
-- Name: 인증자료_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."인증자료_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."인증자료_id_seq" OWNER TO postgres;

--
-- Name: 인증자료_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."인증자료_id_seq" OWNED BY public."인증자료".id;


--
-- Name: 인증자료열람; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."인증자료열람" (
    id bigint NOT NULL,
    "자료id" bigint NOT NULL,
    "누가" uuid NOT NULL,
    "언제" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."인증자료열람" OWNER TO postgres;

--
-- Name: 인증자료열람_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."인증자료열람_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."인증자료열람_id_seq" OWNER TO postgres;

--
-- Name: 인증자료열람_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."인증자료열람_id_seq" OWNED BY public."인증자료열람".id;


--
-- Name: 재직인증; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."재직인증" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "상태" text DEFAULT '심사중'::text NOT NULL,
    "병원이름" text,
    "경로" text,
    "파일지운때" timestamp with time zone,
    "신청때" timestamp with time zone DEFAULT now() NOT NULL,
    "정한사람" uuid,
    "정한때" timestamp with time zone,
    "반려까닭" text,
    "시험자료" boolean DEFAULT false NOT NULL,
    "동의한때" timestamp with time zone,
    "동의문구" text,
    CONSTRAINT "재직인증_상태_check" CHECK (("상태" = ANY (ARRAY['심사중'::text, '확인'::text, '반려'::text])))
);


ALTER TABLE public."재직인증" OWNER TO postgres;

--
-- Name: 재직인증_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."재직인증_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."재직인증_id_seq" OWNER TO postgres;

--
-- Name: 재직인증_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."재직인증_id_seq" OWNED BY public."재직인증".id;


--
-- Name: 청년정책; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."청년정책" (
    "번호" text NOT NULL,
    "정책명" text NOT NULL,
    "갈래" text NOT NULL,
    "대분류" text,
    "중분류" text,
    "키워드" text,
    "설명" text,
    "지원내용" text,
    "소관기관" text,
    "운영기관" text,
    "시도" text NOT NULL,
    "상시" boolean DEFAULT false NOT NULL,
    "신청시작" date,
    "신청끝" date,
    "사업시작" date,
    "사업끝" date,
    "신청방법" text,
    "추가자격" text,
    "나이최소" integer,
    "나이최대" integer,
    "나이제한없음" boolean,
    "신청주소" text,
    "참고주소" text,
    "조회수" integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."청년정책" OWNER TO postgres;

--
-- Name: TABLE "청년정책"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."청년정책" IS '온통청년 청년정책. 담당자 실명은 담지 않습니다 (칸 자체가 없습니다)';


--
-- Name: 칸기록; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."칸기록" (
    id bigint NOT NULL,
    job_id text NOT NULL,
    "칸" text NOT NULL,
    "옛값" text,
    "새값" text,
    "누가" text NOT NULL,
    "왜" text,
    "바뀐때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."칸기록" OWNER TO postgres;

--
-- Name: TABLE "칸기록"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."칸기록" IS '일곱 칸 값이 바뀐 기록 (전→후·누가·왜·언제). 30일 보관. job_state_log 의 칸 짝 (2026-10-18)';


--
-- Name: 칸기록_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."칸기록_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."칸기록_id_seq" OWNER TO postgres;

--
-- Name: 칸기록_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."칸기록_id_seq" OWNED BY public."칸기록".id;


--
-- Name: 함수사본; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."함수사본" (
    "이름" text,
    "때" timestamp with time zone DEFAULT now(),
    "정의" text
);


ALTER TABLE public."함수사본" OWNER TO postgres;

--
-- Name: 회원자격; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."회원자격" (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    "갈래" text NOT NULL,
    "기관번호" text,
    "교육기관" text,
    "상태" text DEFAULT '심사중'::text NOT NULL,
    "신청때" timestamp with time zone DEFAULT now() NOT NULL,
    "정한사람" uuid,
    "정한때" timestamp with time zone,
    "반려까닭" text,
    "면허확인" boolean DEFAULT false NOT NULL,
    "사업자번호" text,
    "사업자상태" text,
    "사업자확인때" timestamp with time zone,
    "사업자확인법" text,
    "시험자료" boolean DEFAULT false NOT NULL,
    CONSTRAINT "회원자격_갈래_check" CHECK (("갈래" = ANY (ARRAY['채용담당자'::text, '교육담당자기관'::text, '교육담당자개인'::text]))),
    CONSTRAINT "회원자격_상태_check" CHECK (("상태" = ANY (ARRAY['심사중'::text, '승인'::text, '반려'::text, '정지'::text])))
);


ALTER TABLE public."회원자격" OWNER TO postgres;

--
-- Name: 회원자격_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."회원자격_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."회원자격_id_seq" OWNER TO postgres;

--
-- Name: 회원자격_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."회원자격_id_seq" OWNED BY public."회원자격".id;


--
-- Name: 회원차단; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."회원차단" (
    "누가" uuid NOT NULL,
    "누구" uuid NOT NULL,
    "켬" boolean DEFAULT true NOT NULL,
    "때" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."회원차단" OWNER TO postgres;

--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_rooms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms ALTER COLUMN id SET DEFAULT nextval('public.chat_rooms_id_seq'::regclass);


--
-- Name: collector_beat id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collector_beat ALTER COLUMN id SET DEFAULT nextval('public.collector_beat_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: dementia_centers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dementia_centers ALTER COLUMN id SET DEFAULT nextval('public.dementia_centers_id_seq'::regclass);


--
-- Name: dementia_safe_centers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dementia_safe_centers ALTER COLUMN id SET DEFAULT nextval('public.dementia_safe_centers_id_seq'::regclass);


--
-- Name: dev_rehab_orgs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dev_rehab_orgs ALTER COLUMN id SET DEFAULT nextval('public.dev_rehab_orgs_id_seq'::regclass);


--
-- Name: home_blocks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.home_blocks ALTER COLUMN id SET DEFAULT nextval('public.home_blocks_id_seq'::regclass);


--
-- Name: hospitals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hospitals ALTER COLUMN id SET DEFAULT nextval('public.hospitals_id_seq'::regclass);


--
-- Name: job_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_attachments ALTER COLUMN id SET DEFAULT nextval('public.job_attachments_id_seq'::regclass);


--
-- Name: job_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_events ALTER COLUMN id SET DEFAULT nextval('public.job_events_id_seq'::regclass);


--
-- Name: job_post_edits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_post_edits ALTER COLUMN id SET DEFAULT nextval('public.job_post_edits_id_seq'::regclass);


--
-- Name: job_state_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_state_log ALTER COLUMN id SET DEFAULT nextval('public.job_state_log_id_seq'::regclass);


--
-- Name: ltc_facilities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ltc_facilities ALTER COLUMN id SET DEFAULT nextval('public.ltc_facilities_id_seq'::regclass);


--
-- Name: mental_centers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mental_centers ALTER COLUMN id SET DEFAULT nextval('public.mental_centers_id_seq'::regclass);


--
-- Name: ocr_zero id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ocr_zero ALTER COLUMN id SET DEFAULT nextval('public.ocr_zero_id_seq'::regclass);


--
-- Name: page_hits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_hits ALTER COLUMN id SET DEFAULT nextval('public.page_hits_id_seq'::regclass);


--
-- Name: post_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images ALTER COLUMN id SET DEFAULT nextval('public.post_images_id_seq'::regclass);


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: public_hospitals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_hospitals ALTER COLUMN id SET DEFAULT nextval('public.public_hospitals_id_seq'::regclass);


--
-- Name: push_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_devices ALTER COLUMN id SET DEFAULT nextval('public.push_devices_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: salary_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_records ALTER COLUMN id SET DEFAULT nextval('public.salary_records_id_seq'::regclass);


--
-- Name: student_specs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_specs ALTER COLUMN id SET DEFAULT nextval('public.student_specs_id_seq'::regclass);


--
-- Name: welfare_centers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.welfare_centers ALTER COLUMN id SET DEFAULT nextval('public.welfare_centers_id_seq'::regclass);


--
-- Name: welfare_facilities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.welfare_facilities ALTER COLUMN id SET DEFAULT nextval('public.welfare_facilities_id_seq'::regclass);


--
-- Name: 개인정보접속기록 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."개인정보접속기록" ALTER COLUMN id SET DEFAULT nextval('public."개인정보접속기록_id_seq"'::regclass);


--
-- Name: 공고신고 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고신고" ALTER COLUMN id SET DEFAULT nextval('public."공고신고_id_seq"'::regclass);


--
-- Name: 공고올림 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고올림" ALTER COLUMN id SET DEFAULT nextval('public."공고올림_id_seq"'::regclass);


--
-- Name: 공고첨부 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고첨부" ALTER COLUMN id SET DEFAULT nextval('public."공고첨부_id_seq"'::regclass);


--
-- Name: 교육과정 과정id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육과정" ALTER COLUMN "과정id" SET DEFAULT nextval('public."교육과정_과정id_seq"'::regclass);


--
-- Name: 교육기관알림 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육기관알림" ALTER COLUMN id SET DEFAULT nextval('public."교육기관알림_id_seq"'::regclass);


--
-- Name: 교육리뷰 리뷰id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰" ALTER COLUMN "리뷰id" SET DEFAULT nextval('public."교육리뷰_리뷰id_seq"'::regclass);


--
-- Name: 교육리뷰답글 답글id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰답글" ALTER COLUMN "답글id" SET DEFAULT nextval('public."교육리뷰답글_답글id_seq"'::regclass);


--
-- Name: 교육신청 신청id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육신청" ALTER COLUMN "신청id" SET DEFAULT nextval('public."교육신청_신청id_seq"'::regclass);


--
-- Name: 교육회차 회차id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육회차" ALTER COLUMN "회차id" SET DEFAULT nextval('public."교육회차_회차id_seq"'::regclass);


--
-- Name: 권한 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."권한" ALTER COLUMN id SET DEFAULT nextval('public."권한_id_seq"'::regclass);


--
-- Name: 권한기록 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."권한기록" ALTER COLUMN id SET DEFAULT nextval('public."권한기록_id_seq"'::regclass);


--
-- Name: 알림함 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림함" ALTER COLUMN id SET DEFAULT nextval('public."알림함_id_seq"'::regclass);


--
-- Name: 약관동의 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."약관동의" ALTER COLUMN id SET DEFAULT nextval('public."약관동의_id_seq"'::regclass);


--
-- Name: 인증자료 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."인증자료" ALTER COLUMN id SET DEFAULT nextval('public."인증자료_id_seq"'::regclass);


--
-- Name: 인증자료열람 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."인증자료열람" ALTER COLUMN id SET DEFAULT nextval('public."인증자료열람_id_seq"'::regclass);


--
-- Name: 재직인증 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."재직인증" ALTER COLUMN id SET DEFAULT nextval('public."재직인증_id_seq"'::regclass);


--
-- Name: 칸기록 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."칸기록" ALTER COLUMN id SET DEFAULT nextval('public."칸기록_id_seq"'::regclass);


--
-- Name: 회원자격 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원자격" ALTER COLUMN id SET DEFAULT nextval('public."회원자격_id_seq"'::regclass);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (profile_id);


--
-- Name: alio_compete alio_compete_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_compete
    ADD CONSTRAINT alio_compete_pkey PRIMARY KEY (sn, step_sn);


--
-- Name: alio_compete_state alio_compete_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_compete_state
    ADD CONSTRAINT alio_compete_state_pkey PRIMARY KEY ("말");


--
-- Name: alio_compete_web alio_compete_web_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_compete_web
    ADD CONSTRAINT alio_compete_web_pkey PRIMARY KEY (sn, group_no, step_no);


--
-- Name: alio_compete_web_state alio_compete_web_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_compete_web_state
    ADD CONSTRAINT alio_compete_web_state_pkey PRIMARY KEY (sn);


--
-- Name: alio_group_sum alio_group_sum_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_group_sum
    ADD CONSTRAINT alio_group_sum_pkey PRIMARY KEY ("묶음키");


--
-- Name: alio_hiretype_fix alio_hiretype_fix_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_hiretype_fix
    ADD CONSTRAINT alio_hiretype_fix_pkey PRIMARY KEY (sn, group_no);


--
-- Name: alio_post_file alio_post_file_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_post_file
    ADD CONSTRAINT alio_post_file_pkey PRIMARY KEY (sn, file_no);


--
-- Name: alio_post_meta alio_post_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alio_post_meta
    ADD CONSTRAINT alio_post_meta_pkey PRIMARY KEY (sn);


--
-- Name: api_quota api_quota_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_quota
    ADD CONSTRAINT api_quota_pkey PRIMARY KEY ("날", "서비스");


--
-- Name: api_roster api_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_roster
    ADD CONSTRAINT api_roster_pkey PRIMARY KEY (source, org_name);


--
-- Name: chat_members chat_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_pkey PRIMARY KEY (room_id, profile_id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_rooms chat_rooms_dm_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_dm_key_key UNIQUE (dm_key);


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: collect_secret_all collect_secret_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collect_secret_all
    ADD CONSTRAINT collect_secret_pkey PRIMARY KEY (source, secret);


--
-- Name: collect_source collect_source_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collect_source
    ADD CONSTRAINT collect_source_pkey PRIMARY KEY (code);


--
-- Name: collectable_orgs collectable_orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collectable_orgs
    ADD CONSTRAINT collectable_orgs_pkey PRIMARY KEY (org_name);


--
-- Name: collector_beat collector_beat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collector_beat
    ADD CONSTRAINT collector_beat_pkey PRIMARY KEY (id);


--
-- Name: collector_state collector_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collector_state
    ADD CONSTRAINT collector_state_pkey PRIMARY KEY (key);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: dementia_centers dementia_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dementia_centers
    ADD CONSTRAINT dementia_centers_pkey PRIMARY KEY (id);


--
-- Name: dementia_safe_centers dementia_safe_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dementia_safe_centers
    ADD CONSTRAINT dementia_safe_centers_pkey PRIMARY KEY (id);


--
-- Name: dev_rehab_orgs dev_rehab_orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dev_rehab_orgs
    ADD CONSTRAINT dev_rehab_orgs_pkey PRIMARY KEY (id);


--
-- Name: drop_rules drop_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drop_rules
    ADD CONSTRAINT drop_rules_pkey PRIMARY KEY (key);


--
-- Name: erased_accounts erased_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.erased_accounts
    ADD CONSTRAINT erased_accounts_pkey PRIMARY KEY (profile_id);


--
-- Name: hand_check hand_check_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hand_check
    ADD CONSTRAINT hand_check_pkey PRIMARY KEY ("이름");


--
-- Name: hira_cl_cd hira_cl_cd_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hira_cl_cd
    ADD CONSTRAINT hira_cl_cd_pkey PRIMARY KEY (cl_cd);


--
-- Name: hira_detail hira_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hira_detail
    ADD CONSTRAINT hira_detail_pkey PRIMARY KEY (ykiho);


--
-- Name: hira_org hira_org_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hira_org
    ADD CONSTRAINT hira_org_pkey PRIMARY KEY (ykiho);


--
-- Name: hira_quota hira_quota_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hira_quota
    ADD CONSTRAINT hira_quota_pkey PRIMARY KEY (day);


--
-- Name: home_blocks home_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.home_blocks
    ADD CONSTRAINT home_blocks_pkey PRIMARY KEY (id);


--
-- Name: home_texts home_texts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.home_texts
    ADD CONSTRAINT home_texts_pkey PRIMARY KEY (key);


--
-- Name: hosp_sites hosp_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosp_sites
    ADD CONSTRAINT hosp_sites_pkey PRIMARY KEY (name, url_key);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: job_attachments job_attachments_job_id_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_attachments
    ADD CONSTRAINT job_attachments_job_id_url_key UNIQUE (job_id, url);


--
-- Name: job_attachments job_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_attachments
    ADD CONSTRAINT job_attachments_pkey PRIMARY KEY (id);


--
-- Name: job_body job_body_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_body
    ADD CONSTRAINT job_body_pkey PRIMARY KEY (job_id, kind, ord);


--
-- Name: job_events job_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_events
    ADD CONSTRAINT job_events_pkey PRIMARY KEY (id);


--
-- Name: job_hides job_hides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_hides
    ADD CONSTRAINT job_hides_pkey PRIMARY KEY (job_id);


--
-- Name: job_post_edits job_post_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_post_edits
    ADD CONSTRAINT job_post_edits_pkey PRIMARY KEY (id);


--
-- Name: job_posts job_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posts
    ADD CONSTRAINT job_posts_pkey PRIMARY KEY (id);


--
-- Name: job_stars job_stars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_stars
    ADD CONSTRAINT job_stars_pkey PRIMARY KEY (profile_id, job_id);


--
-- Name: job_state_log job_state_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_state_log
    ADD CONSTRAINT job_state_log_pkey PRIMARY KEY (id);


--
-- Name: job_sync_log job_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_sync_log
    ADD CONSTRAINT job_sync_log_pkey PRIMARY KEY (id);


--
-- Name: job_tab_cards job_tab_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_tab_cards
    ADD CONSTRAINT job_tab_cards_pkey PRIMARY KEY (tab_key);


--
-- Name: job_trash job_trash_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_trash
    ADD CONSTRAINT job_trash_pkey PRIMARY KEY (id);


--
-- Name: ltc_facilities ltc_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ltc_facilities
    ADD CONSTRAINT ltc_facilities_pkey PRIMARY KEY (id);


--
-- Name: mental_centers mental_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mental_centers
    ADD CONSTRAINT mental_centers_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (profile_id);


--
-- Name: ocr_zero ocr_zero_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ocr_zero
    ADD CONSTRAINT ocr_zero_pkey PRIMARY KEY (id);


--
-- Name: org_alias org_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_alias
    ADD CONSTRAINT org_alias_pkey PRIMARY KEY (our_name);


--
-- Name: org_match_before org_match_before_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_match_before
    ADD CONSTRAINT org_match_before_pkey PRIMARY KEY (job_id);


--
-- Name: org_note org_note_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_note
    ADD CONSTRAINT org_note_pkey PRIMARY KEY (name);


--
-- Name: org_stars org_stars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_stars
    ADD CONSTRAINT org_stars_pkey PRIMARY KEY (profile_id, org_name);


--
-- Name: page_hits page_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.page_hits
    ADD CONSTRAINT page_hits_pkey PRIMARY KEY (id);


--
-- Name: post_images post_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, profile_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_nickname_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_nickname_key UNIQUE (nickname);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: pub_baseline pub_baseline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pub_baseline
    ADD CONSTRAINT pub_baseline_pkey PRIMARY KEY ("한줄");


--
-- Name: public_hospitals public_hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_hospitals
    ADD CONSTRAINT public_hospitals_pkey PRIMARY KEY (id);


--
-- Name: push_devices push_devices_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_endpoint_key UNIQUE (endpoint);


--
-- Name: push_devices push_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_pkey PRIMARY KEY (id);


--
-- Name: rejudge_hidden rejudge_hidden_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rejudge_hidden
    ADD CONSTRAINT rejudge_hidden_pkey PRIMARY KEY (job_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reports reports_target_type_target_id_reporter_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_target_type_target_id_reporter_id_key UNIQUE (target_type, target_id, reporter_id);


--
-- Name: rival_match rival_match_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rival_match
    ADD CONSTRAINT rival_match_pkey PRIMARY KEY ("경쟁사", "글번호");


--
-- Name: rival_org_todo rival_org_todo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rival_org_todo
    ADD CONSTRAINT rival_org_todo_pkey PRIMARY KEY ("기관명");


--
-- Name: rival_post rival_post_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rival_post
    ADD CONSTRAINT rival_post_pkey PRIMARY KEY ("경쟁사", "글번호");


--
-- Name: salary_records salary_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_records
    ADD CONSTRAINT salary_records_pkey PRIMARY KEY (id);


--
-- Name: salary_records salary_records_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_records
    ADD CONSTRAINT salary_records_profile_id_key UNIQUE (profile_id);


--
-- Name: seen_postings seen_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seen_postings
    ADD CONSTRAINT seen_postings_pkey PRIMARY KEY (source, external_id);


--
-- Name: site_checks site_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_checks
    ADD CONSTRAINT site_checks_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- Name: site_state site_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_state
    ADD CONSTRAINT site_state_pkey PRIMARY KEY (name);


--
-- Name: spec_langs spec_langs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spec_langs
    ADD CONSTRAINT spec_langs_pkey PRIMARY KEY (id);


--
-- Name: student_specs student_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_specs
    ADD CONSTRAINT student_specs_pkey PRIMARY KEY (id);


--
-- Name: student_specs student_specs_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_specs
    ADD CONSTRAINT student_specs_profile_id_key UNIQUE (profile_id);


--
-- Name: ui_icons ui_icons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ui_icons
    ADD CONSTRAINT ui_icons_pkey PRIMARY KEY (slot);


--
-- Name: welfare_centers welfare_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.welfare_centers
    ADD CONSTRAINT welfare_centers_pkey PRIMARY KEY (id);


--
-- Name: welfare_facilities welfare_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.welfare_facilities
    ADD CONSTRAINT welfare_facilities_pkey PRIMARY KEY (id);


--
-- Name: wn_verdicts wn_verdicts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wn_verdicts
    ADD CONSTRAINT wn_verdicts_pkey PRIMARY KEY (wanted_auth_no);


--
-- Name: 개인정보접속기록 개인정보접속기록_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."개인정보접속기록"
    ADD CONSTRAINT "개인정보접속기록_pkey" PRIMARY KEY (id);


--
-- Name: 공고신고 공고신고_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고신고"
    ADD CONSTRAINT "공고신고_pkey" PRIMARY KEY (id);


--
-- Name: 공고올림 공고올림_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고올림"
    ADD CONSTRAINT "공고올림_pkey" PRIMARY KEY (id);


--
-- Name: 공고첨부 공고첨부_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고첨부"
    ADD CONSTRAINT "공고첨부_pkey" PRIMARY KEY (id);


--
-- Name: 공휴일 공휴일_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공휴일"
    ADD CONSTRAINT "공휴일_pkey" PRIMARY KEY ("날");


--
-- Name: 광고배너 광고배너_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."광고배너"
    ADD CONSTRAINT "광고배너_pkey" PRIMARY KEY ("자리");


--
-- Name: 광고셈 광고셈_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."광고셈"
    ADD CONSTRAINT "광고셈_pkey" PRIMARY KEY ("자리", "날");


--
-- Name: 교육 교육_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육"
    ADD CONSTRAINT "교육_pkey" PRIMARY KEY ("번호");


--
-- Name: 교육과정 교육과정_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육과정"
    ADD CONSTRAINT "교육과정_pkey" PRIMARY KEY ("과정id");


--
-- Name: 교육기관 교육기관_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육기관"
    ADD CONSTRAINT "교육기관_pkey" PRIMARY KEY ("이름");


--
-- Name: 교육기관알림 교육기관알림_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육기관알림"
    ADD CONSTRAINT "교육기관알림_pkey" PRIMARY KEY (id);


--
-- Name: 교육기관알림 교육기관알림_회원_기관_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육기관알림"
    ADD CONSTRAINT "교육기관알림_회원_기관_key" UNIQUE ("회원", "기관");


--
-- Name: 교육리뷰 교육리뷰_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰"
    ADD CONSTRAINT "교육리뷰_pkey" PRIMARY KEY ("리뷰id");


--
-- Name: 교육리뷰 교육리뷰_회차id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰"
    ADD CONSTRAINT "교육리뷰_회차id_profile_id_key" UNIQUE ("회차id", profile_id);


--
-- Name: 교육리뷰답글 교육리뷰답글_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰답글"
    ADD CONSTRAINT "교육리뷰답글_pkey" PRIMARY KEY ("답글id");


--
-- Name: 교육신청 교육신청_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육신청"
    ADD CONSTRAINT "교육신청_pkey" PRIMARY KEY ("신청id");


--
-- Name: 교육신청 교육신청_회차id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육신청"
    ADD CONSTRAINT "교육신청_회차id_profile_id_key" UNIQUE ("회차id", profile_id);


--
-- Name: 교육회차 교육회차_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육회차"
    ADD CONSTRAINT "교육회차_pkey" PRIMARY KEY ("회차id");


--
-- Name: 권한 권한_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."권한"
    ADD CONSTRAINT "권한_pkey" PRIMARY KEY (id);


--
-- Name: 권한기록 권한기록_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."권한기록"
    ADD CONSTRAINT "권한기록_pkey" PRIMARY KEY (id);


--
-- Name: 기관 기관_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."기관"
    ADD CONSTRAINT "기관_pkey" PRIMARY KEY ("기관번호");


--
-- Name: 기관이름줄임 기관이름줄임_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."기관이름줄임"
    ADD CONSTRAINT "기관이름줄임_pkey" PRIMARY KEY ("원래이름");


--
-- Name: 기관주소 기관주소_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."기관주소"
    ADD CONSTRAINT "기관주소_pkey" PRIMARY KEY ("이름키");


--
-- Name: 기관지역 기관지역_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."기관지역"
    ADD CONSTRAINT "기관지역_pkey" PRIMARY KEY ("기관");


--
-- Name: 대화차단 대화차단_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."대화차단"
    ADD CONSTRAINT "대화차단_pkey" PRIMARY KEY ("막은사람", "막힌사람");


--
-- Name: 마스터페르소나 마스터페르소나_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."마스터페르소나"
    ADD CONSTRAINT "마스터페르소나_pkey" PRIMARY KEY (auth_id);


--
-- Name: 묶지않음 묶지않음_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."묶지않음"
    ADD CONSTRAINT "묶지않음_pkey" PRIMARY KEY ("왼쪽", "오른쪽");


--
-- Name: 봉사모집 봉사모집_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."봉사모집"
    ADD CONSTRAINT "봉사모집_pkey" PRIMARY KEY ("번호");


--
-- Name: 봉사처 봉사처_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."봉사처"
    ADD CONSTRAINT "봉사처_pkey" PRIMARY KEY ("기관코드");


--
-- Name: 수집기짝 수집기짝_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."수집기짝"
    ADD CONSTRAINT "수집기짝_pkey" PRIMARY KEY ("새출처");


--
-- Name: 수집판정 수집판정_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."수집판정"
    ADD CONSTRAINT "수집판정_pkey" PRIMARY KEY (source, "번호");


--
-- Name: 시군광역 시군광역_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."시군광역"
    ADD CONSTRAINT "시군광역_pkey" PRIMARY KEY ("시군");


--
-- Name: 시군구시도 시군구시도_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."시군구시도"
    ADD CONSTRAINT "시군구시도_pkey" PRIMARY KEY ("시군구");


--
-- Name: 심평원인원월별 심평원인원월별_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."심평원인원월별"
    ADD CONSTRAINT "심평원인원월별_pkey" PRIMARY KEY (ykiho, "연월");


--
-- Name: 알리오자리같음 알리오자리같음_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알리오자리같음"
    ADD CONSTRAINT "알리오자리같음_pkey" PRIMARY KEY ("묶음키");


--
-- Name: 알리오직군고침 알리오직군고침_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알리오직군고침"
    ADD CONSTRAINT "알리오직군고침_pkey" PRIMARY KEY (sn, group_no);


--
-- Name: 알림기기 알림기기_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림기기"
    ADD CONSTRAINT "알림기기_pkey" PRIMARY KEY (id);


--
-- Name: 알림기기 알림기기_어떻게_주소_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림기기"
    ADD CONSTRAINT "알림기기_어떻게_주소_key" UNIQUE ("어떻게", "주소");


--
-- Name: 알림보낸것 알림보낸것_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림보낸것"
    ADD CONSTRAINT "알림보낸것_pkey" PRIMARY KEY (id);


--
-- Name: 알림보낸것 알림보낸것_기기id_갈래_공고id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림보낸것"
    ADD CONSTRAINT "알림보낸것_기기id_갈래_공고id_key" UNIQUE ("기기id", "갈래", "공고id");


--
-- Name: 알림함 알림함_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림함"
    ADD CONSTRAINT "알림함_pkey" PRIMARY KEY (id);


--
-- Name: 애플연결 애플연결_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."애플연결"
    ADD CONSTRAINT "애플연결_pkey" PRIMARY KEY (profile_id);


--
-- Name: 약관동의 약관동의_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."약관동의"
    ADD CONSTRAINT "약관동의_pkey" PRIMARY KEY (id);


--
-- Name: 운영진글 운영진글_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."운영진글"
    ADD CONSTRAINT "운영진글_pkey" PRIMARY KEY ("갈래", "글번호");


--
-- Name: 인증자료 인증자료_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."인증자료"
    ADD CONSTRAINT "인증자료_pkey" PRIMARY KEY (id);


--
-- Name: 인증자료열람 인증자료열람_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."인증자료열람"
    ADD CONSTRAINT "인증자료열람_pkey" PRIMARY KEY (id);


--
-- Name: 재직인증 재직인증_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."재직인증"
    ADD CONSTRAINT "재직인증_pkey" PRIMARY KEY (id);


--
-- Name: 청년정책 청년정책_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."청년정책"
    ADD CONSTRAINT "청년정책_pkey" PRIMARY KEY ("번호");


--
-- Name: 칸기록 칸기록_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."칸기록"
    ADD CONSTRAINT "칸기록_pkey" PRIMARY KEY (id);


--
-- Name: 회원자격 회원자격_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원자격"
    ADD CONSTRAINT "회원자격_pkey" PRIMARY KEY (id);


--
-- Name: 회원차단 회원차단_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원차단"
    ADD CONSTRAINT "회원차단_pkey" PRIMARY KEY ("누가", "누구");


--
-- Name: alio_compete_inst_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alio_compete_inst_idx ON public.alio_compete USING btree (inst_nm, year DESC);


--
-- Name: alio_compete_job_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alio_compete_job_idx ON public.alio_compete USING btree (our_job) WHERE (our_job IS NOT NULL);


--
-- Name: alio_compete_web_last; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alio_compete_web_last ON public.alio_compete_web USING btree (sn) WHERE is_last;


--
-- Name: alio_compete_year_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alio_compete_year_idx ON public.alio_compete USING btree (year DESC, inst_nm);


--
-- Name: alio_group_sum_값; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "alio_group_sum_값" ON public.alio_group_sum USING btree ("값있음" DESC);


--
-- Name: alio_group_sum_고름; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "alio_group_sum_고름" ON public.alio_group_sum USING btree ("기관", "직군", "지역", "고용형태");


--
-- Name: alio_group_sum_우리; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "alio_group_sum_우리" ON public.alio_group_sum USING btree ("우리직군") WHERE "우리직군";


--
-- Name: alio_web_고름; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "alio_web_고름" ON public.alio_compete_web USING btree ("직군키", "지역", "고용형태") WHERE is_last;


--
-- Name: alio_web_묶음; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "alio_web_묶음" ON public.alio_compete_web USING btree ("묶음키") WHERE is_last;


--
-- Name: api_quota_날; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "api_quota_날" ON public.api_quota USING btree ("날" DESC);


--
-- Name: api_roster_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX api_roster_key ON public.api_roster USING btree (name_key);


--
-- Name: chat_member_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_member_idx ON public.chat_members USING btree (profile_id);


--
-- Name: chat_msg_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_msg_idx ON public.chat_messages USING btree (room_id, created_at DESC);


--
-- Name: collectable_orgs_ok_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collectable_orgs_ok_idx ON public.collectable_orgs USING btree (ok, checked_on DESC);


--
-- Name: collector_beat_src_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collector_beat_src_idx ON public.collector_beat USING btree (source, ran_at DESC);


--
-- Name: comment_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comment_post_idx ON public.comments USING btree (post_id, created_at);


--
-- Name: drop_rules_enabled_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX drop_rules_enabled_idx ON public.drop_rules USING btree (enabled) WHERE enabled;


--
-- Name: hira_org_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hira_org_name_key ON public.hira_org USING btree (name_key);


--
-- Name: hira_org_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hira_org_url ON public.hira_org USING btree (ykiho) WHERE (hosp_url IS NOT NULL);


--
-- Name: home_blocks_kind_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX home_blocks_kind_sort ON public.home_blocks USING btree (kind, sort) WHERE enabled;


--
-- Name: hosp_kind_stat_kind; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX hosp_kind_stat_kind ON public.hosp_kind_stat USING btree (kind);


--
-- Name: hosp_sites_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hosp_sites_key ON public.hosp_sites USING btree (public.org_key(name));


--
-- Name: hosp_sites_이름열쇠_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "hosp_sites_이름열쇠_idx" ON public.hosp_sites USING btree ("이름열쇠");


--
-- Name: hospitals_kind_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hospitals_kind_idx ON public.hospitals USING btree (kind);


--
-- Name: hospitals_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hospitals_name_trgm ON public.hospitals USING gin (name extensions.gin_trgm_ops);


--
-- Name: hospitals_orgkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hospitals_orgkey ON public.hospitals USING btree (public.org_key(name));


--
-- Name: hospitals_region_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX hospitals_region_idx ON public.hospitals USING btree (sido, sgg);


--
-- Name: job_att_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_att_idx ON public.job_attachments USING btree (job_id);


--
-- Name: job_attachments_만든때_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "job_attachments_만든때_idx" ON public.job_attachments USING btree ("만든때" DESC);


--
-- Name: job_body_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_body_source_idx ON public.job_body USING btree (source, taken_at DESC);


--
-- Name: job_deadline_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_deadline_idx ON public.job_posts USING btree (apply_to) WHERE ((NOT hidden) AND (NOT hold));


--
-- Name: job_edit_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_edit_idx ON public.job_post_edits USING btree (job_id, edited_at DESC);


--
-- Name: job_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_event_idx ON public.job_events USING btree (job_id, created_at DESC);


--
-- Name: job_event_old_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_event_old_idx ON public.job_events USING btree (created_at);


--
-- Name: job_live_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_live_idx ON public.job_posts USING btree (job_group, sido, posted_at DESC) WHERE ((NOT hidden) AND (NOT hold));


--
-- Name: job_org_job_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX job_org_job_id_idx ON public.job_org USING btree (job_id);


--
-- Name: job_posts_admin_locked_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_posts_admin_locked_idx ON public.job_posts USING btree (admin_locked) WHERE admin_locked;


--
-- Name: job_posts_db_insert_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_posts_db_insert_at ON public.job_posts USING btree (source, db_insert_at DESC);


--
-- Name: job_posts_first_seen_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_posts_first_seen_idx ON public.job_posts USING btree (first_seen) WHERE (apply_to IS NULL);


--
-- Name: job_posts_hidden_why_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_posts_hidden_why_idx ON public.job_posts USING btree (hidden_why) WHERE (hidden_why IS NOT NULL);


--
-- Name: job_posts_is_intern_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_posts_is_intern_idx ON public.job_posts USING btree (is_intern) WHERE is_intern;


--
-- Name: job_posts_nodeadline_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_posts_nodeadline_idx ON public.job_posts USING btree (seen_on) WHERE ((apply_to IS NULL) AND (NOT hidden) AND (NOT hold));


--
-- Name: job_posts_같은공고; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "job_posts_같은공고" ON public.job_posts USING btree ("같은공고") WHERE ("같은공고" IS NOT NULL);


--
-- Name: job_posts_기관번호_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "job_posts_기관번호_idx" ON public.job_posts USING btree ("기관번호");


--
-- Name: job_posts_수집묶음_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "job_posts_수집묶음_idx" ON public.job_posts USING btree ("수집묶음") WHERE ("수집묶음" IS NOT NULL);


--
-- Name: job_posts_이름열쇠_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "job_posts_이름열쇠_idx" ON public.job_posts USING btree ("이름열쇠");


--
-- Name: job_score_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_score_idx ON public.job_posts USING btree (score DESC, posted_at DESC) WHERE ((NOT hidden) AND (NOT hold));


--
-- Name: job_src_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX job_src_uniq ON public.job_posts USING btree (source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: job_star_job_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_star_job_idx ON public.job_stars USING btree (job_id);


--
-- Name: job_state_log_job_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_state_log_job_idx ON public.job_state_log USING btree (job_id, "바뀐때" DESC);


--
-- Name: job_state_log_때_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "job_state_log_때_idx" ON public.job_state_log USING btree ("바뀐때" DESC);


--
-- Name: job_sync_log_ran; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_sync_log_ran ON public.job_sync_log USING btree (ran_at DESC);


--
-- Name: job_tab_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_tab_idx ON public.job_posts USING btree (tab, posted_at DESC) WHERE ((NOT hidden) AND (NOT hold));


--
-- Name: job_title_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_title_trgm ON public.job_posts USING gin (title extensions.gin_trgm_ops);


--
-- Name: job_trash_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_trash_at ON public.job_trash USING btree (trashed_at DESC);


--
-- Name: job_trash_why; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_trash_why ON public.job_trash USING btree (why);


--
-- Name: ltc_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ltc_name_trgm ON public.ltc_facilities USING gin (name extensions.gin_trgm_ops);


--
-- Name: ltc_region_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ltc_region_idx ON public.ltc_facilities USING btree (sido, sgg);


--
-- Name: mc_region_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mc_region_idx ON public.mental_centers USING btree (sido, sgg);


--
-- Name: ocr_zero_때; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ocr_zero_때" ON public.ocr_zero USING btree ("때" DESC);


--
-- Name: org_coverage_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX org_coverage_key ON public.org_coverage USING btree (key);


--
-- Name: org_coverage_갈래; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "org_coverage_갈래" ON public.org_coverage USING btree ("갈래");


--
-- Name: org_coverage_길; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "org_coverage_길" ON public.org_coverage USING btree ("길");


--
-- Name: org_coverage_마지막; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "org_coverage_마지막" ON public.org_coverage USING btree ("마지막");


--
-- Name: org_coverage_자리; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "org_coverage_자리" ON public.org_coverage USING btree ("자리");


--
-- Name: org_dir_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_dir_name_trgm ON public.org_directory USING gin (name extensions.gin_trgm_ops);


--
-- Name: org_dir_region_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_dir_region_idx ON public.org_directory USING btree (sido, sgg);


--
-- Name: org_dir_sido_std_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_dir_sido_std_idx ON public.org_directory USING btree (public.org_sido(sido, addr));


--
-- Name: org_dir_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_dir_source_idx ON public.org_directory USING btree (source);


--
-- Name: org_group_mv_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_group_mv_key_idx ON public.org_group_mv USING btree (key);


--
-- Name: org_group_mv_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_group_mv_name_idx ON public.org_group_mv USING btree (name);


--
-- Name: org_group_mv_namekey2_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_group_mv_namekey2_idx ON public.org_group_mv USING btree (public.org_name_key(name, true));


--
-- Name: org_group_mv_namekey_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_group_mv_namekey_idx ON public.org_group_mv USING btree (public.org_name_key(name));


--
-- Name: org_group_mv_sido_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_group_mv_sido_idx ON public.org_group_mv USING btree (sido_std);


--
-- Name: org_group_mv_sido_namekey_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_group_mv_sido_namekey_idx ON public.org_group_mv USING btree (sido_std, public.org_name_key(name));


--
-- Name: page_hits_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_hits_day ON public.page_hits USING btree (day);


--
-- Name: page_hits_day_kind; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_hits_day_kind ON public.page_hits USING btree (day, kind);


--
-- Name: page_hits_device_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_hits_device_idx ON public.page_hits USING btree (day, device);


--
-- Name: page_hits_job_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_hits_job_target_idx ON public.page_hits USING btree (target) WHERE (kind = 'job'::text);


--
-- Name: page_hits_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX page_hits_target ON public.page_hits USING btree (kind, target) WHERE (target IS NOT NULL);


--
-- Name: post_image_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_image_idx ON public.post_images USING btree (post_id, sort);


--
-- Name: post_list_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_list_idx ON public.posts USING btree (channel, created_at DESC) WHERE (NOT hidden);


--
-- Name: posts_hidden_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posts_hidden_idx ON public.posts USING btree (hidden, id DESC);


--
-- Name: profiles_닉네임_하나만; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_닉네임_하나만" ON public.profiles USING btree (public."닉네임다듬기"(nickname));


--
-- Name: profiles_회원번호; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_회원번호" ON public.profiles USING btree ("회원번호");


--
-- Name: report_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX report_target_idx ON public.reports USING btree (target_type, target_id);


--
-- Name: reports_once; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX reports_once ON public.reports USING btree (target_type, target_id, reporter_id);


--
-- Name: reports_미처리; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "reports_미처리" ON public.reports USING btree (created_at DESC) WHERE (handled_at IS NULL);


--
-- Name: rival_post_때; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rival_post_때" ON public.rival_post USING btree ("처음본때" DESC);


--
-- Name: salary_group_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salary_group_idx ON public.salary_records USING btree (hospital_type, region, hired_year);


--
-- Name: salary_mine_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX salary_mine_idx ON public.salary_records USING btree (profile_id);


--
-- Name: seen_old_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX seen_old_idx ON public.seen_postings USING btree (opened_at);


--
-- Name: site_checks_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX site_checks_name_idx ON public.site_checks USING btree (name, checked_on DESC);


--
-- Name: spec_langs_one_per_exam; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX spec_langs_one_per_exam ON public.spec_langs USING btree (profile_id, exam);


--
-- Name: spec_langs_profile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX spec_langs_profile ON public.spec_langs USING btree (profile_id);


--
-- Name: spec_mine_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX spec_mine_idx ON public.student_specs USING btree (profile_id);


--
-- Name: wf_region_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wf_region_idx ON public.welfare_facilities USING btree (sido, sgg);


--
-- Name: 공고신고_미처리; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "공고신고_미처리" ON public."공고신고" USING btree (created_at DESC) WHERE (handled_at IS NULL);


--
-- Name: 공고신고_한번; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "공고신고_한번" ON public."공고신고" USING btree (job_id, reporter_id) WHERE (handled_at IS NULL);


--
-- Name: 공고올림_지금; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "공고올림_지금" ON public."공고올림" USING btree (job_id, "부터", "까지");


--
-- Name: 공고첨부_공고; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "공고첨부_공고" ON public."공고첨부" USING btree ("공고id") WHERE ("지운때" IS NULL);


--
-- Name: 공고첨부_회차; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "공고첨부_회차" ON public."공고첨부" USING btree ("회차id") WHERE ("지운때" IS NULL);


--
-- Name: 교육_시작; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "교육_시작" ON public."교육" USING btree ("시작" DESC NULLS LAST);


--
-- Name: 교육_출처; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "교육_출처" ON public."교육" USING btree ("출처");


--
-- Name: 교육회차_과정; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "교육회차_과정" ON public."교육회차" USING btree ("과정id");


--
-- Name: 권한_사람; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "권한_사람" ON public."권한" USING btree (profile_id);


--
-- Name: 권한_살아있는것; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "권한_살아있는것" ON public."권한" USING btree (profile_id, "권한코드") WHERE ("끈때" IS NULL);


--
-- Name: 권한기록_때; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "권한기록_때" ON public."권한기록" USING btree ("언제" DESC);


--
-- Name: 봉사모집_고르기; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "봉사모집_고르기" ON public."봉사모집" USING btree ("갈래", "시도", "상태", "올린날" DESC);


--
-- Name: 봉사모집_올린날; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "봉사모집_올린날" ON public."봉사모집" USING btree ("올린날" DESC);


--
-- Name: 심평원인원월별_연월; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "심평원인원월별_연월" ON public."심평원인원월별" USING btree ("연월");


--
-- Name: 알림기기_회원; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "알림기기_회원" ON public."알림기기" USING btree (profile_id) WHERE "켜짐";


--
-- Name: 알림보낸것_기기_때; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "알림보낸것_기기_때" ON public."알림보낸것" USING btree ("기기id", "보낸때" DESC);


--
-- Name: 알림함_사람; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "알림함_사람" ON public."알림함" USING btree (profile_id, "만든때" DESC);


--
-- Name: 약관동의_사람; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "약관동의_사람" ON public."약관동의" USING btree (profile_id, "동의시각" DESC);


--
-- Name: 약관동의_한판에하나; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "약관동의_한판에하나" ON public."약관동의" USING btree (profile_id, "문서", "판");


--
-- Name: 인증자료_사람; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "인증자료_사람" ON public."인증자료" USING btree (profile_id);


--
-- Name: 재직인증_한사람한줄; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "재직인증_한사람한줄" ON public."재직인증" USING btree (profile_id) WHERE ("상태" = ANY (ARRAY['심사중'::text, '확인'::text]));


--
-- Name: 접속기록_누가; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "접속기록_누가" ON public."개인정보접속기록" USING btree ("누가", "언제" DESC);


--
-- Name: 접속기록_언제; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "접속기록_언제" ON public."개인정보접속기록" USING btree ("언제" DESC);


--
-- Name: 청년정책_갈래시도; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "청년정책_갈래시도" ON public."청년정책" USING btree ("갈래", "시도");


--
-- Name: 청년정책_신청끝; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "청년정책_신청끝" ON public."청년정책" USING btree ("신청끝");


--
-- Name: 칸기록_공고_때; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "칸기록_공고_때" ON public."칸기록" USING btree (job_id, "바뀐때" DESC);


--
-- Name: 칸기록_때; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "칸기록_때" ON public."칸기록" USING btree ("바뀐때" DESC);


--
-- Name: 회원자격_교육개인; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "회원자격_교육개인" ON public."회원자격" USING btree (profile_id) WHERE ("갈래" = '교육담당자개인'::text);


--
-- Name: 회원자격_교육기관; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "회원자격_교육기관" ON public."회원자격" USING btree (profile_id, "교육기관") WHERE ("갈래" = '교육담당자기관'::text);


--
-- Name: 회원자격_채용; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "회원자격_채용" ON public."회원자격" USING btree (profile_id, "기관번호") WHERE ("갈래" = '채용담당자'::text);


--
-- Name: 회원차단_누가_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "회원차단_누가_idx" ON public."회원차단" USING btree ("누가") WHERE "켬";


--
-- Name: admins admins_keep_one; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER admins_keep_one BEFORE DELETE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.keep_one_admin();


--
-- Name: comments comment_count_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER comment_count_trg AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.bump_comment_count();


--
-- Name: comments comment_depth_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER comment_depth_trg BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.comment_depth_guard();


--
-- Name: comments comments_운영진글; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "comments_운영진글" AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public."운영진글남기기"('댓글');


--
-- Name: job_posts job_posts_first_seen_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_posts_first_seen_trg BEFORE INSERT OR UPDATE ON public.job_posts FOR EACH ROW EXECUTE FUNCTION public.job_posts_first_seen_keep();


--
-- Name: job_posts job_posts_one_state; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_posts_one_state BEFORE INSERT OR UPDATE ON public.job_posts FOR EACH ROW EXECUTE FUNCTION public.job_posts_one_state_trg();


--
-- Name: job_posts job_state_log_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER job_state_log_trigger AFTER UPDATE ON public.job_posts FOR EACH ROW EXECUTE FUNCTION public.job_state_log_trg();


--
-- Name: post_likes like_count_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER like_count_trg AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();


--
-- Name: posts posts_운영진글; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "posts_운영진글" AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public."운영진글남기기"('글');


--
-- Name: profiles profiles_nickname_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER profiles_nickname_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.bump_nickname_change();


--
-- Name: profiles profiles_잡힌닉네임막기; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "profiles_잡힌닉네임막기" BEFORE INSERT OR UPDATE OF nickname ON public.profiles FOR EACH ROW EXECUTE FUNCTION public."잡힌닉네임막기"();


--
-- Name: reports report_count_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER report_count_trg AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.bump_report_count();


--
-- Name: spec_langs spec_langs_cap; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER spec_langs_cap AFTER INSERT ON public.spec_langs FOR EACH ROW EXECUTE FUNCTION public.spec_langs_cap();


--
-- Name: job_posts 제목채우기_고칠때; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "제목채우기_고칠때" BEFORE UPDATE OF title, org_name, job_group, employ_type, sido, sgg, work_place, detail ON public.job_posts FOR EACH ROW WHEN (((old.title IS DISTINCT FROM new.title) OR (old.org_name IS DISTINCT FROM new.org_name) OR (old.job_group IS DISTINCT FROM new.job_group) OR (old.employ_type IS DISTINCT FROM new.employ_type) OR (old.sido IS DISTINCT FROM new.sido) OR (old.sgg IS DISTINCT FROM new.sgg) OR (old.work_place IS DISTINCT FROM new.work_place) OR ((old.detail ->> '부서'::text) IS DISTINCT FROM (new.detail ->> '부서'::text)))) EXECUTE FUNCTION public."제목채우기"();


--
-- Name: job_posts 제목채우기_넣을때; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "제목채우기_넣을때" BEFORE INSERT ON public.job_posts FOR EACH ROW EXECUTE FUNCTION public."제목채우기"();


--
-- Name: job_posts 칸기록_after; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "칸기록_after" AFTER UPDATE ON public.job_posts FOR EACH ROW EXECUTE FUNCTION public."칸기록남기기"();


--
-- Name: admins admins_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: hira_detail hira_detail_ykiho_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hira_detail
    ADD CONSTRAINT hira_detail_ykiho_fkey FOREIGN KEY (ykiho) REFERENCES public.hira_org(ykiho) ON DELETE CASCADE;


--
-- Name: home_blocks home_blocks_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.home_blocks
    ADD CONSTRAINT home_blocks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: home_texts home_texts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.home_texts
    ADD CONSTRAINT home_texts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: job_attachments job_attachments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_attachments
    ADD CONSTRAINT job_attachments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: job_events job_events_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_events
    ADD CONSTRAINT job_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: job_events job_events_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_events
    ADD CONSTRAINT job_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: job_hides job_hides_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_hides
    ADD CONSTRAINT job_hides_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: job_post_edits job_post_edits_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_post_edits
    ADD CONSTRAINT job_post_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: job_post_edits job_post_edits_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_post_edits
    ADD CONSTRAINT job_post_edits_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: job_posts job_posts_같은공고_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_posts
    ADD CONSTRAINT "job_posts_같은공고_fkey" FOREIGN KEY ("같은공고") REFERENCES public.job_posts(id) ON DELETE SET NULL;


--
-- Name: job_stars job_stars_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_stars
    ADD CONSTRAINT job_stars_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: job_stars job_stars_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_stars
    ADD CONSTRAINT job_stars_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: job_tab_cards job_tab_cards_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_tab_cards
    ADD CONSTRAINT job_tab_cards_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: notification_settings notification_settings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: org_stars org_stars_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_stars
    ADD CONSTRAINT org_stars_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: post_images post_images_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_hidden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_devices push_devices_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reports reports_handled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: rival_match rival_match_경쟁사_글번호_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rival_match
    ADD CONSTRAINT "rival_match_경쟁사_글번호_fkey" FOREIGN KEY ("경쟁사", "글번호") REFERENCES public.rival_post("경쟁사", "글번호") ON DELETE CASCADE;


--
-- Name: salary_records salary_records_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_records
    ADD CONSTRAINT salary_records_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: site_settings site_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: spec_langs spec_langs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spec_langs
    ADD CONSTRAINT spec_langs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: student_specs student_specs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_specs
    ADD CONSTRAINT student_specs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: 공고신고 공고신고_handled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고신고"
    ADD CONSTRAINT "공고신고_handled_by_fkey" FOREIGN KEY (handled_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: 공고신고 공고신고_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고신고"
    ADD CONSTRAINT "공고신고_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: 공고신고 공고신고_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고신고"
    ADD CONSTRAINT "공고신고_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: 공고올림 공고올림_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고올림"
    ADD CONSTRAINT "공고올림_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: 공고첨부 공고첨부_공고id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고첨부"
    ADD CONSTRAINT "공고첨부_공고id_fkey" FOREIGN KEY ("공고id") REFERENCES public.job_posts(id);


--
-- Name: 공고첨부 공고첨부_회차id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."공고첨부"
    ADD CONSTRAINT "공고첨부_회차id_fkey" FOREIGN KEY ("회차id") REFERENCES public."교육회차"("회차id");


--
-- Name: 교육과정 교육과정_교육기관_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육과정"
    ADD CONSTRAINT "교육과정_교육기관_fkey" FOREIGN KEY ("교육기관") REFERENCES public."교육기관"("이름") ON UPDATE CASCADE;


--
-- Name: 교육기관알림 교육기관알림_기관_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육기관알림"
    ADD CONSTRAINT "교육기관알림_기관_fkey" FOREIGN KEY ("기관") REFERENCES public."교육기관"("이름") ON DELETE CASCADE;


--
-- Name: 교육기관알림 교육기관알림_회원_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육기관알림"
    ADD CONSTRAINT "교육기관알림_회원_fkey" FOREIGN KEY ("회원") REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: 교육리뷰 교육리뷰_회차id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰"
    ADD CONSTRAINT "교육리뷰_회차id_fkey" FOREIGN KEY ("회차id") REFERENCES public."교육회차"("회차id") ON DELETE CASCADE;


--
-- Name: 교육리뷰답글 교육리뷰답글_리뷰id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육리뷰답글"
    ADD CONSTRAINT "교육리뷰답글_리뷰id_fkey" FOREIGN KEY ("리뷰id") REFERENCES public."교육리뷰"("리뷰id") ON DELETE CASCADE;


--
-- Name: 교육신청 교육신청_회차id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육신청"
    ADD CONSTRAINT "교육신청_회차id_fkey" FOREIGN KEY ("회차id") REFERENCES public."교육회차"("회차id") ON DELETE CASCADE;


--
-- Name: 교육회차 교육회차_과정id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."교육회차"
    ADD CONSTRAINT "교육회차_과정id_fkey" FOREIGN KEY ("과정id") REFERENCES public."교육과정"("과정id") ON DELETE CASCADE;


--
-- Name: 알림기기 알림기기_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림기기"
    ADD CONSTRAINT "알림기기_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: 알림보낸것 알림보낸것_기기id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."알림보낸것"
    ADD CONSTRAINT "알림보낸것_기기id_fkey" FOREIGN KEY ("기기id") REFERENCES public."알림기기"(id) ON DELETE CASCADE;


--
-- Name: 애플연결 애플연결_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."애플연결"
    ADD CONSTRAINT "애플연결_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: 약관동의 약관동의_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."약관동의"
    ADD CONSTRAINT "약관동의_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: 인증자료 인증자료_자격id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."인증자료"
    ADD CONSTRAINT "인증자료_자격id_fkey" FOREIGN KEY ("자격id") REFERENCES public."회원자격"(id) ON UPDATE CASCADE;


--
-- Name: 인증자료열람 인증자료열람_자료id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."인증자료열람"
    ADD CONSTRAINT "인증자료열람_자료id_fkey" FOREIGN KEY ("자료id") REFERENCES public."인증자료"(id);


--
-- Name: 칸기록 칸기록_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."칸기록"
    ADD CONSTRAINT "칸기록_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job_posts(id) ON DELETE CASCADE;


--
-- Name: 회원자격 회원자격_교육기관; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원자격"
    ADD CONSTRAINT "회원자격_교육기관" FOREIGN KEY ("교육기관") REFERENCES public."교육기관"("이름") ON UPDATE CASCADE;


--
-- Name: 회원자격 회원자격_기관; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원자격"
    ADD CONSTRAINT "회원자격_기관" FOREIGN KEY ("기관번호") REFERENCES public."기관"("기관번호");


--
-- Name: 회원차단 회원차단_누가_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원차단"
    ADD CONSTRAINT "회원차단_누가_fkey" FOREIGN KEY ("누가") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: 회원차단 회원차단_누구_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."회원차단"
    ADD CONSTRAINT "회원차단_누구_fkey" FOREIGN KEY ("누구") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admins; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_compete; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_compete ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_compete_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_compete_state ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_compete_web; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_compete_web ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_compete_web_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_compete_web_state ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_group_sum; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_group_sum ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_hiretype_fix; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_hiretype_fix ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_post_file; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_post_file ENABLE ROW LEVEL SECURITY;

--
-- Name: alio_post_meta; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alio_post_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: api_quota; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.api_quota ENABLE ROW LEVEL SECURITY;

--
-- Name: api_roster; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.api_roster ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_rooms; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: collect_secret_all; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collect_secret_all ENABLE ROW LEVEL SECURITY;

--
-- Name: collect_source; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collect_source ENABLE ROW LEVEL SECURITY;

--
-- Name: collect_source collect_source_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY collect_source_read ON public.collect_source FOR SELECT USING (true);


--
-- Name: collectable_orgs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collectable_orgs ENABLE ROW LEVEL SECURITY;

--
-- Name: collector_beat; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collector_beat ENABLE ROW LEVEL SECURITY;

--
-- Name: collector_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collector_state ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: dementia_centers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dementia_centers ENABLE ROW LEVEL SECURITY;

--
-- Name: dementia_safe_centers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dementia_safe_centers ENABLE ROW LEVEL SECURITY;

--
-- Name: dev_rehab_orgs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dev_rehab_orgs ENABLE ROW LEVEL SECURITY;

--
-- Name: drop_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.drop_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: erased_accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.erased_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: hand_check; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hand_check ENABLE ROW LEVEL SECURITY;

--
-- Name: hira_cl_cd; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hira_cl_cd ENABLE ROW LEVEL SECURITY;

--
-- Name: hira_detail; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hira_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: hira_org; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hira_org ENABLE ROW LEVEL SECURITY;

--
-- Name: hira_quota; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hira_quota ENABLE ROW LEVEL SECURITY;

--
-- Name: home_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.home_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: home_texts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.home_texts ENABLE ROW LEVEL SECURITY;

--
-- Name: hosp_sites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hosp_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: hospitals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

--
-- Name: job_attachments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: job_body; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_body ENABLE ROW LEVEL SECURITY;

--
-- Name: job_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

--
-- Name: job_hides; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_hides ENABLE ROW LEVEL SECURITY;

--
-- Name: job_post_edits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_post_edits ENABLE ROW LEVEL SECURITY;

--
-- Name: job_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: job_stars; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_stars ENABLE ROW LEVEL SECURITY;

--
-- Name: job_state_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_state_log ENABLE ROW LEVEL SECURITY;

--
-- Name: job_sync_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: job_tab_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_tab_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: job_trash; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_trash ENABLE ROW LEVEL SECURITY;

--
-- Name: job_trash job_trash_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY job_trash_admin ON public.job_trash TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: ltc_facilities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ltc_facilities ENABLE ROW LEVEL SECURITY;

--
-- Name: mental_centers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mental_centers ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: ocr_zero; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ocr_zero ENABLE ROW LEVEL SECURITY;

--
-- Name: org_alias; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.org_alias ENABLE ROW LEVEL SECURITY;

--
-- Name: org_match_before; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.org_match_before ENABLE ROW LEVEL SECURITY;

--
-- Name: org_note; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.org_note ENABLE ROW LEVEL SECURITY;

--
-- Name: org_stars; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.org_stars ENABLE ROW LEVEL SECURITY;

--
-- Name: page_hits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.page_hits ENABLE ROW LEVEL SECURITY;

--
-- Name: post_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: pub_baseline; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pub_baseline ENABLE ROW LEVEL SECURITY;

--
-- Name: public_hospitals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.public_hospitals ENABLE ROW LEVEL SECURITY;

--
-- Name: push_devices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: rejudge_hidden; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rejudge_hidden ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: rival_match; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rival_match ENABLE ROW LEVEL SECURITY;

--
-- Name: rival_org_todo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rival_org_todo ENABLE ROW LEVEL SECURITY;

--
-- Name: rival_post; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rival_post ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

--
-- Name: seen_postings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.seen_postings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_checks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: site_checks site_checks_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY site_checks_admin ON public.site_checks FOR SELECT USING (public.is_admin());


--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;

--
-- Name: site_state site_state_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY site_state_admin ON public.site_state FOR SELECT USING (public.is_admin());


--
-- Name: spec_langs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.spec_langs ENABLE ROW LEVEL SECURITY;

--
-- Name: student_specs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.student_specs ENABLE ROW LEVEL SECURITY;

--
-- Name: ui_icons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ui_icons ENABLE ROW LEVEL SECURITY;

--
-- Name: welfare_centers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.welfare_centers ENABLE ROW LEVEL SECURITY;

--
-- Name: welfare_facilities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.welfare_facilities ENABLE ROW LEVEL SECURITY;

--
-- Name: wn_verdicts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wn_verdicts ENABLE ROW LEVEL SECURITY;

--
-- Name: 개인정보접속기록; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."개인정보접속기록" ENABLE ROW LEVEL SECURITY;

--
-- Name: hosp_sites 게시판 명단은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "게시판 명단은 관리자만" ON public.hosp_sites FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: job_posts 공고 삭제는 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "공고 삭제는 관리자만" ON public.job_posts FOR DELETE USING (public.is_admin());


--
-- Name: job_posts 공고 수정은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "공고 수정은 관리자만" ON public.job_posts FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: job_posts 공고는 누구나 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "공고는 누구나 읽습니다" ON public.job_posts FOR SELECT USING ((((NOT hidden) AND (NOT hold)) OR public.is_admin()));


--
-- Name: 공고신고; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."공고신고" ENABLE ROW LEVEL SECURITY;

--
-- Name: 공고올림; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."공고올림" ENABLE ROW LEVEL SECURITY;

--
-- Name: 공고첨부; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."공고첨부" ENABLE ROW LEVEL SECURITY;

--
-- Name: 공휴일; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."공휴일" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육과정 과정은 누구나 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "과정은 누구나 봅니다" ON public."교육과정" FOR SELECT USING (((NOT "숨김") OR public.is_admin()));


--
-- Name: admins 관리자 목록은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "관리자 목록은 관리자만" ON public.admins FOR SELECT USING (public.is_admin());


--
-- Name: profiles 관리자는 다 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "관리자는 다 읽습니다" ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: admins 관리자만 관리자를 내립니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "관리자만 관리자를 내립니다" ON public.admins FOR DELETE USING ((public.is_admin() AND (profile_id <> auth.uid())));


--
-- Name: admins 관리자만 관리자를 올립니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "관리자만 관리자를 올립니다" ON public.admins FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: erased_accounts 관리자만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "관리자만 봅니다" ON public.erased_accounts FOR SELECT USING (public.is_admin());


--
-- Name: 광고배너; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."광고배너" ENABLE ROW LEVEL SECURITY;

--
-- Name: 광고셈; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."광고셈" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육과정; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육과정" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육기관; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육기관" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육기관알림; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육기관알림" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육리뷰; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육리뷰" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육리뷰답글; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육리뷰답글" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육신청; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육신청" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육회차; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."교육회차" ENABLE ROW LEVEL SECURITY;

--
-- Name: 권한; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."권한" ENABLE ROW LEVEL SECURITY;

--
-- Name: 권한기록; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."권한기록" ENABLE ROW LEVEL SECURITY;

--
-- Name: 권한기록 권한기록은 운영진만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "권한기록은 운영진만 봅니다" ON public."권한기록" FOR SELECT USING (public.is_admin());


--
-- Name: 권한 권한은 운영진만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "권한은 운영진만 봅니다" ON public."권한" FOR SELECT USING (public.is_admin());


--
-- Name: profiles 글쓴이 프로필은 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "글쓴이 프로필은 읽습니다" ON public.profiles FOR SELECT USING (public."글쓴적있나"(id));


--
-- Name: posts 글은 다 보입니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "글은 다 보입니다" ON public.posts FOR SELECT USING (((NOT hidden) OR public.is_admin()));


--
-- Name: 기관; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."기관" ENABLE ROW LEVEL SECURITY;

--
-- Name: 기관 기관 관리자읽기; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "기관 관리자읽기" ON public."기관" FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: 기관이름줄임; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."기관이름줄임" ENABLE ROW LEVEL SECURITY;

--
-- Name: 기관주소; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."기관주소" ENABLE ROW LEVEL SECURITY;

--
-- Name: 기관지역; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."기관지역" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_images 내 글 사진만 올립니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 글 사진만 올립니다" ON public.post_images FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_images.post_id) AND (p.author_id = auth.uid())))));


--
-- Name: post_images 내 글 사진만 지웁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 글 사진만 지웁니다" ON public.post_images FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_images.post_id) AND (p.author_id = auth.uid())))) OR public.is_admin()));


--
-- Name: posts 내 글만 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 글만 고칩니다" ON public.posts FOR UPDATE USING ((author_id = auth.uid())) WITH CHECK ((author_id = auth.uid()));


--
-- Name: salary_records 내 급여만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 급여만" ON public.salary_records USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: push_devices 내 기기만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 기기만" ON public.push_devices USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: comments 내 댓글만 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 댓글만 고칩니다" ON public.comments FOR UPDATE USING ((author_id = auth.uid())) WITH CHECK ((author_id = auth.uid()));


--
-- Name: comments 내 댓글만 지웁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 댓글만 지웁니다" ON public.comments FOR DELETE USING (((author_id = auth.uid()) OR public.is_admin()));


--
-- Name: 약관동의 내 동의만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 동의만 봅니다" ON public."약관동의" FOR SELECT USING (((profile_id = auth.uid()) OR public.is_admin()));


--
-- Name: chat_messages 내 메시지만 지웁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 메시지만 지웁니다" ON public.chat_messages FOR DELETE USING ((sender_id = auth.uid()));


--
-- Name: chat_messages 내 방 메시지만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 방 메시지만" ON public.chat_messages FOR SELECT USING (public.in_room(room_id));


--
-- Name: chat_members 내 방 사람만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 방 사람만" ON public.chat_members FOR SELECT USING (public.in_room(room_id));


--
-- Name: chat_rooms 내 방만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 방만 봅니다" ON public.chat_rooms FOR SELECT USING (public.in_room(id));


--
-- Name: chat_messages 내 방에만 보냅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 방에만 보냅니다" ON public.chat_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND public.in_room(room_id)));


--
-- Name: student_specs 내 스펙만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 스펙만" ON public.student_specs USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: reports 내 신고만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 신고만 봅니다" ON public.reports FOR SELECT USING (((reporter_id = auth.uid()) OR public.is_admin()));


--
-- Name: 교육신청 내 신청만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 신청만 봅니다" ON public."교육신청" FOR SELECT USING (((profile_id = auth.uid()) OR public.is_admin()));


--
-- Name: 알림함 내 알림만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 알림만 봅니다" ON public."알림함" FOR SELECT USING ((profile_id = auth.uid()));


--
-- Name: notification_settings 내 알림설정만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 알림설정만" ON public.notification_settings USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: spec_langs 내 어학만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 어학만" ON public.spec_langs TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: reports 내 이름으로 신고; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 이름으로 신고" ON public.reports FOR INSERT WITH CHECK ((reporter_id = auth.uid()));


--
-- Name: 재직인증 내 인증만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 인증만 봅니다" ON public."재직인증" FOR SELECT USING (((profile_id = auth.uid()) OR public."권한있나"('회원관리'::text)));


--
-- Name: chat_members 내 읽음만 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 읽음만 고칩니다" ON public.chat_members FOR UPDATE USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: 회원자격 내 자격은 내가 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 자격은 내가 봅니다" ON public."회원자격" FOR SELECT USING (((profile_id = auth.uid()) OR public.is_admin()));


--
-- Name: 인증자료 내 자료는 내가 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 자료는 내가 봅니다" ON public."인증자료" FOR SELECT USING (((profile_id = auth.uid()) OR public."권한있나"('기관승인'::text)));


--
-- Name: org_stars 내 저장만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 저장만" ON public.org_stars USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: post_likes 내 좋아요만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 좋아요만" ON public.post_likes FOR INSERT WITH CHECK ((profile_id = auth.uid()));


--
-- Name: post_likes 내 좋아요만 뗍니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 좋아요만 뗍니다" ON public.post_likes FOR DELETE USING ((profile_id = auth.uid()));


--
-- Name: job_stars 내 찜만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 찜만" ON public.job_stars USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: profiles 내 프로필만 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 프로필만 고칩니다" ON public.profiles FOR UPDATE USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profiles 내 프로필만 만듭니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 프로필만 만듭니다" ON public.profiles FOR INSERT WITH CHECK ((id = auth.uid()));


--
-- Name: profiles 내 프로필만 지웁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 프로필만 지웁니다" ON public.profiles FOR DELETE USING ((id = auth.uid()));


--
-- Name: profiles 내 프로필은 내가 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내 프로필은 내가 읽습니다" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: 대화차단 내가 막은 것만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내가 막은 것만 봅니다" ON public."대화차단" FOR SELECT USING ((("막은사람" = auth.uid()) OR public."권한있나"('대화열람'::text)));


--
-- Name: job_hides 내린 목록은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "내린 목록은 관리자만" ON public.job_hides FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: dementia_safe_centers 누구나; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "누구나" ON public.dementia_safe_centers FOR SELECT USING (true);


--
-- Name: dev_rehab_orgs 누구나; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "누구나" ON public.dev_rehab_orgs FOR SELECT USING (true);


--
-- Name: welfare_centers 누구나; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "누구나" ON public.welfare_centers FOR SELECT USING (true);


--
-- Name: job_sync_log 다리 기록은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "다리 기록은 관리자만" ON public.job_sync_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: 교육리뷰답글 답글은 누구나 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "답글은 누구나 봅니다" ON public."교육리뷰답글" FOR SELECT USING (true);


--
-- Name: 대화차단; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."대화차단" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments 댓글은 다 보입니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "댓글은 다 보입니다" ON public.comments FOR SELECT USING ((NOT hidden));


--
-- Name: comments 로그인하면 답니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "로그인하면 답니다" ON public.comments FOR INSERT WITH CHECK ((author_id = auth.uid()));


--
-- Name: posts 로그인하면 씁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "로그인하면 씁니다" ON public.posts FOR INSERT WITH CHECK ((author_id = auth.uid()));


--
-- Name: 교육리뷰 리뷰는 누구나 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "리뷰는 누구나 봅니다" ON public."교육리뷰" FOR SELECT USING (((NOT "숨김") OR public.is_admin()));


--
-- Name: 마스터페르소나 마스터 줄은 본인과 운영진만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "마스터 줄은 본인과 운영진만" ON public."마스터페르소나" FOR SELECT USING (((auth_id = auth.uid()) OR public.is_admin()));


--
-- Name: 마스터페르소나; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."마스터페르소나" ENABLE ROW LEVEL SECURITY;

--
-- Name: 묶지않음; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."묶지않음" ENABLE ROW LEVEL SECURITY;

--
-- Name: home_texts 문구는 관리자가 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "문구는 관리자가 고칩니다" ON public.home_texts FOR UPDATE USING (public.is_admin());


--
-- Name: home_texts 문구는 누구나 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "문구는 누구나 읽습니다" ON public.home_texts FOR SELECT USING (true);


--
-- Name: job_events 반응은 누구나 넣습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "반응은 누구나 넣습니다" ON public.job_events FOR INSERT WITH CHECK (((profile_id IS NULL) OR (profile_id = auth.uid())));


--
-- Name: drop_rules 버림규칙은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "버림규칙은 관리자만" ON public.drop_rules FOR SELECT USING (public.is_admin());


--
-- Name: 봉사모집; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."봉사모집" ENABLE ROW LEVEL SECURITY;

--
-- Name: 봉사처; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."봉사처" ENABLE ROW LEVEL SECURITY;

--
-- Name: post_images 사진은 보이는 글만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "사진은 보이는 글만" ON public.post_images FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_images.post_id) AND ((NOT p.hidden) OR public.is_admin())))));


--
-- Name: site_settings 설정은 관리자만 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "설정은 관리자만 고칩니다" ON public.site_settings USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: site_settings 설정은 누구나 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "설정은 누구나 읽습니다" ON public.site_settings FOR SELECT USING (true);


--
-- Name: job_post_edits 수정 이력은 관리자가 남깁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "수정 이력은 관리자가 남깁니다" ON public.job_post_edits FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: job_post_edits 수정 이력은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "수정 이력은 관리자만" ON public.job_post_edits FOR SELECT USING (public.is_admin());


--
-- Name: 수집기짝; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."수집기짝" ENABLE ROW LEVEL SECURITY;

--
-- Name: 수집판정; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."수집판정" ENABLE ROW LEVEL SECURITY;

--
-- Name: 시군광역; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."시군광역" ENABLE ROW LEVEL SECURITY;

--
-- Name: 시군구시도; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."시군구시도" ENABLE ROW LEVEL SECURITY;

--
-- Name: 심평원인원월별; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."심평원인원월별" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments 쓸 수 있는 방에만 댓글을 씁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "쓸 수 있는 방에만 댓글을 씁니다" ON public.comments AS RESTRICTIVE FOR INSERT WITH CHECK (public."방에쓸수있나"(( SELECT x.channel
   FROM public.posts x
  WHERE (x.id = comments.post_id))));


--
-- Name: posts 쓸 수 있는 방에만 씁니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "쓸 수 있는 방에만 씁니다" ON public.posts AS RESTRICTIVE FOR INSERT WITH CHECK (public."방에쓸수있나"(channel));


--
-- Name: ui_icons 아이콘 고치기는 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "아이콘 고치기는 관리자만" ON public.ui_icons FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: ui_icons 아이콘 넣기는 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "아이콘 넣기는 관리자만" ON public.ui_icons FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: ui_icons 아이콘 지우기는 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "아이콘 지우기는 관리자만" ON public.ui_icons FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: ui_icons 아이콘은 누구나 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "아이콘은 누구나 읽습니다" ON public.ui_icons FOR SELECT TO authenticated, anon USING (true);


--
-- Name: 알리오자리같음; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."알리오자리같음" ENABLE ROW LEVEL SECURITY;

--
-- Name: 알리오직군고침; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."알리오직군고침" ENABLE ROW LEVEL SECURITY;

--
-- Name: 알림기기; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."알림기기" ENABLE ROW LEVEL SECURITY;

--
-- Name: 알림보낸것; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."알림보낸것" ENABLE ROW LEVEL SECURITY;

--
-- Name: 알림함; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."알림함" ENABLE ROW LEVEL SECURITY;

--
-- Name: 애플연결; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."애플연결" ENABLE ROW LEVEL SECURITY;

--
-- Name: 약관동의; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."약관동의" ENABLE ROW LEVEL SECURITY;

--
-- Name: 인증자료열람 열람 기록은 권한자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "열람 기록은 권한자만" ON public."인증자료열람" FOR SELECT USING (public."권한있나"('기관승인'::text));


--
-- Name: 운영진글; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."운영진글" ENABLE ROW LEVEL SECURITY;

--
-- Name: 인증자료; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."인증자료" ENABLE ROW LEVEL SECURITY;

--
-- Name: 인증자료열람; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."인증자료열람" ENABLE ROW LEVEL SECURITY;

--
-- Name: 재직인증; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."재직인증" ENABLE ROW LEVEL SECURITY;

--
-- Name: page_hits 조회 기록은 누구나 넣습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "조회 기록은 누구나 넣습니다" ON public.page_hits FOR INSERT WITH CHECK (true);


--
-- Name: post_likes 좋아요는 다 보입니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "좋아요는 다 보입니다" ON public.post_likes FOR SELECT USING (true);


--
-- Name: posts 줄을 지우는 것은 관리자뿐; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "줄을 지우는 것은 관리자뿐" ON public.posts FOR DELETE USING (public.is_admin());


--
-- Name: job_attachments 첨부는 보이는 공고만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "첨부는 보이는 공고만" ON public.job_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.job_posts j
  WHERE ((j.id = job_attachments.job_id) AND (NOT j.hidden) AND (NOT j.hold)))));


--
-- Name: 청년정책; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."청년정책" ENABLE ROW LEVEL SECURITY;

--
-- Name: job_tab_cards 카드는 관리자가 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "카드는 관리자가 고칩니다" ON public.job_tab_cards FOR UPDATE USING (public.is_admin());


--
-- Name: job_tab_cards 카드는 누구나 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "카드는 누구나 읽습니다" ON public.job_tab_cards FOR SELECT USING (true);


--
-- Name: 칸기록; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."칸기록" ENABLE ROW LEVEL SECURITY;

--
-- Name: wn_verdicts 판정은 관리자만; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "판정은 관리자만" ON public.wn_verdicts FOR SELECT USING (public.is_admin());


--
-- Name: comments 학생 방 댓글은 학생만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "학생 방 댓글은 학생만 봅니다" ON public.comments AS RESTRICTIVE FOR SELECT USING ((public."방볼수있나"(( SELECT x.channel
   FROM public.posts x
  WHERE (x.id = comments.post_id))) OR public.is_admin()));


--
-- Name: posts 학생 방은 학생만 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "학생 방은 학생만 봅니다" ON public.posts AS RESTRICTIVE FOR SELECT USING ((public."방볼수있나"(channel) OR public.is_admin()));


--
-- Name: 함수사본; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."함수사본" ENABLE ROW LEVEL SECURITY;

--
-- Name: home_blocks 홈 블록은 관리자만 고칩니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "홈 블록은 관리자만 고칩니다" ON public.home_blocks USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: home_blocks 홈 블록은 누구나 읽습니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "홈 블록은 누구나 읽습니다" ON public.home_blocks FOR SELECT USING (true);


--
-- Name: 회원자격; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."회원자격" ENABLE ROW LEVEL SECURITY;

--
-- Name: 회원차단; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."회원차단" ENABLE ROW LEVEL SECURITY;

--
-- Name: 교육회차 회차는 누구나 봅니다; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "회차는 누구나 봅니다" ON public."교육회차" FOR SELECT USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;


--
-- Name: FUNCTION admin_alio_compete(p_year integer, p_inst text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_alio_compete(p_year integer, p_inst text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_alio_compete(p_year integer, p_inst text) TO service_role;
GRANT ALL ON FUNCTION public.admin_alio_compete(p_year integer, p_inst text) TO authenticated;


--
-- Name: FUNCTION admin_alio_group_one("p_묶음키" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_alio_group_one("p_묶음키" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_alio_group_one("p_묶음키" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_alio_group_one("p_묶음키" text) TO authenticated;


--
-- Name: FUNCTION admin_alio_groups("p_기관" text, "p_직군" text, "p_지역" text, "p_연도" integer, "p_찾기" text, "p_고용형태" text, "p_다른직군" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_alio_groups("p_기관" text, "p_직군" text, "p_지역" text, "p_연도" integer, "p_찾기" text, "p_고용형태" text, "p_다른직군" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_alio_groups("p_기관" text, "p_직군" text, "p_지역" text, "p_연도" integer, "p_찾기" text, "p_고용형태" text, "p_다른직군" boolean) TO service_role;
GRANT ALL ON FUNCTION public.admin_alio_groups("p_기관" text, "p_직군" text, "p_지역" text, "p_연도" integer, "p_찾기" text, "p_고용형태" text, "p_다른직군" boolean) TO authenticated;


--
-- Name: FUNCTION admin_alio_merge_candidates("p_직군" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_alio_merge_candidates("p_직군" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_alio_merge_candidates("p_직군" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_alio_merge_candidates("p_직군" text) TO authenticated;


--
-- Name: FUNCTION admin_alio_set_hiretype(p_sn bigint, p_group_no integer, "p_고용형태" text, "p_메모" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_alio_set_hiretype(p_sn bigint, p_group_no integer, "p_고용형태" text, "p_메모" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_alio_set_hiretype(p_sn bigint, p_group_no integer, "p_고용형태" text, "p_메모" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_alio_set_hiretype(p_sn bigint, p_group_no integer, "p_고용형태" text, "p_메모" text) TO authenticated;


--
-- Name: FUNCTION admin_api_quota(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_api_quota() TO service_role;
GRANT ALL ON FUNCTION public.admin_api_quota() TO authenticated;


--
-- Name: FUNCTION admin_decide(p_id text, p_what text, p_job_group text, p_note text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_decide(p_id text, p_what text, p_job_group text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_decide(p_id text, p_what text, p_job_group text, p_note text) TO service_role;
GRANT ALL ON FUNCTION public.admin_decide(p_id text, p_what text, p_job_group text, p_note text) TO authenticated;


--
-- Name: FUNCTION admin_hand_check(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_hand_check() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_hand_check() TO service_role;
GRANT ALL ON FUNCTION public.admin_hand_check() TO authenticated;


--
-- Name: FUNCTION admin_hand_check_seen("p_이름" text, "p_메모" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_hand_check_seen("p_이름" text, "p_메모" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_hand_check_seen("p_이름" text, "p_메모" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_hand_check_seen("p_이름" text, "p_메모" text) TO authenticated;


--
-- Name: FUNCTION admin_new_collect_secret(p_source text, p_note text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_new_collect_secret(p_source text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_new_collect_secret(p_source text, p_note text) TO service_role;
GRANT ALL ON FUNCTION public.admin_new_collect_secret(p_source text, p_note text) TO authenticated;


--
-- Name: FUNCTION admin_ocr_zero(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_ocr_zero() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_ocr_zero() TO service_role;
GRANT ALL ON FUNCTION public.admin_ocr_zero() TO authenticated;


--
-- Name: FUNCTION admin_rival(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_rival() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_rival() TO service_role;
GRANT ALL ON FUNCTION public.admin_rival() TO authenticated;


--
-- Name: FUNCTION admin_rival_add("p_경쟁사" text, "p_기관명" text, "p_제목" text, "p_본날짜" timestamp with time zone, "p_링크" text, "p_기관분류" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_rival_add("p_경쟁사" text, "p_기관명" text, "p_제목" text, "p_본날짜" timestamp with time zone, "p_링크" text, "p_기관분류" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_rival_add("p_경쟁사" text, "p_기관명" text, "p_제목" text, "p_본날짜" timestamp with time zone, "p_링크" text, "p_기관분류" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_rival_add("p_경쟁사" text, "p_기관명" text, "p_제목" text, "p_본날짜" timestamp with time zone, "p_링크" text, "p_기관분류" text) TO authenticated;


--
-- Name: FUNCTION admin_rival_org_todo("p_기관명" text, "p_어디서" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_rival_org_todo("p_기관명" text, "p_어디서" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_rival_org_todo("p_기관명" text, "p_어디서" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_rival_org_todo("p_기관명" text, "p_어디서" text) TO authenticated;


--
-- Name: FUNCTION admin_rival_set("p_경쟁사" text, "p_글번호" text, "p_상태" text, "p_메모" text, "p_원인" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_rival_set("p_경쟁사" text, "p_글번호" text, "p_상태" text, "p_메모" text, "p_원인" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_rival_set("p_경쟁사" text, "p_글번호" text, "p_상태" text, "p_메모" text, "p_원인" text) TO service_role;
GRANT ALL ON FUNCTION public.admin_rival_set("p_경쟁사" text, "p_글번호" text, "p_상태" text, "p_메모" text, "p_원인" text) TO authenticated;


--
-- Name: FUNCTION admin_stats_daily(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_stats_daily(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_daily(p_days integer) TO service_role;
GRANT ALL ON FUNCTION public.admin_stats_daily(p_days integer) TO authenticated;


--
-- Name: FUNCTION admin_stats_devices(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_stats_devices(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_devices(p_days integer) TO service_role;
GRANT ALL ON FUNCTION public.admin_stats_devices(p_days integer) TO authenticated;


--
-- Name: FUNCTION admin_stats_now(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_stats_now() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_now() TO service_role;
GRANT ALL ON FUNCTION public.admin_stats_now() TO authenticated;


--
-- Name: FUNCTION admin_stats_screens(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_stats_screens(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_screens(p_days integer) TO service_role;
GRANT ALL ON FUNCTION public.admin_stats_screens(p_days integer) TO authenticated;


--
-- Name: FUNCTION admin_stats_top_jobs(p_days integer, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_stats_top_jobs(p_days integer, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_top_jobs(p_days integer, p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.admin_stats_top_jobs(p_days integer, p_limit integer) TO authenticated;


--
-- Name: FUNCTION admin_stats_top_posts(p_days integer, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_stats_top_posts(p_days integer, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_top_posts(p_days integer, p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.admin_stats_top_posts(p_days integer, p_limit integer) TO authenticated;


--
-- Name: FUNCTION "admin_공고내리기"(p_job text, "p_왜" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_공고내리기"(p_job text, "p_왜" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_공고내리기"(p_job text, "p_왜" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_공고내리기"(p_job text, "p_왜" text) TO authenticated;


--
-- Name: FUNCTION "admin_공고신고목록"("p_처리전만" boolean, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_공고신고목록"("p_처리전만" boolean, p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_공고신고목록"("p_처리전만" boolean, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_공고신고목록"("p_처리전만" boolean, p_page integer) TO authenticated;


--
-- Name: FUNCTION "admin_공고신고처리"(p_id bigint, p_note text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_공고신고처리"(p_id bigint, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_공고신고처리"(p_id bigint, p_note text) TO service_role;
GRANT ALL ON FUNCTION public."admin_공고신고처리"(p_id bigint, p_note text) TO authenticated;


--
-- Name: FUNCTION "admin_공고올리기"(p_job text, "p_왜" text, "p_순서" integer, "p_부터" date, "p_까지" date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_공고올리기"(p_job text, "p_왜" text, "p_순서" integer, "p_부터" date, "p_까지" date) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_공고올리기"(p_job text, "p_왜" text, "p_순서" integer, "p_부터" date, "p_까지" date) TO service_role;
GRANT ALL ON FUNCTION public."admin_공고올리기"(p_job text, "p_왜" text, "p_순서" integer, "p_부터" date, "p_까지" date) TO authenticated;


--
-- Name: FUNCTION "admin_광고배너"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_광고배너"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_광고배너"() TO service_role;
GRANT ALL ON FUNCTION public."admin_광고배너"() TO authenticated;


--
-- Name: FUNCTION "admin_광고배너고치기"("p_자리" text, "p_이름" text, "p_그림" text, "p_링크" text, "p_표시초" integer, "p_켜짐" boolean, "p_시작일" date, "p_끝일" date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_광고배너고치기"("p_자리" text, "p_이름" text, "p_그림" text, "p_링크" text, "p_표시초" integer, "p_켜짐" boolean, "p_시작일" date, "p_끝일" date) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_광고배너고치기"("p_자리" text, "p_이름" text, "p_그림" text, "p_링크" text, "p_표시초" integer, "p_켜짐" boolean, "p_시작일" date, "p_끝일" date) TO service_role;
GRANT ALL ON FUNCTION public."admin_광고배너고치기"("p_자리" text, "p_이름" text, "p_그림" text, "p_링크" text, "p_표시초" integer, "p_켜짐" boolean, "p_시작일" date, "p_끝일" date) TO authenticated;


--
-- Name: FUNCTION "admin_교육기관"(p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_교육기관"(p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_교육기관"(p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_교육기관"(p_page integer) TO authenticated;


--
-- Name: FUNCTION "admin_교육기관고치기"("p_이름" text, "p_소개" text, "p_그림" text, "p_누리집" text, "p_차례" integer, "p_보임" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_교육기관고치기"("p_이름" text, "p_소개" text, "p_그림" text, "p_누리집" text, "p_차례" integer, "p_보임" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_교육기관고치기"("p_이름" text, "p_소개" text, "p_그림" text, "p_누리집" text, "p_차례" integer, "p_보임" boolean) TO service_role;
GRANT ALL ON FUNCTION public."admin_교육기관고치기"("p_이름" text, "p_소개" text, "p_그림" text, "p_누리집" text, "p_차례" integer, "p_보임" boolean) TO authenticated;


--
-- Name: FUNCTION "admin_권한거두기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_권한거두기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_권한거두기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_권한거두기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) TO authenticated;


--
-- Name: FUNCTION "admin_권한기록"("p_몇줄" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_권한기록"("p_몇줄" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_권한기록"("p_몇줄" integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_권한기록"("p_몇줄" integer) TO authenticated;


--
-- Name: FUNCTION "admin_권한주기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_권한주기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_권한주기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_권한주기"("p_회원번호" bigint, "p_코드" text, "p_까닭" text) TO authenticated;


--
-- Name: FUNCTION "admin_담당자신청"("p_상태" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_담당자신청"("p_상태" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_담당자신청"("p_상태" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_담당자신청"("p_상태" text) TO authenticated;


--
-- Name: FUNCTION "admin_담당자정하기"("p_자격id" bigint, "p_상태" text, "p_까닭" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_담당자정하기"("p_자격id" bigint, "p_상태" text, "p_까닭" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_담당자정하기"("p_자격id" bigint, "p_상태" text, "p_까닭" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_담당자정하기"("p_자격id" bigint, "p_상태" text, "p_까닭" text) TO authenticated;


--
-- Name: FUNCTION "admin_동의기록"(p_profile_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_동의기록"(p_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_동의기록"(p_profile_id uuid) TO service_role;
GRANT ALL ON FUNCTION public."admin_동의기록"(p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION "admin_마지막알림"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_마지막알림"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_마지막알림"() TO service_role;
GRANT ALL ON FUNCTION public."admin_마지막알림"() TO authenticated;


--
-- Name: FUNCTION "admin_신고목록"("p_처리전만" boolean, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_신고목록"("p_처리전만" boolean, p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_신고목록"("p_처리전만" boolean, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_신고목록"("p_처리전만" boolean, p_page integer) TO authenticated;


--
-- Name: FUNCTION "admin_신고처리"(p_id bigint, p_note text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_신고처리"(p_id bigint, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_신고처리"(p_id bigint, p_note text) TO service_role;
GRANT ALL ON FUNCTION public."admin_신고처리"(p_id bigint, p_note text) TO authenticated;


--
-- Name: FUNCTION "admin_올린공고목록"("p_지난것" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_올린공고목록"("p_지난것" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_올린공고목록"("p_지난것" boolean) TO service_role;
GRANT ALL ON FUNCTION public."admin_올린공고목록"("p_지난것" boolean) TO authenticated;


--
-- Name: FUNCTION "admin_운영진글감추기"("p_글" bigint[], "p_댓글" bigint[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_운영진글감추기"("p_글" bigint[], "p_댓글" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_운영진글감추기"("p_글" bigint[], "p_댓글" bigint[]) TO service_role;
GRANT ALL ON FUNCTION public."admin_운영진글감추기"("p_글" bigint[], "p_댓글" bigint[]) TO authenticated;


--
-- Name: FUNCTION "admin_운영진글목록"("p_역할" text, "p_몇줄" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_운영진글목록"("p_역할" text, "p_몇줄" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_운영진글목록"("p_역할" text, "p_몇줄" integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_운영진글목록"("p_역할" text, "p_몇줄" integer) TO authenticated;


--
-- Name: FUNCTION "admin_인증자료열기"("p_자료id" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_인증자료열기"("p_자료id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_인증자료열기"("p_자료id" bigint) TO service_role;
GRANT ALL ON FUNCTION public."admin_인증자료열기"("p_자료id" bigint) TO authenticated;


--
-- Name: FUNCTION "admin_재직인증"("p_상태" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_재직인증"("p_상태" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_재직인증"("p_상태" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_재직인증"("p_상태" text) TO authenticated;


--
-- Name: FUNCTION "admin_재직인증열기"(p_id bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_재직인증열기"(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_재직인증열기"(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public."admin_재직인증열기"(p_id bigint) TO authenticated;


--
-- Name: FUNCTION "admin_재직인증정하기"(p_id bigint, "p_상태" text, "p_까닭" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_재직인증정하기"(p_id bigint, "p_상태" text, "p_까닭" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_재직인증정하기"(p_id bigint, "p_상태" text, "p_까닭" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_재직인증정하기"(p_id bigint, "p_상태" text, "p_까닭" text) TO authenticated;


--
-- Name: FUNCTION "admin_접속기록"(p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_접속기록"(p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_접속기록"(p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_접속기록"(p_page integer) TO authenticated;


--
-- Name: FUNCTION "admin_제목확인"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_제목확인"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_제목확인"() TO service_role;
GRANT ALL ON FUNCTION public."admin_제목확인"() TO authenticated;


--
-- Name: FUNCTION "admin_직원넣기"("p_회원번호" bigint, "p_메모" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_직원넣기"("p_회원번호" bigint, "p_메모" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_직원넣기"("p_회원번호" bigint, "p_메모" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_직원넣기"("p_회원번호" bigint, "p_메모" text) TO authenticated;


--
-- Name: FUNCTION "admin_직원목록"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_직원목록"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_직원목록"() TO service_role;
GRANT ALL ON FUNCTION public."admin_직원목록"() TO authenticated;


--
-- Name: FUNCTION "admin_직원빼기"("p_회원번호" bigint, "p_까닭" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_직원빼기"("p_회원번호" bigint, "p_까닭" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_직원빼기"("p_회원번호" bigint, "p_까닭" text) TO service_role;
GRANT ALL ON FUNCTION public."admin_직원빼기"("p_회원번호" bigint, "p_까닭" text) TO authenticated;


--
-- Name: FUNCTION "admin_탈퇴이름"(p_profile_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_탈퇴이름"(p_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_탈퇴이름"(p_profile_id uuid) TO service_role;
GRANT ALL ON FUNCTION public."admin_탈퇴이름"(p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION "admin_회원목록"(p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_회원목록"(p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_회원목록"(p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_회원목록"(p_page integer) TO authenticated;


--
-- Name: FUNCTION "admin_회원정보보기"(p_profile_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_회원정보보기"(p_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_회원정보보기"(p_profile_id uuid) TO service_role;
GRANT ALL ON FUNCTION public."admin_회원정보보기"(p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION "admin_회원표"(p_ids uuid[], p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."admin_회원표"(p_ids uuid[], p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."admin_회원표"(p_ids uuid[], p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."admin_회원표"(p_ids uuid[], p_page integer) TO authenticated;


--
-- Name: FUNCTION alio_compete_fix(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_compete_fix(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_fix(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_fix(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION alio_compete_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.alio_compete_put(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.alio_compete_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: TABLE alio_compete_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_compete_state TO service_role;


--
-- Name: FUNCTION alio_compete_state_get(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.alio_compete_state_get(p_secret text, p_source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.alio_compete_state_get(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_state_get(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_state_get(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_state_put(p_secret text, p_source text, "p_말" text, "p_다음쪽" integer, "p_전체쪽" integer, "p_다한날" date, "p_메모" text) TO authenticated;


--
-- Name: FUNCTION alio_compete_web_all(p_secret text, p_source text, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_compete_web_all(p_secret text, p_source text, p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_web_all(p_secret text, p_source text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_web_all(p_secret text, p_source text, p_limit integer) TO authenticated;


--
-- Name: FUNCTION alio_compete_web_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_compete_web_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_web_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_web_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION alio_compete_web_todo(p_secret text, p_source text, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_compete_web_todo(p_secret text, p_source text, p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.alio_compete_web_todo(p_secret text, p_source text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.alio_compete_web_todo(p_secret text, p_source text, p_limit integer) TO authenticated;


--
-- Name: FUNCTION alio_group_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_group_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_group_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_group_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION alio_group_refresh(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_group_refresh(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.alio_group_refresh(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public.alio_group_refresh(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION alio_group_src(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_group_src(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.alio_group_src(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public.alio_group_src(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION alio_post_file_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_post_file_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_post_file_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_post_file_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION alio_post_file_text_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_post_file_text_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_post_file_text_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_post_file_text_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION alio_post_file_text_todo(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_post_file_text_todo(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.alio_post_file_text_todo(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public.alio_post_file_text_todo(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION alio_post_file_todo(p_secret text, p_source text, "p_모름만" boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_post_file_todo(p_secret text, p_source text, "p_모름만" boolean) TO service_role;
GRANT ALL ON FUNCTION public.alio_post_file_todo(p_secret text, p_source text, "p_모름만" boolean) TO anon;
GRANT ALL ON FUNCTION public.alio_post_file_todo(p_secret text, p_source text, "p_모름만" boolean) TO authenticated;


--
-- Name: FUNCTION alio_post_meta_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_post_meta_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_post_meta_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_post_meta_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION alio_post_meta_todo(p_secret text, p_source text, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_post_meta_todo(p_secret text, p_source text, p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.alio_post_meta_todo(p_secret text, p_source text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.alio_post_meta_todo(p_secret text, p_source text, p_limit integer) TO authenticated;


--
-- Name: FUNCTION alio_web_health(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.alio_web_health() FROM PUBLIC;
GRANT ALL ON FUNCTION public.alio_web_health() TO service_role;
GRANT ALL ON FUNCTION public.alio_web_health() TO authenticated;


--
-- Name: FUNCTION alio_web_peek(p_secret text, p_source text, p_keys jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.alio_web_peek(p_secret text, p_source text, p_keys jsonb) TO service_role;
GRANT ALL ON FUNCTION public.alio_web_peek(p_secret text, p_source text, p_keys jsonb) TO anon;
GRANT ALL ON FUNCTION public.alio_web_peek(p_secret text, p_source text, p_keys jsonb) TO authenticated;


--
-- Name: FUNCTION alive_mark(p_secret text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.alive_mark(p_secret text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.alive_mark(p_secret text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION alive_targets(p_secret text, p_n integer, "p_내린것" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.alive_targets(p_secret text, p_n integer, "p_내린것" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.alive_targets(p_secret text, p_n integer, "p_내린것" boolean) TO service_role;


--
-- Name: FUNCTION api_quota_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.api_quota_put(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.api_quota_put(p_secret text, p_source text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION api_quota_today(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.api_quota_today() FROM PUBLIC;
GRANT ALL ON FUNCTION public.api_quota_today() TO service_role;


--
-- Name: FUNCTION apply_rejudged(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.apply_rejudged() FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_rejudged() TO service_role;


--
-- Name: FUNCTION beat_health(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.beat_health() FROM PUBLIC;
GRANT ALL ON FUNCTION public.beat_health() TO service_role;
GRANT ALL ON FUNCTION public.beat_health() TO authenticated;


--
-- Name: FUNCTION bump_comment_count(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.bump_comment_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_comment_count() TO service_role;


--
-- Name: FUNCTION bump_like_count(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.bump_like_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_like_count() TO service_role;


--
-- Name: FUNCTION bump_nickname_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.bump_nickname_change() TO service_role;


--
-- Name: FUNCTION bump_post_view(p_id bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.bump_post_view(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_post_view(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public.bump_post_view(p_id bigint) TO anon;
GRANT ALL ON FUNCTION public.bump_post_view(p_id bigint) TO authenticated;


--
-- Name: FUNCTION bump_report_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.bump_report_count() TO service_role;


--
-- Name: FUNCTION collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer) TO service_role;
GRANT ALL ON FUNCTION public.collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer) TO anon;
GRANT ALL ON FUNCTION public.collect_after(p_secret text, p_source text, p_days integer, p_rolling_days integer) TO authenticated;


--
-- Name: FUNCTION collect_attach(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_attach(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_attach(p_secret text, p_source text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION collect_beat(p_secret text, p_source text, p_beat jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_beat(p_secret text, p_source text, p_beat jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_beat(p_secret text, p_source text, p_beat jsonb) TO service_role;


--
-- Name: FUNCTION collect_body(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.collect_body(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION collect_gap(p_new text, p_old text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_gap(p_new text, p_old text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_gap(p_new text, p_old text) TO service_role;


--
-- Name: FUNCTION collect_gap_get(p_secret text, p_source text, p_new text, p_old text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.collect_gap_get(p_secret text, p_source text, p_new text, p_old text) TO service_role;
GRANT ALL ON FUNCTION public.collect_gap_get(p_secret text, p_source text, p_new text, p_old text) TO anon;


--
-- Name: FUNCTION collect_peek(p_secret text, p_source text, p_of text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_peek(p_secret text, p_source text, p_of text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_peek(p_secret text, p_source text, p_of text) TO service_role;
GRANT ALL ON FUNCTION public.collect_peek(p_secret text, p_source text, p_of text) TO anon;
GRANT ALL ON FUNCTION public.collect_peek(p_secret text, p_source text, p_of text) TO authenticated;


--
-- Name: FUNCTION collect_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_put(p_secret text, p_source text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION collect_trash(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.collect_trash(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.collect_trash(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.collect_trash(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.collect_trash(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION comment_depth_guard(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.comment_depth_guard() FROM PUBLIC;
GRANT ALL ON FUNCTION public.comment_depth_guard() TO service_role;


--
-- Name: FUNCTION deadline_from_title(p_title text, p_base date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.deadline_from_title(p_title text, p_base date) TO service_role;


--
-- Name: FUNCTION exec_keys(p_names text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.exec_keys(p_names text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.exec_keys(p_names text[]) TO service_role;


--
-- Name: FUNCTION fill_deadline_from_title(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.fill_deadline_from_title() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fill_deadline_from_title() TO service_role;


--
-- Name: FUNCTION gojobs_recheck(p_words text[], p_dry boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.gojobs_recheck(p_words text[], p_dry boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.gojobs_recheck(p_words text[], p_dry boolean) TO service_role;


--
-- Name: FUNCTION hand_check_put(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.hand_check_put(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public.hand_check_put(p_secret text, p_source text, p_rows jsonb) TO anon;
GRANT ALL ON FUNCTION public.hand_check_put(p_secret text, p_source text, p_rows jsonb) TO authenticated;


--
-- Name: FUNCTION hide_backfill_nodate(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hide_backfill_nodate() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_backfill_nodate() TO service_role;


--
-- Name: FUNCTION hide_closed_by_title(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hide_closed_by_title() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_closed_by_title() TO service_role;


--
-- Name: FUNCTION hide_post(p_id bigint, p_hide boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hide_post(p_id bigint, p_hide boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_post(p_id bigint, p_hide boolean) TO service_role;
GRANT ALL ON FUNCTION public.hide_post(p_id bigint, p_hide boolean) TO authenticated;


--
-- Name: FUNCTION hide_stale_posts(p_days integer, p_rolling_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hide_stale_posts(p_days integer, p_rolling_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_stale_posts(p_days integer, p_rolling_days integer) TO service_role;


--
-- Name: FUNCTION hide_www_twins(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hide_www_twins() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_www_twins() TO service_role;


--
-- Name: FUNCTION hide_www_twins(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.hide_www_twins(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.hide_www_twins(p_secret text, p_source text) TO anon;


--
-- Name: FUNCTION hira_name_key(s text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.hira_name_key(s text) TO service_role;


--
-- Name: FUNCTION hold_digest(p_secret text, p_source text, p_hours integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer) TO service_role;
GRANT ALL ON FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer) TO anon;
GRANT ALL ON FUNCTION public.hold_digest(p_secret text, p_source text, p_hours integer) TO authenticated;


--
-- Name: FUNCTION hold_rehab_only(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hold_rehab_only() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hold_rehab_only() TO service_role;


--
-- Name: FUNCTION home_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.home_stats() TO service_role;
GRANT ALL ON FUNCTION public.home_stats() TO authenticated;
GRANT ALL ON FUNCTION public.home_stats() TO anon;


--
-- Name: FUNCTION hook_block_email_signup(event jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hook_block_email_signup(event jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hook_block_email_signup(event jsonb) TO service_role;
GRANT ALL ON FUNCTION public.hook_block_email_signup(event jsonb) TO supabase_auth_admin;


--
-- Name: FUNCTION in_room(p_room bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.in_room(p_room bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.in_room(p_room bigint) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION job_counts(p_job text, p_sido text, p_q text, p_all boolean, p_tabs text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.job_counts(p_job text, p_sido text, p_q text, p_all boolean, p_tabs text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.job_counts(p_job text, p_sido text, p_q text, p_all boolean, p_tabs text[]) TO service_role;
GRANT ALL ON FUNCTION public.job_counts(p_job text, p_sido text, p_q text, p_all boolean, p_tabs text[]) TO anon;
GRANT ALL ON FUNCTION public.job_counts(p_job text, p_sido text, p_q text, p_all boolean, p_tabs text[]) TO authenticated;


--
-- Name: FUNCTION job_list(p_job text, p_sido text, p_tab text, p_q text, p_all boolean, p_sort text, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.job_list(p_job text, p_sido text, p_tab text, p_q text, p_all boolean, p_sort text, p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.job_list(p_job text, p_sido text, p_tab text, p_q text, p_all boolean, p_sort text, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public.job_list(p_job text, p_sido text, p_tab text, p_q text, p_all boolean, p_sort text, p_page integer) TO authenticated;


--
-- Name: FUNCTION job_one(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.job_one(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.job_one(p_id text) TO service_role;
GRANT ALL ON FUNCTION public.job_one(p_id text) TO anon;
GRANT ALL ON FUNCTION public.job_one(p_id text) TO authenticated;


--
-- Name: FUNCTION job_posts_first_seen_keep(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.job_posts_first_seen_keep() TO service_role;


--
-- Name: FUNCTION job_posts_one_state_trg(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.job_posts_one_state_trg() TO service_role;


--
-- Name: FUNCTION job_state_log_trg(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.job_state_log_trg() TO service_role;


--
-- Name: FUNCTION job_totals(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.job_totals() FROM PUBLIC;
GRANT ALL ON FUNCTION public.job_totals() TO service_role;
GRANT ALL ON FUNCTION public.job_totals() TO anon;
GRANT ALL ON FUNCTION public.job_totals() TO authenticated;


--
-- Name: FUNCTION job_views(p_ids text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.job_views(p_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.job_views(p_ids text[]) TO service_role;
GRANT ALL ON FUNCTION public.job_views(p_ids text[]) TO anon;
GRANT ALL ON FUNCTION public.job_views(p_ids text[]) TO authenticated;


--
-- Name: FUNCTION keep_one_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.keep_one_admin() TO service_role;


--
-- Name: FUNCTION lang_bands(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lang_bands() TO service_role;
GRANT ALL ON FUNCTION public.lang_bands() TO authenticated;
GRANT ALL ON FUNCTION public.lang_bands() TO anon;


--
-- Name: FUNCTION lang_best(p_profile uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.lang_best(p_profile uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lang_best(p_profile uuid) TO service_role;


--
-- Name: FUNCTION lang_points(p_exam text, p_score integer, p_level text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lang_points(p_exam text, p_score integer, p_level text) TO service_role;


--
-- Name: FUNCTION lang_points_check(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lang_points_check() TO service_role;


--
-- Name: FUNCTION lang_stats(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.lang_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.lang_stats() TO service_role;
GRANT ALL ON FUNCTION public.lang_stats() TO authenticated;


--
-- Name: FUNCTION ocr_zero_put(p_secret text, p_source text, p_x jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ocr_zero_put(p_secret text, p_source text, p_x jsonb) TO service_role;
GRANT ALL ON FUNCTION public.ocr_zero_put(p_secret text, p_source text, p_x jsonb) TO anon;


--
-- Name: FUNCTION org_detail(p_name text, p_sido text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_detail(p_name text, p_sido text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_detail(p_name text, p_sido text) TO service_role;
GRANT ALL ON FUNCTION public.org_detail(p_name text, p_sido text) TO authenticated;


--
-- Name: FUNCTION org_facets(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_facets() FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_facets() TO service_role;
GRANT ALL ON FUNCTION public.org_facets() TO authenticated;


--
-- Name: FUNCTION org_hospital_by_name(p_name text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_hospital_by_name(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_hospital_by_name(p_name text) TO service_role;
GRANT ALL ON FUNCTION public.org_hospital_by_name(p_name text) TO authenticated;


--
-- Name: FUNCTION org_jobs(p_name text, p_n integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_jobs(p_name text, p_n integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_jobs(p_name text, p_n integer) TO service_role;
GRANT ALL ON FUNCTION public.org_jobs(p_name text, p_n integer) TO authenticated;


--
-- Name: FUNCTION org_key(s text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.org_key(s text) TO service_role;


--
-- Name: FUNCTION org_name_key(s text, p_drop_sido boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.org_name_key(s text, p_drop_sido boolean) TO service_role;


--
-- Name: FUNCTION org_nearby(p_name text, p_sido text, p_n integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_nearby(p_name text, p_sido text, p_n integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_nearby(p_name text, p_sido text, p_n integer) TO service_role;
GRANT ALL ON FUNCTION public.org_nearby(p_name text, p_sido text, p_n integer) TO authenticated;


--
-- Name: FUNCTION org_public(p_name text, p_sido text, p_title text, p_src text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_public(p_name text, p_sido text, p_title text, p_src text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_public(p_name text, p_sido text, p_title text, p_src text) TO service_role;
GRANT ALL ON FUNCTION public.org_public(p_name text, p_sido text, p_title text, p_src text) TO authenticated;


--
-- Name: FUNCTION org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer) TO service_role;
GRANT ALL ON FUNCTION public.org_search(p_q text, p_tile text, p_sido text, p_sgg text, p_sort text, p_limit integer, p_offset integer) TO authenticated;


--
-- Name: FUNCTION org_sgg(p_sido text, p_sgg text, p_addr text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.org_sgg(p_sido text, p_sgg text, p_addr text) TO service_role;


--
-- Name: FUNCTION org_sido(p_sido text, p_addr text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.org_sido(p_sido text, p_addr text) TO service_role;


--
-- Name: FUNCTION org_tile(p_kinds text[], p_sources text[], p_name text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.org_tile(p_kinds text[], p_sources text[], p_name text) TO service_role;


--
-- Name: FUNCTION org_total(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.org_total() TO service_role;


--
-- Name: FUNCTION pay_band(p_hired_year integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.pay_band(p_hired_year integer) TO service_role;


--
-- Name: FUNCTION pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text) TO service_role;
GRANT ALL ON FUNCTION public.pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text) TO anon;
GRANT ALL ON FUNCTION public.pay_stats(p_job text, p_region text, p_type text, p_band text, p_employ text) TO authenticated;


--
-- Name: FUNCTION post_state(p_id bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.post_state(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_state(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public.post_state(p_id bigint) TO anon;
GRANT ALL ON FUNCTION public.post_state(p_id bigint) TO authenticated;


--
-- Name: FUNCTION pub_baseline_check(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.pub_baseline_check() FROM PUBLIC;
GRANT ALL ON FUNCTION public.pub_baseline_check() TO service_role;
GRANT ALL ON FUNCTION public.pub_baseline_check() TO authenticated;


--
-- Name: FUNCTION pub_baseline_get(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.pub_baseline_get(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.pub_baseline_get(p_secret text, p_source text) TO anon;


--
-- Name: FUNCTION pub_leak(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.pub_leak() FROM PUBLIC;
GRANT ALL ON FUNCTION public.pub_leak() TO service_role;
GRANT ALL ON FUNCTION public.pub_leak() TO authenticated;


--
-- Name: FUNCTION refresh_job_scores(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.refresh_job_scores() FROM PUBLIC;
GRANT ALL ON FUNCTION public.refresh_job_scores() TO service_role;


--
-- Name: FUNCTION refresh_org_coverage(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.refresh_org_coverage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.refresh_org_coverage() TO service_role;


--
-- Name: FUNCTION refresh_org_directory(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.refresh_org_directory() FROM PUBLIC;
GRANT ALL ON FUNCTION public.refresh_org_directory() TO service_role;


--
-- Name: FUNCTION rejudge_forget(p_secret text, p_ids text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rejudge_forget(p_secret text, p_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rejudge_forget(p_secret text, p_ids text[]) TO service_role;
GRANT ALL ON FUNCTION public.rejudge_forget(p_secret text, p_ids text[]) TO anon;
GRANT ALL ON FUNCTION public.rejudge_forget(p_secret text, p_ids text[]) TO authenticated;


--
-- Name: FUNCTION rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rejudge_hold_apply(p_secret text, p_show text[], p_hide text[], p_why text) TO service_role;


--
-- Name: FUNCTION rejudge_hold_list(p_secret text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rejudge_hold_list(p_secret text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rejudge_hold_list(p_secret text) TO service_role;
GRANT ALL ON FUNCTION public.rejudge_hold_list(p_secret text) TO anon;
GRANT ALL ON FUNCTION public.rejudge_hold_list(p_secret text) TO authenticated;


--
-- Name: FUNCTION reset_my_account(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reset_my_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_my_account() TO service_role;
GRANT ALL ON FUNCTION public.reset_my_account() TO authenticated;


--
-- Name: FUNCTION rival_match_go(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rival_match_go(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public.rival_match_go(p_secret text, p_source text) TO anon;


--
-- Name: FUNCTION rival_match_run(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rival_match_run() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rival_match_run() TO service_role;


--
-- Name: FUNCTION rival_put(p_secret text, p_source text, p_rows jsonb, "p_첫판" boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rival_put(p_secret text, p_source text, p_rows jsonb, "p_첫판" boolean) TO service_role;
GRANT ALL ON FUNCTION public.rival_put(p_secret text, p_source text, p_rows jsonb, "p_첫판" boolean) TO anon;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION rookie_salary(p_job text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rookie_salary(p_job text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rookie_salary(p_job text) TO service_role;
GRANT ALL ON FUNCTION public.rookie_salary(p_job text) TO anon;
GRANT ALL ON FUNCTION public.rookie_salary(p_job text) TO authenticated;


--
-- Name: FUNCTION route_health(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.route_health() FROM PUBLIC;
GRANT ALL ON FUNCTION public.route_health() TO service_role;
GRANT ALL ON FUNCTION public.route_health() TO authenticated;


--
-- Name: FUNCTION salary_stats(p_hospital_type text, p_region text, p_hired_year integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.salary_stats(p_hospital_type text, p_region text, p_hired_year integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.salary_stats(p_hospital_type text, p_region text, p_hired_year integer) TO authenticated;
GRANT ALL ON FUNCTION public.salary_stats(p_hospital_type text, p_region text, p_hired_year integer) TO service_role;


--
-- Name: FUNCTION save_my_survey(p_salary jsonb, p_spec jsonb, p_langs jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.save_my_survey(p_salary jsonb, p_spec jsonb, p_langs jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_my_survey(p_salary jsonb, p_spec jsonb, p_langs jsonb) TO service_role;
GRANT ALL ON FUNCTION public.save_my_survey(p_salary jsonb, p_spec jsonb, p_langs jsonb) TO authenticated;


--
-- Name: FUNCTION sido_has(p_stored text, p_want text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sido_has(p_stored text, p_want text) TO service_role;


--
-- Name: FUNCTION spec_langs_cap(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.spec_langs_cap() TO service_role;


--
-- Name: FUNCTION spec_parts(p_gpa numeric, p_gpa_scale numeric, p_lang_pt integer, p_school text, p_licenses text[], p_trainings text[], p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.spec_parts(p_gpa numeric, p_gpa_scale numeric, p_lang_pt integer, p_school text, p_licenses text[], p_trainings text[], p_rows jsonb) TO service_role;


--
-- Name: FUNCTION spec_parts_check(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.spec_parts_check() TO service_role;


--
-- Name: TABLE student_specs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.student_specs TO authenticated;
GRANT ALL ON TABLE public.student_specs TO service_role;


--
-- Name: FUNCTION spec_score(s public.student_specs); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.spec_score(s public.student_specs) TO service_role;


--
-- Name: FUNCTION spec_stats(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.spec_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.spec_stats() TO service_role;
GRANT ALL ON FUNCTION public.spec_stats() TO anon;
GRANT ALL ON FUNCTION public.spec_stats() TO authenticated;


--
-- Name: FUNCTION unread_count(p_room bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.unread_count(p_room bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unread_count(p_room bigint) TO authenticated;
GRANT ALL ON FUNCTION public.unread_count(p_room bigint) TO service_role;


--
-- Name: FUNCTION "가입하기"("p_닉네임" text, "p_직군" text, "p_역할" text, "p_사진" text, "p_약관판" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."가입하기"("p_닉네임" text, "p_직군" text, "p_역할" text, "p_사진" text, "p_약관판" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."가입하기"("p_닉네임" text, "p_직군" text, "p_역할" text, "p_사진" text, "p_약관판" text) TO service_role;
GRANT ALL ON FUNCTION public."가입하기"("p_닉네임" text, "p_직군" text, "p_역할" text, "p_사진" text, "p_약관판" text) TO authenticated;


--
-- Name: FUNCTION "개인정보지움"(p text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."개인정보지움"(p text) TO service_role;


--
-- Name: FUNCTION "견줄이름"(s text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."견줄이름"(s text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."견줄이름"(s text) TO service_role;


--
-- Name: FUNCTION "경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer) TO service_role;
GRANT ALL ON FUNCTION public."경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer) TO anon;
GRANT ALL ON FUNCTION public."경쟁률찾기목록"("p_직군" text, "p_지역" text, "p_기관" text, "p_찾기" text, "p_쪽" integer) TO authenticated;


--
-- Name: FUNCTION "경쟁률한묶음"("p_묶음키" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."경쟁률한묶음"("p_묶음키" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."경쟁률한묶음"("p_묶음키" text) TO service_role;
GRANT ALL ON FUNCTION public."경쟁률한묶음"("p_묶음키" text) TO anon;
GRANT ALL ON FUNCTION public."경쟁률한묶음"("p_묶음키" text) TO authenticated;


--
-- Name: FUNCTION "경쟁사_오래된글_지우기"(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."경쟁사_오래된글_지우기"(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."경쟁사_오래된글_지우기"(p_days integer) TO service_role;


--
-- Name: FUNCTION "고용24칸바로잡기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."고용24칸바로잡기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."고용24칸바로잡기"() TO service_role;
GRANT ALL ON FUNCTION public."고용24칸바로잡기"() TO authenticated;


--
-- Name: FUNCTION "고용형태보임"(v text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."고용형태보임"(v text) TO service_role;
GRANT ALL ON FUNCTION public."고용형태보임"(v text) TO anon;
GRANT ALL ON FUNCTION public."고용형태보임"(v text) TO authenticated;


--
-- Name: TABLE job_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_posts TO service_role;
GRANT DELETE ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(id) ON TABLE public.job_posts TO anon;
GRANT SELECT(id) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.external_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(external_id) ON TABLE public.job_posts TO anon;
GRANT SELECT(external_id) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.org_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(org_name) ON TABLE public.job_posts TO anon;
GRANT SELECT(org_name),UPDATE(org_name) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.title; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(title) ON TABLE public.job_posts TO anon;
GRANT SELECT(title),UPDATE(title) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.hire_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(hire_type) ON TABLE public.job_posts TO anon;
GRANT SELECT(hire_type),UPDATE(hire_type) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.employ_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(employ_type) ON TABLE public.job_posts TO anon;
GRANT SELECT(employ_type),UPDATE(employ_type) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.work_place; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(work_place) ON TABLE public.job_posts TO anon;
GRANT SELECT(work_place),UPDATE(work_place) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.sido; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(sido) ON TABLE public.job_posts TO anon;
GRANT SELECT(sido),UPDATE(sido) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.sgg; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(sgg) ON TABLE public.job_posts TO anon;
GRANT SELECT(sgg),UPDATE(sgg) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.edu; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(edu) ON TABLE public.job_posts TO anon;
GRANT SELECT(edu),UPDATE(edu) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.headcount; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(headcount) ON TABLE public.job_posts TO anon;
GRANT SELECT(headcount),UPDATE(headcount) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.apply_from; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(apply_from) ON TABLE public.job_posts TO anon;
GRANT SELECT(apply_from),UPDATE(apply_from) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.apply_to; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(apply_to) ON TABLE public.job_posts TO anon;
GRANT SELECT(apply_to),UPDATE(apply_to) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.posted_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(posted_at) ON TABLE public.job_posts TO anon;
GRANT SELECT(posted_at),UPDATE(posted_at) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.url; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(url) ON TABLE public.job_posts TO anon;
GRANT SELECT(url),UPDATE(url) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.job_group; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(job_group) ON TABLE public.job_posts TO anon;
GRANT SELECT(job_group),UPDATE(job_group) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.form; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(form) ON TABLE public.job_posts TO anon;
GRANT SELECT(form),UPDATE(form) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.org_kind; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(org_kind) ON TABLE public.job_posts TO anon;
GRANT SELECT(org_kind),UPDATE(org_kind) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.tab; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(tab) ON TABLE public.job_posts TO anon;
GRANT SELECT(tab),UPDATE(tab) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.hidden; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(hidden) ON TABLE public.job_posts TO anon;
GRANT SELECT(hidden),UPDATE(hidden) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.hold; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(hold) ON TABLE public.job_posts TO anon;
GRANT SELECT(hold),UPDATE(hold) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.notify; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(notify) ON TABLE public.job_posts TO anon;
GRANT SELECT(notify),UPDATE(notify) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.detail; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(detail) ON TABLE public.job_posts TO anon;
GRANT SELECT(detail),UPDATE(detail) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.edited_fields; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(edited_fields) ON TABLE public.job_posts TO anon;
GRANT SELECT(edited_fields),UPDATE(edited_fields) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.detail_tries; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(detail_tries) ON TABLE public.job_posts TO anon;
GRANT SELECT(detail_tries) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.updated_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(updated_at) ON TABLE public.job_posts TO anon;
GRANT SELECT(updated_at),UPDATE(updated_at) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.score; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(score) ON TABLE public.job_posts TO anon;
GRANT SELECT(score) ON TABLE public.job_posts TO authenticated;


--
-- Name: COLUMN job_posts.score_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(score_at) ON TABLE public.job_posts TO anon;
GRANT SELECT(score_at) ON TABLE public.job_posts TO authenticated;


--
-- Name: FUNCTION "고용형태보임행"(j public.job_posts); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."고용형태보임행"(j public.job_posts) TO service_role;


--
-- Name: FUNCTION "공개공고"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공개공고"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."공개공고"() TO service_role;
GRANT ALL ON FUNCTION public."공개공고"() TO anon;
GRANT ALL ON FUNCTION public."공개공고"() TO authenticated;


--
-- Name: FUNCTION "공개공고하나"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공개공고하나"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공개공고하나"(p_id text) TO service_role;
GRANT ALL ON FUNCTION public."공개공고하나"(p_id text) TO anon;
GRANT ALL ON FUNCTION public."공개공고하나"(p_id text) TO authenticated;


--
-- Name: FUNCTION "공고경쟁률있나"("p_공고" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고경쟁률있나"("p_공고" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고경쟁률있나"("p_공고" text) TO service_role;
GRANT ALL ON FUNCTION public."공고경쟁률있나"("p_공고" text) TO authenticated;
GRANT ALL ON FUNCTION public."공고경쟁률있나"("p_공고" text) TO anon;


--
-- Name: FUNCTION "공고뽑은값"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고뽑은값"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고뽑은값"(p_id text) TO service_role;
GRANT ALL ON FUNCTION public."공고뽑은값"(p_id text) TO authenticated;


--
-- Name: FUNCTION "공고연결"("p_남길" text, "p_연결할" text, "p_왜" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고연결"("p_남길" text, "p_연결할" text, "p_왜" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고연결"("p_남길" text, "p_연결할" text, "p_왜" text) TO service_role;
GRANT ALL ON FUNCTION public."공고연결"("p_남길" text, "p_연결할" text, "p_왜" text) TO authenticated;


--
-- Name: FUNCTION "공고연결풀기"("p_연결할" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고연결풀기"("p_연결할" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고연결풀기"("p_연결할" text) TO service_role;
GRANT ALL ON FUNCTION public."공고연결풀기"("p_연결할" text) TO authenticated;


--
-- Name: FUNCTION "공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고열쇠"("p_기관" text, "p_주소" text, "p_제목" text) TO service_role;


--
-- Name: FUNCTION "공고오류신고"(p_job text, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고오류신고"(p_job text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고오류신고"(p_job text, p_reason text) TO service_role;
GRANT ALL ON FUNCTION public."공고오류신고"(p_job text, p_reason text) TO authenticated;


--
-- Name: FUNCTION "공고원문제목"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고원문제목"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고원문제목"(p_id text) TO service_role;
GRANT ALL ON FUNCTION public."공고원문제목"(p_id text) TO anon;
GRANT ALL ON FUNCTION public."공고원문제목"(p_id text) TO authenticated;


--
-- Name: FUNCTION "공고접수마감글"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고접수마감글"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고접수마감글"(p_id text) TO service_role;
GRANT ALL ON FUNCTION public."공고접수마감글"(p_id text) TO authenticated;


--
-- Name: FUNCTION "공고조회수"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공고조회수"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공고조회수"(p_id text) TO service_role;
GRANT ALL ON FUNCTION public."공고조회수"(p_id text) TO anon;
GRANT ALL ON FUNCTION public."공고조회수"(p_id text) TO authenticated;


--
-- Name: FUNCTION "공공기관인가"(p_id text, p_tab text, p_org_name text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."공공기관인가"(p_id text, p_tab text, p_org_name text) TO service_role;
GRANT ALL ON FUNCTION public."공공기관인가"(p_id text, p_tab text, p_org_name text) TO anon;
GRANT ALL ON FUNCTION public."공공기관인가"(p_id text, p_tab text, p_org_name text) TO authenticated;


--
-- Name: FUNCTION "공식확인하기"("p_공고" text, "p_맞나" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."공식확인하기"("p_공고" text, "p_맞나" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."공식확인하기"("p_공고" text, "p_맞나" boolean) TO service_role;
GRANT ALL ON FUNCTION public."공식확인하기"("p_공고" text, "p_맞나" boolean) TO authenticated;


--
-- Name: FUNCTION "광고셈올리기"("p_자리" text, "p_누름" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."광고셈올리기"("p_자리" text, "p_누름" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."광고셈올리기"("p_자리" text, "p_누름" boolean) TO service_role;
GRANT ALL ON FUNCTION public."광고셈올리기"("p_자리" text, "p_누름" boolean) TO anon;
GRANT ALL ON FUNCTION public."광고셈올리기"("p_자리" text, "p_누름" boolean) TO authenticated;


--
-- Name: FUNCTION "교육과정고치기"("p_과정" bigint, "p_제목" text, "p_직군" text, "p_소개" text, "p_숨길까" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육과정고치기"("p_과정" bigint, "p_제목" text, "p_직군" text, "p_소개" text, "p_숨길까" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육과정고치기"("p_과정" bigint, "p_제목" text, "p_직군" text, "p_소개" text, "p_숨길까" boolean) TO service_role;
GRANT ALL ON FUNCTION public."교육과정고치기"("p_과정" bigint, "p_제목" text, "p_직군" text, "p_소개" text, "p_숨길까" boolean) TO authenticated;


--
-- Name: FUNCTION "교육과정만들기"("p_제목" text, "p_직군" text, "p_소개" text, "p_교육기관" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육과정만들기"("p_제목" text, "p_직군" text, "p_소개" text, "p_교육기관" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육과정만들기"("p_제목" text, "p_직군" text, "p_소개" text, "p_교육기관" text) TO service_role;
GRANT ALL ON FUNCTION public."교육과정만들기"("p_제목" text, "p_직군" text, "p_소개" text, "p_교육기관" text) TO authenticated;


--
-- Name: FUNCTION "교육기관목록"("p_직군" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."교육기관목록"("p_직군" text) TO service_role;
GRANT ALL ON FUNCTION public."교육기관목록"("p_직군" text) TO anon;
GRANT ALL ON FUNCTION public."교육기관목록"("p_직군" text) TO authenticated;


--
-- Name: FUNCTION "교육기관알림켜기"("p_기관" text, "p_켤까" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육기관알림켜기"("p_기관" text, "p_켤까" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육기관알림켜기"("p_기관" text, "p_켤까" boolean) TO service_role;
GRANT ALL ON FUNCTION public."교육기관알림켜기"("p_기관" text, "p_켤까" boolean) TO authenticated;


--
-- Name: FUNCTION "교육기관하나"("p_이름" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."교육기관하나"("p_이름" text) TO service_role;
GRANT ALL ON FUNCTION public."교육기관하나"("p_이름" text) TO anon;
GRANT ALL ON FUNCTION public."교육기관하나"("p_이름" text) TO authenticated;


--
-- Name: FUNCTION "교육담기"(p_secret text, "p_교육" jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육담기"(p_secret text, "p_교육" jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육담기"(p_secret text, "p_교육" jsonb) TO service_role;


--
-- Name: FUNCTION "교육담당자인가"("p_과정" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육담당자인가"("p_과정" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육담당자인가"("p_과정" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육담당자인가"("p_과정" bigint) TO authenticated;


--
-- Name: FUNCTION "교육리뷰답글쓰기"("p_리뷰" bigint, "p_글" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육리뷰답글쓰기"("p_리뷰" bigint, "p_글" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육리뷰답글쓰기"("p_리뷰" bigint, "p_글" text) TO service_role;
GRANT ALL ON FUNCTION public."교육리뷰답글쓰기"("p_리뷰" bigint, "p_글" text) TO authenticated;


--
-- Name: FUNCTION "교육리뷰쓰기"("p_회차" bigint, "p_별점" integer, "p_글" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육리뷰쓰기"("p_회차" bigint, "p_별점" integer, "p_글" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육리뷰쓰기"("p_회차" bigint, "p_별점" integer, "p_글" text) TO service_role;
GRANT ALL ON FUNCTION public."교육리뷰쓰기"("p_회차" bigint, "p_별점" integer, "p_글" text) TO authenticated;


--
-- Name: FUNCTION "교육모집끝내기"("p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육모집끝내기"("p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육모집끝내기"("p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육모집끝내기"("p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "교육목록"("p_직군" text, "p_출처" text, "p_지난것" boolean, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."교육목록"("p_직군" text, "p_출처" text, "p_지난것" boolean, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."교육목록"("p_직군" text, "p_출처" text, "p_지난것" boolean, p_page integer) TO anon;
GRANT ALL ON FUNCTION public."교육목록"("p_직군" text, "p_출처" text, "p_지난것" boolean, p_page integer) TO authenticated;


--
-- Name: FUNCTION "교육셈"("p_직군" text, "p_출처" text, "p_지난것" boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."교육셈"("p_직군" text, "p_출처" text, "p_지난것" boolean) TO service_role;
GRANT ALL ON FUNCTION public."교육셈"("p_직군" text, "p_출처" text, "p_지난것" boolean) TO anon;
GRANT ALL ON FUNCTION public."교육셈"("p_직군" text, "p_출처" text, "p_지난것" boolean) TO authenticated;


--
-- Name: FUNCTION "교육신청목록"("p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육신청목록"("p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육신청목록"("p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육신청목록"("p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "교육신청하기"("p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육신청하기"("p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육신청하기"("p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육신청하기"("p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "교육입금눌렀어요"("p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육입금눌렀어요"("p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육입금눌렀어요"("p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육입금눌렀어요"("p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "교육입금알림"(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육입금알림"(p_secret text, p_source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육입금알림"(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public."교육입금알림"(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public."교육입금알림"(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION "교육재공고"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_접수시작" date, "p_접수끝" date, "p_입금기한" date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육재공고"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_접수시작" date, "p_접수끝" date, "p_입금기한" date) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육재공고"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_접수시작" date, "p_접수끝" date, "p_입금기한" date) TO service_role;
GRANT ALL ON FUNCTION public."교육재공고"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_접수시작" date, "p_접수끝" date, "p_입금기한" date) TO authenticated;


--
-- Name: FUNCTION "교육참여확정"("p_신청" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육참여확정"("p_신청" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육참여확정"("p_신청" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육참여확정"("p_신청" bigint) TO authenticated;


--
-- Name: FUNCTION "교육회차고치기"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text, "p_상태" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육회차고치기"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text, "p_상태" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육회차고치기"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text, "p_상태" text) TO service_role;
GRANT ALL ON FUNCTION public."교육회차고치기"("p_회차" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text, "p_상태" text) TO authenticated;


--
-- Name: FUNCTION "교육회차리뷰"("p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육회차리뷰"("p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육회차리뷰"("p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육회차리뷰"("p_회차" bigint) TO anon;
GRANT ALL ON FUNCTION public."교육회차리뷰"("p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "교육회차보기"("p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육회차보기"("p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육회차보기"("p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."교육회차보기"("p_회차" bigint) TO anon;
GRANT ALL ON FUNCTION public."교육회차보기"("p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "교육회차열기"("p_과정" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."교육회차열기"("p_과정" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."교육회차열기"("p_과정" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text) TO service_role;
GRANT ALL ON FUNCTION public."교육회차열기"("p_과정" bigint, "p_시작" date, "p_끝" date, "p_장소" text, "p_정원" integer, "p_접수시작" date, "p_접수끝" date, "p_수강료" integer, "p_은행" text, "p_계좌번호" text, "p_예금주" text, "p_입금기한" date, "p_입금자명규칙" text, "p_환불규정" text, "p_결제링크" text) TO authenticated;


--
-- Name: FUNCTION "권한있나"("p_코드" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."권한있나"("p_코드" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."권한있나"("p_코드" text) TO service_role;
GRANT ALL ON FUNCTION public."권한있나"("p_코드" text) TO authenticated;


--
-- Name: FUNCTION "근무지이름있나"(p_org text, p_title text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."근무지이름있나"(p_org text, p_title text) TO service_role;


--
-- Name: FUNCTION "글사진"(p_post bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."글사진"(p_post bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."글사진"(p_post bigint) TO service_role;
GRANT ALL ON FUNCTION public."글사진"(p_post bigint) TO anon;
GRANT ALL ON FUNCTION public."글사진"(p_post bigint) TO authenticated;


--
-- Name: FUNCTION "글쓴적있나"(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."글쓴적있나"(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."글쓴적있나"(p_id uuid) TO service_role;
GRANT ALL ON FUNCTION public."글쓴적있나"(p_id uuid) TO authenticated;


--
-- Name: FUNCTION "기관번호_이름으로"("p_이름" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관번호_이름으로"("p_이름" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관번호_이름으로"("p_이름" text) TO service_role;


--
-- Name: FUNCTION "기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관사이트_맞추기"(p_secret text, p_rows jsonb, "p_마른" boolean) TO service_role;


--
-- Name: FUNCTION "기관사이트_옮기기"(p_secret text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관사이트_옮기기"(p_secret text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관사이트_옮기기"(p_secret text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text) TO service_role;
GRANT ALL ON FUNCTION public."기관손으로잇기"("p_공고" text, "p_기관번호" text, "p_메모" text) TO authenticated;


--
-- Name: FUNCTION "기관이름보정"(p_source text, "p_기관" text, "p_제목" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관이름보정"(p_source text, "p_기관" text, "p_제목" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관이름보정"(p_source text, "p_기관" text, "p_제목" text) TO service_role;


--
-- Name: FUNCTION "기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관이름보정_아이디로"(p_id text, "p_기관" text, "p_제목" text) TO service_role;


--
-- Name: FUNCTION "기관이름줄임정하기"("p_원래이름" text, "p_쓸까" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관이름줄임정하기"("p_원래이름" text, "p_쓸까" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관이름줄임정하기"("p_원래이름" text, "p_쓸까" boolean) TO service_role;
GRANT ALL ON FUNCTION public."기관이름줄임정하기"("p_원래이름" text, "p_쓸까" boolean) TO authenticated;


--
-- Name: FUNCTION "기관잇기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관잇기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관잇기"() TO service_role;


--
-- Name: FUNCTION "기관주소보기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관주소보기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관주소보기"() TO service_role;


--
-- Name: FUNCTION "기관주소적기"(p_secret text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관주소적기"(p_secret text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관주소적기"(p_secret text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "기관지역정하기"("p_기관" text, "p_시도" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관지역정하기"("p_기관" text, "p_시도" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관지역정하기"("p_기관" text, "p_시도" text) TO service_role;
GRANT ALL ON FUNCTION public."기관지역정하기"("p_기관" text, "p_시도" text) TO authenticated;


--
-- Name: FUNCTION "기관표채우기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."기관표채우기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."기관표채우기"() TO service_role;


--
-- Name: FUNCTION "꼬리말떼기"(p text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."꼬리말떼기"(p text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."꼬리말떼기"(p text) TO service_role;


--
-- Name: FUNCTION "내가차단한사람"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내가차단한사람"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내가차단한사람"() TO service_role;
GRANT ALL ON FUNCTION public."내가차단한사람"() TO authenticated;
GRANT ALL ON FUNCTION public."내가차단한사람"() TO anon;


--
-- Name: FUNCTION "내관리메뉴"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내관리메뉴"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내관리메뉴"() TO service_role;
GRANT ALL ON FUNCTION public."내관리메뉴"() TO authenticated;


--
-- Name: FUNCTION "내교육과정"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내교육과정"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내교육과정"() TO service_role;
GRANT ALL ON FUNCTION public."내교육과정"() TO authenticated;


--
-- Name: FUNCTION "내교육기관알림"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내교육기관알림"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내교육기관알림"() TO service_role;
GRANT ALL ON FUNCTION public."내교육기관알림"() TO authenticated;


--
-- Name: FUNCTION "내교육신청"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내교육신청"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내교육신청"() TO service_role;
GRANT ALL ON FUNCTION public."내교육신청"() TO authenticated;


--
-- Name: FUNCTION "내교육후기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내교육후기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내교육후기"() TO service_role;
GRANT ALL ON FUNCTION public."내교육후기"() TO authenticated;


--
-- Name: FUNCTION "내권한"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내권한"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내권한"() TO service_role;
GRANT ALL ON FUNCTION public."내권한"() TO authenticated;


--
-- Name: FUNCTION "내담당자신청"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내담당자신청"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내담당자신청"() TO service_role;
GRANT ALL ON FUNCTION public."내담당자신청"() TO authenticated;


--
-- Name: FUNCTION "내대화"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내대화"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내대화"() TO service_role;
GRANT ALL ON FUNCTION public."내대화"() TO authenticated;


--
-- Name: FUNCTION "내병원"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내병원"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내병원"() TO service_role;
GRANT ALL ON FUNCTION public."내병원"() TO authenticated;


--
-- Name: FUNCTION "내병원공고"("p_기관번호" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내병원공고"("p_기관번호" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."내병원공고"("p_기관번호" text) TO service_role;
GRANT ALL ON FUNCTION public."내병원공고"("p_기관번호" text) TO authenticated;


--
-- Name: FUNCTION "내알림"("p_몇줄" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내알림"("p_몇줄" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."내알림"("p_몇줄" integer) TO service_role;
GRANT ALL ON FUNCTION public."내알림"("p_몇줄" integer) TO authenticated;


--
-- Name: FUNCTION "내애플연결"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내애플연결"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내애플연결"() TO service_role;
GRANT ALL ON FUNCTION public."내애플연결"() TO authenticated;


--
-- Name: FUNCTION "내재직인증"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내재직인증"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내재직인증"() TO service_role;
GRANT ALL ON FUNCTION public."내재직인증"() TO authenticated;


--
-- Name: FUNCTION "내차단목록"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내차단목록"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내차단목록"() TO service_role;
GRANT ALL ON FUNCTION public."내차단목록"() TO authenticated;


--
-- Name: FUNCTION "내페르소나"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내페르소나"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내페르소나"() TO service_role;
GRANT ALL ON FUNCTION public."내페르소나"() TO authenticated;


--
-- Name: FUNCTION "내프로필"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."내프로필"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."내프로필"() TO service_role;
GRANT ALL ON FUNCTION public."내프로필"() TO authenticated;


--
-- Name: FUNCTION "네숫자"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."네숫자"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."네숫자"() TO service_role;


--
-- Name: FUNCTION "닉네임다듬기"(p text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."닉네임다듬기"(p text) TO service_role;


--
-- Name: FUNCTION "닉네임쓸수있나"(p_nickname text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."닉네임쓸수있나"(p_nickname text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."닉네임쓸수있나"(p_nickname text) TO service_role;


--
-- Name: FUNCTION "닉네임잡혔나"(p_nickname text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."닉네임잡혔나"(p_nickname text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."닉네임잡혔나"(p_nickname text) TO service_role;


--
-- Name: FUNCTION "닉네임지문"(p text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."닉네임지문"(p text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."닉네임지문"(p text) TO service_role;


--
-- Name: FUNCTION "담당자공고고치기"("p_공고" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."담당자공고고치기"("p_공고" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."담당자공고고치기"("p_공고" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) TO service_role;
GRANT ALL ON FUNCTION public."담당자공고고치기"("p_공고" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) TO authenticated;


--
-- Name: FUNCTION "담당자공고마감"("p_공고" text, "p_내릴까" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."담당자공고마감"("p_공고" text, "p_내릴까" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."담당자공고마감"("p_공고" text, "p_내릴까" boolean) TO service_role;
GRANT ALL ON FUNCTION public."담당자공고마감"("p_공고" text, "p_내릴까" boolean) TO authenticated;


--
-- Name: FUNCTION "담당자공고쓰기"("p_기관번호" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."담당자공고쓰기"("p_기관번호" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."담당자공고쓰기"("p_기관번호" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) TO service_role;
GRANT ALL ON FUNCTION public."담당자공고쓰기"("p_기관번호" text, "p_제목" text, "p_직군" text, "p_고용형태" text, "p_근무지" text, "p_인원" integer, "p_접수부터" date, "p_접수까지" date, "p_마감시각" time without time zone, "p_주소" text, "p_상세" jsonb) TO authenticated;


--
-- Name: FUNCTION "담당자신청"("p_갈래" text, "p_기관번호" text, "p_교육기관" text, "p_사업자번호" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."담당자신청"("p_갈래" text, "p_기관번호" text, "p_교육기관" text, "p_사업자번호" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."담당자신청"("p_갈래" text, "p_기관번호" text, "p_교육기관" text, "p_사업자번호" text) TO service_role;
GRANT ALL ON FUNCTION public."담당자신청"("p_갈래" text, "p_기관번호" text, "p_교육기관" text, "p_사업자번호" text) TO authenticated;


--
-- Name: FUNCTION "담지못한줄"(p_hours integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."담지못한줄"(p_hours integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."담지못한줄"(p_hours integer) TO service_role;


--
-- Name: FUNCTION "대표인가"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대표인가"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."대표인가"() TO service_role;
GRANT ALL ON FUNCTION public."대표인가"() TO authenticated;


--
-- Name: FUNCTION "대화걸기"("p_상대" uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대화걸기"("p_상대" uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."대화걸기"("p_상대" uuid) TO service_role;
GRANT ALL ON FUNCTION public."대화걸기"("p_상대" uuid) TO authenticated;


--
-- Name: FUNCTION "대화보내기"("p_방" bigint, "p_글" text, "p_사진" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대화보내기"("p_방" bigint, "p_글" text, "p_사진" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."대화보내기"("p_방" bigint, "p_글" text, "p_사진" text) TO service_role;
GRANT ALL ON FUNCTION public."대화보내기"("p_방" bigint, "p_글" text, "p_사진" text) TO authenticated;


--
-- Name: FUNCTION "대화읽기"("p_방" bigint, "p_몇줄" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대화읽기"("p_방" bigint, "p_몇줄" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."대화읽기"("p_방" bigint, "p_몇줄" integer) TO service_role;
GRANT ALL ON FUNCTION public."대화읽기"("p_방" bigint, "p_몇줄" integer) TO authenticated;


--
-- Name: FUNCTION "대화읽음"("p_방" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대화읽음"("p_방" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."대화읽음"("p_방" bigint) TO service_role;
GRANT ALL ON FUNCTION public."대화읽음"("p_방" bigint) TO authenticated;


--
-- Name: FUNCTION "대화정하기"("p_방" bigint, "p_받나" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대화정하기"("p_방" bigint, "p_받나" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."대화정하기"("p_방" bigint, "p_받나" boolean) TO service_role;
GRANT ALL ON FUNCTION public."대화정하기"("p_방" bigint, "p_받나" boolean) TO authenticated;


--
-- Name: FUNCTION "대화차단하기"("p_상대" uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."대화차단하기"("p_상대" uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."대화차단하기"("p_상대" uuid) TO service_role;
GRANT ALL ON FUNCTION public."대화차단하기"("p_상대" uuid) TO authenticated;


--
-- Name: FUNCTION "동의남기기"("p_판" text, "p_문서들" jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."동의남기기"("p_판" text, "p_문서들" jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."동의남기기"("p_판" text, "p_문서들" jsonb) TO service_role;
GRANT ALL ON FUNCTION public."동의남기기"("p_판" text, "p_문서들" jsonb) TO authenticated;


--
-- Name: FUNCTION "마감일되읽기"(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."마감일되읽기"(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."마감일되읽기"(p_secret text, p_source text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "마감지났나"(p_apply_to date, p_apply_to_time time without time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."마감지났나"(p_apply_to date, p_apply_to_time time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public."마감지났나"(p_apply_to date, p_apply_to_time time without time zone) TO service_role;
GRANT ALL ON FUNCTION public."마감지났나"(p_apply_to date, p_apply_to_time time without time zone) TO anon;
GRANT ALL ON FUNCTION public."마감지났나"(p_apply_to date, p_apply_to_time time without time zone) TO authenticated;


--
-- Name: FUNCTION "마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text) TO service_role;
GRANT ALL ON FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text) TO anon;
GRANT ALL ON FUNCTION public."마감표시"(p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text) TO authenticated;


--
-- Name: FUNCTION "마스터역할"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."마스터역할"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."마스터역할"() TO service_role;
GRANT ALL ON FUNCTION public."마스터역할"() TO authenticated;


--
-- Name: FUNCTION "마스터인가"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."마스터인가"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."마스터인가"() TO service_role;
GRANT ALL ON FUNCTION public."마스터인가"() TO authenticated;


--
-- Name: FUNCTION "모르는코드"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."모르는코드"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."모르는코드"() TO service_role;
GRANT ALL ON FUNCTION public."모르는코드"() TO authenticated;


--
-- Name: FUNCTION "목록빠짐표시"(p_secret text, p_source text, "p_본것" text[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."목록빠짐표시"(p_secret text, p_source text, "p_본것" text[]) TO service_role;


--
-- Name: FUNCTION "묶은것"(p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."묶은것"(p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."묶은것"(p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."묶은것"(p_page integer) TO authenticated;


--
-- Name: FUNCTION "묶을후보"(p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."묶을후보"(p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."묶을후보"(p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."묶을후보"(p_page integer) TO authenticated;


--
-- Name: FUNCTION "묶지않기"("p_왼쪽" text, "p_오른쪽" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."묶지않기"("p_왼쪽" text, "p_오른쪽" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."묶지않기"("p_왼쪽" text, "p_오른쪽" text) TO service_role;
GRANT ALL ON FUNCTION public."묶지않기"("p_왼쪽" text, "p_오른쪽" text) TO authenticated;


--
-- Name: FUNCTION "묶지않음되돌리기"("p_왼쪽" text, "p_오른쪽" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."묶지않음되돌리기"("p_왼쪽" text, "p_오른쪽" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."묶지않음되돌리기"("p_왼쪽" text, "p_오른쪽" text) TO service_role;
GRANT ALL ON FUNCTION public."묶지않음되돌리기"("p_왼쪽" text, "p_오른쪽" text) TO authenticated;


--
-- Name: FUNCTION "묶지않음목록"(p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."묶지않음목록"(p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."묶지않음목록"(p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."묶지않음목록"(p_page integer) TO authenticated;


--
-- Name: FUNCTION "묶지않음수"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."묶지않음수"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."묶지않음수"() TO service_role;
GRANT ALL ON FUNCTION public."묶지않음수"() TO authenticated;


--
-- Name: FUNCTION "민간2층종별"("p_종별" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."민간2층종별"("p_종별" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."민간2층종별"("p_종별" text) TO service_role;


--
-- Name: FUNCTION "밤정리"(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."밤정리"(p_secret text, p_source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."밤정리"(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public."밤정리"(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public."밤정리"(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION "방묶음"("p_방" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."방묶음"("p_방" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."방묶음"("p_방" text) TO service_role;
GRANT ALL ON FUNCTION public."방묶음"("p_방" text) TO anon;
GRANT ALL ON FUNCTION public."방묶음"("p_방" text) TO authenticated;


--
-- Name: FUNCTION "방볼수있나"("p_방" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."방볼수있나"("p_방" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."방볼수있나"("p_방" text) TO service_role;
GRANT ALL ON FUNCTION public."방볼수있나"("p_방" text) TO anon;
GRANT ALL ON FUNCTION public."방볼수있나"("p_방" text) TO authenticated;


--
-- Name: FUNCTION "방에쓸수있나"("p_방" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."방에쓸수있나"("p_방" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."방에쓸수있나"("p_방" text) TO service_role;
GRANT ALL ON FUNCTION public."방에쓸수있나"("p_방" text) TO anon;
GRANT ALL ON FUNCTION public."방에쓸수있나"("p_방" text) TO authenticated;


--
-- Name: FUNCTION "법인앞말떼기"(v text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."법인앞말떼기"(v text) TO service_role;


--
-- Name: FUNCTION "보낼알림"(p_secret text, "p_하루상한" integer, "p_몇개" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."보낼알림"(p_secret text, "p_하루상한" integer, "p_몇개" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."보낼알림"(p_secret text, "p_하루상한" integer, "p_몇개" integer) TO service_role;


--
-- Name: FUNCTION "보류함마감정리"("p_정말" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."보류함마감정리"("p_정말" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."보류함마감정리"("p_정말" boolean) TO service_role;
GRANT ALL ON FUNCTION public."보류함마감정리"("p_정말" boolean) TO authenticated;


--
-- Name: FUNCTION "본체만뽑나"(p_org text, p_title text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."본체만뽑나"(p_org text, p_title text) TO service_role;


--
-- Name: FUNCTION "봉사담기"(p_secret text, "p_처" jsonb, "p_모집" jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."봉사담기"(p_secret text, "p_처" jsonb, "p_모집" jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."봉사담기"(p_secret text, "p_처" jsonb, "p_모집" jsonb) TO service_role;


--
-- Name: FUNCTION "봉사목록"("p_갈래" text, "p_시도" text, "p_상태" text, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."봉사목록"("p_갈래" text, "p_시도" text, "p_상태" text, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."봉사목록"("p_갈래" text, "p_시도" text, "p_상태" text, p_page integer) TO anon;
GRANT ALL ON FUNCTION public."봉사목록"("p_갈래" text, "p_시도" text, "p_상태" text, p_page integer) TO authenticated;


--
-- Name: FUNCTION "봉사셈"("p_시도" text, "p_상태" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."봉사셈"("p_시도" text, "p_상태" text) TO service_role;
GRANT ALL ON FUNCTION public."봉사셈"("p_시도" text, "p_상태" text) TO anon;
GRANT ALL ON FUNCTION public."봉사셈"("p_시도" text, "p_상태" text) TO authenticated;


--
-- Name: FUNCTION "빈칸공고"("p_직군" text, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."빈칸공고"("p_직군" text, p_page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."빈칸공고"("p_직군" text, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."빈칸공고"("p_직군" text, p_page integer) TO authenticated;


--
-- Name: FUNCTION "빈칸채우기"("p_공고" text, "p_칸" text, "p_값" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."빈칸채우기"("p_공고" text, "p_칸" text, "p_값" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."빈칸채우기"("p_공고" text, "p_칸" text, "p_값" text) TO service_role;
GRANT ALL ON FUNCTION public."빈칸채우기"("p_공고" text, "p_칸" text, "p_값" text) TO authenticated;


--
-- Name: FUNCTION "상세건너뛸공고"(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."상세건너뛸공고"(p_secret text, p_source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."상세건너뛸공고"(p_secret text, p_source text) TO service_role;


--
-- Name: FUNCTION "새공고마름"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."새공고마름"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."새공고마름"() TO service_role;


--
-- Name: FUNCTION "수시인가"(p_title text, p_detail jsonb, "p_제목말" text, "p_칸말" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."수시인가"(p_title text, p_detail jsonb, "p_제목말" text, "p_칸말" text) TO service_role;


--
-- Name: FUNCTION "수집기박동"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."수집기박동"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."수집기박동"() TO service_role;
GRANT ALL ON FUNCTION public."수집기박동"() TO authenticated;


--
-- Name: FUNCTION "쉬는날인가"(d date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."쉬는날인가"(d date) FROM PUBLIC;
GRANT ALL ON FUNCTION public."쉬는날인가"(d date) TO service_role;
GRANT ALL ON FUNCTION public."쉬는날인가"(d date) TO authenticated;


--
-- Name: FUNCTION "시험자료볼까"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."시험자료볼까"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."시험자료볼까"() TO service_role;
GRANT ALL ON FUNCTION public."시험자료볼까"() TO anon;
GRANT ALL ON FUNCTION public."시험자료볼까"() TO authenticated;


--
-- Name: FUNCTION "시험자료치우기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."시험자료치우기"() FROM PUBLIC;


--
-- Name: FUNCTION "신고걸렸나"(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."신고걸렸나"(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."신고걸렸나"(p_id uuid) TO service_role;


--
-- Name: FUNCTION "신고걸린방"(p_room bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."신고걸린방"(p_room bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."신고걸린방"(p_room bigint) TO service_role;


--
-- Name: FUNCTION "신청가능교육"("p_직군" text, "p_지난것" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."신청가능교육"("p_직군" text, "p_지난것" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."신청가능교육"("p_직군" text, "p_지난것" boolean) TO service_role;
GRANT ALL ON FUNCTION public."신청가능교육"("p_직군" text, "p_지난것" boolean) TO anon;
GRANT ALL ON FUNCTION public."신청가능교육"("p_직군" text, "p_지난것" boolean) TO authenticated;


--
-- Name: FUNCTION "심평원받을곳"(p_secret text, p_source text, "p_연월" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."심평원받을곳"(p_secret text, p_source text, "p_연월" text) TO service_role;
GRANT ALL ON FUNCTION public."심평원받을곳"(p_secret text, p_source text, "p_연월" text) TO anon;


--
-- Name: FUNCTION "심평원인원담기"(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."심평원인원담기"(p_secret text, p_source text, p_rows jsonb) TO service_role;
GRANT ALL ON FUNCTION public."심평원인원담기"(p_secret text, p_source text, p_rows jsonb) TO anon;


--
-- Name: FUNCTION "아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public."아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone) TO service_role;
GRANT ALL ON FUNCTION public."아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone) TO anon;
GRANT ALL ON FUNCTION public."아직산공고인가"(p_apply_to date, p_apply_to_time time without time zone) TO authenticated;


--
-- Name: FUNCTION "안읽은알림"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."안읽은알림"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."안읽은알림"() TO service_role;
GRANT ALL ON FUNCTION public."안읽은알림"() TO authenticated;


--
-- Name: FUNCTION "알리오자리같음목록"(p_secret text, p_source text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."알리오자리같음목록"(p_secret text, p_source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."알리오자리같음목록"(p_secret text, p_source text) TO service_role;
GRANT ALL ON FUNCTION public."알리오자리같음목록"(p_secret text, p_source text) TO anon;
GRANT ALL ON FUNCTION public."알리오자리같음목록"(p_secret text, p_source text) TO authenticated;


--
-- Name: FUNCTION "알림기기끄기"("p_주소" text, "p_어떻게" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."알림기기끄기"("p_주소" text, "p_어떻게" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."알림기기끄기"("p_주소" text, "p_어떻게" text) TO service_role;
GRANT ALL ON FUNCTION public."알림기기끄기"("p_주소" text, "p_어떻게" text) TO authenticated;


--
-- Name: FUNCTION "알림기기등록"("p_주소" text, "p_열쇠1" text, "p_열쇠2" text, "p_어떻게" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."알림기기등록"("p_주소" text, "p_열쇠1" text, "p_열쇠2" text, "p_어떻게" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."알림기기등록"("p_주소" text, "p_열쇠1" text, "p_열쇠2" text, "p_어떻게" text) TO service_role;
GRANT ALL ON FUNCTION public."알림기기등록"("p_주소" text, "p_열쇠1" text, "p_열쇠2" text, "p_어떻게" text) TO authenticated;


--
-- Name: FUNCTION "알림넣기"("p_누구" uuid, "p_갈래" text, "p_제목" text, "p_본문" text, "p_링크" text, "p_시험" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."알림넣기"("p_누구" uuid, "p_갈래" text, "p_제목" text, "p_본문" text, "p_링크" text, "p_시험" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."알림넣기"("p_누구" uuid, "p_갈래" text, "p_제목" text, "p_본문" text, "p_링크" text, "p_시험" boolean) TO service_role;


--
-- Name: FUNCTION "알림보낸것남기기"(p_secret text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."알림보낸것남기기"(p_secret text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."알림보낸것남기기"(p_secret text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "알림읽음"(p_id bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."알림읽음"(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."알림읽음"(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public."알림읽음"(p_id bigint) TO authenticated;


--
-- Name: FUNCTION "애플끊기적기"("p_결과" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."애플끊기적기"("p_결과" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."애플끊기적기"("p_결과" text) TO service_role;
GRANT ALL ON FUNCTION public."애플끊기적기"("p_결과" text) TO authenticated;


--
-- Name: FUNCTION "애플연결끊음"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."애플연결끊음"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."애플연결끊음"() TO service_role;
GRANT ALL ON FUNCTION public."애플연결끊음"() TO authenticated;


--
-- Name: FUNCTION "애플연결저장"("p_토큰" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."애플연결저장"("p_토큰" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."애플연결저장"("p_토큰" text) TO service_role;
GRANT ALL ON FUNCTION public."애플연결저장"("p_토큰" text) TO authenticated;


--
-- Name: FUNCTION "여러병원거느린곳"("p_기관" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."여러병원거느린곳"("p_기관" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."여러병원거느린곳"("p_기관" text) TO service_role;


--
-- Name: FUNCTION "열린창구"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."열린창구"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."열린창구"() TO service_role;


--
-- Name: FUNCTION "열린창구_역할"("p_역할" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."열린창구_역할"("p_역할" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."열린창구_역할"("p_역할" text) TO service_role;


--
-- Name: FUNCTION "요청헤더확인"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."요청헤더확인"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."요청헤더확인"() TO service_role;


--
-- Name: FUNCTION "운영진글남기기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."운영진글남기기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."운영진글남기기"() TO service_role;


--
-- Name: FUNCTION "워크넷고용형태풀기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."워크넷고용형태풀기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."워크넷고용형태풀기"() TO service_role;
GRANT ALL ON FUNCTION public."워크넷고용형태풀기"() TO authenticated;


--
-- Name: FUNCTION "원문없어짐까닭"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."원문없어짐까닭"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."원문없어짐까닭"() TO service_role;


--
-- Name: FUNCTION "원문없어짐까닭말"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."원문없어짐까닭말"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."원문없어짐까닭말"() TO service_role;


--
-- Name: FUNCTION "인증자료올림"("p_자격id" bigint, "p_갈래" text, "p_경로" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."인증자료올림"("p_자격id" bigint, "p_갈래" text, "p_경로" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."인증자료올림"("p_자격id" bigint, "p_갈래" text, "p_경로" text) TO service_role;
GRANT ALL ON FUNCTION public."인증자료올림"("p_자격id" bigint, "p_갈래" text, "p_경로" text) TO authenticated;


--
-- Name: FUNCTION "일곱칸찬수"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."일곱칸찬수"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."일곱칸찬수"(p_id text) TO service_role;


--
-- Name: FUNCTION "일층병원_구멍"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."일층병원_구멍"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."일층병원_구멍"() TO service_role;


--
-- Name: FUNCTION "일층병원_구멍셈"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."일층병원_구멍셈"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."일층병원_구멍셈"() TO service_role;


--
-- Name: FUNCTION "일층병원_뺀것"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."일층병원_뺀것"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."일층병원_뺀것"() TO service_role;


--
-- Name: FUNCTION "있는번호"(p_secret text, p_source text, p_ids text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."있는번호"(p_secret text, p_source text, p_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public."있는번호"(p_secret text, p_source text, p_ids text[]) TO service_role;
GRANT ALL ON FUNCTION public."있는번호"(p_secret text, p_source text, p_ids text[]) TO anon;
GRANT ALL ON FUNCTION public."있는번호"(p_secret text, p_source text, p_ids text[]) TO authenticated;


--
-- Name: FUNCTION "잡힌닉네임막기"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."잡힌닉네임막기"() TO service_role;


--
-- Name: FUNCTION "재직인증됐나"("p_사람" uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."재직인증됐나"("p_사람" uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."재직인증됐나"("p_사람" uuid) TO service_role;
GRANT ALL ON FUNCTION public."재직인증됐나"("p_사람" uuid) TO anon;
GRANT ALL ON FUNCTION public."재직인증됐나"("p_사람" uuid) TO authenticated;


--
-- Name: FUNCTION "재직인증신청"("p_경로" text, "p_병원" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."재직인증신청"("p_경로" text, "p_병원" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."재직인증신청"("p_경로" text, "p_병원" text) TO service_role;
GRANT ALL ON FUNCTION public."재직인증신청"("p_경로" text, "p_병원" text) TO authenticated;


--
-- Name: FUNCTION "전남광주가르기"("p_글" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."전남광주가르기"("p_글" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."전남광주가르기"("p_글" text) TO service_role;


--
-- Name: FUNCTION "접속기록남기기"("p_무엇" text, "p_어느표" text, "p_누구것" uuid, "p_몇명" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."접속기록남기기"("p_무엇" text, "p_어느표" text, "p_누구것" uuid, "p_몇명" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."접속기록남기기"("p_무엇" text, "p_어느표" text, "p_누구것" uuid, "p_몇명" integer) TO service_role;


--
-- Name: FUNCTION "제목글자다듬기"(v text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목글자다듬기"(v text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목글자다듬기"(v text) TO service_role;
GRANT ALL ON FUNCTION public."제목글자다듬기"(v text) TO authenticated;


--
-- Name: FUNCTION "제목기관"(j public.job_posts); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."제목기관"(j public.job_posts) TO service_role;


--
-- Name: FUNCTION "제목대체사유"(p_title text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."제목대체사유"(p_title text) TO service_role;


--
-- Name: FUNCTION "제목만들기"(p_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목만들기"(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목만들기"(p_id text) TO service_role;
GRANT ALL ON FUNCTION public."제목만들기"(p_id text) TO authenticated;


--
-- Name: FUNCTION "제목만들기행"(j public.job_posts); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목만들기행"(j public.job_posts) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목만들기행"(j public.job_posts) TO service_role;


--
-- Name: FUNCTION "제목바꿀만한가"("p_옛" text, "p_새" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목바꿀만한가"("p_옛" text, "p_새" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목바꿀만한가"("p_옛" text, "p_새" text) TO service_role;


--
-- Name: FUNCTION "제목부서"(p_title text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목부서"(p_title text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목부서"(p_title text) TO service_role;


--
-- Name: FUNCTION "제목부서"(p_title text, "p_부서" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목부서"(p_title text, "p_부서" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목부서"(p_title text, "p_부서" text) TO service_role;


--
-- Name: FUNCTION "제목분야"(p_title text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목분야"(p_title text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목분야"(p_title text) TO service_role;


--
-- Name: FUNCTION "제목산하"(p_title text, p_org text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목산하"(p_title text, p_org text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목산하"(p_title text, p_org text) TO service_role;


--
-- Name: FUNCTION "제목속글자"(p text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목속글자"(p text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목속글자"(p text) TO service_role;


--
-- Name: FUNCTION "제목속병원"("p_제목" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목속병원"("p_제목" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목속병원"("p_제목" text) TO service_role;


--
-- Name: FUNCTION "제목속병원_앞"("p_제목" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목속병원_앞"("p_제목" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목속병원_앞"("p_제목" text) TO service_role;


--
-- Name: FUNCTION "제목열쇠"("p_제목" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목열쇠"("p_제목" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목열쇠"("p_제목" text) TO service_role;


--
-- Name: FUNCTION "제목지역"(p_sido text, p_work text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."제목지역"(p_sido text, p_work text) TO service_role;


--
-- Name: FUNCTION "제목지역기관"(p_sido text, p_work text, p_org text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목지역기관"(p_sido text, p_work text, p_org text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목지역기관"(p_sido text, p_work text, p_org text) TO service_role;
GRANT ALL ON FUNCTION public."제목지역기관"(p_sido text, p_work text, p_org text) TO authenticated;


--
-- Name: FUNCTION "제목직군"(p_job text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."제목직군"(p_job text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."제목직군"(p_job text) TO service_role;


--
-- Name: FUNCTION "제목채우기"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."제목채우기"() TO service_role;


--
-- Name: FUNCTION "조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text) TO service_role;
GRANT ALL ON FUNCTION public."조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text) TO anon;
GRANT ALL ON FUNCTION public."조교연구갈래"("p_제목" text, "p_기관" text, "p_글" text) TO authenticated;


--
-- Name: FUNCTION "주소도메인"(u text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."주소도메인"(u text) TO service_role;


--
-- Name: FUNCTION "중복숨기기"("p_마른" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."중복숨기기"("p_마른" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."중복숨기기"("p_마른" boolean) TO service_role;


--
-- Name: FUNCTION "지금광고"("p_자리" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."지금광고"("p_자리" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."지금광고"("p_자리" text) TO service_role;
GRANT ALL ON FUNCTION public."지금광고"("p_자리" text) TO anon;
GRANT ALL ON FUNCTION public."지금광고"("p_자리" text) TO authenticated;


--
-- Name: FUNCTION "지난교육인가"("p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."지난교육인가"("p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date) FROM PUBLIC;
GRANT ALL ON FUNCTION public."지난교육인가"("p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date) TO service_role;
GRANT ALL ON FUNCTION public."지난교육인가"("p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date) TO authenticated;


--
-- Name: FUNCTION "지역겹치나"("p_지역" text, p_org text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."지역겹치나"("p_지역" text, p_org text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."지역겹치나"("p_지역" text, p_org text) TO service_role;


--
-- Name: FUNCTION "지역겹치나_새"("p_지역" text, p_org text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."지역겹치나_새"("p_지역" text, p_org text) TO service_role;


--
-- Name: FUNCTION "지역보임"(j public.job_posts); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."지역보임"(j public.job_posts) TO service_role;


--
-- Name: FUNCTION "지역앞말떼기"("p_지역" text, "p_기관" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."지역앞말떼기"("p_지역" text, "p_기관" text) TO service_role;


--
-- Name: FUNCTION "직군의심"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."직군의심"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."직군의심"() TO service_role;


--
-- Name: FUNCTION "차단풀기"("p_누구" uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."차단풀기"("p_누구" uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public."차단풀기"("p_누구" uuid) TO service_role;
GRANT ALL ON FUNCTION public."차단풀기"("p_누구" uuid) TO authenticated;


--
-- Name: FUNCTION "차단하기"("p_글" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."차단하기"("p_글" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."차단하기"("p_글" bigint) TO service_role;
GRANT ALL ON FUNCTION public."차단하기"("p_글" bigint) TO authenticated;


--
-- Name: FUNCTION "채용담당자인가"("p_기관번호" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."채용담당자인가"("p_기관번호" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."채용담당자인가"("p_기관번호" text) TO service_role;
GRANT ALL ON FUNCTION public."채용담당자인가"("p_기관번호" text) TO authenticated;


--
-- Name: FUNCTION "첨부목록"("p_갈래" text, "p_공고" text, "p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부목록"("p_갈래" text, "p_공고" text, "p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부목록"("p_갈래" text, "p_공고" text, "p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."첨부목록"("p_갈래" text, "p_공고" text, "p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "첨부올리기"("p_갈래" text, "p_경로" text, "p_이름" text, "p_크기" integer, "p_형식" text, "p_공고" text, "p_회차" bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부올리기"("p_갈래" text, "p_경로" text, "p_이름" text, "p_크기" integer, "p_형식" text, "p_공고" text, "p_회차" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부올리기"("p_갈래" text, "p_경로" text, "p_이름" text, "p_크기" integer, "p_형식" text, "p_공고" text, "p_회차" bigint) TO service_role;
GRANT ALL ON FUNCTION public."첨부올리기"("p_갈래" text, "p_경로" text, "p_이름" text, "p_크기" integer, "p_형식" text, "p_공고" text, "p_회차" bigint) TO authenticated;


--
-- Name: FUNCTION "첨부올릴수있나"("p_폴더" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부올릴수있나"("p_폴더" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부올릴수있나"("p_폴더" text) TO service_role;
GRANT ALL ON FUNCTION public."첨부올릴수있나"("p_폴더" text) TO authenticated;


--
-- Name: FUNCTION "첨부읽음표시"(p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부읽음표시"(p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부읽음표시"(p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "첨부치우기"(p_id bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부치우기"(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부치우기"(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public."첨부치우기"(p_id bigint) TO authenticated;


--
-- Name: FUNCTION "첨부하나"(p_id bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부하나"(p_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부하나"(p_id bigint) TO service_role;
GRANT ALL ON FUNCTION public."첨부하나"(p_id bigint) TO authenticated;


--
-- Name: FUNCTION "첨부형식맞나"("p_형식" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."첨부형식맞나"("p_형식" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."첨부형식맞나"("p_형식" text) TO service_role;
GRANT ALL ON FUNCTION public."첨부형식맞나"("p_형식" text) TO authenticated;


--
-- Name: FUNCTION "청년담기"(p_secret text, "p_정책" jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."청년담기"(p_secret text, "p_정책" jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."청년담기"(p_secret text, "p_정책" jsonb) TO service_role;


--
-- Name: FUNCTION "청년목록"("p_갈래" text, "p_시도" text, "p_지난것" boolean, p_page integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."청년목록"("p_갈래" text, "p_시도" text, "p_지난것" boolean, p_page integer) TO service_role;
GRANT ALL ON FUNCTION public."청년목록"("p_갈래" text, "p_시도" text, "p_지난것" boolean, p_page integer) TO anon;
GRANT ALL ON FUNCTION public."청년목록"("p_갈래" text, "p_시도" text, "p_지난것" boolean, p_page integer) TO authenticated;


--
-- Name: FUNCTION "청년셈"("p_시도" text, "p_지난것" boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public."청년셈"("p_시도" text, "p_지난것" boolean) TO service_role;
GRANT ALL ON FUNCTION public."청년셈"("p_시도" text, "p_지난것" boolean) TO anon;
GRANT ALL ON FUNCTION public."청년셈"("p_시도" text, "p_지난것" boolean) TO authenticated;


--
-- Name: FUNCTION "출처다른중복"("p_마른" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."출처다른중복"("p_마른" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public."출처다른중복"("p_마른" boolean) TO service_role;


--
-- Name: FUNCTION "칸기록_오래된것지우기"(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."칸기록_오래된것지우기"(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public."칸기록_오래된것지우기"(p_days integer) TO service_role;


--
-- Name: FUNCTION "칸기록남기기"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."칸기록남기기"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."칸기록남기기"() TO service_role;


--
-- Name: FUNCTION "칸되메우기"(p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."칸되메우기"(p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."칸되메우기"(p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "커버리지"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."커버리지"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."커버리지"() TO service_role;
GRANT ALL ON FUNCTION public."커버리지"() TO authenticated;


--
-- Name: FUNCTION "판정남기기"(p_secret text, p_source text, p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."판정남기기"(p_secret text, p_source text, p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public."판정남기기"(p_secret text, p_source text, p_rows jsonb) TO service_role;


--
-- Name: FUNCTION "판정물어보기"(p_secret text, p_source text, p_ids text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."판정물어보기"(p_secret text, p_source text, p_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public."판정물어보기"(p_secret text, p_source text, p_ids text[]) TO service_role;
GRANT ALL ON FUNCTION public."판정물어보기"(p_secret text, p_source text, p_ids text[]) TO anon;


--
-- Name: FUNCTION "페르소나바꾸기"("p_역할" text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public."페르소나바꾸기"("p_역할" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public."페르소나바꾸기"("p_역할" text) TO service_role;
GRANT ALL ON FUNCTION public."페르소나바꾸기"("p_역할" text) TO authenticated;


--
-- Name: TABLE admin_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.admin_jobs TO authenticated;
GRANT ALL ON TABLE public.admin_jobs TO service_role;


--
-- Name: TABLE admins; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admins TO service_role;


--
-- Name: TABLE alio_compete; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.alio_compete TO authenticated;
GRANT ALL ON TABLE public.alio_compete TO service_role;


--
-- Name: TABLE alio_compete_web; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_compete_web TO service_role;


--
-- Name: TABLE alio_compete_web_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_compete_web_state TO service_role;


--
-- Name: TABLE alio_group_sum; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_group_sum TO service_role;


--
-- Name: TABLE alio_hiretype_fix; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_hiretype_fix TO service_role;


--
-- Name: TABLE alio_post_file; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_post_file TO service_role;


--
-- Name: TABLE alio_post_meta; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alio_post_meta TO service_role;


--
-- Name: TABLE api_quota; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_quota TO service_role;


--
-- Name: TABLE api_roster; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_roster TO service_role;


--
-- Name: TABLE chat_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_members TO service_role;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_messages TO service_role;


--
-- Name: SEQUENCE chat_messages_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_messages_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_messages_id_seq TO service_role;


--
-- Name: TABLE chat_rooms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_rooms TO service_role;


--
-- Name: SEQUENCE chat_rooms_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_rooms_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_rooms_id_seq TO service_role;


--
-- Name: TABLE collect_secret_all; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collect_secret_all TO service_role;


--
-- Name: TABLE collect_secret; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collect_secret TO service_role;


--
-- Name: TABLE collect_source; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.collect_source TO anon;
GRANT SELECT ON TABLE public.collect_source TO authenticated;
GRANT ALL ON TABLE public.collect_source TO service_role;


--
-- Name: TABLE collectable_orgs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collectable_orgs TO service_role;


--
-- Name: TABLE collector_beat; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collector_beat TO service_role;


--
-- Name: SEQUENCE collector_beat_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.collector_beat_id_seq TO service_role;


--
-- Name: TABLE collector_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collector_state TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: SEQUENCE comments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.comments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.comments_id_seq TO service_role;


--
-- Name: TABLE dementia_centers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dementia_centers TO service_role;


--
-- Name: SEQUENCE dementia_centers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.dementia_centers_id_seq TO service_role;


--
-- Name: TABLE dementia_safe_centers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.dementia_safe_centers TO anon;
GRANT SELECT ON TABLE public.dementia_safe_centers TO authenticated;
GRANT ALL ON TABLE public.dementia_safe_centers TO service_role;


--
-- Name: SEQUENCE dementia_safe_centers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.dementia_safe_centers_id_seq TO service_role;


--
-- Name: TABLE dev_rehab_orgs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.dev_rehab_orgs TO anon;
GRANT SELECT ON TABLE public.dev_rehab_orgs TO authenticated;
GRANT ALL ON TABLE public.dev_rehab_orgs TO service_role;


--
-- Name: SEQUENCE dev_rehab_orgs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.dev_rehab_orgs_id_seq TO service_role;


--
-- Name: TABLE drop_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.drop_rules TO authenticated;
GRANT ALL ON TABLE public.drop_rules TO service_role;


--
-- Name: TABLE erased_accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.erased_accounts TO authenticated;
GRANT ALL ON TABLE public.erased_accounts TO service_role;


--
-- Name: TABLE hand_check; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hand_check TO service_role;


--
-- Name: TABLE hira_cl_cd; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hira_cl_cd TO service_role;


--
-- Name: TABLE hira_detail; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hira_detail TO service_role;


--
-- Name: TABLE hira_org; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hira_org TO service_role;


--
-- Name: TABLE hira_quota; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hira_quota TO service_role;


--
-- Name: TABLE hospitals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hospitals TO service_role;


--
-- Name: TABLE org_alias; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_alias TO service_role;


--
-- Name: TABLE org_note; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_note TO service_role;


--
-- Name: TABLE public_hospitals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.public_hospitals TO service_role;


--
-- Name: TABLE org_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_targets TO service_role;


--
-- Name: TABLE hira_todo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hira_todo TO service_role;


--
-- Name: TABLE home_blocks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.home_blocks TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.home_blocks TO authenticated;
GRANT ALL ON TABLE public.home_blocks TO service_role;


--
-- Name: SEQUENCE home_blocks_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.home_blocks_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.home_blocks_id_seq TO authenticated;


--
-- Name: TABLE home_texts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.home_texts TO anon;
GRANT SELECT ON TABLE public.home_texts TO authenticated;
GRANT ALL ON TABLE public.home_texts TO service_role;


--
-- Name: COLUMN home_texts.value; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(value) ON TABLE public.home_texts TO authenticated;


--
-- Name: COLUMN home_texts.updated_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(updated_at) ON TABLE public.home_texts TO authenticated;


--
-- Name: COLUMN home_texts.updated_by; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(updated_by) ON TABLE public.home_texts TO authenticated;


--
-- Name: TABLE hosp_kind_stat; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hosp_kind_stat TO service_role;


--
-- Name: TABLE hosp_sites; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.hosp_sites TO authenticated;
GRANT ALL ON TABLE public.hosp_sites TO service_role;


--
-- Name: SEQUENCE hospitals_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.hospitals_id_seq TO service_role;


--
-- Name: TABLE job_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.job_attachments TO anon;
GRANT SELECT ON TABLE public.job_attachments TO authenticated;
GRANT ALL ON TABLE public.job_attachments TO service_role;


--
-- Name: SEQUENCE job_attachments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.job_attachments_id_seq TO service_role;


--
-- Name: TABLE job_body; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_body TO service_role;


--
-- Name: TABLE job_post_edits; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT ON TABLE public.job_post_edits TO authenticated;
GRANT ALL ON TABLE public.job_post_edits TO service_role;


--
-- Name: TABLE job_edit_now; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_edit_now TO service_role;


--
-- Name: TABLE job_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT ON TABLE public.job_events TO anon;
GRANT INSERT ON TABLE public.job_events TO authenticated;
GRANT ALL ON TABLE public.job_events TO service_role;


--
-- Name: SEQUENCE job_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.job_events_id_seq TO anon;
GRANT SELECT,USAGE ON SEQUENCE public.job_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.job_events_id_seq TO service_role;


--
-- Name: TABLE job_hides; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.job_hides TO authenticated;
GRANT ALL ON TABLE public.job_hides TO service_role;


--
-- Name: TABLE job_meta; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.job_meta TO authenticated;
GRANT ALL ON TABLE public.job_meta TO service_role;


--
-- Name: TABLE job_org; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_org TO service_role;


--
-- Name: SEQUENCE job_post_edits_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.job_post_edits_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.job_post_edits_id_seq TO service_role;


--
-- Name: TABLE job_posts_pub; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_posts_pub TO service_role;


--
-- Name: TABLE job_stars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE ON TABLE public.job_stars TO authenticated;
GRANT ALL ON TABLE public.job_stars TO service_role;


--
-- Name: TABLE job_state_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.job_state_log TO authenticated;
GRANT ALL ON TABLE public.job_state_log TO service_role;


--
-- Name: SEQUENCE job_state_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.job_state_log_id_seq TO service_role;


--
-- Name: TABLE job_sync_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_sync_log TO service_role;


--
-- Name: SEQUENCE job_sync_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.job_sync_log_id_seq TO service_role;


--
-- Name: TABLE job_tab_cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.job_tab_cards TO anon;
GRANT SELECT ON TABLE public.job_tab_cards TO authenticated;
GRANT ALL ON TABLE public.job_tab_cards TO service_role;


--
-- Name: COLUMN job_tab_cards.image_path; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(image_path) ON TABLE public.job_tab_cards TO authenticated;


--
-- Name: COLUMN job_tab_cards.updated_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(updated_at) ON TABLE public.job_tab_cards TO authenticated;


--
-- Name: COLUMN job_tab_cards.updated_by; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(updated_by) ON TABLE public.job_tab_cards TO authenticated;


--
-- Name: TABLE job_trash; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_trash TO service_role;
GRANT SELECT,UPDATE ON TABLE public.job_trash TO authenticated;


--
-- Name: TABLE ltc_facilities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ltc_facilities TO service_role;


--
-- Name: SEQUENCE ltc_facilities_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ltc_facilities_id_seq TO service_role;


--
-- Name: TABLE mental_centers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mental_centers TO service_role;


--
-- Name: SEQUENCE mental_centers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mental_centers_id_seq TO service_role;


--
-- Name: TABLE notification_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.notification_settings TO authenticated;
GRANT ALL ON TABLE public.notification_settings TO service_role;


--
-- Name: TABLE ocr_zero; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ocr_zero TO service_role;


--
-- Name: SEQUENCE ocr_zero_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ocr_zero_id_seq TO service_role;


--
-- Name: TABLE site_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_state TO service_role;


--
-- Name: TABLE org_coverage; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_coverage TO service_role;


--
-- Name: TABLE welfare_centers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.welfare_centers TO anon;
GRANT SELECT ON TABLE public.welfare_centers TO authenticated;
GRANT ALL ON TABLE public.welfare_centers TO service_role;


--
-- Name: TABLE welfare_facilities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.welfare_facilities TO service_role;


--
-- Name: TABLE org_directory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_directory TO service_role;


--
-- Name: TABLE org_hospital_stat; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_hospital_stat TO service_role;


--
-- Name: TABLE org_group_mv; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_group_mv TO service_role;


--
-- Name: TABLE org_match_before; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_match_before TO service_role;


--
-- Name: TABLE org_stars; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.org_stars TO authenticated;
GRANT ALL ON TABLE public.org_stars TO service_role;


--
-- Name: TABLE page_hits; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT ON TABLE public.page_hits TO anon;
GRANT INSERT ON TABLE public.page_hits TO authenticated;
GRANT ALL ON TABLE public.page_hits TO service_role;


--
-- Name: SEQUENCE page_hits_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.page_hits_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.page_hits_id_seq TO anon;
GRANT SELECT,USAGE ON SEQUENCE public.page_hits_id_seq TO authenticated;


--
-- Name: TABLE post_images; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.post_images TO authenticated;
GRANT ALL ON TABLE public.post_images TO service_role;


--
-- Name: SEQUENCE post_images_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.post_images_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.post_images_id_seq TO service_role;


--
-- Name: TABLE post_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE ON TABLE public.post_likes TO authenticated;
GRANT ALL ON TABLE public.post_likes TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;


--
-- Name: COLUMN posts.hidden_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(hidden_at) ON TABLE public.posts TO authenticated;


--
-- Name: COLUMN posts.hidden_by; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(hidden_by) ON TABLE public.posts TO authenticated;


--
-- Name: SEQUENCE posts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.posts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.posts_id_seq TO service_role;


--
-- Name: SEQUENCE "회원번호_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."회원번호_seq" TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(id),INSERT(id) ON TABLE public.profiles TO authenticated;
GRANT SELECT(id) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.nickname; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(nickname),INSERT(nickname),UPDATE(nickname) ON TABLE public.profiles TO authenticated;
GRANT SELECT(nickname) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.job_group; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(job_group),UPDATE(job_group) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(avatar),INSERT(avatar),UPDATE(avatar) ON TABLE public.profiles TO authenticated;
GRANT SELECT(avatar) ON TABLE public.profiles TO anon;


--
-- Name: COLUMN profiles.terms_agreed_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(terms_agreed_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.terms_version; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(terms_version) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.role; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(role),UPDATE(role) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.erased_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(erased_at) ON TABLE public.profiles TO anon;
GRANT SELECT(erased_at) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE pub_baseline; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pub_baseline TO service_role;


--
-- Name: SEQUENCE public_hospitals_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.public_hospitals_id_seq TO service_role;


--
-- Name: TABLE push_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.push_devices TO authenticated;
GRANT ALL ON TABLE public.push_devices TO service_role;


--
-- Name: SEQUENCE push_devices_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.push_devices_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.push_devices_id_seq TO service_role;


--
-- Name: TABLE rejudge_hidden; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rejudge_hidden TO service_role;


--
-- Name: TABLE reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;


--
-- Name: SEQUENCE reports_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.reports_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.reports_id_seq TO service_role;


--
-- Name: TABLE rival_match; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rival_match TO service_role;


--
-- Name: TABLE rival_org_todo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rival_org_todo TO service_role;


--
-- Name: TABLE rival_post; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rival_post TO service_role;


--
-- Name: TABLE salary_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.salary_records TO authenticated;
GRANT ALL ON TABLE public.salary_records TO service_role;


--
-- Name: SEQUENCE salary_records_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.salary_records_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.salary_records_id_seq TO service_role;


--
-- Name: TABLE seen_postings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.seen_postings TO service_role;


--
-- Name: TABLE site_checks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_checks TO service_role;


--
-- Name: TABLE site_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.site_settings TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;


--
-- Name: TABLE spec_langs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.spec_langs TO authenticated;
GRANT ALL ON TABLE public.spec_langs TO service_role;


--
-- Name: SEQUENCE spec_langs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.spec_langs_id_seq TO service_role;


--
-- Name: SEQUENCE student_specs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.student_specs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.student_specs_id_seq TO service_role;


--
-- Name: TABLE ui_icons; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.ui_icons TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.ui_icons TO authenticated;
GRANT ALL ON TABLE public.ui_icons TO service_role;


--
-- Name: SEQUENCE welfare_centers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.welfare_centers_id_seq TO service_role;


--
-- Name: SEQUENCE welfare_facilities_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.welfare_facilities_id_seq TO service_role;


--
-- Name: TABLE wn_verdicts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.wn_verdicts TO authenticated;
GRANT ALL ON TABLE public.wn_verdicts TO service_role;


--
-- Name: TABLE "개인정보접속기록"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."개인정보접속기록" TO service_role;


--
-- Name: SEQUENCE "개인정보접속기록_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."개인정보접속기록_id_seq" TO service_role;


--
-- Name: TABLE "공개글"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공개글" TO service_role;
GRANT SELECT ON TABLE public."공개글" TO anon;
GRANT SELECT ON TABLE public."공개글" TO authenticated;


--
-- Name: TABLE "공개댓글"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공개댓글" TO service_role;
GRANT SELECT ON TABLE public."공개댓글" TO anon;
GRANT SELECT ON TABLE public."공개댓글" TO authenticated;


--
-- Name: TABLE "공고신고"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공고신고" TO service_role;


--
-- Name: SEQUENCE "공고신고_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."공고신고_id_seq" TO service_role;


--
-- Name: TABLE "공고올림"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공고올림" TO service_role;


--
-- Name: SEQUENCE "공고올림_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."공고올림_id_seq" TO service_role;


--
-- Name: TABLE "공고올림_도는것"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공고올림_도는것" TO service_role;


--
-- Name: TABLE "공고첨부"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공고첨부" TO service_role;


--
-- Name: SEQUENCE "공고첨부_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."공고첨부_id_seq" TO service_role;


--
-- Name: TABLE "공휴일"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."공휴일" TO service_role;


--
-- Name: TABLE "광고배너"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."광고배너" TO service_role;


--
-- Name: TABLE "광고셈"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."광고셈" TO service_role;


--
-- Name: TABLE "교육"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육" TO service_role;


--
-- Name: TABLE "교육과정"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육과정" TO service_role;


--
-- Name: SEQUENCE "교육과정_과정id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."교육과정_과정id_seq" TO service_role;


--
-- Name: TABLE "교육기관"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육기관" TO service_role;


--
-- Name: TABLE "교육기관알림"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육기관알림" TO service_role;


--
-- Name: SEQUENCE "교육기관알림_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."교육기관알림_id_seq" TO service_role;


--
-- Name: TABLE "교육리뷰"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육리뷰" TO service_role;


--
-- Name: SEQUENCE "교육리뷰_리뷰id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."교육리뷰_리뷰id_seq" TO service_role;


--
-- Name: TABLE "교육리뷰답글"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육리뷰답글" TO service_role;


--
-- Name: SEQUENCE "교육리뷰답글_답글id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."교육리뷰답글_답글id_seq" TO service_role;


--
-- Name: TABLE "교육신청"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육신청" TO service_role;


--
-- Name: SEQUENCE "교육신청_신청id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."교육신청_신청id_seq" TO service_role;


--
-- Name: TABLE "교육회차"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."교육회차" TO service_role;


--
-- Name: SEQUENCE "교육회차_회차id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."교육회차_회차id_seq" TO service_role;


--
-- Name: TABLE "권한"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."권한" TO service_role;


--
-- Name: SEQUENCE "권한_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."권한_id_seq" TO service_role;


--
-- Name: TABLE "권한기록"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."권한기록" TO service_role;


--
-- Name: SEQUENCE "권한기록_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."권한기록_id_seq" TO service_role;


--
-- Name: TABLE "기관"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."기관" TO service_role;
GRANT SELECT ON TABLE public."기관" TO authenticated;


--
-- Name: TABLE "기관이름줄임"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."기관이름줄임" TO service_role;


--
-- Name: TABLE "기관주소"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."기관주소" TO service_role;


--
-- Name: TABLE "기관지역"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."기관지역" TO service_role;


--
-- Name: SEQUENCE "담당자공고번호"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."담당자공고번호" TO service_role;


--
-- Name: TABLE "대화차단"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."대화차단" TO service_role;


--
-- Name: TABLE "마스터페르소나"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."마스터페르소나" TO service_role;


--
-- Name: TABLE "묶지않음"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."묶지않음" TO service_role;


--
-- Name: TABLE "봉사모집"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."봉사모집" TO service_role;


--
-- Name: TABLE "봉사처"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."봉사처" TO service_role;


--
-- Name: TABLE "수집기짝"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."수집기짝" TO service_role;


--
-- Name: TABLE "수집판정"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."수집판정" TO service_role;


--
-- Name: TABLE "시군광역"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."시군광역" TO service_role;


--
-- Name: TABLE "시군구시도"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."시군구시도" TO service_role;


--
-- Name: TABLE "심평원인원월별"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."심평원인원월별" TO service_role;


--
-- Name: TABLE "알리오자리같음"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."알리오자리같음" TO service_role;


--
-- Name: TABLE "알리오직군고침"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."알리오직군고침" TO service_role;


--
-- Name: TABLE "알림기기"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."알림기기" TO service_role;


--
-- Name: SEQUENCE "알림기기_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."알림기기_id_seq" TO service_role;


--
-- Name: TABLE "알림보낸것"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."알림보낸것" TO service_role;


--
-- Name: SEQUENCE "알림보낸것_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."알림보낸것_id_seq" TO service_role;


--
-- Name: TABLE "알림함"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."알림함" TO service_role;


--
-- Name: SEQUENCE "알림함_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."알림함_id_seq" TO service_role;


--
-- Name: TABLE "애플연결"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."애플연결" TO service_role;


--
-- Name: TABLE "약관동의"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."약관동의" TO service_role;


--
-- Name: SEQUENCE "약관동의_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."약관동의_id_seq" TO service_role;


--
-- Name: TABLE "운영진글"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."운영진글" TO service_role;


--
-- Name: TABLE "인증자료"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."인증자료" TO service_role;


--
-- Name: SEQUENCE "인증자료_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."인증자료_id_seq" TO service_role;


--
-- Name: TABLE "인증자료열람"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."인증자료열람" TO service_role;


--
-- Name: SEQUENCE "인증자료열람_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."인증자료열람_id_seq" TO service_role;


--
-- Name: TABLE "재직인증"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."재직인증" TO service_role;


--
-- Name: SEQUENCE "재직인증_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."재직인증_id_seq" TO service_role;


--
-- Name: TABLE "청년정책"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."청년정책" TO service_role;


--
-- Name: TABLE "칸기록"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."칸기록" TO service_role;


--
-- Name: SEQUENCE "칸기록_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."칸기록_id_seq" TO service_role;


--
-- Name: TABLE "함수사본"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."함수사본" TO service_role;


--
-- Name: TABLE "회원자격"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."회원자격" TO service_role;


--
-- Name: SEQUENCE "회원자격_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public."회원자격_id_seq" TO service_role;


--
-- Name: TABLE "회원차단"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."회원차단" TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ImmsvCTde25aTP4aszAgRDdJKeLxvp3oeARugvocnGWlVhl30RQK4yCvylFNrLL

