-- 여러 병원을 거느린 공단·법인 공고는 **제목의 「[OO병원]」을 기관으로** 봅니다
--   (2026-10-19 세중님 ㉠ 승인 — 「좁게 넓힘」)
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 같은 공고가 알리오(AL2)와 병원 홈페이지(HS3)로 들어오면 기관 이름이 달라
-- 중복으로 안 묶입니다 —
--   306122[AL2]      기관 「한국보훈복지의료공단」  제목 「[광주보훈병원] 계약직 …」
--   HS190712781[HS3] 기관 「광주보훈병원」          제목 「[광주보훈병원] 계약직 …」
-- `견줄이름` 이 다르니 `출처다른중복` 이 못 봅니다.
--
-- ── 어디까지 넓히나 (세중님 조건 그대로) ─────────────────────────
--   · **출처가 AL·AL2 일 때만**
--   · **여러 병원을 거느린 공단·법인일 때만** — 목록을 **한 자리**에 둡니다
--   · 그 목록은 **실제 데이터에서 찾은 것만** 입니다 (2026-10-19 에 셌습니다) —
--       한국보훈복지의료공단   11건 · 4곳 (광주·대전·부산·중앙보훈병원)
--       근로복지공단          43건 · 12곳 (울산·대구·대전·동해·순천·안산·
--                                          인천·정선·창원·태백·경기요양·태백요양)
--       경상국립대학교병원     28건 · 1곳 (창원경상국립대학교병원)
--     ※ 세중님이 예로 드신 「한국원자력의학원」 은 제목에 「[OO병원]」 꼴이
--       **없어서** 넣지 않았습니다 — 짐작으로 넣지 않습니다.
--   · 다른 출처·다른 꼴은 **그대로** 둡니다.
--
-- ★ 「[근로복지공단 소속병원]」 처럼 **뭉뚱그린 말**은 기관으로 쓰지 않습니다 —
--   어느 병원인지 모르는 이름입니다.

create or replace function 여러병원거느린곳(p_기관 text)
returns boolean language sql immutable as $fn$
  /* 목록은 **여기 한 자리**입니다. 늘릴 때는 실제 데이터를 먼저 세고 늘립니다 */
  select 견줄이름(coalesce(p_기관, '')) in (
    견줄이름('한국보훈복지의료공단'),
    견줄이름('근로복지공단'),
    견줄이름('경상국립대학교병원')
  )
$fn$;

create or replace function 제목속병원(p_제목 text)
returns text language sql immutable as $fn$
  /* 제목 맨 앞의 「[OO병원]」 만 봅니다. 뭉뚱그린 말은 안 씁니다 */
  select case
    when v ~ '(소속|전체|각\s*병원|산하|공동)' then null
    else v end
  from (select (regexp_match(coalesce(p_제목, ''), '^\[([^\]]{2,20}(?:병원|의료원|센터))\]'))[1] as v) t
$fn$;

/** 화면과 중복 판정이 **같이** 쓰는 기관 이름 — 기준은 이 한 자리입니다 */
create or replace function 기관이름보정(p_source text, p_기관 text, p_제목 text)
returns text language sql immutable as $fn$
  select case
    when coalesce(p_source, '') in ('AL', 'AL2')
     and 여러병원거느린곳(p_기관)
     and 제목속병원(p_제목) is not null
    then 제목속병원(p_제목)
    else p_기관 end
$fn$;

revoke execute on function 여러병원거느린곳(text) from public, anon, authenticated;
revoke execute on function 제목속병원(text) from public, anon, authenticated;
revoke execute on function 기관이름보정(text, text, text) from public, anon, authenticated;
grant  execute on function 여러병원거느린곳(text) to service_role;
grant  execute on function 제목속병원(text) to service_role;
grant  execute on function 기관이름보정(text, text, text) to service_role;

comment on function 기관이름보정(text, text, text) is
  '여러 병원을 거느린 공단·법인의 AL·AL2 공고는 제목의 「[OO병원]」을 기관으로 봅니다 — 중복 판정과 화면이 같이 씁니다 (2026-10-19)';

-- ── 스스로 하는 검사 ────────────────────────────────────────────
do $chk$
begin
  /* ★ 광주보훈 — 둘이 같은 기관으로 보여야 합니다 */
  if 견줄이름(기관이름보정('AL2', '한국보훈복지의료공단',
        '[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용 공고'))
  <> 견줄이름('광주보훈병원') then
    raise exception '자기점검 ① 광주보훈이 안 맞춰집니다';
  end if;

  /* 근로복지공단 — 13곳 중 둘로 */
  if 기관이름보정('AL', '근로복지공단', '[태백병원] 간호사 채용') <> '태백병원' then
    raise exception '자기점검 ② 근로복지공단 태백병원이 안 맞춰집니다';
  end if;
  if 기관이름보정('AL2', '경상국립대학교병원', '[창원경상국립대학교병원] 약무직 채용 공고')
     <> '창원경상국립대학교병원' then
    raise exception '자기점검 ③ 창원경상국립대가 안 맞춰집니다';
  end if;

  /* ★★ 출처가 AL·AL2 가 **아니면** 손대지 않습니다 ★★ */
  if 기관이름보정('HS3', '한국보훈복지의료공단', '[광주보훈병원] 작업치료사 채용')
     <> '한국보훈복지의료공단' then
    raise exception '자기점검 ④ HS3 인데 이름을 바꿉니다';
  end if;
  if 기관이름보정('WN2', '한국보훈복지의료공단', '[광주보훈병원] 작업치료사 채용')
     <> '한국보훈복지의료공단' then
    raise exception '자기점검 ⑤ WN2 인데 이름을 바꿉니다';
  end if;

  /* ★★ 목록에 없는 기관은 손대지 않습니다 ★★ */
  if 기관이름보정('AL2', '대한적십자사', '[통영적십자병원] 정규직 물리치료사 채용 공고')
     <> '대한적십자사' then
    raise exception '자기점검 ⑥ 목록에 없는 기관의 이름을 바꿉니다';
  end if;

  /* ★ 뭉뚱그린 말은 안 씁니다 */
  if 제목속병원('[근로복지공단 소속병원] 간호사 채용') is not null then
    raise exception '자기점검 ⑦ 「소속병원」 을 기관으로 씁니다';
  end if;
  if 기관이름보정('AL', '근로복지공단', '[근로복지공단 소속병원] 간호사 채용')
     <> '근로복지공단' then
    raise exception '자기점검 ⑧ 뭉뚱그린 제목인데 이름을 바꿉니다';
  end if;

  /* 제목에 「[…]」 가 없으면 그대로 */
  if 기관이름보정('AL2', '한국보훈복지의료공단', '2027년 보훈병원 간호직 통합 공개채용 공고')
     <> '한국보훈복지의료공단' then
    raise exception '자기점검 ⑨ 대괄호가 없는데 이름을 바꿉니다';
  end if;

  /* 빈 값에 안 터집니다 */
  if 기관이름보정(null, null, null) is not null then
    raise exception '자기점검 ⑩ 빈 값에서 엉뚱한 값을 냅니다';
  end if;

  raise notice '기관이름보정 자기점검 10가지 통과';
end
$chk$;
