-- ㉤ 대괄호 안 **전체**를 기관 이름으로 · 중복은 **둘 다**로 견줍니다
--   (2026-10-19 세중님 ㉤ 승인)
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 근로복지공단 공고에 이런 제목이 있습니다 —
--   「[인천병원(서울의원)] 공무직(물리작업치료사) 채용 공고」
-- 전 판의 `제목속병원()` 은 닫는 대괄호 **바로 앞**이 「병원」이어야 해서
-- 이것을 못 잡았습니다.
--
-- ★ 세중님 — **앞만 떼지 말 것.** 괄호 안이 따로 있는 **의원·분원**일 수 있어
--   앞만 쓰면 **근무지가 틀어집니다.** 대괄호 안 **전체**를 기관 이름으로 씁니다.
-- ★ 중복 판정은 **앞 이름·전체 이름 둘 다**로 견줍니다 — 다른 출처가
--   「인천병원」으로만 적을 수도 있습니다.
--
-- ── 함수 셋 ──────────────────────────────────────────────────────
--   제목속병원(제목)      대괄호 안 **전체** (「인천병원(서울의원)」)
--   제목속병원_앞(제목)   괄호 앞만       (「인천병원」)  ← 견주기용
--   기관이름보정(…)       화면·중복이 쓰는 이름 = 제목속병원(전체)

create or replace function 제목속병원(p_제목 text)
returns text language sql immutable as $fn$
  /* 제목 맨 앞의 「[…]」 안을 **그대로** 씁니다. 다만 —
       · 「병원·의료원·센터」 가 안 들어 있으면 기관 이름이 아닙니다
       · 「소속·전체·각 병원·산하·공동」 은 **뭉뚱그린 말**이라 안 씁니다 */
  select case
    when v is null then null
    when v !~ '(병원|의료원|센터)' then null
    when v ~ '(소속|전체|각\s*병원|산하|공동)' then null
    else btrim(v) end
  from (select (regexp_match(coalesce(p_제목, ''), '^\[([^\]]{2,40})\]'))[1] as v) t
$fn$;

create or replace function 제목속병원_앞(p_제목 text)
returns text language sql immutable as $fn$
  /* 전체 이름에서 **괄호 앞**만 — 견주기에만 씁니다 (화면에는 전체를 씁니다) */
  select nullif(btrim(regexp_replace(제목속병원(p_제목), '\s*[\(（].*$', '')), '')
$fn$;

revoke execute on function 제목속병원(text) from public, anon, authenticated;
revoke execute on function 제목속병원_앞(text) from public, anon, authenticated;
grant  execute on function 제목속병원(text) to service_role;
grant  execute on function 제목속병원_앞(text) to service_role;
/* `기관이름보정` 이 비로그인 화면(job_one)에서도 불리므로 그 짝 권한은 그대로 둡니다 */

comment on function 제목속병원(text) is
  '제목 맨 앞 「[…]」 안을 그대로 (괄호 포함) — 앞만 떼면 분원·의원이 틀어집니다 (2026-10-19 세중님 ㉤)';

-- ── 스스로 하는 검사 ────────────────────────────────────────────
do $chk$
begin
  /* ★ 괄호가 든 것 — **전체**를 씁니다 */
  if 제목속병원('[인천병원(서울의원)] 공무직(물리작업치료사) 채용 공고')
     <> '인천병원(서울의원)' then
    raise exception '자기점검 ① 괄호 전체를 안 씁니다 — %',
      제목속병원('[인천병원(서울의원)] 공무직(물리작업치료사) 채용 공고');
  end if;
  if 제목속병원_앞('[인천병원(서울의원)] 공무직 채용') <> '인천병원' then
    raise exception '자기점검 ② 앞 이름을 못 뗍니다 — %',
      제목속병원_앞('[인천병원(서울의원)] 공무직 채용');
  end if;

  /* 괄호가 없으면 전체 = 앞 */
  if 제목속병원('[광주보훈병원] 계약직 보건직(작업치료사) 채용') <> '광주보훈병원'
     or 제목속병원_앞('[광주보훈병원] 계약직 보건직(작업치료사) 채용') <> '광주보훈병원' then
    raise exception '자기점검 ③ 괄호 없는 이름이 틀립니다';
  end if;

  /* ★ 뭉뚱그린 말은 안 씁니다 */
  if 제목속병원('[근로복지공단 소속병원] 간호사 채용') is not null then
    raise exception '자기점검 ④ 「소속병원」 을 씁니다';
  end if;

  /* 병원·의료원·센터가 없으면 기관 이름이 아닙니다 */
  if 제목속병원('[공고] 물리치료사 채용') is not null then
    raise exception '자기점검 ⑤ 「[공고]」 를 기관으로 씁니다';
  end if;
  if 제목속병원('[2026-41호] 작업치료사 채용') is not null then
    raise exception '자기점검 ⑥ 「[2026-41호]」 를 기관으로 씁니다';
  end if;

  /* 보정 함수가 전체 이름을 냅니다 */
  if 기관이름보정('AL', '근로복지공단', '[인천병원(서울의원)] 공무직(물리작업치료사) 채용 공고')
     <> '인천병원(서울의원)' then
    raise exception '자기점검 ⑦ 보정이 전체 이름을 안 냅니다';
  end if;
  /* 다른 출처는 그대로 */
  if 기관이름보정('HS3', '근로복지공단', '[인천병원(서울의원)] 공무직 채용') <> '근로복지공단' then
    raise exception '자기점검 ⑧ HS3 인데 이름을 바꿉니다';
  end if;

  /* 빈 값 */
  if 제목속병원(null) is not null or 제목속병원_앞(null) is not null then
    raise exception '자기점검 ⑨ 빈 값에서 엉뚱한 값을 냅니다';
  end if;

  raise notice '제목속병원(괄호 전체) 자기점검 9가지 통과';
end
$chk$;
