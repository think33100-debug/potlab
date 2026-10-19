-- 워크넷은 **authNo(공고 번호)로** 같은 공고를 봅니다 (2026-10-19 세중님 2번)
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- `공고열쇠(기관, 주소, 제목)` 에 **제목이 들어갑니다.** 워크넷 목록 API 가
-- 제목을 30자로 자르고, 우리가 그것을 상세 API 의 온전한 제목으로 바꾸려
-- 하는데 — 그러면 **열쇠가 바뀌어 같은 공고가 둘로 보입니다.**
--
--   전  「화성시장애아동재활센터 물리치료사 채용공고(대체인력...」  (30자)
--   후  「화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)」 (31자)
--
-- 워크넷 주소에는 공고 번호가 그대로 있습니다 —
--   https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do
--     ?wantedAuthNo=**K180012610190008**&infoTypeCd=VALIDATION&…
--
-- 그 번호가 **공고 하나를 가리키는 공식 열쇠**입니다. 제목·주소 꼬리가
-- 어떻게 바뀌어도 번호가 같으면 같은 공고입니다. 그래서 워크넷이면
-- **번호만** 보고, 그 밖은 지금처럼 기관|주소|제목 세 토막을 봅니다.
--
-- ★ `공고ID` 는 건드리지 않습니다 (지침 — 건드리면 모든 번호가 바뀝니다).
--   「같은 것으로 본다」만 더하는 것입니다.

create or replace function 공고열쇠(p_기관 text, p_주소 text, p_제목 text)
returns text language sql immutable as $fn$
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
$fn$;

revoke execute on function 공고열쇠(text, text, text) from public, anon, authenticated;
grant  execute on function 공고열쇠(text, text, text) to service_role;

comment on function 공고열쇠(text, text, text) is
  '같은 공고인지 보는 열쇠 — 워크넷은 wantedAuthNo 하나로, 그 밖은 기관|주소|제목. 공고ID 와는 별개입니다 (2026-10-19)';

-- ── 스스로 하는 검사 ────────────────────────────────────────────
do $chk$
declare
  v_전 text := 'https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=K180012610190008&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet';
begin
  /* ★ 세중님 2번 — 제목이 30자에서 전체로 바뀌어도 **같은 공고** */
  if 공고열쇠('화성시장애아동재활센터', v_전, '화성시장애아동재활센터 물리치료사 채용공고(대체인력...')
  <> 공고열쇠('화성시장애아동재활센터', v_전, '화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)') then
    raise exception '자기점검 ① 제목이 바뀌면 다른 공고가 됩니다 — authNo 를 안 보고 있습니다';
  end if;

  /* 기관 이름이 달라져도 같은 공고 (워크넷은 번호가 공식 열쇠) */
  if 공고열쇠('화성시장애아동재활센터', v_전, '가')
  <> 공고열쇠('화성시 장애아동 재활센터', v_전, '나') then
    raise exception '자기점검 ② 워크넷인데 기관·제목을 보고 있습니다';
  end if;

  /* 주소 꼬리(infoTypeCd 등)가 달라도 같은 공고 */
  if 공고열쇠('가', 'https://www.work24.go.kr/x?wantedAuthNo=K1&a=1', '가')
  <> 공고열쇠('가', 'https://www.work24.go.kr/y?wantedAuthNo=K1&b=2', '나') then
    raise exception '자기점검 ③ 주소 꼬리가 다르면 다른 공고로 봅니다';
  end if;

  /* ★ **번호가 다르면 다른 공고** */
  if 공고열쇠('가', 'https://x/?wantedAuthNo=K1', '같은제목')
   = 공고열쇠('가', 'https://x/?wantedAuthNo=K2', '같은제목') then
    raise exception '자기점검 ④ 번호가 다른데 같은 공고로 봅니다';
  end if;

  /* 워크넷이 아닌 것은 전과 같이 (2026-10-18 자기점검을 그대로 다시) */
  if 공고열쇠('안동의료재단', 'https://andong.co.kr/b/view?no=228', '[안동의료재단] 방사선사 채용 D-8')
  <> 공고열쇠('안동의료재단', 'https://andong.co.kr/b/view?no=228', '[안동의료재단] 방사선사 채용') then
    raise exception '자기점검 ⑤ 안동 D-데이 꼴이 갈립니다';
  end if;
  if 공고열쇠('강진의료원', 'https://www.gjmc.or.kr/board/view.do?no=18', '물리치료사 채용')
  <> 공고열쇠('강진의료원', 'http://gjmc.or.kr/board/view.do?no=18/', '물리치료사 채용') then
    raise exception '자기점검 ⑥ 강진 www 꼴이 갈립니다';
  end if;
  if 공고열쇠('어느병원', 'https://a.kr/list', '물리치료사 채용')
   = 공고열쇠('어느병원', 'https://a.kr/list', '작업치료사 채용') then
    raise exception '자기점검 ⑦ 워크넷이 아닌데 제목을 안 봅니다';
  end if;

  /* 「wantedAuthNo=」 만 있고 값이 없으면 워크넷 길로 가지 않습니다 */
  if 공고열쇠('가', 'https://x/?wantedAuthNo=', '제목하나') ~ '^워크넷\|' then
    raise exception '자기점검 ⑧ 번호가 빈 주소를 워크넷으로 봅니다';
  end if;

  raise notice '자기점검 8가지 통과 (워크넷 authNo 4가지 + 그 밖 4가지)';
end
$chk$;
