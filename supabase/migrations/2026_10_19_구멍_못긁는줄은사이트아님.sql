-- `일층병원_구멍()` — **못 긁는 줄은 「사이트있음」으로 세지 않습니다**
--   (2026-10-19 세중님 ㉯ⓑ 승인)
--
-- ── 무슨 일 ──────────────────────────────────────────────────────
-- `hosp_sites` 표에 이름만 있고 **주소가 없는 줄이 17개** 있습니다. 그 함수는
-- 「표에 이름이 있으면 사이트있음」 으로 보기 때문에, 그 17곳이 ① 셈에서
-- **빠져 있었습니다.**
--
-- 한 곳씩 확인했습니다 (2026-10-19) —
--   **15곳은 실제로 공고가 들어옵니다.** `kind` 가 `appsite`·`schmc`·`listjson`
--   으로 **다른 수집기**가 긁습니다 (부민 9건 · 아주대 7 · 분당서울대 19 ·
--   부산대 21 …). 이 곳들은 「공고만들어옴」으로 세면 맞습니다 — 세중님 ⓐ.
--
--   **2곳만 아무 데서도 안 긁습니다** — 세중님 ⓑ 에 해당합니다:
--     빛고을전남대학교병원 (appsite · 주소 없음 · 공고 0)
--     전북대학교병원       (appsite · 주소 없음 · 공고 0)
--   둘 다 `org_targets` 1층 대상이고 `커버리지분모 = true` 입니다.
--
-- ── 고치는 것 ────────────────────────────────────────────────────
-- `긁는곳` 에서 **주소가 없거나 끈 줄을 뺍니다.** 그러면 —
--   · 공고가 들어오는 15곳 → 「공고만들어옴」 (①에서 그대로 빠집니다)
--   · 안 긁는 2곳          → 「사각지대」   (①에 **들어옵니다**)
-- **지우지 않습니다.** 표는 그대로 두고 **세는 눈**만 고칩니다 (세중님 조건).
--
-- 미리 재 봤습니다 — 끈 줄 **0개** · 「주소 없고 공고도 없는 줄」 **2개**.
-- 그래서 ① 이 **457 → 459** 로 **늘어납니다**(정확해지는 쪽입니다).
--
-- ★ 본문에서 **`긁는곳` 한 토막만** 바꿉니다. 인수가 그대로라 같은 함수이고
--   ACL 은 안 바뀝니다 (지침 6-2).

do $한토막$
declare
  v_전 text;
  v_후 text;
  v_옛 text := $옛$  ), 긁는곳 as (
    select "견줄이름"(s.name) as k from hosp_sites s
    union$옛$;
  v_새 text := $새$  ), 긁는곳 as (
    /* ★ 2026-10-19 — **못 긁는 줄은 사이트로 안 봅니다.**
       주소가 없으면 수집기가 열 데가 없고, 끈 줄은 일부러 안 긁는 것입니다.
       그런 줄을 「사이트있음」 으로 세면 ① 에서 조용히 빠집니다 —
       빛고을전남대·전북대가 그렇게 빠져 있었습니다 (공고 0건).
       공고가 들어오는 곳은 아래 `들어온곳` 이 받으니 셈이 틀어지지 않습니다 */
    select "견줄이름"(s.name) as k from hosp_sites s
     where nullif(s.url, '') is not null
       and not coalesce(s."끔", false)
    union$새$;
begin
  select pg_get_functiondef(p.oid) into v_전
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '일층병원_구멍';
  if v_전 is null then raise exception '일층병원_구멍 이 없습니다'; end if;
  if position(v_옛 in v_전) = 0 then
    raise exception '바꿀 긁는곳 토막을 못 찾았습니다 — 본문이 제가 본 것과 다릅니다. 멈춥니다';
  end if;
  if (length(v_전) - length(replace(v_전, v_옛, ''))) / length(v_옛) <> 1 then
    raise exception '긁는곳 토막이 하나가 아닙니다 — 멈춥니다';
  end if;
  v_후 := replace(v_전, v_옛, v_새);
  execute v_후;
  raise notice '일층병원_구멍 의 긁는곳 한 토막을 바꿨습니다 (글자 % → %)', length(v_전), length(v_후);
end
$한토막$;

revoke execute on function "일층병원_구멍"() from public, anon, authenticated;
grant  execute on function "일층병원_구멍"() to service_role;

-- ── 스스로 하는 검사 ────────────────────────────────────────────
do $chk$
declare
  v text;
  v_사각 int;
  v_상급 jsonb;
begin
  select pg_get_functiondef(p.oid) into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '일층병원_구멍';
  if position('못 긁는 줄은 사이트로 안 봅니다' in v) = 0 then
    raise exception '자기점검 ① 고친 글이 본문에 없습니다';
  end if;

  /* ★ 그 두 곳이 이제 사각지대로 보여야 합니다 */
  select count(*) into v_사각
    from "일층병원_구멍"() g
   where g."기관" in ('빛고을전남대학교병원', '전북대학교병원')
     and g."상태" = '사각지대';
  if v_사각 <> 2 then
    raise exception '자기점검 ② 빛고을전남대·전북대가 사각지대로 안 보입니다 (본 것 %)', v_사각;
  end if;

  /* ★ 공고가 들어오는 15곳은 **사각지대가 아니어야** 합니다 */
  if exists (select 1 from "일층병원_구멍"() g
              where g."기관" in ('의료법인 인당의료재단 부민병원', '아주대학교병원',
                                 '분당서울대학교병원', '부산대학교병원',
                                 '의료법인 길의료재단 길병원')
                and g."상태" = '사각지대') then
    raise exception '자기점검 ③ 공고가 들어오는 곳이 사각지대로 빠졌습니다';
  end if;

  /* 전북대는 상급종합이라 그 목록에 들어와야 합니다 */
  select ("일층병원_구멍셈"())->'사각_상급종합' into v_상급;
  if not (v_상급 @> '["전북대학교병원"]'::jsonb) then
    raise exception '자기점검 ④ 사각_상급종합 에 전북대학교병원이 없습니다 — %', v_상급;
  end if;

  raise notice '일층병원_구멍 자기점검 4가지 통과';
end
$chk$;
