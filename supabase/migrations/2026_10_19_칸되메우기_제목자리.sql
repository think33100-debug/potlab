-- `칸되메우기` 에 **title 자리**를 더합니다 (2026-10-19 세중님 3번)
--   「창구에 title 자리 더하기(ACL 전후 같게)」
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- 워크넷 **목록** API 가 제목을 30자로 자릅니다. 회원이 공고에서 보는
-- 「기관 원문 제목」 칸이 96건 「…」 로 끝납니다. **상세** API 의
-- `<wantedTitle>` 에 온전한 제목이 있습니다.
--
-- ★ 제목은 **함부로 덮지 않습니다.** 공고를 가리키는 얼굴이고, 엉뚱한
--   제목이 들어가면 회원이 다른 공고로 읽습니다. 그래서 두 가지를 봅니다 —
--     ㉠ 지금 제목이 **잘려 있는가**(「...」·「…」 로 끝나는가)
--     ㉡ 새 제목이 **그 잘린 토막으로 시작하는가**(글자·숫자만 맞춰서)
--   ㉡ 가 authNo 를 잘못 짚었을 때의 그물입니다 — 다른 공고의 제목이면
--   앞 토막이 안 맞아 안 들어갑니다.
--
-- 판단은 `제목바꿀만한가()` 한 자리에 두고 거기에 자기점검을 붙입니다
-- (표를 건드리지 않고 검사할 수 있게 — 지침 6절).

/* 글자·숫자만 남깁니다 — 「&amp;」·띄어쓰기 차이를 넘기려고 (공고열쇠와 같은 손질)
   ★ 엔티티를 **먼저 풉니다.** 안 풀고 글자만 남기면 `&amp;` 가 **글자 `amp`** 로
     살아남아, 목록 API 가 준 제목(`&amp;`)과 상세 API 를 푼 제목(`&`)이
     갈립니다 — 2026-10-19 자기점검 ④ 가 이걸 잡았습니다.
     `&amp;` → `&` 를 **두 번** 합니다 (이 API 가 `&amp;amp;` 로 겹쳐 보냅니다) */
create or replace function 제목속글자(p text)
returns text language sql immutable as $fn$
  select regexp_replace(
           regexp_replace(
             replace(replace(coalesce(p, ''), '&amp;', '&'), '&amp;', '&'),
             '&(lt|gt|quot|nbsp|#[0-9]{1,5});', '', 'g'),
           '[^가-힣A-Za-z0-9]', '', 'g')
$fn$;

create or replace function 제목바꿀만한가(p_옛 text, p_새 text)
returns boolean language sql immutable as $fn$
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
     and length(새글자) > length(토막)   /* 더 긴 것이어야 바꿀 뜻이 있습니다 */
    from x
$fn$;

revoke execute on function 제목속글자(text) from public, anon, authenticated;
revoke execute on function 제목바꿀만한가(text, text) from public, anon, authenticated;
grant  execute on function 제목속글자(text) to service_role;
grant  execute on function 제목바꿀만한가(text, text) to service_role;

comment on function 제목바꿀만한가(text, text) is
  '잘린 제목을 온전한 제목으로 바꿔도 되는지 — 잘려 있고, 새 것이 그 토막으로 시작하고, 더 길 때만 (2026-10-19)';

-- ── 스스로 하는 검사 — 표를 건드리지 않습니다 ──────────────────
do $chk$
begin
  /* ★ 세중님 3번의 본래 일 — 30자에서 온전한 제목으로 */
  if not 제목바꿀만한가(
      '화성시장애아동재활센터 물리치료사 채용공고(대체인력...',
      '화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)') then
    raise exception '자기점검 ① 화성 공고의 온전한 제목을 막습니다';
  end if;

  /* ★ 그물 — authNo 를 잘못 짚어 **다른 공고**의 제목이 오면 안 들어갑니다 */
  if 제목바꿀만한가(
      '화성시장애아동재활센터 물리치료사 채용공고(대체인력...',
      '부민병원 작업치료사 모집 공고') then
    raise exception '자기점검 ② 엉뚱한 공고의 제목이 들어갑니다';
  end if;

  /* 지금 제목이 잘려 있지 않으면 **안 바꿉니다** (제목을 함부로 덮지 않기) */
  if 제목바꿀만한가('부민병원 물리치료사 모집', '부민병원 물리치료사 모집 (2차)') then
    raise exception '자기점검 ③ 잘리지도 않은 제목을 덮습니다';
  end if;

  /* 「&amp;amp;」·띄어쓰기 차이는 넘어갑니다 */
  if not 제목바꿀만한가(
      '전주 삼남재활의학과병원에서 신입 &amp; 경력 (작업...',
      '전주 삼남재활의학과병원에서 신입 & 경력 (작업치료사)선생님을 모집합니다.') then
    raise exception '자기점검 ④ 엔티티·띄어쓰기 차이에서 갈립니다';
  end if;

  /* 새 제목이 비면 안 바꿉니다 (빈 값으로 덮지 않기 — 지침) */
  if 제목바꿀만한가('무언가 긴 제목이 잘렸습니다...', '') then
    raise exception '자기점검 ⑤ 빈 제목으로 덮습니다';
  end if;
  if 제목바꿀만한가('무언가 긴 제목이 잘렸습니다...', null) then
    raise exception '자기점검 ⑥ null 로 덮습니다';
  end if;

  /* 토막이 짧으면 안 바꿉니다 — 아무 제목이나 맞아 버립니다 */
  if 제목바꿀만한가('공고...', '공고 아무거나 긴 것') then
    raise exception '자기점검 ⑦ 토막이 짧은데 바꿉니다';
  end if;

  /* 같은 토막이지만 더 길지 않으면 바꿀 뜻이 없습니다 */
  if 제목바꿀만한가('화성시장애아동재활센터 물리치료사...', '화성시장애아동재활센터 물리치료사') then
    raise exception '자기점검 ⑧ 더 짧아지는 쪽으로 바꿉니다';
  end if;

  /* `&amp;amp;` 겹침도 같은 자리로 모입니다 */
  if 제목속글자('신입 &amp;amp; 경력') <> 제목속글자('신입 & 경력') then
    raise exception '자기점검 ⑨ &amp;amp; 겹침이 안 풀립니다';
  end if;
  if 제목속글자('가&nbsp;나') <> '가나' then
    raise exception '자기점검 ⑩ &nbsp; 가 글자로 남습니다';
  end if;

  raise notice '제목바꿀만한가 자기점검 10가지 통과';
end
$chk$;
