-- 화면이 쓸 **id 로 출처를 가리는 짝 함수** (2026-10-19 세중님 ㉠)
--
-- `job_one`·`job_list` 는 `job_posts_pub` 에서 읽는데 **그 뷰에 `source` 칸이
-- 없습니다**(찍어 확인했습니다). `job_one` 주석에도 이미 적혀 있습니다 —
-- 「돌려주는 칸에 source 를 더하려면 함수를 drop 했다 다시 만들어야 해서(승인 창)
--  … id 로 가립니다」. 같은 길을 씁니다.
--
-- ★ **데이터로 확인했습니다** (2026-10-19 · job_posts 2,657건 전부) —
--     AL   62건 · AL2 483건  → **id 가 숫자만** (알리오가 recrutPblntSn 을 그대로 씁니다)
--     그 밖 11가지 출처 전부 → **글자로 시작** (HS·WN·GJ·CE·ND·JF·BIZ…)
--   그래서 「id 가 숫자만이면 알리오」가 맞습니다. 짐작이 아닙니다.

create or replace function 기관이름보정_아이디로(p_id text, p_기관 text, p_제목 text)
returns text language sql immutable as $fn$
  select 기관이름보정(
    case when coalesce(p_id, '') ~ '^[0-9]+$' then 'AL2' else '그밖' end,
    p_기관, p_제목)
$fn$;

revoke execute on function 기관이름보정_아이디로(text, text, text) from public;
grant  execute on function 기관이름보정_아이디로(text, text, text) to anon, authenticated, service_role;

comment on function 기관이름보정_아이디로(text, text, text) is
  'job_posts_pub 에 source 칸이 없어 id 로 출처를 가립니다 — AL·AL2 는 id 가 숫자만입니다(데이터로 확인) (2026-10-19)';

do $chk$
begin
  if 기관이름보정_아이디로('306122', '한국보훈복지의료공단',
       '[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용 공고')
     <> '광주보훈병원' then
    raise exception '자기점검 ① 숫자 id(알리오)를 못 가립니다';
  end if;
  if 기관이름보정_아이디로('HS190712781', '한국보훈복지의료공단', '[광주보훈병원] 작업치료사 채용')
     <> '한국보훈복지의료공단' then
    raise exception '자기점검 ② HS 공고의 이름을 바꿉니다';
  end if;
  if 기관이름보정_아이디로('WNK120032609220013', '한국보훈복지의료공단', '[광주보훈병원] 채용')
     <> '한국보훈복지의료공단' then
    raise exception '자기점검 ③ WN 공고의 이름을 바꿉니다';
  end if;
  if 기관이름보정_아이디로(null, '어느기관', null) <> '어느기관' then
    raise exception '자기점검 ④ 빈 id 에서 엉뚱한 값을 냅니다';
  end if;
  raise notice '기관이름보정_아이디로 자기점검 4가지 통과';
end
$chk$;
