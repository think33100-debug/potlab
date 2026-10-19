-- 출처가 다른 **같은 공고**를 좁게 묶습니다 (2026-10-19 세중님 ㉠ 승인)
--
-- ── 무슨 일 ──────────────────────────────────────────────────────
-- `공고열쇠` 는 **기관|주소|제목** 입니다. 같은 공고가 다른 출처로 들어오면
-- 기관 이름과 주소가 달라 **열쇠가 안 맞아** 회원 화면에 둘 다 뜹니다 —
--
--   성남시의료원  CE80464[CE2]  +  HS726356583[HS3]   제목이 글자까지 같습니다
--   광주보훈병원  306122[AL2]   +  HS190712781[HS3]   제목 끝만 다릅니다
--
-- ── 세중님이 정한 규칙 (그대로) ──────────────────────────────────
--   같은 기관(견줄이름) **AND** 같은 제목열쇠 **AND** (마감일 같음 **OR** 한쪽 빔)
--   남길 쪽 = **일곱 칸이 더 찬 쪽**, 같으면 **기관 직접 출처**
--
-- ★ 좁게 거는 까닭 — 제목만으로 묶으면 「물리치료사 모집」을 쓰는 **서로 다른
--   요양원** 8묶음이 사라집니다(2026-10-19 에 세어 봤습니다). 그래서 **기관이
--   같아야** 하고 **마감일이 어긋나면 안 묶습니다.**
--
-- ★ `중복숨기기` 는 안 건드립니다 — 그쪽은 **같은 열쇠**를 묶는 자리입니다.
--   이것은 **출처가 다른** 짝을 묶는 **딴 함수**입니다 (기준을 섞지 않습니다).

/* 제목열쇠 — 글자·숫자만. `공고열쇠` 의 제목 토막과 같은 손질입니다.
 *
 * ★ 꼬리말은 **되풀이해** 뗍니다. 한 번만 떼면
 *     「… 직원 채용 공고」 → 「… 직원 채용」
 *     「… 직원 채용」      → 「… 직원」
 *   으로 **갈립니다** (2026-10-19 자기점검 ② 가 잡았습니다 — 광주보훈 짝).
 *   PostgreSQL 에 되풀이 치환이 없어 **세 번 겹칩니다** — 「채용 모집 공고」
 *   처럼 셋까지 붙은 꼴을 봤기 때문입니다. */
create or replace function 꼬리말떼기(p text)
returns text language sql immutable as $fn$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p, ''),
               '[[:space:]]*(재공고|공고|채용공고|모집공고|채용|모집|안내)[[:space:]]*$', ''),
             '[[:space:]]*(재공고|공고|채용공고|모집공고|채용|모집|안내)[[:space:]]*$', ''),
           '[[:space:]]*(재공고|공고|채용공고|모집공고|채용|모집|안내)[[:space:]]*$', '')
$fn$;

create or replace function 제목열쇠(p_제목 text)
returns text language sql immutable as $fn$
  select 제목속글자(꼬리말떼기(
    regexp_replace(coalesce(p_제목, ''),
      '[\(\[]?[[:space:]]*[Dd][[:space:]]*-[[:space:]]*([Dd][Aa][Yy]|[0-9]+)[[:space:]]*[\)\]]?', '', 'g')))
$fn$;

/* 일곱 칸이 몇 개 찼나 — 남길 쪽을 고르는 데 씁니다 */
create or replace function 일곱칸찬수(p_id text)
returns int language sql stable as $fn$
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
$fn$;

create or replace function 출처다른중복(p_마른 boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
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
             견줄이름(p.org_name) as 기관열쇠, 제목열쇠(p.title) as 제목키,
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
        on a.기관열쇠 = b.기관열쇠
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
$fn$;

revoke execute on function 꼬리말떼기(text) from public, anon, authenticated;
grant  execute on function 꼬리말떼기(text) to service_role;
revoke execute on function 제목열쇠(text) from public, anon, authenticated;
revoke execute on function 일곱칸찬수(text) from public, anon, authenticated;
revoke execute on function 출처다른중복(boolean) from public, anon, authenticated;
grant  execute on function 제목열쇠(text) to service_role;
grant  execute on function 일곱칸찬수(text) to service_role;
grant  execute on function 출처다른중복(boolean) to service_role;

comment on function 출처다른중복(boolean) is
  '출처가 다른 같은 공고를 좁게 묶어 한쪽을 숨깁니다 — 같은 기관 AND 같은 제목열쇠 AND (마감일 같음 OR 한쪽 빔) · 남길 쪽은 칸이 더 찬 쪽, 같으면 기관 직접 출처 (2026-10-19)';

-- ── 스스로 하는 검사 — 표를 건드리지 않습니다 ──────────────────
do $chk$
begin
  /* ★ 성남시의료원 — 제목이 글자까지 같습니다 */
  if 제목열쇠('2026년 제13회 성남시의료원 직원 채용 모집 공고')
  <> 제목열쇠('2026년 제13회 성남시의료원 직원 채용 모집 공고') then
    raise exception '자기점검 ① 같은 제목이 갈립니다';
  end if;

  /* ★ 광주보훈 — 제목 끝의 「공고」만 다릅니다 */
  if 제목열쇠('[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용 공고')
  <> 제목열쇠('[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용') then
    raise exception '자기점검 ② 끝의 「공고」 때문에 갈립니다';
  end if;

  /* ★★ 서로 다른 요양원의 「물리치료사 모집」은 **묶이면 안 됩니다** —
     제목열쇠는 같지만 **기관이 다릅니다.** 함수가 기관열쇠를 함께 보므로
     안 묶입니다. 여기서는 기관열쇠가 정말 다른지 봅니다 */
  if 견줄이름('밝은집요양원') = 견줄이름('태조요양원') then
    raise exception '자기점검 ③ 다른 요양원의 기관열쇠가 같습니다';
  end if;
  if 견줄이름('새청주 요양원') = 견줄이름('간호재활요양원') then
    raise exception '자기점검 ④ 다른 요양원의 기관열쇠가 같습니다';
  end if;

  /* 토막이 짧은 제목은 길이 가드에 걸립니다 */
  if length(제목열쇠('모집 공고')) >= 10 then
    raise exception '자기점검 ⑤ 짧은 제목이 길이 가드를 넘습니다';
  end if;

  /* D-데이 꼬리는 무시합니다 (공고열쇠와 같은 손질) */
  if 제목열쇠('물리치료사 채용 공고 D-8') <> 제목열쇠('물리치료사 채용 공고') then
    raise exception '자기점검 ⑥ D-데이 꼬리에서 갈립니다';
  end if;

  /* 꼬리말이 **둘·셋** 붙어도 같은 자리로 모입니다 */
  if 꼬리말떼기('물리치료사 채용 모집 공고') <> 꼬리말떼기('물리치료사') then
    raise exception '자기점검 ⑦ 꼬리말 셋이 안 떨어집니다';
  end if;
  if 제목열쇠('성남시의료원 직원 채용 모집 공고') <> 제목열쇠('성남시의료원 직원') then
    raise exception '자기점검 ⑧ 꼬리말을 되풀이해 떼지 못합니다';
  end if;

  /* ★ 꼬리말을 떼도 **몸통이 다르면 갈립니다** — 다 떼서 비는 일이 없어야 합니다 */
  if 제목열쇠('물리치료사 채용 공고') = 제목열쇠('작업치료사 채용 공고') then
    raise exception '자기점검 ⑨ 직군이 다른데 같은 열쇠가 됩니다';
  end if;
  if length(제목열쇠('채용 공고')) > 0 then
    raise exception '자기점검 ⑩ 꼬리말만 있는 제목이 열쇠를 남깁니다 (길이 가드로 걸러집니다)';
  end if;

  raise notice '출처다른중복 자기점검 10가지 통과';
end
$chk$;
