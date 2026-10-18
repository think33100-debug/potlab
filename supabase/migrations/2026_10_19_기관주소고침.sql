-- 고친 기관 주소 — **우리 표**에 둡니다 (2026-10-19 세중님 3번 결정)
--
--   「우리 표 쪽 칸 하나(확인된 주소 · 근거(HTTP 코드·바이트·제목) · 확인일).
--    수집기·사각지대훑기는 그 칸을 먼저 쓰고, 없으면 hira 값.
--    hira_org 는 건드리지 않음.」
--
-- ── 왜 ───────────────────────────────────────────────────────────
-- `hira_org.hosp_url` 은 심평원에서 받은 원본입니다. 고치면 **다음 동기화가
-- 우리 수정을 덮습니다.** 그리고 틀린 값이 많습니다 —
--   주소 있는 8,824줄 중 **822줄에 http:// 가 없습니다** (9.3%)
--   스킴이 적혀 있어도 틀립니다 — 울산대는 http 인데 사이트는 https 만 받고,
--   세종여주·화성유일은 https 인데 인증서가 깨져 http 로만 열립니다
--   경로가 죽은 것도 있습니다 — 울산대 `/main/main.asp` 는 **에러 페이지**입니다
--
-- 그래서 **확인한 주소만** 이 표에 적습니다. 근거 없이 적지 않습니다 (지침 3절).

create table if not exists public."기관주소" (
  "이름키"    text primary key,            -- "견줄이름"(기관 이름)
  "이름"      text not null,               -- 사람이 읽을 이름 (hira_org.yadm_nm 그대로)
  "주소"      text,                        -- 확인된 주소. 열 수 없으면 null
  "근거"      text not null,               -- HTTP 코드·바이트·제목 — **실제로 받은 것**
  "확인일"    date not null default (now() at time zone 'Asia/Seoul')::date,
  "누가"      text,
  "메모"      text
);

comment on table public."기관주소" is
  '확인한 기관 주소. hira_org.hosp_url 보다 **먼저** 씁니다. 근거 없이 적지 않습니다 (2026-10-19)';
comment on column public."기관주소"."주소" is
  '실제로 열어 본 주소. 열 수 없으면 null 로 두고 근거에 까닭을 적습니다';

revoke all on table public."기관주소" from public, anon, authenticated;
grant  select on table public."기관주소" to service_role;

/* ── 읽는 창구 — 한 자리 ────────────────────────────────────────
 * 「우리 칸이 **이깁니다**」를 여기 한 곳에만 둡니다 (지침 6절).
 *
 * ★ hira_org 전체(79,874줄)를 함께 돌려주지 않습니다 — 아침 메일이 그 때문에
 *   statement timeout 이 난 적이 있습니다 (2026-10-18 · 일층병원_구멍()).
 *   **우리가 정한 것만** 내놓고, 읽는 쪽은 「이 목록에 있으면 그 값, 없으면
 *   hira 값」으로 씁니다. 어느 쪽이 이기는지는 여전히 이 함수가 정합니다 —
 *   목록에 있는 이름은 `주소` 가 null 이어도(열 수 없다고 확인한 것) 그것이
 *   답이고, 심평원 값으로 되돌아가 다시 두드리지 않습니다. */
/* 반환 칸이 바뀌면 `create or replace` 가 안 됩니다 — 같은 날 안에서 고치는
   것이고 ACL 은 바로 아래 revoke/grant 가 같은 값으로 다시 겁니다 (지침 6-2a).
   전 ACL {postgres=X/postgres,service_role=X/postgres} */
drop function if exists public."기관주소보기"();
create function public."기관주소보기"()
returns table("이름키" text, "이름" text, "주소" text, "어디서" text, "확인일" date)
language sql security definer set search_path = public as $fn$
  select a."이름키", a."이름", a."주소",
         case when a."주소" is not null then '우리 표 — 열어 본 주소'
              else '우리 표 — 열 수 없다고 확인' end,
         a."확인일"
    from public."기관주소" a
   order by a."이름"
$fn$;
revoke execute on function public."기관주소보기"() from public, anon, authenticated;
grant  execute on function public."기관주소보기"() to service_role;

/* ── 적는 창구 ────────────────────────────────────────────────── */
create or replace function public."기관주소적기"(p_secret text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
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
end $fn$;
revoke execute on function public."기관주소적기"(text, jsonb) from public, anon, authenticated;
grant  execute on function public."기관주소적기"(text, jsonb) to service_role;

comment on function public."기관주소적기"(text, jsonb) is
  '확인한 기관 주소를 적습니다. 이름·근거가 비면 거부합니다 (2026-10-19)';
