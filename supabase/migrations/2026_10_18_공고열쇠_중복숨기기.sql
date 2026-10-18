-- 공고 열쇠 정규화 + 중복 숨기기 (2026-10-18 세중님 3번 승인)
--
--   「id 는 그대로, 「같은 것으로 본다」만 더하기
--    (제목의 D-데이·(경력무관) 같은 꼬리 무시 · 주소 정규화).
--    기존 중복은 hidden_why='중복' · 마른 실행 목록 먼저」
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 공고ID 는 `기관|주소|제목` 해시입니다 (tools/collect-hosp.mjs:190).
-- 그래서 **원문 제목이 하루마다 바뀌면 같은 글이 새 공고로 들어옵니다.**
--   안동의료재단 `no=228` 한 글이 제목의 D-데이 때문에 9건
--     「방사선사 채용 D-8」 → D-7 → … → D-1 → (꼬리 없음)
--   한림병원 「재활도수치료센터 작업치료사 모집」 ↔ 「… (경력무관)」 2건
--   강진의료원 — 주소가 www 있는 꼴/없는 꼴로 갈려 2건 (hidden_why 7줄에 기록)
--
-- **공고ID 규칙은 안 건드립니다.** 건드리면 모든 번호가 바뀌어 새 공고가
-- 쏟아집니다 (collect-hosp.mjs 주석에 적힌 그대로). id 는 그대로 두고
-- 「같은 것으로 본다」 판정만 더합니다.
--
-- ── 열쇠는 세 토막 전부입니다 ────────────────────────────────────
--   기관키 | 주소키 | 제목키
-- 주소만으로 묶으면 **목록 주소를 담은 출처**에서 한 기관의 여러 공고가
-- 통째로 한 묶음이 됩니다. 제목까지 봐야 안전합니다. 제목이 크게 바뀐
-- 같은 공고는 안 잡히지만, 그쪽이 안전한 쪽입니다 (멀쩡한 공고를 숨기지 않음).

create or replace function 공고열쇠(p_기관 text, p_주소 text, p_제목 text)
returns text language sql immutable as $fn$
  select
    -- ① 기관 — 글자·숫자만
    regexp_replace(coalesce(p_기관, ''), '[^가-힣A-Za-z0-9]', '', 'g')
    || '|' ||
    -- ② 주소 — scheme · www · 끝 슬래시 · 대소문자를 맞춥니다
    regexp_replace(
      regexp_replace(lower(coalesce(p_주소, '')), '^https?://(www\.)?', ''),
      '/+$', '')
    || '|' ||
    -- ③ 제목 — D-데이·경력 꼬리를 떼고 글자·숫자만
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_제목, ''),
          '[\(\[]?[[:space:]]*[Dd][[:space:]]*-[[:space:]]*([Dd][Aa][Yy]|[0-9]+)[[:space:]]*[\)\]]?', '', 'g'),
        '[\(\[][[:space:]]*(경력[[:space:]]*무관|신입[[:space:]]*/?[[:space:]]*경력|신입|경력)[[:space:]]*[\)\]]', '', 'g'),
      '[^가-힣A-Za-z0-9]', '', 'g')
$fn$;

revoke execute on function 공고열쇠(text, text, text) from public, anon, authenticated;
grant  execute on function 공고열쇠(text, text, text) to service_role;

comment on function 공고열쇠(text, text, text) is
  '같은 공고인지 보는 열쇠 — 기관|주소|제목. 꼬리(D-데이·경력무관) 무시 · 주소 정규화. 공고ID 와는 별개입니다 (2026-10-18)';


-- ── 중복 숨기기 ──────────────────────────────────────────────────
-- 같은 열쇠인데 **회원 화면에 둘 이상 보이는** 묶음에서 한 줄만 남깁니다.
-- 남길 줄 고르는 순서 (2026-10-18 세중님 규칙)
--   ⓞ 관리자가 손댄 줄(admin_locked)이 있으면 그 줄
--   ① 기관 직접 출처 우선 (HS · HS3 · ND · ND2 — 기관 게시판을 직접 읽은 것)
--   ② 일곱 칸이 더 찬 쪽
--   ③ 같으면 먼저 들어온 쪽
-- 일곱 칸 중 **바쁜정도는 안 셉니다** — 기관 단위 자료(org_hospital_stat)라
-- 같은 묶음의 두 줄이 늘 같습니다. 승부에 영향이 없습니다.
--
-- `admin_locked` 인 줄은 **숨기지 않습니다.** `updated_at` 도 안 바꿉니다 (지침 9절).

create or replace function 중복숨기기(p_마른 boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $fn$
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
$fn$;

revoke execute on function 중복숨기기(boolean) from public, anon, authenticated;
grant  execute on function 중복숨기기(boolean) to service_role;

comment on function 중복숨기기(boolean) is
  '같은 공고가 회원 화면에 둘 이상 보이면 한 줄만 남기고 hidden_why=「중복」 으로 숨깁니다. 기본은 마른 실행 (2026-10-18)';


-- ── 스스로 하는 검사 ────────────────────────────────────────────
-- 세중님이 요구한 견본 셋 — 안동 9건(D-데이) · 한림((경력무관)) · 강진(www)
do $chk$
declare
  v text;
begin
  -- ① 안동 꼴 — 제목의 D-데이 꼬리만 다른 같은 글
  if 공고열쇠('안동의료재단', 'https://andong.co.kr/b/view?no=228', '[안동의료재단] 방사선사 채용 D-8')
  <> 공고열쇠('안동의료재단', 'https://andong.co.kr/b/view?no=228', '[안동의료재단] 방사선사 채용 D-1') then
    raise exception '자기점검 ① 안동 D-데이 꼴이 갈립니다';
  end if;
  if 공고열쇠('안동의료재단', 'https://andong.co.kr/b/view?no=228', '[안동의료재단] 방사선사 채용 D-8')
  <> 공고열쇠('안동의료재단', 'https://andong.co.kr/b/view?no=228', '[안동의료재단] 방사선사 채용') then
    raise exception '자기점검 ① 꼬리 없는 제목과 갈립니다';
  end if;

  -- ② 한림 꼴 — (경력무관) 꼬리
  if 공고열쇠('한림병원', 'https://hallym.kr/bbs/view?id=7', '재활도수치료센터 작업치료사 모집')
  <> 공고열쇠('한림병원', 'https://hallym.kr/bbs/view?id=7', '재활도수치료센터 작업치료사 모집 (경력무관)') then
    raise exception '자기점검 ② 한림 (경력무관) 꼴이 갈립니다';
  end if;

  -- ③ 강진 꼴 — www 유무 · http/https · 끝 슬래시
  if 공고열쇠('강진의료원', 'https://www.gjmc.or.kr/board/view.do?no=18', '물리치료사 채용')
  <> 공고열쇠('강진의료원', 'http://gjmc.or.kr/board/view.do?no=18/', '물리치료사 채용') then
    raise exception '자기점검 ③ 강진 www 꼴이 갈립니다';
  end if;

  -- ④ **다른 공고는 갈려야 합니다** — 같은 주소라도 제목이 다르면 다른 공고
  if 공고열쇠('어느병원', 'https://a.kr/list', '물리치료사 채용')
   = 공고열쇠('어느병원', 'https://a.kr/list', '작업치료사 채용') then
    raise exception '자기점검 ④ 제목이 다른데 같은 공고로 봅니다 — 목록 주소 출처가 통째로 묶입니다';
  end if;

  -- ⑤ 기관이 다르면 갈려야 합니다
  if 공고열쇠('가병원', 'https://a.kr/v?no=1', '물리치료사 채용')
   = 공고열쇠('나병원', 'https://a.kr/v?no=1', '물리치료사 채용') then
    raise exception '자기점검 ⑤ 기관이 다른데 같은 공고로 봅니다';
  end if;

  -- ⑥ 「D-」 가 아닌 글자는 안 떼야 합니다 (「3D」·「DAY」 같은 것)
  v := 공고열쇠('가병원', '', '3D 영상실 채용');
  if v = 공고열쇠('가병원', '', '영상실 채용') then
    raise exception '자기점검 ⑥ 「3D」 의 D 를 꼬리로 떼었습니다';
  end if;

  -- ⑦ 꼬리가 가운데 있어도 떼야 합니다 (제목 끝이 아닌 자리)
  if 공고열쇠('가병원', '', '물리치료사(경력무관) 채용 공고')
  <> 공고열쇠('가병원', '', '물리치료사 채용 공고') then
    raise exception '자기점검 ⑦ 가운데 (경력무관) 을 안 떼었습니다';
  end if;

  raise notice '자기점검 7가지 통과';
end
$chk$;
