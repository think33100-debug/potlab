-- ═══════════════════════════════════════════════════════════════
--  심평원 물리·작업치료사 인원을 **달마다 쌓는** 표
--  2026-10-01 준비. **아직 올리지 않았습니다** — 세중님 확인 뒤에 올립니다.
-- ═══════════════════════════════════════════════════════════════
--
--  왜 새 표가 필요한가
--    지금 쓰는 hira_detail 은 열쇠가 ykiho 하나입니다. 달마다 받으면
--    덮어써서 **지난달 숫자가 사라집니다.** 늘었는지 줄었는지 볼 수가 없습니다.
--    그래서 (기관, 연월) 두 칸을 열쇠로 하는 표를 따로 둡니다.
--    hira_detail 은 그대로 둡니다 — 「지금 숫자」를 보는 곳이고, 이 표는 「흐름」입니다.
--
--  어디서 받는가 (이미 붙여 둔 API 입니다 · tools/hira.js)
--    https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8
--      ykiho 로 묻고, gnlNopDtlCd 100 = 물리치료사 · 110 = 작업치료사,
--      gnlNopCnt 가 인원입니다 (tools/hira.js 줄 199~212 에 이미 있습니다)
--
--  얼마나 드는가
--    1층에서 요양기호가 있는 기관 534곳 × 1번 = 534번.
--    한도는 하루 10,000번입니다 (2026-09-25·26 에 9,998·9,999 에서 멈춘 실측).
--    달에 한 번이니 하루 몫의 5.3% 입니다.
--
--  끊기면 어떻게 이어받는가
--    (ykiho, 연월) 줄이 있으면 받은 것으로 봅니다. 다시 돌리면 없는 것만 받습니다.
--    hira.js 가 hira_detail 로 하는 것과 같은 방식입니다.
--
--  이름은 왜 같이 담는가
--    기관 이름은 바뀝니다 (통합·개칭). 그때 지난 줄을 읽을 수 없으면
--    흐름이 끊깁니다. 그래서 받은 때의 이름을 함께 남깁니다.
--    **지우는 줄은 없습니다** — 이 파일에는 create 와 grant 뿐입니다.

begin;

create table if not exists 심평원인원월별 (
  ykiho    text        not null,
  연월     text        not null,            -- 'YYYY-MM' · 받은 달
  기관명   text,                            -- 받은 때의 이름 (바뀌어도 흐름을 읽게)
  종별     text,
  물리     int,                             -- gnlNopDtlCd 100 · 없으면 null (0 과 다릅니다)
  작업     int,                             -- gnlNopDtlCd 110
  받은때   timestamptz not null default now(),
  primary key (ykiho, 연월),
  constraint 연월꼴 check (연월 ~ '^[0-9]{4}-[0-9]{2}$')
);

comment on table 심평원인원월별 is
  '심평원 기타인력정보(getEtcHstInfo2.8)의 물리·작업치료사 인원을 달마다 쌓습니다. '
  '(기관, 연월) 이 열쇠라 덮어쓰지 않습니다. hira_detail 은 「지금」, 이 표는 「흐름」입니다.';

create index if not exists 심평원인원월별_연월 on 심평원인원월별 (연월);

alter table 심평원인원월별 enable row level security;
-- 회원 화면은 이 표를 직접 안 읽습니다. 수집기는 아래 함수로만 드나듭니다.

-- ── 받을 곳 물어보기 ──────────────────────────────────────────
-- 1층에서 요양기호가 있는 기관 중, 그 달에 아직 안 받은 것만 돌려줍니다.
-- 1층 기준은 CLAUDE.md 세 조건 그대로입니다.
create or replace function 심평원받을곳(p_secret text, p_source text, p_연월 text)
returns table(ykiho text, 기관명 text, 종별 text)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_연월 !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '연월은 YYYY-MM 꼴이어야 합니다';
  end if;
  return query
    select o.ykiho, o.yadm_nm, o.cl_cd_nm
      from hira_org o
     where o.ykiho is not null
       and (
         o.cl_cd_nm in ('상급종합', '종합병원')              -- ② 종별
         or o.yadm_nm like '%대학병원%'                      -- ③ 이름
         or exists (select 1 from public_hospitals p         -- ① 나라·지자체
                     where replace(p.name, ' ', '') = replace(o.yadm_nm, ' ', ''))
       )
       and not exists (select 1 from 심평원인원월별 m
                        where m.ykiho = o.ykiho and m.연월 = p_연월)
     order by o.yadm_nm;
end $$;

-- ── 받은 것 담기 ──────────────────────────────────────────────
create or replace function 심평원인원담기(p_secret text, p_source text, p_rows jsonb)
returns int
language plpgsql volatile security definer set search_path to 'public'
as $$
declare n int;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  if jsonb_array_length(p_rows) > 300 then
    raise exception '한 번에 300줄까지입니다';
  end if;
  insert into 심평원인원월별 (ykiho, 연월, 기관명, 종별, 물리, 작업, 받은때)
  select e->>'ykiho', e->>'연월', e->>'기관명', e->>'종별',
         nullif(e->>'물리', '')::int, nullif(e->>'작업', '')::int, now()
    from jsonb_array_elements(p_rows) e
   where coalesce(e->>'ykiho', '') <> ''
     and coalesce(e->>'연월', '') ~ '^[0-9]{4}-[0-9]{2}$'
  on conflict (ykiho, 연월) do update
     set 기관명 = excluded.기관명, 종별 = excluded.종별,
         물리 = excluded.물리, 작업 = excluded.작업, 받은때 = excluded.받은때;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function 심평원받을곳(text, text, text) from public;
revoke all on function 심평원인원담기(text, text, jsonb) from public;
grant execute on function 심평원받을곳(text, text, text) to anon;
grant execute on function 심평원인원담기(text, text, jsonb) to anon;

commit;
