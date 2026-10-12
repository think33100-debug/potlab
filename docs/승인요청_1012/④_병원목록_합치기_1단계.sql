/* ④ 병원 목록 합치기 — **1단계** (2026-10-12)
   ★ 아직 안 올렸습니다. 세중님 승인 뒤에 올립니다.
   지우는 문장이 한 줄도 없습니다 (표·함수를 없애는 낱말이 안 쓰였습니다) →
   승인 창이 안 뜰 것으로 봅니다. ⚠ 그 낱말은 **주석에 적어도** 창을 띄웁니다
   (지침 8-7) — 그래서 여기서도 일부러 안 적습니다.

   ═══ 왜 ═════════════════════════════════════════════════════

   병원 목록이 **둘**입니다 (2026-10-12 밤조사).

     수집기가 읽는 것  gas/wage.js 의 HOSP_SITES      ← collect-hosp.mjs:118 사이트들()
                       (서버에는 gas/ 가 없어 구워 둔
                        tools/hosp/hosp-sites.json 을 읽습니다)
     DB 표            hosp_sites                    ← **읽는 코드가 없습니다**

   둘은 「같은 것의 두 사본」이 **아닙니다.** 288곳을 곳마다 대조한 결과 —

     같음                                  107곳
     주소가 다름                           173곳
     주소 + 켜짐/꺼짐이 다름                 5곳
     한쪽에만 있음                           0곳

   주소가 다른 178곳을 갈라 보니

     DB 가 **홈페이지 뿌리 주소**만 가짐     142곳
     물음표 뒤(쪽·게시판 번호)만 다름         24곳
     그밖 (적십자 4곳·백병원 4곳 등 상위 경로) 12곳

   보기
     강진의료원   수집기 https://www.gjmed.or.kr/bbs/board.php?bo_table=notice3
                  DB    https://www.gjmed.or.kr/
     부산백병원   수집기 https://www.paik.ac.kr/busan/user/job/list.do?menuNo=900101
                  DB    https://www.paik.ac.kr/busan/

   즉 **DB 는 「기관 홈페이지 주소」 표**이고,
   **수집기 목록은 「채용게시판 주소 + 긁는 규칙」 표**입니다.
   DB 쪽에는 `type` · `row` · `link` · `only` · `not` · `enc` · `cls` 같은
   **긁는 규칙이 아예 없습니다.** 그래서 **수집기 → DB** 한 방향으로 옮깁니다.
   반대로 하면 채용게시판 주소와 긁는 규칙을 전부 잃습니다.

   `DB off_why` 는 47곳 모두 「구글 서버에서 못 엶」 한 가지이고
   `loaded_on` 이 2026-09-20 · 09-25 입니다 — 한 번 들어온 사본이고,
   그 뒤 수집기 쪽에서 5곳을 다시 켠 것이 반영되지 않았습니다.
   (수집기 기준 꺼짐은 **42곳** 입니다. DB 로 센 47 이 아닙니다)

   `gas/wage.js` 는 **한 글자도 안 건드립니다** (옛 앱 · 심사 중).

   ═══ 두 단계로 나눕니다 (세중님 승인) ════════════════════════

     **1단계 (이 파일)**  칸을 더하고, 옮기는 창구를 만듭니다. 옮기지는 않습니다
     2단계               창구로 288줄을 옮기고 **눈으로 본 뒤**
                         collect-hosp.mjs 가 DB 를 읽게 바꿉니다

   나누는 까닭 — 옮긴 값을 보기 전에 수집기를 바꾸면, 값이 틀렸을 때
   288곳 수집이 한꺼번에 멈춥니다.

   ═══ 더하는 칸 ═══════════════════════════════════════════════

   기존 칸(`name` · `url` · `base` · `kind` · `off_why` · `note` · `loaded_on`)은
   **하나도 안 건드립니다.** `url` 을 덮지 않고 `채용주소` 를 따로 둡니다 —
   142곳이 뿌리 주소라 그것도 쓸 데가 있습니다 (기관 대문 링크).
   ═══════════════════════════════════════════════════════════ */

alter table public.hosp_sites
  add column if not exists "채용주소" text,
  add column if not exists "갈래"     text,
  add column if not exists "긁는규칙" jsonb not null default '{}'::jsonb,
  add column if not exists "끔"       boolean not null default false,
  add column if not exists "끈까닭"   text,
  add column if not exists "집에서만" boolean not null default false,
  add column if not exists "옮긴날"   date;

comment on column public.hosp_sites."채용주소" is
  '채용게시판 주소. url 칸은 홈페이지 뿌리인 곳이 142곳이라 따로 둡니다 (2026-10-12)';
comment on column public.hosp_sites."갈래" is
  'html(261) · appsite(12) · cmc(6) · schmc(4) · greeting(4) · listjson(1) — sites.mjs 가 쓰는 값';
comment on column public.hosp_sites."긁는규칙" is
  'row·link·only·not·enc·host·base·cls·clsTitle·dept — HOSP_SITES 의 나머지 칸을 통째로';
comment on column public.hosp_sites."끔" is
  '수집기가 건너뛸까. HOSP_SITES 의 off. 지금 42곳입니다 (DB off_why 의 47 이 아닙니다)';
comment on column public.hosp_sites."집에서만" is
  'HOSP_SITES 의 athome — 서버 IP 로는 막히고 집에서만 열리는 곳 (26곳)';


/* 옮기는 창구. 1단계에서는 **만들기만** 하고 안 부릅니다.
   p_rows 는 tools/hosp/hosp-sites.json 의 `사이트` 배열을 그대로 넣습니다. */

create or replace function public."기관사이트_옮기기"(p_secret text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    /* name·url·type·off·athome 을 뺀 나머지를 통째로 담습니다 */
    "긁는규칙" = (r - 'name' - 'url' - 'type' - 'off' - 'athome'),
    "끔"       = (r ? 'off'),
    "끈까닭"   = r->>'off',
    "집에서만" = coalesce((r->>'athome')::boolean, false),
    "옮긴날"   = (now() at time zone 'Asia/Seoul')::date
  from jsonb_array_elements(p_rows) r
  where s.name = r->>'name';
  get diagnostics v_n = row_count;

  /* 이름이 안 맞아 못 옮긴 줄 — **말없이 넘기지 않습니다** */
  select count(*) into v_못찾음
    from jsonb_array_elements(p_rows) r
   where not exists (select 1 from hosp_sites s where s.name = r->>'name');

  return jsonb_build_object(
    '넣은 줄', v_줄,
    '옮긴 곳', v_n,
    '이름을 못 찾은 줄', v_못찾음,
    '다음 단계', 'collect-hosp.mjs 가 DB 를 읽게 바꾸기 — 옮긴 값을 눈으로 본 뒤에');
end $$;

revoke execute on function public."기관사이트_옮기기"(text, jsonb) from public, anon, authenticated;
grant  execute on function public."기관사이트_옮기기"(text, jsonb) to service_role;

/* 올린 뒤 확인할 것

   칸이 더해졌는지 (7 이어야 합니다)
     select count(*) from information_schema.columns
      where table_schema='public' and table_name='hosp_sites'
        and column_name in ('채용주소','갈래','긁는규칙','끔','끈까닭','집에서만','옮긴날');

   권한이 service_role 만인지
     select coalesce(array_to_string(proacl,' | '),'(기본값 — PUBLIC)')
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='기관사이트_옮기기';

   2단계로 넘어가기 전에 **옮기고 눈으로 봅니다** —
     옮긴 곳이 288 인지 · 이름을 못 찾은 줄이 0 인지 ·
     채용주소가 비어 있는 곳이 17곳(주소 없음)뿐인지 */
