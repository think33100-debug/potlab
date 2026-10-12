/* ★ **아직 안 올렸습니다.** 세중님 승인 뒤에 하나씩 올립니다 (지침 8-8).
   ①②③④ 를 한 파일에 모았습니다. 올릴 때는 **따로** 올립니다 —
   ②에 drop 이 있어 승인 창이 뜨고, 그 창이 ①③④ 까지 붙잡으면 안 됩니다 (지침 8-7).

   ─────────────────────────────────────────────────────────────
   ① 마감 문구          마감표시()        drop 없음
   ② 밤묶음 치우기       drop 넷 + 표 하나  **drop 있음 — 세중님이 자리에 계실 때만**
   ③ 칸되메우기 창구     새 함수           drop 없음
   ④ 병원 목록 합치기    칸 더하기 + 새 함수 drop 없음
   ───────────────────────────────────────────────────────────── */


/* ═══════════════════════════════════════════════════════════════
   ① 마감 문구 — 마감표시() 한 곳 (2026-10-12)

   지금 (원문 그대로)
     apply_to 있음        → ''
     공공기관인가         → '마감일 공고문 확인'
     채용시까지|상시|수시|충원시|결원시 → '수시채용'
     그밖                 → '마감일 공고문 확인'

   바꿀 것
     「채용시까지」 류와 「수시·상시」 를 **갈라** 글귀를 달리 합니다.
       채용시까지 류 → '채용시까지 · 공고문 확인'
       수시·상시     → '수시채용'
       없음          → '마감일 공고문 확인'

   ★ 제 판단 하나를 적어 둡니다 — **「채용시까지」 를 공공기관보다 먼저 봅니다.**
     지침 15절은 「공공은 수시로 안 보이고 '마감일 공고문 확인'」 입니다. 그 까닭은
     「수시」 라고 적으면 회원이 마감일을 안 찾아보기 때문입니다. 그런데
     '채용시까지 · 공고문 확인' 은 **공고문을 보라고 말합니다.** 그래서 공공이어도
     이 글귀가 더 알려 주는 쪽입니다. 「수시채용」 은 지금처럼 **공공에는 안 씁니다.**
     이 순서가 아니라 공공을 먼저 보게 하시려면 아래 두 when 을 맞바꾸면 됩니다.

   실제 자료 (2026-10-12 · 마감일 없는 20건)
     공공 17건 — 전부 「마감일 공고문 확인」. 채용시까지·수시 글자 **0건**
     비공공 3건 — 중앙병원 「마감일 : 채용시까지」 · (동래봉생은 오늘 감췄습니다)
     **「수시」·「상시」 글자가 있는 공고는 0건입니다** — 글귀는 넣어 두지만
     지금 그 길로 가는 공고는 없습니다

   「채용시」 를 홀로 받는 까닭 — 동래봉생 원문이 「접수기간 ~ 채용시」 였습니다.
   「채용시간」 에 안 걸리게 뒤에 한글이 오면 뺍니다 (`[^가-힣]` 또는 끝).

   권한 — 인수가 그대로라 **같은 함수**이고 ACL 이 유지됩니다.
   지금 ACL 은 PUBLIC 포함이고 **그대로 둡니다** — job_list·job_one 이 비회원
   화면에서 부르고, tools/공개허용목록.json 에 적혀 있는 결정입니다.
   여기서 revoke 를 걸면 비회원 공고 화면이 죽습니다.

   부르는 곳 — job_list(3번) · job_one(1번) **둘뿐입니다.**
   `admin_jobs` 라는 DB 함수는 **없습니다** — 관리자 화면은 web/lib/admin-jobs.ts 가
   표·뷰를 직접 읽습니다. 그래서 세 곳이 아니라 **두 곳**입니다.
   (`alive_mark` 에 '마감표시' 가 4번 나오지만 그것은 변수 이름 `v_마감표시` 입니다)
   ═══════════════════════════════════════════════════════════════ */

create or replace function public."마감표시"(
  p_apply_to date, p_id text, p_tab text, p_org_name text, p_title text, "p_접수문장" text
) returns text
language sql stable as $$
  select case
    when p_apply_to is not null then ''
    /* ① 공고문이 「채용시까지」 라고 적은 것 — 공공이어도 이 글귀를 씁니다.
         공고문을 보라고 말하므로 지침 15절의 걱정(마감일을 안 찾아봄)이 없습니다 */
    when (coalesce(p_title, '') || ' ' || coalesce(p_접수문장, '')) ~
         '채용\s*시\s*까지|채용\s*완료\s*시|채용\s*시([^가-힣]|$)|충원\s*시|결원\s*시|적격자'
      then '채용시까지 · 공고문 확인'
    /* ② 공공·대학·상급종합은 「수시채용」 으로 안 보입니다 (지침 15절) */
    when 공공기관인가(p_id, p_tab, p_org_name) then '마감일 공고문 확인'
    /* ③ 공고문이 「수시」·「상시」 라고 적은 것 */
    when (coalesce(p_title, '') || ' ' || coalesce(p_접수문장, '')) ~ '수시|상시'
      then '수시채용'
    else '마감일 공고문 확인'
  end
$$;


/* ═══════════════════════════════════════════════════════════════
   ② 밤묶음 치우기 (2026-10-12) — **drop 이 있습니다**

   2026-10-11 밤에 제가 만든 것입니다. BEFORE INSERT 트리거가 upsert 의
   `excluded.hold` 를 바꿔 **기존 공고 278건을 보류로 밀었습니다**
   (회원 화면 358 → 80 · 2시간 7분). 되돌리고 함수 본문을 비워 뒀습니다.
   지침 8-14 에 적어 두었습니다. 쓸 일이 없으니 치웁니다.

   치울 것
     트리거  밤묶음_넣을때  on job_posts
     함수    밤묶음표시() · 밤묶음본것(text) · 밤묶음숨기기(text) · 밤묶음스위치()
     표      수집묶음설정   (1줄 · 켤까=false)

   **남길 것 — `job_posts.수집묶음` · `job_attachments.수집묶음` 칸**
     그날 들어온 줄을 가리키는 기록입니다. 지금 찬 줄은
       job_posts        TESTNIGHT-hold · TESTNIGHT-hidden  (둘 다 시험자료·hidden)
       job_attachments  id 1 · 2
     칸을 지우면 그 기록이 없어집니다. 글자 칸 하나라 비용이 없습니다.
     지우기를 원하시면 말씀해 주십시오 — 따로 올립니다.

   되돌리려면 — `supabase/migrations/2026_10_11_밤묶음_만료.sql` 등에 전문이 있습니다.
   다만 **되살리지 마십시오.** 「새 공고만」 을 BEFORE INSERT 트리거로는 못 합니다.
   ═══════════════════════════════════════════════════════════════ */

drop trigger if exists "밤묶음_넣을때" on public.job_posts;
drop function if exists public."밤묶음표시"();
drop function if exists public."밤묶음본것"(text);
drop function if exists public."밤묶음숨기기"(text);
drop function if exists public."밤묶음스위치"();
drop table if exists public."수집묶음설정";


/* ═══════════════════════════════════════════════════════════════
   ③ 칸되메우기 창구 (2026-10-12)

   왜 — 첨부(kordoc)에서 읽은 칸을 **이미 담긴 공고**에 되메웁니다.
   표를 직접 쓰지 않습니다 (지침). `tools/첨부되메우기.mjs` 가 이 창구만 씁니다.

   지켜야 하는 것 넷 (지침 9절 · 2026-10-07 세중님 지시)
     ① **updated_at 을 안 바꿉니다.** 그것을 보고 도는 것이 있습니다
     ② `admin_locked` 인 줄은 건드리지 않습니다
     ③ `edited_fields` 에 그 칸이 적힌 줄은 그 칸을 건드리지 않습니다
     ④ **apply_to 를 안 건드립니다.** 마감일은 출처 값이 셉니다
        (2026-10-08 — 클린아이가 준 PUB_END_DATE 가 공고문과 달랐습니다)

   받는 줄 (tools/첨부되메우기.mjs:244 가 보내는 꼴 그대로)
     { id, headcount?, apply_to_time?, work_place?, detail, 뽑은값 }
     detail · 뽑은값 은 **합쳐서 보낸 통째 jsonb** 입니다 (도구가 기존 값과 합칩니다)

   비어 있는 칸만 채웁니다 — `coalesce` 로 덮지 않습니다.
   `뽑은값` 은 **합칩니다**(`||`) — 전에 담은 근거를 지우지 않게.

   열쇠 — 도구가 service_role 로 부릅니다. p_secret 을 안 받으므로
   **service_role 에만** 줍니다 (지침 6-2·6-3).
   ═══════════════════════════════════════════════════════════════ */

create or replace function public."칸되메우기"(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_담음 int := 0; v_건너뜀 int := 0; v_없음 int := 0;
  v_칸 text;
begin
  perform set_config('app.누가', '첨부 되메우기', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    /* 그 줄이 있나 · 잠겼나 */
    if not exists (select 1 from job_posts j where j.id = r->>'id') then
      v_없음 := v_없음 + 1; continue;
    end if;
    if exists (select 1 from job_posts j where j.id = r->>'id' and coalesce(j.admin_locked, false)) then
      v_건너뜀 := v_건너뜀 + 1; continue;
    end if;

    update job_posts j set
      /* ★ updated_at 을 **안 적습니다.** 그래서 set 목록에 없습니다 */
      headcount = case
        when r ? 'headcount' and j.headcount is null
             and not ('headcount' = any(coalesce(j.edited_fields, '{}')))
        then (r->>'headcount')::int else j.headcount end,
      apply_to_time = case
        when r ? 'apply_to_time' and j.apply_to_time is null
             and not ('apply_to_time' = any(coalesce(j.edited_fields, '{}')))
        then (r->>'apply_to_time')::time else j.apply_to_time end,
      work_place = case
        when r ? 'work_place' and coalesce(j.work_place, '') = ''
             and not ('work_place' = any(coalesce(j.edited_fields, '{}')))
        then r->>'work_place' else j.work_place end,
      /* detail — 보낸 통째를 **밑에 깔고** 지금 값을 위에 덮습니다.
         그래서 이미 있는 칸은 안 바뀌고 빈 칸만 찹니다 */
      detail = case
        when r ? 'detail' and not ('detail' = any(coalesce(j.edited_fields, '{}')))
        then coalesce(r->'detail', '{}'::jsonb) || coalesce(j.detail, '{}'::jsonb)
        else j.detail end,
      /* 뽑은값 — 근거는 **합칩니다**. 전에 담은 것을 지우지 않습니다 */
      뽑은값 = coalesce(j.뽑은값, '{}'::jsonb) || coalesce(r->'뽑은값', '{}'::jsonb),
      뽑은법 = coalesce(j.뽑은법, 'kordoc'),
      뽑은때 = coalesce(j.뽑은때, now())
    where j.id = r->>'id';
    if found then v_담음 := v_담음 + 1; end if;
  end loop;

  return jsonb_build_object('담음', v_담음, '잠겨서 건너뜀', v_건너뜀, '그 공고가 없음', v_없음,
    'updated_at', '안 바꿨습니다', 'apply_to', '안 건드렸습니다');
end $$;

revoke execute on function public."칸되메우기"(jsonb) from public, anon, authenticated;
grant  execute on function public."칸되메우기"(jsonb) to service_role;


/* ═══════════════════════════════════════════════════════════════
   ④ 병원 목록 합치기 — 1단계 (2026-10-12)

   왜 — 목록이 **둘**입니다 (2026-10-12 밤조사).
     수집기가 읽는 것  gas/wage.js 의 HOSP_SITES   ← collect-hosp.mjs:118
                       (서버에서는 구워 둔 tools/hosp/hosp-sites.json)
     DB 표            hosp_sites                 ← **읽는 코드가 없습니다**

   둘은 「같은 것의 두 사본」이 **아닙니다** —
     DB url 이 홈페이지 **뿌리 주소**인 곳  142곳
     물음표 뒤만 다른 곳                    24곳
     DB off_why 는 47곳 모두 「구글 서버에서 못 엶」 한 가지 (9/20·9/25 한 번 들어온 값)
   즉 DB 는 「기관 홈페이지 주소」 표이고, 수집기 목록은 「채용게시판 주소 + 긁는 규칙」
   표입니다. 그래서 **수집기 → DB** 한 방향으로 옮깁니다.

   `gas/wage.js` 는 **한 글자도 안 건드립니다** (옛 앱 · 심사 중).

   이 단계에서는 **칸만 더하고 옮기는 창구만** 만듭니다.
   `collect-hosp.mjs` 가 DB 를 읽게 바꾸는 것은 **다음 단계**입니다 —
   그래야 옮긴 값을 눈으로 본 뒤에 바꿀 수 있습니다.
   ═══════════════════════════════════════════════════════════════ */

alter table public.hosp_sites
  add column if not exists "채용주소" text,
  add column if not exists "갈래"     text,
  add column if not exists "긁는규칙" jsonb not null default '{}'::jsonb,
  add column if not exists "끔"       boolean not null default false,
  add column if not exists "끈까닭"   text,
  add column if not exists "집에서만" boolean not null default false,
  add column if not exists "옮긴날"   date;

comment on column public.hosp_sites."채용주소" is
  '채용게시판 주소 (url 칸은 홈페이지 뿌리인 곳이 142곳이라 따로 둡니다)';
comment on column public.hosp_sites."긁는규칙" is
  'row·link·only·not·enc·host·base·cls·clsTitle·dept — gas/wage.js HOSP_SITES 의 나머지 칸';

create or replace function public."기관사이트_옮기기"(p_secret text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_못찾음 int := 0;
begin
  if p_secret is null
     or not exists (select 1 from collect_secret s
                     where s.source = 'HS3' and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  perform set_config('app.누가', '병원 목록 옮기기', true);

  update hosp_sites s set
    "채용주소" = r->>'url',
    "갈래"     = r->>'type',
    "긁는규칙" = (r - 'name' - 'url' - 'type' - 'off' - 'athome'),
    "끔"       = (r ? 'off'),
    "끈까닭"   = r->>'off',
    "집에서만" = coalesce((r->>'athome')::boolean, false),
    "옮긴날"   = (now() at time zone 'Asia/Seoul')::date
  from jsonb_array_elements(p_rows) r
  where s.name = r->>'name';
  get diagnostics v_n = row_count;

  select count(*) into v_못찾음
    from jsonb_array_elements(p_rows) r
   where not exists (select 1 from hosp_sites s where s.name = r->>'name');

  return jsonb_build_object('옮긴 곳', v_n, '넣은 줄', jsonb_array_length(p_rows),
    '이름을 못 찾은 줄', v_못찾음,
    '다음 단계', 'collect-hosp.mjs 가 DB 를 읽게 바꾸기 — 옮긴 값을 눈으로 본 뒤에');
end $$;

revoke execute on function public."기관사이트_옮기기"(text, jsonb) from public, anon, authenticated;
grant  execute on function public."기관사이트_옮기기"(text, jsonb) to service_role;
